import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger } from '../_shared/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new EdgeFunctionLogger('permissions-management', 'handler');
  logger.logRequest(req.method, req.url);

  try {
    logger.debug('Authenticating user');
    
    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication failed', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    logger.logAuth(user);

    const { action, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action, hasData: !!requestData });

    let result;

    switch (action) {
      case 'getDocumentPermissions':
        result = await handleGetDocumentPermissions(supabaseClient, requestData, logger);
        break;
      case 'getWorkspacePermissions':
        result = await handleGetWorkspacePermissions(supabaseClient, requestData, logger);
        break;
      case 'updateDocumentPermission':
        result = await handleUpdateDocumentPermission(supabaseClient, requestData, logger);
        break;
      case 'updateWorkspacePermission':
        result = await handleUpdateWorkspacePermission(supabaseClient, requestData, logger);
        break;
      case 'removeDocumentPermission':
        result = await handleRemoveDocumentPermission(supabaseClient, requestData, user, logger);
        break;
      case 'removeWorkspacePermission':
        result = await handleRemoveWorkspacePermission(supabaseClient, requestData, user, logger);
        break;
      case 'getWorkspaceForPermission':
        result = await handleGetWorkspaceForPermission(supabaseClient, requestData, logger);
        break;
      default:
        logger.warn('Unknown action requested', { action });
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: corsHeaders }
        )
    }

    logger.logResponse(200, result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    logger.logError('Request processing failed', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function handleGetDocumentPermissions(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Getting document permissions', { documentId });

  const { data: permissions, error } = await supabaseClient
    .rpc('get_document_permissions', { doc_id: documentId });

  if (error) {
    logger.error('Failed to get document permissions', error);
    throw error;
  }

  logger.info('Successfully retrieved document permissions', { 
    documentId, 
    permissionCount: permissions?.length || 0 
  });
  
  return { permissions };
}

async function handleGetWorkspacePermissions(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { workspaceId } = data;
  logger.debug('Getting workspace permissions', { workspaceId });

  const { data: permissions, error } = await supabaseClient
    .rpc('get_workspace_permissions', { ws_id: workspaceId });

  if (error) {
    logger.error('Failed to get workspace permissions', error);
    throw error;
  }

  logger.info('Successfully retrieved workspace permissions', { 
    workspaceId, 
    permissionCount: permissions?.length || 0 
  });
  
  return { permissions };
}

async function handleUpdateDocumentPermission(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { permissionId, role } = data;
  logger.debug('Updating document permission', { permissionId, role });

  const { error } = await supabaseClient
    .from('document_permissions')
    .update({ role })
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to update document permission', error);
    throw error;
  }

  logger.info('Successfully updated document permission', { permissionId, role });
  return { success: true, message: 'Permission updated successfully' };
}

async function handleUpdateWorkspacePermission(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { permissionId, role } = data;
  logger.debug('Updating workspace permission', { permissionId, role });

  const { error } = await supabaseClient
    .from('workspace_permissions')
    .update({ role })
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to update workspace permission', error);
    throw error;
  }

  logger.info('Successfully updated workspace permission', { permissionId, role });
  return { success: true, message: 'Permission updated successfully' };
}

async function handleRemoveDocumentPermission(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { permissionId, userEmail, userName, resourceName, emailNotificationsEnabled } = data;
  logger.debug('Removing document permission', { permissionId });

  // Get permission details before removing it
  const { data: permissionData, error: getPermError } = await supabaseClient
    .from('document_permissions')
    .select('user_id, document_id, email_notifications_enabled')
    .eq('id', permissionId)
    .single();

  if (getPermError || !permissionData) {
    logger.error('Failed to get permission details', getPermError);
    throw new Error('Permission not found');
  }

  // Remove the permission
  const { error } = await supabaseClient
    .from('document_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to remove document permission', error);
    throw error;
  }

  // Create notification for the affected user
  try {
    const notificationData = {
      user_id: permissionData.user_id,
      document_id: permissionData.document_id,
      type: 'document_access_revoked',
      title: `Access removed from "${resourceName || 'Document'}"`,
      message: `Your access to the document "${resourceName || 'Unknown Document'}" has been removed.`,
    };

    const { error: notifyError } = await supabaseClient
      .from('notifications')
      .insert([notificationData]);

    if (notifyError) {
      logger.warn('Failed to create access revocation notification', notifyError);
    } else {
      logger.info('Access revocation notification created', { userId: permissionData.user_id });
    }
  } catch (notificationError) {
    logger.warn('Error creating access revocation notification', notificationError);
  }

  // Send email notification if email notifications are enabled for this permission
  const shouldSendEmail = emailNotificationsEnabled ?? permissionData.email_notifications_enabled;
  logger.debug('Email notification check', { 
    hasUserEmail: !!userEmail, 
    emailNotificationsEnabled,
    permissionEmailNotifications: permissionData.email_notifications_enabled,
    shouldSendEmail
  });

  if (userEmail && shouldSendEmail) {
    try {
      // Get Resend API key
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        logger.warn('RESEND_API_KEY not configured - skipping email notification');
        return { success: true, message: 'Permission removed successfully' };
      }

      // Send email notification directly using fetch
      const emailContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #dc2626; font-size: 28px; margin-bottom: 10px;">Access Revoked</h1>
            <p style="color: #666; font-size: 18px; margin: 0;">Your access has been removed</p>
          </div>
          
          <div style="background-color: #fef2f2; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #dc2626;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">Document: ${resourceName || 'Unknown Document'}</h2>
            <p style="color: #666; font-size: 16px; margin: 0;">Access revoked by: <strong>${user.email}</strong></p>
          </div>
        
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            You no longer have access to this document. If you believe this is an error, please contact the document owner.
          </p>
        
          <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">This notification was sent by ${user.email}</p>
          </div>
        </div>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: "Lovable <onboarding@resend.dev>",
          to: [userEmail],
          subject: `Access Revoked: ${resourceName || 'Document'}`,
          html: emailContent,
        }),
      });

      if (emailResponse.ok) {
        logger.info('Revocation email sent successfully', { userEmail });
      } else {
        const errorText = await emailResponse.text();
        logger.warn('Failed to send revocation email', { userEmail, error: errorText });
      }
    } catch (emailError) {
      logger.warn('Error sending revocation email notification', emailError);
      // Continue despite email failure
    }
  } else {
    logger.debug('Skipping email notification', { 
      hasUserEmail: !!userEmail, 
      emailNotificationsEnabled: shouldSendEmail 
    });
  }

  logger.info('Successfully removed document permission', { permissionId });
  return { success: true, message: 'Permission removed successfully' };
}

