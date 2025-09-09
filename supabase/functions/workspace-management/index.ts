import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

interface UpdateWorkspaceRequest {
  id: string;
  name?: string;
  description?: string;
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
    const path = url.pathname.split('/').pop();

    switch (method) {
      case 'GET':
        if (path === 'list') {
          // Get user's own workspaces
          const { data: ownWorkspaces, error: ownError } = await supabaseClient
            .from('workspaces')
            .select('*, collaboratorCount:workspace_permissions(count)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (ownError) {
            console.error('Error fetching own workspaces:', ownError);
            return new Response(JSON.stringify({ error: ownError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Get workspaces user has been invited to
          const { data: invitedWorkspaces, error: invitedError } = await supabaseClient
            .from('workspace_permissions')
            .select(`
              role,
              status,
              workspace:workspaces(
                id,
                name,
                description,
                created_at,
                updated_at,
                user_id,
                collaboratorCount:workspace_permissions(count)
              )
            `)
            .eq('user_id', user.id)
            .eq('status', 'accepted')
            .neq('role', 'owner');

          if (invitedError) {
            console.error('Error fetching invited workspaces:', invitedError);
            return new Response(JSON.stringify({ error: invitedError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Combine and format workspaces
          const formattedOwnWorkspaces = (ownWorkspaces || []).map(ws => ({
            ...ws,
            isOwner: true,
            role: 'owner',
            collaboratorCount: ws.collaboratorCount?.[0]?.count || 0
          }));

          const formattedInvitedWorkspaces = (invitedWorkspaces || [])
            .filter(item => item.workspace)
            .map(item => ({
              ...item.workspace,
              isOwner: false,
              role: item.role,
              collaboratorCount: item.workspace.collaboratorCount?.[0]?.count || 0
            }));

          const allWorkspaces = [...formattedOwnWorkspaces, ...formattedInvitedWorkspaces]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          return new Response(JSON.stringify({ workspaces: allWorkspaces }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'POST':
        const createData: CreateWorkspaceRequest = await req.json();
        
        const { data: workspace, error: createError } = await supabaseClient
          .from('workspaces')
          .insert({
            name: createData.name,
            description: createData.description,
            user_id: user.id,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating workspace:', createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ workspace }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'PUT':
        const updateData: UpdateWorkspaceRequest = await req.json();
        
        const { data: updatedWorkspace, error: updateError } = await supabaseClient
          .from('workspaces')
          .update({
            name: updateData.name,
            description: updateData.description,
          })
          .eq('id', updateData.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating workspace:', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ workspace: updatedWorkspace }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'DELETE':
        const deleteData = await req.json();
        
        const { error: deleteError } = await supabaseClient
          .from('workspaces')
          .delete()
          .eq('id', deleteData.id)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting workspace:', deleteError);
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

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in workspace-management function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);