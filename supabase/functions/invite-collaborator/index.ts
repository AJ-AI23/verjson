import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteCollaboratorRequest {
  email: string;
  invitationType: 'document' | 'workspace' | 'bulk-documents';
  resourceId?: string;
  resourceIds?: string[];
  resourceName: string;
  role: 'editor' | 'viewer';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const {
      email,
      invitationType,
      resourceId,
      resourceIds,
      resourceName,
      role,
    }: InviteCollaboratorRequest = await req.json();

    if (!email || !invitationType || !resourceName || !role) {
      throw new Error("Missing required fields");
    }

    // Check if user exists, if not create an invitation notification anyway
    const { data: targetUserProfile } = await supabaseClient
      .from("profiles")
      .select("user_id, email, full_name")
      .eq("email", email)
      .single();

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
          console.error("Permission error:", permissionError);
        }
      }

    } else if (invitationType === 'workspace' && resourceId) {
      // Workspace invitation
      invitationData.workspace_id = resourceId;
      invitationData.workspace_name = resourceName;
      
      notificationTitle = `Invitation to workspace "${resourceName}"`;
      notificationMessage = `You have been invited to collaborate on the workspace "${resourceName}" as ${role}.`;

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
          console.error("Permission error:", permissionError);
        }
      }

    } else if (invitationType === 'bulk-documents' && resourceIds) {
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

    // Create invitation notification if user exists
    if (targetUserProfile) {
      const { error: notificationError } = await supabaseClient
        .rpc('create_invitation_notification', {
          target_user_id: targetUserProfile.user_id,
          inviter_user_id: user.id,
          inv_type: invitationType.replace('-', '_'),
          inv_data: invitationData,
          title: notificationTitle,
          message: notificationMessage
        });

      if (notificationError) {
        console.error("Notification error:", notificationError);
      }
    }

    // Send email invitation using SMTP
    const smtpHost = Deno.env.get("SMTP_HOST") || "send.one.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USERNAME");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpUser || !smtpPassword) {
      throw new Error("SMTP credentials are not configured. Please set SMTP_USERNAME and SMTP_PASSWORD in the Supabase dashboard.");
    }

    const client = new SmtpClient();
    
    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPassword,
    });
    
    const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">${notificationTitle}</h1>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
          ${notificationMessage}
        </p>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          ${targetUserProfile ? 
            'You can manage this invitation from your dashboard after logging in.' :
            'To accept this invitation, please sign up for an account and the invitation will be waiting for you.'
          }
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${Deno.env.get("SUPABASE_URL")?.replace('/v1', '') || 'https://your-app.com'}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${targetUserProfile ? 'View Invitation' : 'Sign Up & Accept'}
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 14px; text-align: center;">
          This invitation was sent by ${user.email}
        </p>
      </div>
    `;

    await client.send({
      from: smtpUser,
      to: email,
      subject: notificationTitle,
      content: emailContent,
      html: emailContent,
    });

    await client.close();

    console.log("Email sent successfully via SMTP");

    return new Response(
      JSON.stringify({
        message: `Invitation sent successfully to ${email}`,
        emailSent: true,
        userExists: !!targetUserProfile,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in invite-collaborator function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);