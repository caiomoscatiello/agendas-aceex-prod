// src/components/consultor/hooks/useAgendas.ts

import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Agenda, Apontamento, RequisicaoPendente } from "../types/consultor.types";

export function useAgendas(userId: string | undefined, currentMonth: Date) {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [requisicoesPendentes, setRequisicoesPendentes] = useState<RequisicaoPendente[]>([]);

  const loadData = async () => {
    if (!userId) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const [agRes, apRes, reqRes] = await Promise.all([
      supabase
        .from("agendas")
        .select("id, cliente, data, atividade, status, atividade_descricao, item_cronograma")
        .eq("user_id", userId)
        .gte("data", start)
        .lte("data", end),
      supabase
        .from("apontamentos")
        .select("id, data, hora, cliente, tipo, endereco")
        .eq("user_id", userId)
        .gte("data", start)
        .lte("data", end),
      supabase
        .from("requisicoes_agenda")
        .select("id, data, cliente, atividade, total_horas, modalidade")
        .eq("user_id", userId)
        .eq("status", "pendente")
        .gte("data", start)
        .lte("data", end),
    ]);

    setAgendas(agRes.data || []);
    setApontamentos(apRes.data || []);
    setRequisicoesPendentes(reqRes.data || []);
  };

  return { agendas, apontamentos, requisicoesPendentes, loadData, setAgendas };
}
