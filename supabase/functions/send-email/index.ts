import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email settings from database
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      throw new Error("Configurações de email não encontradas. Configure o SMTP primeiro.");
    }

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
      throw new Error("Configurações SMTP incompletas.");
    }

    const { to, subject, body, replyTo, isTest } = await req.json();

    if (!to || !subject || !body) {
      throw new Error("Campos obrigatórios: to, subject, body");
    }

    const port = settings.smtp_port || 587;
    const useTls = settings.smtp_security === "SSL/TLS" || port === 465;
    const noStartTLS = settings.smtp_security === "Nenhuma";

    const client = new SMTPClient({
      connection: {
        hostname: settings.smtp_host,
        port,
        tls: useTls,
        auth: {
          username: settings.smtp_user,
          password: settings.smtp_password,
        },
      },
      debug: {
        log: false,
        allowUnsecure: noStartTLS,
        noStartTLS: noStartTLS,
      },
    });

    const fromAddress = settings.sender_name
      ? `${settings.sender_name} <${settings.sender_email}>`
      : settings.sender_email;

    await client.send({
      from: fromAddress,
      to: to,
      subject: subject,
      html: body,
      content: "auto",
      ...(replyTo ? { replyTo } : {}),
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: isTest ? "Email de teste enviado com sucesso!" : "Email enviado com sucesso!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
