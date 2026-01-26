import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdgeFunctionLogger, checkDemoSessionExpiration } from '../_shared/logger.ts'

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
    
    // Parse request to determine client type needed
    const { action } = await req.clone().json();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      logger.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    let supabaseClient;
    let user;

    // For invitation operations that need elevated permissions, use service role key
    if (['inviteToDocument', 'inviteToWorkspace', 'inviteBulkDocuments'].includes(action)) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Get user from token for invitation operations
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !authUser) {
        logger.error('Authentication failed', authError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: corsHeaders }
        )
      }
      user = authUser;
      
      // Check if demo session has expired
      const isExpired = await checkDemoSessionExpiration(supabaseClient, user.id);
      if (isExpired) {
        logger.warn('Demo session expired, denying access');
        return new Response(
          JSON.stringify({ error: 'Demo session expired' }),
          { status: 401, headers: corsHeaders }
        )
      }
    } else {
      // For regular permission operations, use user's auth token
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      )

      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser()
      if (authError || !authUser) {
        logger.error('Authentication failed', authError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: corsHeaders }
        )
      }
      user = authUser;
      
      // Check if demo session has expired
      const isExpired = await checkDemoSessionExpiration(supabaseClient, user.id);
      if (isExpired) {
        logger.warn('Demo session expired, denying access');
        return new Response(
          JSON.stringify({ error: 'Demo session expired' }),
          { status: 401, headers: corsHeaders }
        )
      }
    }

    logger.logAuth(user);

    const { action: requestAction, ...requestData } = await req.json()
    logger.debug('Parsed request body', { action: requestAction, hasData: !!requestData });

    let result;

    switch (requestAction) {
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
      case 'inviteToDocument':
        result = await handleInviteToDocument(supabaseClient, requestData, user, logger);
        break;
      case 'inviteToWorkspace':
        result = await handleInviteToWorkspace(supabaseClient, requestData, user, logger);
        break;
      case 'inviteBulkDocuments':
        result = await handleInviteBulkDocuments(supabaseClient, requestData, user, logger);
        break;
      case 'getUserInvitations':
        result = await handleGetUserInvitations(supabaseClient, requestData, user, logger);
        break;
      case 'acceptInvitation':
        result = await handleAcceptInvitation(supabaseClient, requestData, user, logger);
        break;
      case 'declineInvitation':
        result = await handleDeclineInvitation(supabaseClient, requestData, user, logger);
        break;
      case 'getUserAllPermissions':
        result = await handleGetUserAllPermissions(supabaseClient, requestData, user, logger);
        break;
      case 'getBulkDocumentPermissions':
        result = await handleGetBulkDocumentPermissions(supabaseClient, requestData, logger);
        break;
      default:
        logger.warn('Unknown action requested', { action: requestAction });
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

// ============== PERMISSION QUERY HANDLERS ==============

async function handleGetDocumentPermissions(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { documentId } = data;
  logger.debug('Getting document permissions with inheritance', { documentId });

  const { data: permissions, error } = await supabaseClient
    .rpc('get_document_permissions_with_inheritance', { doc_id: documentId });

  if (error) {
    logger.error('Failed to get document permissions with inheritance', error);
    throw error;
  }

  logger.info('Successfully retrieved document permissions with inheritance', { 
    documentId, 
    permissionCount: permissions?.length || 0,
    inheritedCount: permissions?.filter((p: any) => p.inherited_from === 'workspace')?.length || 0
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

// ============== PERMISSION UPDATE HANDLERS ==============

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

// ============== PERMISSION REMOVAL HANDLERS ==============

async function handleRemoveDocumentPermission(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { permissionId, resourceName, emailNotificationsEnabled } = data;
  logger.debug('Removing document permission with atomicity', { permissionId });

  // Start an explicit transaction for atomicity
  const { data: permissionData, error: getPermError } = await supabaseClient
    .from('document_permissions')
    .select('user_id, document_id, email_notifications_enabled')
    .eq('id', permissionId)
    .single();

  if (getPermError || !permissionData) {
    logger.error('Failed to get permission details', getPermError);
    throw new Error('Permission not found');
  }

  // Look up the user's email from auth.users for email notifications
  let targetUserEmail: string | null = null;
  try {
    const { data: userData } = await supabaseClient.auth.admin.getUserById(permissionData.user_id);
    targetUserEmail = userData?.user?.email || null;
  } catch (lookupError) {
    logger.warn('Could not look up user email for notification', lookupError);
  }

  // Remove the permission first (before notifications)
  logger.debug('Deleting permission atomically', { permissionId, userId: permissionData.user_id });
  const { error } = await supabaseClient
    .from('document_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to remove document permission', error);
    throw error;
  }

  logger.info('Document permission deleted successfully', { permissionId, userId: permissionData.user_id });

  // Only create notification AFTER successful permission deletion
  try {
    await createNotification(supabaseClient, permissionData.user_id, 'document_access_revoked', 
      `Access removed from "${resourceName || 'Document'}"`,
      `Your access to the document "${resourceName || 'Unknown Document'}" has been removed.`,
      logger, { document_id: permissionData.document_id });

    // Send email notification if enabled
    const shouldSendEmail = emailNotificationsEnabled ?? permissionData.email_notifications_enabled;
    if (targetUserEmail && shouldSendEmail) {
      await sendRevocationEmail(targetUserEmail, user.email, 'document', resourceName || 'Unknown Document', logger);
    }
  } catch (notificationError) {
    logger.warn('Failed to create notifications but permission was removed', notificationError);
    // Don't fail the operation if notifications fail
  }

  logger.info('Successfully removed document permission', { permissionId });
  return { success: true, message: 'Permission removed successfully' };
}

async function handleRemoveWorkspacePermission(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { permissionId, resourceName, emailNotificationsEnabled } = data;
  logger.debug('Removing workspace permission with atomicity', { permissionId });

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

  // Look up the user's email from auth.users for email notifications
  let targetUserEmail: string | null = null;
  try {
    const { data: userData } = await supabaseClient.auth.admin.getUserById(permissionData.user_id);
    targetUserEmail = userData?.user?.email || null;
  } catch (lookupError) {
    logger.warn('Could not look up user email for notification', lookupError);
  }

  // Remove the permission first (before notifications)
  logger.debug('Deleting permission atomically', { permissionId, userId: permissionData.user_id });
  const { error } = await supabaseClient
    .from('workspace_permissions')
    .delete()
    .eq('id', permissionId);

  if (error) {
    logger.error('Failed to remove workspace permission', error);
    throw error;
  }

  logger.info('Workspace permission deleted successfully', { permissionId, userId: permissionData.user_id });

  // Only create notification AFTER successful permission deletion
  try {
    await createNotification(supabaseClient, permissionData.user_id, 'workspace_access_revoked',
      `Access removed from "${resourceName || 'Workspace'}"`,
      `Your access to the workspace "${resourceName || 'Unknown Workspace'}" has been removed.`,
      logger, { workspace_id: permissionData.workspace_id });

    // Send email notification if enabled
    const shouldSendEmail = emailNotificationsEnabled ?? permissionData.email_notifications_enabled;
    if (targetUserEmail && shouldSendEmail) {
      await sendRevocationEmail(targetUserEmail, user.email, 'workspace', resourceName || 'Unknown Workspace', logger);
    }
  } catch (notificationError) {
    logger.warn('Failed to create notifications but permission was removed', notificationError);
    // Don't fail the operation if notifications fail
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

// ============== USER INVITATION HANDLERS ==============

async function handleGetUserInvitations(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  logger.debug('Getting user invitations', { userId: user.id });

  const { data: invitations, error } = await supabaseClient
    .rpc('get_user_invitations', { target_user_id: user.id });

  if (error) {
    logger.error('Failed to get user invitations', error);
    throw error;
  }

  logger.info('Successfully retrieved user invitations', { 
    userId: user.id, 
    invitationCount: invitations?.length || 0 
  });
  
  return { invitations };
}

async function handleAcceptInvitation(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { invitationId, invitationType } = data;
  logger.debug('Accepting invitation', { invitationId, invitationType, userId: user.id });

  const { data: result, error } = await supabaseClient
    .rpc('accept_invitation', { 
      invitation_id: invitationId, 
      invitation_type: invitationType 
    });

  if (error) {
    logger.error('Failed to accept invitation', error);
    throw error;
  }

  const acceptResult = result?.[0];
  if (!acceptResult?.success) {
    logger.error('Invitation acceptance failed', { message: acceptResult?.message });
    throw new Error(acceptResult?.message || 'Failed to accept invitation');
  }

  logger.info('Successfully accepted invitation', { 
    invitationId, 
    invitationType,
    workspaceId: acceptResult.workspace_id,
    documentId: acceptResult.document_id 
  });
  
  return {
    success: true,
    message: acceptResult.message,
    workspaceId: acceptResult.workspace_id,
    documentId: acceptResult.document_id
  };
}

async function handleDeclineInvitation(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { invitationId, invitationType } = data;
  logger.debug('Declining invitation', { invitationId, invitationType, userId: user.id });

  const { data: result, error } = await supabaseClient
    .rpc('decline_invitation', { 
      invitation_id: invitationId, 
      invitation_type: invitationType 
    });

  if (error) {
    logger.error('Failed to decline invitation', error);
    throw error;
  }

  const declineResult = result?.[0];
  if (!declineResult?.success) {
    logger.error('Invitation decline failed', { message: declineResult?.message });
    throw new Error(declineResult?.message || 'Failed to decline invitation');
  }

  logger.info('Successfully declined invitation', { invitationId, invitationType });
  
  return {
    success: true,
    message: declineResult.message
  };
}

async function handleGetUserAllPermissions(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  const { targetUserId } = data;
  logger.debug('Getting user all permissions', { targetUserId, requesterId: user.id });

  const { data: permissions, error } = await supabaseClient
    .rpc('get_user_all_permissions', { target_user_id: targetUserId });

  if (error) {
    logger.error('Failed to get user all permissions', error);
    throw error;
  }

  logger.info('Successfully retrieved user all permissions', { 
    targetUserId, 
    permissionCount: permissions?.length || 0 
  });
  
  return { permissions };
}

async function handleGetBulkDocumentPermissions(supabaseClient: any, data: any, logger: EdgeFunctionLogger) {
  const { documentIds } = data;
  logger.debug('Getting bulk document permissions', { documentCount: documentIds?.length });

  if (!documentIds || !Array.isArray(documentIds)) {
    throw new Error('documentIds must be provided as an array');
  }

  const permissionsMap: Record<string, any[]> = {};
  
  for (const documentId of documentIds) {
    try {
      const { data: permissions, error } = await supabaseClient
        .rpc('get_document_permissions', { doc_id: documentId });

      if (error) {
        logger.warn('Failed to get permissions for document', { documentId, error });
        permissionsMap[documentId] = [];
      } else {
        permissionsMap[documentId] = permissions || [];
      }
    } catch (error) {
      logger.warn('Error fetching permissions for document', { documentId, error });
      permissionsMap[documentId] = [];
    }
  }

  logger.info('Successfully retrieved bulk document permissions', { 
    documentCount: documentIds.length,
    totalPermissions: Object.values(permissionsMap).flat().length 
  });
  
  return { permissionsMap };
}

// ============== INVITATION HANDLERS ==============

async function handleInviteToDocument(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  logger.debug('Raw invitation data received', data);
  const { email, resourceId: documentId, resourceName: documentName, role = 'editor', emailNotificationsEnabled } = data;
  const emailNotifications = emailNotificationsEnabled !== false; // Default to true only if not explicitly false
  
  logger.info('Processing document invitation with detailed values', { 
    email, 
    documentId, 
    documentName, 
    role, 
    emailNotifications,
    originalEmailNotificationsEnabled: emailNotificationsEnabled,
    emailNotificationsEnabledType: typeof emailNotificationsEnabled,
    emailNotificationsType: typeof emailNotifications
  });

  if (!email || !documentId || !documentName || !role) {
    throw new Error("Missing required parameters");
  }

  // Find or create user profile
  const targetUserId = await findOrCreateUserProfile(supabaseClient, email, logger);

  let notificationTitle = `Invitation to collaborate on "${documentName}"`;
  let notificationMessage = `You have been invited to collaborate on the document "${documentName}" as ${role}.`;

  if (targetUserId) {
    // Create pending permission
    logger.info('Creating document permission with values', {
      document_id: documentId,
      user_id: targetUserId,
      role: role,
      granted_by: user.id,
      status: 'pending',
      email_notifications_enabled: emailNotifications
    });
    
    const { error: permissionError } = await supabaseClient
      .from("document_permissions")
      .insert({
        document_id: documentId,
        user_id: targetUserId,
        role: role,
        granted_by: user.id,
        status: 'pending',
        email_notifications_enabled: emailNotifications
      });

    if (permissionError) {
      logger.error("Document permission creation error", permissionError);
      throw new Error(`Failed to create document permission: ${permissionError.message}`);
    }

    // Create notification
    await createNotification(supabaseClient, targetUserId, 'invitation', notificationTitle, notificationMessage, logger, {
      document_id: documentId
    });
  }

  // Send email if enabled
  logger.info('Email sending decision', {
    emailNotifications,
    emailNotificationsType: typeof emailNotifications,
    willSendEmail: emailNotifications
  });
  
  if (emailNotifications) {
    logger.info('Sending invitation email');
    await sendInvitationEmail(email, user.email, 'document', documentName, role, !!targetUserId, logger);
  } else {
    logger.info('Skipping email send - notifications disabled');
  }

  logger.info('Document invitation completed successfully', { email, documentId, role });
  return {
    success: true,
    message: `Invitation sent successfully to ${email}`,
    userExists: !!targetUserId
  };
}

async function handleInviteToWorkspace(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  logger.debug('Raw workspace invitation data received', data);
  const { email, resourceId: workspaceId, resourceName: workspaceName, role = 'editor', emailNotificationsEnabled } = data;
  const emailNotifications = emailNotificationsEnabled !== false; // Default to true only if not explicitly false
  logger.info('Processing workspace invitation', { email, workspaceId, workspaceName, role, emailNotifications, originalEmailNotificationsEnabled: emailNotificationsEnabled });

  if (!email || !workspaceId || !workspaceName || !role) {
    throw new Error("Missing required parameters");
  }

  // Validate workspace ownership
  const { data: workspace, error: workspaceError } = await supabaseClient
    .from('workspaces')
    .select('id, name, user_id')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    logger.error('Workspace not found', workspaceError);
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  if (workspace.user_id !== user.id) {
    logger.error('User does not own workspace', { workspaceOwnerId: workspace.user_id, inviterId: user.id });
    throw new Error('Unauthorized: You do not own this workspace');
  }

  // Find or create user profile
  const targetUserId = await findOrCreateUserProfile(supabaseClient, email, logger);

  let notificationTitle = `Invitation to workspace "${workspace.name}"`;
  let notificationMessage = `You have been invited to collaborate on the workspace "${workspace.name}" as ${role}.`;

  if (targetUserId) {
    // Create pending permission
    const { error: permissionError } = await supabaseClient
      .from("workspace_permissions")
      .insert({
        workspace_id: workspaceId,
        user_id: targetUserId,
        role: role,
        granted_by: user.id,
        status: 'pending',
        email_notifications_enabled: emailNotifications
      });

    if (permissionError) {
      logger.error("Workspace permission creation error", permissionError);
      throw new Error(`Failed to create workspace permission: ${permissionError.message}`);
    }

    // Create notification
    await createNotification(supabaseClient, targetUserId, 'invitation', notificationTitle, notificationMessage, logger, {
      workspace_id: workspaceId
    });
  }

  // Send email if enabled
  if (emailNotifications) {
    await sendInvitationEmail(email, user.email, 'workspace', workspace.name, role, !!targetUserId, logger);
  }

  logger.info('Workspace invitation completed successfully', { email, workspaceId, role });
  return {
    success: true,
    message: `Invitation sent successfully to ${email}`,
    userExists: !!targetUserId
  };
}

async function handleInviteBulkDocuments(supabaseClient: any, data: any, user: any, logger: EdgeFunctionLogger) {
  logger.debug('Raw bulk invitation data received', data);
  const { email, resourceIds: documentIds, role = 'editor', emailNotificationsEnabled } = data;
  const emailNotifications = emailNotificationsEnabled !== false; // Default to true only if not explicitly false
  logger.info('Processing bulk document invitation', { email, documentIds, role, emailNotifications, originalEmailNotificationsEnabled: emailNotificationsEnabled });

  if (!email || !documentIds || !documentIds.length || !role) {
    throw new Error("Missing required parameters");
  }

  // Find or create user profile
  const targetUserId = await findOrCreateUserProfile(supabaseClient, email, logger);

  let notificationTitle = `Invitation to ${documentIds.length} documents`;
  let notificationMessage = `You have been invited to collaborate on ${documentIds.length} documents as ${role}.`;

  if (targetUserId) {
    // Create pending permissions for all documents
    const permissions = documentIds.map((docId: string) => ({
      document_id: docId,
      user_id: targetUserId,
      role: role,
      granted_by: user.id,
      status: 'pending',
      email_notifications_enabled: emailNotifications
    }));

    const { error: permissionError } = await supabaseClient
      .from("document_permissions")
      .insert(permissions);

    if (permissionError) {
      logger.error("Bulk document permission creation error", permissionError);
      throw new Error(`Failed to create document permissions: ${permissionError.message}`);
    }

    // Create notification
    await createNotification(supabaseClient, targetUserId, 'invitation', notificationTitle, notificationMessage, logger);
  }

  // Send email if enabled
  if (emailNotifications) {
    await sendInvitationEmail(email, user.email, 'documents', `${documentIds.length} documents`, role, !!targetUserId, logger);
  }

  logger.info('Bulk document invitation completed successfully', { email, documentCount: documentIds.length, role });
  return {
    success: true,
    message: `Invitation sent successfully to ${email}`,
    userExists: !!targetUserId
  };
}

// ============== HELPER FUNCTIONS ==============

async function findOrCreateUserProfile(supabaseClient: any, email: string, logger: EdgeFunctionLogger): Promise<string | null> {
  logger.debug('Looking up user profile by email via auth.users', { email });

  // First check auth.users table directly (email is only stored there now)
  const { data: authUsers, error: listError } = await supabaseClient.auth.admin.listUsers();
  
  if (listError) {
    logger.warn('Failed to list auth users', listError);
    return null;
  }
  
  const existingAuthUser = authUsers.users?.find((u: any) => u.email === email);
  
  if (existingAuthUser) {
    logger.debug('Found existing auth user', { userId: existingAuthUser.id });
    
    // Check if profile exists for this user
    const { data: existingProfile } = await supabaseClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", existingAuthUser.id)
      .maybeSingle();
    
    if (!existingProfile) {
      logger.debug('Creating missing profile for existing auth user', { userId: existingAuthUser.id });
      
      // Create missing profile (without email column - it no longer exists)
      const { error: profileCreateError } = await supabaseClient
        .from("profiles")
        .insert({
          user_id: existingAuthUser.id,
          full_name: existingAuthUser.user_metadata?.full_name || existingAuthUser.email,
          username: existingAuthUser.user_metadata?.username || existingAuthUser.email?.split('@')[0]
        });
        
      if (profileCreateError) {
        logger.warn("Failed to create missing profile", profileCreateError);
      } else {
        logger.info("Profile created successfully for existing auth user");
      }
    }
    
    return existingAuthUser.id;
  }

  logger.debug('No existing user found for email', { email });
  return null;
}

async function createNotification(supabaseClient: any, userId: string, type: string, title: string, message: string, logger: EdgeFunctionLogger, extra: any = {}) {
  try {
    const { error: notificationError } = await supabaseClient
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        message,
        ...extra
      });

    if (notificationError) {
      logger.warn("Failed to create notification", notificationError);
    } else {
      logger.info("Notification created successfully", { userId, type });
    }
  } catch (error) {
    logger.warn("Error creating notification", error);
  }
}

async function sendInvitationEmail(email: string, inviterEmail: string, resourceType: string, resourceName: string, role: string, userExists: boolean, logger: EdgeFunctionLogger) {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logger.warn('RESEND_API_KEY not configured - skipping email notification');
      return;
    }

    const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #333; font-size: 28px; margin-bottom: 10px;">You're Invited!</h1>
          <p style="color: #666; font-size: 18px; margin: 0;">
            ${inviterEmail} has invited you to collaborate
          </p>
        </div>
        
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #4F46E5;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">
            ${resourceType}: ${resourceName}
          </h2>
          <p style="color: #666; font-size: 16px; margin: 0;">
            Role: <strong>${role}</strong>
          </p>
        </div>
      
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          ${userExists ? 
            'To accept this invitation, please log in to your account and check your notifications.' :
            'To accept this invitation, please sign up for an account and the invitation will be waiting for you.'
          }
        </p>
      
        <div style="text-align: center; margin: 30px 0;">
          <a href="${Deno.env.get("SUPABASE_URL")?.replace('/v1', '') || 'https://your-app.com'}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${userExists ? 'Login & View Invitation' : 'Sign Up & Accept'}
          </a>
        </div>
      
        <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
          <p style="color: #9ca3af; font-size: 14px; margin: 0;">
            This invitation was sent by ${inviterEmail}
          </p>
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
        to: [email],
        subject: `Invitation to collaborate on ${resourceName}`,
        html: emailContent,
      }),
    });

    if (emailResponse.ok) {
      logger.info('Invitation email sent successfully', { email });
    } else {
      const errorText = await emailResponse.text();
      logger.warn('Failed to send invitation email', { email, error: errorText });
    }
  } catch (emailError) {
    logger.warn('Error sending invitation email', emailError);
  }
}

