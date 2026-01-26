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
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { documentId, styleTheme, pdfData, pageCount, title } = await req.json();

    console.log('Received markdown render request:', { documentId, styleTheme, pageCount, title });

    if (!documentId || !pdfData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: documentId and pdfData are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify document exists
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, name')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 PDF data to binary
    // PDF data comes as: data:application/pdf;base64,JVBERi0...
    const base64Data = pdfData.split(',')[1] || pdfData;
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Generate storage path
    const timestamp = Date.now();
    const themeSuffix = styleTheme || 'default';
    const storagePath = `${documentId}/${themeSuffix}-${timestamp}.pdf`;

    console.log('Uploading PDF to storage:', storagePath, 'Size:', binaryData.length);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('markdown-renders')
      .upload(storagePath, binaryData, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF: ' + uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store metadata in database
    const { error: dbError } = await supabase
      .from('markdown_renders')
      .insert({
        document_id: documentId,
        style_theme: styleTheme || 'default',
        storage_path: storagePath,
        page_count: pageCount || 1,
        created_by: user.id
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Non-fatal - PDF is still saved, just metadata failed
    }

    // Generate signed URL instead of public URL (bucket is now private)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('markdown-renders')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PDF uploaded successfully, signed URL generated');

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        storagePath,
        pageCount: pageCount || 1,
        expiresIn: SIGNED_URL_EXPIRY
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in markdown-render function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
