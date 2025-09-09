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
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function handleListDocumentVersions(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Listing document versions', { documentId, userId: user.id });

  const { data: versions, error } = await supabaseClient
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to list document versions', error);
    throw error;
  }

  logger.info('Successfully retrieved document versions', { 
    documentId, 
    versionCount: versions?.length || 0 
  });
  
  return { versions };
}

async function handleCreateDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, patch } = data;
  logger.debug('Creating document version', { documentId, description: patch.description });

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
    description: patch.description
  });
  
  return { version };
}

async function handleCreateInitialDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { documentId, content } = data;
  logger.debug('Creating initial document version', { documentId, userId: user.id });

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
    versionId: versionData.id 
  });
  
  return { version: versionData };
}

async function handleUpdateDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { versionId, updates } = data;
  logger.debug('Updating document version', { versionId, userId: user.id });

  const { data: version, error } = await supabaseClient
    .from('document_versions')
    .update(updates)
    .eq('id', versionId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update document version', error);
    throw error;
  }

  logger.info('Successfully updated document version', { 
    versionId, 
    updatedFields: Object.keys(updates)
  });
  
  return { version };
}

async function handleDeleteDocumentVersion(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { versionId } = data;
  logger.debug('Deleting document version', { versionId, userId: user.id });

  const { error } = await supabaseClient
    .from('document_versions')
    .delete()
    .eq('id', versionId)
    .eq('user_id', user.id);

  if (error) {
    logger.error('Failed to delete document version', error);
    throw error;
  }

  logger.info('Successfully deleted document version', { versionId });
  
  return { success: true, message: 'Version deleted successfully' };
}