async function handleRemoveWorkspacePermission(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { permissionId, userEmail, userName, resourceName, emailNotificationsEnabled } = data;
  logger.debug('Removing workspace permission', { permissionId });

  // Get permission details before removing it
  const { data: permissionData, error: getPermError } = await supabaseClient
    .from('workspace_permissions')
    .select('user_id, workspace_id, email_notifications_enabled')
    .eq('id', permissionId)
    .single();

  if (getPermError || !permissionData) {
    logger.error('Failed to get permission details', getPermError);
    throw new Error('Permission not found');
  }

  // Remove the permission
  const { error } = await supabaseClient
    .from('workspace_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to remove workspace permission', error);
    throw error;
  }

  // Create notification for the affected user
  try {
    const notificationData = {
      user_id: permissionData.user_id,
      workspace_id: permissionData.workspace_id,
      type: 'workspace_access_revoked',
      title: `Access removed from "${resourceName || 'Workspace'}"`,
      message: `Your access to the workspace "${resourceName || 'Unknown Workspace'}" has been removed.`,
    };

    const { error: notifyError } = await supabaseClient
      .from('notifications')
      .insert([notificationData]);

    if (notifyError) {
      logger.warn('Failed to create access revocation notification', notifyError);
    } else {
      logger.info('Access revocation notification created', { userId: permissionData.user_id });
    }
  } catch (notificationError) {
    logger.warn('Error creating access revocation notification', notificationError);
  }

  // Send email notification if email notifications are enabled for this permission
  const shouldSendEmail = emailNotificationsEnabled ?? permissionData.email_notifications_enabled;
  logger.debug('Email notification check', { 
    hasUserEmail: !!userEmail, 
    emailNotificationsEnabled,
    permissionEmailNotifications: permissionData.email_notifications_enabled,
    shouldSendEmail
  });

  if (userEmail && shouldSendEmail) {
    try {
      // Get Resend API key
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        logger.warn('RESEND_API_KEY not configured - skipping email notification');
        return { success: true, message: 'Permission removed successfully' };
      }

      // Send email notification directly using fetch
      const emailContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #dc2626; font-size: 28px; margin-bottom: 10px;">Access Revoked</h1>
            <p style="color: #666; font-size: 18px; margin: 0;">Your access has been removed</p>
          </div>
          
          <div style="background-color: #fef2f2; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #dc2626;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">Workspace: ${resourceName || 'Unknown Workspace'}</h2>
            <p style="color: #666; font-size: 16px; margin: 0;">Access revoked by: <strong>${user.email}</strong></p>
          </div>
        
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            You no longer have access to this workspace. If you believe this is an error, please contact the workspace owner.
          </p>
        
          <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">This notification was sent by ${user.email}</p>
          </div>
        </div>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: "Lovable <onboarding@resend.dev>",
          to: [userEmail],
          subject: `Access Revoked: ${resourceName || 'Workspace'}`,
          html: emailContent,
        }),
      });

      if (emailResponse.ok) {
        logger.info('Revocation email sent successfully', { userEmail });
      } else {
        const errorText = await emailResponse.text();
        logger.warn('Failed to send revocation email', { userEmail, error: errorText });
      }
    } catch (emailError) {
      logger.warn('Error sending revocation email notification', emailError);
      // Continue despite email failure
    }
  } else {
    logger.debug('Skipping email notification', { 
      hasUserEmail: !!userEmail, 
      emailNotificationsEnabled: shouldSendEmail 
    });
  }

  logger.info('Successfully removed workspace permission', { permissionId });
  return { success: true, message: 'Permission removed successfully' };
}

async function handleGetWorkspaceForPermission(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { workspaceId } = data;
  logger.debug('Getting workspace details', { workspaceId });

  const { data: workspace, error } = await supabaseClient
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single();

  if (error) {
    logger.error('Failed to get workspace details', error);
    throw error;
  }

  logger.info('Successfully retrieved workspace details', { workspaceId, name: workspace?.name });
  return { workspace };
}