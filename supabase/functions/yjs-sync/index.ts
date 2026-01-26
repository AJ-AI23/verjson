import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YjsSyncMessage {
  type: 'sync' | 'awareness' | 'update';
  documentId: string;
  userId?: string;
  data?: string; // base64 encoded Yjs update
  awareness?: any;
}

interface ConnectedClient {
  socket: WebSocket;
  documentId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
}

const connectedClients = new Map<string, ConnectedClient>();

// Check if user has access to a document
async function checkDocumentAccess(supabase: any, documentId: string, userId: string): Promise<boolean> {
  try {
    // Check if user owns the document
    const { data: ownedDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();
    
    if (ownedDoc) {
      console.log(`User ${userId} owns document ${documentId}`);
      return true;
    }

    // Check if user has workspace access
    const { data: document } = await supabase
      .from('documents')
      .select('workspace_id')
      .eq('id', documentId)
      .single();
    
    if (document?.workspace_id) {
      const { data: workspacePermission } = await supabase
        .from('workspace_permissions')
        .select('id')
        .eq('workspace_id', document.workspace_id)
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .single();
      
      if (workspacePermission) {
        console.log(`User ${userId} has workspace access to document ${documentId}`);
        return true;
      }
    }

    // Check if user has direct document permission
    const { data: documentPermission } = await supabase
      .from('document_permissions')
      .select('id')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .single();
    
    if (documentPermission) {
      console.log(`User ${userId} has direct permission to document ${documentId}`);
      return true;
    }

    console.log(`User ${userId} has NO access to document ${documentId}`);
    return false;
  } catch (error) {
    console.error('Error checking document access:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get('documentId');
  const authToken = url.searchParams.get('token');

  if (!documentId) {
    return new Response("Document ID required", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  // SECURITY: Require authentication - reject connections without valid token
  if (!authToken) {
    console.log(`Rejected connection to ${documentId}: No auth token provided`);
    return new Response(JSON.stringify({ error: "Authentication required" }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verify auth token and get user info
  const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
  
  if (authError || !user) {
    console.log(`Rejected connection to ${documentId}: Invalid auth token`, authError?.message);
    return new Response(JSON.stringify({ error: "Invalid authentication token" }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const userId = user.id;
  console.log(`User ${userId} attempting to connect to document ${documentId}`);

  // SECURITY: Verify user has access to this document before allowing connection
  const hasAccess = await checkDocumentAccess(supabase, documentId, userId);
  
  if (!hasAccess) {
    console.log(`Rejected connection: User ${userId} has no access to document ${documentId}`);
    return new Response(JSON.stringify({ error: "Access denied to this document" }), { 
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get user profile info
  let userName: string | undefined;
  let userAvatar: string | undefined;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('user_id', userId)
    .single();
  
  if (profile) {
    userName = profile.full_name || user.email?.split('@')[0];
    userAvatar = profile.avatar_url;
  }

  // Now safe to upgrade to WebSocket - user is authenticated and has access
  const { socket, response } = Deno.upgradeWebSocket(req);
  const clientId = crypto.randomUUID();

  socket.onopen = () => {
    console.log(`Client ${clientId} (user ${userId}) connected to document ${documentId}`);
    
    connectedClients.set(clientId, {
      socket,
      documentId,
      userId,
      userName,
      userAvatar
    });

    // Update collaboration session
    updateCollaborationSession(supabase, documentId, userId, userName, userAvatar);

    // Send current Yjs state to new client
    loadAndSendYjsState(supabase, socket, documentId);
    
    // Notify other clients about new user
    broadcastToDocument(documentId, {
      type: 'awareness',
      documentId,
      userId,
      awareness: {
        user: { id: userId, name: userName, avatar: userAvatar },
        joined: true
      }
    }, clientId);
  };

  socket.onmessage = async (event) => {
    try {
      let message: YjsSyncMessage;
      
      // Handle binary data (Yjs updates) and text data (awareness/sync)
      if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
        // Binary Yjs update - convert to base64
        const uint8Array = new Uint8Array(event.data);
        const base64Data = btoa(String.fromCharCode(...uint8Array));
        
        console.log(`Received binary Yjs update from ${clientId}, size: ${uint8Array.length} bytes`);
        
        // Save Yjs update to database (userId is guaranteed to exist now)
        await saveYjsUpdate(supabase, documentId, userId, base64Data);
        
        // Broadcast binary update to other clients
        broadcastBinaryToDocument(documentId, uint8Array, clientId);
        return;
      } else {
        // Text message (JSON) - parse as usual
        message = JSON.parse(event.data);
        console.log(`Received JSON message from ${clientId}:`, message.type);
      }

      switch (message.type) {
        case 'update':
          // Handle base64 encoded updates from custom client
          if (message.data) {
            await saveYjsUpdate(supabase, documentId, userId, message.data);
            
            // Convert base64 back to binary for broadcasting
            try {
              const binaryData = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
              broadcastBinaryToDocument(documentId, binaryData, clientId);
            } catch (e) {
              console.error('Error converting base64 to binary:', e);
            }
          }
          break;

        case 'awareness':
          // Broadcast awareness info to other clients
          broadcastToDocument(documentId, message, clientId);
          
          // Update collaboration session
          if (message.awareness) {
            await updateCollaborationSession(
              supabase, 
              documentId, 
              userId, 
              userName, 
              userAvatar,
              message.awareness.cursor
            );
          }
          break;

        case 'sync':
          // Send current state back to requesting client
          await loadAndSendYjsState(supabase, socket, documentId);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };

  socket.onclose = () => {
    console.log(`Client ${clientId} (user ${userId}) disconnected from document ${documentId}`);
    connectedClients.delete(clientId);

    // Remove collaboration session
    removeCollaborationSession(supabase, documentId, userId);

    // Notify other clients about user leaving
    broadcastToDocument(documentId, {
      type: 'awareness',
      documentId,
      userId,
      awareness: {
        user: { id: userId, name: userName, avatar: userAvatar },
        left: true
      }
    }, clientId);
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  };

  return response;
});

async function loadAndSendYjsState(supabase: any, socket: WebSocket, documentId: string) {
  try {
    const { data: yjsDoc } = await supabase
      .from('yjs_documents')
      .select('yjs_state, yjs_vector_clock')
      .eq('document_id', documentId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (yjsDoc && socket.readyState === WebSocket.OPEN) {
      // Send state as binary if we have binary data, otherwise send as JSON
      if (yjsDoc.yjs_state) {
        try {
          // If it's base64 encoded binary data, send as binary
          const binaryData = Uint8Array.from(atob(yjsDoc.yjs_state), c => c.charCodeAt(0));
          socket.send(binaryData);
          console.log(`Sent binary Yjs state to client, size: ${binaryData.length} bytes`);
        } catch (e) {
          // If it's not base64, send as JSON (fallback)
          socket.send(JSON.stringify({
            type: 'sync',
            documentId,
            data: yjsDoc.yjs_state,
            vectorClock: yjsDoc.yjs_vector_clock
          }));
        }
      }
    }
  } catch (error) {
    console.error('Error loading Yjs state:', error);
  }
}

async function saveYjsUpdate(supabase: any, documentId: string, userId: string, updateData: string) {
  try {
    // Insert or update Yjs document state
    await supabase
      .from('yjs_documents')
      .upsert({
        document_id: documentId,
        user_id: userId,
        yjs_state: updateData,
        yjs_vector_clock: {}, // Will be populated by Yjs
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'document_id,user_id'
      });
  } catch (error) {
    console.error('Error saving Yjs update:', error);
  }
}

async function updateCollaborationSession(
  supabase: any, 
  documentId: string, 
  userId: string, 
  userName?: string, 
  userAvatar?: string,
  cursorPosition?: any
) {
  try {
    await supabase
      .from('collaboration_sessions')
      .upsert({
        document_id: documentId,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        cursor_position: cursorPosition,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'document_id,user_id'
      });
  } catch (error) {
    console.error('Error updating collaboration session:', error);
  }
}

async function removeCollaborationSession(supabase: any, documentId: string, userId: string) {
  try {
    await supabase
      .from('collaboration_sessions')
      .delete()
      .eq('document_id', documentId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error removing collaboration session:', error);
  }
}

function broadcastToDocument(documentId: string, message: YjsSyncMessage, excludeClientId?: string) {
  for (const [clientId, client] of connectedClients.entries()) {
    if (client.documentId === documentId && 
        clientId !== excludeClientId && 
        client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error broadcasting to client ${clientId}:`, error);
        connectedClients.delete(clientId);
      }
    }
  }
}

function broadcastBinaryToDocument(documentId: string, binaryData: Uint8Array, excludeClientId?: string) {
  for (const [clientId, client] of connectedClients.entries()) {
    if (client.documentId === documentId && 
        clientId !== excludeClientId && 
        client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(binaryData);
        console.log(`Broadcasted binary update to client ${clientId}, size: ${binaryData.length} bytes`);
      } catch (error) {
        console.error(`Error broadcasting binary data to client ${clientId}:`, error);
        connectedClients.delete(clientId);
      }
    }
  }
}
