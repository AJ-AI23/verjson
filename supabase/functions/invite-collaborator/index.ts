import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  documentId: string;
  documentName: string;
  role: 'editor' | 'viewer';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, documentId, documentName, role }: InviteRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the current user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    // Check if the current user owns the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      throw new Error("Document not found or access denied");
    }

    // Check if user exists by email
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .eq('email', email)
      .single();

    let targetUserId: string;
    let isNewUser = false;

    if (userError || !existingUser) {
      // User doesn't exist, we'll send an invitation email
      isNewUser = true;
      // For now, we can't create the permission yet since we don't have a user_id
      // We'll just send the invitation email
    } else {
      targetUserId = existingUser.user_id;
      
      // Check if permission already exists
      const { data: existingPermission } = await supabase
        .from('document_permissions')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', targetUserId)
        .single();

      if (existingPermission) {
        return new Response(
          JSON.stringify({ error: "User already has access to this document" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Create the permission
      const { error: permError } = await supabase
        .from('document_permissions')
        .insert({
          document_id: documentId,
          user_id: targetUserId,
          role: role,
          granted_by: user.id
        });

      if (permError) {
        throw new Error(`Failed to create permission: ${permError.message}`);
      }
    }

    // Send email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    let emailSubject: string;
    let emailHtml: string;
    
    if (isNewUser) {
      emailSubject = `Invitation to collaborate on ${documentName} via VerJSON`;
      emailHtml = `
        <h1>You've been invited to collaborate!</h1>
        <p>Hello,</p>
        <p>You've been invited to collaborate on the document "<strong>${documentName}</strong>" via VerJSON.</p>
        <p>To get started:</p>
        <ol>
          <li>Create your free account at <a href="${supabaseUrl.replace('.supabase.co', '.supabase.app')}">VerJSON</a></li>
          <li>Once registered, you'll automatically have ${role} access to the document</li>
        </ol>
        <p>VerJSON is a powerful platform for creating and managing JSON Schema and OpenAPI specifications with visual diagrams and collaborative editing.</p>
        <p>Best regards,<br>The VerJSON Team</p>
      `;
    } else {
      emailSubject = `New document access: ${documentName}`;
      emailHtml = `
        <h1>You've been granted access to a document!</h1>
        <p>Hello ${existingUser.full_name || existingUser.email},</p>
        <p>You now have <strong>${role}</strong> access to the document "<strong>${documentName}</strong>".</p>
        <p>You can access it by logging into your VerJSON account at <a href="${supabaseUrl.replace('.supabase.co', '.supabase.app')}">VerJSON</a>.</p>
        <p>Best regards,<br>The VerJSON Team</p>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "VerJSON <onboarding@resend.dev>",
      to: [email],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isNewUser 
          ? "Invitation sent successfully" 
          : "Permission granted and user notified"
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