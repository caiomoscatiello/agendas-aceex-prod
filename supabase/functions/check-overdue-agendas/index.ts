import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get SMTP settings
    const { data: smtpSettings, error: smtpErr } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (smtpErr || !smtpSettings?.smtp_host || !smtpSettings?.smtp_user || !smtpSettings?.smtp_password) {
      throw new Error("Configurações SMTP não encontradas ou incompletas.");
    }

    // 2. Get "regras_data_limite_apontamento" from app_settings
    const { data: limiteSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "regras_data_limite_apontamento")
      .single();

    const diasLimite = limiteSetting?.value || "5";

    // 3. Get all consultor user IDs
    const { data: consultorRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "consultor");

    if (rolesErr) throw rolesErr;
    if (!consultorRoles || consultorRoles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum consultor encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consultorIds = consultorRoles.map((r) => r.user_id);

    // 4. Get profiles for these consultors
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, name, email")
      .in("user_id", consultorIds);

    if (profErr) throw profErr;

    // 5. Determine current month range and today
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const today = `${year}-${String(month + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // 6. Fetch overdue agendas for all consultors in one query
    const { data: overdueAgendas, error: agErr } = await supabase
      .from("agendas")
      .select("id, usuario, email, cliente, data, atividade, status, user_id")
      .in("user_id", consultorIds)
      .in("status", ["pendente", "confirmada"])
      .gte("data", monthStart)
      .lte("data", today);

    if (agErr) throw agErr;
    if (!overdueAgendas || overdueAgendas.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhuma agenda atrasada encontrada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Group agendas by user_id
    const agendasByUser = new Map<string, typeof overdueAgendas>();
    for (const agenda of overdueAgendas) {
      const list = agendasByUser.get(agenda.user_id) || [];
      list.push(agenda);
      agendasByUser.set(agenda.user_id, list);
    }

    // 8. Create SMTP client
    const port = smtpSettings.smtp_port || 587;
    const useTls = smtpSettings.smtp_security === "SSL/TLS" || port === 465;
    const noStartTLS = smtpSettings.smtp_security === "Nenhuma";

    const client = new SMTPClient({
      connection: {
        hostname: smtpSettings.smtp_host,
        port,
        tls: useTls,
        auth: {
          username: smtpSettings.smtp_user,
          password: smtpSettings.smtp_password,
        },
      },
      debug: { log: false, allowUnsecure: noStartTLS, noStartTLS },
    });

    const fromAddress = smtpSettings.sender_name
      ? `${smtpSettings.sender_name} <${smtpSettings.sender_email}>`
      : smtpSettings.sender_email;

    let emailsSent = 0;

    // 9. Send email to each user with overdue agendas
    for (const [userId, agendas] of agendasByUser) {
      const profile = (profiles || []).find((p) => p.user_id === userId);
      if (!profile?.email) continue;

      // Build agenda list table
      const rows = agendas
        .map(
          (a) =>
            `<tr>
              <td style="padding:6px 12px;border:1px solid #ddd;">${formatDate(a.data)}</td>
              <td style="padding:6px 12px;border:1px solid #ddd;">${a.cliente}</td>
              <td style="padding:6px 12px;border:1px solid #ddd;">${a.atividade}</td>
            </tr>`
        )
        .join("");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <p>Olá <strong>${profile.name || "Consultor"}</strong>,</p>
          <p>Notamos que os seguintes apontamentos estão em atraso. Favor realizar o devido apontamento do atendimento ou solicite o cancelamento da agenda.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Data</th>
                <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Cliente</th>
                <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Atividade</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p>Dentro de <strong>${diasLimite} dias</strong>, o apontamento será automaticamente excluído por falta.</p>
          <br/>
          <p>Obrigado,</p>
          <p><strong>Coordenação de Projetos Aceex</strong></p>
        </div>
      `;

      try {
        await client.send({
          from: fromAddress,
          to: profile.email,
          subject: "Apontamentos Atrasados",
          html,
          content: "auto",
        });
        emailsSent++;
        console.log(`[check-overdue-agendas] Email sent to ${profile.email} (${agendas.length} agendas)`);
      } catch (sendErr) {
        console.error(`[check-overdue-agendas] Failed to send to ${profile.email}:`, sendErr);
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({ success: true, emailsSent, usersChecked: agendasByUser.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-overdue-agendas] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
