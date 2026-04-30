// src/components/consultor/hooks/useBacklog.ts
// BL-004-B — Backlog do Projeto

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BacklogColuna = {
  id: string;
  projeto_id: string;
  nome: string;
  cor: string;
  ordem: number;
  status_sistema: string | null;
  wip_limite: number | null;
};

export type BacklogItem = {
  id: string;
  codigo: string;
  projeto_id: string;
  coluna_id: string;
  atividade_id: string | null;
  cronograma_item_id: string | null;
  pai_id: string | null;
  titulo: string;
  descricao_solicitante: string | null;
  descricao_complementar: string | null;
  descricao_solucao: string | null;
  tipo: string;
  prioridade: string;
  prioridade_reclassificada: string | null;
  frente_modulo: string;
  estimativa_horas: number | null;
  tempo_efetivo_horas: number | null;
  criado_por: string;
  atribuido_para: string | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  documento_url: string | null;
  documento_nome: string | null;
  visivel_cliente: boolean;
  hierarquia_bloqueada: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  // joins opcionais
  criado_por_nome?: string;
  atribuido_para_nome?: string;
  filhos?: BacklogItem[];
};

export type BacklogComentario = {
  id: string;
  backlog_item_id: string;
  autor_id: string;
  autor_nome?: string;
  texto: string;
  created_at: string;
};

export type BacklogHistorico = {
  id: string;
  backlog_item_id: string;
  de_coluna_nome?: string;
  para_coluna_nome?: string;
  movido_por_nome?: string;
  moved_at: string;
  tipo_evento: string;
  detalhe: any;
  comentario: string | null;
};

