import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const resendApiKeyRaw = Deno.env.get("RESEND_API_KEY");
    const RESEND_API_KEY = resendApiKeyRaw
      ?.trim()
      .replace(/^Bearer\s+/i, "")
      .replace(/^['\"]|['\"]$/g, "");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    if (!RESEND_API_KEY.startsWith("re_")) {
      throw new Error("RESEND_API_KEY format is invalid (expected prefix re_)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      cliente,
      data,
      atividades,
      modalidade,
      descricao,
      deslocamento,
      total_horas,
      projeto_id,
    } = await req.json();

    if (!projeto_id) {
      throw new Error("projeto_id is required");
    }

    // Get project details (coordinator email, contact email)
    const { data: projeto, error: projError } = await supabase
      .from("projetos")
      .select("coordenador_id, email_contato, contato_nome")
      .eq("id", projeto_id)
      .single();

    if (projError || !projeto) {
      throw new Error("Projeto não encontrado");
    }

    // Get coordinator email from profiles
    let coordenadorEmail: string | null = null;
    if (projeto.coordenador_id) {
      const { data: coordProfile } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("user_id", projeto.coordenador_id)
        .single();
      coordenadorEmail = coordProfile?.email || null;
    }

    const emailContato = projeto.email_contato;

    const allRecipients: string[] = [];
    if (coordenadorEmail) allRecipients.push(coordenadorEmail);
    if (emailContato) allRecipients.push(emailContato);

    if (allRecipients.length === 0) {
      throw new Error("Nenhum destinatário encontrado (coordenador ou contato do projeto)");
    }

    // TEMPORARY TEST MODE: Resend sandbox only allows sending to the account owner email.
    // Replace the line below with your Resend account email to test.
    const TEST_MODE = true;
    const TEST_EMAIL = "delivered@resend.dev"; // Change to your Resend account email
    const recipients = TEST_MODE ? [TEST_EMAIL] : allRecipients;
    console.log(`[send-os-email] TEST_MODE=${TEST_MODE}, sending to: ${recipients.join(", ")} (original: ${allRecipients.join(", ")})`);

    // Build activity rows HTML
    const atividadeRows = (atividades as any[])
      .map(
        (a: any) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${a.atividade_codigo} - ${a.atividade_descricao}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${a.horas}h</td></tr>`
      )
      .join("");

    const deslocamentoRow =
      deslocamento > 0
        ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-style:italic">Deslocamento</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${deslocamento}h</td></tr>`
        : "";

    const dataFormatted = data
      ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`
      : data;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#333">Ordem de Serviço</h2>
        <p><strong>Cliente:</strong> ${cliente}</p>
        <p><strong>Data:</strong> ${dataFormatted}</p>
        <p><strong>Modalidade:</strong> ${modalidade}</p>
        
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd">Atividade</th>
              <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd">Horas</th>
            </tr>
          </thead>
          <tbody>
            ${atividadeRows}
            ${deslocamentoRow}
            <tr style="font-weight:bold;background:#f9f9f9">
              <td style="padding:8px">Total</td>
              <td style="padding:8px;text-align:right">${total_horas}h</td>
            </tr>
          </tbody>
        </table>
        
        ${descricao ? `<p><strong>Descrição:</strong></p><p style="color:#555;white-space:pre-wrap">${descricao}</p>` : ""}
      </div>
    `;

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "OS Aceex <onboarding@resend.dev>",
        to: recipients,
        subject: `OS - ${cliente} - ${dataFormatted}`,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      throw new Error(`Erro ao enviar email: ${JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({ success: true, data: resendData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending OS email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
