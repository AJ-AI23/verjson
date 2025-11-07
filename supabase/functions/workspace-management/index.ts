import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { EdgeFunctionLogger, checkDemoSessionExpiration } from '../_shared/logger.ts';

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

    // Check if demo session has expired
    const isExpired = await checkDemoSessionExpiration(supabaseClient, user.id);
    if (isExpired) {
      logger.warn('Demo session expired, denying access');
      return new Response(JSON.stringify({ error: 'Demo session expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    
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

    logger.info('Processing request', { action, userId: user.id });

    switch (action) {
      case 'listUserWorkspaces':
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
              collaboratorCount: (item.workspace as any).collaboratorCount?.[0]?.count || 0
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
        
        break;

      case 'createWorkspace':
        logger.debug('Creating new workspace');
        if (!requestBody.name) {
          logger.error('Missing required field: name');
          return new Response(JSON.stringify({ error: 'Name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.debug('Parsed request data', { name: requestBody.name, hasDescription: !!requestBody.description });
        
        logger.logDatabaseQuery('workspaces', 'INSERT', { name: requestBody.name, userId: user.id });
        const { data: workspace, error: createError } = await supabaseClient
          .from('workspaces')
          .insert({
            name: requestBody.name,
            description: requestBody.description,
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
        
        break;

      case 'updateWorkspace':
        if (!requestBody.id) {
          logger.error('Missing required field: id');
          return new Response(JSON.stringify({ error: 'ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.logDatabaseQuery('workspaces', 'UPDATE', { id: requestBody.id, userId: user.id });
        const { data: updatedWorkspace, error: updateError } = await supabaseClient
          .from('workspaces')
          .update({
            name: requestBody.name,
            description: requestBody.description,
          })
          .eq('id', requestBody.id)
          .eq('user_id', user.id)
          .select()
          .single();

        logger.logDatabaseResult('workspaces', 'UPDATE', updatedWorkspace ? 1 : 0, updateError);
        
        if (updateError) {
          logger.error('Failed to update workspace', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Workspace updated successfully', { workspaceId: updatedWorkspace.id });
        logger.logResponse(200, updatedWorkspace);
        return new Response(JSON.stringify({ workspace: updatedWorkspace }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
        break;

      case 'deleteWorkspace':
        if (!requestBody.id) {
          logger.error('Missing required field: id');
          return new Response(JSON.stringify({ error: 'ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Get workspace info and members before deletion
        logger.logDatabaseQuery('workspaces', 'SELECT workspace info', { id: requestBody.id });
        const { data: workspaceInfo, error: workspaceError } = await supabaseClient
          .from('workspaces')
          .select('name')
          .eq('id', requestBody.id)
          .eq('user_id', user.id)
          .single();

        if (workspaceError || !workspaceInfo) {
          logger.error('Workspace not found or not owned by user', workspaceError);
          return new Response(JSON.stringify({ error: 'Workspace not found or not authorized' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get all workspace members to notify them
        logger.logDatabaseQuery('workspace_permissions', 'SELECT members', { workspaceId: requestBody.id });
        const { data: members, error: membersError } = await supabaseClient
          .from('workspace_permissions')
          .select('user_id')
          .eq('workspace_id', requestBody.id)
          .eq('status', 'accepted');

        logger.logDatabaseResult('workspace_permissions', 'SELECT members', members?.length, membersError);
        
        logger.logDatabaseQuery('workspaces', 'DELETE', { id: requestBody.id, userId: user.id });
        const { error: deleteError } = await supabaseClient
          .from('workspaces')
          .delete()
          .eq('id', requestBody.id)
          .eq('user_id', user.id);

        logger.logDatabaseResult('workspaces', 'DELETE', deleteError ? 0 : 1, deleteError);
        
        if (deleteError) {
          logger.error('Failed to delete workspace', deleteError);
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Send notifications to all workspace members about deletion
        if (members && members.length > 0) {
          const notificationTitle = `Workspace "${workspaceInfo.name}" was deleted`;
          const notificationMessage = `The workspace "${workspaceInfo.name}" has been deleted by its owner.`;

          for (const member of members) {
            if (member.user_id !== user.id) { // Don't notify the owner who deleted it
              try {
                logger.logDatabaseQuery('notifications', 'INSERT deletion notification', { userId: member.user_id });
                await supabaseClient
                  .from('notifications')
                  .insert({
                    user_id: member.user_id,
                    workspace_id: requestBody.id,
                    type: 'workspace_deleted',
                    title: notificationTitle,
                    message: notificationMessage
                  });
                logger.info('Sent workspace deletion notification', { 
                  workspaceId: requestBody.id, 
                  userId: member.user_id 
                });
              } catch (notificationError) {
                logger.warn('Failed to send deletion notification to user', { 
                  userId: member.user_id, 
                  error: notificationError 
                });
              }
            }
          }
        }

        logger.info('Workspace deleted successfully', { workspaceId: requestBody.id });
        logger.logResponse(200);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        logger.warn('Invalid action', { action });
        return new Response(JSON.stringify({ error: 'Invalid action. Supported actions: listUserWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
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