// src/components/consultor/hooks/useTimesheet.ts

import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export function useTimesheet(userId: string | undefined, currentMonth: Date) {
  const [tsAgendadas, setTsAgendadas] = useState(0);
  const [tsApontadas, setTsApontadas] = useState(0);
  const [tsSemanas, setTsSemanas] = useState<{ label: string; agendadas: number; apontadas: number }[]>([]);
  const [tsProjetos, setTsProjetos] = useState<{ cliente: string; horas: number }[]>([]);
  const [vgAgendasConfirmadas, setVgAgendasConfirmadas] = useState(0);
  const [vgAgendasApontadas, setVgAgendasApontadas] = useState(0);
  const [vgDiasLivres, setVgDiasLivres] = useState(0);
  const [vgProjetos, setVgProjetos] = useState(0);

  const calcularTimesheet = async () => {
    if (!userId) return;

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data: agendasMes } = await supabase
      .from("agendas")
      .select("id, data, cliente, status")
      .eq("user_id", userId)
      .eq("status", "confirmada")
      .gte("data", start)
      .lte("data", end);

    const { data: todasAgendasMes } = await supabase
      .from("agendas")
      .select("id, data, cliente")
      .eq("user_id", userId)
      .in("status", ["confirmada", "apontamento_ok", "apontamento_ajustado", "em_aprovacao", "doc_pendente"])
      .gte("data", start)
      .lte("data", end);

    const totalAgendadas = (todasAgendasMes || []).length;
    setTsAgendadas(totalAgendadas);

    const { data: agendasApontadas } = await supabase
      .from("agendas")
      .select("id, data, cliente")
      .eq("user_id", userId)
      .in("status", ["apontamento_ok", "apontamento_ajustado", "em_aprovacao"])
      .gte("data", start)
      .lte("data", end);

    setTsApontadas((agendasApontadas || []).length);

    // Calcular semanas do mês
    const diasDoMes = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const semanas: { label: string; agendadas: number; apontadas: number }[] = [];
    let semanaAtual = 1;
    let inicioSemana = diasDoMes[0];

    for (let i = 0; i < diasDoMes.length; i++) {
      const dia = diasDoMes[i];
      const fimDaSemana = i === diasDoMes.length - 1 || getDay(diasDoMes[i + 1]) === 0;
      if (fimDaSemana || i === diasDoMes.length - 1) {
        const startStr = format(inicioSemana, "yyyy-MM-dd");
        const endStr = format(dia, "yyyy-MM-dd");
        const ag = (todasAgendasMes || []).filter(a => a.data >= startStr && a.data <= endStr).length;
        const ap = (agendasApontadas || []).filter(a => a.data >= startStr && a.data <= endStr).length;
        semanas.push({ label: `S${semanaAtual}`, agendadas: ag, apontadas: ap });
        semanaAtual++;
        if (i < diasDoMes.length - 1) inicioSemana = diasDoMes[i + 1];
      }
    }
    setTsSemanas(semanas);

    const projetoMap: Record<string, number> = {};
    for (const ag of agendasApontadas || []) {
      projetoMap[ag.cliente] = (projetoMap[ag.cliente] || 0) + 1;
    }
    setTsProjetos(Object.entries(projetoMap).map(([cliente, horas]) => ({ cliente, horas })));

    setVgAgendasConfirmadas(totalAgendadas);
    setVgAgendasApontadas((agendasApontadas || []).length);
    setVgProjetos(new Set([...(agendasMes || []), ...(agendasApontadas || [])].map(a => a.cliente)).size);

    const todasAgendas = new Set([
      ...(todasAgendasMes || []).map(a => a.data),
      ...(agendasApontadas || []).map(a => a.data),
    ]);
    const diasUteis = diasDoMes.filter(d => getDay(d) !== 0 && getDay(d) !== 6);
    setVgDiasLivres(diasUteis.filter(d => !todasAgendas.has(format(d, "yyyy-MM-dd"))).length);
  };

  return {
    tsAgendadas, tsApontadas, tsSemanas, tsProjetos,
    vgAgendasConfirmadas, vgAgendasApontadas, vgDiasLivres, vgProjetos,
    calcularTimesheet,
  };
}
