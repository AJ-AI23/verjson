import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { EdgeFunctionLogger } from '../_shared/logger.ts';

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
  const logger = new EdgeFunctionLogger('workspace-management', 'handler');
  
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

    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname.split('/').pop();

    logger.info('Processing request', { method, path, userId: user.id });

    switch (method) {
      case 'GET':
        if (path === 'list' || !path) {
          logger.debug('Fetching workspaces for user', { userId: user.id });
          
          // Get user's own workspaces
          logger.logDatabaseQuery('workspaces', 'SELECT own workspaces', { userId: user.id });
          const { data: ownWorkspaces, error: ownError } = await supabaseClient
            .from('workspaces')
            .select('*, collaboratorCount:workspace_permissions(count)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          logger.logDatabaseResult('workspaces', 'SELECT own workspaces', ownWorkspaces?.length, ownError);
          
          if (ownError) {
            logger.error('Failed to fetch own workspaces', ownError);
            return new Response(JSON.stringify({ error: ownError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Get workspaces user has been invited to
          logger.logDatabaseQuery('workspace_permissions', 'SELECT invited workspaces', { userId: user.id });
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

          logger.logDatabaseResult('workspace_permissions', 'SELECT invited workspaces', invitedWorkspaces?.length, invitedError);
          
          if (invitedError) {
            logger.error('Failed to fetch invited workspaces', invitedError);
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

          logger.info('Successfully fetched workspaces', { 
            ownCount: formattedOwnWorkspaces.length, 
            invitedCount: formattedInvitedWorkspaces.length,
            totalCount: allWorkspaces.length 
          });
          
          logger.logResponse(200, { workspacesCount: allWorkspaces.length });
          return new Response(JSON.stringify({ workspaces: allWorkspaces }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'POST':
        logger.debug('Creating new workspace');
        let createData: CreateWorkspaceRequest;
        try {
          createData = await req.json();
          logger.debug('Parsed request data', { name: createData.name, hasDescription: !!createData.description });
        } catch (e) {
          logger.error('Invalid JSON in request body', e);
          return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.logDatabaseQuery('workspaces', 'INSERT', { name: createData.name, userId: user.id });
        const { data: workspace, error: createError } = await supabaseClient
          .from('workspaces')
          .insert({
            name: createData.name,
            description: createData.description,
            user_id: user.id,
          })
          .select()
          .single();

        logger.logDatabaseResult('workspaces', 'INSERT', 1, createError);
        
        if (createError) {
          logger.error('Failed to create workspace', createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Workspace created successfully', { workspaceId: workspace.id, name: workspace.name });
        logger.logResponse(200, workspace);
        return new Response(JSON.stringify({ workspace }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'PUT':
        let updateData: UpdateWorkspaceRequest;
        try {
          updateData = await req.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
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
    logger.error('Unhandled error in workspace-management function', error);
    logger.logResponse(500);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);