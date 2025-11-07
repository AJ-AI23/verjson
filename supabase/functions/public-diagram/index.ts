import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get('id');
    const theme = url.searchParams.get('theme') || 'light';

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, name, content, file_type, is_public')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if document is public
    if (!document.is_public) {
      return new Response(
        JSON.stringify({ error: 'Document is not public' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if it's a diagram
    if (document.file_type !== 'diagram') {
      return new Response(
        JSON.stringify({ error: 'Document is not a diagram' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PNG format is requested
    const format = url.searchParams.get('format');
    const styleTheme = url.searchParams.get('style_theme') || 'light';

    if (format === 'png') {
      // Fetch rendered PNG from storage
      const { data: renderData, error: renderError } = await supabase
        .from('diagram_renders')
        .select('storage_path')
        .eq('document_id', documentId)
        .eq('style_theme', styleTheme)
        .single();

      if (renderError || !renderData) {
        return new Response(
          JSON.stringify({ error: 'PNG render not found. Please render the diagram first.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the image from storage
      const { data: imageData, error: imageError } = await supabase.storage
        .from('diagram-renders')
        .download(renderData.storage_path);

      if (imageError || !imageData) {
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve image' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the access
      await supabase
        .from('document_access_logs')
        .insert({
          document_id: documentId,
          access_type: 'public_png_view',
          user_agent: req.headers.get('user-agent'),
          referrer: req.headers.get('referer')
        });

      return new Response(imageData, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Apply theme if specified for JSON response
    let content = document.content;
    if (content.styles && theme) {
      content = {
        ...content,
        styles: {
          ...content.styles,
          activeTheme: theme
        }
      };
    }

    // Log the access
    await supabase
      .from('document_access_logs')
      .insert({
        document_id: documentId,
        access_type: 'public_view',
        user_agent: req.headers.get('user-agent'),
        referrer: req.headers.get('referer')
      });

    return new Response(
      JSON.stringify({
        id: document.id,
        name: document.name,
        content,
        type: 'diagram'
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        } 
      }
    );

  } catch (error) {
    console.error('Error in public-diagram function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
