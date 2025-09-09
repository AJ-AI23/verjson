import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDocumentRequest {
  workspace_id: string;
  name: string;
  content: any;
  file_type: 'json-schema' | 'openapi';
}

interface UpdateDocumentRequest {
  id: string;
  name?: string;
  content?: any;
  file_type?: 'json-schema' | 'openapi';
}

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
    const method = req.method;

    switch (method) {
      case 'GET':
        const workspaceId = url.searchParams.get('workspace_id');
        
        if (!workspaceId) {
          return new Response(JSON.stringify({ error: 'workspace_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get documents for the workspace with proper joins
        const { data: documents, error: fetchError } = await supabaseClient
          .from('documents')
          .select(`
            id,
            name,
            workspace_id,
            user_id,
            file_type,
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
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching documents:', fetchError);
          return new Response(JSON.stringify({ error: fetchError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ documents: documents || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'POST':
        let createData: CreateDocumentRequest;
        try {
          createData = await req.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Create document
        const { data: document, error: createError } = await supabaseClient
          .from('documents')
          .insert({
            workspace_id: createData.workspace_id,
            name: createData.name,
            content: createData.content,
            file_type: createData.file_type,
            user_id: user.id,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating document:', createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create initial version using the database function
        const { data: versionData, error: versionError } = await supabaseClient
          .rpc('create_initial_version_safe', {
            p_document_id: document.id,
            p_user_id: user.id,
            p_content: createData.content
          });

        if (versionError) {
          console.error('Warning: Could not create initial version:', versionError);
          // Don't fail the document creation, just log the warning
        }

        return new Response(JSON.stringify({ document }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'PUT':
        let updateData: UpdateDocumentRequest;
        try {
          updateData = await req.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { data: updatedDocument, error: updateError } = await supabaseClient
          .from('documents')
          .update({
            name: updateData.name,
            content: updateData.content,
            file_type: updateData.file_type,
          })
          .eq('id', updateData.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating document:', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ document: updatedDocument }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'DELETE':
        let deleteData;
        try {
          deleteData = await req.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { error: deleteError } = await supabaseClient
          .from('documents')
          .delete()
          .eq('id', deleteData.id)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting document:', deleteError);
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Error in document-management function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);