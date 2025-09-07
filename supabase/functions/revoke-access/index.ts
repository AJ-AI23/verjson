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

interface RevokeAccessRequest {
  permissionId: string;
  type: 'document' | 'workspace';
  revokedUserEmail: string;
  revokedUserName?: string;
  resourceName: string;
  revokerName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== REVOKE ACCESS FUNCTION START ===");

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

    console.log("Authenticated user (revoker):", user.email);

    const {
      permissionId,
      type,
      revokedUserEmail,
      revokedUserName,
      resourceName,
      revokerName
    }: RevokeAccessRequest = await req.json();

    console.log("Revoke access request:", JSON.stringify({
      permissionId, type, revokedUserEmail, resourceName, revokedUserName, revokerName
    }, null, 2));

    // Enhanced parameter validation with detailed logging
    const missingParams = [];
    if (!permissionId) missingParams.push('permissionId');
    if (!type) missingParams.push('type');
    if (!revokedUserEmail) missingParams.push('revokedUserEmail');
    if (!resourceName) missingParams.push('resourceName');
    
    if (missingParams.length > 0) {
      console.error('Missing required parameters:', missingParams);
      console.error('Received request body:', { permissionId, type, revokedUserEmail, resourceName, revokedUserName, revokerName });
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }

    console.log("All required parameters validated successfully");

    // First, get the permission details to check if it's pending or accepted
    const table = type === 'workspace' ? 'workspace_permissions' : 'document_permissions';
    const { data: permission, error: permissionError } = await supabaseClient
      .from(table)
      .select('*')
      .eq('id', permissionId)
      .single();

    if (permissionError || !permission) {
      console.error('Permission not found:', permissionError);
      throw new Error('Permission not found');
    }

    console.log('Permission details:', permission);
    const isPendingInvitation = permission.status === 'pending';

    // Delete the permission record
    console.log(`Deleting permission from ${table}:`, permissionId);
    const { error: deleteError } = await supabaseClient
      .from(table)
      .delete()
      .eq('id', permissionId);

    if (deleteError) {
      console.error('Failed to delete permission:', deleteError);
      throw new Error('Failed to delete permission');
    }

    console.log('Permission deleted successfully');

    // Get the revoked user's profile to create notification
    const { data: revokedUserProfile } = await supabaseClient
      .from("profiles")
      .select("user_id, email, full_name, username")
      .eq("email", revokedUserEmail)
      .maybeSingle();

    // If this was a pending invitation, clean up related invitation notifications
    if (isPendingInvitation && revokedUserProfile) {
      console.log('Cleaning up pending invitation notifications...');
      
      // Delete invitation notifications for this specific permission
      const invitationTitle = type === 'workspace' 
        ? `Invitation to workspace "${resourceName}"`
        : `Invitation to collaborate on "${resourceName}"`;
      
      const { error: cleanupError } = await supabaseClient
        .from('notifications')
        .delete()
        .eq('user_id', revokedUserProfile.user_id)
        .eq('title', invitationTitle)
        .is('read_at', null); // Only unread notifications (pending invitations)

      if (cleanupError) {
        console.error('Failed to cleanup invitation notifications:', cleanupError);
      } else {
        console.log('Pending invitation notifications cleaned up');
      }
    }

    // Create notification for the revoked user if they exist and it was an accepted permission
    if (revokedUserProfile && !isPendingInvitation) {
      console.log("Creating revocation notification for user:", revokedUserProfile.user_id);
      
      const notificationTitle = `Access revoked: ${resourceName}`;
      const notificationMessage = `Your ${type} access to "${resourceName}" has been revoked by ${revokerName || user.email}.`;
      
      try {
        const notificationData: any = {
          user_id: revokedUserProfile.user_id,
          type: 'access_revoked',
          title: notificationTitle,
          message: notificationMessage
        };

        // Add resource IDs for proper notification tracking
        if (type === 'workspace') {
          notificationData.workspace_id = permission.workspace_id;
        } else {
          notificationData.document_id = permission.document_id;
          // Get document's workspace_id for proper context
          const { data: doc } = await supabaseClient
            .from('documents')
            .select('workspace_id')
            .eq('id', permission.document_id)
            .single();
          if (doc) {
            notificationData.workspace_id = doc.workspace_id;
          }
        }

        const { data, error: notificationError } = await supabaseClient
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();
        
        if (notificationError) {
          console.error("Notification creation error:", notificationError);
        } else {
          console.log("Notification created with ID:", data?.id);
        }
      } catch (error) {
        console.error("Failed to create notification:", error);
      }
    }

    // Send email notification
    console.log("Preparing to send revocation email...");
    
    if (!resend) {
      console.error("Resend client not initialized - RESEND_API_KEY not configured");
      console.info("Skipping email send - RESEND_API_KEY not configured");
    } else {
      try {
        console.log("Sending revocation email to:", revokedUserEmail);
        
        const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #dc2626; font-size: 28px; margin-bottom: 10px;">Access Revoked</h1>
          <p style="color: #666; font-size: 18px; margin: 0;">
            Your access has been removed
          </p>
        </div>
        
        <div style="background-color: #fef2f2; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #dc2626;">
          <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">
            ${type === 'workspace' ? 'Workspace' : 'Document'}: ${resourceName}
          </h2>
          <p style="color: #666; font-size: 16px; margin: 0;">
            Access revoked by: <strong>${revokerName || user.email}</strong>
          </p>
        </div>
      
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
        You no longer have access to this ${type}. If you believe this is an error, please contact the ${type} owner.
      </p>
      
      <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">
          This notification was sent by ${revokerName || user.email}
        </p>
      </div>
    </div>
        `;

        const emailResult = await resend.emails.send({
          from: "Lovable <onboarding@resend.dev>",
          to: [revokedUserEmail],
          subject: `Access Revoked: ${resourceName}`,
          html: emailContent,
        });

        console.log("Revocation email sent successfully:", emailResult);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't throw here - the revocation should still proceed
      }
    } else {
      console.log("Skipping email notification for pending invitation cleanup");
    }

    const response = {
      success: true,
      message: isPendingInvitation 
        ? 'Pending invitation revoked and cleaned up successfully'
        : 'Access revoked and notification sent successfully',
      permissionDeleted: true,
      notificationSent: !!revokedUserProfile && !isPendingInvitation,
      invitationCleaned: isPendingInvitation,
      emailSent: !!resend && !isPendingInvitation,
      revokedUserEmail
    };

    console.log("=== REVOKE ACCESS FUNCTION COMPLETED ===");
    console.log("Response:", JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('=== ERROR in revoke-access function ===');
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