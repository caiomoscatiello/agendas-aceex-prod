// src/components/consultor/hooks/useBacklogConsultor.ts
// BL-CONS-001 -- Hook: Meu Backlog do Consultor
// CRIAR arquivo novo -- nao altera nenhum arquivo existente
// Encoding: UTF-8 sem BOM

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// -- Tipos ------------------------------------------------------------------

export type BacklogScoreFaixa = "critico" | "atencao" | "ok";

export type BacklogAgenda = {
  id: string;
  agendaId: string;
  tipo: "agenda";
  projeto: string;
  projetoId: string;
  codigoCliente: string;
  atividade: string;
  itemCronograma: string | null;
  data: string;
  score: number;
  faixa: BacklogScoreFaixa;
  alertaSeveridade: "critico" | "alto" | "normal";
};

export type BacklogDocumento = {
  id: string;
  agendaId: string;
  tipo: "doc_passado" | "doc_planejado";
  projeto: string;
  projetoId: string;
  atividade: string;
  itemCronograma: string | null;
  tipoDocumento: string | null;
  data: string;
  diasEmAberto: number | null;
  score: number;
  faixa: BacklogScoreFaixa;
  alertaSeveridade: "critico" | "alto" | "normal";
};

export type BacklogTravado = {
  id: string;
  cronogramaItemId: string;
  tipo: "travado";
  projeto: string;
  projetoId: string;
  atividadeId: string;
  codigoItem: string;
  descricaoItem: string;
  feelingAtual: number;
  paradoHaDias: number;
  score: number;
  faixa: BacklogScoreFaixa;
  alertaSeveridade: "critico" | "alto" | "normal";
};

export type PeriodoBacklog = "mes" | "30" | "60" | "90";
export type OrdenacaoBacklog = "urgencia" | "data" | "projeto";

export type BacklogMencao = {
  id: string;
  mencaoId: string;
  tipo: "mencao";
  projeto: string;
  projetoId: string;
  entradaId: string;
  textoEntrada: string;
  autorNome: string | null;
  dataEntrada: string;
  status: "pendente" | "ciente" | "resolvido";
  score: number;
  faixa: BacklogScoreFaixa;
};

// -- Helpers ----------------------------------------------------------------

function faixaScore(score: number): BacklogScoreFaixa {
  if (score >= 60) return "critico";
  if (score >= 30) return "atencao";
  return "ok";
}

