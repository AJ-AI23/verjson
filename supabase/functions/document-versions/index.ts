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

  const logger = new EdgeFunctionLogger('document-versions', 'handler');
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
    const errorMessage = error.message || 'Internal server error';
    
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
      .select('created_by, workspace_id, user_id')
      .eq('id', documentId)
      .maybeSingle();

    logger.debug('🏠 Documents table query result', { 
      document, 
      error: docError?.message,
      errorCode: docError?.code,
      hasDocument: !!document,
      isOwnerViaCreatedBy: document ? document.created_by === userId : false,
      isOwnerViaUserId: document ? document.user_id === userId : false
    });

    if (docError) {
      logger.debug('⚠️ Error accessing documents table (might be due to RLS)', { error: docError });
    } else if (document) {
      // Check both created_by and user_id fields for ownership
      if (document.created_by === userId || document.user_id === userId) {
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
    if (error.message === 'Document not found' || error.message === 'Access denied - insufficient permissions') {
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

  // Use service role client to bypass RLS for version creation since 
  // document_versions table RLS policy doesn't properly handle document_permissions
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

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