async function sendRevocationEmail(email: string, revokerEmail: string, resourceType: string, resourceName: string, logger: EdgeFunctionLogger) {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logger.warn('RESEND_API_KEY not configured - skipping email notification');
      return;
    }

    const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #dc2626; font-size: 28px; margin-bottom: 10px;">Access Revoked</h1>
          <p style="color: #666; font-size: 18px; margin: 0;">Your access has been removed</p>
        </div>
        
        <div style="background-color: #fef2f2; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #dc2626;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">${resourceType}: ${resourceName}</h2>
          <p style="color: #666; font-size: 16px; margin: 0;">Access revoked by: <strong>${revokerEmail}</strong></p>
        </div>
      
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          You no longer have access to this ${resourceType.toLowerCase()}. If you believe this is an error, please contact the ${resourceType.toLowerCase()} owner.
        </p>
      
        <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
          <p style="color: #9ca3af; font-size: 14px; margin: 0;">This notification was sent by ${revokerEmail}</p>
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
        to: [email],
        subject: `Access Revoked: ${resourceName}`,
        html: emailContent,
      }),
    });

    if (emailResponse.ok) {
      logger.info('Revocation email sent successfully', { email });
    } else {
      const errorText = await emailResponse.text();
      logger.warn('Failed to send revocation email', { email, error: errorText });
    }
  } catch (emailError) {
    logger.warn('Error sending revocation email', emailError);
  }
}