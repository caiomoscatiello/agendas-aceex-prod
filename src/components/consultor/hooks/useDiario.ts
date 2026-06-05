// src/components/consultor/hooks/useDiario.ts
// BL-CONS-001-F2 -- Hook useDiario v2
// Adiciona: mencoes, reply, ciente, resolver, usuarios_mencionaveis
// Retrocompativel com v1 (loadEntradas, insertEntrada continuam funcionando)
// Encoding: UTF-8 sem BOM

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type CategoriaDiario = "geral" | "decisao" | "ocorrencia" | "marco" | "alerta";
export type OrigemDiario    = "coordenador" | "consultor";
export type StatusMencao    = "pendente" | "ciente" | "resolvido";

export type UsuarioMencionavel = {
  id: string;
  name: string;
};

export type MencaoDetalhe = {
  id: string;
  entrada_id: string;
  mencionado_id: string;
  autor_id: string;
  status: StatusMencao;
  mencionado_nome: string | null;
  resolvido_por_nome: string | null;
  ciente_em: string | null;
  resolvido_em: string | null;
};

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
  // F2
  mencionados: string[];
  tem_mencao: boolean;
  resposta_de: string | null;
  tags: string[];
  criticidade: string | null;
  mencoes_detalhes: MencaoDetalhe[];
  replies: EntradaDiario[];
};

type InsertDiarioParams = {
  projeto_id: string;
  texto: string;
  categoria: CategoriaDiario;
  origem: OrigemDiario;
  agenda_id?: string | null;
  data?: string;
  mencionados?: string[];
  tags?: string[];
  criticidade?: string | null;
};

type ReplyParams = {
  projeto_id: string;
  entrada_id: string;
  texto: string;
  categoria?: CategoriaDiario;
  origem?: OrigemDiario;
  mencionados?: string[];
  tags?: string[];
  criticidade?: string | null;
};

