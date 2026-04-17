import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function mondayQuery(apiKey: string, query: string) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "API-Version": "2023-10",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { projeto_id } = body;

    if (!projeto_id) {
      return new Response(
        JSON.stringify({ success: false, error: "projeto_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["monday_ativo", "monday_api_key"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    if (settingsMap["monday_ativo"] !== "true") {
      return new Response(
        JSON.stringify({ success: false, error: "Integração Monday desativada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const MONDAY_API_KEY = settingsMap["monday_api_key"]?.trim();
    if (!MONDAY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key não configurada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: projeto } = await supabase
      .from("projetos")
      .select("id, nome_cliente, monday_board_id")
      .eq("id", projeto_id)
      .single();

    if (!projeto) {
      return new Response(
        JSON.stringify({ success: false, error: "Projeto não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { count } = await supabase
      .from("agendas")
      .select("id", { count: "exact", head: true })
      .eq("cliente", projeto.nome_cliente);

    if (count && count > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Projeto possui ${count} agenda(s) vinculada(s). Reset não permitido.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!projeto.monday_board_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Projeto não possui board Monday para resetar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const boardId = projeto.monday_board_id;

    try {
      await mondayQuery(
        MONDAY_API_KEY,
        `mutation { archive_board(board_id: ${boardId}) { id state } }`
      );
    } catch (archiveErr) {
      console.warn("archive_board falhou (ignorado):", (archiveErr as Error).message);
    }

    await supabase
      .from("projetos")
      .update({
        monday_board_id:  null,
        monday_board_url: null,
        monday_status:    "nao_criado",
      })
      .eq("id", projeto_id);

    const { data: atividades } = await supabase
      .from("projeto_atividades")
      .select("id")
      .eq("projeto_id", projeto_id);

    if (atividades && atividades.length > 0) {
      const ativIds = atividades.map((a: any) => a.id);
      await supabase
        .from("projeto_atividades")
        .update({ monday_group_id: null })
        .in("id", ativIds);
    }

    await supabase.from("integration_logs").insert({
      codigo:      "MONDAY-RESET-BOARD",
      status:      "success",
      message:     `Board arquivado e Supabase limpo para projeto ${projeto_id}`,
      payload:     { projeto_id, board_arquivado: boardId },
      http_status: 200,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Board arquivado. Projeto pronto para recriar.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error("monday-reset-board error:", errorMessage);
    try {
      await supabase.from("integration_logs").insert({
        codigo:      "MONDAY-RESET-BOARD",
        status:      "error",
        message:     errorMessage,
        http_status: 500,
      });
    } catch { /* ignorar */ }
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
