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
  logger.debug('Validating document access', { documentId, userId });

  // Check if user owns the document
  const { data: document, error: docError } = await supabaseClient
    .from('documents')
    .select('user_id, workspace_id')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    logger.error('Document not found', { documentId, error: docError });
    throw new Error('Document not found');
  }

  // If user owns the document, they have owner permissions
  if (document.user_id === userId) {
    logger.debug('User is document owner', { documentId, userId });
    return { role: 'owner', hasAccess: true };
  }

  // Check workspace permissions
  const { data: workspacePermissions, error: wpError } = await supabaseClient
    .from('workspace_permissions')
    .select('role, status')
    .eq('workspace_id', document.workspace_id)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .single();

  if (wpError || !workspacePermissions) {
    // Check document permissions as fallback
    const { data: docPermissions, error: dpError } = await supabaseClient
      .from('document_permissions')
      .select('role, status')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .single();

    if (dpError || !docPermissions) {
      logger.warn('User has no access to document', { documentId, userId });
      throw new Error('Access denied - insufficient permissions');
    }

    logger.debug('User has document permissions', { documentId, userId, role: docPermissions.role });
    return { role: docPermissions.role, hasAccess: true };
  }

  logger.debug('User has workspace permissions', { documentId, userId, role: workspacePermissions.role });
  return { role: workspacePermissions.role, hasAccess: true };
}

async function handleListDocumentVersions(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Listing document versions', { documentId, userId: user.id });

  // Validate user has access to the document
  const access = await validateDocumentAccess(supabaseClient, documentId, user.id, logger);
  
  // All roles (owner, editor, viewer) can view version history
  const { data: versions, error } = await supabaseClient
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

  const { data: version, error } = await supabaseClient
    .from('document_versions')
    .insert(versionData)
    .select()
    .single();

  if (error) {
    // Handle duplicate initial version gracefully
    if (error.message.includes('duplicate key') && patch.description === 'Initial version') {
      logger.debug('Initial version already exists, fetching existing version');
      
      const { data: existingVersion, error: fetchError } = await supabaseClient
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

  // First, get the version to check document access and version ownership
  const { data: version, error: versionError } = await supabaseClient
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

  const { data: updatedVersion, error } = await supabaseClient
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

  // First, get the version to check document access
  const { data: version, error: versionError } = await supabaseClient
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

  const { error } = await supabaseClient
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