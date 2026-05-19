// src/pages/ConsultorDashboardV2.tsx
// PROJTE -- Consultor Dashboard V2
// Layout V7 aprovado (18/05/2026): sidebar navy + conteudo claro
// Toda logica de modais portada integralmente do ConsultorDashboard.tsx original.
// Zero alteracao nos hooks, componentes e tipos existentes.
// Encoding: UTF-8 sem BOM

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  LogOut, Loader2, XCircle, PlusCircle, ChevronLeft, ChevronRight,
  Ban, Receipt, Camera, Settings, Check, ClipboardEdit, Plus, Trash2,
  CircleDollarSign, FileDown, Clock, LayoutDashboard, FileText,
  CalendarDays, ListTodo, BarChart2, FileStack, AlertCircle, Printer,
  ExternalLink, ArrowRight, CheckCircle2, Search,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday, isBefore, isAfter, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Hooks existentes -- zero alteracao
import { usePendencias } from "@/components/consultor/hooks/usePendencias";
import { useDiario } from "@/components/consultor/hooks/useDiario";

// Componentes existentes -- zero alteracao
import { PendenciasPMOCard } from "@/components/consultor/ui/PendenciasPMOCard";
import { BacklogBoard } from "@/components/consultor/ui/BacklogBoard";
import { SLABadgeSimples } from "@/components/ui/SLABadge";
import { GanttCanvas } from "@/components/consultor/ui/GanttCanvas";
import { useSharepointDocs, formatFileSize } from "@/components/consultor/hooks/useSharepointDocs";

// Tipos do arquivo centralizado
import type {
  Apontamento, ProjetoDespesa, Despesa, ProjetoAtividade,
  RequisicaoPendente, AtividadeApontada, RfAgenda, RfDespesa, OffProjeto,
} from "@/components/consultor/types/consultor.types";

// Agenda estendida com campos extras do banco
type Agenda = {
  id: string;
  cliente: string;
  data: string;
  atividade: string;
  status: string;
  atividade_descricao: string | null;
  item_cronograma: string | null;
  doc_referencia: string | null;
  codigo_cliente: string | null;
};

// ─── helpers locais (portados do original) ───────────────────────────────────

const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

const STATUS_COLORS: Record<string, string> = {
  feito:      "bg-emerald-500",
  atrasada:   "bg-red-500",
  planejada:  "bg-blue-500",
  aguardando: "bg-amber-500",
};

function formatHoras(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const mm = (totalMin % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function getRfStatusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmada:            "Prevista",
    em_aprovacao:          "Em Aprovacao",
    apontamento_ok:        "Apontamento Ok",
    apontamento_ajustado:  "Ajustado",
  };
  return map[status] || status;
}

function getRfStatusClass(status: string): string {
  const map: Record<string, string> = {
    confirmada:           "bg-blue-100 text-blue-800",
    em_aprovacao:         "bg-yellow-100 text-yellow-800",
    apontamento_ok:       "bg-emerald-100 text-emerald-800",
    apontamento_ajustado: "bg-teal-100 text-teal-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}

function getDespStatusClass(s: string): string {
  if (!s || s === "Pendente") return "bg-orange-100 text-orange-800";
  if (s.toLowerCase().includes("financeiro") || s.toLowerCase().includes("aprovad"))
    return "bg-emerald-100 text-emerald-800";
  return "bg-blue-100 text-blue-800";
}

function getAgendaStatusDisplay(agenda: Agenda) {
  const map: Record<string, { label: string; color: string }> = {
    aguardando_cancelamento: { label: "Aguardando Cancelamento", color: "bg-orange-500 text-white" },
    em_aprovacao:            { label: "EM APROVACAO",            color: "bg-yellow-500 text-white" },
    doc_pendente:            { label: "DOC. PENDENTE",           color: "bg-amber-600 text-white" },
    apontamento_ok:          { label: "APONTAMENTO OK",          color: "bg-emerald-500 text-white" },
    apontamento_ajustado:    { label: "APONTAMENTO AJUSTADO",    color: "bg-teal-500 text-white" },
  };
  return map[agenda.status] || { label: "Confirmada", color: "bg-blue-500 text-white" };
}

// ─── Sidebar SVG icons ────────────────────────────────────────────────────────

const IcoDashboard = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IcoPend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IcoReq = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
);
const IcoBacklog = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IcoDiario = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IcoCrono = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoDocs = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IcoKanban = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="12"/>
    <rect x="17" y="3" width="4" height="15"/>
  </svg>
);
const IcoLock = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// ─── Chevron logo SVG ─────────────────────────────────────────────────────────

const LogoChevron = () => (
  <svg width="42" height="42" viewBox="0 0 88 88" fill="none" style={{ flexShrink: 0 }}>
    <path d="M10 16 L26 44 L10 72" stroke="rgba(255,255,255,0.18)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28 16 L44 44 L28 72" stroke="rgba(255,255,255,0.55)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M46 16 L62 44 L46 72" stroke="#39FF87" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="62" cy="44" r="6" fill="rgba(57,255,135,0.15)"/>
    <circle cx="62" cy="44" r="4" fill="#39FF87">
      <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    <path d="M10 16 L26 44 L10 72" stroke="white" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" opacity="0">
      <animate attributeName="opacity" values="0;0;0.85;0;0;0;0" keyTimes="0;0.1;0.22;0.36;0.6;0.8;1" dur="1.5s" repeatCount="indefinite"/>
    </path>
    <path d="M28 16 L44 44 L28 72" stroke="white" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" opacity="0">
      <animate attributeName="opacity" values="0;0;0;0.85;0;0;0" keyTimes="0;0.1;0.22;0.38;0.54;0.8;1" dur="1.5s" repeatCount="indefinite"/>
    </path>
    <path d="M46 16 L62 44 L46 72" stroke="white" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" opacity="0">
      <animate attributeName="opacity" values="0;0;0;0;0.85;0;0" keyTimes="0;0.1;0.22;0.38;0.54;0.68;1" dur="1.5s" repeatCount="indefinite"/>
    </path>
  </svg>
);

// ─── Inline styles (tailwind-compatible tokens) ───────────────────────────────

