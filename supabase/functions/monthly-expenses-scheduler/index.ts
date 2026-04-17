import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { buildExpenseEmailHtml, buildZipFileName } from "../_shared/buildExpenseEmailHtml.ts";
import { assertPureHtml5 } from "../_shared/emailHtmlSanitizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if force mode (manual trigger bypasses day check)
  let forceRun = false;
  try {
    const body = await req.json();
    forceRun = body?.force === true;
  } catch {
    // No body or invalid JSON — normal cron call
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logs: Array<{ usuario: string; despesas: number; status: string; erro?: string }> = [];
  const now = new Date();
  const hoje = now.toISOString().split("T")[0];
  const mesAtual = MESES_PT[now.getMonth()];
  const dataFormatada = formatDate(hoje);

  try {
    // 1. Check if today is the closing day
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["despesas_data_fechamento", "despesas_email_responsavel"]);

    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows || []) {
      settingsMap[row.key] = row.value;
    }

    const fechamentoValue = settingsMap["despesas_data_fechamento"];

    if (!forceRun) {
      if (!fechamentoValue) {
        console.log("despesa_data_fechamento não configurado. Encerrando.");
        return new Response(JSON.stringify({ success: true, message: "Sem data de fechamento configurada" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract day from the setting (could be a date string or just a number)
      let diaFechamento: number;
      if (fechamentoValue.includes("-")) {
        diaFechamento = new Date(fechamentoValue + "T00:00:00").getDate();
      } else {
        diaFechamento = parseInt(fechamentoValue, 10);
      }

      if (now.getDate() !== diaFechamento) {
        console.log(`Hoje é dia ${now.getDate()}, fechamento é dia ${diaFechamento}. Encerrando.`);
        return new Response(JSON.stringify({ success: true, message: "Não é dia de fechamento" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const emailResponsavel = settingsMap["despesas_email_responsavel"];
    if (!emailResponsavel) {
      throw new Error("despesas_email_responsavel não configurado em app_settings");
    }

    // Get email SMTP settings
    const { data: emailSettings, error: emailErr } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (emailErr || !emailSettings) {
      throw new Error("Configurações de email SMTP não encontradas.");
    }

    // 2. Get all users (profiles)
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id, name, email");

    if (profilesErr) throw new Error("Erro ao buscar perfis: " + profilesErr.message);
    if (!profiles || profiles.length === 0) {
      console.log("Nenhum perfil encontrado.");
      return new Response(JSON.stringify({ success: true, message: "Sem usuários" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Process each user
    for (const profile of profiles) {
      try {
        // Get approved apontamento_atividades for this user (to find approved agendas)
        const { data: agendas } = await supabase
          .from("agendas")
          .select("id, cliente")
          .eq("user_id", profile.user_id)
          .in("status", ["confirmada", "aprovado"]);

        if (!agendas || agendas.length === 0) {
          continue; // no approved agendas
        }

        const agendaIds = agendas.map((a) => a.id);

        // We need despesas for this user that haven't been sent yet
        // Despesas don't have agenda_id directly - they have user_id and cliente
        // Let's get despesas for this user where envio_financeiro is null or not 'OK'
        const { data: despesas, error: despErr } = await supabase
          .from("despesas")
          .select("*")
          .eq("user_id", profile.user_id)
          .or("envio_financeiro.is.null,envio_financeiro.neq.OK");

        if (despErr) {
          logs.push({ usuario: profile.name, despesas: 0, status: "erro", erro: despErr.message });
          continue;
        }

        if (!despesas || despesas.length === 0) {
          continue; // no pending expenses
        }

        // Filter despesas that have approved agendas for that client
        const approvedClients = new Set(agendas.map((a) => a.cliente));
        const validDespesas = despesas.filter((d) => approvedClients.has(d.cliente));

        if (validDespesas.length === 0) {
          continue;
        }

        // Group by client
        const byClient: Record<string, typeof validDespesas> = {};
        for (const d of validDespesas) {
          if (!byClient[d.cliente]) byClient[d.cliente] = [];
          byClient[d.cliente].push(d);
        }

        // Sort each group by date ascending
        for (const key of Object.keys(byClient)) {
          byClient[key].sort((a, b) => a.data_despesa.localeCompare(b.data_despesa));
        }

        // Build HTML email using shared template
        const htmlBody = buildExpenseEmailHtml({
          nomeUsuario: profile.name,
          emailResponsavel: emailResponsavel,
          emailUsuario: profile.email,
          dataFechamento: new Date().toISOString(),
          despesas: validDespesas.map(d => ({
            data: d.data_despesa,
            cliente: d.cliente,
            descricao: d.descricao,
            valor: Number(d.valor),
          })),
        });

        assertPureHtml5(htmlBody);

        // Build ZIP attachments per client
        const attachments: Array<{ filename: string; content: Uint8Array; contentType: string }> = [];

        for (const [cliente, items] of Object.entries(byClient)) {
          const filesWithUrls = items.filter((d) => d.foto_url);
          if (filesWithUrls.length === 0) continue;

          const zip = new JSZip();

          for (const d of filesWithUrls) {
            try {
              // foto_url may be a full public URL or a relative path — extract relative path
              let storagePath = d.foto_url;
              const bucketPrefix = "/storage/v1/object/public/despesas-fotos/";
              const idx = storagePath.indexOf(bucketPrefix);
              if (idx !== -1) {
                storagePath = decodeURIComponent(storagePath.substring(idx + bucketPrefix.length));
              }

              const { data: fileData, error: dlErr } = await supabase.storage
                .from("despesas-fotos")
                .download(storagePath);

              if (dlErr || !fileData) {
                console.error(`Erro ao baixar arquivo ${d.foto_url}:`, dlErr);
                continue;
              }

              const arrayBuffer = await fileData.arrayBuffer();
              const fileName = d.foto_url.split("/").pop() || `comprovante_${d.id}`;
              zip.file(fileName, new Uint8Array(arrayBuffer));
            } catch (e) {
              console.error(`Erro ao processar arquivo ${d.foto_url}:`, e);
            }
          }

          const zipContent = await zip.generateAsync({ type: "uint8array" });
          const zipFileName = buildZipFileName(cliente, profile.name, new Date().toISOString());
          attachments.push({
            filename: zipFileName,
            content: zipContent,
            contentType: "application/zip",
          });
        }

        // Send email via SMTP
        const port = emailSettings.smtp_port || 587;
        const useTls = emailSettings.smtp_security === "SSL/TLS" || port === 465;
        const noStartTLS = emailSettings.smtp_security === "Nenhuma";

        const smtpClient = new SMTPClient({
          connection: {
            hostname: emailSettings.smtp_host,
            port,
            tls: useTls,
            auth: {
              username: emailSettings.smtp_user,
              password: emailSettings.smtp_password,
            },
          },
          debug: { log: false, allowUnsecure: noStartTLS, noStartTLS },
        });

        const fromAddress = emailSettings.sender_name
          ? `${emailSettings.sender_name} <${emailSettings.sender_email}>`
          : emailSettings.sender_email;

        const emailPayload: Record<string, unknown> = {
          from: fromAddress,
          to: emailResponsavel,
          cc: profile.email,
          subject: `Despesas ${mesAtual} ${profile.name}`,
          html: String(htmlBody),
          content: "auto",
        };

        // Add attachments if any
        if (attachments.length > 0) {
          emailPayload.attachments = attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            encoding: "binary",
            contentType: a.contentType,
          }));
        }

        await smtpClient.send(emailPayload as any);
        await smtpClient.close();

        // Update despesas as sent
        const despesaIds = validDespesas.map((d) => d.id);
        const { error: updateErr } = await supabase
          .from("despesas")
          .update({ envio_financeiro: "OK", data_envio_fin: hoje })
          .in("id", despesaIds);

        if (updateErr) {
          console.error(`Erro ao atualizar despesas do usuário ${profile.name}:`, updateErr);
          logs.push({ usuario: profile.name, despesas: validDespesas.length, status: "erro_update", erro: updateErr.message });
        } else {
          logs.push({ usuario: profile.name, despesas: validDespesas.length, status: "sucesso" });
        }

        console.log(`✅ Email enviado para ${profile.name} com ${validDespesas.length} despesas`);
      } catch (userErr) {
        const msg = userErr instanceof Error ? userErr.message : "Erro desconhecido";
        console.error(`❌ Erro processando usuário ${profile.name}:`, msg);
        logs.push({ usuario: profile.name, despesas: 0, status: "erro", erro: msg });
      }
    }

    console.log("Execução finalizada. Logs:", JSON.stringify(logs));

    return new Response(JSON.stringify({ success: true, logs }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro geral no scheduler:", msg);
    return new Response(JSON.stringify({ success: false, error: msg, logs }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
