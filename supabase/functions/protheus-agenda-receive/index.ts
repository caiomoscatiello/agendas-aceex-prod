import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-origem-integracao",
};

/**
 * Endpoint dedicado para RECEBER agendas do Protheus.
 * POST /protheus-agenda-receive
 *
 * - Valida x-api-key contra protheus_integracoes código 0003
 * - Valida header x-origem-integracao = PROTHEUS (obrigatório)
 * - Bloqueia se x-origem-integracao = APP (anti-loop)
 * - Faz UPSERT das agendas com flag_integracao = "PROTHEUS"
 * - Registra tudo no integration_logs com código "0005"
 *
 * Body esperado:
 * {
 *   agendas: Array<{
 *     data: string,            // YYYY-MM-DD
 *     codigo_cliente: string,
 *     codigo_consultor: string,
 *     codigo_atividade: string,
 *     descricao_atividade?: string
 *   }>
 * }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOG_CODE = "0005";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 1. Authenticate via x-api-key matching integration 0003
    const receivedApiKey = req.headers.get("x-api-key") || "";
    const { data: integracao } = await adminClient
      .from("protheus_integracoes")
      .select("api_key, ativo")
      .eq("codigo", "0003")
      .eq("ativo", true)
      .single();

    if (!integracao || integracao.api_key !== receivedApiKey) {
      await adminClient.from("integration_logs").insert({
        codigo: LOG_CODE,
        status: "error",
        message: "API key inválida ou integração inativa",
        payload: { decisao: "REJEITADO", motivo: "API key inválida" },
      });
      return new Response(JSON.stringify({ error: "API key inválida ou integração inativa" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate x-origem-integracao header
    const origemHeader = (req.headers.get("x-origem-integracao") || "").toUpperCase();

    if (origemHeader === "APP") {
      await adminClient.from("integration_logs").insert({
        codigo: LOG_CODE,
        status: "info",
        message: "Recepção bloqueada: header x-origem-integracao=APP detectado (anti-loop)",
        payload: { origem_header: origemHeader, decisao: "BLOQUEADO", motivo: "Anti-loop — dados originados do APP" },
      });
      return new Response(JSON.stringify({ success: true, message: "Bloqueado: dados originados do APP", received: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (origemHeader !== "PROTHEUS") {
      await adminClient.from("integration_logs").insert({
        codigo: LOG_CODE,
        status: "error",
        message: `Header x-origem-integracao inválido ou ausente: "${origemHeader || "(vazio)"}". Esperado: PROTHEUS`,
        payload: { origem_header: origemHeader || null, decisao: "REJEITADO", motivo: "Header x-origem-integracao deve ser PROTHEUS" },
      });
      return new Response(JSON.stringify({ error: "Header x-origem-integracao inválido. Envie: PROTHEUS" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse body
    const body = await req.json();
    const { agendas } = body;

    if (!agendas || !Array.isArray(agendas) || agendas.length === 0) {
      await adminClient.from("integration_logs").insert({
        codigo: LOG_CODE,
        status: "error",
        message: "Payload inválido: agendas é obrigatório e deve ser um array não vazio",
        payload: { body_received: body },
      });
      return new Response(JSON.stringify({ error: "agendas é obrigatório e deve ser um array não vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Look up projects by codigo_cliente
    const codigosCliente = [...new Set(agendas.map((a: any) => a.codigo_cliente))];
    const { data: projetos } = await adminClient
      .from("projetos")
      .select("id, nome_cliente, codigo_cliente")
      .in("codigo_cliente", codigosCliente);

    const projetoMap = new Map((projetos || []).map((p) => [p.codigo_cliente, p]));

    // 5. Look up consultants by codigo
    const codigosConsultor = [...new Set(agendas.map((a: any) => a.codigo_consultor))];
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, codigo, name, email")
      .in("codigo", codigosConsultor);

    const consultorMap = new Map((profiles || []).map((p) => [p.codigo, p]));

    const upserted: any[] = [];
    const errors: any[] = [];

    for (const item of agendas) {
      const projeto = projetoMap.get(item.codigo_cliente);
      const consultor = consultorMap.get(item.codigo_consultor);

      if (!projeto || !consultor) {
        errors.push({
          item,
          motivo: !projeto
            ? `Projeto não encontrado para codigo_cliente: ${item.codigo_cliente}`
            : `Consultor não encontrado para codigo_consultor: ${item.codigo_consultor}`,
        });
        continue;
      }

      const atividadeStr = item.descricao_atividade
        ? `${item.codigo_atividade} - ${item.descricao_atividade}`
        : item.codigo_atividade;

      // 6. Check if agenda already exists (same user, date, client, activity) for upsert
      const { data: existing } = await adminClient
        .from("agendas")
        .select("id")
        .eq("user_id", consultor.user_id)
        .eq("data", item.data)
        .eq("cliente", projeto.nome_cliente)
        .eq("atividade", atividadeStr)
        .maybeSingle();

      if (existing) {
        // Update existing — refresh flag
        const { error } = await adminClient
          .from("agendas")
          .update({
            flag_integracao: "PROTHEUS",
            status: "confirmada",
          })
          .eq("id", existing.id);

        if (error) {
          errors.push({ item, motivo: `Erro ao atualizar agenda existente: ${error.message}` });
        } else {
          upserted.push({ ...item, _action: "updated", _id: existing.id });
        }
      } else {
        // Insert new
        const { error } = await adminClient.from("agendas").insert({
          user_id: consultor.user_id,
          usuario: consultor.name,
          email: consultor.email,
          cliente: projeto.nome_cliente,
          data: item.data,
          atividade: atividadeStr,
          flag_integracao: "PROTHEUS",
          status: "confirmada",
        });

        if (error) {
          errors.push({ item, motivo: `Erro ao inserir agenda: ${error.message}` });
        } else {
          upserted.push({ ...item, _action: "inserted" });
        }
      }
    }

    // 7. Audit log
    const insertedCount = upserted.filter((u) => u._action === "inserted").length;
    const updatedCount = upserted.filter((u) => u._action === "updated").length;

    await adminClient.from("integration_logs").insert({
      codigo: LOG_CODE,
      status: errors.length > 0 ? (upserted.length > 0 ? "warning" : "error") : "success",
      message: `Recebido do Protheus: ${insertedCount} inserido(s), ${updatedCount} atualizado(s), ${errors.length} erro(s)`,
      payload: {
        origem_header: "PROTHEUS",
        decisao: "RECEBIDO",
        total: agendas.length,
        inseridos: insertedCount,
        atualizados: updatedCount,
        erros: errors.length,
        detalhes_erros: errors.length > 0 ? errors : undefined,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      received: upserted.length,
      inserted: insertedCount,
      updated: updatedCount,
      errors: errors.length,
      details: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