export function useDiario() {
  const [entradas, setEntradas]     = useState<EntradaDiario[]>([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [usuariosMencionaveis, setUsuariosMencionaveis] = useState<UsuarioMencionavel[]>([]);
  const [loadingUsuarios, setLoadingUsuarios]           = useState(false);

  // - loadEntradas -
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
    const mapped: EntradaDiario[] = (data?.entradas || []).map((e: any) => mapEntrada(e));
    setEntradas(mapped);
    setLoading(false);
  }, []);

  // - insertEntrada -
  const insertEntrada = useCallback(async (params: InsertDiarioParams): Promise<boolean> => {
    if (!params.texto?.trim()) {
      toast({ title: "Texto obrigatorio", variant: "destructive" });
      return false;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: {
        action:       "insert",
        projeto_id:   params.projeto_id,
        texto:        params.texto.trim(),
        categoria:    params.categoria || "geral",
        origem:       params.origem || "coordenador",
        agenda_id:    params.agenda_id || null,
        data:         params.data || new Date().toISOString().split("T")[0],
        mencionados:  params.mencionados || [],
        tags:         params.tags || [],
        criticidade:  params.criticidade || null,
      },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar entrada", description: error.message, variant: "destructive" });
      return false;
    }
    if (data?.entrada) {
      const nova = mapEntrada(data.entrada);
      setEntradas(prev => [nova, ...prev]);
    }
    return true;
  }, []);

  // - insertReply -
  const insertReply = useCallback(async (params: ReplyParams): Promise<boolean> => {
    if (!params.texto?.trim()) {
      toast({ title: "Texto obrigatorio", variant: "destructive" });
      return false;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: {
        action:      "reply",
        projeto_id:  params.projeto_id,
        entrada_id:  params.entrada_id,
        texto:       params.texto.trim(),
        categoria:   params.categoria || "geral",
        origem:      params.origem || "consultor",
        mencionados: params.mencionados || [],
        tags:        params.tags || [],
        criticidade: params.criticidade || null,
      },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar resposta", description: error.message, variant: "destructive" });
      return false;
    }
    if (data?.reply) {
      const novoReply = mapEntrada(data.reply);
      // Inserir reply na entrada pai localmente
      setEntradas(prev => prev.map(e =>
        e.id === params.entrada_id
          ? { ...e, replies: [...(e.replies || []), novoReply] }
          : e
      ));
    }
    return true;
  }, []);

  // - marcarCiente -
  const marcarCiente = useCallback(async (mencaoId: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: { action: "ciente", mencao_id: mencaoId },
    });
    if (error) {
      toast({ title: "Erro ao marcar ciencia", description: error.message, variant: "destructive" });
      return false;
    }
    // Atualizar estado local
    setEntradas(prev => prev.map(e => ({
      ...e,
      mencoes_detalhes: e.mencoes_detalhes.map(m =>
        m.id === mencaoId
          ? { ...m, status: "ciente" as StatusMencao, ciente_em: new Date().toISOString() }
          : m
      ),
      replies: (e.replies || []).map(r => ({
        ...r,
        mencoes_detalhes: r.mencoes_detalhes.map(m =>
          m.id === mencaoId
            ? { ...m, status: "ciente" as StatusMencao, ciente_em: new Date().toISOString() }
            : m
        ),
      })),
    })));
    return true;
  }, []);

  // - marcarResolvido -
  const marcarResolvido = useCallback(async (mencaoId: string, entradaId: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: { action: "resolver", mencao_id: mencaoId },
    });
    if (error) {
      toast({ title: "Erro ao resolver mencao", description: error.message, variant: "destructive" });
      return false;
    }
    // Atualizar estado local
    setEntradas(prev => prev.map(e => {
      const atualizarMencoes = (mencoes: MencaoDetalhe[]) =>
        mencoes.map(m =>
          m.id === mencaoId
            ? { ...m, status: "resolvido" as StatusMencao, resolvido_em: new Date().toISOString() }
            : m
        );
      const entry = {
        ...e,
        mencoes_detalhes: atualizarMencoes(e.mencoes_detalhes),
        replies: (e.replies || []).map(r => ({
          ...r,
          mencoes_detalhes: atualizarMencoes(r.mencoes_detalhes),
        })),
      };
      // Verificar se todas mencoes da entrada estao resolvidas
      const todasResolvidas = entry.mencoes_detalhes.every(m => m.status === "resolvido");
      if (e.id === entradaId && todasResolvidas) {
        entry.tem_mencao = false;
      }
      return entry;
    }));
    return true;
  }, []);

  // - loadUsuariosMencionaveis -
  const loadUsuariosMencionaveis = useCallback(async (projetoId: string): Promise<void> => {
    if (!projetoId) return;
    setLoadingUsuarios(true);
    const { data, error } = await supabase.functions.invoke("diario-entry", {
      body: { action: "usuarios_mencionaveis", projeto_id: projetoId },
    });
    setLoadingUsuarios(false);
    if (error) return;
    setUsuariosMencionaveis(data?.usuarios || []);
  }, []);

  // - Helpers de UI -
  const getCategoriaLabel = (cat: CategoriaDiario): string => ({
    geral: "Geral", decisao: "Decisao", ocorrencia: "Ocorrencia",
    marco: "Marco", alerta: "Alerta",
  }[cat] || cat);

  const getCategoriaCores = (cat: CategoriaDiario): { bg: string; text: string; border: string } => ({
    geral:      { bg: "bg-gray-50",   text: "text-gray-700",   border: "border-gray-300" },
    decisao:    { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-300" },
    ocorrencia: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-300" },
    marco:      { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-300" },
    alerta:     { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-300" },
  }[cat] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300" });

  const getStatusMencaoCores = (status: StatusMencao) => ({
    pendente:  { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-300",     label: "Pendente" },
    ciente:    { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-300",   label: "Ciente" },
    resolvido: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", label: "Resolvido" },
  }[status] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300", label: status });

  // Total de mencoes pendentes do usuario atual (para badge na sidebar)
  const totalMencoesPendentes = (userId: string): number => {
    let total = 0;
    for (const e of entradas) {
      for (const m of e.mencoes_detalhes) {
        if (m.mencionado_id === userId && m.status === "pendente") total++;
      }
      for (const r of e.replies || []) {
        for (const m of r.mencoes_detalhes) {
          if (m.mencionado_id === userId && m.status === "pendente") total++;
        }
      }
    }
    return total;
  };

  return {
    entradas,
    loading,
    saving,
    usuariosMencionaveis,
    loadingUsuarios,
    loadEntradas,
    insertEntrada,
    insertReply,
    marcarCiente,
    marcarResolvido,
    loadUsuariosMencionaveis,
    getCategoriaLabel,
    getCategoriaCores,
    getStatusMencaoCores,
    totalMencoesPendentes,
  };
}

// - Mapper interno -

function mapEntrada(e: any): EntradaDiario {
  return {
    id:              e.id,
    projeto_id:      e.projeto_id,
    user_id:         e.user_id,
    data:            e.data,
    categoria:       e.categoria as CategoriaDiario,
    texto:           e.texto,
    origem:          e.origem as OrigemDiario,
    agenda_id:       e.agenda_id || null,
    created_at:      e.created_at,
    autor_nome:      e.profiles?.name || null,
    mencionados:     e.mencionados || [],
    tem_mencao:      e.tem_mencao || false,
    resposta_de:     e.resposta_de || null,
    tags:            e.tags || [],
    criticidade:     e.criticidade || null,
    mencoes_detalhes: (e.mencoes_detalhes || []).map((m: any) => ({
      id:                m.id,
      entrada_id:        m.entrada_id,
      mencionado_id:     m.mencionado_id,
      autor_id:          m.autor_id,
      status:            m.status as StatusMencao,
      mencionado_nome:   m.mencionado_nome || null,
      resolvido_por_nome: m.resolvido_por_nome || null,
      ciente_em:         m.ciente_em || null,
      resolvido_em:      m.resolvido_em || null,
    })),
    replies: (e.replies || []).map((r: any) => mapEntrada(r)),
  };
}