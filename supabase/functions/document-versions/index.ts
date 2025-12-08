import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'
import { authenticateRequest, hasScope } from '../_shared/apiKeyAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('document-versions', 'handler');
  logger.logRequest(req.method, req.url);

  try {
    logger.debug('Authenticating user');
    
    // Use unified authentication (supports both session tokens and API keys)
    const authResult = await authenticateRequest(req);
    
    if (!authResult.authenticated) {
      logger.error('Authentication failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: `Unauthorized - ${authResult.error}` }),
        { status: 401, headers: corsHeaders }
      )
    }

    const userId = authResult.userId!;
    const scopes = authResult.scopes || [];
    const authMethod = authResult.authMethod;

    logger.debug('Authentication successful', { userId, authMethod, scopes });

    const { action, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action, hasData: !!requestData });

    // Check scope requirements for write operations
    const writeActions = ['createDocumentVersion', 'createInitialDocumentVersion', 'updateDocumentVersion', 'approvePendingVersion', 'rejectPendingVersion'];
    const deleteActions = ['deleteDocumentVersion'];
    
    if (writeActions.includes(action) && !hasScope(scopes, 'write')) {
      logger.warn('Insufficient scope for write operation', { action, scopes });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - write scope required' }),
        { status: 403, headers: corsHeaders }
      )
    }
    
    if (deleteActions.includes(action) && !hasScope(scopes, 'admin')) {
      logger.warn('Insufficient scope for delete operation', { action, scopes });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin scope required' }),
        { status: 403, headers: corsHeaders }
      )
    }
    
    // Create a mock user object for compatibility with existing handlers
    const user = { id: userId };

    // Create authenticated Supabase client for the user
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

    let result;

    switch (action) {
      case 'listDocumentVersions':
        result = await handleListDocumentVersions(supabaseClient, requestData, user, logger);
        break;
      case 'createDocumentVersion':
        result = await handleCreateDocumentVersion(supabaseClient, requestData, user, logger);
        break;
      case 'createInitialDocumentVersion':
        result = await handleCreateInitialDocumentVersion(supabaseClient, requestData, user, logger);
        break;
      case 'updateDocumentVersion':
        result = await handleUpdateDocumentVersion(supabaseClient, requestData, user, logger);
        break;
      case 'deleteDocumentVersion':
        result = await handleDeleteDocumentVersion(supabaseClient, requestData, user, logger);
        break;
      case 'approvePendingVersion':
        result = await handleApprovePendingVersion(supabaseClient, requestData, user, logger);
        break;
      case 'rejectPendingVersion':
        result = await handleRejectPendingVersion(supabaseClient, requestData, user, logger);
        break;
      case 'getDocumentVersion':
        result = await handleGetDocumentVersion(supabaseClient, requestData, user, logger);
        break;
      case 'getVersionDiff':
        result = await handleGetVersionDiff(supabaseClient, requestData, user, logger);
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
    
    // Handle specific permission errors with appropriate status codes
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    if (errorMessage === 'Document not found') {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: corsHeaders }
      );
    }
    
    if (errorMessage.includes('Access denied') || 
        errorMessage.includes('insufficient permissions') ||
        errorMessage.includes('Operation not allowed') ||
        errorMessage.includes('Only document owners') ||
        errorMessage.includes('You can only update versions')) {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 403, headers: corsHeaders }
      );
    }
    
    if (errorMessage.includes('Cannot delete selected version')) {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function validateDocumentAccess(supabaseClient: any, documentId: string, userId: string, logger: EdgeFunctionLogger) {
  logger.debug('🔍 Starting document access validation', { documentId, userId });

  try {
    // First check direct document permissions
    logger.debug('📋 Step 1: Checking direct document permissions');
    const { data: docPermissions, error: dpError } = await supabaseClient
      .from('document_permissions')
      .select('role, status')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();

    logger.debug('📋 Document permissions query result', { 
      docPermissions, 
      error: dpError?.message,
      errorCode: dpError?.code,
      hasPermissions: !!docPermissions
    });

    if (dpError) {
      logger.error('❌ Error checking document permissions', dpError);
      throw dpError;
    }

    if (docPermissions) {
      logger.debug('✅ User has direct document permissions', { documentId, userId, role: docPermissions.role });
      return { hasAccess: true, role: docPermissions.role };
    }

    // Check if user is document owner via documents table
    logger.debug('🏠 Step 2: Checking document ownership via documents table');
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('workspace_id, user_id')
      .eq('id', documentId)
      .maybeSingle();

    logger.debug('🏠 Documents table query result', { 
      document, 
      error: docError?.message,
      errorCode: docError?.code,
      hasDocument: !!document,
      isOwnerViaUserId: document ? document.user_id === userId : false
    });

    if (docError) {
      logger.debug('⚠️ Error accessing documents table (might be due to RLS)', { error: docError });
    } else if (document) {
      // Check user_id field for ownership
      if (document.user_id === userId) {
        logger.debug('✅ User is document owner', { documentId, userId });
        return { hasAccess: true, role: 'owner' };
      }

      // Check workspace permissions if we have workspace_id
      if (document.workspace_id) {
        logger.debug('🏢 Step 2.1: Checking workspace permissions for document workspace');
        const { data: workspacePermissions, error: wpError } = await supabaseClient
          .from('workspace_permissions')
          .select('role, status')
          .eq('workspace_id', document.workspace_id)
          .eq('user_id', userId)
          .eq('status', 'accepted')
          .maybeSingle();

        logger.debug('🏢 Workspace permissions query result', { 
          workspaceId: document.workspace_id,
          workspacePermissions, 
          error: wpError?.message,
          errorCode: wpError?.code,
          hasWorkspaceAccess: !!workspacePermissions
        });

        if (workspacePermissions) {
          logger.debug('✅ User has workspace permissions', { documentId, userId, role: workspacePermissions.role });
          return { hasAccess: true, role: workspacePermissions.role };
        }
      }
    }

    // Use RPC to get document permissions which bypasses RLS
    logger.debug('🔧 Step 3: Using RPC to get document permissions');
    const { data: rpcPermissions, error: rpcError } = await supabaseClient
      .rpc('get_document_permissions', { doc_id: documentId });

    logger.debug('🔧 RPC permissions query result', { 
      rpcPermissions, 
      error: rpcError?.message,
      errorCode: rpcError?.code,
      permissionCount: rpcPermissions?.length || 0,
      allPermissions: rpcPermissions?.map((p: any) => ({ 
        user_id: p.user_id, 
        role: p.role, 
        status: p.status 
      }))
    });

    if (rpcError) {
      logger.error('❌ Error calling get_document_permissions RPC', rpcError);
      throw rpcError;
    }

    if (!rpcPermissions || rpcPermissions.length === 0) {
      logger.error('❌ Document not found - no permissions returned by RPC', { documentId });
      throw new Error('Document not found');
    }

    const userPermission = rpcPermissions?.find((p: any) => p.user_id === userId && p.status === 'accepted');
    logger.debug('🔍 Looking for user permission in RPC results', { 
      userPermission,
      searchingFor: { userId, status: 'accepted' }
    });

    if (userPermission) {
      logger.debug('✅ User has permissions via RPC', { documentId, userId, role: userPermission.role });
      return { hasAccess: true, role: userPermission.role };
    }

    // Check all workspace permissions as a final fallback
    logger.debug('🏢 Step 4: Checking all user workspace permissions');
    const { data: allWorkspacePermissions, error: allWpError } = await supabaseClient
      .from('workspace_permissions')
      .select('role, status, workspace_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    logger.debug('🏢 All workspace permissions query result', { 
      allWorkspacePermissions, 
      error: allWpError?.message,
      errorCode: allWpError?.code,
      workspaceCount: allWorkspacePermissions?.length || 0
    });

    if (allWpError) {
      logger.error('❌ Error checking all workspace permissions', allWpError);
      throw allWpError;
    }

    if (allWorkspacePermissions && allWorkspacePermissions.length > 0) {
      logger.debug('🔍 Checking if document belongs to any user workspaces');
      // Check if any of these workspaces contain the document
      for (const wp of allWorkspacePermissions) {
        logger.debug('🏢 Checking workspace', { workspaceId: wp.workspace_id, role: wp.role });
        
        const { data: workspaceDoc, error: wdError } = await supabaseClient
          .from('documents')
          .select('id')
          .eq('id', documentId)
          .eq('workspace_id', wp.workspace_id)
          .maybeSingle();
        
        logger.debug('🏢 Workspace document check result', { 
          workspaceId: wp.workspace_id,
          workspaceDoc, 
          error: wdError?.message,
          errorCode: wdError?.code,
          foundInWorkspace: !!workspaceDoc
        });
        
        if (workspaceDoc) {
          logger.debug('✅ User has workspace access to document', { 
            documentId, 
            userId, 
            workspaceId: wp.workspace_id, 
            role: wp.role 
          });
          return { hasAccess: true, role: wp.role };
        }
      }
    }

    logger.warn('❌ User has no access to document after all checks', { documentId, userId });
    throw new Error('Access denied - insufficient permissions');

  } catch (error) {
    if ((error instanceof Error && error.message === 'Document not found') || 
        (error instanceof Error && error.message === 'Access denied - insufficient permissions')) {
      logger.error('🚫 Permission validation failed', { documentId, userId, errorMessage: error.message });
      throw error;
    }
    logger.error('💥 Unexpected error in validateDocumentAccess', error);
    throw error;
  }
}

