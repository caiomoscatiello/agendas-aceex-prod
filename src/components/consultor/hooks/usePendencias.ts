// src/components/consultor/hooks/usePendencias.ts
// BL-019 — Pendências PMO do Consultor

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pendencia } from "../types/consultor.types";

function calcularDiasEmAberto(data: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataRef = new Date(data + "T00:00:00");
  const diff = hoje.getTime() - dataRef.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function usePendencias(userId: string | undefined) {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loadingPendencias, setLoadingPendencias] = useState(false);

  const loadPendencias = async () => {
    if (!userId) return;
    setLoadingPendencias(true);

    const hoje = new Date().toISOString().split("T")[0];

    // P1: Agendas com documentação pendente
    const { data: agendasDoc } = await supabase
      .from("agendas")
      .select("id, cliente, data, item_cronograma, atividade")
      .eq("user_id", userId)
      .eq("status", "doc_pendente");

    const pendenciasDoc: Pendencia[] = [];
    for (const ag of agendasDoc || []) {
      if (!ag.item_cronograma) {
        pendenciasDoc.push({
          id: `doc-${ag.id}`,
          tipo: "doc_pendente",
          cliente: ag.cliente,
          data: ag.data,
          titulo: "Documentação pendente",
          detalhe: ag.atividade || "Agenda com documento não enviado",
          diasEmAberto: calcularDiasEmAberto(ag.data),
          agendaId: ag.id,
        });
        continue;
      }

      // Verificar se doc_satisfeito no cronograma
      const codigoItem = ag.item_cronograma.split(" - ")[0].trim();
      const { data: ci } = await supabase
        .from("cronograma_itens")
        .select("id, codigo, descricao, doc_exigido, doc_satisfeito")
        .ilike("codigo", codigoItem)
        .maybeSingle();

      if (!ci || (ci.doc_exigido && !ci.doc_satisfeito)) {
        pendenciasDoc.push({
          id: `doc-${ag.id}`,
          tipo: "doc_pendente",
          cliente: ag.cliente,
          data: ag.data,
          titulo: ci ? `Doc pendente — ${ci.codigo}` : "Documentação pendente",
          detalhe: ci?.descricao || ag.atividade || "Documento não enviado",
          diasEmAberto: calcularDiasEmAberto(ag.data),
          agendaId: ag.id,
          itemCronograma: ag.item_cronograma,
        });
      }
    }

    // P2: Agendas com apontamento em atraso (confirmada com data passada)
    const { data: agendasAtrasadas } = await supabase
      .from("agendas")
      .select("id, cliente, data, atividade")
      .eq("user_id", userId)
      .eq("status", "confirmada")
      .lt("data", hoje);

    const pendenciasAtraso: Pendencia[] = (agendasAtrasadas || []).map(ag => ({
      id: `atraso-${ag.id}`,
      tipo: "apontamento_atrasado" as const,
      cliente: ag.cliente,
      data: ag.data,
      titulo: "Apontamento em atraso",
      detalhe: ag.atividade || "Agenda sem apontamento registrado",
      diasEmAberto: calcularDiasEmAberto(ag.data),
      agendaId: ag.id,
    }));

    // P3: Requisições de agenda aguardando aprovação
    const { data: requisicoes } = await supabase
      .from("requisicoes_agenda")
      .select("id, cliente, data, total_horas, modalidade, atividade")
      .eq("user_id", userId)
      .eq("status", "pendente");

    const pendenciasReq: Pendencia[] = (requisicoes || []).map(req => ({
      id: `req-${req.id}`,
      tipo: "requisicao_pendente" as const,
      cliente: req.cliente,
      data: req.data,
      titulo: "Requisição aguardando aprovação",
      detalhe: `${req.total_horas}h · ${req.modalidade}${req.atividade ? ` · ${req.atividade}` : ""}`,
      diasEmAberto: calcularDiasEmAberto(req.data),
    }));

    // Ordenar: doc_pendente > apontamento_atrasado > requisicao_pendente
    // Dentro de cada grupo: mais antigo primeiro
    const ordem: Record<string, number> = {
      doc_pendente: 0,
      apontamento_atrasado: 1,
      requisicao_pendente: 2,
    };

    const todas = [...pendenciasDoc, ...pendenciasAtraso, ...pendenciasReq].sort((a, b) => {
      const ordemDiff = ordem[a.tipo] - ordem[b.tipo];
      if (ordemDiff !== 0) return ordemDiff;
      return b.diasEmAberto - a.diasEmAberto;
    });

    setPendencias(todas);
    setLoadingPendencias(false);
  };

  const totalPendencias = pendencias.length;
  const porTipo = {
    doc_pendente: pendencias.filter(p => p.tipo === "doc_pendente"),
    apontamento_atrasado: pendencias.filter(p => p.tipo === "apontamento_atrasado"),
    requisicao_pendente: pendencias.filter(p => p.tipo === "requisicao_pendente"),
  };

  return { pendencias, totalPendencias, porTipo, loadingPendencias, loadPendencias };
}
