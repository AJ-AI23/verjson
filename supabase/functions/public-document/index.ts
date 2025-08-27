import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper function to format JSON schema/OpenAPI for Confluence display
function formatForConfluence(content: any): string {
  if (!content) return '';
  
  try {
    // If it's an OpenAPI spec, create a nice summary
    if (content.openapi || content.swagger) {
      const title = content.info?.title || 'API Documentation';
      const version = content.info?.version || '1.0.0';
      const description = content.info?.description || '';
      
      let formatted = `# ${title} (v${version})\n\n`;
      if (description) formatted += `${description}\n\n`;
      
      // Add paths summary
      if (content.paths) {
        formatted += '## Endpoints\n\n';
        Object.keys(content.paths).forEach(path => {
          const methods = Object.keys(content.paths[path]).filter(m => 
            ['get', 'post', 'put', 'delete', 'patch'].includes(m.toLowerCase())
          );
          formatted += `- **${path}**: ${methods.join(', ').toUpperCase()}\n`;
        });
      }
      
      return formatted;
    }
    
    // For JSON Schema, show structure
    if (content.$schema || content.type) {
      const title = content.title || 'Schema';
      let formatted = `# ${title}\n\n`;
      
      if (content.description) {
        formatted += `${content.description}\n\n`;
      }
      
      if (content.properties) {
        formatted += '## Properties\n\n';
        Object.entries(content.properties).forEach(([prop, schema]: [string, any]) => {
          formatted += `- **${prop}** (${schema.type || 'any'})`;
          if (schema.description) formatted += `: ${schema.description}`;
          formatted += '\n';
        });
      }
      
      return formatted;
    }
    
    // Fallback: pretty print JSON
    return '```json\n' + JSON.stringify(content, null, 2) + '\n```';
  } catch (error) {
    return '```json\n' + JSON.stringify(content, null, 2) + '\n```';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get('id');

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role to bypass RLS for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get query parameters for formatting options
    const format = url.searchParams.get('format') || 'json';
    const includeMetadata = url.searchParams.get('metadata') === 'true';
    
    // Fetch the document with additional metadata
    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        content, 
        name, 
        created_at, 
        updated_at,
        workspace_id,
        workspaces!inner(name)
      `)
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log access for analytics
    try {
      await supabase
        .from('document_access_logs')
        .insert([{
          document_id: documentId,
          access_type: 'plugin',
          user_agent: req.headers.get('user-agent') || 'Unknown',
          referrer: req.headers.get('referer') || null
        }]);
    } catch (logError) {
      console.warn('Failed to log access:', logError);
    }

    // Prepare response based on format
    let responseContent;
    let contentType = 'application/json';
    
    if (format === 'confluence') {
      // Format for Confluence plugin display
      const metadata = includeMetadata ? {
        name: document.name,
        workspace: document.workspaces?.name,
        created_at: document.created_at,
        updated_at: document.updated_at,
        document_id: documentId
      } : null;
      
      responseContent = {
        content: document.content,
        metadata,
        formatted_content: formatForConfluence(document.content)
      };
    } else {
      // Default JSON format
      responseContent = includeMetadata ? {
        content: document.content,
        name: document.name,
        workspace: document.workspaces?.name,
        created_at: document.created_at,
        updated_at: document.updated_at,
        document_id: documentId
      } : document.content;
    }

    return new Response(
      JSON.stringify(responseContent, null, 2),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${document.name || 'document'}.json"`
        } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});