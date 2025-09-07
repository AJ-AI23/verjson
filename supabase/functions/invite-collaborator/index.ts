import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Initialize Resend with better error handling
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not configured");
}
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface InviteCollaboratorRequest {
  email: string;
  invitationType: 'document' | 'workspace' | 'bulk_documents';
  resourceId?: string;
  resourceIds?: string[];
  resourceName: string;
  role: 'editor' | 'viewer';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== INVITE COLLABORATOR FUNCTION START ===");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error('Missing Authorization header');
      throw new Error("Missing Authorization header");
    }

    // Use SERVICE_ROLE_KEY for elevated permissions
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User authentication error:', userError);
      throw new Error("Authentication failed");
    }

    console.log("Authenticated user:", user.email);

    const {
      email,
      invitationType,
      resourceId,
      resourceIds,
      resourceName,
      role,
    }: InviteCollaboratorRequest = await req.json();

    console.log("Request body:", JSON.stringify({
      email, invitationType, resourceId, resourceIds, resourceName, role
    }, null, 2));

    if (!email || !invitationType || !resourceName || !role) {
      console.error('Missing required parameters:', { email, invitationType, resourceName, role });
      throw new Error("Missing required parameters");
    }

    // First, validate that the workspace exists if it's a workspace invitation
    let workspace: any = null;
    if (invitationType === 'workspace') {
      const { data: workspaceData, error: workspaceError } = await supabaseClient
        .from('workspaces')
        .select('id, name, user_id')
        .eq('id', resourceId)
        .single();

      if (workspaceError || !workspaceData) {
        console.error('Workspace not found:', workspaceError);
        throw new Error(`Workspace not found: ${resourceId}`);
      }

      workspace = workspaceData;
      console.log("Workspace found:", workspace);
      
      // Verify the inviter owns the workspace
      if (workspace.user_id !== user.id) {
        console.error('User does not own workspace:', { workspaceOwnerId: workspace.user_id, inviterId: user.id });
        throw new Error('Unauthorized: You do not own this workspace');
      }
    }

    // Check if user exists in profiles
    const { data: targetUserProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("user_id, email, full_name, username")
      .eq("email", email)
      .maybeSingle();

    console.log("Target user profile lookup:", { email, targetUserProfile, profileError });

    // Also check auth.users table to see if user exists but profile wasn't created
    let targetUserId = targetUserProfile?.user_id;
    if (!targetUserProfile) {
      const { data: authUsers } = await supabaseClient.auth.admin.listUsers();
      const existingAuthUser = authUsers.users?.find(u => u.email === email);
      
      if (existingAuthUser) {
        console.log("User exists in auth but no profile found, creating profile...");
        targetUserId = existingAuthUser.id;
        
        // Create missing profile
        const { error: profileCreateError } = await supabaseClient
          .from("profiles")
          .insert({
            user_id: existingAuthUser.id,
            email: existingAuthUser.email,
            full_name: existingAuthUser.user_metadata?.full_name || existingAuthUser.email,
            username: existingAuthUser.user_metadata?.username || existingAuthUser.email?.split('@')[0]
          });
          
        if (profileCreateError) {
          console.error("Failed to create missing profile:", profileCreateError);
        } else {
          console.log("Profile created successfully for existing auth user");
        }
      }
    }

    let invitationData: any = {
      inviter_id: user.id,
      inviter_email: user.email,
      role: role,
    };

    let notificationTitle = "";
    let notificationMessage = "";

    if (invitationType === 'document' && resourceId) {
      // Document invitation
      invitationData.document_id = resourceId;
      invitationData.document_name = resourceName;
      
      notificationTitle = `Invitation to collaborate on "${resourceName}"`;
      notificationMessage = `You have been invited to collaborate on the document "${resourceName}" as ${role}.`;

      if (targetUserProfile) {
        // Create pending permission
        const { error: permissionError } = await supabaseClient
          .from("document_permissions")
          .insert({
            document_id: resourceId,
            user_id: targetUserProfile.user_id,
            role: role,
            granted_by: user.id,
            status: 'pending'
          });

        if (permissionError) {
          console.error("Document permission creation error:", permissionError);
          throw new Error(`Failed to create document permission: ${permissionError.message}`);
        } else {
          console.log("Document permission created successfully for user:", targetUserProfile.user_id);
        }
      }

    } else if (invitationType === 'workspace' && resourceId) {
      // Workspace invitation - use the actual workspace name from database lookup
      invitationData.workspace_id = resourceId;
      invitationData.workspace_name = workspace.name; // Use actual name from database
      
      notificationTitle = `Invitation to workspace "${workspace.name}"`;
      notificationMessage = `You have been invited to collaborate on the workspace "${workspace.name}" as ${role}.`;

      if (targetUserProfile) {
        // Create pending permission
        const { error: permissionError } = await supabaseClient
          .from("workspace_permissions")
          .insert({
            workspace_id: resourceId,
            user_id: targetUserProfile.user_id,
            role: role,
            granted_by: user.id,
            status: 'pending'
          });

        if (permissionError) {
          console.error("Workspace permission creation error:", permissionError);
          throw new Error(`Failed to create workspace permission: ${permissionError.message}`);
        } else {
          console.log("Workspace permission created successfully for user:", targetUserProfile.user_id);
        }
      }

    } else if (invitationType === 'bulk_documents' && resourceIds) {
      // Bulk documents invitation
      invitationData.document_ids = resourceIds;
      invitationData.document_count = resourceIds.length;
      
      notificationTitle = `Invitation to ${resourceIds.length} documents`;
      notificationMessage = `You have been invited to collaborate on ${resourceIds.length} documents as ${role}.`;

      if (targetUserProfile) {
        // Create pending permissions for all documents
        const permissions = resourceIds.map(docId => ({
          document_id: docId,
          user_id: targetUserProfile.user_id,
          role: role,
          granted_by: user.id,
          status: 'pending'
        }));

        const { error: permissionError } = await supabaseClient
          .from("document_permissions")
          .insert(permissions);

        if (permissionError) {
          console.error("Permission error:", permissionError);
        }
      }
    }

    // Create notification for the invited user (only if they exist)
    let notificationId = null;
    if (targetUserId) {
      console.log("Creating notification for existing user:", targetUserId);
      try {
        // Since invitation functions were removed, we don't create notifications here anymore
        // Invitations are now handled directly by workspace_permissions status
        console.log("Skipping notification creation - invitations handled by workspace_permissions");
      } catch (error) {
        console.error("Failed to create notification:", error);
      }
    } else {
      console.log("No existing user, notification will be created when user signs up");
    }

    // Send email invitation
    console.log("Preparing to send email invitation...");
    
    if (!resend) {
      console.error("Resend client not initialized - RESEND_API_KEY not configured");
      console.info("Skipping email send - RESEND_API_KEY not configured");
    } else {
      try {
        console.log("Sending email to:", email);
        
        const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #333; font-size: 28px; margin-bottom: 10px;">You're Invited!</h1>
          <p style="color: #666; font-size: 18px; margin: 0;">
            ${user.email} has invited you to collaborate
          </p>
        </div>
        
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #4F46E5;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">
            ${invitationType === 'workspace' ? 'Workspace' : 'Document'}: ${resourceName}
          </h2>
          <p style="color: #666; font-size: 16px; margin: 0;">
            Role: <strong>${role}</strong>
          </p>
        </div>
      
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
        ${targetUserId ? 
          'To accept this invitation, please log in to your account and check your notifications.' :
          'To accept this invitation, please sign up for an account and the invitation will be waiting for you.'
        }
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${Deno.env.get("SUPABASE_URL")?.replace('/v1', '') || 'https://your-app.com'}" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          ${targetUserId ? 'Login & View Invitation' : 'Sign Up & Accept'}
        </a>
      </div>
      
      <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">
          This invitation was sent by ${user.email}
        </p>
      </div>
    </div>
        `;

        const emailResult = await resend.emails.send({
          from: "Lovable <onboarding@resend.dev>",
          to: [email],
          subject: notificationTitle,
          html: emailContent,
        });

        console.log("Email sent successfully:", emailResult);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't throw here - the invitation was still created
      }
    }

    const response = {
      success: true,
      message: `Invitation sent successfully to ${email}`,
      userExists: !!targetUserId,
      notificationId,
      email: email,
      invitationType,
      resourceId,
      resourceName,
      role
    };

    console.log("=== FUNCTION COMPLETED SUCCESSFULLY ===");
    console.log("Response:", JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('=== ERROR in invite-collaborator function ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    
    const errorResponse = {
      error: error.message || 'An unexpected error occurred',
      details: error.stack
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);