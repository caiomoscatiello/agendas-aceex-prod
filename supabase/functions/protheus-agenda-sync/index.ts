import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    if (!isServiceRole) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, agendas } = body;

    if (!action || !["incluir", "excluir"].includes(action)) {
      return new Response(JSON.stringify({ error: "action deve ser 'incluir' ou 'excluir'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agendas || !Array.isArray(agendas) || agendas.length === 0) {
      return new Response(JSON.stringify({ error: "agendas é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codigoIntegracao = action === "incluir" ? "0003" : "0004";

    // Filter by flag_integracao — anti-loop only for "incluir"; "excluir" always syncs
    const itemsToSync = action === "excluir"
      ? agendas
      : agendas.filter((a: any) => a.flag_integracao === "LOVABLE");
    const blockedItems = action === "excluir"
      ? []
      : agendas.filter((a: any) => a.flag_integracao !== "LOVABLE");

    if (blockedItems.length > 0) {
      await adminClient.from("integration_logs").insert({
        codigo: codigoIntegracao,
        status: "info",
        message: `${blockedItems.length} item(ns) bloqueado(s): origem não é LOVABLE`,
        payload: {
          action,
          blocked: blockedItems.map((a: any) => ({
            data: a.data,
            cliente: a.cliente,
            flag_integracao: a.flag_integracao,
            decisao: "BLOQUEADO",
            motivo: a.flag_integracao === "PROTHEUS" ? "Origem PROTHEUS - evitar loop" : a.flag_integracao === "SINCRONIZADO" ? "Já sincronizado" : `Origem desconhecida: ${a.flag_integracao}`,
          })),
        },
      });
    }

    if (itemsToSync.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum item com origem LOVABLE para sincronizar", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integration config
    const { data: integracao } = await adminClient
      .from("protheus_integracoes")
      .select("*")
      .eq("codigo", codigoIntegracao)
      .eq("ativo", true)
      .single();

    if (!integracao) {
      await adminClient.from("integration_logs").insert({
        codigo: codigoIntegracao,
        status: "info",
        message: `Integração ${codigoIntegracao} não está ativa. Nenhum envio realizado.`,
        payload: { action, count: itemsToSync.length },
      });
      return new Response(JSON.stringify({ success: true, message: "Integração não ativa", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect unique clients and user_ids to look up codes
    const clienteNames = [...new Set(itemsToSync.map((a: any) => a.cliente))];
    const userIds = [...new Set(itemsToSync.map((a: any) => a.user_id))];

    const [projetosRes, profilesRes] = await Promise.all([
      adminClient.from("projetos").select("id, nome_cliente, codigo_cliente").in("nome_cliente", clienteNames),
      adminClient.from("profiles").select("user_id, codigo").in("user_id", userIds),
    ]);

    const projetoMap = new Map((projetosRes.data || []).map((p: any) => [p.nome_cliente, p]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.codigo || ""]));

    // Log profile lookup results for debugging
    console.log("Profile lookup - userIds:", userIds);
    console.log("Profile lookup - results:", (profilesRes.data || []).map((p: any) => ({ user_id: p.user_id, codigo: p.codigo })));

    // Build payload items — explicit field-by-field mapping
    const payloadItems = itemsToSync.map((item: any) => {
      const projeto = projetoMap.get(item.cliente);
      const codigoConsultor = profileMap.get(item.user_id) || "";

      let codigoAtividade = item.atividade || "";
      const dashIndex = codigoAtividade.indexOf(" - ");
      if (dashIndex > 0) {
        codigoAtividade = codigoAtividade.substring(0, dashIndex).trim();
      }

      return {
        data: item.data,
        projeto: projeto?.codigo_cliente || item.cliente,
        codigo_consultor: codigoConsultor,
        codigo_cliente: projeto?.codigo_cliente || "",
        codigo_atividade: codigoAtividade,
      };
    });

    // Preview payload items for debugging
    console.log("Preview payload items:", JSON.stringify(payloadItems.slice(0, 3)));

    // --- VALIDATION: check required fields ---
    const invalidItems: string[] = [];
    payloadItems.forEach((item, idx) => {
      const missing: string[] = [];
      if (!item.codigo_consultor) missing.push("codigo_consultor");
      if (!item.data) missing.push("data");
      if (!item.projeto) missing.push("projeto");
      if (!item.codigo_cliente) missing.push("codigo_cliente");
      if (!item.codigo_atividade) missing.push("codigo_atividade");
      if (missing.length > 0) {
        invalidItems.push(`Item ${idx + 1} (${item.data || "sem data"}): ${missing.join(", ")} obrigatório(s)`);
      }
    });

    if (invalidItems.length > 0) {
      const validationMsg = `${invalidItems.length} item(ns) com campos obrigatórios vazios. ${invalidItems.join("; ")}`;
      await adminClient.from("integration_logs").insert({
        codigo: codigoIntegracao,
        status: "error",
        message: validationMsg,
        payload: {
          action,
          items: payloadItems,
          decisao: "BLOQUEADO_VALIDACAO",
          erros: invalidItems,
        },
      });
      return new Response(JSON.stringify({
        success: false,
        message: validationMsg,
        erros: invalidItems,
        synced: 0,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DEDUPLICATION: by data + projeto + codigo_consultor + codigo_atividade ---
    const seenKeys = new Set<string>();
    const uniqueItems: typeof payloadItems = [];
    let duplicateCount = 0;

    for (const item of payloadItems) {
      const key = `${item.data}|${item.projeto}|${item.codigo_consultor}|${item.codigo_atividade}`;
      if (seenKeys.has(key)) {
        duplicateCount++;
      } else {
        seenKeys.add(key);
        uniqueItems.push(item);
      }
    }

    if (duplicateCount > 0) {
      console.log(`${duplicateCount} item(s) duplicado(s) removido(s) antes do envio`);
    }

    // Read endpoint and API key from the integration config in DB
    const endpoint = (integracao.endpoint || "").trim();
    const integracaoApiKey = integracao.api_key || "";

    console.log("Endpoint configurado:", endpoint);
    console.log("API Key presente:", !!integracaoApiKey);

    const totalEnviado = uniqueItems.length;

    let httpStatus = 0;
    let responseBody: any = null;
    let logStatus = "success";
    let logMessage = "";

    // Validate endpoint before any fetch
    if (!endpoint || !endpoint.startsWith("http")) {
      logStatus = "error";
      logMessage = `Endpoint inválido ou não configurado na integração ${codigoIntegracao}. Valor: "${endpoint || ""}". Configure em Settings > Integração Protheus.`;
      httpStatus = 0;
      responseBody = { error: logMessage };
    } else {
      try {
        const httpResp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": integracaoApiKey,
            "x-origem-integracao": "APP",
          },
          body: JSON.stringify({ action, items: uniqueItems }),
        });
        httpStatus = httpResp.status;
        try {
          responseBody = await httpResp.json();
        } catch {
          responseBody = { raw: await httpResp.text().catch(() => "") };
        }
        if (!httpResp.ok) {
          logStatus = "error";
          logMessage = `Erro HTTP ${httpStatus} ao enviar ${action} de ${totalEnviado} agenda(s)`;
        } else {
          logMessage = `${action === "incluir" ? "Inclusão" : "Exclusão"} de ${totalEnviado} agenda(s) enviada ao Protheus`;
        }
      } catch (fetchErr: any) {
        logStatus = "error";
        httpStatus = 0;
        responseBody = { error: fetchErr?.message || "Falha na conexão" };
        logMessage = `Falha ao conectar no endpoint: ${fetchErr?.message}`;
      }
    }

    // Calculate divergence
    const totalConfirmado = responseBody?.total_processado ?? null;
    const divergencia = totalConfirmado !== null ? totalEnviado !== totalConfirmado : null;

    // Audit log
    await adminClient.from("integration_logs").insert({
      codigo: codigoIntegracao,
      status: logStatus,
      message: logMessage,
      payload: {
        action,
        items: uniqueItems,
        origem_detectada: "LOVABLE",
        decisao: logStatus === "error" ? "ERRO" : "ENVIADO",
        total_enviado: totalEnviado,
        total_confirmado: totalConfirmado,
        divergencia,
        ...(duplicateCount > 0 ? { duplicatas_removidas: duplicateCount } : {}),
      },
      response: responseBody,
      http_status: httpStatus || null,
    });

    // On success, update flag_integracao to SINCRONIZADO and save Protheus codes
    if (logStatus === "success" && action === "incluir") {
      for (let i = 0; i < itemsToSync.length; i++) {
        const item = itemsToSync[i];
        const payloadItem = uniqueItems[i] || payloadItems[i];
        await adminClient
          .from("agendas")
          .update({
            flag_integracao: "SINCRONIZADO",
            codigo_consultor: payloadItem?.codigo_consultor || null,
            codigo_cliente: payloadItem?.codigo_cliente || null,
            codigo_atividade: payloadItem?.codigo_atividade || null,
          })
          .eq("user_id", item.user_id)
          .eq("data", item.data)
          .eq("cliente", item.cliente)
          .eq("flag_integracao", "LOVABLE");
      }
    }

    return new Response(JSON.stringify({
      success: logStatus !== "error",
      message: logMessage,
      synced: totalEnviado,
      sincronizados: logStatus === "success" ? totalEnviado : 0,
      ...(divergencia !== null ? { divergencia } : {}),
      ...(duplicateCount > 0 ? { duplicatas_removidas: duplicateCount } : {}),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
