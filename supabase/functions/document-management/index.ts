import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { EdgeFunctionLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDocumentRequest {
  workspace_id: string;
  name: string;
  content: any;
  file_type: 'json-schema' | 'openapi';
}

interface UpdateDocumentRequest {
  id: string;
  name?: string;
  content?: any;
  file_type?: 'json-schema' | 'openapi';
}

const handler = async (req: Request): Promise<Response> => {
  const logger = new EdgeFunctionLogger('document-management', 'handler');
  
  if (req.method === 'OPTIONS') {
    logger.debug('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.logRequest(req.method, req.url);
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    logger.debug('Authenticating user');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    logger.logAuth(user);
    
    if (userError || !user) {
      logger.error('Authentication failed', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body for action-based routing
    let requestBody: any = {};
    let action = '';
    
    try {
      requestBody = await req.json();
      action = requestBody.action || '';
      logger.debug('Parsed request body', { action, hasData: Object.keys(requestBody).length > 1 });
    } catch (e) {
      logger.error('Invalid JSON in request body', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    logger.info('Processing request', { action, userId: user.id });

    switch (action) {
      case 'listDocumentsByWorkspace':
        const workspaceId = requestBody.workspace_id;
        
        logger.debug('Fetching documents for workspace', { workspaceId });
        
        if (!workspaceId) {
          logger.warn('Missing workspace_id parameter');
          return new Response(JSON.stringify({ error: 'workspace_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get documents for the workspace with proper joins
        logger.logDatabaseQuery('documents', 'SELECT with joins', { workspaceId, userId: user.id });
        const { data: documents, error: fetchError } = await supabaseClient
          .from('documents')
          .select(`
            id,
            name,
            workspace_id,
            user_id,
            file_type,
            created_at,
            updated_at,
            crowdin_integration_id,
            crowdin_integration:document_crowdin_integrations!documents_crowdin_integration_id_fkey(
              id,
              file_id,
              file_ids,
              filename,
              filenames,
              project_id,
              split_by_paths
            )
          `)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });

        logger.logDatabaseResult('documents', 'SELECT with joins', documents?.length, fetchError);
        
        if (fetchError) {
          logger.error('Failed to fetch documents', fetchError);
          return new Response(JSON.stringify({ error: fetchError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Successfully fetched documents', { count: documents?.length || 0, workspaceId });
        logger.logResponse(200, { documentsCount: documents?.length || 0 });
        return new Response(JSON.stringify({ documents: documents || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
        break;

      case 'createDocument':
        if (!requestBody.workspace_id || !requestBody.name || !requestBody.file_type) {
          logger.error('Missing required fields');
          return new Response(JSON.stringify({ error: 'workspace_id, name, and file_type are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.debug('Creating document', { name: requestBody.name, workspaceId: requestBody.workspace_id });
        
        // Create document
        logger.logDatabaseQuery('documents', 'INSERT', { name: requestBody.name, workspaceId: requestBody.workspace_id });
        const { data: document, error: createError } = await supabaseClient
          .from('documents')
          .insert({
            workspace_id: requestBody.workspace_id,
            name: requestBody.name,
            content: requestBody.content,
            file_type: requestBody.file_type,
            user_id: user.id,
          })
          .select()
          .single();

        logger.logDatabaseResult('documents', 'INSERT', document ? 1 : 0, createError);
        
        if (createError) {
          logger.error('Failed to create document', createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create initial version using the database function
        logger.logDatabaseQuery('database function', 'create_initial_version_safe', { documentId: document.id });
        const { data: versionData, error: versionError } = await supabaseClient
          .rpc('create_initial_version_safe', {
            p_document_id: document.id,
            p_user_id: user.id,
            p_content: requestBody.content
          });

        if (versionError) {
          logger.warn('Could not create initial version', versionError);
          // Don't fail the document creation, just log the warning
        } else {
          logger.logDatabaseResult('database function', 'create_initial_version_safe', 1, null);
        }

        logger.info('Document created successfully', { documentId: document.id, name: document.name });
        logger.logResponse(200, document);
        return new Response(JSON.stringify({ document }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
        break;

      case 'updateDocument':
        if (!requestBody.id) {
          logger.error('Missing required field: id');
          return new Response(JSON.stringify({ error: 'ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.debug('Updating document', { id: requestBody.id });
        logger.logDatabaseQuery('documents', 'UPDATE', { id: requestBody.id });
        const { data: updatedDocument, error: updateError } = await supabaseClient
          .from('documents')
          .update({
            name: requestBody.name,
            content: requestBody.content,
            file_type: requestBody.file_type,
          })
          .eq('id', requestBody.id)
          .select()
          .single();

        logger.logDatabaseResult('documents', 'UPDATE', updatedDocument ? 1 : 0, updateError);
        
        if (updateError) {
          logger.error('Failed to update document', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Document updated successfully', { documentId: updatedDocument.id });
        logger.logResponse(200, updatedDocument);
        return new Response(JSON.stringify({ document: updatedDocument }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
        break;

      case 'deleteDocument':
        if (!requestBody.id) {
          logger.error('Missing required field: id');
          return new Response(JSON.stringify({ error: 'ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.debug('Deleting document', { id: requestBody.id });
        
        // First, get document details and all users who have access to it
        logger.logDatabaseQuery('documents', 'SELECT document info', { id: requestBody.id });
        const { data: documentInfo, error: docInfoError } = await supabaseClient
          .from('documents')
          .select('id, name, workspace_id')
          .eq('id', requestBody.id)
          .eq('user_id', user.id)
          .single();

        if (docInfoError || !documentInfo) {
          logger.error('Document not found or access denied', docInfoError);
          return new Response(JSON.stringify({ error: 'Document not found or access denied' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get all users with document permissions
        logger.logDatabaseQuery('document_permissions', 'SELECT users with access');
        const { data: docPermissions, error: docPermError } = await supabaseClient
          .from('document_permissions')
          .select('user_id')
          .eq('document_id', requestBody.id)
          .eq('status', 'accepted')
          .neq('user_id', user.id); // Exclude the owner

        // Get all users with workspace permissions
        const { data: workspacePermissions, error: wsPermError } = await supabaseClient
          .from('workspace_permissions')
          .select('user_id')
          .eq('workspace_id', documentInfo.workspace_id)
          .eq('status', 'accepted')
          .neq('user_id', user.id); // Exclude the owner

        // Collect all unique user IDs who need to be notified
        const notifyUserIds = new Set<string>();
        if (docPermissions) {
          docPermissions.forEach(p => notifyUserIds.add(p.user_id));
        }
        if (workspacePermissions) {
          workspacePermissions.forEach(p => notifyUserIds.add(p.user_id));
        }

        // Create notifications for all affected users
        if (notifyUserIds.size > 0) {
          logger.debug('Creating deletion notifications', { userCount: notifyUserIds.size });
          const notifications = Array.from(notifyUserIds).map(userId => ({
            user_id: userId,
            document_id: requestBody.id,
            workspace_id: documentInfo.workspace_id,
            type: 'document_deleted',
            title: `Document "${documentInfo.name}" was deleted`,
            message: `The document "${documentInfo.name}" has been deleted by its owner and is no longer accessible.`,
          }));

          const { error: notifyError } = await supabaseClient
            .from('notifications')
            .insert(notifications);

          if (notifyError) {
            logger.warn('Failed to create deletion notifications', notifyError);
            // Don't fail the deletion if notifications fail
          } else {
            logger.info('Deletion notifications created', { count: notifications.length });
          }
        }

        // Now delete the document
        logger.logDatabaseQuery('documents', 'DELETE', { id: requestBody.id });
        const { error: deleteError } = await supabaseClient
          .from('documents')
          .delete()
          .eq('id', requestBody.id)
          .eq('user_id', user.id);

        logger.logDatabaseResult('documents', 'DELETE', deleteError ? 0 : 1, deleteError);
        
        if (deleteError) {
          logger.error('Failed to delete document', deleteError);
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Document deleted successfully', { documentId: requestBody.id, notifiedUsers: notifyUserIds.size });
        logger.logResponse(200);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'listSharedDocuments':
        logger.debug('Fetching shared documents', { userId: user.id, userEmail: user.email });
        
        // Use the database function to get shared documents
        logger.logDatabaseQuery('RPC', 'get_shared_documents', { userId: user.id });
        
        try {
          const { data: sharedDocs, error: sharedError } = await supabaseClient
            .rpc('get_shared_documents', { target_user_id: user.id });
          
          if (sharedError) throw sharedError;

          logger.logDatabaseResult('RPC', 'get_shared_documents', sharedDocs?.length, null);
          logger.info('Successfully fetched shared documents', { 
            count: sharedDocs?.length || 0, 
            userEmail: user.email,
            firstDoc: sharedDocs?.[0] ? {
              id: sharedDocs[0].id,
              name: sharedDocs[0].name,
              workspace_name: sharedDocs[0].workspace_name,
              shared_role: sharedDocs[0].shared_role
            } : null
          });
          logger.logResponse(200, { sharedDocumentsCount: sharedDocs?.length || 0 });
          
          return new Response(JSON.stringify({ documents: sharedDocs || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } catch (error) {
          logger.error('Error in shared documents query', error);
          return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch shared documents' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      default:
        logger.warn('Invalid action', { action });
        return new Response(JSON.stringify({ error: 'Invalid action. Supported actions: listDocumentsByWorkspace, createDocument, updateDocument, deleteDocument, listSharedDocuments' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    logger.error('Unhandled error in document-management function', error);
    logger.logResponse(500);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);