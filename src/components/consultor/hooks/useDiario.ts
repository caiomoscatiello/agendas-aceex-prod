// BL-009 -- Hook useDiario
// Arquivo: src/components/consultor/hooks/useDiario.ts
// CRIAR arquivo novo — nao altera nenhum arquivo existente
// Encoding: UTF-8 sem BOM

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type CategoriaDiario = "geral" | "decisao" | "ocorrencia" | "marco" | "alerta";
export type OrigemDiario = "coordenador" | "consultor";

export type EntradaDiario = {
  id: string;
  projeto_id: string;
  user_id: string;
  data: string;
  categoria: CategoriaDiario;
  texto: string;
  origem: OrigemDiario;
  agenda_id: string | null;
  created_at: string;
  autor_nome?: string;
};

type InsertDiarioParams = {
  projeto_id: string;
  texto: string;
  categoria: CategoriaDiario;
  origem: OrigemDiario;
  agenda_id?: string | null;
  data?: string;
};

export function useDiario() {
  const [entradas, setEntradas] = useState<EntradaDiario[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEntradas = useCallback(async (projetoId: string) => {
    if (!projetoId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: { action: "list", projeto_id: projetoId, limit: 50 },
    });
    if (error) {
      toast({ title: "Erro ao carregar diario", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const mapped: EntradaDiario[] = (data?.entradas || []).map((e: any) => ({
      id: e.id,
      projeto_id: e.projeto_id,
      user_id: e.user_id,
      data: e.data,
      categoria: e.categoria as CategoriaDiario,
      texto: e.texto,
      origem: e.origem as OrigemDiario,
      agenda_id: e.agenda_id || null,
      created_at: e.created_at,
      autor_nome: e.profiles?.name || null,
    }));
    setEntradas(mapped);
    setLoading(false);
  }, []);

  const insertEntrada = useCallback(async (params: InsertDiarioParams): Promise<boolean> => {
    if (!params.texto?.trim()) {
      toast({ title: "Texto obrigatorio", variant: "destructive" });
      return false;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: {
        action: "insert",
        projeto_id: params.projeto_id,
        texto: params.texto.trim(),
        categoria: params.categoria || "geral",
        origem: params.origem || "coordenador",
        agenda_id: params.agenda_id || null,
        data: params.data || new Date().toISOString().split("T")[0],
      },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar entrada", description: error.message, variant: "destructive" });
      return false;
    }
    if (data?.entrada) {
      const nova: EntradaDiario = {
        id: data.entrada.id,
        projeto_id: data.entrada.projeto_id,
        user_id: data.entrada.user_id,
        data: data.entrada.data,
        categoria: data.entrada.categoria,
        texto: data.entrada.texto,
        origem: data.entrada.origem,
        agenda_id: data.entrada.agenda_id || null,
        created_at: data.entrada.created_at,
        autor_nome: undefined,
      };
      setEntradas((prev) => [nova, ...prev]);
    }
    return true;
  }, []);

  const getCategoriaLabel = (cat: CategoriaDiario): string => {
    const labels: Record<CategoriaDiario, string> = {
      geral: "Geral",
      decisao: "Decisao",
      ocorrencia: "Ocorrencia",
      marco: "Marco",
      alerta: "Alerta",
    };
    return labels[cat] || cat;
  };

  const getCategoriaCores = (cat: CategoriaDiario): { bg: string; text: string; border: string } => {
    const map: Record<CategoriaDiario, { bg: string; text: string; border: string }> = {
      geral:      { bg: "bg-gray-50",   text: "text-gray-700",   border: "border-gray-300" },
      decisao:    { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-300" },
      ocorrencia: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300" },
      marco:      { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-300" },
      alerta:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-300" },
    };
    return map[cat] || map.geral;
  };

  return { entradas, loading, saving, loadEntradas, insertEntrada, getCategoriaLabel, getCategoriaCores };
}
