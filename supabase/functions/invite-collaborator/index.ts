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
  invitationType: 'document' | 'workspace' | 'bulk-documents';
  resourceId?: string; // documentId or workspaceId
  resourceIds?: string[]; // for bulk document invitations
  resourceName: string;
  role: 'editor' | 'viewer';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      invitationType, 
      resourceId, 
      resourceIds, 
      resourceName, 
      role 
    }: InviteRequest = await req.json();

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

    // Check if user exists by email
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .eq('email', email)
      .single();

    let targetUserId: string;
    let isNewUser = false;

    if (userError || !existingUser) {
      isNewUser = true;
    } else {
      targetUserId = existingUser.user_id;
    }

    // Handle different invitation types
    let permissionsCreated = 0;
    let resourceNames: string[] = [];

    if (invitationType === 'document' && resourceId) {
      // Single document invitation
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*, workspaces(name)')
        .eq('id', resourceId)
        .single();

      if (docError || !document) {
        throw new Error("Document not found or access denied");
      }

      // Check if user has permission to invite (owner of document or workspace)
      const hasPermission = await checkDocumentPermission(supabase, user.id, resourceId);
      if (!hasPermission) {
        throw new Error("You don't have permission to invite users to this document");
      }

      if (!isNewUser) {
        const { error: permError } = await supabase
          .from('document_permissions')
          .insert({
            document_id: resourceId,
            user_id: targetUserId,
            role: role,
            granted_by: user.id
          });

        if (permError && !permError.message.includes('duplicate')) {
          throw new Error(`Failed to create permission: ${permError.message}`);
        }
        if (!permError) permissionsCreated++;
      }

      resourceNames = [document.name];

    } else if (invitationType === 'workspace' && resourceId) {
      // Workspace invitation
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', resourceId)
        .eq('user_id', user.id)
        .single();

      if (wsError || !workspace) {
        throw new Error("Workspace not found or access denied");
      }

      if (!isNewUser) {
        // Create workspace permission
        const { error: wsPermError } = await supabase
          .from('workspace_permissions')
          .insert({
            workspace_id: resourceId,
            user_id: targetUserId,
            role: role,
            granted_by: user.id
          });

        if (wsPermError && !wsPermError.message.includes('duplicate')) {
          throw new Error(`Failed to create workspace permission: ${wsPermError.message}`);
        }
        if (!wsPermError) permissionsCreated++;

        // Also create permissions for all documents in the workspace
        const { data: documents } = await supabase
          .from('documents')
          .select('id, name')
          .eq('workspace_id', resourceId);

        if (documents) {
          for (const doc of documents) {
            const { error: docPermError } = await supabase
              .from('document_permissions')
              .insert({
                document_id: doc.id,
                user_id: targetUserId,
                role: role,
                granted_by: user.id
              });

            if (!docPermError) permissionsCreated++;
          }
        }
      }

      resourceNames = [workspace.name];

    } else if (invitationType === 'bulk-documents' && resourceIds) {
      // Bulk document invitation
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, name, user_id')
        .in('id', resourceIds);

      if (docsError || !documents) {
        throw new Error("Documents not found");
      }

      // Check permissions for all documents
      for (const doc of documents) {
        const hasPermission = await checkDocumentPermission(supabase, user.id, doc.id);
        if (!hasPermission) {
          throw new Error(`You don't have permission to invite users to document: ${doc.name}`);
        }
      }

      if (!isNewUser) {
        // Create permissions for all documents
        for (const doc of documents) {
          const { error: permError } = await supabase
            .from('document_permissions')
            .insert({
              document_id: doc.id,
              user_id: targetUserId,
              role: role,
              granted_by: user.id
            });

          if (!permError) permissionsCreated++;
        }
      }

      resourceNames = documents.map(d => d.name);
    }

    // Send email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    let emailSubject: string;
    let emailHtml: string;
    
    if (isNewUser) {
      emailSubject = `Invitation to collaborate via VerJSON`;
      emailHtml = `
        <h1>You've been invited to collaborate!</h1>
        <p>Hello,</p>
        <p>You've been invited to collaborate on ${invitationType === 'workspace' ? 'workspace' : 'document(s)'} via VerJSON:</p>
        <ul>
          ${resourceNames.map(name => `<li><strong>${name}</strong></li>`).join('')}
        </ul>
        <p>You'll have <strong>${role}</strong> access to ${invitationType === 'workspace' ? 'the workspace and all its documents' : 'the selected resources'}.</p>
        <p>To get started:</p>
        <ol>
          <li>Create your free account at <a href="${supabaseUrl.replace('.supabase.co', '.supabase.app')}">VerJSON</a></li>
          <li>Once registered, you'll automatically have access to the shared resources</li>
        </ol>
        <p>VerJSON is a powerful platform for creating and managing JSON Schema and OpenAPI specifications with visual diagrams and collaborative editing.</p>
        <p>Best regards,<br>The VerJSON Team</p>
      `;
    } else {
      emailSubject = `New ${invitationType === 'workspace' ? 'workspace' : 'document'} access via VerJSON`;
      emailHtml = `
        <h1>You've been granted access!</h1>
        <p>Hello ${existingUser.full_name || existingUser.email},</p>
        <p>You now have <strong>${role}</strong> access to the following ${invitationType === 'workspace' ? 'workspace' : 'resource(s)'}:</p>
        <ul>
          ${resourceNames.map(name => `<li><strong>${name}</strong></li>`).join('')}
        </ul>
        ${invitationType === 'workspace' ? '<p>This includes access to all current and future documents in this workspace.</p>' : ''}
        <p>You can access them by logging into your VerJSON account at <a href="${supabaseUrl.replace('.supabase.co', '.supabase.app')}">VerJSON</a>.</p>
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
          : `${permissionsCreated} permission(s) granted and user notified`,
        permissionsCreated
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

// Helper function to check document permission
async function checkDocumentPermission(supabase: any, userId: string, documentId: string): Promise<boolean> {
  // Check if user owns the document
  const { data: document } = await supabase
    .from('documents')
    .select('user_id')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single();

  if (document) return true;

  // Check if user has owner/editor permission on the document
  const { data: permission } = await supabase
    .from('document_permissions')
    .select('role')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .in('role', ['owner', 'editor'])
    .single();

  return !!permission;
}

serve(handler);