function diasEntreDatas(dataA: string, dataB: string): number {
  const a = new Date(dataA + "T00:00:00");
  const b = new Date(dataB + "T00:00:00");
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function hoje(): string {
  return new Date().toISOString().split("T")[0];
}

function dataLimite(periodo: PeriodoBacklog): string {
  const d = new Date();
  if (periodo === "mes") {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
  } else {
    d.setDate(d.getDate() + parseInt(periodo));
  }
  return d.toISOString().split("T")[0];
}

function scoreAgenda(diasAteData: number, alertaSev: string): number {
  let s = 0;
  if (diasAteData <= 2)       s += 50;
  else if (diasAteData <= 7)  s += 30;
  if (alertaSev === "critico") s += 25;
  else if (alertaSev === "alto") s += 10;
  return s;
}

function scoreDocumento(
  tipo: "doc_passado" | "doc_planejado",
  diasEmAberto: number | null,
  diasAteData: number | null,
  alertaSev: string
): number {
  let s = 0;
  if (tipo === "doc_passado") {
    s += 40;
    if ((diasEmAberto || 0) > 15) s += 20;
    else if ((diasEmAberto || 0) > 7) s += 10;
  } else {
    if ((diasAteData || 99) <= 2)      s += 50;
    else if ((diasAteData || 99) <= 7) s += 30;
  }
  if (alertaSev === "critico") s += 25;
  else if (alertaSev === "alto") s += 10;
  return s;
}

function scoreTravado(paradoHaDias: number, alertaSev: string): number {
  let s = 0;
  if (paradoHaDias > 15)      s += 35;
  else if (paradoHaDias > 7)  s += 20;
  if (alertaSev === "critico") s += 25;
  else if (alertaSev === "alto") s += 10;
  return s;
}

function ordenar<T extends { score: number; data?: string; projeto?: string }>(
  lista: T[],
  ord: OrdenacaoBacklog
): T[] {
  return [...lista].sort((a, b) => {
    if (ord === "urgencia") return b.score - a.score;
    if (ord === "data")     return (a.data || "").localeCompare(b.data || "");
    if (ord === "projeto")  return (a.projeto || "").localeCompare(b.projeto || "");
    return 0;
  });
}

// -- Hook -------------------------------------------------------------------

export function useBacklogConsultor(userId: string | undefined) {
  const [agendas, setAgendas]       = useState<BacklogAgenda[]>([]);
  const [documentos, setDocumentos] = useState<BacklogDocumento[]>([]);
  const [travados, setTravados]     = useState<BacklogTravado[]>([]);
  const [mencoes, setMencoes]       = useState<BacklogMencao[]>([]);
  const [loading, setLoading]       = useState(false);

  const loadBacklog = useCallback(async (
    periodo: PeriodoBacklog = "mes",
    ordenacao: OrdenacaoBacklog = "urgencia"
  ) => {
    if (!userId) return;
    setLoading(true);

    const hj     = hoje();
    const limite = dataLimite(periodo);

    // 1. Projetos que o consultor tem agendas vinculadas (via agendas)
    // FIX: nao buscar todos os projetos -- derivar dos clientes das agendas
    const { data: projetosRaw } = await supabase
      .from("projetos")
      .select("id, nome_cliente, codigo_cliente");

    const projetoMap: Record<string, { nome: string; codigo: string }> = {};
    const projetoPorNome: Record<string, { id: string; codigo: string }> = {};
    for (const p of projetosRaw || []) {
      projetoMap[p.id] = { nome: p.nome_cliente, codigo: p.codigo_cliente || "" };
      projetoPorNome[p.nome_cliente] = { id: p.id, codigo: p.codigo_cliente || "" };
    }

    const projetoIds = (projetosRaw || []).map((p: any) => p.id);

    // 2. Alertas ativos por projeto
    let alertaMap: Record<string, "critico" | "alto" | "normal"> = {};
    if (projetoIds.length > 0) {
      const { data: alertasRaw } = await supabase
        .from("projeto_alertas")
        .select("projeto_id, severidade")
        .in("projeto_id", projetoIds)
        .eq("resolvido", false);

      for (const al of alertasRaw || []) {
        const atual = alertaMap[al.projeto_id];
        if (al.severidade === "critico") alertaMap[al.projeto_id] = "critico";
        else if (al.severidade === "alto" && atual !== "critico") alertaMap[al.projeto_id] = "alto";
        else if (!atual) alertaMap[al.projeto_id] = "normal";
      }
    }

    // 3. Fonte 1: Agendas futuras confirmadas
    // FIX: removido campo "modalidade" que nao existe em agendas
    const { data: agendasRaw } = await supabase
      .from("agendas")
      .select("id, cliente, data, atividade, atividade_descricao, item_cronograma, codigo_cliente")
      .eq("user_id", userId)
      .eq("status", "confirmada")
      .gte("data", hj)
      .lte("data", limite)
      .order("data", { ascending: true });

    const agendasBuilt: BacklogAgenda[] = (agendasRaw || []).map((ag: any) => {
      const proj      = projetoPorNome[ag.cliente];
      const projId    = proj?.id || "";
      const alertaSev = alertaMap[projId] || "normal";
      const dias      = diasEntreDatas(hj, ag.data);
      const score     = scoreAgenda(dias, alertaSev);
      return {
        id:               `agenda-${ag.id}`,
        agendaId:         ag.id,
        tipo:             "agenda" as const,
        projeto:          ag.cliente,
        projetoId:        projId,
        codigoCliente:    ag.codigo_cliente || proj?.codigo || "",
        atividade:        ag.atividade_descricao || ag.atividade || "",
        itemCronograma:   ag.item_cronograma || null,
        data:             ag.data,
        score,
        faixa:            faixaScore(score),
        alertaSeveridade: alertaSev,
      };
    });

    // 4. Fonte 2a: Documentos pendentes passados
    const { data: agendasDocRaw } = await supabase
      .from("agendas")
      .select("id, cliente, data, atividade, atividade_descricao, item_cronograma, codigo_cliente")
      .eq("user_id", userId)
      .eq("status", "doc_pendente");

    const docsPassados: BacklogDocumento[] = [];
    for (const ag of agendasDocRaw || []) {
      const proj      = projetoPorNome[ag.cliente];
      const projId    = proj?.id || "";
      const alertaSev = alertaMap[projId] || "normal";
      const diasAb    = diasEntreDatas(ag.data, hj);

      let tipoDoc: string | null = null;
      if (ag.item_cronograma) {
        const codigo = ag.item_cronograma.split(" - ")[0].trim();
        const { data: ci } = await supabase
          .from("cronograma_itens")
          .select("doc_exigido, doc_satisfeito, tipo_documento_id")
          .ilike("codigo", codigo)
          .maybeSingle();
        if (ci?.doc_satisfeito) continue; // ja satisfeito
        if (ci?.doc_exigido) tipoDoc = ci.tipo_documento_id || null;
      }

      const score = scoreDocumento("doc_passado", diasAb, null, alertaSev);
      docsPassados.push({
        id:               `doc-passado-${ag.id}`,
        agendaId:         ag.id,
        tipo:             "doc_passado",
        projeto:          ag.cliente,
        projetoId:        projId,
        atividade:        ag.atividade_descricao || ag.atividade || "",
        itemCronograma:   ag.item_cronograma || null,
        tipoDocumento:    tipoDoc,
        data:             ag.data,
        diasEmAberto:     diasAb,
        score,
        faixa:            faixaScore(score),
        alertaSeveridade: alertaSev,
      });
    }

    // 5. Fonte 2b: Documentos planejados futuros
    const docsPlanejados: BacklogDocumento[] = [];
    for (const ag of agendasRaw || []) {
      if (!ag.item_cronograma) continue;
      const codigo = ag.item_cronograma.split(" - ")[0].trim();
      const { data: ci } = await supabase
        .from("cronograma_itens")
        .select("doc_exigido, doc_satisfeito, tipo_documento_id")
        .ilike("codigo", codigo)
        .maybeSingle();
      if (!ci || !ci.doc_exigido || ci.doc_satisfeito) continue;

      const proj      = projetoPorNome[ag.cliente];
      const projId    = proj?.id || "";
      const alertaSev = alertaMap[projId] || "normal";
      const diasAte   = diasEntreDatas(hj, ag.data);
      const score     = scoreDocumento("doc_planejado", null, diasAte, alertaSev);

      docsPlanejados.push({
        id:               `doc-plan-${ag.id}`,
        agendaId:         ag.id,
        tipo:             "doc_planejado",
        projeto:          ag.cliente,
        projetoId:        projId,
        atividade:        ag.atividade_descricao || ag.atividade || "",
        itemCronograma:   ag.item_cronograma || null,
        tipoDocumento:    ci.tipo_documento_id || null,
        data:             ag.data,
        diasEmAberto:     null,
        score,
        faixa:            faixaScore(score),
        alertaSeveridade: alertaSev,
      });
    }

    // 6. Fonte 3: Itens travados
    // FIX: cronograma_itens nao tem user_id -- filtrar por atividades dos projetos
    // e cruzar com apontamento_atividades para identificar o consultor
    const travadosBuilt: BacklogTravado[] = [];

    if (projetoIds.length > 0) {
      // Buscar atividades de todos os projetos
      const { data: ativsRaw } = await supabase
        .from("projeto_atividades")
        .select("id, projeto_id, codigo, descricao")
        .in("projeto_id", projetoIds);

      const ativIds = (ativsRaw || []).map((a: any) => a.id);
      const ativPorId: Record<string, { projetoId: string; codigo: string; descricao: string }> = {};
      for (const a of ativsRaw || []) {
        ativPorId[a.id] = { projetoId: a.projeto_id, codigo: a.codigo, descricao: a.descricao };
      }

      if (ativIds.length > 0) {
        // FIX: remover .eq("user_id", userId) -- cronograma_itens nao tem esse campo
        // Identificar itens do consultor via agendas que ele realizou
        const { data: agendasRealizadas } = await supabase
          .from("agendas")
          .select("item_cronograma")
          .eq("user_id", userId)
          .not("item_cronograma", "is", null)
          .in("status", ["apontamento_ok", "apontamento_ajustado", "em_aprovacao", "doc_pendente", "confirmada"]);

        // Extrair codigos de itens que o consultor ja trabalhou ou tem agenda
        const codigosConsultor = new Set(
          (agendasRealizadas || [])
            .map((a: any) => a.item_cronograma?.split(" - ")[0].trim())
            .filter(Boolean)
        );

        if (codigosConsultor.size > 0) {
          // Buscar esses itens com feeling < 100
          const { data: cisRaw } = await supabase
            .from("cronograma_itens")
            .select("id, atividade_id, codigo, descricao, percentual_feeling")
            .in("atividade_id", ativIds)
            .lt("percentual_feeling", 100);

          for (const ci of cisRaw || []) {
            // Verificar se este item pertence ao consultor
            if (!codigosConsultor.has(ci.codigo)) continue;

            // Verificar se ha agendas futuras confirmadas
            const { data: agendasFut } = await supabase
              .from("agendas")
              .select("id")
              .eq("user_id", userId)
              .eq("status", "confirmada")
              .ilike("item_cronograma", `${ci.codigo}%`)
              .gte("data", hj)
              .limit(1);

            if (agendasFut && agendasFut.length > 0) continue;

            // Calcular parado ha quantos dias
            const { data: ultimaAgenda } = await supabase
              .from("agendas")
              .select("data")
              .eq("user_id", userId)
              .ilike("item_cronograma", `${ci.codigo}%`)
              .lt("data", hj)
              .order("data", { ascending: false })
              .limit(1)
              .maybeSingle();

            const paradoHaDias = ultimaAgenda
              ? diasEntreDatas(ultimaAgenda.data, hj)
              : 999;

            const atv       = ativPorId[ci.atividade_id];
            const projId    = atv?.projetoId || "";
            const alertaSev = alertaMap[projId] || "normal";
            const score     = scoreTravado(paradoHaDias === 999 ? 0 : paradoHaDias, alertaSev);

            travadosBuilt.push({
              id:               `travado-${ci.id}`,
              cronogramaItemId: ci.id,
              tipo:             "travado",
              projeto:          projetoMap[projId]?.nome || "",
              projetoId:        projId,
              atividadeId:      ci.atividade_id,
              codigoItem:       ci.codigo,
              descricaoItem:    ci.descricao,
              feelingAtual:     ci.percentual_feeling || 0,
              paradoHaDias:     paradoHaDias === 999 ? 0 : paradoHaDias,
              score,
              faixa:            faixaScore(score),
              alertaSeveridade: alertaSev,
            });
          }
        }
      }
    }

    // 7. Mencoes pendentes do consultor
    const { data: mencoesRaw } = await supabase
      .from("projeto_diario_mencoes")
      .select("id, entrada_id, projeto_id, status, created_at")
      .eq("mencionado_id", userId)
      .in("status", ["pendente", "ciente"]);

    const mencoesBuilt: BacklogMencao[] = [];
    for (const m of mencoesRaw || []) {
      const { data: entrada } = await supabase
        .from("projeto_diario")
        .select("id, texto, user_id, data, projeto_id")
        .eq("id", m.entrada_id)
        .maybeSingle();
      if (!entrada) continue;

      const { data: autorProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", entrada.user_id)
        .maybeSingle();

      const proj = projetoMap[entrada.projeto_id] || { nome: "", codigo: "" };
      const alertaSev = alertaMap[entrada.projeto_id] || "normal";
      const score = alertaSev === "critico" ? 85 : alertaSev === "alto" ? 60 : 40;

      mencoesBuilt.push({
        id:           `mencao-${m.id}`,
        mencaoId:     m.id,
        tipo:         "mencao",
        projeto:      proj.nome || entrada.projeto_id?.slice(0,8) || "WDM",
        projetoId:    entrada.projeto_id,
        entradaId:    m.entrada_id,
        textoEntrada: entrada.texto,
        autorNome:    autorProfile?.name || null,
        dataEntrada:  entrada.data,
        status:       m.status as "pendente" | "ciente" | "resolvido",
        score,
        faixa:        faixaScore(score),
      });
    }

    // 8. Aplicar ordenacao e setar estado
    setAgendas(ordenar(agendasBuilt, ordenacao));
    setDocumentos(ordenar([...docsPassados, ...docsPlanejados], ordenacao));
    setTravados(ordenar(travadosBuilt, ordenacao));
    setMencoes(mencoesBuilt);
    setLoading(false);
  }, [userId]);

  // Acao: marcar mencao como ciente
  const marcarCienteMencao = useCallback(async (mencaoId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("projeto_diario_mencoes")
      .update({ status: "ciente", ciente_em: new Date().toISOString() })
      .eq("id", mencaoId);
    if (!error) setMencoes(prev => prev.map(m => m.mencaoId === mencaoId ? { ...m, status: "ciente" as const } : m));
    return !error;
  }, []);

  // Acao: marcar mencao como resolvida
  const marcarResolvidaMencao = useCallback(async (mencaoId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("projeto_diario_mencoes")
      .update({ status: "resolvido", resolvido_em: new Date().toISOString() })
      .eq("id", mencaoId);
    if (!error) setMencoes(prev => prev.filter(m => m.mencaoId !== mencaoId));
    return !error;
  }, []);

  // Acao: concluir item travado (feeling = 100)
  const concluirItemTravado = useCallback(async (
    cronogramaItemId: string
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("cronograma_itens")
      .update({ percentual_feeling: 100 })
      .eq("id", cronogramaItemId);

    if (!error) {
      setTravados(prev => prev.filter(t => t.cronogramaItemId !== cronogramaItemId));
    }
    return !error;
  }, []);

  // Totais e media de score -- base para futuro KPI BL-CONS-002
  const totalAgendas    = agendas.length;
  const totalDocumentos = documentos.length;
  const totalTravados   = travados.length;
  const totalMencoes    = mencoes.length;
  const totalItens      = totalAgendas + totalDocumentos + totalTravados + totalMencoes;

  const mediaScore = totalItens === 0 ? 0 : Math.round(
    [...agendas, ...documentos, ...travados]
      .reduce((acc, item) => acc + item.score, 0) / totalItens
  );

  const docsPassados   = documentos.filter(d => d.tipo === "doc_passado");
  const docsPlanejados = documentos.filter(d => d.tipo === "doc_planejado");

  return {
    agendas,
    documentos,
    docsPassados,
    docsPlanejados,
    travados,
    mencoes,
    loading,
    totalAgendas,
    totalDocumentos,
    totalTravados,
    totalMencoes,
    totalItens,
    mediaScore,
    loadBacklog,
    concluirItemTravado,
    marcarCienteMencao,
    marcarResolvidaMencao,
  };
}