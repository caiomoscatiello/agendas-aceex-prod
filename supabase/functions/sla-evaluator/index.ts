// BL-013 P2 -- Edge Function: sla-evaluator
// Caminho: supabase/functions/sla-evaluator/index.ts
// Deploy: supabase functions deploy sla-evaluator --project-ref ofolgjtqgmudfeoppwtb
// Roda via pg_cron 1x/dia -- configurar apos deploy:
//   select cron.schedule('sla-evaluator-diario', '0 11 * * *',
//     $$select net.http_post(url:='https://ofolgjtqgmudfeoppwtb.supabase.co/functions/v1/sla-evaluator',
//     headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
//     body:='{}'::jsonb)$$);

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StatusSLA = "no_prazo" | "em_risco" | "vencido" | "concluido";

type SLAConfig = {
  dias_sla: number;
  dias_risco_antes: number;
  pct_risco: number;
};

function calcularStatus(
  dataRef: string,
  hoje: string,
  cfg: SLAConfig
): { status: StatusSLA; diasDecorridos: number; diasRestantes: number } {
  const msDay = 1000 * 60 * 60 * 24;
  const dRef = new Date(dataRef + "T00:00:00");
  const dHoje = new Date(hoje + "T00:00:00");
  const diasDecorridos = Math.floor((dHoje.getTime() - dRef.getTime()) / msDay);
  const diasRestantes = cfg.dias_sla - diasDecorridos;
  const pctConsumido = (diasDecorridos / cfg.dias_sla) * 100;

  let status: StatusSLA;
  if (diasDecorridos > cfg.dias_sla) {
    status = "vencido";
  } else if (diasRestantes <= cfg.dias_risco_antes || pctConsumido >= cfg.pct_risco) {
    status = "em_risco";
  } else {
    status = "no_prazo";
  }

  return { status, diasDecorridos, diasRestantes };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const hoje = new Date().toISOString().split("T")[0];
  const log: string[] = [];
  let totalProcessado = 0;
  let totalRisco = 0;
  let totalVencido = 0;

  try {
    // Carregar config global como fallback
    const { data: configGlobal } = await supabase
      .from("sla_config_global")
      .select("dominio, dias_sla, dias_risco_antes, pct_risco");

    const globalMap: Record<string, SLAConfig> = {};
    for (const c of configGlobal || []) {
      globalMap[c.dominio] = { dias_sla: c.dias_sla, dias_risco_antes: c.dias_risco_antes, pct_risco: c.pct_risco };
    }

    // Carregar config especifica por projeto
    const { data: configProjeto } = await supabase
      .from("sla_config_projeto")
      .select("projeto_id, dominio, dias_sla, dias_risco_antes, pct_risco");

    const projetoMap: Record<string, Record<string, SLAConfig>> = {};
    for (const c of configProjeto || []) {
      if (!projetoMap[c.projeto_id]) projetoMap[c.projeto_id] = {};
      projetoMap[c.projeto_id][c.dominio] = { dias_sla: c.dias_sla, dias_risco_antes: c.dias_risco_antes, pct_risco: c.pct_risco };
    }

    // Helper: busca config com fallback global
    const getCfg = (projetoId: string, dominio: string): SLAConfig =>
      projetoMap[projetoId]?.[dominio] || globalMap[dominio] || { dias_sla: 5, dias_risco_antes: 1, pct_risco: 80 };

    // -----------------------------------------------------------------------
    // DOMINIO 1: apontamento -- agendas confirmadas com data passada
    // -----------------------------------------------------------------------
    {
      const { data: agendas } = await supabase
        .from("agendas")
        .select("id, data, cliente, user_id")
        .eq("status", "confirmada")
        .lt("data", hoje);

      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, nome_cliente");

      const projetoByCliente: Record<string, string> = {};
      for (const p of projetos || []) projetoByCliente[p.nome_cliente] = p.id;

      let totalDom = 0, riscoDom = 0, vencDom = 0;
      const notificacoes: { user_id: string; titulo: string; detalhe: string }[] = [];

      for (const ag of agendas || []) {
        const projetoId = projetoByCliente[ag.cliente];
        if (!projetoId) continue;
        const cfg = getCfg(projetoId, "apontamento");
        const { status, diasDecorridos } = calcularStatus(ag.data, hoje, cfg);
        totalDom++;
        totalProcessado++;
        if (status === "em_risco") {
          riscoDom++;
          totalRisco++;
          // Notificacao D-1
          if (diasDecorridos === cfg.dias_sla - 1) {
            notificacoes.push({ user_id: ag.user_id, titulo: "Apontamento vence amanha", detalhe: `${ag.cliente} - ${ag.data}` });
          }
        }
        if (status === "vencido") { vencDom++; totalVencido++; }
      }

      // Snapshot do dia
      if (totalDom > 0) {
        const projIds = [...new Set(Object.values(projetoByCliente))];
        for (const pid of projIds) {
          const agsProjeto = (agendas || []).filter(ag => projetoByCliente[ag.cliente] === pid);
          if (agsProjeto.length === 0) continue;
          let tot = 0, np = 0, er = 0, vn = 0;
          for (const ag of agsProjeto) {
            const cfg = getCfg(pid, "apontamento");
            const { status } = calcularStatus(ag.data, hoje, cfg);
            tot++; if (status === "no_prazo") np++; if (status === "em_risco") er++; if (status === "vencido") vn++;
          }
          await supabase.from("sla_resultados").upsert({
            projeto_id: pid, dominio: "apontamento", data_ref: hoje,
            total: tot, no_prazo: np, em_risco: er, vencido: vn,
            taxa_cumprimento: tot > 0 ? Number(((np / tot) * 100).toFixed(2)) : null,
          }, { onConflict: "projeto_id,dominio,data_ref" });
        }
      }
      log.push(`apontamento: ${totalDom} avaliados, ${riscoDom} em risco, ${vencDom} vencidos`);
    }

    // -----------------------------------------------------------------------
    // DOMINIO 2: documentacao -- agendas com doc_pendente
    // -----------------------------------------------------------------------
    {
      const { data: agendas } = await supabase
        .from("agendas")
        .select("id, data, cliente")
        .eq("status", "doc_pendente");

      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, nome_cliente");

      const projetoByCliente: Record<string, string> = {};
      for (const p of projetos || []) projetoByCliente[p.nome_cliente] = p.id;

      let totalDom = 0, riscoDom = 0, vencDom = 0;
      for (const ag of agendas || []) {
        const projetoId = projetoByCliente[ag.cliente];
        if (!projetoId) continue;
        const cfg = getCfg(projetoId, "documentacao");
        const { status } = calcularStatus(ag.data, hoje, cfg);
        totalDom++; totalProcessado++;
        if (status === "em_risco") { riscoDom++; totalRisco++; }
        if (status === "vencido") { vencDom++; totalVencido++; }
      }
      log.push(`documentacao: ${totalDom} avaliados, ${riscoDom} em risco, ${vencDom} vencidos`);
    }

    // -----------------------------------------------------------------------
    // DOMINIO 3: ocorrencia -- entradas do diario sem resolucao
    // -----------------------------------------------------------------------
    {
      const { data: entradas } = await supabase
        .from("projeto_diario")
        .select("id, projeto_id, created_at")
        .eq("categoria", "ocorrencia")
        .is("agenda_id", null); // sem resolucao vinculada

      let totalDom = 0, riscoDom = 0, vencDom = 0;
      for (const e of entradas || []) {
        const dataRef = e.created_at.split("T")[0];
        const cfg = getCfg(e.projeto_id, "ocorrencia");
        const { status } = calcularStatus(dataRef, hoje, cfg);
        totalDom++; totalProcessado++;
        if (status === "em_risco") { riscoDom++; totalRisco++; }
        if (status === "vencido") { vencDom++; totalVencido++; }
      }
      log.push(`ocorrencia: ${totalDom} avaliados, ${riscoDom} em risco, ${vencDom} vencidos`);
    }

    // -----------------------------------------------------------------------
    // DOMINIO 4: pendencia -- pendencias manuais abertas
    // -----------------------------------------------------------------------
    {
      const { data: pends } = await supabase
        .from("pendencias")
        .select("id, projeto_id, data_abertura, status_sla")
        .is("data_conclusao", null);

      const updates: { id: string; status_sla: StatusSLA }[] = [];
      let totalDom = 0, riscoDom = 0, vencDom = 0;

      for (const p of pends || []) {
        const cfg = getCfg(p.projeto_id, "pendencia");
        const { status } = calcularStatus(p.data_abertura, hoje, cfg);
        totalDom++; totalProcessado++;
        if (status !== p.status_sla) updates.push({ id: p.id, status_sla: status });
        if (status === "em_risco") { riscoDom++; totalRisco++; }
        if (status === "vencido") { vencDom++; totalVencido++; }
      }

      // Atualizar status_sla nas pendencias que mudaram
      for (const u of updates) {
        await supabase.from("pendencias").update({ status_sla: u.status_sla }).eq("id", u.id);
      }
      log.push(`pendencia: ${totalDom} avaliados, ${riscoDom} em risco, ${vencDom} vencidos, ${updates.length} atualizados`);
    }

    const resultado = {
      data: hoje,
      totalProcessado,
      totalRisco,
      totalVencido,
      log,
    };

    console.log("sla-evaluator concluido:", JSON.stringify(resultado));

    return new Response(JSON.stringify({ success: true, ...resultado }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("sla-evaluator erro:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
