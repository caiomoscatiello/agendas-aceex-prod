import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { FolderPlus, Plus, Trash2, Save, Loader2, Edit, Eye, Users, ShieldAlert, X, Link2, ExternalLink, RotateCcw, ChevronDown, Settings, HelpCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminCronogramaItens, { CronogramaItem, TipoDocumento } from "./AdminCronogramaItens";

type Projeto = {
  id: string;
  nome_cliente: string;
  site_cliente: string | null;
  endereco_cliente: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  coordenador_id: string | null;
  horas_contratadas: number;
  deslocamento: number;
  email_contato: string | null;
  codigo_cliente: string;
  status: string;
  monday_board_id?: string | null;
  monday_board_url?: string | null;
  monday_status?: string | null;
  autentique_folder_id?: string | null;
  autentique_folder_url?: string | null;
  sharepoint_pasta_url?: string | null;
};

type Coordenador = {
  user_id: string;
  name: string;
};

type ProjetoDespesa = {
  id: string;
  projeto_id: string;
  tipo_despesa: string;
  valor_maximo: number;
};

type ProjetoAtividade = {
  id: string;
  projeto_id: string;
  codigo: string;
  descricao: string;
  horas: number;
  data_inicio: string | null;
  data_fim: string | null;
};

type Stakeholder = {
  id: string;
  projeto_id: string;
  user_id: string;
  profile_user_id: string | null;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  empresa: string | null;
  nivel_hierarquico: string | null;
  tipo: string;
  email: string | null;
  telefone: string | null;
  tipo_influencia: string;
  interesses: string | null;
};

type UserOption = {
  user_id: string;
  name: string;
  email: string;
  contato: string | null;
};

type Risco = {
  id: string;
  projeto_id: string;
  user_id: string;
  responsavel_id: string | null;
  descricao: string;
  probabilidade: string;
  impacto: string;
  status: string;
  acao_mitigadora: string | null;
  created_at: string;
  updated_at: string;
};

type Baseline = {
  id: string;
  versao: string;
  descricao: string | null;
  created_at: string;
  snapshot: { atividades: any[] };
};

type IntegracaoConfig = {
  key: string;
  nome: string;
  logo: React.ReactNode;
  status: "ativo" | "criado" | "nao_criado" | "disponivel" | "desenvolvimento" | "detalhamento";
  statusLabel: string;
  sub?: string;
  help?: string;
  acoes?: React.ReactNode;
  zonaRisco?: React.ReactNode;
};

export default function AdminProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [coordenadores, setCoordenadores] = useState<Coordenador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [detailProjeto, setDetailProjeto] = useState<Projeto | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("geral");
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselineComparando, setBaselineComparando] = useState<Baseline | null>(null);
  const isMobile = useIsMobile();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"view" | "edit" | "new">("view");

  const [nomeCliente, setNomeCliente] = useState("");
  const [siteCliente, setSiteCliente] = useState("");
  const [enderecoCliente, setEnderecoCliente] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [selectedCoordenador, setSelectedCoordenador] = useState<string>("");
  const [horasContratadas, setHorasContratadas] = useState("");
  const [deslocamento, setDeslocamento] = useState("0");
  const [emailContato, setEmailContato] = useState("");
  const [codigoCliente, setCodigoCliente] = useState("");
  const [statusProjeto, setStatusProjeto] = useState("Em planejamento");

  const [despesas, setDespesas] = useState<ProjetoDespesa[]>([]);
  const [newDespTipo, setNewDespTipo] = useState("");
  const [newDespValor, setNewDespValor] = useState("");

  const [atividades, setAtividades] = useState<ProjetoAtividade[]>([]);
  const [newAtivCodigo, setNewAtivCodigo] = useState("");
  const [newAtivDescricao, setNewAtivDescricao] = useState("");
  const [newAtivHoras, setNewAtivHoras] = useState("");
  const [newAtivDataInicio, setNewAtivDataInicio] = useState("");
  const [newAtivDataFim, setNewAtivDataFim] = useState("");

  const [cronogramaMap, setCronogramaMap] = useState<Record<string, CronogramaItem[]>>({});
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);

  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingMondayId, setSyncingMondayId] = useState<string | null>(null);
  const [resettingBoard, setResettingBoard] = useState<string | null>(null);
  const [creatingBoard, setCreatingBoard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [listExpanded, setListExpanded] = useState(true);

  const projetosFiltrados = projetos.filter((p) => {
    const matchSearch =
      searchQuery.trim() === "" ||
      p.nome_cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.codigo_cliente.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      filtroStatus === "todos" ||
      (filtroStatus === "liberado" && p.status === "Liberado") ||
      (filtroStatus === "planejamento" && p.status !== "Liberado" && p.status !== "Encerrado") ||
      (filtroStatus === "encerrado" && p.status === "Encerrado");
    return matchSearch && matchStatus;
  });

  const countByStatus = {
    todos: projetos.length,
    liberado: projetos.filter((p) => p.status === "Liberado").length,
    planejamento: projetos.filter((p) => p.status !== "Liberado" && p.status !== "Encerrado").length,
    encerrado: projetos.filter((p) => p.status === "Encerrado").length,
  };

  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [stakeholderDialogOpen, setStakeholderDialogOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [savingStakeholder, setSavingStakeholder] = useState(false);
  const [shNome, setShNome] = useState("");
  const [shCargo, setShCargo] = useState("");
  const [shDepartamento, setShDepartamento] = useState("");
  const [shEmpresa, setShEmpresa] = useState("");
  const [shNivel, setShNivel] = useState("");
  const [shTipo, setShTipo] = useState("Externo");
  const [shEmail, setShEmail] = useState("");
  const [shTelefone, setShTelefone] = useState("");
  const [shInfluencia, setShInfluencia] = useState("Neutro");
  const [shInteresses, setShInteresses] = useState("");
  const [shProfileUserId, setShProfileUserId] = useState<string | null>(null);

  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [riscoDialogOpen, setRiscoDialogOpen] = useState(false);
  const [editingRisco, setEditingRisco] = useState<Risco | null>(null);
  const [savingRisco, setSavingRisco] = useState(false);
  const [exibirEncerrados, setExibirEncerrados] = useState(false);
  const [rsDescricao, setRsDescricao] = useState("");
  const [rsProbabilidade, setRsProbabilidade] = useState("M??dia");
  const [rsImpacto, setRsImpacto] = useState("M??dio");
  const [rsStatus, setRsStatus] = useState("Identificado");
  const [rsAcao, setRsAcao] = useState("");
  const [rsResponsavelId, setRsResponsavelId] = useState<string | null>(null);

  // ?????? ALERTAS CONFIG ???????????????????????????????????????????????????????????????????????????????????????????????????????????????
  const [alertaConfig, setAlertaConfig] = useState({
    alerta_feeling_ativo: true,
    alerta_feeling_threshold: 20,
    alerta_apontamento_ativo: true,
    alerta_apontamento_dias: 2,
    alerta_consumo_ativo: true,
    alerta_consumo_threshold: 90,
    alerta_parada_ativo: true,
    alerta_parada_dias: 7,
  });
  const [savingAlertaConfig, setSavingAlertaConfig] = useState(false);

  useEffect(() => {
    loadProjetos();
    loadCoordenadores();
    loadAllUsers();
    loadTiposDocumento();
  }, []);

  const loadTiposDocumento = async () => {
    const { data } = await supabase
      .from("tipos_documento")
      .select("id, codigo, descricao")
      .eq("ativo", true)
      .order("codigo");
    setTiposDocumento(data || []);
  };

  const loadAllUsers = async () => {
    const { data } = await supabase.from("profiles").select("user_id, name, email, contato").order("name");
    setAllUsers(data || []);
  };

  const loadProjetos = async () => {
    setLoading(true);
    const { data } = await supabase.from("projetos").select("id, nome_cliente, site_cliente, endereco_cliente, contato_nome, contato_telefone, coordenador_id, horas_contratadas, deslocamento, email_contato, codigo_cliente, status, monday_board_id, monday_board_url, monday_status, created_at").order("created_at", { ascending: false });
    setProjetos(data || []);
    setLoading(false);
  };

  const loadCoordenadores = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coordenador");
    
    if (!roles || roles.length === 0) return;

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", userIds);
    
    setCoordenadores(profiles || []);
  };

  const loadCronogramaForAtividades = async (atividadeIds: string[]) => {
    if (atividadeIds.length === 0) { setCronogramaMap({}); return; }
    const { data } = await supabase.from("cronograma_itens").select("*").in("atividade_id", atividadeIds);
    const map: Record<string, CronogramaItem[]> = {};
    (data || []).forEach((item: any) => {
      if (!map[item.atividade_id]) map[item.atividade_id] = [];
      map[item.atividade_id].push(item);
    });
    setCronogramaMap(map);
  };

  const loadStakeholders = async (projetoId: string) => {
    const { data } = await supabase
      .from("projeto_stakeholders")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("nome");
    setStakeholders(data || []);
  };

  const loadRiscos = async (projetoId: string) => {
    const { data } = await supabase
      .from("projeto_riscos")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: false });
    setRiscos(data || []);
  };

  const loadProjetoDetails = async (projeto: Projeto) => {
    const { data: projetoAtual } = await supabase
      .from("projetos")
      .select("id, nome_cliente, site_cliente, endereco_cliente, contato_nome, contato_telefone, coordenador_id, horas_contratadas, deslocamento, email_contato, codigo_cliente, status, monday_board_id, monday_board_url, monday_status, autentique_folder_id, autentique_folder_url, sharepoint_pasta_url")
      .eq("id", projeto.id)
      .single();
    setDetailProjeto((projetoAtual || projeto) as any);
    setAbaAtiva("geral");
    const [despRes, ativRes, blRes] = await Promise.all([
      supabase.from("projeto_despesas").select("*").eq("projeto_id", projeto.id),
      supabase.from("projeto_atividades").select("*").eq("projeto_id", projeto.id),
      supabase.from("projeto_baseline").select("id, versao, descricao, created_at, snapshot").eq("projeto_id", projeto.id).order("created_at", { ascending: false }),
    ]);
    setDespesas(despRes.data || []);
    const ativs = ativRes.data || [];
    setAtividades(ativs);
    setBaselines((blRes.data as any) || []);
    await loadCronogramaForAtividades(ativs.map(a => a.id));
    await loadStakeholders(projeto.id);
    await loadRiscos(projeto.id);

    // ?????? Carregar config de alertas ??????
    const { data: cfgData } = await supabase
      .from("projeto_alertas_config")
      .select("*")
      .eq("projeto_id", projeto.id)
      .maybeSingle();
    setAlertaConfig({
      alerta_feeling_ativo: cfgData?.alerta_feeling_ativo ?? true,
      alerta_feeling_threshold: cfgData?.alerta_feeling_threshold ?? 20,
      alerta_apontamento_ativo: cfgData?.alerta_apontamento_ativo ?? true,
      alerta_apontamento_dias: cfgData?.alerta_apontamento_dias ?? 2,
      alerta_consumo_ativo: cfgData?.alerta_consumo_ativo ?? true,
      alerta_consumo_threshold: cfgData?.alerta_consumo_threshold ?? 90,
      alerta_parada_ativo: cfgData?.alerta_parada_ativo ?? true,
      alerta_parada_dias: cfgData?.alerta_parada_dias ?? 7,
    });
  };

  const openNew = () => {
    setEditingProjeto(null);
    setNomeCliente("");
    setSiteCliente("");
    setEnderecoCliente("");
    setContatoNome("");
    setContatoTelefone("");
    setSelectedCoordenador("");
    setHorasContratadas("");
    setDeslocamento("0");
    setEmailContato("");
    setCodigoCliente("");
    setStatusProjeto("Em planejamento");
    setDespesas([]);
    setAtividades([]);
    setCronogramaMap({});
    setDialogOpen(true);
  };

  const openEdit = async (projeto: Projeto) => {
    setEditingProjeto(projeto);
    setNomeCliente(projeto.nome_cliente);
    setSiteCliente(projeto.site_cliente || "");
    setEnderecoCliente(projeto.endereco_cliente || "");
    setContatoNome(projeto.contato_nome || "");
    setContatoTelefone(projeto.contato_telefone || "");
    setSelectedCoordenador(projeto.coordenador_id || "");
    setHorasContratadas(String(projeto.horas_contratadas || ""));
    setDeslocamento(String(projeto.deslocamento ?? 0));
    setEmailContato(projeto.email_contato || "");
    setCodigoCliente(projeto.codigo_cliente || "");
    
    const [despRes, ativRes] = await Promise.all([
      supabase.from("projeto_despesas").select("*").eq("projeto_id", projeto.id),
      supabase.from("projeto_atividades").select("*").eq("projeto_id", projeto.id),
    ]);
    setDespesas(despRes.data || []);
    const ativs = ativRes.data || [];
    setAtividades(ativs);
    await loadCronogramaForAtividades(ativs.map(a => a.id));
    setDialogOpen(true);
  };

  const addDespesaLocal = () => {
    if (!newDespTipo || !newDespValor) return;
    setDespesas((prev) => [
      ...prev,
      { id: `temp_${Date.now()}`, projeto_id: "", tipo_despesa: newDespTipo, valor_maximo: parseFloat(newDespValor) },
    ]);
    setNewDespTipo("");
    setNewDespValor("");
  };

  const removeDespesaLocal = (idx: number) => {
    setDespesas((prev) => prev.filter((_, i) => i !== idx));
  };

  const addAtividadeLocal = () => {
    if (!newAtivCodigo || !newAtivDescricao || !newAtivHoras) return;
    const codigoDuplicado = atividades.some(
      (a) => a.codigo.trim().toLowerCase() === newAtivCodigo.trim().toLowerCase()
    );
    if (codigoDuplicado) {
      toast({
        title: "C??digo duplicado",
        description: `J?? existe uma atividade com o c??digo "${newAtivCodigo}". Use um c??digo ??nico.`,
        variant: "destructive",
      });
      return;
    }
    if (newAtivDataInicio && newAtivDataFim && newAtivDataFim < newAtivDataInicio) {
      toast({ title: "Erro", description: "Data fim deve ser igual ou posterior ?? data in??cio.", variant: "destructive" });
      return;
    }
    const novaHora = parseFloat(newAtivHoras);
    const totalAtual = atividades.reduce((sum, a) => sum + a.horas, 0);
    const limite = parseFloat(horasContratadas) || 0;
    if (limite > 0 && totalAtual + novaHora > limite) {
      toast({ title: "Erro", description: `Total de horas das atividades (${totalAtual + novaHora}h) excede as horas contratadas (${limite}h).`, variant: "destructive" });
      return;
    }
    setAtividades((prev) => [
      ...prev,
      { id: `temp_${Date.now()}`, projeto_id: "", codigo: newAtivCodigo, descricao: newAtivDescricao, horas: novaHora, data_inicio: newAtivDataInicio || null, data_fim: newAtivDataFim || null },
    ]);
    setNewAtivCodigo("");
    setNewAtivDescricao("");
    setNewAtivHoras("");
    setNewAtivDataInicio("");
    setNewAtivDataFim("");
  };

  const removeAtividadeLocal = async (idx: number) => {
    const atividade = atividades[idx];
    if (atividade && !atividade.id.startsWith("temp_")) {
      const { count } = await supabase
        .from("agendas")
        .select("id", { count: "exact", head: true })
        .eq("atividade", atividade.codigo)
        .eq("cliente", nomeCliente);
      if (count && count > 0) {
        toast({
          title: "Remo????o bloqueada",
          description: `A atividade '${atividade.codigo} - ${atividade.descricao}' possui ${count} agenda(s) vinculada(s) e n??o pode ser removida.`,
          variant: "destructive",
        });
        return;
      }
    }
    setAtividades((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!nomeCliente.trim()) {
      toast({ title: "Erro", description: "Nome do cliente ?? obrigat??rio.", variant: "destructive" });
      return;
    }

    if (!codigoCliente.trim() || codigoCliente.trim().length !== 6 || !/^[A-Za-z0-9]{6}$/.test(codigoCliente.trim())) {
      toast({ title: "Erro", description: "C??digo do cliente deve ter exatamente 6 caracteres alfanum??ricos.", variant: "destructive" });
      return;
    }
    
    if (contatoTelefone) {
      const rawPhone = contatoTelefone.replace(/\D/g, "");
      if (rawPhone.length !== 11 || rawPhone[2] !== "9") {
        toast({ title: "Erro", description: "Telefone inv??lido. Use o formato (DDD) 9XXXX-XXXX.", variant: "destructive" });
        return;
      }
    }

    if (!selectedCoordenador) {
      toast({ title: "Erro", description: "Selecione um coordenador.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const hcValue = parseFloat(horasContratadas) || 0;
    const totalHorasAtividades = atividades.reduce((sum, a) => sum + a.horas, 0);
    if (hcValue > 0 && totalHorasAtividades !== hcValue) {
      toast({ title: "Erro", description: `Total de horas das atividades (${totalHorasAtividades}h) deve ser igual ??s horas contratadas (${hcValue}h).`, variant: "destructive" });
      setSaving(false);
      return;
    }

    const projectData = {
      nome_cliente: nomeCliente,
      site_cliente: siteCliente || null,
      endereco_cliente: enderecoCliente || null,
      contato_nome: contatoNome || null,
      contato_telefone: contatoTelefone || null,
      coordenador_id: selectedCoordenador || null,
      horas_contratadas: hcValue,
      deslocamento: parseInt(deslocamento) || 0,
      email_contato: emailContato || null,
      codigo_cliente: codigoCliente.trim().toUpperCase(),
      status: statusProjeto,
    };

    let projetoId: string;

    if (editingProjeto) {
      const { error } = await supabase
        .from("projetos")
        .update(projectData)
        .eq("id", editingProjeto.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      projetoId = editingProjeto.id;

      await supabase.from("projeto_despesas").delete().eq("projeto_id", projetoId);
    } else {
      const { data, error } = await supabase
        .from("projetos")
        .insert(projectData)
        .select("id")
        .single();
      if (error || !data) {
        toast({ title: "Erro", description: error?.message || "Erro ao criar projeto", variant: "destructive" });
        setSaving(false);
        return;
      }
      projetoId = data.id;
    }

    if (despesas.length > 0) {
      const { error } = await supabase.from("projeto_despesas").insert(
        despesas.map((d) => ({ projeto_id: projetoId, tipo_despesa: d.tipo_despesa, valor_maximo: d.valor_maximo }))
      );
      if (error) toast({ title: "Aviso", description: `Erro ao salvar despesas: ${error.message}` });
    }

    if (editingProjeto && atividades.length > 0) {
      const existingAtivs = atividades.filter(a => !a.id.startsWith("temp_"));
      const newAtivs = atividades.filter(a => a.id.startsWith("temp_"));

      for (const a of existingAtivs) {
        await supabase.from("projeto_atividades").update({
          codigo: a.codigo, descricao: a.descricao, horas: a.horas,
          data_inicio: a.data_inicio || null, data_fim: a.data_fim || null,
        }).eq("id", a.id);
      }

      const { data: dbAtivs } = await supabase.from("projeto_atividades").select("id").eq("projeto_id", projetoId);
      const localExistingIds = new Set(existingAtivs.map(a => a.id));
      const toDelete = (dbAtivs || []).filter(a => !localExistingIds.has(a.id));
      for (const a of toDelete) {
        await supabase.from("cronograma_itens").delete().eq("atividade_id", a.id);
        await supabase.from("projeto_atividades").delete().eq("id", a.id);
      }

      const newAtivIdMap: Record<string, string> = {};
      if (newAtivs.length > 0) {
        const { data: insertedNew, error: newErr } = await supabase.from("projeto_atividades").insert(
          newAtivs.map(a => ({ projeto_id: projetoId, codigo: a.codigo, descricao: a.descricao, horas: a.horas, data_inicio: a.data_inicio || null, data_fim: a.data_fim || null }))
        ).select("id");
        if (newErr) {
          toast({ title: "Aviso", description: `Erro ao salvar novas atividades: ${newErr.message}` });
        } else if (insertedNew) {
          newAtivs.forEach((a, i) => { newAtivIdMap[a.id] = insertedNew[i]?.id; });
        }
      }

      for (const a of existingAtivs) {
        const itens = cronogramaMap[a.id] || [];
        const existingItens = itens.filter(it => !it.id.startsWith("temp_"));
        const newItens = itens.filter(it => it.id.startsWith("temp_"));

        for (const it of existingItens) {
          await supabase.from("cronograma_itens").update({
            codigo: it.codigo, descricao: it.descricao, horas_reservadas: it.horas_reservadas,
            data_inicio: it.data_inicio || null, data_fim: it.data_fim || null, user_id: it.user_id,
            doc_exigido: it.doc_exigido ?? false, tipo_documento_id: it.tipo_documento_id ?? null,
          }).eq("id", it.id);
        }

        const { data: dbItens } = await supabase.from("cronograma_itens").select("id").eq("atividade_id", a.id);
        const localItemIds = new Set(existingItens.map(it => it.id));
        const itensToDelete = (dbItens || []).filter(it => !localItemIds.has(it.id));
        if (itensToDelete.length > 0) {
          await supabase.from("cronograma_itens").delete().in("id", itensToDelete.map(it => it.id));
        }

        if (newItens.length > 0) {
          await supabase.from("cronograma_itens").insert(
            newItens.map(it => ({
              atividade_id: a.id, codigo: it.codigo, descricao: it.descricao,
              horas_reservadas: it.horas_reservadas, user_id: it.user_id,
              data_inicio: it.data_inicio || null, data_fim: it.data_fim || null,
              doc_exigido: it.doc_exigido ?? false, tipo_documento_id: it.tipo_documento_id ?? null,
              doc_satisfeito: false, doc_satisfeito_em: null,
            }))
          );
        }
      }

      for (const a of newAtivs) {
        const realId = newAtivIdMap[a.id];
        const itens = cronogramaMap[a.id] || [];
        if (realId && itens.length > 0) {
          await supabase.from("cronograma_itens").insert(
            itens.map(it => ({
              atividade_id: realId, codigo: it.codigo, descricao: it.descricao,
              horas_reservadas: it.horas_reservadas, user_id: it.user_id,
              data_inicio: it.data_inicio || null, data_fim: it.data_fim || null,
              doc_exigido: it.doc_exigido ?? false, tipo_documento_id: it.tipo_documento_id ?? null,
              doc_satisfeito: false, doc_satisfeito_em: null,
            }))
          );
        }
      }
    } else if (atividades.length > 0) {
      const oldIds = atividades.map(a => a.id);
      const { data: insertedAtivs, error } = await supabase.from("projeto_atividades").insert(
        atividades.map((a) => ({ projeto_id: projetoId, codigo: a.codigo, descricao: a.descricao, horas: a.horas, data_inicio: a.data_inicio || null, data_fim: a.data_fim || null }))
      ).select("id");
      if (error) {
        toast({ title: "Aviso", description: `Erro ao salvar atividades: ${error.message}` });
      } else if (insertedAtivs) {
        const allCronogramaInserts: any[] = [];
        oldIds.forEach((oldId, index) => {
          const newAtivId = insertedAtivs[index]?.id;
          const itens = cronogramaMap[oldId] || [];
          if (newAtivId && itens.length > 0) {
            itens.forEach(item => {
              allCronogramaInserts.push({
                atividade_id: newAtivId, codigo: item.codigo, descricao: item.descricao,
                horas_reservadas: item.horas_reservadas, user_id: item.user_id,
                data_inicio: item.data_inicio || null, data_fim: item.data_fim || null,
                doc_exigido: item.doc_exigido ?? false, tipo_documento_id: item.tipo_documento_id ?? null,
                doc_satisfeito: false, doc_satisfeito_em: null,
              });
            });
          }
        });
        if (allCronogramaInserts.length > 0) {
          const { error: cronError } = await supabase.from("cronograma_itens").insert(allCronogramaInserts);
          if (cronError) toast({ title: "Aviso", description: `Erro ao salvar cronograma: ${cronError.message}` });
        }
      }
    }

    toast({ title: "Sucesso", description: editingProjeto ? "Projeto atualizado!" : "Projeto cadastrado!" });

    try {
      const coordenadorNome = coordenadores.find(c => c.user_id === selectedCoordenador)?.name ?? "";
      
      const { data: freshAtivs } = await supabase.from("projeto_atividades").select("*").eq("projeto_id", projetoId);
      const atividadesPayload = (freshAtivs || []).map((a: any) => ({
        id: a.id,
        codigo: a.codigo,
        descricao: a.descricao,
        horas: a.horas,
        monday_group_id: a.monday_group_id ?? null,
        cronograma_itens: (cronogramaMap[a.id] || []).map(item => ({
          id: item.id,
          codigo: item.codigo,
          descricao: item.descricao,
          horas_reservadas: item.horas_reservadas,
          doc_exigido: item.doc_exigido ?? false,
          data_inicio: item.data_inicio ?? null,
          data_fim: item.data_fim ?? null,
          monday_item_id: item.monday_item_id ?? null,
        })),
      }));

      if (editingProjeto) {
        for (const a of atividadesPayload) {
          if (!cronogramaMap[a.id]) {
            const { data: cItens } = await supabase.from("cronograma_itens").select("*").eq("atividade_id", a.id);
            a.cronograma_itens = (cItens || []).map((it: any) => ({
              id: it.id,
              codigo: it.codigo,
              descricao: it.descricao,
              horas_reservadas: it.horas_reservadas,
              doc_exigido: it.doc_exigido ?? false,
              data_inicio: it.data_inicio ?? null,
              data_fim: it.data_fim ?? null,
              monday_item_id: it.monday_item_id ?? null,
            }));
          }
        }
      }

      const projetoAtual = editingProjeto ? projetos.find(p => p.id === editingProjeto.id) : null;
      const temBoard = !!(projetoAtual as any)?.monday_board_id;

      const syncPayload = !editingProjeto || !temBoard
        ? {
            action: "create",
            projeto_id: projetoId,
            nome_cliente: nomeCliente,
            codigo_cliente: codigoCliente.trim().toUpperCase(),
            coordenador_nome: coordenadorNome,
            atividades: atividadesPayload,
          }
        : {
            action: "sync",
            projeto_id: projetoId,
            codigo_cliente: codigoCliente.trim().toUpperCase(),
            atividades_atuais: atividadesPayload,
          };

      const { error: syncError } = await supabase.functions.invoke("monday-sync-project", { body: syncPayload });
      if (syncError) {
        toast({ title: "Aviso ??? Monday", description: "Projeto salvo. Board Monday n??o sincronizado." });
      }
    } catch {
      // Monday failure never blocks
    }

    setDialogOpen(false);
    setSheetOpen(false);
    setSaving(false);
    loadProjetos();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("projetos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Projeto removido" });
      loadProjetos();
      if (detailProjeto?.id === id) {
        setDetailProjeto(null);
        setSheetOpen(false);
      }
    }
  };

  const getCoordenadorName = (id: string | null) => {
    if (!id) return "???";
    const coord = coordenadores.find(c => c.user_id === id);
    return coord ? coord.name : "Desconhecido";
  };

  const openNewStakeholder = () => {
    setEditingStakeholder(null);
    setShNome(""); setShCargo(""); setShDepartamento(""); setShEmpresa("");
    setShNivel(""); setShTipo("Externo"); setShEmail(""); setShTelefone("");
    setShInfluencia("Neutro"); setShInteresses(""); setShProfileUserId(null);
    setStakeholderDialogOpen(true);
  };

  const openEditStakeholder = (s: Stakeholder) => {
    setEditingStakeholder(s);
    setShNome(s.nome); setShCargo(s.cargo || ""); setShDepartamento(s.departamento || "");
    setShEmpresa(s.empresa || ""); setShNivel(s.nivel_hierarquico || "");
    setShTipo(s.tipo); setShEmail(s.email || ""); setShTelefone(s.telefone || "");
    setShInfluencia(s.tipo_influencia); setShInteresses(s.interesses || "");
    setShProfileUserId(s.profile_user_id || null);
    setStakeholderDialogOpen(true);
  };

  const handleSelectUsuarioInterno = (userId: string) => {
    const profile = allUsers.find(u => u.user_id === userId);
    if (profile) {
      setShNome(profile.name);
      setShEmail(profile.email);
      setShTelefone(profile.contato || "");
      setShEmpresa("Interno");
      setShProfileUserId(userId);
    }
  };

  const handleSaveStakeholder = async () => {
    if (!shNome.trim()) {
      toast({ title: "Erro", description: "Nome ?? obrigat??rio.", variant: "destructive" });
      return;
    }
    setSavingStakeholder(true);
    const payload = {
      nome: shNome.trim(),
      cargo: shCargo || null,
      departamento: shDepartamento || null,
      empresa: shEmpresa || null,
      nivel_hierarquico: shNivel || null,
      tipo: shTipo,
      email: shEmail || null,
      telefone: shTelefone || null,
      tipo_influencia: shInfluencia,
      interesses: shInteresses || null,
      profile_user_id: shProfileUserId,
    };
    if (editingStakeholder) {
      const { error } = await supabase.from("projeto_stakeholders").update(payload).eq("id", editingStakeholder.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSavingStakeholder(false); return; }
    } else {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        toast({ title: "Erro de autentica????o", description: "Sess??o expirada. Fa??a login novamente.", variant: "destructive" });
        setSavingStakeholder(false);
        return;
      }
      const user = authData.user;
      const { error } = await supabase.from("projeto_stakeholders").insert({ ...payload, projeto_id: detailProjeto!.id, user_id: user.id });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSavingStakeholder(false); return; }
    }
    toast({ title: "Sucesso", description: editingStakeholder ? "Stakeholder atualizado!" : "Stakeholder cadastrado!" });
    setStakeholderDialogOpen(false);
    setSavingStakeholder(false);
    loadStakeholders(detailProjeto!.id);
  };

  const handleDeleteStakeholder = async (id: string) => {
    const { error } = await supabase.from("projeto_stakeholders").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Stakeholder removido" });
    await loadStakeholders(detailProjeto!.id);
  };

  const openNewRisco = () => {
    setEditingRisco(null);
    setRsDescricao(""); setRsProbabilidade("M??dia"); setRsImpacto("M??dio");
    setRsStatus("Identificado"); setRsAcao(""); setRsResponsavelId(null);
    setRiscoDialogOpen(true);
  };

  const openEditRisco = (r: Risco) => {
    setEditingRisco(r);
    setRsDescricao(r.descricao); setRsProbabilidade(r.probabilidade);
    setRsImpacto(r.impacto); setRsStatus(r.status);
    setRsAcao(r.acao_mitigadora || ""); setRsResponsavelId(r.responsavel_id);
    setRiscoDialogOpen(true);
  };

  const handleSaveRisco = async () => {
    if (!rsDescricao.trim()) {
      toast({ title: "Erro", description: "Descri????o ?? obrigat??ria.", variant: "destructive" });
      return;
    }
    setSavingRisco(true);
    const payload = {
      descricao: rsDescricao.trim(),
      probabilidade: rsProbabilidade,
      impacto: rsImpacto,
      status: rsStatus,
      acao_mitigadora: rsAcao || null,
      responsavel_id: rsResponsavelId || null,
    };
    if (editingRisco) {
      const { error } = await supabase.from("projeto_riscos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingRisco.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSavingRisco(false); return; }
    } else {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        toast({ title: "Erro de autentica????o", description: "Sess??o expirada. Fa??a login novamente.", variant: "destructive" });
        setSavingRisco(false);
        return;
      }
      const user = authData.user;
      const { error } = await supabase.from("projeto_riscos").insert({ ...payload, projeto_id: detailProjeto!.id, user_id: user.id });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSavingRisco(false); return; }
    }
    toast({ title: "Sucesso", description: editingRisco ? "Risco atualizado!" : "Risco cadastrado!" });
    setRiscoDialogOpen(false);
    setSavingRisco(false);
    loadRiscos(detailProjeto!.id);
  };

  const handleDeleteRisco = async (id: string) => {
    const { error } = await supabase.from("projeto_riscos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Risco removido" });
    await loadRiscos(detailProjeto!.id);
  };

  const handleResetBoard = async (projeto: Projeto) => {
    if (!confirm(
      `Isso ir?? arquivar o board Monday do projeto "${projeto.nome_cliente}" ` +
      `e limpar os dados de sincroniza????o.\n\n` +
      `Permitido apenas em projetos sem agendas vinculadas.\n\n` +
      `Confirmar reset?`
    )) return;

    setResettingBoard(projeto.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "monday-reset-board",
        { body: { projeto_id: projeto.id } }
      );
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Reset conclu??do", description: "Board arquivado. Use 'Criar board' para recriar." });
        loadProjetos();
        setDetailProjeto(prev =>
          prev ? { ...prev, monday_board_id: null, monday_board_url: null, monday_status: "nao_criado" } as any : prev
        );
      } else {
        toast({ title: "Reset n??o permitido", description: data?.error || "Erro ao resetar.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro no reset", description: err.message, variant: "destructive" });
    }
    setResettingBoard(null);
  };

  const handleCreateBoardManual = async (projeto: Projeto) => {
    setCreatingBoard(projeto.id);
    try {
      const { data: ativs } = await supabase
        .from("projeto_atividades")
        .select("*")
        .eq("projeto_id", projeto.id);

      const atividadesComItens = await Promise.all(
        (ativs || []).map(async (a: any) => {
          const { data: itens } = await supabase
            .from("cronograma_itens")
            .select("*")
            .eq("atividade_id", a.id);
          return {
            id: a.id,
            codigo: a.codigo,
            descricao: a.descricao,
            horas: a.horas,
            monday_group_id: a.monday_group_id ?? null,
            cronograma_itens: (itens || []).map((i: any) => ({
              id: i.id,
              codigo: i.codigo,
              descricao: i.descricao,
              horas_reservadas: i.horas_reservadas,
              doc_exigido: i.doc_exigido ?? false,
              data_inicio: i.data_inicio ?? null,
              data_fim: i.data_fim ?? null,
              monday_item_id: i.monday_item_id ?? null,
            })),
          };
        })
      );

      const coordNome = coordenadores.find(c => c.user_id === projeto.coordenador_id)?.name ?? "";

      const { data, error } = await supabase.functions.invoke(
        "monday-sync-project",
        {
          body: {
            action: "create",
            projeto_id: projeto.id,
            nome_cliente: projeto.nome_cliente,
            codigo_cliente: projeto.codigo_cliente,
            coordenador_nome: coordNome,
            atividades: atividadesComItens,
          },
        }
      );

      if (error) throw error;
      if (data?.success) {
        toast({ title: "Board criado", description: `Board Monday criado para ${projeto.nome_cliente}` });
        await loadProjetos();
        if (detailProjeto) {
          const { data: fresh } = await supabase
            .from("projetos").select("*")
            .eq("id", detailProjeto.id).single();
          if (fresh) setDetailProjeto(fresh as any);
        }
      } else if (data?.skipped) {
        toast({ title: "Integra????o desativada", description: "Ative em Settings ??? Integ. Monday.", variant: "destructive" });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar board", description: err.message, variant: "destructive" });
    }
    setCreatingBoard(null);
  };

  const handleSyncMondayManual = async (projeto: Projeto) => {
    setSyncingMondayId(projeto.id);
    try {
      const { data: atvs } = await supabase.from("projeto_atividades").select("*").eq("projeto_id", projeto.id);
      const atividadesPayload = [];
      for (const a of (atvs || [])) {
        const { data: cItens } = await supabase.from("cronograma_itens").select("*").eq("atividade_id", a.id);
        atividadesPayload.push({
          id: a.id, codigo: a.codigo, descricao: a.descricao, horas: a.horas,
          monday_group_id: (a as any).monday_group_id ?? null,
          cronograma_itens: (cItens || []).map((it: any) => ({
            id: it.id,
            codigo: it.codigo,
            descricao: it.descricao,
            horas_reservadas: it.horas_reservadas,
            doc_exigido: it.doc_exigido ?? false,
            data_inicio: it.data_inicio ?? null,
            data_fim: it.data_fim ?? null,
            monday_item_id: it.monday_item_id ?? null,
          })),
        });
      }
      const coordNome = coordenadores.find(c => c.user_id === projeto.coordenador_id)?.name ?? "";
      const payload = {
        action: "sync" as const,
        projeto_id: projeto.id,
        nome_cliente: projeto.nome_cliente,
        codigo_cliente: projeto.codigo_cliente,
        coordenador_nome: coordNome,
        atividades: atividadesPayload,
      };
      const { error } = await supabase.functions.invoke("monday-sync-project", { body: payload });
      if (error) {
        toast({ title: "Erro Monday", description: "N??o foi poss??vel criar o board.", variant: "destructive" });
      } else {
        toast({ title: "Board Monday criado!" });
        loadProjetos();
      }
    } catch {
      toast({ title: "Erro Monday", description: "Falha na sincroniza????o.", variant: "destructive" });
    }
    setSyncingMondayId(null);
  };

  // ????????? Shared sheet content ?????????
  const renderSheetBody = () => {
    const isEditable = sheetMode === "edit" || sheetMode === "new";
    const projeto = detailProjeto;

    return (
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex-1 flex flex-col min-h-0">
        <div className="sm:hidden mb-3 px-1">
          <Select value={abaAtiva} onValueChange={setAbaAtiva}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geral">Geral</SelectItem>
              <SelectItem value="atividades">Atividades</SelectItem>
              <SelectItem value="despesas">Despesas</SelectItem>
              <SelectItem value="stakeholders">Stakeholders</SelectItem>
              <SelectItem value="riscos">Riscos</SelectItem>
              <SelectItem value="baseline">Baseline</SelectItem>
              <SelectItem value="config">Config.</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden sm:grid w-full grid-cols-7">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
          <TabsTrigger value="riscos">Riscos</TabsTrigger>
          <TabsTrigger value="baseline">Baseline</TabsTrigger>
          <TabsTrigger value="config">Config.</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto mt-3 space-y-0">
          {/* TAB GERAL */}
          <TabsContent value="geral" className="mt-0">
            {sheetMode === "view" && projeto ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Clique em Editar para modificar os dados.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><p className="text-[10px] text-muted-foreground">C??digo</p><p className="text-sm font-mono">{projeto.codigo_cliente}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Nome do Projeto</p><p className="text-sm">{projeto.nome_cliente}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Coordenador</p><p className="text-sm">{getCoordenadorName(projeto.coordenador_id)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Contato</p><p className="text-sm">{projeto.contato_nome || "???"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Telefone</p><p className="text-sm">{projeto.contato_telefone || "???"}</p></div>
                  <div className="sm:col-span-2"><p className="text-[10px] text-muted-foreground">Endere??o</p><p className="text-sm">{projeto.endereco_cliente || "???"}</p></div>
                  <div className="sm:col-span-2"><p className="text-[10px] text-muted-foreground">Site</p><p className="text-sm">{projeto.site_cliente || "???"}</p></div>
                  <div className="sm:col-span-2"><p className="text-[10px] text-muted-foreground">Email do Contato</p><p className="text-sm">{projeto.email_contato || "???"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Horas Contratadas</p><p className="text-sm">{projeto.horas_contratadas}h</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Deslocamento (horas)</p><p className="text-sm">{projeto.deslocamento}h</p></div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Status</p>
                    <p className="text-sm flex items-center gap-1.5">
                      <span className={cn("inline-block h-3 w-3 rounded-full",
                        projeto.status === "Liberado" ? "bg-emerald-500" :
                        projeto.status === "Encerrado" ? "bg-red-500" : "bg-yellow-500"
                      )} />
                      {projeto.status || "Em planejamento"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Dados do Cliente</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">C??digo do Projeto *</Label>
                    <Input
                      value={codigoCliente}
                      onChange={(e) => setCodigoCliente(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase())}
                      placeholder="ABC123"
                      maxLength={6}
                    />
                    <p className="text-[10px] text-muted-foreground">6 caracteres alfanum??ricos</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Projeto *</Label>
                    <Input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Nome do cliente" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Coordenador Respons??vel *</Label>
                    <Select value={selectedCoordenador} onValueChange={setSelectedCoordenador}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {coordenadores.map((c) => (
                          <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Contato</Label>
                    <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone do Contato</Label>
                    <Input
                      value={contatoTelefone}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                        let formatted = "";
                        if (raw.length > 0) formatted = `(${raw.slice(0, 2)}`;
                        if (raw.length >= 3) formatted += `) ${raw.slice(2, 7)}`;
                        if (raw.length >= 8) formatted += `-${raw.slice(7)}`;
                        setContatoTelefone(raw.length === 0 ? "" : formatted);
                      }}
                      placeholder="(11) 99999-9999"
                      type="tel"
                      maxLength={15}
                    />
                    <p className="text-[10px] text-muted-foreground">Formato: (DDD) 9XXXX-XXXX</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Endere??o</Label>
                    <Input value={enderecoCliente} onChange={(e) => setEnderecoCliente(e.target.value)} placeholder="Endere??o completo" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Site</Label>
                    <Input value={siteCliente} onChange={(e) => setSiteCliente(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Email do Contato</Label>
                    <Input type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@empresa.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Horas Contratadas *</Label>
                    <Input type="number" min="0" value={horasContratadas} onChange={(e) => setHorasContratadas(e.target.value)} placeholder="Ex: 100" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Deslocamento (horas)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="9"
                      value={deslocamento}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                        setDeslocamento(v);
                      }}
                      placeholder="0-9"
                      maxLength={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status do Projeto *</Label>
                    <Select value={statusProjeto} onValueChange={setStatusProjeto}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Em planejamento">???? Em planejamento</SelectItem>
                        <SelectItem value="Liberado">???? Liberado</SelectItem>
                        <SelectItem value="Encerrado">???? Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB ATIVIDADES */}
          <TabsContent value="atividades" className="mt-0">
            {projeto && (() => {
              const totalUsado = atividades.reduce((s, a) => s + a.horas, 0);
              const pct = projeto.horas_contratadas > 0
                ? Math.min(100, (totalUsado / projeto.horas_contratadas) * 100)
                : 0;
              return (
                <div className="mb-4 p-3 rounded-lg bg-muted/40 border">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-medium">{totalUsado}h planejadas</span>
                    <span>{projeto.horas_contratadas}h contratadas</span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden border">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct >= 100 ? "bg-red-500" :
                        pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {Math.round(pct)}% planejado
                  </p>
                </div>
              );
            })()}

            {atividades.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma atividade cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {atividades.map((a, i) => (
                  <div key={a.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-md p-2 -mx-1">
                      <span className="font-mono text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded">{a.codigo}</span>
                      <span className="text-sm flex-1 font-medium">{a.descricao}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.data_inicio ? a.data_inicio.split("-").reverse().join("/") : "???"}
                        {a.data_fim ? ` ??? ${a.data_fim.split("-").reverse().join("/")}` : ""}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono">{a.horas}h</Badge>
                    </div>

                    {(cronogramaMap[a.id] || []).length > 0 && (
                      <div className="ml-2 space-y-1">
                        {(cronogramaMap[a.id] || []).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/50">
                            <span className="font-mono text-muted-foreground">{item.codigo}</span>
                            <span className="flex-1">{item.descricao}</span>
                            <span className="text-muted-foreground">{item.horas_reservadas}h</span>
                            {item.doc_exigido && (
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1",
                                  item.doc_satisfeito
                                    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                                    : "border-amber-500 text-amber-700 dark:text-amber-400"
                                )}
                              >
                                {item.doc_satisfeito ? "??? Doc" : "??? Doc"}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isEditable && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <Input
                            type="number" min="0.5" step="0.5" className="h-7 text-xs w-16"
                            value={a.horas}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setAtividades(prev => prev.map(at => at.id === a.id ? { ...at, horas: val } : at));
                            }}
                            onBlur={() => {
                              const limite = parseFloat(horasContratadas) || 0;
                              const total = atividades.reduce((s, at) => s + at.horas, 0);
                              if (limite > 0 && total > limite) {
                                toast({ title: "Aten????o", description: `Total de horas (${total}h) excede as contratadas (${limite}h).`, variant: "destructive" });
                              }
                            }}
                          />
                          <Input type="date" className="h-7 text-xs w-[150px]" value={a.data_inicio || ""}
                            onChange={(e) => setAtividades(prev => prev.map(at => at.id === a.id ? { ...at, data_inicio: e.target.value || null } : at))} />
                          <Input type="date" className="h-7 text-xs w-[150px]" value={a.data_fim || ""}
                            onChange={(e) => setAtividades(prev => prev.map(at => at.id === a.id ? { ...at, data_fim: e.target.value || null } : at))} />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAtividadeLocal(i)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <AdminCronogramaItens
                          atividadeId={a.id}
                          atividadeCodigo={a.codigo}
                          atividadeHoras={a.horas}
                          itens={cronogramaMap[a.id] || []}
                          usuarios={allUsers}
                          tiposDocumento={tiposDocumento}
                          onUpdate={(atividadeId, itens) => {
                            setCronogramaMap(prev => ({ ...prev, [atividadeId]: itens }));
                          }}
                          atividadeDataInicio={a.data_inicio ?? null}
                          atividadeDataFim={a.data_fim ?? null}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isEditable && (
              <div className="mt-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-end">
                <div className="w-full sm:w-24 space-y-1">
                  <Label className="text-xs">C??digo</Label>
                  <Input value={newAtivCodigo} onChange={(e) => setNewAtivCodigo(e.target.value)} placeholder="A01" />
                </div>
                <div className="col-span-2 sm:flex-1 space-y-1">
                  <Label className="text-xs">Descri????o</Label>
                  <Input value={newAtivDescricao} onChange={(e) => setNewAtivDescricao(e.target.value)} placeholder="Descri????o da atividade" />
                </div>
                <div className="w-full sm:w-20 space-y-1">
                  <Label className="text-xs">Horas</Label>
                  <Input type="number" value={newAtivHoras} onChange={(e) => setNewAtivHoras(e.target.value)} placeholder="0" />
                </div>
                <div className="w-full sm:w-32 space-y-1">
                  <Label className="text-[10px]">Data in??cio</Label>
                  <Input type="date" className="h-8 text-xs" value={newAtivDataInicio} onChange={(e) => setNewAtivDataInicio(e.target.value)} />
                </div>
                <div className="w-full sm:w-32 space-y-1">
                  <Label className="text-[10px]">Data fim</Label>
                  <Input type="date" className="h-8 text-xs" value={newAtivDataFim} onChange={(e) => setNewAtivDataFim(e.target.value)} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Button variant="outline" className="w-full sm:w-8 h-8 gap-1" onClick={addAtividadeLocal}>
                    <Plus className="h-4 w-4" />
                    <span className="sm:hidden">Adicionar</span>
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB DESPESAS */}
          <TabsContent value="despesas" className="mt-0">
            <p className="text-sm font-medium mb-2">Despesas do Projeto</p>
            {despesas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma despesa cadastrada.</p>
            ) : (
              <div className="rounded-lg border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor M??ximo</TableHead>
                      {isEditable && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesas.map((d, i) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.tipo_despesa}</TableCell>
                        <TableCell>R$ {d.valor_maximo.toFixed(2)}</TableCell>
                        {isEditable && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeDespesaLocal(i)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {isEditable && (
              <div className="flex gap-2 items-end mt-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Input value={newDespTipo} onChange={(e) => setNewDespTipo(e.target.value)} placeholder="Ex: Alimenta????o" />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Valor M??x.</Label>
                  <Input type="number" step="0.01" value={newDespValor} onChange={(e) => setNewDespValor(e.target.value)} placeholder="0.00" />
                </div>
                <Button variant="outline" size="icon" onClick={addDespesaLocal}><Plus className="h-4 w-4" /></Button>
              </div>
            )}
          </TabsContent>

          {/* TAB STAKEHOLDERS */}
          <TabsContent value="stakeholders" className="mt-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1.5"><Users className="h-4 w-4" /> Mapa de Stakeholders</p>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openNewStakeholder}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
            {stakeholders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum stakeholder cadastrado.</p>
            ) : (
              <div className="space-y-4">
                {stakeholders.filter(s => s.tipo === "Interno").length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Internos</p>
                    <div className="rounded-lg border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                            <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stakeholders.filter(s => s.tipo === "Interno").map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-sm font-medium">{s.nome}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{s.cargo || "???"}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{s.email || "???"}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant="default" className="text-[10px]">{s.tipo}</Badge>
                                  <Badge variant={s.tipo_influencia === "Apoiador" ? "default" : s.tipo_influencia === "Bloqueador" ? "destructive" : "outline"} className="text-[10px]">{s.tipo_influencia}</Badge>
                                  {s.nivel_hierarquico && <Badge variant="secondary" className="text-[10px]">{s.nivel_hierarquico}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStakeholder(s)}><Edit className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteStakeholder(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {stakeholders.filter(s => s.tipo === "Externo").length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Externos</p>
                    <div className="rounded-lg border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                            <TableHead className="hidden sm:table-cell">Empresa</TableHead>
                            <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stakeholders.filter(s => s.tipo === "Externo").map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-sm font-medium">{s.nome}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{s.cargo || "???"}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{s.empresa || "???"}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{s.email || "???"}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant="secondary" className="text-[10px]">{s.tipo}</Badge>
                                  <Badge variant={s.tipo_influencia === "Apoiador" ? "default" : s.tipo_influencia === "Bloqueador" ? "destructive" : "outline"} className="text-[10px]">{s.tipo_influencia}</Badge>
                                  {s.nivel_hierarquico && <Badge variant="secondary" className="text-[10px]">{s.nivel_hierarquico}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStakeholder(s)}><Edit className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteStakeholder(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB RISCOS */}
          <TabsContent value="riscos" className="mt-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> Mapeamento de Riscos</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="exibirEncerrados"
                    checked={exibirEncerrados}
                    onCheckedChange={(checked) => setExibirEncerrados(checked === true)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <Label htmlFor="exibirEncerrados" className="text-xs text-muted-foreground cursor-pointer">
                    Exibir encerrados
                  </Label>
                </div>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openNewRisco}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
            </div>
            {(() => {
              const riscosFiltrados = exibirEncerrados
                ? riscos
                : riscos.filter(r => r.status !== "Encerrado");
              return riscosFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum risco cadastrado.</p>
              ) : (
                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descri????o</TableHead>
                        <TableHead>Probabilidade</TableHead>
                        <TableHead>Impacto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Respons??vel</TableHead>
                        <TableHead className="hidden sm:table-cell">A????o Mitigadora</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riscosFiltrados.map((r) => {
                        const responsavel = stakeholders.find(s => s.id === r.responsavel_id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm font-medium">{r.descricao}</TableCell>
                            <TableCell>
                              <Badge variant={r.probabilidade === "Alta" ? "destructive" : r.probabilidade === "M??dia" ? "default" : "secondary"} className="text-xs">{r.probabilidade}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.impacto === "Alto" ? "destructive" : r.impacto === "M??dio" ? "default" : "secondary"} className="text-xs">{r.impacto}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.status === "Encerrado" ? "secondary" : r.status === "Em Mitiga????o" ? "default" : "outline"} className="text-xs">{r.status}</Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              {responsavel
                                ? `${responsavel.nome}${responsavel.cargo ? ` ?? ${responsavel.cargo}` : ""}`
                                : "???"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">{r.acao_mitigadora || "???"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRisco(r)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRisco(r.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </TabsContent>

          {/* TAB BASELINE */}
          <TabsContent value="baseline" className="mt-0">
            <p className="text-sm font-medium mb-2">Baselines do Projeto</p>
            {baselines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma baseline salva. Acesse o Status Report para salvar a primeira baseline deste projeto.
              </p>
            ) : (
              <div className="rounded-lg border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Vers??o</TableHead>
                      <TableHead className="text-xs">Descri????o</TableHead>
                      <TableHead className="text-xs">Salvo em</TableHead>
                      <TableHead className="text-xs w-24">A????es</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baselines.map((b) => {
                      const dt = new Date(b.created_at);
                      const fmt = `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="text-sm font-medium">{b.versao}</TableCell>
                          <TableCell className="text-sm">{b.descricao || "???"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBaselineComparando(b)}>
                              Ver comparativo
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* TAB CONFIG */}
          <TabsContent value="config" className="mt-0">
            <p className="text-sm font-semibold mb-3">Integra????es</p>
            {(() => {
              const integracoes: IntegracaoConfig[] = [
                {
                  key: "monday",
                  nome: "Monday.com",
                  logo: (
                    <svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="68" r="18" fill="#ff3750"/>
                      <circle cx="50" cy="68" r="18" fill="#ffcb00"/>
                      <circle cx="82" cy="68" r="18" fill="#00ca72"/>
                    </svg>
                  ),
                  status: detailProjeto?.monday_board_id ? "criado" : "nao_criado",
                  statusLabel: detailProjeto?.monday_board_id ? "??? Criado" : "N??o criado",
                  sub: detailProjeto?.monday_board_id
                    ? `${detailProjeto.codigo_cliente} - ${detailProjeto.nome_cliente}`
                    : "Board Monday n??o vinculado a este projeto",
                  acoes: detailProjeto?.monday_board_id ? (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => window.open(detailProjeto.monday_board_url!, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Abrir board
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={creatingBoard === detailProjeto?.id} onClick={() => detailProjeto && handleCreateBoardManual(detailProjeto)}>
                      {creatingBoard === detailProjeto?.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                      Criar board Monday
                    </Button>
                  ),
                  zonaRisco: detailProjeto?.monday_board_id ? (
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Zona de risco</p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" disabled={resettingBoard === detailProjeto?.id} onClick={() => detailProjeto && handleResetBoard(detailProjeto)}>
                          {resettingBoard === detailProjeto?.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Reset board
                        </Button>
                        <span className="text-[9px] text-muted-foreground">arquiva e remove v??nculo</span>
                      </div>
                    </div>
                  ) : null,
                },
                {
                  key: "protheus",
                  nome: "Protheus (TOTVS)",
                  logo: (
                    <svg width="28" height="20" viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg">
                      <text x="50%" y="70%" dominantBaseline="middle" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="sans-serif" fill="#e8312a">TOTVS</text>
                    </svg>
                  ),
                  status: "ativo",
                  statusLabel: "??? Ativo",
                  sub: `C??digo cliente: ${detailProjeto?.codigo_cliente ?? "???"}`,
                },
                {
                  key: "sharepoint",
                  nome: "SharePoint",
                  logo: (
                    <svg width="26" height="26" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="13" cy="13" r="10" fill="#036C70"/>
                      <circle cx="20" cy="17" r="9" fill="#1A9BA1"/>
                      <circle cx="22" cy="24" r="7" fill="#37C6D0"/>
                      <circle cx="13" cy="13" r="5.5" fill="#fff"/>
                      <text x="13" y="16.5" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="sans-serif" fill="#036C70">S</text>
                    </svg>
                  ),
                  status: detailProjeto?.sharepoint_pasta_url ? "ativo" : "disponivel",
                  statusLabel: detailProjeto?.sharepoint_pasta_url ? "??? Ativo" : "Dispon??vel",
                  sub: detailProjeto?.sharepoint_pasta_url
                    ? `Documentos/${detailProjeto.codigo_cliente} - ${detailProjeto.nome_cliente}`
                    : "Nenhum documento enviado ainda para este projeto.",
                  help: detailProjeto?.sharepoint_pasta_url
                    ? undefined
                    : "A pasta deste projeto no SharePoint ?? criada automaticamente no primeiro envio de documento. O status passa para Ativo assim que isso ocorrer.",
                  acoes: detailProjeto?.sharepoint_pasta_url ? (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => window.open(detailProjeto.sharepoint_pasta_url!, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Abrir pasta
                    </Button>
                  ) : null,
                },
                {
                  key: "github",
                  nome: "GitHub",
                  logo: (
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  ),
                  status: "detalhamento",
                  statusLabel: "Em detalhamento",
                  sub: "Versionamento e automa????es ??? em breve",
                },
                {
                  key: "autentique",
                  nome: "Autentique",
                  logo: (
                    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] rounded-md">
                      <span className="text-[10px] font-bold text-purple-400">Au</span>
                    </div>
                  ),
                  status: detailProjeto?.autentique_folder_id ? "ativo" : "disponivel",
                  statusLabel: detailProjeto?.autentique_folder_id ? "??? Ativo" : "Dispon??vel",
                  sub: detailProjeto?.autentique_folder_id
                    ? `${detailProjeto.codigo_cliente} - ${detailProjeto.nome_cliente}`
                    : "Nenhum envelope de assinatura criado ainda para este projeto.",
                  help: detailProjeto?.autentique_folder_id
                    ? undefined
                    : "A pasta e o envelope no Autentique s??o criados automaticamente quando o coordenador aciona o envio para assinatura em um item do cronograma. O status passa para Ativo assim que isso ocorrer.",
                  acoes: detailProjeto?.autentique_folder_url ? (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => window.open(detailProjeto.autentique_folder_url!, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Abrir pasta
                    </Button>
                  ) : null,
                },
              ];

              const badgeClasses: Record<string, string> = {
                ativo: "bg-emerald-50 text-emerald-800 border border-emerald-300",
                criado: "bg-emerald-50 text-emerald-800 border border-emerald-300",
                nao_criado: "bg-muted text-muted-foreground border",
                disponivel: "bg-slate-50 text-slate-600 border border-slate-200",
                desenvolvimento: "bg-yellow-50 text-yellow-800 border border-yellow-300",
                detalhamento: "bg-blue-50 text-blue-800 border border-blue-200",
              };

              return (
                <div className="space-y-3">
                  {integracoes.map((integ) => (
                    <div key={integ.key} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="w-9 h-9 rounded-md border flex items-center justify-center shrink-0 bg-background overflow-hidden">
                        {integ.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium">{integ.nome}</p>
                          <Badge className={cn("text-[10px] font-normal", badgeClasses[integ.status])}>{integ.statusLabel}</Badge>
                        </div>
                        {integ.sub && <p className="text-xs text-muted-foreground mb-2">{integ.sub}</p>}
                        {integ.help && (
                          <div className="flex items-start gap-1.5 mt-1 mb-2 rounded-md bg-muted/50 px-2 py-1.5">
                            <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-[11px] text-muted-foreground leading-snug">{integ.help}</p>
                          </div>
                        )}
                        {integ.acoes && <div className="flex items-center gap-2">{integ.acoes}</div>}
                        {integ.zonaRisco}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ?????? ALERTAS PROATIVOS ?????? */}
            <p className="text-sm font-semibold mt-5 mb-3">Alertas Proativos</p>
            <Card>
              <CardContent className="p-4 space-y-4">
                {([
                  { key: "feeling",     icon: "????", label: "Desvio de Feeling",     ativoKey: "alerta_feeling_ativo",     valorKey: "alerta_feeling_threshold",  valorLabel: "Desvio m??nimo (pp):",       min: 5,  max: 50  },
                  { key: "apontamento", icon: "????", label: "Agenda s/ Apontamento", ativoKey: "alerta_apontamento_ativo", valorKey: "alerta_apontamento_dias",    valorLabel: "Dias sem apontamento:",     min: 1,  max: 30  },
                  { key: "consumo",     icon: "???",  label: "Consumo de Horas",      ativoKey: "alerta_consumo_ativo",     valorKey: "alerta_consumo_threshold",  valorLabel: "Threshold de consumo (%):", min: 50, max: 100 },
                  { key: "parada",      icon: "???",  label: "Atividade Parada",      ativoKey: "alerta_parada_ativo",      valorKey: "alerta_parada_dias",        valorLabel: "Dias ??teis sem agenda:",    min: 1,  max: 30  },
                ] as const).map((item, idx) => (
                  <div key={item.key}>
                    {idx > 0 && <div className="border-t border-dashed mb-4" />}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{item.icon} {item.label}</span>
                          <Badge variant={(alertaConfig as any)[item.ativoKey] ? "default" : "secondary"} className="text-[9px]">
                            {(alertaConfig as any)[item.ativoKey] ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <button
                          onClick={() => setAlertaConfig(c => ({ ...c, [item.ativoKey]: !(c as any)[item.ativoKey] }))}
                          className={`w-9 h-5 rounded-full relative transition-colors ${(alertaConfig as any)[item.ativoKey] ? "bg-primary" : "bg-muted-foreground/30"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${(alertaConfig as any)[item.ativoKey] ? "left-4" : "left-0.5"}`} />
                        </button>
                      </div>
                      {(alertaConfig as any)[item.ativoKey] && (
                        <div className="flex items-center gap-2 pl-1">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">{item.valorLabel}</Label>
                          <Input
                            type="number" min={item.min} max={item.max}
                            value={(alertaConfig as any)[item.valorKey]}
                            onChange={(e) => setAlertaConfig(c => ({ ...c, [item.valorKey]: Number(e.target.value) }))}
                            className="h-7 w-20 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  size="sm" className="w-full gap-1 mt-2"
                  onClick={async () => {
                    if (!detailProjeto) return;
                    setSavingAlertaConfig(true);
                    const { error } = await supabase
                      .from("projeto_alertas_config")
                      .upsert({ ...alertaConfig, projeto_id: detailProjeto.id, updated_at: new Date().toISOString() }, { onConflict: "projeto_id" });
                    if (error) {
                      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Configura????o de alertas salva!" });
                    }
                    setSavingAlertaConfig(false);
                  }}
                  disabled={savingAlertaConfig}
                >
                  {savingAlertaConfig ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar configura????o de alertas
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    );
  };

  // ????????? Desktop list ?????????
  const renderDesktopList = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b">
        <input
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Buscar cliente ou c??digo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className="w-9 h-9 flex items-center justify-center border-l text-primary hover:bg-muted/50 transition-colors shrink-0 text-lg font-light"
          title="Novo projeto"
          onClick={() => { openNew(); setSheetMode("new"); setSheetOpen(true); setListExpanded(false); }}
        >
          +
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap px-3 py-2 border-b">
        {[
          { key: "todos", label: `Todos (${countByStatus.todos})`, active: "bg-[#1a3557] text-white border-[#1a3557]" },
          { key: "liberado", label: `Liberado (${countByStatus.liberado})`, active: "bg-emerald-50 text-emerald-800 border-emerald-500" },
          { key: "planejamento", label: `Planej. (${countByStatus.planejamento})`, active: "bg-yellow-50 text-yellow-800 border-yellow-500" },
          { key: "encerrado", label: `Encerrado (${countByStatus.encerrado})`, active: "bg-red-50 text-red-800 border-red-500" },
        ].map(({ key, label, active }) => (
          <button key={key} onClick={() => setFiltroStatus(key)}
            className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors", filtroStatus === key ? active : "border-border text-muted-foreground hover:bg-muted/50")}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : projetosFiltrados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum projeto encontrado.</p>
        ) : (
          projetosFiltrados.map((p) => (
            <div key={p.id}
              className={cn("flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-muted/40 transition-colors", detailProjeto?.id === p.id && "bg-blue-50/60")}
              onClick={() => { loadProjetoDetails(p); setSheetMode("view"); setSheetOpen(true); setListExpanded(false); }}
            >
              <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", p.status === "Liberado" ? "bg-emerald-500" : p.status === "Encerrado" ? "bg-red-500" : "bg-yellow-500")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.nome_cliente}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.codigo_cliente} ?? {getCoordenadorName(p.coordenador_id)}</p>
              </div>
              {p.monday_board_id ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">Monday</span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">Sem board</span>
              )}
              <button className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderRail = () => (
    <div className="flex flex-col items-center py-2 gap-1 h-full">
      <button className="flex items-center justify-center gap-0.5 w-9 h-5 text-[8px] text-muted-foreground border rounded mb-1 hover:bg-muted/50 transition-colors"
        onClick={() => setListExpanded(true)} title="Expandir lista">
        <ChevronDown className="h-2.5 w-2.5 rotate-[-90deg]" /><span>lista</span>
      </button>
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-0.5">
        {projetos.map((p) => (
          <button key={p.id} title={p.nome_cliente}
            onClick={() => { loadProjetoDetails(p); setSheetMode("view"); setSheetOpen(true); }}
            className={cn("flex flex-col items-center gap-0.5 w-11 py-1.5 px-1 rounded-md transition-colors", detailProjeto?.id === p.id ? "bg-blue-50" : "hover:bg-muted/50")}
          >
            <span className={cn("inline-block h-2 w-2 rounded-full", p.status === "Liberado" ? "bg-emerald-500" : p.status === "Encerrado" ? "bg-red-500" : "bg-yellow-500")} />
            <span className={cn("text-[7px] text-center leading-tight max-w-[38px] truncate", detailProjeto?.id === p.id ? "text-blue-800 font-medium" : "text-muted-foreground")}>
              {p.nome_cliente.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>
      <div className="text-[7px] text-muted-foreground text-center border-t w-full pt-1 px-1">expandir</div>
    </div>
  );

  const renderMobileCards = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Total", value: countByStatus.todos, color: "" },
          { label: "Liberados", value: countByStatus.liberado, color: "text-emerald-600" },
          { label: "Planejamento", value: countByStatus.planejamento, color: "text-yellow-600" },
          { label: "Sem board", value: projetos.filter(p => !p.monday_board_id).length, color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-muted/30">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={cn("text-xl font-medium", color)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center border rounded-lg overflow-hidden">
        <input className="flex-1 px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Buscar cliente ou c??digo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <button className="w-10 h-10 flex items-center justify-center border-l text-primary hover:bg-muted/50 transition-colors shrink-0 text-lg font-light"
          title="Novo projeto" onClick={() => { openNew(); setSheetMode("new"); setSheetOpen(true); }}>+</button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "todos", label: `Todos (${countByStatus.todos})`, active: "bg-[#1a3557] text-white border-[#1a3557]" },
          { key: "liberado", label: `Liberado (${countByStatus.liberado})`, active: "bg-emerald-50 text-emerald-800 border-emerald-500" },
          { key: "planejamento", label: `Planej. (${countByStatus.planejamento})`, active: "bg-yellow-50 text-yellow-800 border-yellow-500" },
          { key: "encerrado", label: `Encerrado (${countByStatus.encerrado})`, active: "bg-red-50 text-red-800 border-red-500" },
        ].map(({ key, label, active }) => (
          <button key={key} onClick={() => setFiltroStatus(key)}
            className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors", filtroStatus === key ? active : "border-border text-muted-foreground hover:bg-muted/50")}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : projetosFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum projeto encontrado.</p>
      ) : (
        <div className="space-y-2">
          {projetosFiltrados.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => { loadProjetoDetails(p); setSheetMode("view"); setSheetOpen(true); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", p.status === "Liberado" ? "bg-emerald-500" : p.status === "Encerrado" ? "bg-red-500" : "bg-yellow-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.nome_cliente}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.codigo_cliente} ?? {getCoordenadorName(p.coordenador_id)}</p>
                </div>
                {p.monday_board_id ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">Monday</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">Sem board</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderSheetHeader = () => (
    <div className="space-y-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold truncate">
            {sheetMode === "new" ? "Novo projeto" : detailProjeto?.nome_cliente}
          </h2>
          {sheetMode !== "new" && detailProjeto && (
            <p className="text-xs text-muted-foreground truncate">
              {detailProjeto.codigo_cliente} ?? {getCoordenadorName(detailProjeto.coordenador_id)} ?? {detailProjeto.status}
              {detailProjeto.monday_board_id && " ?? Monday vinculado"}
            </p>
          )}
        </div>
        {sheetMode !== "new" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0">
                Outras a????es <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { if (detailProjeto) { openEdit(detailProjeto); setSheetMode("edit"); } }}>
                <Edit className="h-3.5 w-3.5" /> Editar projeto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm text-destructive focus:text-destructive" onClick={() => { if (detailProjeto) handleDelete(detailProjeto.id); }}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir projeto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm text-muted-foreground" onClick={() => { setSheetOpen(false); setDetailProjeto(null); setListExpanded(true); }}>
                <X className="h-3.5 w-3.5" /> Fechar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );

  const renderSheetFooter = () => {
    const isEditable = sheetMode === "edit" || sheetMode === "new";
    if (!isEditable) return null;
    return (
      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" onClick={() => { setSheetMode("view"); if (sheetMode === "new") setSheetOpen(false); }}>Cancelar</Button>
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {sheetMode === "new" ? "Cadastrar Projeto" : "Salvar Altera????es"}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* DESKTOP */}
      <div className="hidden sm:flex" style={{ height: "calc(100vh - 8rem)" }}>
        {listExpanded && !sheetOpen ? (
          <div className="w-[300px] shrink-0 border rounded-lg overflow-hidden flex flex-col mr-4 bg-background">{renderDesktopList()}</div>
        ) : sheetOpen && !listExpanded ? (
          <div className="w-[52px] shrink-0 border rounded-lg overflow-hidden flex flex-col mr-4 bg-background">{renderRail()}</div>
        ) : (
          <div className="w-[300px] shrink-0 border rounded-lg overflow-hidden flex flex-col mr-4 bg-background">{renderDesktopList()}</div>
        )}

        {sheetOpen && (detailProjeto || sheetMode === "new") ? (
          <div className="flex-1 min-w-0">
            <Card className="flex flex-col h-full">
              <CardHeader className="pb-2 shrink-0">{renderSheetHeader()}</CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden pb-0">{renderSheetBody()}</CardContent>
              <div className="px-6 pb-4 shrink-0">{renderSheetFooter()}</div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total de projetos", value: projetos.length, sub: "cadastrados", color: "" },
                { label: "Liberados", value: countByStatus.liberado, sub: "em execu????o", color: "text-emerald-600" },
                { label: "Em planejamento", value: countByStatus.planejamento, sub: "aguardando in??cio", color: "text-yellow-600" },
                { label: "Sem board Monday", value: projetos.filter(p => !p.monday_board_id).length, sub: "pendente cria????o", color: "text-red-500" },
              ].map(({ label, value, sub, color }) => (
                <Card key={label} className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={cn("text-3xl font-medium", color)}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Selecione um projeto para ver detalhes</p>
                <p className="text-xs text-muted-foreground/60">ou clique em + para cadastrar novo</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE */}
      <div className="sm:hidden">
        {renderMobileCards()}
        <Sheet open={sheetOpen && isMobile} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[90vh] flex flex-col p-4">
            <SheetHeader className="shrink-0 pb-2">
              <SheetTitle className="sr-only">{sheetMode === "new" ? "Novo projeto" : detailProjeto?.nome_cliente || "Projeto"}</SheetTitle>
              {renderSheetHeader()}
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-y-auto">{renderSheetBody()}</div>
            <div className="shrink-0">{renderSheetFooter()}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Stakeholder Dialog */}
      <Dialog open={stakeholderDialogOpen} onOpenChange={setStakeholderDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingStakeholder ? "Editar Stakeholder" : "Novo Stakeholder"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={shTipo} onValueChange={(v) => { setShTipo(v); if (v === "Externo") setShProfileUserId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Externo">Externo</SelectItem>
                  <SelectItem value="Interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shTipo === "Interno" && (
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Vincular usu??rio do sistema</Label>
                <Select value={shProfileUserId || ""} onValueChange={handleSelectUsuarioInterno}>
                  <SelectTrigger><SelectValue placeholder="Selecione um usu??rio..." /></SelectTrigger>
                  <SelectContent>{allUsers.map((u) => (<SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input value={shNome} onChange={(e) => setShNome(e.target.value)} placeholder="Nome completo" disabled={shProfileUserId !== null} className={shProfileUserId !== null ? "bg-muted text-muted-foreground cursor-not-allowed" : ""} />
            </div>
            <div className="space-y-1"><Label className="text-xs">Cargo</Label><Input value={shCargo} onChange={(e) => setShCargo(e.target.value)} placeholder="Cargo" /></div>
            <div className="space-y-1"><Label className="text-xs">Departamento</Label><Input value={shDepartamento} onChange={(e) => setShDepartamento(e.target.value)} placeholder="Departamento" /></div>
            <div className="space-y-1"><Label className="text-xs">Empresa</Label><Input value={shEmpresa} onChange={(e) => setShEmpresa(e.target.value)} placeholder="Empresa" disabled={shProfileUserId !== null} className={shProfileUserId !== null ? "bg-muted text-muted-foreground cursor-not-allowed" : ""} /></div>
            <div className="space-y-1">
              <Label className="text-xs">N??vel Hier??rquico</Label>
              <Select value={shNivel} onValueChange={setShNivel}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diretor">Diretor</SelectItem>
                  <SelectItem value="Gerente">Gerente</SelectItem>
                  <SelectItem value="Coordenador">Coordenador</SelectItem>
                  <SelectItem value="Analista">Analista</SelectItem>
                  <SelectItem value="Operacional">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input type="email" value={shEmail} onChange={(e) => setShEmail(e.target.value)} placeholder="email@empresa.com" disabled={shProfileUserId !== null} className={shProfileUserId !== null ? "bg-muted text-muted-foreground cursor-not-allowed" : ""} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={shTelefone} onChange={(e) => { const raw = e.target.value.replace(/\D/g, "").slice(0, 11); let f = ""; if (raw.length > 0) f = `(${raw.slice(0, 2)}`; if (raw.length >= 3) f += `) ${raw.slice(2, 7)}`; if (raw.length >= 8) f += `-${raw.slice(7)}`; setShTelefone(raw.length === 0 ? "" : f); }} placeholder="(11) 99999-9999" type="tel" maxLength={15} disabled={shProfileUserId !== null} className={shProfileUserId !== null ? "bg-muted text-muted-foreground cursor-not-allowed" : ""} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Influ??ncia</Label>
              <Select value={shInfluencia} onValueChange={setShInfluencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Apoiador">Apoiador</SelectItem>
                  <SelectItem value="Neutro">Neutro</SelectItem>
                  <SelectItem value="Resistente">Resistente</SelectItem>
                  <SelectItem value="Bloqueador">Bloqueador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Interesses e expectativas</Label><Textarea rows={3} value={shInteresses} onChange={(e) => setShInteresses(e.target.value)} placeholder="Descreva interesses e expectativas..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStakeholderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveStakeholder} disabled={savingStakeholder} className="gap-1">
              {savingStakeholder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risco Dialog */}
      <Dialog open={riscoDialogOpen} onOpenChange={setRiscoDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRisco ? "Editar Risco" : "Novo Risco"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label className="text-xs">Descri????o *</Label><Textarea rows={2} value={rsDescricao} onChange={(e) => setRsDescricao(e.target.value)} placeholder="Descreva o risco..." /></div>
            <div className="space-y-1"><Label className="text-xs">Probabilidade</Label><Select value={rsProbabilidade} onValueChange={setRsProbabilidade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Baixa">Baixa</SelectItem><SelectItem value="M??dia">M??dia</SelectItem><SelectItem value="Alta">Alta</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Impacto</Label><Select value={rsImpacto} onValueChange={setRsImpacto}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Baixo">Baixo</SelectItem><SelectItem value="M??dio">M??dio</SelectItem><SelectItem value="Alto">Alto</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={rsStatus} onValueChange={setRsStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Identificado">Identificado</SelectItem><SelectItem value="Em Mitiga????o">Em Mitiga????o</SelectItem><SelectItem value="Encerrado">Encerrado</SelectItem></SelectContent></Select></div>
            <div className="space-y-1">
              <Label className="text-xs">Respons??vel</Label>
              <Select value={rsResponsavelId || "none"} onValueChange={(v) => setRsResponsavelId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem respons??vel</SelectItem>
                  {stakeholders.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}{s.cargo ? ` ?? ${s.cargo}` : ""}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">A????o Mitigadora</Label><Textarea rows={2} value={rsAcao} onChange={(e) => setRsAcao(e.target.value)} placeholder="Descreva a a????o mitigadora..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiscoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRisco} disabled={savingRisco} className="gap-1">
              {savingRisco ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baseline Comparison Dialog */}
      <Dialog open={baselineComparando !== null} onOpenChange={(open) => { if (!open) setBaselineComparando(null); }}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">Comparativo de Baseline</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {baselineComparando?.versao}{baselineComparando?.descricao ? ` ?? ${baselineComparando.descricao}` : ""}{" ?? "}
                {baselineComparando?.created_at ? new Date(baselineComparando.created_at).toLocaleDateString("pt-BR") : ""}{" vs. estado atual"}
              </DialogDescription>
            </div>
            <button className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0 mt-0.5" onClick={() => setBaselineComparando(null)}>
              <X className="h-4 w-4" /><span className="sr-only">Fechar</span>
            </button>
          </DialogHeader>
          {baselineComparando && (() => {
            const blAtivs: any[] = baselineComparando.snapshot?.atividades || [];
            const blMap: Record<string, any> = {};
            blAtivs.forEach(b => { blMap[b.codigo] = b; });
            const atualCodigos = new Set(atividades.map(a => a.codigo));
            const novas = atividades.filter(a => !blMap[a.codigo]);
            const removidas = blAtivs.filter((b: any) => !atualCodigos.has(b.codigo));
            const fmtD = (d: string | null) => d ? d.split("-").reverse().join("/") : "???";

            return (
              <div className="space-y-3">
                <div className="sm:hidden space-y-3">
                  {atividades.filter(a => blMap[a.codigo]).map(a => {
                    const bl = blMap[a.codigo];
                    const diffH = a.horas - bl.horas;
                    let desvio = 0; let desvioLabel = "???"; let desvioBg = "bg-emerald-100 text-emerald-800";
                    if (a.data_fim && bl.data_fim) {
                      desvio = Math.round((new Date(a.data_fim).getTime() - new Date(bl.data_fim).getTime()) / 86400000);
                      if (desvio <= 0) { desvioLabel = "No prazo"; desvioBg = "bg-emerald-100 text-emerald-800"; }
                      else if (desvio <= 7) { desvioLabel = `+${desvio}d`; desvioBg = "bg-yellow-100 text-yellow-800"; }
                      else { desvioLabel = `+${desvio}d`; desvioBg = "bg-red-100 text-red-800"; }
                    }
                    return (
                      <div key={a.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span><p className="text-sm font-medium truncate">{a.descricao}</p></div>
                          <Badge className={cn("text-[10px] shrink-0", desvioBg)}>{desvioLabel}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Horas BL</span><span className="text-muted-foreground">Horas Atual</span>
                          <span>{bl.horas}h</span><span className={cn(diffH > 0 ? "text-red-600" : diffH < 0 ? "text-emerald-600" : "")}>{a.horas}h {diffH !== 0 && `(${diffH > 0 ? "+" : ""}${diffH}h)`}</span>
                          <span className="text-muted-foreground">In??cio BL</span><span className="text-muted-foreground">In??cio Atual</span>
                          <span>{fmtD(bl.data_inicio)}</span><span>{fmtD(a.data_inicio)}</span>
                          <span className="text-muted-foreground">Fim BL</span><span className="text-muted-foreground">Fim Atual</span>
                          <span>{fmtD(bl.data_fim)}</span><span>{fmtD(a.data_fim)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {removidas.map((b: any) => (
                    <div key={b.id} className="rounded-md border p-3 text-muted-foreground">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs">{b.codigo} ?? {b.descricao}</span><Badge className="text-[10px] bg-red-100 text-red-800">Removida</Badge></div>
                      <p className="text-xs mt-1">BL: {b.horas}h ?? {fmtD(b.data_inicio)} ??? {fmtD(b.data_fim)}</p>
                    </div>
                  ))}
                  {novas.map(a => (
                    <div key={a.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs">{a.codigo} ?? {a.descricao}</span><Badge className="text-[10px] bg-blue-100 text-blue-800">Nova</Badge></div>
                      <p className="text-xs mt-1 text-muted-foreground">Atual: {a.horas}h ?? {fmtD(a.data_inicio)} ??? {fmtD(a.data_fim)}</p>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">C??digo</TableHead><TableHead className="text-xs">Descri????o</TableHead>
                        <TableHead className="text-xs text-right">Horas BL</TableHead><TableHead className="text-xs text-right">Horas Atual</TableHead>
                        <TableHead className="text-xs text-right">Diff</TableHead><TableHead className="text-xs">In??cio BL</TableHead>
                        <TableHead className="text-xs">In??cio Atual</TableHead><TableHead className="text-xs">Fim BL</TableHead>
                        <TableHead className="text-xs">Fim Atual</TableHead><TableHead className="text-xs">Desvio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atividades.filter(a => blMap[a.codigo]).map(a => {
                        const bl = blMap[a.codigo];
                        const diffH = a.horas - bl.horas;
                        let desvio = 0; let desvioLabel = "???";
                        if (a.data_fim && bl.data_fim) {
                          desvio = Math.round((new Date(a.data_fim).getTime() - new Date(bl.data_fim).getTime()) / 86400000);
                          if (desvio <= 0) desvioLabel = "No prazo";
                          else if (desvio <= 7) desvioLabel = `+${desvio}d`;
                          else desvioLabel = `+${desvio}d`;
                        }
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs font-mono">{a.codigo}</TableCell><TableCell className="text-xs">{a.descricao}</TableCell>
                            <TableCell className="text-xs text-right">{bl.horas}h</TableCell><TableCell className="text-xs text-right">{a.horas}h</TableCell>
                            <TableCell className={cn("text-xs text-right font-medium", diffH > 0 ? "text-red-600" : diffH < 0 ? "text-emerald-600" : "text-muted-foreground")}>{diffH > 0 ? `+${diffH}` : diffH}h</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmtD(bl.data_inicio)}</TableCell><TableCell className="text-xs">{fmtD(a.data_inicio)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmtD(bl.data_fim)}</TableCell><TableCell className="text-xs">{fmtD(a.data_fim)}</TableCell>
                            <TableCell><Badge className={cn("text-[10px]", desvio <= 0 && "bg-emerald-100 text-emerald-800", desvio > 0 && desvio <= 7 && "bg-yellow-100 text-yellow-800", desvio > 7 && "bg-red-100 text-red-800")}>{desvioLabel}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                      {removidas.map((b: any) => (
                        <TableRow key={b.id} className="text-muted-foreground">
                          <TableCell className="text-xs font-mono">{b.codigo}</TableCell><TableCell className="text-xs">{b.descricao}</TableCell>
                          <TableCell className="text-xs text-right">{b.horas}h</TableCell><TableCell className="text-xs text-right">???</TableCell>
                          <TableCell className="text-xs text-right">???</TableCell><TableCell className="text-xs">{fmtD(b.data_inicio)}</TableCell>
                          <TableCell className="text-xs">???</TableCell><TableCell className="text-xs">{fmtD(b.data_fim)}</TableCell>
                          <TableCell className="text-xs">???</TableCell><TableCell><Badge className="text-[10px] bg-red-100 text-red-800">Removida</Badge></TableCell>
                        </TableRow>
                      ))}
                      {novas.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs font-mono">{a.codigo}</TableCell><TableCell className="text-xs">{a.descricao}</TableCell>
                          <TableCell className="text-xs text-right">???</TableCell><TableCell className="text-xs text-right">{a.horas}h</TableCell>
                          <TableCell className="text-xs text-right">???</TableCell><TableCell className="text-xs">???</TableCell>
                          <TableCell className="text-xs">{fmtD(a.data_inicio)}</TableCell><TableCell className="text-xs">???</TableCell>
                          <TableCell className="text-xs">{fmtD(a.data_fim)}</TableCell><TableCell><Badge className="text-[10px] bg-blue-100 text-blue-800">Nova</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
