import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function logIntegration(
  adminClient: ReturnType<typeof createClient>,
  codigo: string | null,
  payload: unknown,
  status: string,
  message: string,
  httpStatus: number
) {
  try {
    await adminClient.from("integration_logs").insert({
      codigo,
      payload,
      status,
      message,
      http_status: httpStatus,
    });
  } catch (e) {
    console.error("Failed to write integration log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  let body: any = null;

  try {
    // 1. Validate API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      const msg = "API key ausente";
      await logIntegration(adminClient, null, null, "error", msg, 401);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check API key against protheus_integracoes table (0001 = Integ. User)
    const { data: integRow } = await adminClient
      .from("protheus_integracoes")
      .select("api_key, ativo")
      .eq("codigo", "0001")
      .single();

    if (!integRow || integRow.api_key !== apiKey || !integRow.ativo) {
      const msg = "API key inválida";
      await logIntegration(adminClient, null, null, "error", msg, 401);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    body = await req.json();
    const { codigo, nome, email, cargo } = body;

    if (!codigo || !nome || !email || !cargo) {
      const msg = "Campos obrigatórios: codigo, nome, email, cargo";
      await logIntegration(adminClient, codigo || null, body, "error", msg, 400);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Role mapping
    let assignRole: string;
    let tipo: string;
    if (cargo === "C") {
      assignRole = "coordenador";
      tipo = "Coordenador";
    } else if (cargo === "A" || cargo === "T") {
      assignRole = "consultor";
      tipo = "Consultor";
    } else {
      const msg = "Cargo inválido";
      await logIntegration(adminClient, codigo, body, "error", msg, 422);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Check duplicate by codigo or email
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();

    if (existingProfile) {
      const msg = "Usuário já cadastrado";
      await logIntegration(adminClient, codigo, body, "error", msg, 409);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingEmail } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingEmail) {
      const msg = "Usuário já cadastrado";
      await logIntegration(adminClient, codigo, body, "error", msg, 409);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Generate password
    const firstLetter = nome.trim().charAt(0).toUpperCase();
    const password = `${firstLetter}@12345`;

    // 6. Create user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: nome },
    });

    if (createError) {
      const msg = createError.message;
      await logIntegration(adminClient, codigo, body, "error", msg, 400);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Set role
    await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role: assignRole,
    });

    // 8. Update profile with codigo
    await adminClient.from("profiles").update({ codigo }).eq("user_id", newUser.user.id);

    // 9. Send welcome email (best effort)
    try {
      console.log("[protheus-users] Attempting to send welcome email to:", email);
      const { data: settings, error: settingsErr } = await adminClient
        .from("email_settings")
        .select("*")
        .limit(1)
        .single();

      if (settingsErr) {
        console.error("[protheus-users] Failed to load email settings:", settingsErr.message);
      } else if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_password) {
        console.warn("[protheus-users] SMTP settings incomplete, skipping email. Host:", settings?.smtp_host, "User:", settings?.smtp_user);
      } else {
        const port = settings.smtp_port || 587;
        const useTls = settings.smtp_security === "SSL/TLS" || port === 465;
        const noStartTLS = settings.smtp_security === "Nenhuma";

        console.log("[protheus-users] SMTP config - Host:", settings.smtp_host, "Port:", port, "TLS:", useTls, "NoStartTLS:", noStartTLS);

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
          debug: { log: false, allowUnsecure: noStartTLS, noStartTLS },
        });

        const fromAddress = settings.sender_name
          ? `${settings.sender_name} <${settings.sender_email}>`
          : settings.sender_email;

        // Try to get the app URL from app_settings, fallback to origin header
        let appUrl = req.headers.get("origin") || "";
        try {
          const { data: appUrlSetting } = await adminClient
            .from("app_settings")
            .select("value")
            .eq("key", "app_url")
            .maybeSingle();
          if (appUrlSetting?.value) {
            appUrl = appUrlSetting.value;
          }
        } catch (_) { /* ignore */ }
        if (!appUrl) {
          appUrl = "https://agendas-aceex.lovable.app";
        }

        console.log("[protheus-users] Sending email from:", fromAddress, "to:", email);

        await client.send({
          from: fromAddress,
          to: email,
          subject: "Novo usuario Aceex",
          content: "auto",
          html: `<div style="font-family:Arial,sans-serif;padding:20px">
            <p>Ola, foi criado um novo usuario para voce.</p>
            <p>Os dados para acesso são: <a href="${appUrl}">${appUrl}</a></p>
            <p>Seu usuario e senha são: <strong>${codigo}</strong> - <strong>${password}</strong></p>
          </div>`,
        });

        await client.close();
        console.log("[protheus-users] Welcome email sent successfully to:", email);
      }
    } catch (emailErr: any) {
      console.error("[protheus-users] Email send failed (user still created):", emailErr?.message || emailErr);
    }

    // 10. Log success
    const successMsg = "Usuário criado com sucesso";
    await logIntegration(adminClient, codigo, body, "success", successMsg, 201);

    return new Response(
      JSON.stringify({
        success: true,
        message: successMsg,
        user: { codigo, nome, email, tipo },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const msg = err?.message || "Erro interno";
    await logIntegration(adminClient, body?.codigo || null, body, "error", msg, 500);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
