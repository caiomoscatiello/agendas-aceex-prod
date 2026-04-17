import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Validar assinatura do Monday (Signing Secret) ────────────────────────────
async function validateSignature(req: Request, body: string): Promise<boolean> {
  const signingSecret = Deno.env.get("MONDAY_SIGNING_SECRET");
  if (!signingSecret) return true; // Se não configurado, aceitar (dev mode)

  const signature = req.headers.get("x-monday-signature");
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = "sha256=" + Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}

// ─── Recalcular status do item no Monday ─────────────────────────────────────
async function recalcularStatusMonday(
  supabase: any,
  mondayItemId: string,
  boardId: string,
  docSatisfeito: boolean,
) {
  const MONDAY_API_KEY = (await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "monday_api_key")
    .single()).data?.value?.trim();

  if (!MONDAY_API_KEY) return;

  // Buscar item de cronograma pelo monday_item_id
  const { data: ci } = await supabase
    .from("cronograma_itens")
    .select("id, codigo, doc_exigido, doc_satisfeito")
    .eq("monday_item_id", mondayItemId)
    .maybeSingle();

  if (!ci) {
    console.warn("Item de cronograma não encontrado para monday_item_id:", mondayItemId);
    return;
  }

  // Atualizar Status Doc no Monday
  const docStatusIndex = docSatisfeito ? 2 : (ci.doc_exigido ? 1 : 0);
  // 0=Não exigido, 1=Pendente, 2=Entregue

  // Buscar agendas do item para calcular status atividade
  const { data: agendas } = await supabase
    .from("agendas")
    .select("status")
    .ilike("item_cronograma", `%${ci.codigo}%`)
    .not("status", "in", `("REJEITADA")`);

  const total     = (agendas || []).length;
  const canceladas = (agendas || []).filter((a: any) =>
    ["cancelada","aguardando_cancelamento"].includes(a.status?.toLowerCase())).length;
  const apontadas  = (agendas || []).filter((a: any) =>
    ["apontamento_ok","apontamento_ajustado","realizada"].includes(a.status?.toLowerCase())).length;

  let statusAtivIndex = 0; // Confirmada
  if (total > 0 && canceladas === total) {
    statusAtivIndex = 3; // Cancelada
  } else if (apontadas > 0 && apontadas === total - canceladas) {
    const docOk = !ci.doc_exigido || docSatisfeito;
    statusAtivIndex = docOk ? 2 : 1; // Feito ou Em andamento
  } else if (apontadas > 0) {
    statusAtivIndex = 1; // Em andamento
  }

  // Atualizar Status Doc e Status Atividade no Monday
  const colValues = JSON.stringify({
    status_doc:       { index: docStatusIndex },
    status_atividade: { index: statusAtivIndex },
  }).replace(/"/g, '\\"');

  await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MONDAY_API_KEY}`,
      "API-Version": "2023-10",
    },
    body: JSON.stringify({
      query: `mutation { change_multiple_column_values(board_id: ${boardId}, item_id: ${mondayItemId}, column_values: "${colValues}") { id } }`,
    }),
  });
}

// ─── Espelhar arquivo do Monday para o SharePoint ────────────────────────────
async function espelharNoSharePoint(
  supabase: any,
  assetId: number,
  fileName: string,
  mondayApiKey: string,
  cronogramaItemId: string,
  codigoItem: string,
  descricaoItem: string,
) {
  try {
    // Buscar configurações SharePoint
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["sharepoint_ativo", "sharepoint_tenant_id", "sharepoint_client_id", "sharepoint_client_secret", "sharepoint_site_url"]);

    const s: Record<string, string> = {};
    (settings || []).forEach((r: any) => { s[r.key] = r.value; });

    if (s.sharepoint_ativo !== "true") {
      console.log("SharePoint desativado — não espelhando");
      return null;
    }

    // Buscar projeto para obter codigo_cliente e nome_cliente
    const { data: ci } = await supabase
      .from("cronograma_itens")
      .select("atividade_id")
      .eq("id", cronogramaItemId)
      .maybeSingle();

    const { data: atv } = await supabase
      .from("projeto_atividades")
      .select("projeto_id")
      .eq("id", ci?.atividade_id)
      .maybeSingle();

    const { data: proj } = await supabase
      .from("projetos")
      .select("codigo_cliente, nome_cliente")
      .eq("id", atv?.projeto_id)
      .maybeSingle();

    if (!proj) {
      console.warn("Projeto não encontrado para espelhamento SharePoint");
      return null;
    }

    // 1. Obter URL pública do asset via Monday API
    const assetRes = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mondayApiKey}`,
        "API-Version": "2023-10",
      },
      body: JSON.stringify({ query: `{ assets(ids: [${assetId}]) { id name public_url } }` }),
    });
    const assetData = await assetRes.json();
    const publicUrl = assetData?.data?.assets?.[0]?.public_url;

    if (!publicUrl) {
      console.warn("URL pública do asset não encontrada");
      return null;
    }

    // 2. Baixar o arquivo do S3
    const fileRes = await fetch(publicUrl);
    if (!fileRes.ok) {
      console.warn("Erro ao baixar arquivo do Monday S3:", fileRes.status);
      return null;
    }
    const fileBuffer = await fileRes.arrayBuffer();

    // 3. Chamar EF sharepoint-upload via invoke interno
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append("file", new File([blob], fileName));
    formData.append("cronograma_item_id", cronogramaItemId);
    formData.append("codigo_cliente", proj.codigo_cliente || "");
    formData.append("nome_cliente", proj.nome_cliente || "");
    formData.append("codigo_item", codigoItem);
    formData.append("descricao_item", descricaoItem);

    const uploadRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/sharepoint-upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: formData,
      },
    );
    const uploadData = await uploadRes.json();

    if (uploadData?.success) {
      console.log("Arquivo espelhado no SharePoint:", uploadData.file_url);
      return uploadData.file_url;
    } else {
      console.warn("Erro no upload SharePoint:", JSON.stringify(uploadData));
      return null;
    }
  } catch (err: any) {
    console.error("Erro ao espelhar no SharePoint:", err.message);
    return null;
  }
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const bodyText = await req.text();

    // Validar assinatura Monday
    const isValid = await validateSignature(req, bodyText);
    if (!isValid) {
      console.error("Assinatura Monday inválida");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = JSON.parse(bodyText);
    console.log("monday-webhook-receiver payload:", JSON.stringify(body));

    // Monday envia challenge na criação do webhook — responder de volta
    if (body.challenge) {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = body.event;
    if (!event) {
      return new Response(JSON.stringify({ skipped: true, reason: "no event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtrar apenas eventos da coluna documento_anexo
    const columnId = event.columnId || event.column_id;
    if (columnId !== "documento_anexo") {
      console.log("Coluna ignorada:", columnId);
      return new Response(JSON.stringify({ skipped: true, reason: `column ${columnId} ignored` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mondayItemId = String(event.pulseId || event.itemId || event.item_id || "");
    const boardId      = String(event.boardId || event.board_id || "");

    if (!mondayItemId) {
      return new Response(JSON.stringify({ skipped: true, reason: "no item_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se arquivo foi anexado ou removido
    // value.files é array vazio quando removido, array com itens quando anexado
    const value = event.value;
    const previousValue = event.previousValue;

    let docSatisfeito: boolean;
    try {
      const valObj = typeof value === "string" ? JSON.parse(value) : value;
      const files = valObj?.files || valObj?.file || [];
      docSatisfeito = Array.isArray(files) ? files.length > 0 : !!files;
    } catch {
      docSatisfeito = !!value;
    }

    console.log(`Item ${mondayItemId} — documento_anexo — docSatisfeito: ${docSatisfeito}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar item de cronograma pelo monday_item_id
    const { data: ci } = await supabase
      .from("cronograma_itens")
      .select("id, codigo, descricao, doc_exigido")
      .eq("monday_item_id", mondayItemId)
      .maybeSingle();

    if (!ci) {
      console.warn("Nenhum cronograma_item encontrado para:", mondayItemId);
      return new Response(JSON.stringify({ skipped: true, reason: "item not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar doc_satisfeito no banco
    await supabase
      .from("cronograma_itens")
      .update({
        doc_satisfeito:    docSatisfeito,
        doc_satisfeito_em: docSatisfeito ? new Date().toISOString() : null,
      })
      .eq("id", ci.id);

    // Espelhar arquivo no SharePoint se doc entregue via Monday
    let sharePointUrl: string | null = null;
    if (docSatisfeito) {
      const MONDAY_API_KEY = (await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "monday_api_key")
        .single()).data?.value?.trim();

      // Extrair assetId e fileName do evento
      const eventFiles = (() => {
        try {
          const valObj = typeof event.value === "string" ? JSON.parse(event.value) : event.value;
          return valObj?.files || [];
        } catch { return []; }
      })();

      if (MONDAY_API_KEY && eventFiles.length > 0) {
        const asset = eventFiles[0];
        sharePointUrl = await espelharNoSharePoint(
          supabase,
          asset.assetId,
          asset.name,
          MONDAY_API_KEY,
          ci.id,
          ci.codigo,
          ci.descricao || ci.codigo,
        );

        if (sharePointUrl) {
          await supabase
            .from("cronograma_itens")
            .update({ doc_referencia: sharePointUrl })
            .eq("id", ci.id);
        }
      }

      // Liberar agendas com status doc_pendente → apontamento_ok
      const { data: agendasPendentes } = await supabase
        .from("agendas")
        .select("id")
        .ilike("item_cronograma", `%${ci.codigo}%`)
        .eq("status", "doc_pendente");

      if (agendasPendentes && agendasPendentes.length > 0) {
        for (const ag of agendasPendentes) {
          await supabase
            .from("agendas")
            .update({ status: "apontamento_ok" })
            .eq("id", ag.id);

          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/monday-agenda-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({ action: "update", agenda_id: ag.id }),
          }).catch(() => {});
        }
        console.log(`${agendasPendentes.length} agenda(s) doc_pendente liberadas`);
      }
    }

    // Recalcular status no Monday
    await recalcularStatusMonday(supabase, mondayItemId, boardId, docSatisfeito);

    // Registrar no integration_logs para rastreabilidade
    await supabase.from("integration_logs").insert({
      codigo:      "MONDAY-WEBHOOK",
      status:      "success",
      message:     `Documento ${docSatisfeito ? "entregue" : "removido"} — item ${mondayItemId} (${ci.codigo})${sharePointUrl ? " — espelhado no SharePoint" : ""}`,
      http_status: 200,
      payload: {
        monday_item_id:         mondayItemId,
        board_id:               boardId,
        column_id:              columnId,
        doc_satisfeito:         docSatisfeito,
        cronograma_item_id:     ci.id,
        cronograma_item_codigo: ci.codigo,
        sharepoint_url:         sharePointUrl,
        event_value:            event.value,
      },
    });

    return new Response(
      JSON.stringify({ success: true, item_id: ci.id, doc_satisfeito: docSatisfeito }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("monday-webhook-receiver error:", err);
    // Tentar registrar o erro no log
    try {
      const supabaseErr = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabaseErr.from("integration_logs").insert({
        codigo:      "MONDAY-WEBHOOK",
        status:      "error",
        message:     err.message,
        http_status: 500,
        payload:     { error: err.message },
      });
    } catch {}
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});