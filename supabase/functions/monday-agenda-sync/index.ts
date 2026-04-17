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

async function getMondaySettings(supabase: any) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["monday_ativo", "monday_api_key"]);
  if (error) throw new Error(`Erro settings: ${error.message}`);
  const s: Record<string, string> = {};
  for (const row of data || []) s[row.key] = row.value;
  return s;
}

// ─── Buscar dados completos da agenda e do item pai ───────────────────────────
async function getAgendaInfo(supabase: any, agendaId: string) {
  const { data: agenda, error: agErr } = await supabase
    .from("agendas")
    .select(
      "id, cliente, atividade, data, usuario, email, status, item_cronograma, monday_item_id, codigo_cliente, codigo_atividade",
    )
    .eq("id", agendaId)
    .maybeSingle();

  if (agErr) throw new Error(`Erro ao buscar agenda: ${agErr?.message}`);
  if (!agenda) {
    console.warn(`Agenda ${agendaId} não encontrada — já foi deletada, ignorando sync Monday`);
    return null;
  }

  // Buscar projeto pelo codigo_cliente
  const { data: projeto, error: projErr } = await supabase
    .from("projetos")
    .select("id, monday_board_id")
    .eq("codigo_cliente", agenda.codigo_cliente || agenda.cliente)
    .single();

  if (projErr || !projeto) throw new Error(`Projeto não encontrado: ${agenda.codigo_cliente || agenda.cliente}`);
  if (!projeto.monday_board_id) throw new Error(`Projeto sem board Monday`);

  // Extrair código da atividade (pode vir como "WDM003 - Descrição")
  const codigoAtividade = agenda.codigo_atividade || (agenda.atividade || "").split(" - ")[0].trim();

  // Buscar atividade para obter o grupo
  const { data: atividade, error: atvErr } = await supabase
    .from("projeto_atividades")
    .select("id, codigo, monday_group_id")
    .eq("projeto_id", projeto.id)
    .eq("codigo", codigoAtividade)
    .single();

  if (atvErr || !atividade) throw new Error(`Atividade não encontrada: ${codigoAtividade}`);

  // Buscar item de cronograma para obter o monday_item_id (item pai do subitem)
  let cronogramaItem: any = null;
  if (agenda.item_cronograma) {
    const codigoItem = agenda.item_cronograma.split(" - ")[0].trim();
    const { data: ci } = await supabase
      .from("cronograma_itens")
      .select("id, codigo, descricao, monday_item_id, doc_exigido, doc_satisfeito")
      .eq("atividade_id", atividade.id)
      .eq("codigo", codigoItem)
      .maybeSingle();
    cronogramaItem = ci;
  }
  /*
  // Se não encontrou pelo campo item_cronograma, pega o primeiro item da atividade
  if (!cronogramaItem) {
    const { data: ci } = await supabase
      .from("cronograma_itens")
      .select("id, codigo, descricao, monday_item_id, doc_exigido, doc_satisfeito")
      .eq("atividade_id", atividade.id)
      .limit(1)
      .maybeSingle();
    cronogramaItem = ci;
  }

  if (!cronogramaItem?.monday_item_id) throw new Error(`Item de cronograma sem monday_item_id — recrie o board`);
*/

  // Agenda sem item de cronograma = margem gerencial da atividade
  // Não integra com Monday — retorna null silenciosamente
  if (!cronogramaItem) {
    console.log(`Agenda sem item de cronograma — sem sync Monday (margem gerencial)`);
    return null;
  }

  if (!cronogramaItem?.monday_item_id) {
    console.warn(`Item de cronograma sem monday_item_id — sync Monday ignorado`);
    return null;
  }

  return { agenda, projeto, atividade, cronogramaItem };
}

// ─── Status do subitem baseado no status da agenda ────────────────────────────
// Labels do subitem: Confirmada(0), Feita(1), Cancelada(2)
function getSubitemStatusIndex(status: string): number {
  const s = (status || "").toLowerCase();
  if (["apontamento_ok", "apontamento_ajustado", "realizada"].includes(s)) return 1; // Feita
  if (["cancelada", "aguardando_cancelamento", "rejeitada"].includes(s)) return 2; // Cancelada
  if (s === "doc_pendente") return 0; // Confirmada — aguarda documento (não é Feita ainda)
  return 0; // Confirmada (default)
}

