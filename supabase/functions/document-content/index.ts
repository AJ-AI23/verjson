import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { EdgeFunctionLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  const logger = new EdgeFunctionLogger('document-content', 'handler');
  
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

    const documentId = requestBody.document_id;

    logger.debug('Processing document content request', { action, documentId, userId: user.id });

    if (action !== 'get') {
      logger.warn('Invalid action for document-content', { action });
      return new Response(JSON.stringify({ error: 'Invalid action. Only "get" is supported' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!documentId) {
      logger.warn('Missing document_id parameter');
      return new Response(JSON.stringify({ error: 'document_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get document with Crowdin integration
    logger.logDatabaseQuery('documents', 'SELECT with crowdin integration', { documentId });
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select(`
        id,
        name,
        content,
        file_type,
        workspace_id,
        user_id,
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
      .eq('id', documentId)
      .single();

    logger.logDatabaseResult('documents', 'SELECT with crowdin integration', document ? 1 : 0, docError);
    
    if (docError || !document) {
      logger.error('Document not found or access denied', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the latest selected version if available
    logger.logDatabaseQuery('document_versions', 'SELECT selected version', { documentId });
    const { data: selectedVersion, error: versionError } = await supabaseClient
      .from('document_versions')
      .select('full_document')
      .eq('document_id', documentId)
      .eq('is_selected', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    logger.logDatabaseResult('document_versions', 'SELECT selected version', selectedVersion ? 1 : 0, versionError);
    
    if (versionError) {
      logger.warn('Could not fetch document version', versionError);
    }

    // Determine effective content
    let effectiveContent = document.content;
    if (selectedVersion?.full_document) {
      effectiveContent = selectedVersion.full_document;
      logger.debug('Using selected version content');
    } else {
      logger.debug('Using base document content');
    }

    const result = {
      ...document,
      content: effectiveContent
    };

    logger.info('Successfully fetched document content', { 
      documentId, 
      hasVersionContent: !!selectedVersion?.full_document,
      hasCrowdinIntegration: !!document.crowdin_integration_id 
    });
    
    logger.logResponse(200, result);
    return new Response(JSON.stringify({ document: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Unhandled error in document-content function', error);
    logger.logResponse(500);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);