const NAVY   = "#0B1628";
const LIME   = "#39FF87";
const AMBER  = "#F5A623";
const RED    = "#E24B4A";
const BLUE   = "#3B82F6";
const GREEN  = "#059669";
const BG     = "#EDF0F5";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsultorDashboardV2() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ── State: mes / data ──────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── State: agendas / dados ─────────────────────────────────────────────────
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [requisicoesPendentes, setRequisicoesPendentes] = useState<RequisicaoPendente[]>([]);
  const [offProjetos, setOffProjetos] = useState<OffProjeto[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  // ── State: timesheet ───────────────────────────────────────────────────────
  const [tsAgendadas, setTsAgendadas] = useState(0);
  const [tsApontadas, setTsApontadas] = useState(0);
  const [tsSemanas, setTsSemanas] = useState<{ label: string; agendadas: number; apontadas: number }[]>([]);
  const [tsProjetos, setTsProjetos] = useState<{ cliente: string; horas: number }[]>([]);
  const [vgAgendasConfirmadas, setVgAgendasConfirmadas] = useState(0);
  const [vgAgendasApontadas, setVgAgendasApontadas] = useState(0);
  const [vgDiasLivres, setVgDiasLivres] = useState(0);
  const [vgProjetos, setVgProjetos] = useState(0);

  // ── State: apontamento ─────────────────────────────────────────────────────
  const [apontamentoOpen, setApontamentoOpen] = useState(false);
  const [apontamentoLoading, setApontamentoLoading] = useState(false);
  const [projetoAtividades, setProjetoAtividades] = useState<ProjetoAtividade[]>([]);
  const [horasAprovadas, setHorasAprovadas] = useState<Record<string, number>>({});
  const [atividadesApontadas, setAtividadesApontadas] = useState<AtividadeApontada[]>([]);
  const [apontModalidade, setApontModalidade] = useState("Remoto");
  const [apontDescricao, setApontDescricao] = useState("");
  const [diarioObs, setDiarioObs] = useState("");
  const [diarioCategoria, setDiarioCategoria] = useState<"geral"|"decisao"|"ocorrencia"|"marco"|"alerta">("geral");

  // ── State: despesa ─────────────────────────────────────────────────────────
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [despDescricao, setDespDescricao] = useState("");
  const [despValor, setDespValor] = useState("");
  const [despFoto, setDespFoto] = useState<File | null>(null);
  const [despLoading, setDespLoading] = useState(false);
  const [projetoDespesas, setProjetoDespesas] = useState<ProjetoDespesa[]>([]);
  const [despValorMaximo, setDespValorMaximo] = useState<number | null>(null);
  const [despesasLancadas, setDespesasLancadas] = useState<Despesa[]>([]);

  // ── State: documento ───────────────────────────────────────────────────────
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [cronogramaItemDoc, setCronogramaItemDoc] = useState<{
    id: string; doc_exigido: boolean; doc_satisfeito: boolean;
    codigo: string; descricao: string; codigo_cliente: string; nome_cliente: string;
  } | null>(null);

  // ── State: requisitar agenda ───────────────────────────────────────────────
  const [reqOpen, setReqOpen] = useState(false);
  const [reqClienteOpen, setReqClienteOpen] = useState(false);
  const [reqData, setReqData] = useState("");
  const [reqCliente, setReqCliente] = useState("");
  const [reqHoras, setReqHoras] = useState("");
  const [reqCoordenador, setReqCoordenador] = useState("");
  const [reqAtividades, setReqAtividades] = useState<ProjetoAtividade[]>([]);
  const [reqAtividade, setReqAtividade] = useState("");
  const [reqAtividadesLoading, setReqAtividadesLoading] = useState(false);
  const [reqModalidade, setReqModalidade] = useState("Remoto");
  const [reqDescricaoAtividade, setReqDescricaoAtividade] = useState("");
  const [reqJustificativa, setReqJustificativa] = useState("");

  // ── State: cancelamento ────────────────────────────────────────────────────
  const [cancelAgendaOpen, setCancelAgendaOpen] = useState(false);
  const [cancelJustificativa, setCancelJustificativa] = useState("");

  // ── State: resumo / relatorios ─────────────────────────────────────────────
  const [resumoOpen, setResumoOpen] = useState(false);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [projetoDeslocamento, setProjetoDeslocamento] = useState(0);
  const [resumoFinanceiroOpen, setResumoFinanceiroOpen] = useState(false);
  const [rfAgendas, setRfAgendas] = useState<RfAgenda[]>([]);
  const [rfDespesas, setRfDespesas] = useState<RfDespesa[]>([]);
  const [rfLoading, setRfLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // ── State: layout V2 ───────────────────────────────────────────────────────
  const [ctxTab, setCtxTab] = useState<"diario"|"cronograma"|"docs"|"kanban">("diario");
  const [ctxVisible, setCtxVisible] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState<OffProjeto | null>(null);
  const [mobileTab, setMobileTab] = useState<"agenda"|"timesheet"|"backlog"|"pendencias">("agenda");
  const [projetoVinculado, setProjetoVinculado] = useState<OffProjeto | null>(null);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { pendencias, totalPendencias, loadingPendencias, loadPendencias } = usePendencias(user?.id);
  const { entradas: diarioEntradas, loading: diarioLoading, loadEntradas: loadDiarioEntradas, insertEntrada } = useDiario();
  const { files: spFiles, loading: spLoading, error: spError, loadFiles: loadSpFiles, clear: clearSpFiles } = useSharepointDocs();

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      loadData();
      loadProjetos();
      loadPendencias();
    }
  }, [user, currentMonth]);

  useEffect(() => {
    if (user) detectarProjetoVinculado();
  }, [user, offProjetos]);


  useEffect(() => {
    calcularTimesheet();
  }, [currentMonth, user]);

  useEffect(() => {
    if (selectedAgendas.length === 1) setSelectedClienteId(selectedAgendas[0].id);
    else if (selectedAgendas.length === 0) setSelectedClienteId(null);
  }, [selectedDate, agendas]);

  useEffect(() => {
    if (!selectedDate || !user) { setDespesasLancadas([]); return; }
    supabase.from("despesas").select("id, descricao, valor, data_despesa, envio_financeiro, cliente")
      .eq("user_id", user.id).eq("data_despesa", selectedDate)
      .then(({ data }) => setDespesasLancadas(data || []));
  }, [selectedDate, user]);

  useEffect(() => {
    if (resumoFinanceiroOpen) loadResumoFinanceiro();
  }, [resumoFinanceiroOpen, currentMonth]);

  useEffect(() => {
    if (apontamentoOpen && projetoAtividades.length > 0 && atividadesApontadas.length === 0 && selectedAgenda) {
      const planned = selectedAgenda.atividade;
      const match = projetoAtividades.find((a) => {
        const full = `${a.codigo} - ${a.descricao}`;
        return planned === a.descricao || planned === a.codigo || planned === full || planned.startsWith(a.codigo + " ");
      });
      if (match && getSaldo(match) > 0) {
        setAtividadesApontadas([{ atividade_codigo: match.codigo, atividade_descricao: match.descricao, horas: 0, percentual_feeling: null }]);
      }
    }
  }, [apontamentoOpen, projetoAtividades]);

  // ── Carregamento de dados ─────────────────────────────────────────────────

  const detectarProjetoVinculado = async () => {
    if (!user || offProjetos.length === 0) return;
    const hoje = new Date();
    const d60ant  = new Date(hoje); d60ant.setDate(hoje.getDate() - 60);
    const d60prox = new Date(hoje); d60prox.setDate(hoje.getDate() + 60);
    const start = d60ant.toISOString().slice(0, 10);
    const end   = d60prox.toISOString().slice(0, 10);
    const { data } = await supabase
      .from("agendas")
      .select("cliente, data")
      .eq("user_id", user.id)
      .in("status", ["confirmada","apontamento_ok","apontamento_ajustado","em_aprovacao","doc_pendente"])
      .gte("data", start)
      .lte("data", end)
      .order("data", { ascending: false })
      .limit(50);
    if (!data || data.length === 0) return;
    const contagem: Record<string, number> = {};
    data.forEach((ag: any) => { contagem[ag.cliente] = (contagem[ag.cliente] || 0) + 1; });
    const clienteMaisFreq = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!clienteMaisFreq) return;
    const proj = offProjetos.find(p => p.nome_cliente === clienteMaisFreq);
    if (proj) setProjetoVinculado(proj);
  };

  const loadData = async () => {
    if (!user) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end   = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const [agRes, apRes, reqRes] = await Promise.all([
      supabase.from("agendas")
        .select("id, cliente, data, atividade, status, atividade_descricao, item_cronograma, doc_referencia, codigo_cliente")
        .eq("user_id", user.id).gte("data", start).lte("data", end),
      supabase.from("apontamentos")
        .select("id, data, hora, cliente, tipo, endereco")
        .eq("user_id", user.id).gte("data", start).lte("data", end),
      supabase.from("requisicoes_agenda")
        .select("id, data, cliente, atividade, total_horas, modalidade")
        .eq("user_id", user.id).eq("status", "pendente").gte("data", start).lte("data", end),
    ]);
    setAgendas(agRes.data || []);
    setApontamentos(apRes.data || []);
    setRequisicoesPendentes(reqRes.data || []);
  };

  const loadProjetos = async () => {
    const { data } = await supabase.from("projetos")
      .select("id, nome_cliente, coordenador_id, deslocamento, email_contato, status, monday_board_url, sharepoint_pasta_url");
    setOffProjetos((data as OffProjeto[]) || []);
  };

  const calcularTimesheet = async () => {
    if (!user) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end   = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data: todasAgendasMes } = await supabase.from("agendas").select("id, data, cliente")
      .eq("user_id", user.id)
      .in("status", ["confirmada", "apontamento_ok", "apontamento_ajustado", "em_aprovacao", "doc_pendente"])
      .gte("data", start).lte("data", end);

    const { data: agendasMes } = await supabase.from("agendas").select("id, data, cliente")
      .eq("user_id", user.id).eq("status", "confirmada").gte("data", start).lte("data", end);

    const totalAgendadas = (todasAgendasMes || []).length;
    setTsAgendadas(totalAgendadas);

    const { data: agendasApontadas } = await supabase.from("agendas").select("id, data, cliente")
      .eq("user_id", user.id)
      .in("status", ["apontamento_ok", "apontamento_ajustado", "em_aprovacao"])
      .gte("data", start).lte("data", end);

    setTsApontadas((agendasApontadas || []).length);

    const diasDoMes = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const semanas: { label: string; agendadas: number; apontadas: number }[] = [];
    let semanaAtual = 1;
    let inicioSemana = diasDoMes[0];

    for (let i = 0; i < diasDoMes.length; i++) {
      const dia = diasDoMes[i];
      const fimDaSemana = i === diasDoMes.length - 1 || getDay(diasDoMes[i + 1]) === 0;
      if (fimDaSemana || i === diasDoMes.length - 1) {
        const startStr = format(inicioSemana, "yyyy-MM-dd");
        const endStr   = format(dia, "yyyy-MM-dd");
        const ag = (todasAgendasMes || []).filter(a => a.data >= startStr && a.data <= endStr).length;
        const ap = (agendasApontadas || []).filter(a => a.data >= startStr && a.data <= endStr).length;
        semanas.push({ label: `S${semanaAtual}`, agendadas: ag, apontadas: ap });
        semanaAtual++;
        if (i < diasDoMes.length - 1) inicioSemana = diasDoMes[i + 1];
      }
    }
    setTsSemanas(semanas);

    const projetoMap: Record<string, number> = {};
    for (const ag of agendasApontadas || [])
      projetoMap[ag.cliente] = (projetoMap[ag.cliente] || 0) + 1;
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

  // ── Relatório financeiro (portado do original) ────────────────────────────

  const loadResumoFinanceiro = async () => {
    if (!user) return;
    setRfLoading(true);
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end   = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data: agendasRaw } = await supabase.from("agendas")
      .select("id, data, cliente, status").eq("user_id", user.id)
      .gte("data", start).lte("data", end)
      .in("status", ["confirmada","em_aprovacao","apontamento_ok","apontamento_ajustado","doc_pendente"])
      .order("data", { ascending: true });

    const agendasData = agendasRaw || [];
    const agendaIds = agendasData.map(a => a.id);
    let horasPorAgenda: Record<string, number> = {};

    if (agendaIds.length > 0) {
      const { data: apontAtiv } = await supabase
        .from("apontamento_atividades" as any).select("agenda_id, horas").in("agenda_id", agendaIds);
      for (const aa of (apontAtiv || []) as any[])
        horasPorAgenda[aa.agenda_id] = (horasPorAgenda[aa.agenda_id] || 0) + Number(aa.horas);
    }

    const { data: requisicoes } = await supabase.from("requisicoes_agenda")
      .select("cliente, data, total_horas").eq("user_id", user.id).eq("status", "aprovada")
      .gte("data", start).lte("data", end);

    const reqMap: Record<string, number> = {};
    for (const r of (requisicoes || []) as any[]) {
      const key = `${r.cliente}|${r.data}`;
      if (!reqMap[key] || r.total_horas > reqMap[key]) reqMap[key] = Number(r.total_horas);
    }

    const deslocPorCliente: Record<string, number> = {};
    for (const p of offProjetos) deslocPorCliente[p.nome_cliente] = Number(p.deslocamento || 0);

    const statusEfetivado = ["em_aprovacao","apontamento_ok","apontamento_ajustado","doc_pendente"];
    setRfAgendas(agendasData.map(ag => ({
      id: ag.id, data: ag.data, cliente: ag.cliente, status: ag.status,
      horas_apontadas: statusEfetivado.includes(ag.status) ? (horasPorAgenda[ag.id] || 0) : 0,
      horas_planejadas: statusEfetivado.includes(ag.status) ? 0 : (reqMap[`${ag.cliente}|${ag.data}`] || 0),
      deslocamento: deslocPorCliente[ag.cliente] || 0,
    })));

    const { data: despesasRaw } = await supabase.from("despesas")
      .select("id, data_despesa, cliente, descricao, envio_financeiro, valor")
      .eq("user_id", user.id).gte("data_despesa", start).lte("data_despesa", end)
      .order("data_despesa", { ascending: true });

    setRfDespesas((despesasRaw || []).map(d => ({
      id: d.id, data: d.data_despesa, cliente: d.cliente,
      descricao: d.descricao, status_despesa: d.envio_financeiro || "Pendente", valor: Number(d.valor),
    })));
    setRfLoading(false);
  };

  // ── exportarPDF (portado do original; marca atualizada para PROJTE) ──────────

  const exportarPDF = (tipo: "horas" | "despesas") => {
    setExportDialogOpen(false);
    const mesAno = format(currentMonth, "MMMM yyyy", { locale: ptBR });
    const agora  = format(new Date(), "dd/MM/yyyy HH:mm");
    const periodoFim   = format(endOfMonth(currentMonth), "dd/MM/yyyy");
    const periodoInicio = `01/${format(currentMonth, "MM/yyyy")}`;

    const horasTrab = rfAgendas.reduce((s, a) => s + a.horas_apontadas, 0);
    const horasPrev = rfAgendas.reduce((s, a) => s + a.horas_planejadas, 0);
    const translados = rfAgendas.reduce((s, a) => s + a.deslocamento, 0);
    const totalGeralHoras = rfAgendas.reduce((s, a) => s + (a.horas_apontadas || a.horas_planejadas) + a.deslocamento, 0);
    const totalValorDesp  = rfDespesas.reduce((s, d) => s + d.valor, 0);

    const porClienteHoras: Record<string, number> = {};
    for (const a of rfAgendas)
      porClienteHoras[a.cliente] = (porClienteHoras[a.cliente] || 0) + (a.horas_apontadas || a.horas_planejadas) + a.deslocamento;
    const porClienteDesp: Record<string, number> = {};
    for (const d of rfDespesas)
      porClienteDesp[d.cliente] = (porClienteDesp[d.cliente] || 0) + d.valor;

    const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#1a1a18;padding:32px}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0B1628;margin-bottom:14px}.brand{font-size:20px;font-weight:700;color:#0B1628}.brand-sub{font-size:9px;color:#888780;margin-top:2px}.meta-title{font-size:13px;font-weight:700;text-align:right}.meta-line{font-size:9px;color:#5F5E5A;text-align:right;margin-top:2px}.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #e0dfd8;border-radius:4px;margin-bottom:14px;overflow:hidden}.info-cell{padding:7px 11px;border-right:1px solid #e0dfd8}.info-cell:last-child{border-right:none}.info-label{font-size:8px;color:#888780;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}.info-value{font-size:11px;font-weight:700}.section-title{font-size:10px;font-weight:700;color:#0B1628;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 7px;padding-bottom:4px;border-bottom:1px solid #e0dfd8}table{width:100%;border-collapse:collapse}thead tr{background:#0B1628}thead th{color:#39FF87;padding:6px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.03em}th.r,td.r{text-align:right}tbody td{padding:5px 8px;border-bottom:1px solid #f0efe8}tbody tr:nth-child(even) td{background:#f8f7f3}tr.sub td{background:#f0efe8;font-style:italic;font-weight:600;font-size:9px}tr.tot td{background:#e8f5ef;font-weight:700;border-top:1px solid #39FF87}.tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:600;background:#f0efe8;color:#5F5E5A}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px}.scard{border:1px solid #e0dfd8;border-radius:4px;padding:8px 10px}.scard.hi{background:#e8f5ef;border-color:#39FF87}.slabel{font-size:8px;color:#888780;margin-bottom:3px}.svalue{font-size:15px;font-weight:700}.svalue.green{color:#059669}.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e0dfd8;display:flex;justify-content:space-between;font-size:8px;color:#888780}@media print{body{padding:20px}@page{size:A4;margin:1.5cm}}`;

    const linhasHoras = rfAgendas.map(ag => {
      const hL = ag.horas_apontadas || ag.horas_planejadas;
      const tot = hL + ag.deslocamento;
      return `<tr><td>${format(parseISO(ag.data),"dd/MM/yyyy")}</td><td>${ag.cliente}</td><td><span class="tag">${getRfStatusLabel(ag.status)}</span></td><td class="r">${formatHoras(hL)}</td><td class="r">${ag.deslocamento > 0 ? formatHoras(ag.deslocamento) : "-"}</td><td class="r">${formatHoras(tot)}</td></tr>`;
    }).join("");
    const subtotaisHoras = Object.entries(porClienteHoras).map(([cli, h]) =>
      `<tr class="sub"><td colspan="5">Subtotal — ${cli}</td><td class="r">${formatHoras(h)}</td></tr>`).join("");
    const linhasDesp = rfDespesas.map(d =>
      `<tr><td>${format(parseISO(d.data),"dd/MM/yyyy")}</td><td>${d.cliente}</td><td>${d.descricao}</td><td><span class="tag">${d.status_despesa}</span></td><td class="r">${d.valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr>`).join("");
    const subtotaisDesp = Object.entries(porClienteDesp).map(([cli, val]) =>
      `<tr class="sub"><td colspan="4">Subtotal — ${cli}</td><td class="r">${val.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr>`).join("");

    const conteudoHoras = `<table><thead><tr><th>Data</th><th>Cliente</th><th>Status</th><th class="r">Horas</th><th class="r">Transl.</th><th class="r">Total</th></tr></thead><tbody>${linhasHoras}${subtotaisHoras}<tr class="tot"><td colspan="3">TOTAL GERAL</td><td class="r">${formatHoras(horasTrab+horasPrev)}</td><td class="r">${formatHoras(translados)}</td><td class="r">${formatHoras(totalGeralHoras)}</td></tr></tbody></table><div class="summary"><div class="scard"><div class="slabel">Agendas</div><div class="svalue">${rfAgendas.length}</div></div><div class="scard"><div class="slabel">Trabalhadas</div><div class="svalue">${formatHoras(horasTrab)}</div></div><div class="scard"><div class="slabel">Previstas</div><div class="svalue">${formatHoras(horasPrev)}</div></div><div class="scard"><div class="slabel">Translados</div><div class="svalue">${formatHoras(translados)}</div></div><div class="scard hi" style="grid-column:span 2"><div class="slabel">Total geral</div><div class="svalue green">${formatHoras(totalGeralHoras)}</div></div></div>`;
    const conteudoDesp = `<table><thead><tr><th>Data</th><th>Cliente</th><th>Despesa</th><th>Status</th><th class="r">Valor</th></tr></thead><tbody>${linhasDesp}${subtotaisDesp}<tr class="tot"><td colspan="4">TOTAL GERAL</td><td class="r">${totalValorDesp.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td></tr></tbody></table><div class="summary"><div class="scard"><div class="slabel">Lancamentos</div><div class="svalue">${rfDespesas.length}</div></div><div class="scard hi" style="grid-column:span 2"><div class="slabel">Total geral</div><div class="svalue green">${totalValorDesp.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div></div></div>`;

    const titulo = tipo === "horas" ? "Relatorio de Horas" : "Relatorio de Despesas";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="doc-header"><div><div class="brand">PROJTE</div><div class="brand-sub">Sistema de Gestao de Projetos</div></div><div><div class="meta-title">${titulo}</div><div class="meta-line">Competencia: ${mesAno}</div><div class="meta-line">Emissao: ${agora}</div></div></div><div class="info-grid"><div class="info-cell"><div class="info-label">Consultor</div><div class="info-value">${user?.email || ""}</div></div><div class="info-cell"><div class="info-label">Periodo</div><div class="info-value">${periodoInicio} – ${periodoFim}</div></div><div class="info-cell"><div class="info-label">Gerado em</div><div class="info-value">${agora}</div></div></div><div class="section-title">Detalhamento</div>${tipo === "horas" ? conteudoHoras : conteudoDesp}<div class="footer"><span>Gerado pelo Projte — Documento de uso interno</span><span>Exportado em ${agora}</span></div></body></html>`;

    const printWin = window.open("", "_blank");
    if (printWin) { printWin.document.write(html); printWin.document.close(); setTimeout(() => printWin.print(), 400); }
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);
  const firstDayOffset = useMemo(() => getDay(startOfMonth(currentMonth)), [currentMonth]);

  const getStatus = (dateStr: string): string | null => {
    const dayAgendas = agendas.filter(a => a.data === dateStr);
    const dayReqs    = requisicoesPendentes.filter(r => r.data === dateStr);
    if (dayAgendas.length === 0 && dayReqs.length === 0) return null;
    if (dayAgendas.length === 0 && dayReqs.length > 0) return "aguardando";
    const today = new Date(); today.setHours(0,0,0,0);
    const date  = parseISO(dateStr);
    const allDone = dayAgendas.every(ag => ag.status === "aguardando_cancelamento" || ["em_aprovacao","apontamento_ok","apontamento_ajustado"].includes(ag.status));
    if (allDone && dayReqs.length === 0) return "feito";
    if (allDone && dayReqs.length > 0)   return "aguardando";
    if (isBefore(date, today)) return "atrasada";
    return "planejada";
  };

  const selectedAgendas    = agendas.filter(a => a.data === selectedDate);
  const selectedRequisicoes = requisicoesPendentes.filter(r => r.data === selectedDate);
  const selectedAgenda     = selectedAgendas.find(a => a.id === selectedClienteId);

  const isDateFuture = selectedDate ? isAfter(parseISO(selectedDate), (() => { const t = new Date(); t.setHours(0,0,0,0); return t; })()) : false;
  const isApontamentoDone = selectedAgenda ? ["em_aprovacao","apontamento_ok","apontamento_ajustado"].includes(selectedAgenda.status) : false;
  const isProjetoNaoLiberado = selectedAgenda ? (offProjetos.find(p => p.nome_cliente === selectedAgenda.cliente)?.status !== "Liberado") : false;

  // ── Apontamento helpers (portados do original) ────────────────────────────

  const getSaldo = (atv: ProjetoAtividade) => Math.max(0, Number(atv.horas) - (horasAprovadas[atv.codigo] || 0));
  const getPercentual = (atv: ProjetoAtividade) => Number(atv.horas) <= 0 ? 100 : Math.min(100, Math.round(((horasAprovadas[atv.codigo] || 0) / Number(atv.horas)) * 100));

  const loadAtividadesParaApontamento = async (cliente: string) => {
    const projeto = offProjetos.find(p => p.nome_cliente === cliente);
    if (!projeto) return;
    const { data: atividades } = await supabase.from("projeto_atividades").select("id, codigo, descricao, horas, projeto_id").eq("projeto_id", projeto.id);
    setProjetoAtividades(atividades || []);
    const { data: allApontAtividades } = await supabase.from("apontamento_atividades" as any).select("atividade_codigo, horas, agenda_id").eq("cliente", cliente);
    const { data: approvedAgendas } = await supabase.from("agendas").select("id").eq("cliente", cliente).in("status", ["apontamento_ok","apontamento_ajustado"]);
    const approvedIds = new Set((approvedAgendas || []).map((a: any) => a.id));
    const horasMap: Record<string, number> = {};
    if (allApontAtividades) for (const aa of allApontAtividades as any[]) if (approvedIds.has(aa.agenda_id)) horasMap[aa.atividade_codigo] = (horasMap[aa.atividade_codigo] || 0) + Number(aa.horas);
    setHorasAprovadas(horasMap);
  };

  const handleOpenApontamento = async () => {
    if (!selectedAgenda) return;
    const projeto = offProjetos.find(p => p.nome_cliente === selectedAgenda.cliente);
    if (projeto && projeto.status !== "Liberado") {
      toast({ title: "Projeto nao liberado", description: `O projeto "${selectedAgenda.cliente}" esta com status "${projeto.status || 'Em planejamento'}". Apontamentos so sao permitidos para projetos liberados.`, variant: "destructive" });
      return;
    }
    await loadAtividadesParaApontamento(selectedAgenda.cliente);
    const { data: reqData } = await supabase.from("requisicoes_agenda").select("descricao_atividade").eq("user_id", user!.id).eq("data", selectedAgenda.data).eq("cliente", selectedAgenda.cliente).eq("status", "aprovada").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setAtividadesApontadas([{ atividade_codigo: "", atividade_descricao: "", horas: 0, percentual_feeling: null }]);
    setApontModalidade("Remoto");
    setApontDescricao((reqData as any)?.descricao_atividade || "");
    setDiarioObs("");
    setDiarioCategoria("geral");
    setApontamentoOpen(true);
  };

  const checkAutoApprove = async (agenda: Agenda): Promise<boolean> => {
    const { data: requisicoes } = await supabase.from("requisicoes_agenda").select("atividade, modalidade, total_horas").eq("user_id", user!.id).eq("data", agenda.data).eq("cliente", agenda.cliente).eq("status", "aprovada").order("created_at", { ascending: false }).limit(1);
    if (!requisicoes || requisicoes.length === 0) return false;
    const req = requisicoes[0];
    const totalHorasApontadas = atividadesApontadas.reduce((s, a) => s + a.horas, 0);
    if (apontModalidade !== (req.modalidade || "Remoto")) return false;
    if (totalHorasApontadas !== Number(req.total_horas)) return false;
    if (atividadesApontadas.length === 1) {
      const atvLabel = `${atividadesApontadas[0].atividade_codigo} - ${atividadesApontadas[0].atividade_descricao}`;
      if (atvLabel !== req.atividade) return false;
    } else return false;
    return true;
  };

  const handleGravarApontamento = async () => {
    if (!selectedAgenda || !selectedDate || atividadesApontadas.length === 0) return;
    for (const aa of atividadesApontadas) {
      if (!aa.atividade_codigo) { toast({ title: "Erro", description: "Selecione uma atividade para todas as linhas.", variant: "destructive" }); return; }
      if (aa.horas <= 0) { toast({ title: "Erro", description: `Informe as horas para ${aa.atividade_codigo}.`, variant: "destructive" }); return; }
      const atv = projetoAtividades.find(a => a.codigo === aa.atividade_codigo);
      if (atv && aa.horas > getSaldo(atv)) { toast({ title: "Erro", description: `Horas excedem o saldo de ${getSaldo(atv)}h para ${aa.atividade_codigo}.`, variant: "destructive" }); return; }
    }
    for (const aa of atividadesApontadas) {
      if (aa.percentual_feeling === null || aa.percentual_feeling === undefined) { toast({ title: "% de conclusao obrigatorio", description: `Informe o % de conclusao para ${aa.atividade_codigo || "a atividade"}.`, variant: "destructive" }); return; }
    }
    const projeto = offProjetos.find(p => p.nome_cliente === selectedAgenda.cliente);
    setProjetoDeslocamento(apontModalidade === "Presencial" && projeto?.deslocamento ? projeto.deslocamento : 0);
    setApontamentoOpen(false);
    setResumoOpen(true);
    if (selectedAgenda?.item_cronograma) {
      const codigoItem = selectedAgenda.item_cronograma.split(" - ")[0].trim();
      supabase.from("cronograma_itens").select("id, codigo, descricao, doc_exigido, doc_satisfeito").ilike("codigo", codigoItem).maybeSingle().then(({ data: ci }) => {
        if (ci?.doc_exigido) supabase.from("projetos").select("codigo_cliente, nome_cliente").eq("nome_cliente", selectedAgenda.cliente).maybeSingle().then(({ data: proj }) => {
          setCronogramaItemDoc({ id: ci.id, doc_exigido: ci.doc_exigido, doc_satisfeito: ci.doc_satisfeito, codigo: ci.codigo, descricao: ci.descricao, codigo_cliente: proj?.codigo_cliente || "", nome_cliente: proj?.nome_cliente || selectedAgenda.cliente });
        });
        else setCronogramaItemDoc(null);
      });
    } else setCronogramaItemDoc(null);
    setDocFile(null);
  };

  const handleConfirmarApontamento = async () => {
    if (!selectedAgenda || !selectedDate) return;
    setResumoLoading(true);
    const inserts = atividadesApontadas.map(aa => ({ agenda_id: selectedAgenda.id, user_id: user!.id, data: selectedDate, cliente: selectedAgenda.cliente, atividade_codigo: aa.atividade_codigo, atividade_descricao: aa.atividade_descricao, horas: aa.horas, modalidade: apontModalidade, descricao: apontDescricao || null, percentual_feeling: aa.percentual_feeling ?? null }));
    const { error } = await supabase.from("apontamento_atividades" as any).insert(inserts as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setResumoLoading(false); return; }
    if (diarioObs.trim() && selectedAgenda) {
      const projeto = offProjetos.find(p => p.nome_cliente === selectedAgenda.cliente);
      if (projeto) supabase.functions.invoke("diario-entry", { body: { action: "insert", projeto_id: projeto.id, texto: diarioObs.trim(), categoria: diarioCategoria, origem: "consultor", agenda_id: selectedAgenda.id, data: selectedDate } }).catch(() => {});
    }
    const shouldAutoApprove = await checkAutoApprove(selectedAgenda);
    await supabase.from("agendas").update({ status: shouldAutoApprove ? "apontamento_ok" : "em_aprovacao" }).eq("id", selectedAgenda.id);
    supabase.functions.invoke("monday-agenda-sync", { body: { action: "update", agenda_id: selectedAgenda.id } }).catch(() => {});
    if (shouldAutoApprove) toast({ title: "Apontamento aprovado automaticamente!" });
    else toast({ title: "Apontamento registrado!", description: "Enviado para aprovacao do coordenador." });
    setResumoOpen(false);
    setResumoLoading(false);
    await loadData();
  };

  const handleUploadDoc = async () => {
    if (!docFile || !cronogramaItemDoc) return;
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("cronograma_item_id", cronogramaItemDoc.id);
      formData.append("codigo_cliente", cronogramaItemDoc.codigo_cliente);
      formData.append("nome_cliente", cronogramaItemDoc.nome_cliente);
      formData.append("codigo_item", cronogramaItemDoc.codigo);
      formData.append("descricao_item", cronogramaItemDoc.descricao);
      const { data, error } = await supabase.functions.invoke("sharepoint-upload", { body: formData });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Documento enviado!", description: "Arquivo enviado ao SharePoint com sucesso." });
        setCronogramaItemDoc(prev => prev ? { ...prev, doc_satisfeito: true } : null);
        setDocFile(null);
        supabase.functions.invoke("monday-agenda-sync", { body: { action: "update", agenda_id: selectedAgenda?.id } }).catch(() => {});
      }
    } catch (err: any) { toast({ title: "Erro no upload", description: err.message, variant: "destructive" }); }
    setDocUploading(false);
  };

  // ── Handlers agenda/seleção ───────────────────────────────────────────────

  const handleSelectAgenda = (agenda: Agenda) => {
    setSelectedClienteId(agenda.id);
    const proj = offProjetos.find(p => p.nome_cliente === agenda.cliente) || null;
    setProjetoSelecionado(proj);
    setCtxVisible(true);
    setCtxTab("diario");
    if (proj) {
      loadDiarioEntradas(proj.id);
      if (agenda.codigo_cliente) loadSpFiles(agenda.codigo_cliente, agenda.cliente);
      loadProjetoDocs(agenda.cliente);
    }
  };

  const handleDeselectAgenda = () => {
    setSelectedClienteId(null);
    setProjetoSelecionado(null);
    setCtxVisible(false);
    clearSpFiles();
    setProjetoDocs([]);
  };

  const navigateToDate = (data: string, agendaId?: string) => {
    const parsed = parseISO(data);
    setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setSelectedDate(data);
    if (agendaId) setSelectedClienteId(agendaId);
  };

  // ── Cobertura % ───────────────────────────────────────────────────────────
  const coberturaPercent = tsAgendadas === 0 ? 0 : Math.round((tsApontadas / tsAgendadas) * 100);
  const coberturaColor   = coberturaPercent >= 80 ? GREEN : coberturaPercent >= 50 ? AMBER : RED;

  // ── MOBILE: renderiza layout original ─────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background safe-area-top safe-area-bottom flex flex-col">
        <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <span style={{ fontWeight: 800, fontSize: 18, color: NAVY, letterSpacing: "-0.02em" }}>
              projt<span style={{ color: GREEN }}>e</span>
            </span>
            <div className="flex items-center gap-1">
              {role === "coordenador" && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1 text-muted-foreground">
                  <Settings className="h-4 w-4" /><span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setResumoFinanceiroOpen(true)} className="gap-1 text-muted-foreground" title="Relatorio Financeiro">
                <CircleDollarSign className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        {/* Mobile body: pendencias + agenda simplificada */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          <PendenciasPMOCard
            pendencias={pendencias}
            totalPendencias={totalPendencias}
            loadingPendencias={loadingPendencias}
            onNavigateToDate={navigateToDate}
          />
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <CardTitle className="text-base capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center">
                {weekDays.map(d => <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>)}
                {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const status  = getStatus(dateStr);
                  const isSel   = selectedDate === dateStr;
                  return (
                    <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                      className={`relative flex flex-col items-center justify-center rounded-lg py-2 text-sm transition-colors ${isSel ? "bg-primary text-primary-foreground" : isToday(day) ? "bg-accent" : "hover:bg-accent/50"}`}>
                      {day.getDate()}
                      {status && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${STATUS_COLORS[status]}`} />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </main>
        {/* Dialogs portados abaixo — inclusos via renderDialogs() */}
        {renderDialogs()}
      </div>
    );
  }

  // ── DESKTOP: layout V7 ────────────────────────────────────────────────────

  const sidebarW  = 232;
  const topbarH   = 58;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── TOPBAR ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: topbarH,
        background: NAVY, zIndex: 300,
        display: "flex", alignItems: "center",
        borderBottom: "0.5px solid rgba(57,255,135,0.08)",
      }}>
        {/* Logo zone */}
        <div style={{
          width: sidebarW, height: "100%", flexShrink: 0,
          display: "flex", alignItems: "center", padding: "0 18px", gap: 12,
          borderRight: "0.5px solid rgba(57,255,135,0.07)",
        }}>
          <LogoChevron />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>
              projt<span style={{ color: LIME }}>e</span>
            </div>
            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.35)", letterSpacing: "0.1em", marginTop: 3 }}>
              v2.0 - consultor
            </div>
          </div>
        </div>

        {/* Center: busca + breadcrumb */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 20px", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)",
            borderRadius: 7, padding: "6px 12px", width: 220, cursor: "pointer",
          }}>
            <Search size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'DM Mono', monospace" }}>
              buscar projeto ativo...
            </span>
          </div>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
            {ctxVisible && projetoSelecionado ? `/ dashboard / ${projetoSelecionado.nome_cliente}` : "/ dashboard / consultor"}
          </span>
        </div>

        {/* Right: botoes */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 18, marginLeft: "auto" }}>
          {/* Online pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(57,255,135,0.08)", border: "0.5px solid rgba(57,255,135,0.18)", borderRadius: 100, padding: "4px 12px", fontSize: 9, fontFamily: "'DM Mono', monospace", color: LIME, letterSpacing: "0.08em" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: LIME, animation: "blink 2s ease-in-out infinite" }} />
            Online
          </div>

          {/* Relatorio Horas */}
          <button onClick={() => { setResumoFinanceiroOpen(true); }} title="Relatorio de Horas" style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "0 10px", height: 32, cursor: "pointer", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.5)", letterSpacing: "0.05em" }}>
            <Clock size={13} style={{ color: "rgba(57,255,135,0.5)" }} />
            Horas
          </button>

          {/* Relatorio Despesas */}
          <button onClick={() => { setResumoFinanceiroOpen(true); }} title="Relatorio de Despesas" style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "0 10px", height: 32, cursor: "pointer", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(245,166,35,0.55)", letterSpacing: "0.05em" }}>
            <Receipt size={13} style={{ color: "rgba(245,166,35,0.55)" }} />
            Despesas
          </button>

          {/* Pendencias bell */}
          <div style={{ position: "relative" }}>
            <button title="Pendencias" style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
              <AlertCircle size={15} />
            </button>
            {totalPendencias > 0 && (
              <div style={{ position: "absolute", top: -3, right: -3, width: 15, height: 15, borderRadius: "50%", background: AMBER, border: `2px solid ${NAVY}`, fontSize: 7, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {totalPendencias}
              </div>
            )}
          </div>

          {/* Admin (coordenador) */}
          {role === "coordenador" && (
            <button onClick={() => navigate("/admin")} title="Admin" style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
              <Settings size={14} />
            </button>
          )}

          {/* Sair */}
          <button onClick={signOut} title="Sair" style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
            <LogOut size={14} />
          </button>

          {/* Avatar */}
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(57,255,135,0.1)", border: "1.5px solid rgba(57,255,135,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: LIME, cursor: "pointer" }}>
            {user?.email?.slice(0,2).toUpperCase() || "CM"}
          </div>
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <aside style={{
        position: "fixed", top: topbarH, bottom: 0, left: 0,
        width: sidebarW, background: NAVY,
        borderRight: "0.5px solid rgba(57,255,135,0.06)",
        zIndex: 200, display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Projeto vinculado card */}
        {projetoSelecionado ? (
          <div style={{ margin: "12px 12px 4px", background: "rgba(57,255,135,0.09)", border: "0.5px solid rgba(57,255,135,0.22)", borderRadius: 9, padding: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.2em", color: "rgba(57,255,135,0.5)", textTransform: "uppercase" }}>Projeto ativo</span>
              <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.4)", background: "rgba(57,255,135,0.08)", padding: "1px 6px", borderRadius: 4 }}>PMO</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{projetoSelecionado.nome_cliente}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 7 }}>
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 5, padding: "4px 7px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: LIME, letterSpacing: "-0.02em", lineHeight: 1 }}>{vgAgendasConfirmadas}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Agendas</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 5, padding: "4px 7px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: AMBER, letterSpacing: "-0.02em", lineHeight: 1 }}>{coberturaPercent}%</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Cobertura</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.22)", marginBottom: 3 }}>
              <span>Cobertura Mai</span><span>{coberturaPercent}%</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: LIME, borderRadius: 2, width: `${Math.min(100, coberturaPercent)}%` }} />
            </div>
          </div>
        ) : (
          <div style={{ margin: "12px 12px 4px", background: "rgba(57,255,135,0.06)", border: "0.5px solid rgba(57,255,135,0.14)", borderRadius: 9, padding: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.2em", color: "rgba(57,255,135,0.4)", textTransform: "uppercase", marginBottom: 4 }}>Projeto vinculado</div>
            {projetoVinculado ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{projetoVinculado.nome_cliente}</div>
                <div style={{ fontSize: 9, color: "rgba(57,255,135,0.35)", fontFamily: "'DM Mono', monospace" }}>Selecione uma agenda para ativar o contexto</div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>Nenhum projeto ativo nos ultimos 60 dias</div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>
          {/* Principal */}
          <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.22em", color: "rgba(255,255,255,0.17)", textTransform: "uppercase", padding: "8px 10px 3px", display: "block" }}>Principal</div>
          {[
            { icon: <IcoDashboard />, label: "Dashboard", active: true },
            { icon: <IcoPend />, label: "Pendencias", badge: totalPendencias > 0 ? totalPendencias : null, badgeColor: RED },
            { icon: <IcoReq />, label: "Requisicoes", badge: requisicoesPendentes.length > 0 ? requisicoesPendentes.length : null, badgeColor: AMBER },
            { icon: <IcoBacklog />, label: "Backlog", badgeText: "em breve" },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "6px 10px", borderRadius: 7, cursor: "pointer",
              color: item.active ? LIME : "rgba(255,255,255,0.4)",
              fontSize: 11, fontWeight: item.active ? 600 : 500,
              background: item.active ? "rgba(57,255,135,0.09)" : "transparent",
              position: "relative",
            }}>
              <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: item.active ? 1 : 0.65 }}>{item.icon}</div>
              {item.label}
              {item.badge != null && (
                <span style={{ marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 6, fontFamily: "'DM Mono', monospace", fontWeight: 600, background: `${item.badgeColor}22`, color: item.badgeColor }}>{item.badge}</span>
              )}
              {item.badgeText && (
                <span style={{ marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 6, fontFamily: "'DM Mono', monospace", fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.28)" }}>{item.badgeText}</span>
              )}
              {item.active && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 2.5, background: LIME, borderRadius: "0 2px 2px 0" }} />}
            </div>
          ))}

          {/* Projeto context */}
          <div style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 8, fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.18em", color: "rgba(57,255,135,0.35)", textTransform: "uppercase" }}>
            Projeto{projetoSelecionado ? " - " + projetoSelecionado.nome_cliente.split(" ")[0] : ""}
            <div style={{ flex: 1, height: 0.5, background: "rgba(57,255,135,0.12)" }} />
          </div>

          {[
            { id: "diario" as const,     icon: <IcoDiario />,  label: "Diario de Bordo" },
            { id: "cronograma" as const, icon: <IcoCrono />,   label: "Cronograma" },
            { id: "docs" as const,       icon: <IcoDocs />,    label: "Documentos" },
            { id: "kanban" as const,     icon: <IcoKanban />,  label: "Kanban" },
          ].map(item => {
            const enabled = ctxVisible;
            const isActive = ctxVisible && ctxTab === item.id;
            return (
              <div key={item.id} onClick={() => { if (enabled) { setCtxTab(item.id); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "6px 10px", borderRadius: 7,
                  cursor: enabled ? "pointer" : "default",
                  color: isActive ? LIME : enabled ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)",
                  fontSize: 11, fontWeight: isActive ? 600 : 500,
                  background: isActive ? "rgba(57,255,135,0.09)" : "transparent",
                  position: "relative",
                  transition: "all 0.2s",
                }}>
                <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isActive ? 1 : enabled ? 0.65 : 0.3 }}>{item.icon}</div>
                {item.label}
                {!enabled && <span style={{ marginLeft: "auto" }}><IcoLock /></span>}
                {isActive && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 2.5, background: LIME, borderRadius: "0 2px 2px 0" }} />}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: "0.5px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 4px", borderRadius: 7, cursor: "pointer" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(57,255,135,0.1)", border: "1.5px solid rgba(57,255,135,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: LIME, flexShrink: 0 }}>
              {user?.email?.slice(0,2).toUpperCase() || "CM"}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{user?.email?.split("@")[0] || "Consultor"}</div>
              <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.4)", letterSpacing: "0.06em" }}>Consultor</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ marginLeft: sidebarW, paddingTop: topbarH, minHeight: "100vh" }}>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Header */}
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {(() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })()}, {user?.email?.split("@")[0] || "Consultor"}.
            </div>
            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", letterSpacing: "0.08em", marginTop: 4 }}>
              {"// "}{format(new Date(), "EEE", { locale: ptBR }).toUpperCase()}{" - "}{format(new Date(), "dd MMM yyyy", { locale: ptBR }).toUpperCase()}{" - "}{vgAgendasConfirmadas > 0 ? <span style={{ color: GREEN, fontWeight: 700 }}>{vgAgendasConfirmadas} agenda{vgAgendasConfirmadas !== 1 ? "s" : ""} no mes</span> : "nenhuma agenda confirmada"}
            </div>
          </div>

          {/* Banner pendencias globais */}
          {totalPendencias > 0 && (
            <div style={{ background: "rgba(245,166,35,0.06)", border: "0.5px solid rgba(245,166,35,0.25)", borderRadius: 9, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <AlertCircle size={16} style={{ color: "#92400E", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>{totalPendencias} pendencia{totalPendencias !== 1 ? "s" : ""} ativa{totalPendencias !== 1 ? "s" : ""} - todos os projetos</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 5 }}>
                  {pendencias.slice(0, 2).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,166,35,0.1)", border: "0.5px solid rgba(245,166,35,0.2)", borderRadius: 6, padding: "3px 9px", fontSize: 10, color: "#92400E" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: p.tipo === "doc_pendente" ? RED : AMBER, flexShrink: 0 }} />
                      {p.titulo} - {p.cliente}
                    </div>
                  ))}
                </div>
              </div>
              <button style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#92400E", background: "rgba(245,166,35,0.15)", border: "0.5px solid rgba(245,166,35,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                Ver todas +
              </button>
            </div>
          )}

          {/* TOP ZONE: KPIs 2x2 + Horas + Futuro */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "stretch" }}>
            {/* KPIs 2x2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, height: "100%" }}>
              {[
                { label: "Agendas",       value: vgAgendasConfirmadas, sub: "confirmadas este mes",   accent: BLUE },
                { label: "Disponibilidade", value: vgDiasLivres,       sub: "dias livres em maio",    accent: GREEN },
                { label: "Projetos",      value: vgProjetos,           sub: "ativos",                 accent: AMBER },
                { label: "Cobertura Maio",value: `${coberturaPercent}%`, sub: `S${tsSemanas.filter(s=>s.apontadas>0).length} com apontamento`, accent: RED },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: kpi.accent, borderRadius: "10px 0 0 10px" }} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 7 }}>{kpi.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: kpi.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 5 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Controle de Horas */}
            <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: LIME, borderRadius: "10px 0 0 10px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em" }}>Controle de Horas</span>
                <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 100, background: "rgba(57,255,135,0.1)", color: GREEN, fontFamily: "'DM Mono', monospace", fontWeight: 600, border: "0.5px solid rgba(57,255,135,0.2)" }}>
                  {format(currentMonth, "MMM", { locale: ptBR })} - ativo
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
                {[
                  { val: tsAgendadas, label: "Agendado", color: "#111827" },
                  { val: tsApontadas, label: "Apontado",  color: GREEN },
                  { val: `${coberturaPercent}%`, label: "Cobertura", color: coberturaColor },
                ].map((n, i) => (
                  <div key={n.label} style={{ textAlign: "center", padding: "7px 0", boxShadow: i > 0 ? "inset 1px 0 0 rgba(0,0,0,0.07)" : "none" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: n.color }}>{n.val}</div>
                    <div style={{ fontSize: 8, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{n.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 0.5, background: "rgba(0,0,0,0.07)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {tsSemanas.map(s => {
                  const pct = s.agendadas === 0 ? 0 : Math.round((s.apontadas / s.agendadas) * 100);
                  const barColor = pct >= 80 ? LIME : pct >= 50 ? AMBER : RED;
                  return (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", width: 16, textAlign: "right", flexShrink: 0 }}>{s.label}</span>
                      <div style={{ flex: 1, height: 4, background: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: barColor, width: `${Math.min(100, s.agendadas === 0 ? 0 : pct)}%` }} />
                      </div>
                      <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: pct >= 80 ? GREEN : pct >= 50 ? "#D97706" : RED, width: 26, textAlign: "right", flexShrink: 0, fontWeight: pct > 0 ? 600 : 400 }}>
                        {s.apontadas}/{s.agendadas}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Futuro Indicador */}
            <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "rgba(124,58,237,0.5)", borderRadius: "10px 0 0 10px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em" }}>Futuro Indicador</span>
                <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 100, background: "rgba(124,58,237,0.08)", color: "#7C3AED", fontFamily: "'DM Mono', monospace", fontWeight: 600, border: "0.5px solid rgba(124,58,237,0.15)" }}>em definicao</span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 10, border: "0.5px dashed rgba(124,58,237,0.2)", borderRadius: 8, background: "rgba(124,58,237,0.02)", textAlign: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(124,58,237,0.4)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF" }}>Proximo KPI</span>
              </div>
              {["Health Score", "SLA de Atendimento", "Desvio de Prazo", "Satisfacao do Cliente"].map(opt => (
                <div key={opt} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid rgba(0,0,0,0.07)", fontSize: 10, color: "#4B5563", display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(124,58,237,0.4)", flexShrink: 0 }} />
                  {opt}
                </div>
              ))}
            </div>
          </div>

          {/* MID ZONE: Agenda 60% + Acoes 40% */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>

            {/* Minha Agenda */}
            <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.012)", minHeight: 42 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: NAVY, color: LIME, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="#39FF87"><rect width="10" height="10" rx="2"/></svg></div>
                  Minha Agenda
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {selectedAgenda
                    ? <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(57,255,135,0.1)", color: GREEN, border: "0.5px solid rgba(57,255,135,0.2)", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>1 selecionada</span>
                    : <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "#F3F4F6", color: "#6B7280", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>Selecione uma agenda</span>
                  }
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "#EFF6FF", color: BLUE, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{format(currentMonth, "MMM yyyy", { locale: ptBR })}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "290px 1fr" }}>
                {/* Calendário */}
                <div style={{ padding: "12px 14px", borderRight: "0.5px solid rgba(0,0,0,0.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(0,0,0,0.04)", border: "0.5px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,1 1,5.5 6,10"/></svg></button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</span>
                      <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(0,0,0,0.04)", border: "0.5px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,1 6,5.5 1,10"/></svg></button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, textAlign: "center" }}>
                    {weekDays.map((d, i) => <div key={i} style={{ fontSize: 8, fontWeight: 700, color: "#9CA3AF", padding: "2px 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>)}
                    {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
                    {days.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const status  = getStatus(dateStr);
                      const isSel   = selectedDate === dateStr;
                      const todayDay = isToday(day);
                      return (
                        <button key={dateStr} onClick={() => setSelectedDate(isSel ? null : dateStr)}
                          style={{
                            fontSize: 11, color: isSel && !todayDay ? GREEN : todayDay ? LIME : "#4B5563",
                            borderRadius: 5, cursor: "pointer", border: todayDay ? `2px solid ${LIME}` : "none",
                            display: "flex", flexDirection: "column", alignItems: "center",
                            padding: "4px 1px 3px", gap: 2,
                            background: isSel && !todayDay ? "rgba(57,255,135,0.1)" : "transparent",
                            fontWeight: todayDay || isSel ? 800 : 400,
                          }}>
                          <span>{day.getDate()}</span>
                          <div style={{ display: "flex", gap: 2, justifyContent: "center", minHeight: 6 }}>
                            {status && <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "feito" ? GREEN : status === "atrasada" ? RED : status === "planejada" ? BLUE : AMBER, flexShrink: 0 }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Legenda */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid rgba(0,0,0,0.07)", flexWrap: "wrap" }}>
                    {[["Feito", GREEN], ["Atrasada", RED], ["Planejada", BLUE], ["Aguardando", AMBER]].map(([l, c]) => (
                      <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#9CA3AF" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: c as string, flexShrink: 0 }} />{l}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agenda do dia */}
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
                  <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                    {selectedDate ? format(parseISO(selectedDate), "EEE, dd MMM yyyy", { locale: ptBR }).toUpperCase() : "Selecione um dia"}
                  </div>

                  {selectedDate && selectedAgendas.length === 0 && selectedRequisicoes.length === 0 && (
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", textAlign: "center", padding: "12px 0" }}>Nenhuma agenda para este dia</div>
                  )}

                  {selectedAgendas.map(ag => {
                    const statusDisplay = getAgendaStatusDisplay(ag);
                    const isSel = ag.id === selectedClienteId;
                    return (
                      <div key={ag.id} onClick={() => isSel ? handleDeselectAgenda() : handleSelectAgenda(ag)}
                        style={{
                          borderWidth: "0.5px 0.5px 0.5px 3px",
                          borderStyle: "solid",
                          borderColor: isSel
                            ? `rgba(57,255,135,0.4) rgba(57,255,135,0.4) rgba(57,255,135,0.4) ${BLUE}`
                            : `rgba(0,0,0,0.07) rgba(0,0,0,0.07) rgba(0,0,0,0.07) ${BLUE}`,
                          borderRadius: 8, padding: "9px 11px", cursor: "pointer",
                          background: isSel ? "rgba(57,255,135,0.04)" : "#fff",
                          position: "relative", overflow: "hidden",
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{ag.cliente}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2, lineHeight: 1.3 }}>{ag.atividade_descricao || ag.atividade}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                          <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 100, ...(() => { const cls = statusDisplay.color; if (cls.includes("blue")) return { background: "#EFF6FF", color: BLUE }; if (cls.includes("emerald")) return { background: "#F0FDF4", color: GREEN }; if (cls.includes("yellow") || cls.includes("amber")) return { background: "#FFF7ED", color: "#D97706" }; return { background: "#F3F4F6", color: "#6B7280" }; })(), fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{statusDisplay.label}</span>
                          {ag.item_cronograma && <SLABadgeSimples dominio="apontamento" dataRef={ag.data} />}
                        </div>
                      </div>
                    );
                  })}

                  {!selectedDate && (
                    <div style={{ fontSize: 9, color: "#9CA3AF", textAlign: "center", padding: "10px 0", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em", lineHeight: 1.5 }}>
                      Clique em um dia para ver agendas<br />Selecione uma agenda para ativar os submenus
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Registrar */}
            <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.012)", minHeight: 42 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: NAVY, color: LIME, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="#39FF87"><polygon points="2,1 9,5 2,9"/></svg></div>
                  Registrar
                </div>
                {selectedAgenda && (
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(57,255,135,0.1)", color: GREEN, border: "0.5px solid rgba(57,255,135,0.2)", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                    {selectedAgenda.cliente.split(" ")[0]} - {format(parseISO(selectedAgenda.data), "dd/MM")}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {!selectedAgenda ? (
                  <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "24px 14px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em", lineHeight: 1.8 }}>
                    Selecione uma agenda no calendario
                  </div>
                ) : (
                  <>
                    <div style={{ margin: "10px 12px 0", background: "rgba(57,255,135,0.04)", border: "0.5px solid rgba(57,255,135,0.15)", borderRadius: 8, padding: "9px 11px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{selectedAgenda.cliente}</div>
                      <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginTop: 2, letterSpacing: "0.04em" }}>
                        {format(parseISO(selectedAgenda.data), "dd/MM/yyyy")} - {selectedAgenda.atividade} - {getAgendaStatusDisplay(selectedAgenda).label}
                      </div>
                    </div>
                    <div style={{ padding: "8px 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {/* Apontamento */}
                      <button onClick={handleOpenApontamento} disabled={isApontamentoDone || isDateFuture || isProjetoNaoLiberado}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 8, cursor: isApontamentoDone ? "not-allowed" : "pointer", border: "0.5px solid rgba(57,255,135,0.2)", background: NAVY, textAlign: "left", width: "100%", opacity: isApontamentoDone ? 0.5 : 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(57,255,135,0.12)", color: LIME, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 10 10" fill="#39FF87"><polygon points="2,1 9,5 2,9"/></svg></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: LIME }}>{isApontamentoDone ? "Apontamento ja registrado" : "Registrar Apontamento"}</div>
                          <div style={{ fontSize: 9, color: "rgba(57,255,135,0.4)", marginTop: 1 }}>Atividades - horas - modalidade - feeling</div>
                        </div>
                      </button>

                      {/* Despesa */}
                      <button onClick={() => setDespesaOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.07)", background: "#fff", textAlign: "left", width: "100%" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#FFF7ED", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>$</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Lancar Despesa</div>
                          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 1 }}>Reembolso - foto comprovante</div>
                        </div>
                      </button>

                      {/* Requisitar */}
                      <button onClick={() => setReqOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.07)", background: "#fff", textAlign: "left", width: "100%" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#EFF6FF", color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>+</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Requisitar Agenda</div>
                          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 1 }}>Nova data ou atividade</div>
                        </div>
                      </button>

                      {/* Cancelamento */}
                      <button onClick={() => setCancelAgendaOpen(true)} disabled={isApontamentoDone}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: isApontamentoDone ? "not-allowed" : "pointer", border: "0.5px solid rgba(0,0,0,0.07)", background: "#fff", textAlign: "left", width: "100%", opacity: isApontamentoDone ? 0.4 : 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#FEF2F2", color: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="11" height="11" viewBox="0 0 12 12" stroke="#E24B4A" strokeWidth="2.5" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Solicitar Cancelamento</div>
                          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 1 }}>Justificativa obrigatoria</div>
                        </div>
                      </button>
                    </div>
                    <div style={{ margin: "0 12px 12px", padding: "7px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 5, fontSize: 9, color: "#9CA3AF", textAlign: "center", fontFamily: "'DM Mono', monospace", border: "0.5px solid rgba(0,0,0,0.07)" }}>
                      OS enviada automaticamente apos apontamento
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* STATE HINT */}
          {!ctxVisible && (
            <div style={{ background: "rgba(11,22,40,0.04)", border: "0.5px dashed rgba(11,22,40,0.12)", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={18} style={{ color: "rgba(11,22,40,0.4)", flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: "#4B5563", lineHeight: 1.5 }}>
                <strong style={{ color: "#111827", fontWeight: 700 }}>Selecione uma agenda</strong> para acessar Diario de Bordo, Cronograma, Documentos e Kanban. Os submenus laterais habilitam automaticamente.
              </div>
            </div>
          )}

          {/* CONTEXT PANEL */}
          {ctxVisible && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Tabs */}
              <div style={{ display: "flex", background: "#fff", borderWidth: "0.5px 0.5px 0 0.5px", borderStyle: "solid", borderColor: "rgba(0,0,0,0.07)", borderRadius: "10px 10px 0 0", overflow: "hidden" }}>
                {[
                  { id: "diario"     as const, label: "Diario de Bordo",   badge: diarioEntradas.length > 0 ? String(diarioEntradas.length) : null, badgeBg: "rgba(57,255,135,0.1)", badgeColor: GREEN },
                  { id: "cronograma" as const, label: "Cronograma",         badge: "em andamento", badgeBg: "rgba(245,166,35,0.1)", badgeColor: "#D97706" },
                  { id: "docs"       as const, label: "Documentos",         badge: null, badgeBg: "", badgeColor: "" },
                  { id: "kanban"     as const, label: "Kanban",             badge: "BL-004", badgeBg: "#F5F3FF", badgeColor: "#7C3AED" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setCtxTab(tab.id)}
                    style={{
                      flex: 1, padding: "10px 12px",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      fontSize: 11, fontWeight: 600,
                      color: ctxTab === tab.id ? NAVY : "#9CA3AF",
                      cursor: "pointer",
                      borderWidth: 0,
                      borderBottomWidth: "2.5px",
                      borderBottomStyle: "solid",
                      borderBottomColor: ctxTab === tab.id ? LIME : "transparent",
                      background: ctxTab === tab.id ? "#fff" : "rgba(0,0,0,0.012)",
                      transition: "all 0.2s",
                    }}>
                    {tab.label}
                    {tab.badge && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, fontFamily: "'DM Mono', monospace", background: tab.badgeBg, color: tab.badgeColor }}>{tab.badge}</span>}
                  </button>
                ))}
              </div>

              {/* Pane */}
              <div style={{ background: "#fff", borderWidth: "0 0.5px 0.5px 0.5px", borderStyle: "solid", borderColor: "rgba(0,0,0,0.07)", borderRadius: "0 0 10px 10px", minHeight: 240 }}>

                {/* DIARIO */}
                {ctxTab === "diario" && (
                  <div style={{ padding: 16 }}>
                    {diarioLoading ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
                        <Loader2 size={20} style={{ color: "#9CA3AF", animation: "spin 1s linear infinite" }} />
                      </div>
                    ) : diarioEntradas.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 24, color: "#9CA3AF", fontSize: 11 }}>Nenhuma entrada no diario para este projeto</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {diarioEntradas.slice(0, 3).map(e => (
                          <div key={e.id} style={{ padding: "9px 0", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#9CA3AF" }}>{format(parseISO(e.data), "dd MMM yyyy", { locale: ptBR })} - {e.origem}</span>
                              <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, fontFamily: "'DM Mono', monospace", background: e.origem === "coordenador" ? "rgba(245,166,35,0.1)" : "rgba(57,255,135,0.1)", color: e.origem === "coordenador" ? "#D97706" : GREEN }}>{e.origem}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#4B5563", lineHeight: 1.55 }}>{e.texto}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 8, border: "0.5px dashed rgba(57,255,135,0.3)", borderRadius: 7, fontSize: 10, color: GREEN, cursor: "pointer", marginTop: 10, background: "rgba(57,255,135,0.02)", fontWeight: 600 }}>
                      + Nova entrada do dia
                    </button>
                  </div>
                )}

                {/* CRONOGRAMA - GanttCanvas portado do AdminStatusReport */}
                {ctxTab === "cronograma" && projetoSelecionado && (
                  <GanttCanvas
                    projetoId={projetoSelecionado.id}
                    projetoNome={projetoSelecionado.nome_cliente}
                  />
                )}

                {/* DOCUMENTOS — Meus Docs (Autentique) + Biblioteca (SharePoint) */}
                {ctxTab === "docs" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 240 }}>

                    {/* Meus Documentos — Pendentes + Enviados do projeto */}
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 320 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#39FF87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        Meus Documentos
                      </div>

                      {projetoDocs.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "20px 0", fontFamily: "'DM Mono', monospace" }}>
                          Nenhum documento para este projeto
                        </div>
                      ) : (
                        <>
                          {/* Pendentes */}
                          {projetoDocs.filter(d => d.status === "doc_pendente" || (!d.doc_referencia && d.status !== "apontamento_ok" && d.status !== "apontamento_ajustado")).length > 0 && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: RED }} />
                                Pendentes
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {projetoDocs
                                  .filter(d => d.status === "doc_pendente" || (!d.doc_referencia && d.status !== "apontamento_ok" && d.status !== "apontamento_ajustado"))
                                  .map(doc => (
                                    <div key={doc.id} style={{ padding: "8px 10px", background: "#FEF2F2", borderRadius: 7, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(226,75,74,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: RED, flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          OS - {format(parseISO(doc.data), "dd/MM/yyyy")}
                                        </div>
                                        <div style={{ fontSize: 9, color: RED, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                                          Documento nao enviado
                                        </div>
                                      </div>
                                      <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: RED, background: "rgba(226,75,74,0.08)", padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>
                                        Pendente
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Enviados */}
                          {projetoDocs.filter(d => d.doc_referencia).length > 0 && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }} />
                                Enviados
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {projetoDocs
                                  .filter(d => d.doc_referencia)
                                  .map(doc => (
                                    <div key={doc.id} style={{ padding: "8px 10px", background: "#F0FDF4", borderRadius: 7, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(5,150,105,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          OS - {format(parseISO(doc.data), "dd/MM/yyyy")}
                                        </div>
                                        <div style={{ fontSize: 9, color: GREEN, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                                          {getAgendaStatusDisplay(doc).label}
                                        </div>
                                      </div>
                                      <a href={doc.doc_referencia!} target="_blank" rel="noopener noreferrer"
                                        style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: GREEN, background: "rgba(5,150,105,0.08)", padding: "2px 7px", borderRadius: 4, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(5,150,105,0.2)", textDecoration: "none", flexShrink: 0 }}>
                                        Ver
                                      </a>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Apontamentos sem doc exigido */}
                          {projetoDocs.filter(d => !d.doc_referencia && (d.status === "apontamento_ok" || d.status === "apontamento_ajustado")).length > 0 && (
                            <div>
                              <div style={{ fontSize: 8, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#9CA3AF" }} />
                                Sem documento exigido
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {projetoDocs
                                  .filter(d => !d.doc_referencia && (d.status === "apontamento_ok" || d.status === "apontamento_ajustado"))
                                  .map(doc => (
                                    <div key={doc.id} style={{ padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 7, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#D1D5DB", flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          OS - {format(parseISO(doc.data), "dd/MM/yyyy")}
                                        </div>
                                        <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                                          {getAgendaStatusDisplay(doc).label}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Biblioteca do Projeto — SharePoint */}
                    <div style={{ padding: 16, borderLeftWidth: "0.5px", borderLeftStyle: "solid", borderLeftColor: "rgba(0,0,0,0.07)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
                        </div>
                        Biblioteca do Projeto
                        {spLoading && <Loader2 size={10} style={{ color: "#9CA3AF", animation: "spin 1s linear infinite", marginLeft: 4 }} />}
                      </div>

                      {spError && (
                        <div style={{ fontSize: 10, color: RED, background: "#FEF2F2", border: "0.5px solid rgba(226,75,74,0.2)", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
                          {spError}
                        </div>
                      )}

                      {!spLoading && !spError && spFiles.length === 0 && (
                        <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "16px 0" }}>
                          Nenhum documento encontrado no SharePoint
                        </div>
                      )}

                      {!spLoading && spFiles.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {spFiles.map(f => (
                            <div key={f.webUrl} style={{ padding: "8px 10px", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 7, display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                                <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                                  {formatFileSize(f.size)}
                                  {f.lastModifiedDateTime ? " - " + format(parseISO(f.lastModifiedDateTime), "dd/MM/yyyy") : ""}
                                </div>
                              </div>
                              <a href={f.webUrl} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: BLUE, background: "#EFF6FF", padding: "2px 7px", borderRadius: 4, border: "0.5px solid rgba(59,130,246,0.2)", textDecoration: "none", flexShrink: 0 }}>
                                Abrir
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* KANBAN */}
                {ctxTab === "kanban" && projetoSelecionado && user && (
                  <BacklogBoard
                    projetoId={projetoSelecionado.id}
                    projetoNome={projetoSelecionado.nome_cliente}
                    userId={user.id}
                    isCoordinator={role === "coordenador"}
                    agendaData={selectedDate || undefined}
                    agendaCliente={selectedAgenda?.cliente}
                  />
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── DIALOGS portados do original ── */}
      {renderDialogs()}

      <style>{`
        @keyframes blink { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );

  // ── renderDialogs: todos os modais do original portados ────────────────────
  function renderDialogs() {
    return (
      <>
        {/* Modal de Apontamento — portado integralmente do ConsultorDashboard.tsx original */}
        <Dialog open={apontamentoOpen} onOpenChange={setApontamentoOpen}>
          <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm">Registrar Apontamento</DialogTitle>
              {selectedAgenda && <p className="text-xs text-muted-foreground">{selectedAgenda.cliente} - {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</p>}
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 px-1">
              <div>
                <Label className="text-xs mb-1 block">Modalidade</Label>
                <Select value={apontModalidade} onValueChange={setApontModalidade}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remoto">Remoto</SelectItem>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="Hibrido">Hibrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Atividades</Label>
                {atividadesApontadas.map((aa, idx) => {
                  const atv = projetoAtividades.find(a => a.codigo === aa.atividade_codigo);
                  const saldo = atv ? getSaldo(atv) : null;
                  const pct   = atv ? getPercentual(atv) : 0;
                  return (
                    <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground">Atividade {idx + 1}</span>
                        {atividadesApontadas.length > 1 && (
                          <button onClick={() => setAtividadesApontadas(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Select value={aa.atividade_codigo} onValueChange={val => {
                        const a = projetoAtividades.find(x => x.codigo === val);
                        if (!a) return;
                        setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, atividade_codigo: a.codigo, atividade_descricao: a.descricao, horas: 0, percentual_feeling: null } : item));
                      }}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
                        <SelectContent>
                          {projetoAtividades.map(a => (
                            <SelectItem key={a.codigo} value={a.codigo} disabled={getSaldo(a) <= 0 && a.codigo !== aa.atividade_codigo}>
                              <span className="text-xs">{a.codigo} - {a.descricao} <span className="text-muted-foreground">(saldo: {getSaldo(a)}h)</span></span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {atv && (
                        <div className="text-[9px] text-muted-foreground">
                          <Progress value={pct} className="h-1 mt-1" />
                          <span>{pct}% consumido - saldo {getSaldo(atv)}h de {Number(atv.horas)}h</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Horas</Label>
                          <Input type="number" min={0} step={0.5} value={aa.horas || ""} onChange={e => setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, horas: Number(e.target.value) } : item))} className="h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px]">% Conclusao</Label>
                          <Input type="number" min={0} max={100} value={aa.percentual_feeling ?? ""} onChange={e => setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, percentual_feeling: Number(e.target.value) } : item))} className="h-8 text-xs" placeholder="0-100" />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setAtividadesApontadas(prev => [...prev, { atividade_codigo: "", atividade_descricao: "", horas: 0, percentual_feeling: null }])} className="w-full text-xs gap-1">
                  <Plus className="h-3 w-3" />Adicionar atividade
                </Button>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Descricao (opcional)</Label>
                <Textarea value={apontDescricao} onChange={e => setApontDescricao(e.target.value)} className="text-xs min-h-[60px]" placeholder="Descreva o que foi realizado..." />
              </div>
              {/* BL-009 Diario */}
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">Observacao para o Diario de Bordo (opcional)</Label>
                <Select value={diarioCategoria} onValueChange={val => setDiarioCategoria(val as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["geral","decisao","ocorrencia","marco","alerta"] as const).map(c => (
                      <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea value={diarioObs} onChange={e => setDiarioObs(e.target.value)} className="text-xs min-h-[50px]" placeholder="Registro para o diario de bordo do projeto..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setApontamentoOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleGravarApontamento} disabled={apontamentoLoading}>
                {apontamentoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Continuar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resumo do Apontamento */}
        <Dialog open={resumoOpen} onOpenChange={setResumoOpen}>
          <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col">
            <DialogHeader><DialogTitle className="text-sm">Confirmar Apontamento</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              <div className="rounded-lg bg-muted/30 p-3 space-y-1">
                <p><strong>Cliente:</strong> {selectedAgenda?.cliente}</p>
                <p><strong>Data:</strong> {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</p>
                <p><strong>Modalidade:</strong> {apontModalidade}</p>
                {projetoDeslocamento > 0 && <p><strong>Deslocamento:</strong> {projetoDeslocamento}h</p>}
              </div>
              {atividadesApontadas.map((aa, i) => (
                <div key={i} className="rounded-lg border p-2.5 space-y-0.5">
                  <p className="font-semibold">{aa.atividade_codigo} - {aa.atividade_descricao}</p>
                  <p className="text-muted-foreground">{aa.horas}h - {aa.percentual_feeling ?? 0}% conclusao</p>
                </div>
              ))}
              {apontDescricao && <div className="rounded-lg bg-muted/20 p-2.5 text-muted-foreground">{apontDescricao}</div>}
              {cronogramaItemDoc?.doc_exigido && !cronogramaItemDoc.doc_satisfeito && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-amber-700 font-semibold text-[11px]">Documento exigido: {cronogramaItemDoc.codigo}</p>
                  <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="text-xs h-8" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                  {docFile && (
                    <Button size="sm" variant="outline" onClick={handleUploadDoc} disabled={docUploading} className="w-full text-xs gap-1">
                      {docUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><FileStack className="h-3 w-3" />Enviar documento</>}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setResumoOpen(false); setApontamentoOpen(true); }}>Voltar</Button>
              <Button size="sm" onClick={handleConfirmarApontamento} disabled={resumoLoading}>
                {resumoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Despesa */}
        <Dialog open={despesaOpen} onOpenChange={setDespesaOpen}>
          <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col">
            <DialogHeader><DialogTitle className="text-sm">Lancar Despesa</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              <div>
                <Label className="text-xs mb-1 block">Descricao</Label>
                <Input value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className="h-9 text-xs" placeholder="Ex: Uber, Alimentacao..." />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Valor (R$)</Label>
                <Input type="number" min={0} step={0.01} value={despValor} onChange={e => setDespValor(e.target.value)} className="h-9 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Comprovante (opcional)</Label>
                <Input type="file" accept="image/*,.pdf" className="h-8 text-xs" onChange={e => setDespFoto(e.target.files?.[0] || null)} />
              </div>
              {despesasLancadas.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground">Despesas ja lancadas hoje:</p>
                  {despesasLancadas.map(d => (
                    <div key={d.id} className="flex justify-between rounded border p-2 text-[10px]">
                      <span>{d.descricao}</span>
                      <span className="font-medium">{d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDespesaOpen(false)}>Cancelar</Button>
              <Button size="sm" disabled={despLoading || !despDescricao || !despValor} onClick={async () => {
                if (!selectedDate || !user || !despDescricao || !despValor) return;
                setDespLoading(true);
                const { error } = await supabase.from("despesas").insert({ user_id: user.id, data_despesa: selectedDate, cliente: selectedAgenda?.cliente || "", descricao: despDescricao, valor: parseFloat(despValor) });
                if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
                else { toast({ title: "Despesa lancada!" }); setDespesaOpen(false); setDespDescricao(""); setDespValor(""); setDespFoto(null); }
                setDespLoading(false);
              }}>
                {despLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Lancar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Requisitar Agenda */}
        <Dialog open={reqOpen} onOpenChange={setReqOpen}>
          <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col">
            <DialogHeader><DialogTitle className="text-sm">Requisitar Agenda</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              <div>
                <Label className="text-xs mb-1 block">Data</Label>
                <Input type="date" value={reqData} onChange={e => setReqData(e.target.value)} className="h-9 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Cliente</Label>
                <Select value={reqCliente} onValueChange={async (val) => {
                  setReqCliente(val);
                  setReqAtividadesLoading(true);
                  const proj = offProjetos.find(p => p.nome_cliente === val);
                  if (proj) {
                    setReqCoordenador(proj.coordenador_id || "");
                    const { data } = await supabase.from("projeto_atividades").select("id, codigo, descricao, horas, projeto_id").eq("projeto_id", proj.id);
                    setReqAtividades(data || []);
                  }
                  setReqAtividadesLoading(false);
                }}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                  <SelectContent>
                    {offProjetos.filter(p => p.status === "Liberado").map(p => <SelectItem key={p.id} value={p.nome_cliente}>{p.nome_cliente}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Atividade</Label>
                <Select value={reqAtividade} onValueChange={setReqAtividade} disabled={reqAtividadesLoading || !reqCliente}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {reqAtividades.map(a => <SelectItem key={a.codigo} value={`${a.codigo} - ${a.descricao}`}>{a.codigo} - {a.descricao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Horas</Label>
                  <Input type="number" min={0} step={0.5} value={reqHoras} onChange={e => setReqHoras(e.target.value)} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Modalidade</Label>
                  <Select value={reqModalidade} onValueChange={setReqModalidade}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remoto">Remoto</SelectItem>
                      <SelectItem value="Presencial">Presencial</SelectItem>
                      <SelectItem value="Hibrido">Hibrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Justificativa (opcional)</Label>
                <Textarea value={reqJustificativa} onChange={e => setReqJustificativa(e.target.value)} className="text-xs min-h-[60px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setReqOpen(false)}>Cancelar</Button>
              <Button size="sm" disabled={!reqData || !reqCliente || !reqHoras} onClick={async () => {
                if (!user || !reqData || !reqCliente || !reqHoras) return;
                const { error } = await supabase.from("requisicoes_agenda").insert({ user_id: user.id, data: reqData, cliente: reqCliente, coordenador_id: reqCoordenador || null, atividade: reqAtividade || null, total_horas: parseFloat(reqHoras), modalidade: reqModalidade, justificativa: reqJustificativa || null, status: "pendente" });
                if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
                else { toast({ title: "Requisicao enviada!" }); setReqOpen(false); setReqData(""); setReqCliente(""); setReqHoras(""); setReqAtividade(""); setReqJustificativa(""); await loadData(); }
              }}>Enviar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancelamento */}
        <AlertDialog open={cancelAgendaOpen} onOpenChange={setCancelAgendaOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm">Solicitar Cancelamento</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                Justifique o motivo do cancelamento da agenda de {selectedAgenda?.cliente} em {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea value={cancelJustificativa} onChange={e => setCancelJustificativa(e.target.value)} className="text-xs min-h-[80px]" placeholder="Motivo do cancelamento..." />
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
              <Button size="sm" variant="destructive" disabled={!cancelJustificativa.trim()} onClick={async () => {
                if (!selectedAgenda || !cancelJustificativa.trim()) return;
                await supabase.from("agendas").update({ status: "aguardando_cancelamento" }).eq("id", selectedAgenda.id);
                toast({ title: "Solicitacao enviada", description: "O coordenador sera notificado." });
                setCancelAgendaOpen(false);
                setCancelJustificativa("");
                await loadData();
              }}>
                Confirmar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Relatorio Financeiro */}
        <Dialog open={resumoFinanceiroOpen} onOpenChange={setResumoFinanceiroOpen}>
          <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-sm">Relatorio Financeiro - {format(currentMonth, "MMMM yyyy", { locale: ptBR })}</DialogTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-3 w-3" /></Button>
                </div>
              </div>
            </DialogHeader>
            {rfLoading ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Tabs defaultValue="horas" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="shrink-0">
                  <TabsTrigger value="horas" className="text-xs gap-1"><Clock className="h-3 w-3" />Horas</TabsTrigger>
                  <TabsTrigger value="despesas" className="text-xs gap-1"><Receipt className="h-3 w-3" />Despesas</TabsTrigger>
                </TabsList>
                <TabsContent value="horas" className="flex-1 overflow-y-auto px-1 pb-4 mt-2">
                  <div className="rounded-lg border overflow-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50"><th className="text-left p-2 font-medium text-muted-foreground">Data</th><th className="text-left p-2 font-medium text-muted-foreground">Cliente</th><th className="text-left p-2 font-medium text-muted-foreground">Status</th><th className="text-right p-2 font-medium text-muted-foreground">Horas</th><th className="text-right p-2 font-medium text-muted-foreground">Transl.</th><th className="text-right p-2 font-medium text-muted-foreground">Total</th></tr></thead>
                      <tbody>
                        {rfAgendas.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhuma agenda no mes.</td></tr>
                          : rfAgendas.map(ag => { const hL = ag.horas_apontadas || ag.horas_planejadas; const tot = hL + ag.deslocamento; return (<tr key={ag.id} className="border-t"><td className="p-2 whitespace-nowrap">{format(parseISO(ag.data), "dd/MM/yyyy")}</td><td className="p-2">{ag.cliente}</td><td className="p-2"><span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getRfStatusClass(ag.status)}`}>{getRfStatusLabel(ag.status)}</span></td><td className="p-2 text-right">{formatHoras(hL)}</td><td className="p-2 text-right">{ag.deslocamento > 0 ? formatHoras(ag.deslocamento) : "-"}</td><td className="p-2 text-right font-medium">{formatHoras(tot)}</td></tr>); })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                <TabsContent value="despesas" className="flex-1 overflow-y-auto px-1 pb-4 mt-2">
                  <div className="rounded-lg border overflow-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50"><th className="text-left p-2 font-medium text-muted-foreground">Data</th><th className="text-left p-2 font-medium text-muted-foreground">Cliente</th><th className="text-left p-2 font-medium text-muted-foreground">Despesa</th><th className="text-left p-2 font-medium text-muted-foreground">Status</th><th className="text-right p-2 font-medium text-muted-foreground">Valor</th></tr></thead>
                      <tbody>
                        {rfDespesas.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma despesa no mes.</td></tr>
                          : rfDespesas.map(d => (<tr key={d.id} className="border-t"><td className="p-2 whitespace-nowrap">{format(parseISO(d.data), "dd/MM/yyyy")}</td><td className="p-2">{d.cliente}</td><td className="p-2">{d.descricao}</td><td className="p-2"><span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getDespStatusClass(d.status_despesa)}`}>{d.status_despesa}</span></td><td className="p-2 text-right whitespace-nowrap font-medium">{d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr>))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)} className="gap-1 text-xs"><Printer className="h-3 w-3" />Exportar PDF</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export PDF */}
        <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm">Exportar relatorio</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">Escolha o tipo de relatorio para exportar em PDF.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
              <Button size="sm" variant="outline" onClick={() => exportarPDF("despesas")} className="text-xs gap-1"><Receipt className="h-3 w-3" />Despesas</Button>
              <Button size="sm" onClick={() => exportarPDF("horas")} className="text-xs gap-1"><Clock className="h-3 w-3" />Horas</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
}