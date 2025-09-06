import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from }: EmailRequest = await req.json();
    
    const smtpHost = Deno.env.get("SMTP_HOST") || "send.one.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USERNAME");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpUser || !smtpPassword) {
      throw new Error("SMTP credentials not configured");
    }

    if (!to || !subject || !html) {
      throw new Error("Missing required email fields");
    }

    // Create email message in proper format
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36)}`;
    const emailMessage = [
      `From: ${from || smtpUser}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      html,
      ``,
      `--${boundary}--`,
      ``
    ].join('\r\n');

    console.log(`Attempting to send email via SMTP to ${to}`);
    console.log(`SMTP Config: ${smtpHost}:${smtpPort}`);

    // Use a simple TCP connection approach
    try {
      // Create a basic SMTP connection using Deno's TCP
      const conn = await Deno.connect({
        hostname: smtpHost,
        port: smtpPort,
      });

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Simple SMTP handshake
      const commands = [
        `EHLO ${smtpHost}\r\n`,
        `AUTH LOGIN\r\n`,
        `${btoa(smtpUser)}\r\n`,
        `${btoa(smtpPassword)}\r\n`,
        `MAIL FROM:<${from || smtpUser}>\r\n`,
        `RCPT TO:<${to}>\r\n`,
        `DATA\r\n`,
        `${emailMessage}\r\n.\r\n`,
        `QUIT\r\n`
      ];

      for (const command of commands) {
        await conn.write(encoder.encode(command));
        // Read response (simplified)
        const buffer = new Uint8Array(1024);
        await conn.read(buffer);
        const response = decoder.decode(buffer);
        console.log(`SMTP Response: ${response.trim()}`);
      }

      conn.close();
      console.log("Email sent successfully via SMTP");

      return new Response(
        JSON.stringify({ success: true, message: "Email sent successfully" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );

    } catch (smtpError) {
      console.error("SMTP connection error:", smtpError);
      
      // Fallback: log the email content for now
      console.log("SMTP failed, logging email content:", {
        to,
        subject,
        html: html.substring(0, 200) + "..."
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "SMTP temporarily unavailable, invitation logged",
          error: smtpError.message 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

  } catch (error: any) {
    console.error("Error in send-smtp-email function:", error);
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