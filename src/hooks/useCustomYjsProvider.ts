import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { Awareness } from 'y-protocols/awareness';

export class CustomYjsProvider {
  private doc: Y.Doc;
  private awareness: Awareness;
  private ws: WebSocket | null = null;
  private url: string;
  private connected = false;
  private shouldConnect = true;
  private reconnectTimeoutId: number | null = null;
  private synced = false;
  
  public readonly clientID: number;

  constructor(serverUrl: string, room: string, doc: Y.Doc, awareness?: Awareness) {
    this.doc = doc;
    this.url = serverUrl;
    this.awareness = awareness || new Awareness(doc);
    this.clientID = this.awareness.clientID;
    
    this.setupDocumentListeners();
    this.setupAwarenessListeners();
    this.connect();
  }

  private setupDocumentListeners() {
    this.doc.on('updateV2', this.documentUpdateHandler);
  }

  private setupAwarenessListeners() {
    this.awareness.on('update', this.awarenessUpdateHandler);
  }

  private documentUpdateHandler = (update: Uint8Array, origin: any) => {
    if (origin !== this && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send binary update directly
      this.ws.send(update);
    }
  };

  private awarenessUpdateHandler = ({ added, updated, removed }: any) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const changedClients = added.concat(updated, removed);
      if (changedClients.length > 0) {
        // Send awareness as JSON message
        this.ws.send(JSON.stringify({
          type: 'awareness',
          documentId: this.url.split('documentId=')[1]?.split('&')[0],
          awareness: {
            added,
            updated, 
            removed,
            states: Array.from(this.awareness.getStates().entries())
              .filter(([clientId]) => changedClients.includes(clientId))
              .map(([clientId, state]) => ({ clientId, state }))
          }
        }));
      }
    }
  };

  private connect() {
    if (!this.shouldConnect || this.ws) return;

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('YJS WebSocket connected');
        this.connected = true;
        
        // Send sync step 1
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // sync message type
        syncProtocol.writeSyncStep1(encoder, this.doc);
        this.ws!.send(encoding.toUint8Array(encoder));

        // Send awareness state
        this.awarenessUpdateHandler({
          added: [this.awareness.clientID],
          updated: [],
          removed: []
        });

        this.emit('status', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
            // Binary message - handle as Yjs update
            const data = new Uint8Array(event.data);
            this.handleBinaryMessage(data);
          } else {
            // Text message - handle as JSON (awareness, etc.)
            const message = JSON.parse(event.data);
            this.handleJsonMessage(message);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('YJS WebSocket disconnected');
        this.connected = false;
        this.ws = null;
        this.emit('status', { status: 'disconnected' });
        
        if (this.shouldConnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('YJS WebSocket error:', error);
        this.emit('connection-error', error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.emit('connection-error', error);
      this.scheduleReconnect();
    }
  }

  private handleBinaryMessage(data: Uint8Array) {
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);
    
    switch (messageType) {
      case 0: // sync
        // Apply the update to the document
        Y.applyUpdateV2(this.doc, decoding.readVarUint8Array(decoder), this);
        if (!this.synced) {
          this.synced = true;
          this.emit('synced', true);
        }
        break;
      case 1: // awareness
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
        break;
    }
  }

  private handleJsonMessage(message: any) {
    switch (message.type) {
      case 'awareness':
        if (message.awareness) {
          // Handle awareness updates
          const { states = [] } = message.awareness;
          
          // Apply awareness changes
          for (const { clientId, state } of states) {
            if (clientId !== this.awareness.clientID) {
              this.awareness.setLocalStateField('user', state.user);
            }
          }
        }
        break;
      case 'sync':
        // Handle sync response
        if (message.data) {
          try {
            const binaryData = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
            this.handleBinaryMessage(binaryData);
          } catch (e) {
            console.error('Error parsing sync data:', e);
          }
        }
        break;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    this.reconnectTimeoutId = window.setTimeout(() => {
      if (this.shouldConnect && !this.ws) {
        this.connect();
      }
    }, 3000);
  }

  // Event emitter functionality
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }
  }

  private emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => listener(data));
    }
  }

  disconnect() {
    this.shouldConnect = false;
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
  }

  destroy() {
    this.disconnect();
    this.doc.off('updateV2', this.documentUpdateHandler);
    this.awareness.off('update', this.awarenessUpdateHandler);
  }

  get wsconnected() {
    return this.connected;
  }

  get wsconnecting() {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }
}