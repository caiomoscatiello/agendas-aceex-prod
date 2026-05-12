// BL-013 P3 -- Hook: useSLA
// Arquivo: src/components/consultor/hooks/useSLA.ts
// CRIAR arquivo novo -- nao altera nenhum arquivo existente
// Encoding: UTF-8 sem BOM

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StatusSLA = "no_prazo" | "em_risco" | "vencido" | "concluido";
export type DominioSLA = "apontamento" | "documentacao" | "ocorrencia" | "kanban_fase" | "pendencia" | "change_request";

export type SLAConfig = {
  dominio: DominioSLA;
  dias_sla: number;
  dias_risco_antes: number;
  pct_risco: number;
};

export type SLAResultado = {
  status: StatusSLA;
  diasDecorridos: number;
  diasRestantes: number;
  label: string;
  cor: string;
  corBg: string;
  corBorda: string;
};

// Calculo client-side (mirror do sla-evaluator)
export function calcularSLA(dataRef: string, cfg: SLAConfig): SLAResultado {
  // Guard: data invalida retorna concluido (badge oculto)
  if (!dataRef || dataRef === "null" || dataRef === "undefined") {
    return { status: "concluido", diasDecorridos: 0, diasRestantes: 0,
      label: "", cor: "", corBg: "", corBorda: "" };
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dRef = new Date(dataRef + "T00:00:00");
  if (isNaN(dRef.getTime())) {
    return { status: "concluido", diasDecorridos: 0, diasRestantes: 0,
      label: "", cor: "", corBg: "", corBorda: "" };
  }
  const msDay = 1000 * 60 * 60 * 24;
  const diasDecorridos = Math.max(0, Math.floor((hoje.getTime() - dRef.getTime()) / msDay));
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

  const mapas: Record<StatusSLA, { label: string; cor: string; corBg: string; corBorda: string }> = {
    no_prazo: {
      label: diasRestantes > 1 ? `faltam ${diasRestantes}d` : diasRestantes === 1 ? "vence amanha" : "vence hoje",
      cor: "text-emerald-700", corBg: "bg-emerald-50", corBorda: "border-emerald-300",
    },
    em_risco: {
      label: diasRestantes > 0 ? `faltam ${diasRestantes}d` : "vence hoje",
      cor: "text-amber-700", corBg: "bg-amber-50", corBorda: "border-amber-300",
    },
    vencido: {
      label: `ha ${diasDecorridos - cfg.dias_sla}d`,
      cor: "text-red-700", corBg: "bg-red-50", corBorda: "border-red-300",
    },
    concluido: {
      label: "concluido",
      cor: "text-gray-500", corBg: "bg-gray-50", corBorda: "border-gray-200",
    },
  };

  return { status, diasDecorridos, diasRestantes, ...mapas[status] };
}

// Defaults usados quando nao ha config carregada ainda
export const SLA_DEFAULTS: Record<DominioSLA, SLAConfig> = {
  apontamento:    { dominio: "apontamento",    dias_sla: 1, dias_risco_antes: 0, pct_risco: 80 },
  documentacao:   { dominio: "documentacao",   dias_sla: 3, dias_risco_antes: 1, pct_risco: 80 },
  ocorrencia:     { dominio: "ocorrencia",     dias_sla: 5, dias_risco_antes: 1, pct_risco: 80 },
  kanban_fase:    { dominio: "kanban_fase",    dias_sla: 7, dias_risco_antes: 2, pct_risco: 80 },
  pendencia:      { dominio: "pendencia",      dias_sla: 5, dias_risco_antes: 1, pct_risco: 80 },
  change_request: { dominio: "change_request", dias_sla: 3, dias_risco_antes: 1, pct_risco: 80 },
};

export function useSLA(projetoId?: string) {
  const [configs, setConfigs] = useState<Record<DominioSLA, SLAConfig>>(SLA_DEFAULTS);
  const [loading, setLoading] = useState(false);

  const loadConfigs = useCallback(async (pid?: string) => {
    const id = pid || projetoId;
    if (!id) return;
    setLoading(true);

    // Buscar config global
    const { data: global } = await supabase
      .from("sla_config_global")
      .select("dominio, dias_sla, dias_risco_antes, pct_risco");

    const merged: Record<string, SLAConfig> = { ...SLA_DEFAULTS };
    for (const g of global || []) {
      merged[g.dominio] = { dominio: g.dominio as DominioSLA, dias_sla: g.dias_sla, dias_risco_antes: g.dias_risco_antes, pct_risco: g.pct_risco };
    }

    // Sobrescrever com config do projeto
    const { data: proj } = await supabase
      .from("sla_config_projeto")
      .select("dominio, dias_sla, dias_risco_antes, pct_risco")
      .eq("projeto_id", id);

    for (const p of proj || []) {
      merged[p.dominio] = { dominio: p.dominio as DominioSLA, dias_sla: p.dias_sla, dias_risco_antes: p.dias_risco_antes, pct_risco: p.pct_risco };
    }

    setConfigs(merged as Record<DominioSLA, SLAConfig>);
    setLoading(false);
  }, [projetoId]);

  const getSLA = useCallback((dominio: DominioSLA, dataRef: string): SLAResultado => {
    return calcularSLA(dataRef, configs[dominio] || SLA_DEFAULTS[dominio]);
  }, [configs]);

  const saveConfigProjeto = useCallback(async (
    pid: string,
    dominio: DominioSLA,
    cfg: Omit<SLAConfig, "dominio">
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("sla_config_projeto")
      .upsert({ projeto_id: pid, dominio, ...cfg }, { onConflict: "projeto_id,dominio" });
    if (!error) await loadConfigs(pid);
    return !error;
  }, [loadConfigs]);

  const deleteConfigProjeto = useCallback(async (pid: string, dominio: DominioSLA): Promise<boolean> => {
    const { error } = await supabase
      .from("sla_config_projeto")
      .delete()
      .eq("projeto_id", pid)
      .eq("dominio", dominio);
    if (!error) await loadConfigs(pid);
    return !error;
  }, [loadConfigs]);

  return { configs, loading, loadConfigs, getSLA, saveConfigProjeto, deleteConfigProjeto };
}
