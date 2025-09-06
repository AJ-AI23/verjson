import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { supabase } from '@/integrations/supabase/client';

interface UseYjsDocumentProps {
  documentId: string | null;
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

interface UseYjsDocumentResult {
  yjsDoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  activeUsers: Array<{
    id: string;
    name?: string;
    avatar?: string;
    cursor?: any;
  }>;
  getTextContent: () => string;
  updateContent: (content: string) => void;
  disconnect: () => void;
}

export const useYjsDocument = ({
  documentId,
  initialContent,
  onContentChange
}: UseYjsDocumentProps): UseYjsDocumentResult => {
  const [yjsDoc, setYjsDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<Array<{
    id: string;
    name?: string;
    avatar?: string;
    cursor?: any;
  }>>([]);

  const textRef = useRef<Y.Text | null>(null);
  const observerRef = useRef<((event: Y.YTextEvent) => void) | null>(null);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const initializeYjsDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Create new Y.Doc
      const doc = new Y.Doc();
      const text = doc.getText('content');
      
      // Set initial content if provided and document is empty
      if (initialContent && text.length === 0) {
        // Validate that initial content is valid JSON before inserting
        try {
          JSON.parse(initialContent);
          console.log('[YJS] Setting initial content for new document:', { documentId, contentLength: initialContent.length });
          text.insert(0, initialContent);
        } catch (e) {
          console.warn('Initial content is not valid JSON, skipping insertion:', e);
        }
      }

      // Get auth token for WebSocket connection
      const authToken = await getAuthToken();
      
      // Create WebSocket provider
      const wsUrl = `wss://swghcmyqracwifpdfyap.functions.supabase.co/functions/v1/yjs-sync?documentId=${documentId}&token=${authToken}`;
      const wsProvider = new WebsocketProvider(wsUrl, documentId, doc);

      // Set up connection event listeners
      wsProvider.on('status', (event: { status: string }) => {
        setIsConnected(event.status === 'connected');
        if (event.status === 'connected') {
          setIsLoading(false);
        }
      });

      wsProvider.on('connection-error', (event: Event) => {
        console.error('WebSocket connection error:', event);
        setError('Failed to connect to collaboration server');
        setIsLoading(false);
      });

      // Set up awareness for user presence
      const awareness = wsProvider.awareness;
      
      // Get user info for awareness
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('user_id', user.id)
          .single();

        awareness.setLocalStateField('user', {
          id: user.id,
          name: profile?.full_name || user.email?.split('@')[0],
          avatar: profile?.avatar_url
        });
      }

      // Listen to awareness changes (other users)
      awareness.on('change', () => {
        const users = Array.from(awareness.getStates().entries())
          .filter(([clientId, state]) => clientId !== awareness.clientID)
          .map(([clientId, state]) => ({
            id: state.user?.id || clientId.toString(),
            name: state.user?.name,
            avatar: state.user?.avatar,
            cursor: state.cursor
          }));
        setActiveUsers(users);
      });

      // Set up text change observer
      const observer = (event: Y.YTextEvent) => {
        const content = text.toString();
        // Only notify of changes if content is valid JSON
        try {
          JSON.parse(content);
          onContentChange?.(content);
        } catch (e) {
          // Content is not valid JSON yet, skip notification
          // This prevents errors during partial sync operations
        }
      };

      text.observe(observer);

      // Store references
      textRef.current = text;
      observerRef.current = observer;
      setYjsDoc(doc);
      setProvider(wsProvider);

    } catch (err) {
      console.error('Error initializing Yjs document:', err);
      setError('Failed to initialize collaborative editing');
      setIsLoading(false);
    }
  }, [documentId]); // Remove initialContent and onContentChange from dependencies

  const getTextContent = useCallback(() => {
    return textRef.current?.toString() || '';
  }, []);

  const updateContent = useCallback((content: string) => {
    if (!textRef.current) return;

    // Replace entire content
    textRef.current.delete(0, textRef.current.length);
    textRef.current.insert(0, content);
  }, []);

  const disconnect = useCallback(() => {
    if (observerRef.current && textRef.current) {
      textRef.current.unobserve(observerRef.current);
    }
    
    if (provider) {
      provider.destroy();
    }
    
    if (yjsDoc) {
      yjsDoc.destroy();
    }

    setYjsDoc(null);
    setProvider(null);
    setIsConnected(false);
    setActiveUsers([]);
    textRef.current = null;
    observerRef.current = null;
  }, [provider, yjsDoc]);

  // Initialize when documentId changes
  useEffect(() => {
    if (documentId) {
      // Cleanup previous connection before initializing new one
      disconnect();
      initializeYjsDocument();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [documentId]);

  return {
    yjsDoc,
    provider,
    isConnected,
    isLoading,
    error,
    activeUsers,
    getTextContent,
    updateContent,
    disconnect
  };
};