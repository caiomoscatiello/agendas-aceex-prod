import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function mondayQuery(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "API-Version": "2023-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

// ─── Defaults de status como objetos JS ─────────────────────────────────────────
// Abordagem correta: armazenar como objeto, serializar e escapar na hora de usar
// Isso evita o problema de double-escape ao interpolar string dentro de template literal
const DEFAULTS_STATUS_ATIVIDADE = {
  done_colors: [2],
  labels: { "0": "Confirmada", "1": "Em andamento", "2": "Feito", "3": "Cancelada" },
  labels_colors: {
    "0": { color: "#0086c0", border: "#0077aa", var_name: "dark-blue" },
    "1": { color: "#fdab3d", border: "#e99729", var_name: "orange" },
    "2": { color: "#00c875", border: "#00b461", var_name: "green-shadow" },
    "3": { color: "#df2f4a", border: "#ce3048", var_name: "red-shadow" },
  },
};
const DEFAULTS_STATUS_DOC = {
  done_colors: [2],
  labels: { "0": "Não exigido", "1": "Pendente", "2": "Entregue" },
  labels_colors: {
    "0": { color: "#c4c4c4", border: "#b0b0b0", var_name: "grey" },
    "1": { color: "#fdab3d", border: "#e99729", var_name: "orange" },
    "2": { color: "#00c875", border: "#00b461", var_name: "green-shadow" },
  },
};

// Serializa o objeto de defaults para string escapada para uso na query GraphQL
function serializeDefaults(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/"/g, '\\"');
}

async function handleCreate(supabase: any, apiKey: string, workspaceId: string, body: any) {
  const { projeto_id, nome_cliente, codigo_cliente, atividades } = body;
  let gruposCriados = 0;
  let itensCriados = 0;

  // PASSO 1 — Criar board
  const boardName = `${codigo_cliente} - ${nome_cliente}`;
  const createBoardRes = await mondayQuery(
    apiKey,
    `mutation ($name: String!, $kind: BoardKind!, $wsId: ID!) {
      create_board(board_name: $name, board_kind: $kind, workspace_id: $wsId) { id url }
    }`,
    { name: boardName, kind: "public", wsId: Number(workspaceId) },
  );
  const board = createBoardRes.data.create_board;
  const boardId = String(board.id);
  const boardUrl = board.url || `https://view.monday.com/board/${boardId}`;

  // PASSO 2 — Criar colunas com labels corretos
  const saDefaults = serializeDefaults(DEFAULTS_STATUS_ATIVIDADE);
  const sdDefaults = serializeDefaults(DEFAULTS_STATUS_DOC);

  const colunas = [
    `create_column(board_id: ${boardId}, title: "Status Atividade", column_type: status, id: "status_atividade", defaults: "${saDefaults}") { id }`,
    `create_column(board_id: ${boardId}, title: "Status Doc",       column_type: status, id: "status_doc",       defaults: "${sdDefaults}") { id }`,
    `create_column(board_id: ${boardId}, title: "Data Inicio",    column_type: date,   id: "data_inicio_item") { id }`,
    `create_column(board_id: ${boardId}, title: "Data Fim",       column_type: date,   id: "data_fim_item")    { id }`,
    `create_column(board_id: ${boardId}, title: "Horas",          column_type: text,   id: "horas_item")       { id }`,
    `create_column(board_id: ${boardId}, title: "Doc Exigido",    column_type: text,   id: "doc_exigido")      { id }`,
    `create_column(board_id: ${boardId}, title: "Codigo Cliente", column_type: text,   id: "codigo_cliente")   { id }`,
    `create_column(board_id: ${boardId}, title: "Item ID App",    column_type: text,   id: "item_id_app")      { id }`,
    `create_column(board_id: ${boardId}, title: "Documento Anexo", column_type: file,  id: "documento_anexo")  { id }`,
  ];

  for (const col of colunas) {
    try {
      const res = await mondayQuery(apiKey, `mutation { ${col} }`);
      console.log("Coluna criada:", JSON.stringify(res?.data));
    } catch (e) {
      console.error("Coluna FALHOU:", col.substring(0, 80), (e as Error).message);
    }
  }

  // PASSO 3 — Criar grupos e itens
  for (const atv of atividades || []) {
    const groupName = `${atv.codigo} - ${atv.descricao}`;
    const createGroupRes = await mondayQuery(
      apiKey,
      `mutation { create_group(board_id: ${boardId}, group_name: "${groupName.replace(/"/g, '\\"')}") { id } }`,
    );
    const groupId = createGroupRes.data.create_group.id;
    gruposCriados++;

    await supabase.from("projeto_atividades").update({ monday_group_id: groupId }).eq("id", atv.id);

    for (const item of atv.cronograma_itens || []) {
      const itemName = `${item.codigo} - ${item.descricao}`;
      const docStatusIndex = item.doc_exigido ? 1 : 0;

      const colValues = JSON.stringify({
        status_atividade: { index: 0 },
        status_doc: { index: docStatusIndex },
        data_inicio_item: item.data_inicio ? { date: item.data_inicio } : undefined,
        data_fim_item: item.data_fim ? { date: item.data_fim } : undefined,
        horas_item: String(item.horas_reservadas || ""),
        doc_exigido: item.doc_exigido ? "Sim" : "Nao",
        codigo_cliente: codigo_cliente || "",
        item_id_app: item.id || "",
      }).replace(/"/g, '\\"');

      const createItemRes = await mondayQuery(
        apiKey,
        `mutation { create_item(board_id: ${boardId}, group_id: "${groupId}", item_name: "${itemName.replace(/"/g, '\\"')}", column_values: "${colValues}") { id } }`,
      );

      const mondayItemId = String(createItemRes.data.create_item.id);
      itensCriados++;

      await supabase.from("cronograma_itens").update({ monday_item_id: mondayItemId }).eq("id", item.id);
    }
  }

  // PASSO 5 — Salvar board no projeto
  await supabase
    .from("projetos")
    .update({
      monday_board_id: boardId,
      monday_board_url: boardUrl,
      monday_status: "criado",
    })
    .eq("id", projeto_id);

  // PASSO 6 — Criar webhook automático para eventos de mudança de coluna
  // A EF monday-webhook-receiver filtra internamente pela coluna documento_anexo
  let webhookId: string | null = null;
  try {
    const webhookRes = await mondayQuery(
      apiKey,
      //`mutation { create_webhook(board_id: ${boardId}, url: "https://mgkpvctvkkfvvornexuq.supabase.co/functions/v1/monday-webhook-receiver", event: change_column_value) { id } }`,
      `mutation { create_webhook(board_id: ${boardId}, url: "${Deno.env.get("SUPABASE_URL")}/functions/v1/monday-webhook-receiver", event: change_column_value) { id } }`,
    );
    webhookId = String(webhookRes.data?.create_webhook?.id || "");
    console.log("Webhook criado:", webhookId);
  } catch (e) {
    console.warn("Webhook não criado (não crítico):", (e as Error).message);
  }

  return {
    success: true,
    board_id: boardId,
    board_url: boardUrl,
    grupos_criados: gruposCriados,
    itens_criados: itensCriados,
    webhook_id: webhookId,
  };
}

// ─── ACTION: SYNC — sincronizar board existente ──────────────────────────────
// Adiciona grupos e itens que ainda não existem no board
// Não remove nem altera o que já existe
async function handleSync(supabase: any, apiKey: string, body: any) {
  const { projeto_id, codigo_cliente, atividades_atuais } = body;

  // Buscar o projeto para obter o board_id
  const { data: projeto, error: projErr } = await supabase
    .from("projetos")
    .select("id, monday_board_id, codigo_cliente, nome_cliente")
    .eq("id", projeto_id)
    .single();

  if (projErr || !projeto?.monday_board_id) {
    throw new Error(`Projeto sem board Monday: ${projErr?.message}`);
  }

  const boardId = String(projeto.monday_board_id);
  let gruposCriados = 0;
  let itensCriados = 0;

  const saDefaults = serializeDefaults(DEFAULTS_STATUS_ATIVIDADE);
  const sdDefaults = serializeDefaults(DEFAULTS_STATUS_DOC);

  for (const atv of atividades_atuais || []) {
    // Verificar se o grupo já existe
    let groupId = atv.monday_group_id;

    if (!groupId) {
      // Criar grupo novo
      const groupName = `${atv.codigo} - ${atv.descricao}`;
      const createGroupRes = await mondayQuery(
        apiKey,
        `mutation { create_group(board_id: ${boardId}, group_name: "${groupName.replace(/"/g, '\\"')}") { id } }`,
      );
      groupId = createGroupRes.data.create_group.id;
      gruposCriados++;

      await supabase.from("projeto_atividades").update({ monday_group_id: groupId }).eq("id", atv.id);
    }

    // Verificar itens de cronograma sem monday_item_id
    // Buscar do banco para garantir dados frescos (payload pode estar desatualizado)
    const { data: itensDB } = await supabase
      .from("cronograma_itens")
      .select("id, codigo, descricao, horas_reservadas, doc_exigido, data_inicio, data_fim, monday_item_id")
      .eq("atividade_id", atv.id);

    for (const item of itensDB || []) {
      if (item.monday_item_id) continue; // já existe no Monday

      const itemName = `${item.codigo} - ${item.descricao}`;
      const docStatusIndex = item.doc_exigido ? 1 : 0;

      const colValues = JSON.stringify({
        status_atividade: { index: 0 },
        status_doc: { index: docStatusIndex },
        data_inicio_item: item.data_inicio ? { date: item.data_inicio } : undefined,
        data_fim_item: item.data_fim ? { date: item.data_fim } : undefined,
        horas_item: String(item.horas_reservadas || ""),
        doc_exigido: item.doc_exigido ? "Sim" : "Nao",
        codigo_cliente: codigo_cliente || "",
        item_id_app: item.id || "",
      }).replace(/"/g, '\\"');

      const createItemRes = await mondayQuery(
        apiKey,
        `mutation { create_item(board_id: ${boardId}, group_id: "${groupId}", item_name: "${itemName.replace(/"/g, '\\"')}", column_values: "${colValues}") { id } }`,
      );

      const mondayItemId = String(createItemRes.data.create_item.id);
      itensCriados++;

      await supabase.from("cronograma_itens").update({ monday_item_id: mondayItemId }).eq("id", item.id);
    }
  }

  return {
    success: true,
    action: "synced",
    board_id: boardId,
    grupos_criados: gruposCriados,
    itens_criados: itensCriados,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["monday_ativo", "monday_api_key", "monday_workspace_id"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    if (settingsMap["monday_ativo"] !== "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "Monday desativado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MONDAY_API_KEY = settingsMap["monday_api_key"]?.trim();
    const MONDAY_WORKSPACE_ID = settingsMap["monday_workspace_id"]?.trim();

    if (!MONDAY_API_KEY || !MONDAY_WORKSPACE_ID) {
      return new Response(JSON.stringify({ success: false, error: "Credenciais Monday não configuradas." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    let result: any;
    if (body.action === "create") {
      result = await handleCreate(supabase, MONDAY_API_KEY, MONDAY_WORKSPACE_ID, body);
    } else if (body.action === "sync") {
      result = await handleSync(supabase, MONDAY_API_KEY, body);
    } else {
      return new Response(JSON.stringify({ error: `Acao desconhecida: ${body.action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("integration_logs").insert({
      codigo: "MONDAY-SYNC-PROJECT",
      status: "success",
      message: `Board criado: ${result.board_id} — ${result.grupos_criados} grupos, ${result.itens_criados} itens`,
      http_status: 200,
      payload: result,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("monday-sync-project error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
