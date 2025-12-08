import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { authenticateRequest, hasScope } from '../_shared/apiKeyAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Route configuration with required scopes
const ROUTES: Record<string, { handler: string; writeActions?: string[]; adminActions?: string[] }> = {
  'workspaces': {
    handler: 'workspace-management',
    writeActions: ['createWorkspace', 'updateWorkspace'],
    adminActions: ['deleteWorkspace']
  },
  'documents': {
    handler: 'document-management',
    writeActions: ['createDocument', 'updateDocument'],
    adminActions: ['deleteDocument']
  },
  'versions': {
    handler: 'document-versions',
    writeActions: ['createDocumentVersion', 'createInitialDocumentVersion', 'updateDocumentVersion', 'approvePendingVersion', 'rejectPendingVersion'],
    adminActions: ['deleteDocumentVersion']
  },
  'permissions': {
    handler: 'permissions-management',
    writeActions: ['updatePermission', 'inviteToDocument', 'inviteToWorkspace', 'acceptInvitation', 'declineInvitation'],
    adminActions: ['removePermission']
  },
  'notifications': {
    handler: 'notifications-management',
    writeActions: ['markNotificationAsRead', 'markAllNotificationsAsRead', 'createNotification'],
    adminActions: []
  },
  'profile': {
    handler: 'user-profile',
    writeActions: ['updateProfile'],
    adminActions: []
  },
  'crowdin': {
    handler: 'crowdin-integration',
    writeActions: ['exportToFile', 'importFromFile'],
    adminActions: []
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('api', 'gateway');
  const url = new URL(req.url);
  
  // Parse the path: /api/v1/{resource}
  const pathParts = url.pathname.split('/').filter(Boolean);
  logger.debug('Parsing request path', { pathname: url.pathname, pathParts });

  // Expected format: /api/v1/{resource} or just /{resource} depending on how it's called
  let resource = '';
  if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'v1') {
    resource = pathParts[2];
  } else if (pathParts.length >= 1) {
    // Handle direct calls like /versions, /documents etc.
    resource = pathParts[pathParts.length - 1];
  }

  logger.logRequest(req.method, req.url);
  logger.debug('Resolved resource', { resource });

  try {
    // Authenticate the request
    logger.debug('Authenticating request');
    const authResult = await authenticateRequest(req);
    
    if (!authResult.authenticated) {
      logger.error('Authentication failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: `Unauthorized - ${authResult.error}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authResult.userId!;
    const scopes = authResult.scopes || [];
    const authMethod = authResult.authMethod;

    logger.debug('Authentication successful', { userId, authMethod, scopes });

    // Parse request body
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      logger.error('Invalid JSON in request body', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const action = body.action;
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the route configuration
    const routeConfig = ROUTES[resource];
    if (!routeConfig) {
      logger.warn('Unknown resource requested', { resource });
      return new Response(
        JSON.stringify({ error: `Unknown resource: ${resource}`, availableResources: Object.keys(ROUTES) }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check scope requirements
    if (routeConfig.writeActions?.includes(action) && !hasScope(scopes, 'write')) {
      logger.warn('Insufficient scope for write operation', { action, scopes });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - write scope required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (routeConfig.adminActions?.includes(action) && !hasScope(scopes, 'admin')) {
      logger.warn('Insufficient scope for admin operation', { action, scopes });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin scope required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.debug('Routing to handler', { handler: routeConfig.handler, action, userId });

    // Create Supabase client based on auth method
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = authMethod === 'session' && authHeader
      ? createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        )
      : createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

    // Route to the appropriate handler
    const result = await routeToHandler(routeConfig.handler, action, body, userId, supabaseClient, logger);
    
    logger.logResponse(200, result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.logError('Request processing failed', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    // Map specific errors to appropriate status codes
    if (errorMessage === 'Document not found' || errorMessage.includes('not found')) {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (errorMessage.includes('Access denied') || 
        errorMessage.includes('insufficient permissions') ||
        errorMessage.includes('Operation not allowed') ||
        errorMessage.includes('Only document owners') ||
        errorMessage.includes('Unauthorized')) {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function routeToHandler(
  handler: string, 
  action: string, 
  body: any, 
  userId: string, 
  supabaseClient: any, 
  logger: EdgeFunctionLogger
): Promise<any> {
  // Create service client for operations that need elevated permissions
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const user = { id: userId };
  const { action: _, ...requestData } = body;

  switch (handler) {
    case 'workspace-management':
      return handleWorkspaceAction(action, requestData, user, supabaseClient, serviceClient, logger);
    case 'document-management':
      return handleDocumentAction(action, requestData, user, supabaseClient, serviceClient, logger);
    case 'document-versions':
      return handleVersionAction(action, requestData, user, supabaseClient, serviceClient, logger);
    case 'permissions-management':
      return handlePermissionAction(action, requestData, user, supabaseClient, serviceClient, logger);
    case 'notifications-management':
      return handleNotificationAction(action, requestData, user, supabaseClient, serviceClient, logger);
    case 'user-profile':
      return handleProfileAction(action, requestData, user, supabaseClient, serviceClient, logger);
    case 'crowdin-integration':
      return handleCrowdinAction(action, requestData, user, supabaseClient, serviceClient, logger);
    default:
      throw new Error(`Unknown handler: ${handler}`);
  }
}

// ============= WORKSPACE HANDLERS =============
async function handleWorkspaceAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling workspace action', { action, userId: user.id });

  switch (action) {
    case 'listUserWorkspaces': {
      const { data: ownWorkspaces, error: ownError } = await client
        .from('workspaces')
        .select('*, collaboratorCount:workspace_permissions(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ownError) throw ownError;

      const { data: sharedPermissions, error: sharedError } = await client
        .from('workspace_permissions')
        .select('workspace_id, role, workspaces(*)')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .neq('role', 'owner');

      if (sharedError) throw sharedError;

      const sharedWorkspaces = sharedPermissions?.map((p: any) => ({
        ...p.workspaces,
        sharedRole: p.role,
        isShared: true
      })) || [];

      const ownWithFlags = ownWorkspaces?.map((w: any) => ({ ...w, isOwner: true, isShared: false })) || [];
      return { workspaces: [...ownWithFlags, ...sharedWorkspaces] };
    }

    case 'createWorkspace': {
      const { name, description } = data;
      const { data: workspace, error } = await client
        .from('workspaces')
        .insert({ name, description, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return { workspace };
    }

    case 'updateWorkspace': {
      const { id, name, description } = data;
      const { data: workspace, error } = await client
        .from('workspaces')
        .update({ name, description })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { workspace };
    }

    case 'deleteWorkspace': {
      const { id } = data;
      const { error } = await client
        .from('workspaces')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true };
    }

    default:
      throw new Error(`Unknown workspace action: ${action}`);
  }
}

// ============= DOCUMENT HANDLERS =============
async function handleDocumentAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling document action', { action, userId: user.id });

  switch (action) {
    case 'listDocumentsByWorkspace': {
      const { workspaceId } = data;
      const { data: documents, error } = await client
        .from('documents')
        .select('id, name, workspace_id, user_id, file_type, created_at, updated_at, crowdin_integration_id, is_public')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { documents };
    }

    case 'listSharedDocuments': {
      const { data: documents, error } = await serviceClient
        .rpc('get_shared_documents', { target_user_id: user.id });

      if (error) throw error;
      return { documents };
    }

    case 'createDocument': {
      const { workspaceId, name, content, fileType } = data;
      const { data: document, error } = await client
        .from('documents')
        .insert({
          workspace_id: workspaceId,
          name,
          content: content || {},
          file_type: fileType || 'json_schema',
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return { document };
    }

    case 'updateDocument': {
      const { id, name, content, isPublic } = data;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (content !== undefined) updates.content = content;
      if (isPublic !== undefined) updates.is_public = isPublic;

      const { data: document, error } = await client
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { document };
    }

    case 'deleteDocument': {
      const { id } = data;
      const { error } = await client
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }

    default:
      throw new Error(`Unknown document action: ${action}`);
  }
}

// ============= VERSION HANDLERS =============
async function handleVersionAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling version action', { action, userId: user.id });

  // Validate document access for all version operations
  const documentId = data.documentId;
  if (!documentId) {
    throw new Error('documentId is required');
  }

  const access = await validateDocumentAccess(serviceClient, documentId, user.id, logger);

  switch (action) {
    case 'listDocumentVersions': {
      const { data: versions, error } = await serviceClient
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { versions, userRole: access.role };
    }

    case 'getDocumentVersion': {
      const { versionId } = data;
      const { data: version, error } = await serviceClient
        .from('document_versions')
        .select('*')
        .eq('id', versionId)
        .eq('document_id', documentId)
        .single();

      if (error) throw error;
      return { version };
    }

    case 'createDocumentVersion': {
      if (access.role === 'viewer') {
        throw new Error('Operation not allowed for viewer role');
      }

      const { patch } = data;
      const versionData = {
        document_id: documentId,
        user_id: user.id,
        version_major: patch.version.major,
        version_minor: patch.version.minor,
        version_patch: patch.version.patch,
        description: patch.description || '',
        tier: patch.tier || 'patch',
        is_released: patch.isReleased ?? false,
        full_document: patch.fullDocument || null,
        patches: patch.patches || null
      };

      const { data: version, error } = await serviceClient
        .from('document_versions')
        .insert(versionData)
        .select()
        .single();

      if (error) throw error;
      return { version };
    }

    case 'updateDocumentVersion': {
      if (access.role === 'viewer') {
        throw new Error('Operation not allowed for viewer role');
      }

      const { versionId, updates } = data;
      const updateData: any = {};
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.isReleased !== undefined) updateData.is_released = updates.isReleased;
      if (updates.status !== undefined) updateData.status = updates.status;

      const { data: version, error } = await serviceClient
        .from('document_versions')
        .update(updateData)
        .eq('id', versionId)
        .eq('document_id', documentId)
        .select()
        .single();

      if (error) throw error;
      return { version };
    }

    case 'deleteDocumentVersion': {
      if (access.role !== 'owner') {
        throw new Error('Only document owners can delete versions');
      }

      const { versionId } = data;
      const { error } = await serviceClient
        .from('document_versions')
        .delete()
        .eq('id', versionId)
        .eq('document_id', documentId);

      if (error) throw error;
      return { success: true };
    }

    default:
      throw new Error(`Unknown version action: ${action}`);
  }
}

// ============= PERMISSION HANDLERS =============
async function handlePermissionAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling permission action', { action, userId: user.id });

  switch (action) {
    case 'getDocumentPermissions': {
      const { documentId } = data;
      const { data: permissions, error } = await serviceClient
        .rpc('get_document_permissions', { doc_id: documentId });

      if (error) throw error;
      return { permissions };
    }

    case 'getWorkspacePermissions': {
      const { workspaceId } = data;
      const { data: permissions, error } = await serviceClient
        .rpc('get_workspace_permissions', { ws_id: workspaceId });

      if (error) throw error;
      return { permissions };
    }

    case 'getUserInvitations': {
      const { data: invitations, error } = await serviceClient
        .rpc('get_user_invitations', { target_user_id: user.id });

      if (error) throw error;
      return { invitations };
    }

    case 'acceptInvitation': {
      const { invitationId, invitationType } = data;
      const { data: result, error } = await serviceClient
        .rpc('accept_invitation', { 
          invitation_id: invitationId, 
          invitation_type: invitationType 
        });

      if (error) throw error;
      return result?.[0] || { success: false };
    }

    case 'declineInvitation': {
      const { invitationId, invitationType } = data;
      const { data: result, error } = await serviceClient
        .rpc('decline_invitation', { 
          invitation_id: invitationId, 
          invitation_type: invitationType 
        });

      if (error) throw error;
      return result?.[0] || { success: false };
    }

    default:
      throw new Error(`Unknown permission action: ${action}`);
  }
}

// ============= NOTIFICATION HANDLERS =============
async function handleNotificationAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling notification action', { action, userId: user.id });

  switch (action) {
    case 'getUserNotifications': {
      const { data: notifications, error } = await serviceClient
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { notifications };
    }

    case 'markNotificationAsRead': {
      const { notificationId } = data;
      const { data: notification, error } = await serviceClient
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { notification };
    }

    case 'markAllNotificationsAsRead': {
      const { error } = await serviceClient
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;
      return { success: true };
    }

    default:
      throw new Error(`Unknown notification action: ${action}`);
  }
}

// ============= PROFILE HANDLERS =============
async function handleProfileAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling profile action', { action, userId: user.id });

  switch (action) {
    case 'getProfile': {
      const { data: profile, error } = await serviceClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return { profile };
    }

    case 'updateProfile': {
      const { fullName, username, avatarUrl } = data;
      const updates: any = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (username !== undefined) updates.username = username;
      if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

      const { data: profile, error } = await serviceClient
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { profile };
    }

    default:
      throw new Error(`Unknown profile action: ${action}`);
  }
}

// ============= CROWDIN HANDLERS =============
async function handleCrowdinAction(action: string, data: any, user: any, client: any, serviceClient: any, logger: EdgeFunctionLogger) {
  logger.debug('Handling crowdin action', { action, userId: user.id });
  // For Crowdin, we delegate to the existing edge function logic
  // This is a simplified version - the full implementation would mirror the crowdin-integration function
  throw new Error(`Crowdin actions should use the direct crowdin-integration endpoint for now`);
}

// ============= DOCUMENT ACCESS VALIDATION =============
async function validateDocumentAccess(supabaseClient: any, documentId: string, userId: string, logger: EdgeFunctionLogger) {
  logger.debug('Validating document access', { documentId, userId });

  // Check direct document permissions
  const { data: docPermissions, error: dpError } = await supabaseClient
    .from('document_permissions')
    .select('role, status')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (dpError) throw dpError;
  if (docPermissions) {
    return { hasAccess: true, role: docPermissions.role };
  }

  // Check document ownership
  const { data: document, error: docError } = await supabaseClient
    .from('documents')
    .select('workspace_id, user_id')
    .eq('id', documentId)
    .maybeSingle();

  if (docError) throw docError;
  if (!document) throw new Error('Document not found');

  if (document.user_id === userId) {
    return { hasAccess: true, role: 'owner' };
  }

  // Check workspace permissions
  if (document.workspace_id) {
    const { data: workspacePermissions, error: wpError } = await supabaseClient
      .from('workspace_permissions')
      .select('role, status')
      .eq('workspace_id', document.workspace_id)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (wpError) throw wpError;
    if (workspacePermissions) {
      return { hasAccess: true, role: workspacePermissions.role };
    }
  }

  throw new Error('Access denied - insufficient permissions');
}
