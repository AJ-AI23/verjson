import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Signed URL expiry time in seconds (1 hour)
const SIGNED_URL_EXPIRY = 3600;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { documentId, styleTheme, width, height, imageData, format = 'png' } = await req.json();

    if (!documentId || !styleTheme || !imageData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify document exists and user has access
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, is_public')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert data URL to binary data
    let binaryData: Uint8Array;
    
    if (format === 'svg') {
      // SVG uses charset=utf-8 encoding, not base64
      // Format: data:image/svg+xml;charset=utf-8,<svg>...</svg>
      const svgContent = decodeURIComponent(imageData.split(',')[1]);
      binaryData = new TextEncoder().encode(svgContent);
    } else {
      // PNG uses base64 encoding
      // Format: data:image/png;base64,iVBORw0KGgo...
      const base64Data = imageData.split(',')[1];
      binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    }

    // Generate storage path with correct extension
    const extension = format === 'svg' ? 'svg' : 'png';
    const storagePath = `${documentId}/${styleTheme}.${extension}`;

    // Determine content type
    const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';

    // Upload to storage (upsert - replace if exists)
    const { error: uploadError } = await supabase.storage
      .from('diagram-renders')
      .upload(storagePath, binaryData, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store metadata in database (upsert)
    const { error: dbError } = await supabase
      .from('diagram_renders')
      .upsert({
        document_id: documentId,
        style_theme: styleTheme,
        width,
        height,
        storage_path: storagePath,
        created_by: user.id
      }, {
        onConflict: 'document_id,style_theme'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL instead of public URL (bucket is now private)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('diagram-renders')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        storagePath,
        expiresIn: SIGNED_URL_EXPIRY
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in diagram-render function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
