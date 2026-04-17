import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, Trash2, Loader2, Settings, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Agenda = {
  id: string;
  usuario: string;
  email: string;
  cliente: string;
  data: string;
  atividade: string;
  status: string;
  user_id: string;
  monday_item_id: string | null;
  item_cronograma: string | null;
  flag_integracao: string | null;
  has_apontamento: boolean;
  origem: string;
};

type Profile = {
  user_id: string;
  name: string;
  email: string;
};

type Projeto = {
  id: string;
  nome_cliente: string;
};

export default function AdminManutencaoAgendas() {
  const { role } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProjeto, setSelectedProjeto] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadedProfiles, setLoadedProfiles] = useState(false);
  const [loadedProjetos, setLoadedProjetos] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [projetosLoading, setProjetosLoading] = useState(false);

  // Edit modal states
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editData, setEditData] = useState<Date | undefined>();
  const [editAtividade, setEditAtividade] = useState("");
  const [editItemCronograma, setEditItemCronograma] = useState("");
  const [editAtividades, setEditAtividades] = useState<{ id: string; codigo: string; descricao: string }[]>([]);
  const [editItens, setEditItens] = useState<{ id: string; codigo: string; descricao: string }[]>([]);
  const [editLoadingDados, setEditLoadingDados] = useState(false);

  // Lote modal states
  const [loteOpen, setLoteOpen] = useState(false);
  const [loteSaving, setLoteSaving] = useState(false);
  const [loteAtividade, setLoteAtividade] = useState("");
  const [loteItemCronograma, setLoteItemCronograma] = useState("");
  const [loteAtividades, setLoteAtividades] = useState<{ id: string; codigo: string; descricao: string }[]>([]);
  const [loteItens, setLoteItens] = useState<{ id: string; codigo: string; descricao: string }[]>([]);
  const [loteLoadingDados, setLoteLoadingDados] = useState(false);
  const [loteResultado, setLoteResultado] = useState<{ ok: number; falha: number } | null>(null);

  const ALL_STATUSES = [
    { value: "pendente", label: "Pendente" },
    { value: "confirmada", label: "Confirmada" },
    { value: "em_aprovacao", label: "Em Aprovação" },
    { value: "apontamento_ok", label: "Apontamento OK" },
    { value: "apontamento_ajustado", label: "Apontamento Ajustado" },
    { value: "aguardando_cancelamento", label: "Aguardando Cancelamento" },
    { value: "aguard_aprovacao", label: "Aguard. Aprov." },
  ];
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(ALL_STATUSES.map(s => s.value)));

  const dataFimTriggerRef = useRef<HTMLButtonElement>(null);

  const loadProfiles = async (force = false) => {
    if (!force && loadedProfiles && profiles.length > 0) return;
    setProfilesLoading(true);
    try {
      if (role === "admin" || role === "coordenador") {
        const res = await supabase.functions.invoke("agendas-maintenance", {
          body: { action: "list_consultants" },
        });
        if (res.error || res.data?.error) {
          toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
          setProfiles([]);
        } else {
          setProfiles(res.data?.profiles || []);
        }
        setLoadedProfiles(true);
        return;
      }
      const { data } = await supabase.from("profiles").select("user_id, name, email").order("name");
      setProfiles(data || []);
      setLoadedProfiles(true);
    } finally {
      setProfilesLoading(false);
    }
  };

  const loadProjetos = async (force = false) => {
    if (!force && loadedProjetos && projetos.length > 0) return;
    setProjetosLoading(true);
    try {
      if (role === "admin" || role === "coordenador") {
        const res = await supabase.functions.invoke("agendas-maintenance", {
          body: { action: "list_projects" },
        });
        if (res.error || res.data?.error) {
          toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
          setProjetos([]);
        } else {
          setProjetos(res.data?.projects || []);
        }
        setLoadedProjetos(true);
        return;
      }
      const { data } = await supabase.from("projetos").select("id, nome_cliente").order("nome_cliente");
      setProjetos(data || []);
      setLoadedProjetos(true);
    } finally {
      setProjetosLoading(false);
    }
  };

  const handleSelectDataInicio = (date: Date | undefined) => {
    setDataInicio(date);
    if (date) {
      setTimeout(() => {
        dataFimTriggerRef.current?.click();
      }, 150);
    }
  };

  const handleSearch = async () => {
    if (!dataInicio || !dataFim) {
      toast({ title: "Preencha o período", description: "Selecione a data de início e fim.", variant: "destructive" });
      return;
    }
    if (!selectedUserId && !selectedProjeto) {
      toast({ title: "Informe um filtro", description: "Selecione ao menos um projeto ou consultor.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setSelected(new Set());

    if (role === "admin" || role === "coordenador") {
      const res = await supabase.functions.invoke("agendas-maintenance", {
        body: {
          action: "search_agendas",
          ...(selectedUserId ? { user_id: selectedUserId } : {}),
          ...(selectedProjeto ? { cliente: selectedProjeto } : {}),
          start_date: format(dataInicio, "yyyy-MM-dd"),
          end_date: format(dataFim, "yyyy-MM-dd"),
        },
      });

      if (res.error || res.data?.error) {
        toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
      } else {
        const list = ((res.data?.agendas || []) as Agenda[]).filter(a => selectedStatuses.has(a.status));
        setAgendas(list);
        if (!list.length) {
          toast({ title: "Nenhuma agenda encontrada", description: "Não há agendas para os filtros informados." });
        }
      }

      setLoading(false);
      return;
    }

    // fallback
    let q = supabase
      .from("agendas")
      .select("id, usuario, email, cliente, data, atividade, status")
      .gte("data", format(dataInicio, "yyyy-MM-dd"))
      .lte("data", format(dataFim, "yyyy-MM-dd"))
      .order("data");

    if (selectedUserId) q = q.eq("user_id", selectedUserId);
    if (selectedProjeto) q = q.eq("cliente", selectedProjeto);

    const { data, error } = await q;

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const filtered = (data || []).filter(a => selectedStatuses.has(a.status));
      setAgendas(filtered as Agenda[]);
      if (!filtered.length) {
        toast({ title: "Nenhuma agenda encontrada", description: "Não há agendas para os filtros informados." });
      }
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === agendas.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(agendas.map((a) => a.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);

    const selectedAgendas = agendas.filter(a => selected.has(a.id));
    const agendaIds = selectedAgendas.filter(a => a.origem !== "requisicoes_agenda").map(a => a.id);
    const requisicaoIds = selectedAgendas.filter(a => a.origem === "requisicoes_agenda").map(a => a.id);

    if (role === "admin" || role === "coordenador") {
      const res = await supabase.functions.invoke("agendas-maintenance", {
        body: {
          action: "delete_agendas",
          ids: agendaIds,
          requisicao_ids: requisicaoIds,
        },
      });

      if (res.error || res.data?.error) {
        toast({ title: "Erro ao excluir", description: res.data?.error || res.error?.message, variant: "destructive" });
      } else {
        const deleted = Number(res.data?.deleted ?? 0);
        const skipped = Number(res.data?.skipped ?? 0);
        toast({
          title: "Sucesso",
          description: skipped > 0
            ? `${deleted} agenda(s) excluída(s). ${skipped} não permitida(s).`
            : `${deleted} agenda(s) excluída(s).`,
        });

        if (deleted > 0) {
          if (skipped > 0) {
            setSelected(new Set());
            await handleSearch();
          } else {
            setAgendas((prev) => prev.filter((a) => !selected.has(a.id)));
            setSelected(new Set());
          }
        }
      }

      setDeleting(false);
      return;
    }

    // fallback
    const allIds = Array.from(selected);
    const { error } = await supabase.from("agendas").delete().in("id", allIds);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `${allIds.length} agenda(s) excluída(s).` });
      setAgendas((prev) => prev.filter((a) => !selected.has(a.id)));
      setSelected(new Set());
    }
    setDeleting(false);
  };

  const uniqueDates = [...new Set(agendas.map((a) => a.data))].sort();

  const selectByDate = (date: string) => {
    const ids = agendas.filter((a) => a.data === date).map((a) => a.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // ── Edit handlers ──

  const handleOpenEdit = async (agenda: Agenda) => {
    setEditingAgenda(agenda);
    setEditData(agenda.data ? new Date(agenda.data + "T12:00:00") : undefined);
    setEditAtividade(agenda.atividade || "");
    setEditItemCronograma(agenda.item_cronograma || "");
    setEditAtividades([]);
    setEditItens([]);
    setEditOpen(true);
    setEditLoadingDados(true);

    const { data: projeto } = await supabase
      .from("projetos")
      .select("id")
      .eq("nome_cliente", agenda.cliente)
      .maybeSingle();

    if (projeto) {
      const { data: atividades } = await supabase
        .from("projeto_atividades")
        .select("id, codigo, descricao")
        .eq("projeto_id", projeto.id)
        .order("codigo");

      setEditAtividades(atividades || []);

      if (agenda.atividade) {
        const codigoAtv = agenda.atividade.split(" - ")[0].trim();
        const atv = (atividades || []).find((a) => a.codigo === codigoAtv);
        if (atv) {
          const { data: itens } = await supabase
            .from("cronograma_itens")
            .select("id, codigo, descricao")
            .eq("atividade_id", atv.id)
            .order("codigo");
          setEditItens(itens || []);
        }
      }
    }

    setEditLoadingDados(false);
  };

  const handleEditAtividadeChange = async (novoCodigo: string) => {
    setEditAtividade(novoCodigo);
    setEditItemCronograma("");
    setEditItens([]);

    const atv = editAtividades.find((a) => a.codigo === novoCodigo);
    if (atv) {
      const { data: itens } = await supabase
        .from("cronograma_itens")
        .select("id, codigo, descricao")
        .eq("atividade_id", atv.id)
        .order("codigo");
      setEditItens(itens || []);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAgenda || !editAtividade) {
      toast({ title: "Atividade é obrigatória", variant: "destructive" });
      return;
    }

    setEditSaving(true);

    try {
      if (editingAgenda.has_apontamento !== true) {
        const novaData = editData ? format(editData, "yyyy-MM-dd") : editingAgenda.data;

        // PASSO 1 — Buscar dados completos da agenda antes de deletar
        const { data: agendaCompleta, error: fetchErr } = await supabase
          .from("agendas")
          .select("id, user_id, cliente, data, atividade, item_cronograma, status, usuario, email, monday_item_id, flag_integracao, codigo_consultor, codigo_cliente, codigo_atividade")
          .eq("id", editingAgenda.id)
          .single();

        if (fetchErr || !agendaCompleta) {
          toast({ title: "Erro ao buscar dados da agenda", description: fetchErr?.message, variant: "destructive" });
          setEditSaving(false);
          return;
        }

        // PASSO 2 — Excluir no Protheus (delete) — aguarda retorno
        const deleteProtheusRes = await supabase.functions.invoke("protheus-agenda-sync", {
          body: {
            action: "excluir",
            agendas: [{
              data: agendaCompleta.data,
              cliente: agendaCompleta.cliente,
              user_id: agendaCompleta.user_id,
              atividade: agendaCompleta.atividade,
              flag_integracao: agendaCompleta.flag_integracao,
            }],
          },
        });

        if (deleteProtheusRes.error) {
          toast({ title: "Erro ao excluir no Protheus", description: deleteProtheusRes.error.message, variant: "destructive" });
          setEditSaving(false);
          return;
        }

        // PASSO 3 — Excluir agenda no Aceex
        const { error: deleteAceexErr } = await supabase
          .from("agendas")
          .delete()
          .eq("id", editingAgenda.id);

        if (deleteAceexErr) {
          toast({ title: "Erro ao excluir agenda no sistema", description: deleteAceexErr.message, variant: "destructive" });
          setEditSaving(false);
          return;
        }

        // PASSO 4 — Inserir nova agenda no Aceex com dados alterados
        const { data: novaAgenda, error: insertErr } = await supabase
          .from("agendas")
          .insert({
            user_id: agendaCompleta.user_id,
            usuario: agendaCompleta.usuario,
            email: agendaCompleta.email,
            cliente: agendaCompleta.cliente,
            data: novaData,
            atividade: editAtividade,
            item_cronograma: (editItemCronograma && editItemCronograma !== "__none__") ? editItemCronograma : null,
            status: agendaCompleta.status,
            flag_integracao: "LOVABLE",
          })
          .select("id")
          .single();

        if (insertErr || !novaAgenda) {
          toast({ title: "Erro ao criar agenda alterada", description: insertErr?.message, variant: "destructive" });
          setEditSaving(false);
          return;
        }

        // PASSO 5 — Incluir no Protheus (insert) — aguarda retorno
        const insertProtheusRes = await supabase.functions.invoke("protheus-agenda-sync", {
          body: {
            action: "incluir",
            agendas: [{
              data: novaData,
              cliente: agendaCompleta.cliente,
              user_id: agendaCompleta.user_id,
              atividade: editAtividade,
              flag_integracao: "LOVABLE",
            }],
          },
        });

        if (insertProtheusRes.error) {
          toast({
            title: "Agenda alterada, mas erro ao incluir no Protheus",
            description: insertProtheusRes.error.message,
            variant: "destructive",
          });
        }

        // PASSO 6 — Monday: delete subitem antigo + criar novo
        if (agendaCompleta.monday_item_id) {
          await supabase.functions.invoke("monday-agenda-sync", {
            body: {
              action: "delete",
              agenda_id: editingAgenda.id,
              monday_item_id: agendaCompleta.monday_item_id,
            },
          });
        }

        await supabase.functions.invoke("monday-agenda-sync", {
          body: { action: "create", agenda_id: novaAgenda.id },
        });

        // PASSO 7 — Registrar log da operação
        await supabase.from("integration_logs").insert({
          codigo: "EDIT-AGENDA",
          status: "success",
          message: `Agenda editada — ${agendaCompleta.cliente} / ${agendaCompleta.usuario} — ${agendaCompleta.data} → ${novaData} / ${agendaCompleta.atividade} → ${editAtividade}`,
          payload: {
            agenda_id_original: editingAgenda.id,
            agenda_id_nova: novaAgenda.id,
            data_anterior: agendaCompleta.data,
            data_nova: novaData,
            atividade_anterior: agendaCompleta.atividade,
            atividade_nova: editAtividade,
            item_anterior: agendaCompleta.item_cronograma,
            item_novo: (editItemCronograma && editItemCronograma !== "__none__") ? editItemCronograma : null,
            has_apontamento: false,
          },
        });

        toast({ title: "Agenda alterada com sucesso" });
      } else {
        // Cenário 3 — com apontamento: correção de alocação (sem sync Protheus)
        const { error: updateErr } = await supabase
          .from("agendas")
          .update({
            atividade: editAtividade,
            item_cronograma: (editItemCronograma && editItemCronograma !== "__none__") ? editItemCronograma : null,
          })
          .eq("id", editingAgenda.id);

        if (updateErr) {
          toast({
            title: "Erro ao corrigir alocação",
            description: updateErr.message,
            variant: "destructive",
          });
          setEditSaving(false);
          return;
        }

        // Registrar log da correção
        await supabase.from("integration_logs").insert({
          codigo: "EDIT-AGENDA",
          status: "success",
          message: `Correção de alocação — agenda ${editingAgenda.id} — atividade alterada para ${editAtividade} (sem sync Protheus)`,
          payload: {
            agenda_id: editingAgenda.id,
            atividade_anterior: editingAgenda.atividade,
            atividade_nova: editAtividade,
            item_anterior: editingAgenda.item_cronograma,
            item_novo: (editItemCronograma && editItemCronograma !== "__none__") ? editItemCronograma : null,
            has_apontamento: true,
          },
        });

        // Monday: delete subitem antigo + criar novo
        if (editingAgenda.monday_item_id) {
          await supabase.functions.invoke("monday-agenda-sync", {
            body: {
              action: "delete",
              agenda_id: editingAgenda.id,
              monday_item_id: editingAgenda.monday_item_id,
            },
          });
        }

        await supabase.functions.invoke("monday-agenda-sync", {
          body: { action: "create", agenda_id: editingAgenda.id },
        });

        toast({ title: "Correção de alocação aplicada com sucesso" });
      }

      setEditOpen(false);
      setEditingAgenda(null);
      await handleSearch();

    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }

    setEditSaving(false);
  };

  // ── Lote handlers ──

  const handleOpenLote = async () => {
    setLoteAtividade("");
    setLoteItemCronograma("");
    setLoteItens([]);
    setLoteResultado(null);
    setLoteOpen(true);
    setLoteLoadingDados(true);

    const selecionadas = agendas.filter((a) => selected.has(a.id));
    const clientesUnicos = [...new Set(selecionadas.map((a) => a.cliente))];

    if (clientesUnicos.length === 1) {
      const { data: projeto } = await supabase
        .from("projetos")
        .select("id")
        .eq("nome_cliente", clientesUnicos[0])
        .maybeSingle();

      if (projeto) {
        const { data: atividades } = await supabase
          .from("projeto_atividades")
          .select("id, codigo, descricao")
          .eq("projeto_id", projeto.id)
          .order("codigo");
        setLoteAtividades(atividades || []);
      }
    } else {
      const { data: projetosRes } = await supabase
        .from("projetos")
        .select("id")
        .in("nome_cliente", clientesUnicos);
      const projetoIds = (projetosRes || []).map((p) => p.id);

      if (projetoIds.length > 0) {
        const { data: atividades } = await supabase
          .from("projeto_atividades")
          .select("id, codigo, descricao")
          .in("projeto_id", projetoIds)
          .order("codigo");

        const seen = new Set<string>();
        const unicas = (atividades || []).filter((a) => {
          if (seen.has(a.codigo)) return false;
          seen.add(a.codigo);
          return true;
        });
        setLoteAtividades(unicas);
      }
    }

    setLoteLoadingDados(false);
  };

  const handleLoteAtividadeChange = async (novoCodigo: string) => {
    setLoteAtividade(novoCodigo);
    setLoteItemCronograma("");
    setLoteItens([]);
    const atv = loteAtividades.find((a) => a.codigo === novoCodigo);
    if (atv) {
      const { data: itens } = await supabase
        .from("cronograma_itens")
        .select("id, codigo, descricao")
        .eq("atividade_id", atv.id)
        .order("codigo");
      setLoteItens(itens || []);
    }
  };

  const handleSaveLote = async () => {
    if (!loteAtividade) {
      toast({ title: "Selecione a atividade destino", variant: "destructive" });
      return;
    }

    setLoteSaving(true);
    const selecionadas = agendas.filter((a) => selected.has(a.id));
    let ok = 0;
    let falha = 0;

    for (const agenda of selecionadas) {
      try {
        if (agenda.has_apontamento === true) {
          const { error: updateErr } = await supabase
            .from("agendas")
            .update({
              atividade: loteAtividade,
              item_cronograma: (loteItemCronograma && loteItemCronograma !== "__none__") ? loteItemCronograma : null,
            })
            .eq("id", agenda.id);

          if (updateErr) throw new Error(updateErr.message);

          await supabase.from("integration_logs").insert({
            codigo: "EDIT-AGENDA-LOTE",
            status: "success",
            message: `Correção de alocação em lote — agenda ${agenda.id} — ${agenda.atividade} → ${loteAtividade}`,
            payload: {
              agenda_id: agenda.id,
              atividade_anterior: agenda.atividade,
              atividade_nova: loteAtividade,
              item_novo: (loteItemCronograma && loteItemCronograma !== "__none__") ? loteItemCronograma : null,
              has_apontamento: true,
            },
          });

          if (agenda.monday_item_id) {
            await supabase.functions.invoke("monday-agenda-sync", {
              body: { action: "delete", agenda_id: agenda.id, monday_item_id: agenda.monday_item_id },
            });
          }
          await supabase.functions.invoke("monday-agenda-sync", {
            body: { action: "create", agenda_id: agenda.id },
          });

          ok++;
        } else {
          const { data: agendaCompleta, error: fetchErr } = await supabase
            .from("agendas")
            .select("id, user_id, cliente, data, atividade, item_cronograma, status, usuario, email, monday_item_id, flag_integracao")
            .eq("id", agenda.id)
            .single();

          if (fetchErr || !agendaCompleta) throw new Error(fetchErr?.message || "Agenda não encontrada");

          await supabase.functions.invoke("protheus-agenda-sync", {
            body: {
              action: "excluir",
              agendas: [{
                data: agendaCompleta.data,
                cliente: agendaCompleta.cliente,
                user_id: agendaCompleta.user_id,
                atividade: agendaCompleta.atividade,
                flag_integracao: agendaCompleta.flag_integracao,
              }],
            },
          });

          const { error: deleteErr } = await supabase.from("agendas").delete().eq("id", agenda.id);
          if (deleteErr) throw new Error(deleteErr.message);

          const { data: novaAgenda, error: insertErr } = await supabase
            .from("agendas")
            .insert({
              user_id: agendaCompleta.user_id,
              usuario: agendaCompleta.usuario,
              email: agendaCompleta.email,
              cliente: agendaCompleta.cliente,
              data: agendaCompleta.data,
              atividade: loteAtividade,
              item_cronograma: (loteItemCronograma && loteItemCronograma !== "__none__") ? loteItemCronograma : null,
              status: agendaCompleta.status,
              flag_integracao: "LOVABLE",
            })
            .select("id")
            .single();

          if (insertErr || !novaAgenda) throw new Error(insertErr?.message || "Erro ao inserir agenda");

          await supabase.functions.invoke("protheus-agenda-sync", {
            body: {
              action: "incluir",
              agendas: [{
                data: agendaCompleta.data,
                cliente: agendaCompleta.cliente,
                user_id: agendaCompleta.user_id,
                atividade: loteAtividade,
                flag_integracao: "LOVABLE",
              }],
            },
          });

          if (agendaCompleta.monday_item_id) {
            await supabase.functions.invoke("monday-agenda-sync", {
              body: { action: "delete", agenda_id: agenda.id, monday_item_id: agendaCompleta.monday_item_id },
            });
          }
          await supabase.functions.invoke("monday-agenda-sync", {
            body: { action: "create", agenda_id: novaAgenda.id },
          });

          await supabase.from("integration_logs").insert({
            codigo: "EDIT-AGENDA-LOTE",
            status: "success",
            message: `Edição em lote — agenda ${agenda.id} → ${novaAgenda.id} — ${agenda.atividade} → ${loteAtividade}`,
            payload: {
              agenda_id_original: agenda.id,
              agenda_id_nova: novaAgenda.id,
              atividade_anterior: agenda.atividade,
              atividade_nova: loteAtividade,
              item_novo: (loteItemCronograma && loteItemCronograma !== "__none__") ? loteItemCronograma : null,
              has_apontamento: false,
            },
          });

          ok++;
        }
      } catch (err: any) {
        falha++;
        await supabase.from("integration_logs").insert({
          codigo: "EDIT-AGENDA-LOTE",
          status: "error",
          message: `Erro na edição em lote — agenda ${agenda.id}: ${err.message}`,
          payload: { agenda_id: agenda.id, erro: err.message },
        });
      }
    }

    setLoteResultado({ ok, falha });
    setLoteSaving(false);

    if (falha === 0) {
      toast({ title: `${ok} agenda(s) alterada(s) com sucesso` });
      setLoteOpen(false);
      setSelected(new Set());
      await handleSearch();
    } else {
      toast({
        title: `${ok} alterada(s), ${falha} com falha`,
        description: "Verifique os logs de integração para detalhes.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Manutenção de Agendas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Projeto */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Projeto</label>
            <Select
              value={selectedProjeto}
              onValueChange={(v) => setSelectedProjeto(v === "__all__" ? "" : v)}
              onOpenChange={(open) => {
                if (open) loadProjetos(projetos.length === 0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={projetosLoading ? "Carregando..." : "Todos os projetos"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os projetos</SelectItem>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.nome_cliente}>
                    {p.nome_cliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Consultor */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Consultor</label>
            <Select
              value={selectedUserId}
              onValueChange={(v) => setSelectedUserId(v === "__all__" ? "" : v)}
              onOpenChange={(open) => {
                if (open) loadProfiles(profiles.length === 0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={profilesLoading ? "Carregando..." : "Todos os consultores"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os consultores</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.name} ({p.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date range — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={handleSelectDataInicio} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  ref={dataFimTriggerRef}
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dataFim && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                  disabled={(date) => dataInicio ? date < dataInicio : false}
                  defaultMonth={dataInicio}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {/* Status filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por Status</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                if (selectedStatuses.size === ALL_STATUSES.length) {
                  setSelectedStatuses(new Set());
                } else {
                  setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)));
                }
              }}
            >
              {selectedStatuses.size === ALL_STATUSES.length ? "Desmarcar todos" : "Marcar todos"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {ALL_STATUSES.map((s) => (
              <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedStatuses.has(s.value)}
                  onCheckedChange={(checked) => {
                    setSelectedStatuses((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(s.value);
                      else next.delete(s.value);
                      return next;
                    });
                  }}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={handleSearch} disabled={loading || selectedStatuses.size === 0} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar Agendas
        </Button>

        {/* Results */}
        {agendas.length > 0 && (
          <>
            {/* Date quick-select buttons */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={selected.size === agendas.length ? "default" : "outline"} onClick={toggleSelectAll}>
                {selected.size === agendas.length ? "Desmarcar Todas" : "Selecionar Todas"}
              </Button>
              {uniqueDates.map((d) => {
                const dateIds = agendas.filter((a) => a.data === d).map((a) => a.id);
                const allSel = dateIds.every((id) => selected.has(id));
                return (
                  <Button key={d} size="sm" variant={allSel ? "secondary" : "outline"} onClick={() => selectByDate(d)}>
                    {format(new Date(d + "T12:00:00"), "dd/MM/yyyy")}
                  </Button>
                );
              })}
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === agendas.length && agendas.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendas.map((a) => (
                    <TableRow key={a.id} className={selected.has(a.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} />
                      </TableCell>
                      <TableCell>{format(new Date(a.data + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{a.usuario}</TableCell>
                      <TableCell>{a.cliente}</TableCell>
                      <TableCell>{a.atividade}</TableCell>
                      <TableCell>
                        {a.origem === "requisicoes_agenda" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Aguard. Aprov.
                          </span>
                        ) : a.status}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleOpenEdit(a)}
                          title="Editar agenda"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {selected.size} de {agendas.length} selecionada(s)
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenLote}
                  disabled={loteSaving || selected.size === 0}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Pencil className="h-4 w-4" />
                  Alterar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting || selected.size === 0}
                  className="gap-2 w-full sm:w-auto"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir Selecionadas
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { if (!editSaving) setEditOpen(open); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                <Pencil className="inline h-4 w-4 mr-2" />
                {editingAgenda?.has_apontamento ? "Correção de Alocação" : "Editar Agenda"}
              </DialogTitle>
              <DialogDescription>
                {editingAgenda?.usuario} — {editingAgenda?.cliente}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {editLoadingDados ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Campo Data — apenas sem apontamento */}
                  {!editingAgenda?.has_apontamento ? (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Nova Data *</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editData && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editData ? format(editData, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editData} onSelect={setEditData} locale={ptBR} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      Agenda com apontamento registrado — data não pode ser alterada. Apenas atividade e item podem ser corrigidos.
                    </div>
                  )}

                  {/* Campo Atividade */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Atividade *</label>
                    <Select value={editAtividade} onValueChange={handleEditAtividadeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a atividade" />
                      </SelectTrigger>
                      <SelectContent>
                        {editAtividades.map((atv) => (
                          <SelectItem key={atv.id} value={atv.codigo}>
                            {atv.codigo} — {atv.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campo Item de Cronograma */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Item de Cronograma</label>
                    <Select value={editItemCronograma} onValueChange={setEditItemCronograma}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {editItens.map((item) => (
                          <SelectItem key={item.id} value={item.codigo}>
                            {item.codigo} — {item.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving || editLoadingDados}>
                {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lote Dialog */}
        <Dialog open={loteOpen} onOpenChange={(open) => { if (!loteSaving) setLoteOpen(open); }}>
          <DialogContent className="max-w-md flex flex-col max-h-[90dvh]">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Alterar em Lote
              </DialogTitle>
              <DialogDescription>
                {selected.size} agenda(s) selecionada(s) serão migradas para a atividade e item escolhidos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              {loteLoadingDados ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Atividade destino *</label>
                    <Select value={loteAtividade} onValueChange={handleLoteAtividadeChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a atividade" />
                      </SelectTrigger>
                      <SelectContent>
                        {loteAtividades.map((atv) => (
                          <SelectItem key={atv.id} value={atv.codigo}>
                            {atv.codigo} — {atv.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Item de Cronograma destino</label>
                    <Select value={loteItemCronograma} onValueChange={setLoteItemCronograma} disabled={!loteAtividade}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Nenhum (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {loteItens.map((item) => (
                          <SelectItem key={item.id} value={item.codigo}>
                            {item.codigo} — {item.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {agendas.filter((a) => selected.has(a.id) && a.has_apontamento === true).length > 0 && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                      {agendas.filter((a) => selected.has(a.id) && a.has_apontamento === true).length} agenda(s) com apontamento — serão corrigidas sem alterar o Protheus.
                    </div>
                  )}

                  {loteResultado && (
                    <div className={`rounded-md px-3 py-2 text-xs border ${loteResultado.falha === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                      {loteResultado.ok} alterada(s) com sucesso. {loteResultado.falha > 0 && `${loteResultado.falha} com falha — verifique os logs.`}
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter className="shrink-0 pt-2">
              <Button variant="outline" onClick={() => setLoteOpen(false)} disabled={loteSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveLote} disabled={loteSaving || loteLoadingDados || !loteAtividade} className="gap-2">
                {loteSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {loteSaving ? "Alterando..." : "Confirmar Alteração"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