export function useBacklog(projetoId: string | null, userId: string | undefined) {
  const [colunas, setColunas] = useState<BacklogColuna[]>([]);
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const loadBoard = useCallback(async () => {
    if (!projetoId) return;
    setLoadingBoard(true);

    const [colRes, itemRes] = await Promise.all([
      supabase
        .from("projeto_backlog_colunas")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("ordem"),
      supabase
        .from("projeto_backlog")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("ordem"),
    ]);

    // Buscar nomes dos usuários
    const userIds = [
      ...new Set([
        ...(itemRes.data || []).map((i: any) => i.criado_por),
        ...(itemRes.data || []).map((i: any) => i.atribuido_para).filter(Boolean),
      ])
    ];

    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      (profiles || []).forEach((p: any) => { profilesMap[p.user_id] = p.name; });
    }

    const itemsComNomes = (itemRes.data || []).map((i: any) => ({
      ...i,
      criado_por_nome: profilesMap[i.criado_por] || "—",
      atribuido_para_nome: i.atribuido_para ? profilesMap[i.atribuido_para] : null,
    }));

    setColunas(colRes.data || []);
    setItems(itemsComNomes);
    setLoadingBoard(false);
  }, [projetoId]);

  const moverItem = async (itemId: string, novaColunaId: string, moverFilhos = false) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.coluna_id === novaColunaId) return;

    const idsParaMover = [itemId];
    if (moverFilhos) {
      const filhos = items.filter(i => i.pai_id === itemId);
      idsParaMover.push(...filhos.map(f => f.id));
    }

    // Atualizar localmente (otimista)
    setItems(prev => prev.map(i =>
      idsParaMover.includes(i.id) ? { ...i, coluna_id: novaColunaId } : i
    ));

    // Salvar no banco
    await supabase
      .from("projeto_backlog")
      .update({ coluna_id: novaColunaId })
      .in("id", idsParaMover);

    // Registrar histórico
    const tipo = moverFilhos && idsParaMover.length > 1 ? "movimentacao_bloco" : "movimentacao";
    await supabase.from("projeto_backlog_historico").insert({
      backlog_item_id: itemId,
      de_coluna_id: item.coluna_id,
      para_coluna_id: novaColunaId,
      movido_por: userId!,
      tipo_evento: tipo,
      detalhe: moverFilhos && idsParaMover.length > 1
        ? { filhos_movidos: idsParaMover.slice(1) }
        : null,
    });
  };

  const criarItem = async (data: Partial<BacklogItem>) => {
    if (!projetoId || !userId) return null;
    setSavingItem(true);

    // Pegar primeira coluna (Aberto)
    const primeiraColuna = colunas.find(c => c.status_sistema === "aberto") || colunas[0];
    if (!primeiraColuna) { setSavingItem(false); return null; }

    const { data: novo, error } = await supabase
      .from("projeto_backlog")
      .insert({
        projeto_id: projetoId,
        coluna_id: data.coluna_id || primeiraColuna.id,
        titulo: data.titulo || "",
        descricao_solicitante: data.descricao_solicitante || null,
        tipo: data.tipo || "melhoria",
        prioridade: data.prioridade || "media",
        frente_modulo: data.frente_modulo || "outro",
        estimativa_horas: data.estimativa_horas || null,
        atribuido_para: data.atribuido_para || null,
        data_prevista: data.data_prevista || null,
        atividade_id: data.atividade_id || null,
        cronograma_item_id: data.cronograma_item_id || null,
        criado_por: userId,
        ordem: items.filter(i => i.coluna_id === (data.coluna_id || primeiraColuna.id)).length,
      })
      .select()
      .single();

    setSavingItem(false);
    if (error || !novo) return null;

    // Histórico de criação
    await supabase.from("projeto_backlog_historico").insert({
      backlog_item_id: novo.id,
      para_coluna_id: novo.coluna_id,
      movido_por: userId,
      tipo_evento: "criacao",
      detalhe: { titulo: novo.titulo },
    });

    await loadBoard();
    return novo;
  };

  const salvarItem = async (itemId: string, data: Partial<BacklogItem>) => {
    setSavingItem(true);
    await supabase
      .from("projeto_backlog")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    // Histórico de edição
    await supabase.from("projeto_backlog_historico").insert({
      backlog_item_id: itemId,
      para_coluna_id: items.find(i => i.id === itemId)?.coluna_id || "",
      movido_por: userId!,
      tipo_evento: "edicao",
      detalhe: data,
    });

    setSavingItem(false);
    await loadBoard();
  };

  const adicionarComentario = async (itemId: string, texto: string) => {
    if (!userId || !texto.trim()) return;
    const { error } = await supabase.from("projeto_backlog_comentarios").insert({
      backlog_item_id: itemId,
      autor_id: userId,
      texto: texto.trim(),
    });
    return !error;
  };

  const loadComentarios = async (itemId: string): Promise<BacklogComentario[]> => {
    const { data: comentarios } = await supabase
      .from("projeto_backlog_comentarios")
      .select("*")
      .eq("backlog_item_id", itemId)
      .order("created_at", { ascending: true });

    if (!comentarios?.length) return [];

    const autorIds = [...new Set(comentarios.map((c: any) => c.autor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", autorIds);

    const profilesMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profilesMap[p.user_id] = p.name; });

    return comentarios.map((c: any) => ({
      ...c,
      autor_nome: profilesMap[c.autor_id] || "—",
    }));
  };

  const loadHistorico = async (itemId: string): Promise<BacklogHistorico[]> => {
    const { data: historico } = await supabase
      .from("projeto_backlog_historico")
      .select("*")
      .eq("backlog_item_id", itemId)
      .order("moved_at", { ascending: true });

    if (!historico?.length) return [];

    // Buscar nomes das colunas e usuários
    const colunaIds = [
      ...new Set([
        ...historico.map((h: any) => h.de_coluna_id).filter(Boolean),
        ...historico.map((h: any) => h.para_coluna_id).filter(Boolean),
      ])
    ];
    const userIds = [...new Set(historico.map((h: any) => h.movido_por).filter(Boolean))];

    const [colRes, profRes] = await Promise.all([
      colunaIds.length > 0
        ? supabase.from("projeto_backlog_colunas").select("id, nome").in("id", colunaIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from("profiles").select("user_id, name").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const colMap: Record<string, string> = {};
    (colRes.data || []).forEach((c: any) => { colMap[c.id] = c.nome; });
    const profMap: Record<string, string> = {};
    (profRes.data || []).forEach((p: any) => { profMap[p.user_id] = p.name; });

    return historico.map((h: any) => ({
      ...h,
      de_coluna_nome: h.de_coluna_id ? colMap[h.de_coluna_id] : null,
      para_coluna_nome: h.para_coluna_id ? colMap[h.para_coluna_id] : null,
      movido_por_nome: profMap[h.movido_por] || "—",
    }));
  };

  const itemsPorColuna = (colunaId: string) =>
    items
      .filter(i => i.coluna_id === colunaId && !i.pai_id)
      .sort((a, b) => a.ordem - b.ordem);

  const filhosDoItem = (itemId: string) =>
    items.filter(i => i.pai_id === itemId).sort((a, b) => a.ordem - b.ordem);

  const temBoard = colunas.length > 0;

  return {
    colunas, items, loadingBoard, savingItem,
    loadBoard, moverItem, criarItem, salvarItem, adicionarComentario,
    loadComentarios, loadHistorico,
    itemsPorColuna, filhosDoItem, temBoard,
  };
}

// src/components/consultor/hooks/useBacklog.ts
// BL-004-B — Backlog do Projeto

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BacklogColuna = {
  id: string;
  projeto_id: string;
  nome: string;
  cor: string;
  ordem: number;
  status_sistema: string | null;
  wip_limite: number | null;
};

export type BacklogItem = {
  id: string;
  codigo: string;
  projeto_id: string;
  coluna_id: string;
  atividade_id: string | null;
  cronograma_item_id: string | null;
  pai_id: string | null;
  titulo: string;
  descricao_solicitante: string | null;
  descricao_complementar: string | null;
  descricao_solucao: string | null;
  tipo: string;
  prioridade: string;
  prioridade_reclassificada: string | null;
  frente_modulo: string;
  estimativa_horas: number | null;
  tempo_efetivo_horas: number | null;
  criado_por: string;
  atribuido_para: string | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  documento_url: string | null;
  documento_nome: string | null;
  visivel_cliente: boolean;
  hierarquia_bloqueada: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  // joins opcionais
  criado_por_nome?: string;
  atribuido_para_nome?: string;
  filhos?: BacklogItem[];
};

export type BacklogComentario = {
  id: string;
  backlog_item_id: string;
  autor_id: string;
  autor_nome?: string;
  texto: string;
  created_at: string;
};

export type BacklogHistorico = {
  id: string;
  backlog_item_id: string;
  de_coluna_nome?: string;
  para_coluna_nome?: string;
  movido_por_nome?: string;
  moved_at: string;
  tipo_evento: string;
  detalhe: any;
  comentario: string | null;
};

export type BacklogParticipante = {
  id: string;
  backlog_item_id: string;
  user_id: string;
  papel: string;
  nome?: string;
  created_at: string;
};


