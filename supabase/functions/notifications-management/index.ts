import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { EdgeFunctionLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateNotificationRequest {
  documentId: string;
  title: string;
  message: string;
  workspaceId?: string;
  type?: string;
}

interface MarkAsReadRequest {
  notificationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const logger = new EdgeFunctionLogger('notifications-management', 'handler');
  
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

    logger.info('Processing request', { action, userId: user.id });

    switch (action) {
      case 'getUserNotifications':
        logger.debug('Fetching notifications for user', { userId: user.id });
        
        logger.logDatabaseQuery('notifications', 'SELECT', { userId: user.id });
        const { data: notifications, error: fetchError } = await supabaseClient
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        logger.logDatabaseResult('notifications', 'SELECT', notifications?.length, fetchError);
        
        if (fetchError) {
          logger.error('Failed to fetch notifications', fetchError);
          return new Response(JSON.stringify({ error: fetchError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const unreadCount = notifications?.filter(n => !n.read_at).length || 0;

        logger.info('Successfully fetched notifications', { 
          notificationsCount: notifications?.length || 0, 
          unreadCount 
        });
        
        logger.logResponse(200, { notificationsCount: notifications?.length, unreadCount });
        return new Response(JSON.stringify({ 
          notifications: notifications || [], 
          unreadCount 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'markNotificationAsRead':
        if (!requestBody.notificationId) {
          logger.error('Missing required field: notificationId');
          return new Response(JSON.stringify({ error: 'Notification ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const updateTimestamp = new Date().toISOString();
        
        logger.logDatabaseQuery('notifications', 'UPDATE mark as read', { 
          notificationId: requestBody.notificationId, 
          userId: user.id 
        });
        const { data: updatedNotification, error: markReadError } = await supabaseClient
          .from('notifications')
          .update({ read_at: updateTimestamp })
          .eq('id', requestBody.notificationId)
          .eq('user_id', user.id)
          .select()
          .single();

        logger.logDatabaseResult('notifications', 'UPDATE mark as read', updatedNotification ? 1 : 0, markReadError);
        
        if (markReadError) {
          logger.error('Failed to mark notification as read', markReadError);
          return new Response(JSON.stringify({ error: markReadError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Notification marked as read successfully', { 
          notificationId: requestBody.notificationId 
        });
        logger.logResponse(200, updatedNotification);
        return new Response(JSON.stringify({ 
          notification: updatedNotification,
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'markAllNotificationsAsRead':
        const currentTime = new Date().toISOString();
        
        logger.logDatabaseQuery('notifications', 'UPDATE mark all as read', { userId: user.id });
        const { data: allUpdatedNotifications, error: markAllReadError } = await supabaseClient
          .from('notifications')
          .update({ read_at: currentTime })
          .eq('user_id', user.id)
          .is('read_at', null)
          .select();

        logger.logDatabaseResult('notifications', 'UPDATE mark all as read', allUpdatedNotifications?.length, markAllReadError);
        
        if (markAllReadError) {
          logger.error('Failed to mark all notifications as read', markAllReadError);
          return new Response(JSON.stringify({ error: markAllReadError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('All notifications marked as read successfully', { 
          updatedCount: allUpdatedNotifications?.length || 0 
        });
        logger.logResponse(200, { updatedCount: allUpdatedNotifications?.length });
        return new Response(JSON.stringify({ 
          updatedNotifications: allUpdatedNotifications || [],
          updatedCount: allUpdatedNotifications?.length || 0,
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'createNotification':
        if (!requestBody.documentId || !requestBody.title || !requestBody.message) {
          logger.error('Missing required fields for notification creation', {
            hasDocumentId: !!requestBody.documentId,
            hasTitle: !!requestBody.title,
            hasMessage: !!requestBody.message
          });
          return new Response(JSON.stringify({ 
            error: 'Document ID, title, and message are required' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        logger.debug('Creating notification', {
          documentId: requestBody.documentId,
          title: requestBody.title,
          hasWorkspaceId: !!requestBody.workspaceId,
          type: requestBody.type || 'notation'
        });
        
        logger.logDatabaseQuery('notifications', 'INSERT', { 
          userId: user.id,
          documentId: requestBody.documentId,
          type: requestBody.type || 'notation'
        });
        const { data: newNotification, error: createError } = await supabaseClient
          .from('notifications')
          .insert({
            user_id: user.id,
            document_id: requestBody.documentId,
            workspace_id: requestBody.workspaceId,
            type: requestBody.type || 'notation',
            title: requestBody.title,
            message: requestBody.message
          })
          .select()
          .single();

        logger.logDatabaseResult('notifications', 'INSERT', newNotification ? 1 : 0, createError);
        
        if (createError) {
          logger.error('Failed to create notification', createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        logger.info('Notification created successfully', { 
          notificationId: newNotification.id,
          type: newNotification.type 
        });
        logger.logResponse(200, newNotification);
        return new Response(JSON.stringify({ 
          notification: newNotification,
          success: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        logger.warn('Invalid action', { action });
        return new Response(JSON.stringify({ 
          error: 'Invalid action. Supported actions: getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, createNotification' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    logger.error('Unhandled error in notifications-management function', error);
    logger.logResponse(500);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);