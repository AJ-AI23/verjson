import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('permissions-management', 'handler');
  logger.logRequest(req.method, req.url);

  try {
    logger.debug('Authenticating user');
    
    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication failed', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    logger.logAuth(user);

    const { action, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action, hasData: !!requestData });

    let result;

    switch (action) {
      case 'getDocumentPermissions':
        result = await handleGetDocumentPermissions(supabaseClient, requestData, logger);
        break;
      case 'getWorkspacePermissions':
        result = await handleGetWorkspacePermissions(supabaseClient, requestData, logger);
        break;
      case 'updateDocumentPermission':
        result = await handleUpdateDocumentPermission(supabaseClient, requestData, logger);
        break;
      case 'updateWorkspacePermission':
        result = await handleUpdateWorkspacePermission(supabaseClient, requestData, logger);
        break;
      case 'removeDocumentPermission':
        result = await handleRemoveDocumentPermission(supabaseClient, requestData, user, logger);
        break;
      case 'removeWorkspacePermission':
        result = await handleRemoveWorkspacePermission(supabaseClient, requestData, user, logger);
        break;
      case 'getWorkspaceForPermission':
        result = await handleGetWorkspaceForPermission(supabaseClient, requestData, logger);
        break;
      default:
        logger.warn('Unknown action requested', { action });
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: corsHeaders }
        )
    }

    logger.logResponse(200, result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    logger.logError('Request processing failed', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function handleGetDocumentPermissions(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Getting document permissions', { documentId });

  const { data: permissions, error } = await supabaseClient
    .rpc('get_document_permissions', { doc_id: documentId });

  if (error) {
    logger.error('Failed to get document permissions', error);
    throw error;
  }

  logger.info('Successfully retrieved document permissions', { 
    documentId, 
    permissionCount: permissions?.length || 0 
  });
  
  return { permissions };
}

async function handleGetWorkspacePermissions(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { workspaceId } = data;
  logger.debug('Getting workspace permissions', { workspaceId });

  const { data: permissions, error } = await supabaseClient
    .rpc('get_workspace_permissions', { ws_id: workspaceId });

  if (error) {
    logger.error('Failed to get workspace permissions', error);
    throw error;
  }

  logger.info('Successfully retrieved workspace permissions', { 
    workspaceId, 
    permissionCount: permissions?.length || 0 
  });
  
  return { permissions };
}

async function handleUpdateDocumentPermission(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { permissionId, role } = data;
  logger.debug('Updating document permission', { permissionId, role });

  const { error } = await supabaseClient
    .from('document_permissions')
    .update({ role })
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to update document permission', error);
    throw error;
  }

  logger.info('Successfully updated document permission', { permissionId, role });
  return { success: true, message: 'Permission updated successfully' };
}

async function handleUpdateWorkspacePermission(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { permissionId, role } = data;
  logger.debug('Updating workspace permission', { permissionId, role });

  const { error } = await supabaseClient
    .from('workspace_permissions')
    .update({ role })
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to update workspace permission', error);
    throw error;
  }

  logger.info('Successfully updated workspace permission', { permissionId, role });
  return { success: true, message: 'Permission updated successfully' };
}

async function handleRemoveDocumentPermission(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { permissionId, userEmail, userName, resourceName } = data;
  logger.debug('Removing document permission', { permissionId });

  // Remove the permission
  const { error } = await supabaseClient
    .from('document_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to remove document permission', error);
    throw error;
  }

  // Send notification if user details provided
  if (userEmail) {
    try {
      await supabaseClient.functions.invoke('revoke-access', {
        body: {
          permissionId,
          type: 'document',
          revokedUserEmail: userEmail,
          revokedUserName: userName,
          resourceName: resourceName || 'Unknown Document',
          revokerName: user.email
        }
      });
      logger.debug('Revocation notification sent', { userEmail });
    } catch (notificationError) {
      logger.warn('Failed to send revocation notification', notificationError);
      // Continue despite notification failure
    }
  }

  logger.info('Successfully removed document permission', { permissionId });
  return { success: true, message: 'Permission removed successfully' };
}

async function handleRemoveWorkspacePermission(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { permissionId, userEmail, userName, resourceName } = data;
  logger.debug('Removing workspace permission', { permissionId });

  // Remove the permission
  const { error } = await supabaseClient
    .from('workspace_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to remove workspace permission', error);
    throw error;
  }

  // Send notification if user details provided
  if (userEmail) {
    try {
      await supabaseClient.functions.invoke('revoke-access', {
        body: {
          permissionId,
          type: 'workspace',
          revokedUserEmail: userEmail,
          revokedUserName: userName,
          resourceName: resourceName || 'Unknown Workspace',
          revokerName: user.email
        }
      });
      logger.debug('Revocation notification sent', { userEmail });
    } catch (notificationError) {
      logger.warn('Failed to send revocation notification', notificationError);
      // Continue despite notification failure
    }
  }

  logger.info('Successfully removed workspace permission', { permissionId });
  return { success: true, message: 'Permission removed successfully' };
}

async function handleGetWorkspaceForPermission(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { workspaceId } = data;
  logger.debug('Getting workspace details', { workspaceId });

  const { data: workspace, error } = await supabaseClient
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single();

  if (error) {
    logger.error('Failed to get workspace details', error);
    throw error;
  }

  logger.info('Successfully retrieved workspace details', { workspaceId, name: workspace?.name });
  return { workspace };
}