// ─── Recalcular status do item pai após operação de agenda ────────────────────
async function recalcularStatusItemPai(
  supabase: any,
  apiKey: string,
  boardId: string,
  mondayItemId: string,
  cronogramaItemId: string,
) {
  // Buscar dados do item de cronograma (inclui o código para filtrar agendas)
  const { data: ci } = await supabase
    .from("cronograma_itens")
    .select("id, codigo, doc_exigido, doc_satisfeito")
    .eq("id", cronogramaItemId)
    .single();

  // Buscar todas as agendas vinculadas a este item de cronograma pelo código
  // agendas.item_cronograma armazena o código (ex: "c0001"), não o UUID
  const { data: agendas } = await supabase
    .from("agendas")
    .select("status")
    .ilike("item_cronograma", `%${ci?.codigo || cronogramaItemId}%`)
    .not("status", "in", '("REJEITADA")');

  const total = (agendas || []).length;
  const canceladas = (agendas || []).filter((a: any) =>
    ["cancelada", "aguardando_cancelamento"].includes(a.status?.toLowerCase()),
  ).length;
  const apontadas = (agendas || []).filter((a: any) =>
    ["apontamento_ok", "apontamento_ajustado", "realizada", "doc_pendente"].includes(a.status?.toLowerCase()),
  ).length;

  // Calcular novo status do item
  // 0=Confirmada, 1=Em andamento, 2=Feito, 3=Cancelada
  let statusIndex = 0; // Confirmada

  if (total > 0 && canceladas === total) {
    statusIndex = 3; // Cancelada — todas canceladas
  } else if (apontadas > 0 && apontadas === total - canceladas) {
    // Todas as não-canceladas foram apontadas
    const docOk = !ci?.doc_exigido || ci?.doc_satisfeito;
    statusIndex = docOk ? 2 : 1; // Feito ou Em andamento (bloqueado por doc)
  } else if (apontadas > 0) {
    statusIndex = 1; // Em andamento — pelo menos 1 apontada
  }

  // Atualizar status no Monday via change_multiple_column_values
  const colValues = JSON.stringify({ status_atividade: { index: statusIndex } }).replace(/"/g, '\\"');

  await mondayQuery(
    apiKey,
    `mutation { change_multiple_column_values(board_id: ${boardId}, item_id: ${mondayItemId}, column_values: "${colValues}") { id } }`,
  );
}

// ─── ACTION: CREATE — criar subitem ───────────────────────────────────────────
async function handleCreate(supabase: any, apiKey: string, agendaId: string) {
  const info = await getAgendaInfo(supabase, agendaId);
  if (!info) return { success: true, action: "skipped", reason: "agenda not found" };
  const { agenda, projeto, cronogramaItem } = info;

  // Idempotência — se já tem monday_item_id, atualiza
  if (agenda.monday_item_id) {
    return await handleUpdate(supabase, apiKey, agendaId);
  }

  const subitemName = `${agenda.data} — ${agenda.usuario}`;
  const statusIndex = getSubitemStatusIndex(agenda.status);

  // Criar subitem usando create_subitem
  const colValues = JSON.stringify({
    status: { index: statusIndex },
    date0: { date: agenda.data },
  }).replace(/"/g, '\\"');

  const res = await mondayQuery(
    apiKey,
    `mutation {
      create_subitem(
        parent_item_id: ${cronogramaItem.monday_item_id},
        item_name: "${subitemName.replace(/"/g, '\\"')}",
        column_values: "${colValues}"
      ) { id board { id } }
    }`,
  );

  const subitemId = String(res.data.create_subitem.id);
  const subitemBoard = String(res.data.create_subitem.board.id);

  // Salvar monday_item_id na agenda
  await supabase.from("agendas").update({ monday_item_id: subitemId }).eq("id", agendaId);

  // Recalcular status do item pai
  await recalcularStatusItemPai(
    supabase,
    apiKey,
    String(projeto.monday_board_id),
    String(cronogramaItem.monday_item_id),
    cronogramaItem.id,
  );

  return { success: true, action: "created", monday_item_id: subitemId, board_id: subitemBoard };
}

// ─── ACTION: UPDATE — atualizar subitem ──────────────────────────────────────
async function handleUpdate(supabase: any, apiKey: string, agendaId: string) {
  const info = await getAgendaInfo(supabase, agendaId);
  if (!info) return { success: true, action: "skipped", reason: "agenda not found" };
  const { agenda, projeto, cronogramaItem } = info;

  if (!agenda.monday_item_id) {
    return await handleCreate(supabase, apiKey, agendaId);
  }

  const statusIndex = getSubitemStatusIndex(agenda.status);
  const colValues = JSON.stringify({
    status: { index: statusIndex },
    date0: { date: agenda.data },
  }).replace(/"/g, '\\"');

  // Subitens usam o board de subelementos — não o board principal
  // Buscar o board do subitem
  const boardRes = await mondayQuery(apiKey, `{ items(ids: [${agenda.monday_item_id}]) { board { id } } }`);
  const subitemBoardId = String(boardRes.data?.items?.[0]?.board?.id || projeto.monday_board_id);

  await mondayQuery(
    apiKey,
    `mutation {
      change_multiple_column_values(
        board_id: ${subitemBoardId},
        item_id: ${agenda.monday_item_id},
        column_values: "${colValues}"
      ) { id }
    }`,
  );

  // Recalcular status do item pai
  await recalcularStatusItemPai(
    supabase,
    apiKey,
    String(projeto.monday_board_id),
    String(cronogramaItem.monday_item_id),
    cronogramaItem.id,
  );

  return { success: true, action: "updated", monday_item_id: agenda.monday_item_id };
}

// ─── ACTION: CANCEL ───────────────────────────────────────────────────────────
async function handleCancel(supabase: any, apiKey: string, agendaId: string) {
  const info = await getAgendaInfo(supabase, agendaId);
  if (!info) return { success: true, action: "skipped", reason: "agenda not found" };
  const { agenda, projeto, cronogramaItem } = info;

  if (!agenda.monday_item_id) return { success: true, action: "skipped", reason: "no monday_item_id" };

  const colValues = JSON.stringify({ status: { index: 2 } }).replace(/"/g, '\\"'); // Cancelada

  const boardRes = await mondayQuery(apiKey, `{ items(ids: [${agenda.monday_item_id}]) { board { id } } }`);
  const boardId = String(boardRes.data?.items?.[0]?.board?.id || projeto.monday_board_id);

  await mondayQuery(
    apiKey,
    `mutation { change_multiple_column_values(board_id: ${boardId}, item_id: ${agenda.monday_item_id}, column_values: "${colValues}") { id } }`,
  );

  await recalcularStatusItemPai(
    supabase,
    apiKey,
    String(projeto.monday_board_id),
    String(cronogramaItem.monday_item_id),
    cronogramaItem.id,
  );

  return { success: true, action: "cancelled", monday_item_id: agenda.monday_item_id };
}

// ─── ACTION: DELETE ───────────────────────────────────────────────────────────
async function handleDelete(supabase: any, apiKey: string, agendaId: string, mondayItemId: string) {
  if (!mondayItemId) return { success: true, action: "skipped", reason: "no monday_item_id" };

  // Subitens não suportam archive_item — usar delete_item
  await mondayQuery(apiKey, `mutation { delete_item(item_id: ${mondayItemId}) { id } }`);

  return { success: true, action: "deleted", monday_item_id: mondayItemId };
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const settings = await getMondaySettings(supabase);

    if (settings.monday_ativo !== "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "Monday desativado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = settings.monday_api_key;
    const body = await req.json();
    const { action, agenda_id, monday_item_id } = body;

    if (!action || !agenda_id) throw new Error("Campos obrigatórios: action, agenda_id");

    let result: any;
    switch (action) {
      case "create":
        result = await handleCreate(supabase, apiKey, agenda_id);
        break;
      case "update":
        result = await handleUpdate(supabase, apiKey, agenda_id);
        break;
      case "cancel":
        result = await handleCancel(supabase, apiKey, agenda_id);
        break;
      case "delete":
        result = await handleDelete(supabase, apiKey, agenda_id, monday_item_id);
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
    /* Bloco substituido para gravar o log
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    */
    // Registrar em integration_logs
    await supabase.from("integration_logs").insert({
      codigo: "MONDAY-AGENDA-SYNC",
      status: result?.success === false ? "error" : "success",
      message: `monday-agenda-sync [${action}] — agenda ${agenda_id}${result?.monday_item_id ? ` — subitem ${result.monday_item_id}` : ""}${result?.action === "skipped" ? ` — skipped: ${result.reason}` : ""}`,
      payload: {
        action,
        agenda_id,
        monday_item_id: monday_item_id || null,
        result,
      },
      http_status: 200,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    /*
    console.error("monday-agenda-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    */
    console.error("monday-agenda-sync error:", err);

    // Registrar erro em integration_logs
    try {
      await supabase.from("integration_logs").insert({
        codigo: "MONDAY-AGENDA-SYNC",
        status: "error",
        message: `monday-agenda-sync erro: ${err.message}`,
        payload: { action: body?.action || "unknown", agenda_id: body?.agenda_id || null, erro: err.message },
        http_status: 500,
      });
    } catch (_) {}

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
