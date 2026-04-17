import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-origem-integracao",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Auth — validate x-api-key against secret
    const expectedKey = Deno.env.get("PROTHEUS_API_KEY");
    const receivedKey = req.headers.get("x-api-key") || "";

    if (!expectedKey || receivedKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", mensagem: "x-api-key inválida ou ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Anti-loop — only accept PROTHEUS origin
    const origem = (req.headers.get("x-origem-integracao") || "").toUpperCase();
    if (origem !== "PROTHEUS") {
      return new Response(
        JSON.stringify({ error: "origem_invalida", mensagem: "Esta rota só aceita chamadas com origem PROTHEUS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Parse body
    const body = await req.json();
    const { items, action } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "payload_invalido", mensagem: "items é obrigatório e deve ser um array não vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!action || !["incluir", "excluir"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action_invalida", mensagem: "action deve ser 'incluir' ou 'excluir'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Pre-fetch profiles and projects in bulk
    const emails = [...new Set(items.map((i: any) => i.email).filter(Boolean))];
    const codigosCliente = [...new Set(items.map((i: any) => i.codigo_cliente).filter(Boolean))];

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, name, email")
      .in("email", emails);
    const profileMap = new Map((profiles || []).map((p) => [p.email, p]));

    const { data: projetos } = await adminClient
      .from("projetos")
      .select("nome_cliente, codigo_cliente")
      .in("codigo_cliente", codigosCliente);
    const projetoMap = new Map((projetos || []).map((p) => [p.codigo_cliente, p.nome_cliente]));

    let totalProcessado = 0;
    let totalNaoEncontrado = 0;
    const detalhesNaoEncontrados: any[] = [];

    for (const item of items) {
      const clienteNome = projetoMap.get(item.codigo_cliente) || item.codigo_cliente;

      if (action === "incluir") {
        const profile = profileMap.get(item.email);
        if (!profile) {
          totalNaoEncontrado++;
          detalhesNaoEncontrados.push({ email: item.email, motivo: "Consultor não encontrado no APP" });
          continue;
        }

        // Check existing for upsert
        const { data: existing } = await adminClient
          .from("agendas")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("data", item.data)
          .eq("cliente", clienteNome)
          .eq("atividade", item.codigo_atividade)
          .maybeSingle();

        if (existing) {
          const { error } = await adminClient.from("agendas").update({
            usuario: item.usuario || profile.name,
            email: item.email,
            status: "pendente",
            flag_integracao: "PROTHEUS",
            item_cronograma: null,
            codigo_consultor: item.codigo_consultor || null,
            codigo_cliente: item.codigo_cliente || null,
            codigo_atividade: item.codigo_atividade || null,
          }).eq("id", existing.id);

          if (!error) {
            totalProcessado++;
            // Sync Monday — fire-and-forget
            adminClient.functions.invoke("monday-agenda-sync", {
              body: { action: "update", agenda_id: existing.id },
            }).catch(() => {});
          }
        } else {
          const { data: novaAgenda, error } = await adminClient
            .from("agendas")
            .insert({
              user_id: profile.user_id,
              usuario: item.usuario || profile.name,
              email: item.email,
              cliente: clienteNome,
              data: item.data,
              atividade: item.codigo_atividade,
              status: "pendente",
              flag_integracao: "PROTHEUS",
              item_cronograma: null,
              codigo_consultor: item.codigo_consultor || null,
              codigo_cliente: item.codigo_cliente || null,
              codigo_atividade: item.codigo_atividade || null,
            })
            .select("id")
            .single();
          if (!error && novaAgenda?.id) {
            totalProcessado++;
            // Sync Monday — fire-and-forget
            adminClient.functions.invoke("monday-agenda-sync", {
              body: { action: "create", agenda_id: novaAgenda.id },
            }).catch(() => {});
          } else if (!error) {
            totalProcessado++;
          }
        }
      } else {
        // excluir — two-step: try by Protheus codes first, fallback to legacy keys
        let deleted = false;

        // Step 1: Try by Protheus codes (most reliable)
        if (item.codigo_consultor && item.codigo_cliente && item.codigo_atividade) {
          const { count } = await adminClient
            .from("agendas")
            .delete({ count: "exact" })
            .eq("codigo_consultor", item.codigo_consultor)
            .eq("codigo_cliente", item.codigo_cliente)
            .eq("codigo_atividade", item.codigo_atividade)
            .eq("data", item.data);

          if (count && count > 0) {
            deleted = true;
            totalProcessado++;
          }
        }

        // Step 2: Fallback — use user_id + cliente (nome) + atividade + data
        if (!deleted) {
          const profile = profileMap.get(item.email);
          if (profile) {
            const { count } = await adminClient
              .from("agendas")
              .delete({ count: "exact" })
              .eq("user_id", profile.user_id)
              .eq("data", item.data)
              .eq("atividade", item.codigo_atividade)
              .eq("cliente", clienteNome);

            if (count && count > 0) totalProcessado++;
          } else {
            totalNaoEncontrado++;
            detalhesNaoEncontrados.push({ email: item.email, motivo: "Consultor não encontrado e agenda sem códigos Protheus" });
          }
        }
      }
    }

    // 5. Build response
    const now = new Date().toISOString();
    const isPartial = totalNaoEncontrado > 0 && totalProcessado > 0;
    const allFailed = totalProcessado === 0;

    const responseBody = {
      status: allFailed ? "ERRO" : isPartial ? "PARCIAL" : "RECEBIDO",
      mensagem: allFailed
        ? `Nenhuma agenda processada. ${totalNaoEncontrado} não encontrada(s).`
        : isPartial
          ? `${totalProcessado} agenda(s) processadas, ${totalNaoEncontrado} não encontradas (consultor sem cadastro no APP).`
          : `${totalProcessado} agenda(s) processada(s) com sucesso pelo APP. Reenvio bloqueado.`,
      total_recebido: items.length,
      total_processado: totalProcessado,
      total_nao_encontrado: totalNaoEncontrado,
      flag_loop: "PROTHEUS",
      origem_retorno: "LOVABLE",
      data_processamento: now,
      ...(detalhesNaoEncontrados.length > 0 ? { nao_encontrados: detalhesNaoEncontrados } : {}),
    };

    // 6. Log
    await adminClient.from("integration_logs").insert({
      codigo: action === "incluir" ? "0005" : "0006",
      status: totalProcessado > 0 ? "success" : "error",
      message: responseBody.mensagem,
      http_status: 200,
      payload: body,
      response: responseBody,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "internal_error", mensagem: err?.message ?? "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
