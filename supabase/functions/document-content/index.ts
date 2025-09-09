import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const documentId = url.searchParams.get('document_id');

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'document_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get document with Crowdin integration
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

    if (docError || !document) {
      console.error('Error fetching document:', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the latest selected version if available
    const { data: selectedVersion, error: versionError } = await supabaseClient
      .from('document_versions')
      .select('full_document')
      .eq('document_id', documentId)
      .eq('is_selected', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error('Warning: Could not fetch document version:', versionError);
    }

    // Determine effective content
    let effectiveContent = document.content;
    if (selectedVersion?.full_document) {
      effectiveContent = selectedVersion.full_document;
    }

    const result = {
      ...document,
      content: effectiveContent
    };

    return new Response(JSON.stringify({ document: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in document-content function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);