async function handleListDocumentVersions(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Listing document versions', { documentId, userId: user.id });

  // Validate user has access to the document
  const access = await validateDocumentAccess(supabaseClient, documentId, user.id, logger);
  
  // Use service role client to bypass RLS for versions query since 
  // document_versions table RLS policy doesn't properly handle document_permissions
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  logger.debug('Querying document versions with service role', { documentId });
  
  // All roles (owner, editor, viewer) can view version history
  const { data: versions, error } = await serviceClient
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to list document versions', error);
    throw error;
  }

  logger.info('Successfully retrieved document versions', { 
    documentId, 
    versionCount: versions?.length || 0,
    userRole: access.role
  });
  
  return { versions, userRole: access.role };
}

async function handleCreateDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, patch } = data;
  logger.debug('Creating document version', { documentId, description: patch.description });

  // Validate user has editor or owner permissions
  const access = await validateDocumentAccess(supabaseClient, documentId, user.id, logger);
  
  if (access.role === 'viewer') {
    logger.warn('User attempted to create version with viewer permissions', { documentId, userId: user.id });
    throw new Error('Operation not allowed for viewer role');
  }

  // Use service role client for validation and creation
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch existing versions to validate version number
  logger.debug('Fetching existing versions for validation', { documentId });
  const { data: existingVersions, error: fetchError } = await serviceClient
    .from('document_versions')
    .select('version_major, version_minor, version_patch')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (fetchError) {
    logger.error('Failed to fetch existing versions for validation', fetchError);
    throw new Error('Failed to validate version number');
  }

  // Validate version number
  if (existingVersions && existingVersions.length > 0) {
    const newVersion = patch.version;
    
    // Check if version already exists
    const versionExists = existingVersions.some(v => 
      v.version_major === newVersion.major &&
      v.version_minor === newVersion.minor &&
      v.version_patch === newVersion.patch
    );
    
    if (versionExists) {
      const versionStr = `${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;
      logger.warn('Version number already exists', { documentId, version: versionStr });
      throw new Error(`Version ${versionStr} already exists in history`);
    }
    
    // Check if version is higher than all existing versions
    const latestVersion = existingVersions.reduce((latest, current) => {
      const latestNum = latest.version_major * 1000000 + latest.version_minor * 1000 + latest.version_patch;
      const currentNum = current.version_major * 1000000 + current.version_minor * 1000 + current.version_patch;
      return currentNum > latestNum ? current : latest;
    });
    
    const newVersionNum = newVersion.major * 1000000 + newVersion.minor * 1000 + newVersion.patch;
    const latestVersionNum = latestVersion.version_major * 1000000 + latestVersion.version_minor * 1000 + latestVersion.version_patch;
    
    if (newVersionNum <= latestVersionNum) {
      const newVersionStr = `${newVersion.major}.${newVersion.minor}.${newVersion.patch}`;
      const latestVersionStr = `${latestVersion.version_major}.${latestVersion.version_minor}.${latestVersion.version_patch}`;
      logger.warn('Version number is not higher than latest version', { 
        documentId, 
        newVersion: newVersionStr,
        latestVersion: latestVersionStr 
      });
      throw new Error(`Version ${newVersionStr} must be higher than the latest version ${latestVersionStr}`);
    }
  }

  const versionData = {
    document_id: documentId,
    user_id: user.id,
    version_major: patch.version.major,
    version_minor: patch.version.minor,
    version_patch: patch.version.patch,
    description: patch.description,
    tier: patch.tier,
    is_released: patch.isReleased || false,
    is_selected: patch.isSelected !== false,
    patches: patch.patches ? JSON.stringify(patch.patches) : null,
    full_document: patch.fullDocument || null,
  };

  logger.debug('Creating document version with service role', { documentId, userId: user.id });

  const { data: version, error } = await serviceClient
    .from('document_versions')
    .insert(versionData)
    .select()
    .single();

  if (error) {
    // Handle duplicate initial version gracefully
    if (error.message.includes('duplicate key') && patch.description === 'Initial version') {
      logger.debug('Initial version already exists, fetching existing version');
      
      const { data: existingVersion, error: fetchError } = await serviceClient
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .eq('description', 'Initial version')
        .single();
        
      if (!fetchError && existingVersion) {
        logger.info('Retrieved existing initial version', { versionId: existingVersion.id });
        return { version: existingVersion };
      }
    }
    
    logger.error('Failed to create document version', error);
    throw error;
  }

  logger.info('Successfully created document version', { 
    documentId, 
    versionId: version.id,
    description: patch.description,
    userRole: access.role
  });
  
  return { version };
}

async function handleCreateInitialDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, content } = data;
  logger.debug('Creating initial document version', { documentId, userId: user.id });

  // Validate user has editor or owner permissions
  const access = await validateDocumentAccess(supabaseClient, documentId, user.id, logger);
  
  if (access.role === 'viewer') {
    logger.warn('User attempted to create initial version with viewer permissions', { documentId, userId: user.id });
    throw new Error('Operation not allowed for viewer role');
  }

  const { data: versionId, error } = await supabaseClient.rpc('create_initial_version_safe', {
    p_document_id: documentId,
    p_user_id: user.id,
    p_content: content
  });

  if (error) {
    logger.error('Failed to create initial document version', error);
    throw error;
  }

  // Fetch the created/existing version
  const { data: versionData, error: fetchError } = await supabaseClient
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (fetchError) {
    logger.error('Failed to fetch created initial version', fetchError);
    throw fetchError;
  }

  logger.info('Successfully created initial document version', { 
    documentId, 
    versionId: versionData.id,
    userRole: access.role
  });
  
  return { version: versionData };
}

async function handleUpdateDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { versionId, updates } = data;
  logger.debug('Updating document version', { versionId, userId: user.id });

  // Use service role client to bypass RLS for version queries
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // First, get the version to check document access and version ownership
  const { data: version, error: versionError } = await serviceClient
    .from('document_versions')
    .select('document_id, user_id')
    .eq('id', versionId)
    .single();

  if (versionError || !version) {
    logger.error('Version not found', { versionId, error: versionError });
    throw new Error('Version not found');
  }

  // Validate user has access to the document
  const access = await validateDocumentAccess(supabaseClient, version.document_id, user.id, logger);
  
  if (access.role === 'viewer') {
    logger.warn('User attempted to update version with viewer permissions', { versionId, userId: user.id });
    throw new Error('Operation not allowed for viewer role');
  }

  // Additional check: Users can only update versions they created (except owners can update any)
  if (access.role !== 'owner' && version.user_id !== user.id) {
    logger.warn('User attempted to update version they did not create', { versionId, userId: user.id, versionCreator: version.user_id });
    throw new Error('You can only update versions you created');
  }

  logger.debug('Updating document version with service role', { versionId, userId: user.id });

  const { data: updatedVersion, error } = await serviceClient
    .from('document_versions')
    .update(updates)
    .eq('id', versionId)
    .eq('user_id', access.role === 'owner' ? version.user_id : user.id) // Allow owners to update any version
    .select()
    .single();

  if (error) {
    logger.error('Failed to update document version', error);
    throw error;
  }

  logger.info('Successfully updated document version', { 
    versionId, 
    updatedFields: Object.keys(updates),
    userRole: access.role
  });
  
  return { version: updatedVersion };
}

async function handleDeleteDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { versionId } = data;
  logger.debug('Deleting document version', { versionId, userId: user.id });

  // Use service role client to bypass RLS for version operations
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // First, get the version to check document access
  const { data: version, error: versionError } = await serviceClient
    .from('document_versions')
    .select('document_id, user_id, is_selected')
    .eq('id', versionId)
    .single();

  if (versionError || !version) {
    logger.error('Version not found', { versionId, error: versionError });
    throw new Error('Version not found');
  }

  // Validate user has access to the document
  const access = await validateDocumentAccess(supabaseClient, version.document_id, user.id, logger);
  
  // Only owners can delete versions
  if (access.role !== 'owner') {
    logger.warn('User attempted to delete version without owner permissions', { versionId, userId: user.id, userRole: access.role });
    throw new Error('Only document owners can delete versions');
  }

  // Prevent deleting selected versions to maintain document integrity
  if (version.is_selected) {
    logger.warn('User attempted to delete selected version', { versionId, userId: user.id });
    throw new Error('Cannot delete selected version. Please deselect it first.');
  }

  logger.debug('Deleting document version with service role', { versionId });

  const { error } = await serviceClient
    .from('document_versions')
    .delete()
    .eq('id', versionId);

  if (error) {
    logger.error('Failed to delete document version', error);
    throw error;
  }

  logger.info('Successfully deleted document version', { versionId, userRole: access.role });
  
  return { success: true, message: 'Version deleted successfully' };
}

async function handleApprovePendingVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { versionId } = data;
  logger.debug('Approving pending version', { versionId, userId: user.id });

  // Use service role client to bypass RLS
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // First, get the version to check document access and verify it's pending
  const { data: version, error: versionError } = await serviceClient
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (versionError || !version) {
    logger.error('Version not found', { versionId, error: versionError });
    throw new Error('Version not found');
  }

  if (version.status !== 'pending') {
    logger.warn('Attempted to approve non-pending version', { versionId, status: version.status });
    throw new Error('Version is not pending approval');
  }

  // Validate user has access to the document (editors and owners can approve)
  const access = await validateDocumentAccess(supabaseClient, version.document_id, user.id, logger);
  
  if (access.role === 'viewer') {
    logger.warn('User attempted to approve version with viewer permissions', { versionId, userId: user.id });
    throw new Error('Operation not allowed for viewer role');
  }

  // Get all versions for this document to determine the correct selection state
  const { data: allVersions, error: allVersionsError } = await serviceClient
    .from('document_versions')
    .select('id, created_at, is_selected')
    .eq('document_id', version.document_id)
    .order('created_at', { ascending: true });

  if (allVersionsError) {
    logger.error('Failed to get all versions', allVersionsError);
    throw allVersionsError;
  }

  // Sort versions by creation time to understand chronological order
  const sortedVersions = allVersions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  // Find the index of the version being approved
  const approvedVersionIndex = sortedVersions.findIndex(v => v.id === versionId);
  
  if (approvedVersionIndex === -1) {
    logger.error('Approved version not found in version list', { versionId });
    throw new Error('Version not found in document versions');
  }

  // Update the approved version to visible and selected
  const { data: updatedVersion, error: updateError } = await serviceClient
    .from('document_versions')
    .update({ 
      status: 'visible', 
      is_selected: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', versionId)
    .select()
    .single();

  if (updateError) {
    logger.error('Failed to update version status', updateError);
    throw updateError;
  }

  // Ensure all versions created before or at the same time as the approved version are selected (Applied)
  // and versions created after are deselected (Skipped)
  const approvedVersionTime = new Date(version.created_at).getTime();
  
  for (const v of sortedVersions) {
    if (v.id === versionId) continue; // Already updated above
    
    const versionTime = new Date(v.created_at).getTime();
    const shouldBeSelected = versionTime <= approvedVersionTime;
    
    // Only update if the selection state needs to change
    if (v.is_selected !== shouldBeSelected) {
      const { error: updateSelectionError } = await serviceClient
        .from('document_versions')
        .update({ is_selected: shouldBeSelected })
        .eq('id', v.id);
        
      if (updateSelectionError) {
        logger.error('Failed to update version selection state', { versionId: v.id, error: updateSelectionError });
      }
    }
  }

  // Update document content if we have full_document
  if (version.full_document) {
    const { error: docUpdateError } = await serviceClient
      .from('documents')
      .update({ 
        content: version.full_document,
        updated_at: new Date().toISOString()
      })
      .eq('id', version.document_id);

    if (docUpdateError) {
      logger.error('Failed to update document content', docUpdateError);
      throw docUpdateError;
    }
  }

  logger.info('Successfully approved pending version', { 
    versionId, 
    documentId: version.document_id,
    userRole: access.role,
    versionsUpdated: sortedVersions.length
  });
  
  return { version: updatedVersion, success: true };
}

async function handleRejectPendingVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { versionId } = data;
  logger.debug('Rejecting pending version', { versionId, userId: user.id });

  // Use service role client to bypass RLS
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // First, get the version to check document access and verify it's pending
  const { data: version, error: versionError } = await serviceClient
    .from('document_versions')
    .select('document_id, status')
    .eq('id', versionId)
    .single();

  if (versionError || !version) {
    logger.error('Version not found', { versionId, error: versionError });
    throw new Error('Version not found');
  }

  if (version.status !== 'pending') {
    logger.warn('Attempted to reject non-pending version', { versionId, status: version.status });
    throw new Error('Version is not pending approval');
  }

  // Validate user has access to the document (editors and owners can reject)
  const access = await validateDocumentAccess(supabaseClient, version.document_id, user.id, logger);
  
  if (access.role === 'viewer') {
    logger.warn('User attempted to reject version with viewer permissions', { versionId, userId: user.id });
    throw new Error('Operation not allowed for viewer role');
  }

  // Delete the pending version
  const { error: deleteError } = await serviceClient
    .from('document_versions')
    .delete()
    .eq('id', versionId);

  if (deleteError) {
    logger.error('Failed to delete pending version', deleteError);
    throw deleteError;
  }

  logger.info('Successfully rejected pending version', { 
    versionId, 
    documentId: version.document_id,
    userRole: access.role
  });
  
  return { success: true, message: 'Pending version rejected' };
}

/**
 * Calculate the effective document content by applying all selected versions up to and including
 * the specified version ID.
 */
async function calculateEffectiveDocumentAtVersion(
  serviceClient: any, 
  documentId: string, 
  targetVersionId: string, 
  logger: EdgeFunctionLogger
): Promise<{ effectiveContent: any; targetVersion: any }> {
  // Get all versions for this document ordered by creation time
  const { data: allVersions, error: versionsError } = await serviceClient
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (versionsError) {
    logger.error('Failed to fetch versions', versionsError);
    throw versionsError;
  }

  if (!allVersions || allVersions.length === 0) {
    throw new Error('No versions found for document');
  }

  // Find the target version
  const targetVersion = allVersions.find((v: any) => v.id === targetVersionId);
  if (!targetVersion) {
    throw new Error('Target version not found');
  }

  const targetVersionTime = new Date(targetVersion.created_at).getTime();

  // Get versions up to and including the target version that are selected
  // or the target version itself (regardless of selection status)
  const versionsToApply = allVersions.filter((v: any) => {
    const versionTime = new Date(v.created_at).getTime();
    // Include if it's before/at the target time AND selected, OR if it's the target version
    return (versionTime <= targetVersionTime && v.is_selected) || v.id === targetVersionId;
  });

  logger.debug('Calculating effective document', { 
    totalVersions: allVersions.length,
    versionsToApply: versionsToApply.length,
    targetVersionId 
  });

  // Start with empty object and apply versions in order
  let effectiveContent: any = {};

  for (const version of versionsToApply) {
    if (version.full_document) {
      // If version has full_document, use it as the base
      effectiveContent = JSON.parse(JSON.stringify(version.full_document));
    } else if (version.patches) {
      // If version has patches, apply them
      const patches = typeof version.patches === 'string' 
        ? JSON.parse(version.patches) 
        : version.patches;
      
      if (Array.isArray(patches)) {
        // Apply JSON patches using fast-json-patch style operations
        for (const patch of patches) {
          effectiveContent = applyPatch(effectiveContent, patch);
        }
      }
    }
  }

  return { effectiveContent, targetVersion };
}

/**
 * Apply a single JSON patch operation to a document
 */
function applyPatch(document: any, patch: any): any {
  const result = JSON.parse(JSON.stringify(document));
  const { op, path, value } = patch;
  
  if (!path) return result;
  
  const pathParts = path.split('/').filter((p: string) => p !== '');
  
  if (pathParts.length === 0) {
    if (op === 'replace' || op === 'add') {
      return value;
    }
    return result;
  }

  let current = result;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (current[key] === undefined) {
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = pathParts[pathParts.length - 1];

  switch (op) {
    case 'add':
    case 'replace':
      current[lastKey] = value;
      break;
    case 'remove':
      delete current[lastKey];
      break;
  }

  return result;
}

/**
 * Generate a diff between two objects
 */
function generateDiff(oldObj: any, newObj: any, path: string = ''): any[] {
  const diffs: any[] = [];
  
  const oldKeys = new Set(Object.keys(oldObj || {}));
  const newKeys = new Set(Object.keys(newObj || {}));
  
  // Check for removed keys
  for (const key of oldKeys) {
    const currentPath = path ? `${path}/${key}` : `/${key}`;
    if (!newKeys.has(key)) {
      diffs.push({ op: 'remove', path: currentPath, oldValue: oldObj[key] });
    }
  }
  
  // Check for added and changed keys
  for (const key of newKeys) {
    const currentPath = path ? `${path}/${key}` : `/${key}`;
    if (!oldKeys.has(key)) {
      diffs.push({ op: 'add', path: currentPath, value: newObj[key] });
    } else {
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      
      if (typeof oldVal === 'object' && oldVal !== null && 
          typeof newVal === 'object' && newVal !== null &&
          !Array.isArray(oldVal) && !Array.isArray(newVal)) {
        // Recurse into nested objects
        diffs.push(...generateDiff(oldVal, newVal, currentPath));
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({ op: 'replace', path: currentPath, oldValue: oldVal, value: newVal });
      }
    }
  }
  
  return diffs;
}

async function handleGetDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, versionId } = data;
  logger.debug('Getting document version', { documentId, versionId, userId: user.id });

  if (!documentId || !versionId) {
    throw new Error('documentId and versionId are required');
  }

  // Validate user has access to the document
  const access = await validateDocumentAccess(supabaseClient, documentId, user.id, logger);

  // Use service role client to bypass RLS
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { effectiveContent, targetVersion } = await calculateEffectiveDocumentAtVersion(
    serviceClient, 
    documentId, 
    versionId, 
    logger
  );

  logger.info('Successfully retrieved document at version', { 
    documentId, 
    versionId,
    versionString: `${targetVersion.version_major}.${targetVersion.version_minor}.${targetVersion.version_patch}`,
    userRole: access.role
  });

  return { 
    version: targetVersion,
    effectiveContent,
    versionString: `${targetVersion.version_major}.${targetVersion.version_minor}.${targetVersion.version_patch}`
  };
}

async function handleGetVersionDiff(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, fromVersionId, toVersionId } = data;
  logger.debug('Getting version diff', { documentId, fromVersionId, toVersionId, userId: user.id });

  if (!documentId || !fromVersionId || !toVersionId) {
    throw new Error('documentId, fromVersionId, and toVersionId are required');
  }

  if (fromVersionId === toVersionId) {
    throw new Error('fromVersionId and toVersionId must be different');
  }

  // Validate user has access to the document
  const access = await validateDocumentAccess(supabaseClient, documentId, user.id, logger);

  // Use service role client to bypass RLS
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Calculate effective content at both versions
  const [fromResult, toResult] = await Promise.all([
    calculateEffectiveDocumentAtVersion(serviceClient, documentId, fromVersionId, logger),
    calculateEffectiveDocumentAtVersion(serviceClient, documentId, toVersionId, logger)
  ]);

  // Generate diff between the two effective documents
  const diff = generateDiff(fromResult.effectiveContent, toResult.effectiveContent);

  logger.info('Successfully generated version diff', { 
    documentId, 
    fromVersionId,
    toVersionId,
    fromVersion: `${fromResult.targetVersion.version_major}.${fromResult.targetVersion.version_minor}.${fromResult.targetVersion.version_patch}`,
    toVersion: `${toResult.targetVersion.version_major}.${toResult.targetVersion.version_minor}.${toResult.targetVersion.version_patch}`,
    diffCount: diff.length,
    userRole: access.role
  });

  return { 
    fromVersion: fromResult.targetVersion,
    toVersion: toResult.targetVersion,
    fromVersionString: `${fromResult.targetVersion.version_major}.${fromResult.targetVersion.version_minor}.${fromResult.targetVersion.version_patch}`,
    toVersionString: `${toResult.targetVersion.version_major}.${toResult.targetVersion.version_minor}.${toResult.targetVersion.version_patch}`,
    fromContent: fromResult.effectiveContent,
    toContent: toResult.effectiveContent,
    diff
  };
}