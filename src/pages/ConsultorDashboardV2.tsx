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
import { useDiario, type StatusMencao } from "@/components/consultor/hooks/useDiario";
import { MencaoAutocomplete } from "@/components/consultor/ui/MencaoAutocomplete";

// Componentes existentes -- zero alteracao
import { PendenciasPMOCard } from "@/components/consultor/ui/PendenciasPMOCard";
import { BacklogBoard } from "@/components/consultor/ui/BacklogBoard";
import { SLABadgeSimples } from "@/components/ui/SLABadge";
import { GanttCanvas } from "@/components/consultor/ui/GanttCanvas";
import { useSharepointDocs, formatFileSize } from "@/components/consultor/hooks/useSharepointDocs";
import { BacklogConsultorModal } from "@/components/consultor/ui/BacklogConsultorModal";

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
  const [diarioMencionados, setDiarioMencionados] = useState<string[]>([]);
  const [diarioTags, setDiarioTags] = useState<string[]>([]);
  const [diarioCriticidade, setDiarioCriticidade] = useState<string | null>(null);
  const [diarioFormOpen, setDiarioFormOpen] = useState(false);
  const [diarioReplyId, setDiarioReplyId] = useState<string | null>(null);
  const [diarioReplyTexto, setDiarioReplyTexto] = useState("");
  const [diarioReplyMencionados, setDiarioReplyMencionados] = useState<string[]>([]);
  const [diarioReplyTags, setDiarioReplyTags] = useState<string[]>([]);

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
  const [reqAtividadeId, setReqAtividadeId] = useState("");
  const [reqCronoItemId, setReqCronoItemId] = useState("");
  const [reqCronoItens, setReqCronoItens] = useState<any[]>([]);
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
  const [projetoDocs, setProjetoDocs] = useState<Agenda[]>([]);
  const [atvTabAtiva, setAtvTabAtiva] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendenciasModalOpen, setPendenciasModalOpen] = useState(false);
  const [navAtiva, setNavAtiva] = useState<string>("Dashboard");
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqModalTab, setReqModalTab] = useState<"pendentes"|"cancelamentos"|"aprovacoes">("pendentes");
  const [reqHistorico, setReqHistorico] = useState<any[]>([]);
  const [reqHistLoading, setReqHistLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);

  // Search bar — projetos Liberados filtrados por query
  const projetosAtivos = useMemo(() => {
    // Mostrar todos os projetos do consultor — sem filtro de status
    // O filtro de Liberado é só para ações (apontamento, requisicao)
    const base = offProjetos;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(p => p.nome_cliente.toLowerCase().includes(q));
  }, [offProjetos, searchQuery]);
  const [cronogramaItensPorAtividade, setCronogramaItensPorAtividade] = useState<Record<string, any[]>>({});

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { pendencias, totalPendencias, loadingPendencias, loadPendencias } = usePendencias(user?.id);
  const { entradas: diarioEntradas, loading: diarioLoading, saving: diarioSaving, loadEntradas: loadDiarioEntradas, insertEntrada, insertReply, marcarCiente, marcarResolvido, loadUsuariosMencionaveis, usuariosMencionaveis, totalMencoesPendentes, getStatusMencaoCores } = useDiario();
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

  // Renderizar texto do diario com chips visuais (@mencao #tag !criticidade)
  const renderTextoComChips = (texto: string) => {
    const partes: React.ReactNode[] = [];
    const regex = /(@\[([^\]]+)\]\([a-f0-9-]{36}\)|#\[([^\]]+)\]|!\[(alta|media|baixa)\])/g;
    let ultimo = 0;
    let match;
    let idx = 0;
    while ((match = regex.exec(texto)) !== null) {
      if (match.index > ultimo) {
        partes.push(<span key={`t${idx++}`}>{texto.slice(ultimo, match.index)}</span>);
      }
      const token = match[0];
      if (token.startsWith('@[')) {
        const nome = match[2];
        partes.push(
          <span key={`m${idx++}`} style={{ display: "inline-flex", alignItems: "center", background: "rgba(37,99,235,0.10)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 999, padding: "0 7px", fontSize: 10, fontWeight: 500, margin: "0 2px", lineHeight: 1.7 }}>
            @{nome}
          </span>
        );
      } else if (token.startsWith('#[')) {
        const tag = match[3];
        partes.push(
          <span key={`tg${idx++}`} style={{ display: "inline-flex", alignItems: "center", background: "rgba(124,58,237,0.10)", color: "#6d28d9", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 999, padding: "0 7px", fontSize: 10, fontWeight: 500, margin: "0 2px", lineHeight: 1.7 }}>
            #{tag}
          </span>
        );
      } else if (token.startsWith('![')) {
        const crit = match[4] as "alta" | "media" | "baixa";
        const corMap: Record<string, { bg: string; color: string; border: string; label: string }> = {
          alta:  { bg: "rgba(220,38,38,0.10)",  color: "#b91c1c", border: "rgba(220,38,38,0.25)",  label: "!!! Alta"  },
          media: { bg: "rgba(217,119,6,0.10)",  color: "#b45309", border: "rgba(217,119,6,0.25)",  label: "!! Media" },
          baixa: { bg: "rgba(22,163,74,0.10)",  color: "#15803d", border: "rgba(22,163,74,0.25)",  label: "! Baixa"  },
        };
        const c = corMap[crit] || corMap.baixa;
        partes.push(
          <span key={`cr${idx++}`} style={{ display: "inline-flex", alignItems: "center", background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 999, padding: "0 7px", fontSize: 10, fontWeight: 500, margin: "0 2px", lineHeight: 1.7 }}>
            {c.label}
          </span>
        );
      }
      ultimo = match.index + token.length;
    }
    if (ultimo < texto.length) partes.push(<span key={`t${idx++}`}>{texto.slice(ultimo)}</span>);
    return partes;
  };

  // Carregar usuarios mencionaveis sempre que projeto muda
  useEffect(() => {
    if (projetoSelecionado?.id) loadUsuariosMencionaveis(projetoSelecionado.id);
  }, [projetoSelecionado?.id]);

  // Auto-select agenda: fonte unica de verdade via handleSelectAgenda
  // handleSelectAgenda atualiza projetoSelecionado, SP, diario, etc
  // Auto-select: sempre que o dia muda, re-avaliar qual agenda/projeto ativar
  useEffect(() => {
    if (selectedAgendas.length === 1) {
      handleSelectAgenda(selectedAgendas[0]);
    } else if (selectedAgendas.length === 0) {
      // Sem agenda no dia: manter projeto em foco se veio da busca
      setSelectedClienteId(null);
    }
    // Com múltiplas agendas no dia: usuário escolhe manualmente
  }, [selectedDate]);

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

  const loadProjetoDocs = async (projetoNomeCliente: string) => {
    if (!user || !projetoNomeCliente) return;
    const { data } = await supabase
      .from("agendas")
      .select("id, cliente, data, atividade, status, atividade_descricao, item_cronograma, doc_referencia, codigo_cliente")
      .eq("user_id", user.id)
      .eq("cliente", projetoNomeCliente)
      .in("status", ["doc_pendente","apontamento_ok","apontamento_ajustado","em_aprovacao"])
      .order("data", { ascending: false })
      .limit(20);
    setProjetoDocs(data || []);
  };

  const loadReqHistorico = async () => {
    if (!user) return;
    setReqHistLoading(true);
    const trinta = new Date(); trinta.setDate(trinta.getDate() - 30);
    const [{ data: reqs }, { data: cancels }] = await Promise.all([
      supabase.from("requisicoes_agenda")
        .select("id, data, cliente, atividade, total_horas, modalidade, status, justificativa, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("agendas")
        .select("id, data, cliente, atividade, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "aguardando_cancelamento")
        .order("data", { ascending: false }),
    ]);
    setReqHistorico([
      ...(reqs || []).map((r: any) => ({ ...r, _tipo: "requisicao" })),
      ...(cancels || []).map((a: any) => ({ ...a, _tipo: "cancelamento" })),
    ]);
    setReqHistLoading(false);
  };

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
      .select("id, nome_cliente, codigo_cliente, coordenador_id, deslocamento, email_contato, status, monday_board_url, sharepoint_pasta_url");
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

  // Dias com agenda do projeto em foco (para highlight no calendário)
  const diasDoProjeto = projetoSelecionado && !selectedClienteId
    ? new Set(agendas.filter(a => a.cliente === projetoSelecionado.nome_cliente).map(a => a.data))
    : null;

  const selectedAgendas    = agendas.filter(a => a.data === selectedDate);
  const selectedRequisicoes = requisicoesPendentes.filter(r => r.data === selectedDate);
  const selectedAgenda     = selectedAgendas.find(a => a.id === selectedClienteId);

  // Auto-selecionar agenda quando dia clicado tem exatamente uma



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
    setApontamentoOpen(true); setAtvTabAtiva(0);
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
    // Limpar estado anterior para garantir re-render completo
    clearSpFiles();
    setProjetoDocs([]);
    setCronogramaItensPorAtividade({});
    // Reset form diario ao trocar de agenda/projeto
    setDiarioFormOpen(false);
    setDiarioObs("");
    setDiarioMencionados([]);
    setDiarioTags([]);
    setDiarioCriticidade(null);
    setDiarioCategoria("geral");
    setDiarioReplyId(null);
    setDiarioReplyTexto("");
    setSelectedClienteId(agenda.id);
    const proj = offProjetos.find(p => p.nome_cliente === agenda.cliente) || null;
    setProjetoSelecionado(proj);
    setCtxVisible(true);
    setCtxTab("diario");
    if (proj) {
      loadDiarioEntradas(proj.id);
      loadUsuariosMencionaveis(proj.id);
      if (agenda.codigo_cliente) loadSpFiles(agenda.codigo_cliente, agenda.cliente);
      loadProjetoDocs(agenda.cliente);
      supabase.from("projeto_atividades").select("id, codigo").eq("projeto_id", proj.id)
        .then(({ data: ativs }) => {
          if (!ativs || ativs.length === 0) return;
          supabase.from("cronograma_itens").select("id, atividade_id, codigo, descricao, doc_exigido, doc_satisfeito")
            .in("atividade_id", ativs.map((a: any) => a.id))
            .then(({ data: cis }) => {
              const map: Record<string, any[]> = {};
              (cis || []).forEach((ci: any) => {
                if (!map[ci.atividade_id]) map[ci.atividade_id] = [];
                map[ci.atividade_id].push(ci);
              });
              setCronogramaItensPorAtividade(map);
            });
        });
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
          {/* Search bar — projeto ativo */}
          <div style={{ position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: searchOpen ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              border: searchOpen ? "0.5px solid rgba(57,255,135,0.25)" : "0.5px solid rgba(255,255,255,0.09)",
              borderRadius: 7, padding: "0 12px", width: 220, height: 32, transition: "all 0.15s",
            }}>
              <Search size={11} style={{ color: searchOpen ? "rgba(57,255,135,0.6)" : "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="buscar projeto ativo..."
                style={{
                  background: "transparent", border: "none", outline: "none",
                  fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Mono', monospace",
                  width: "100%", letterSpacing: "0.03em",
                }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, lineHeight: 1, flexShrink: 0 }}>
                  <XCircle size={12} />
                </button>
              )}
            </div>
            {/* Dropdown de resultados */}
            {searchOpen && projetosAtivos.length > 0 && (
              <div style={{
                position: "absolute", top: 36, left: 0, width: 260,
                background: "#0F1E35", border: "0.5px solid rgba(57,255,135,0.15)",
                borderRadius: 8, overflow: "hidden", zIndex: 100,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}>
                <div style={{ padding: "6px 12px 4px", fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {searchQuery ? `${projetosAtivos.length} resultado${projetosAtivos.length !== 1 ? "s" : ""}` : "Projetos ativos"}
                </div>
                {projetosAtivos.slice(0, 6).map(proj => (
                  <button key={proj.id}
                    onMouseDown={() => {
                      // Limpar estado anterior antes de setar novo projeto
                      setSelectedClienteId(null);
                      setSelectedDate(null);
                      clearSpFiles();
                      setProjetoDocs([]);
                      setCronogramaItensPorAtividade({});
                      setProjetoSelecionado(proj);
                      setCtxVisible(true);
                      setCtxTab("diario");
                      loadDiarioEntradas(proj.id);
                      loadUsuariosMencionaveis(proj.id);
                      loadProjetoDocs(proj.nome_cliente);
                      if ((proj as any).codigo_cliente) loadSpFiles((proj as any).codigo_cliente, proj.nome_cliente);
                      supabase.from("projeto_atividades").select("id, codigo").eq("projeto_id", proj.id)
                        .then(({ data: ativs }) => {
                          if (!ativs || ativs.length === 0) return;
                          supabase.from("cronograma_itens").select("id, atividade_id, codigo, descricao, doc_exigido, doc_satisfeito")
                            .in("atividade_id", ativs.map((a: any) => a.id))
                            .then(({ data: cis }) => {
                              const map: Record<string, any[]> = {};
                              (cis || []).forEach((ci: any) => {
                                if (!map[ci.atividade_id]) map[ci.atividade_id] = [];
                                map[ci.atividade_id].push(ci);
                              });
                              setCronogramaItensPorAtividade(map);
                            });
                        });
                      setSearchQuery("");
                      setSearchOpen(false);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 14px", background: "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                      borderTop: "0.5px solid rgba(255,255,255,0.04)",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(57,255,135,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: LIME, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{proj.nome_cliente}</span>
                  </button>
                ))}
                {projetosAtivos.length > 6 && (
                  <div style={{ padding: "6px 14px 8px", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>
                    +{projetosAtivos.length - 6} outros
                  </div>
                )}
              </div>
            )}
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
            <button title="Pendencias" onClick={() => setPendenciasModalOpen(true)} style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
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
        {/* Card projeto — estado unificado */}
        <div style={{
          margin: "12px 12px 4px",
          background: projetoSelecionado ? "rgba(57,255,135,0.09)" : "rgba(255,255,255,0.02)",
          border: projetoSelecionado ? "0.5px solid rgba(57,255,135,0.22)" : "0.5px solid rgba(255,255,255,0.06)",
          borderRadius: 9, padding: 12, flexShrink: 0,
          transition: "all 0.2s",
        }}>
          {/* Header: label + X */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: projetoSelecionado ? 6 : 0 }}>
            <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.2em", color: projetoSelecionado ? "rgba(57,255,135,0.5)" : "rgba(255,255,255,0.15)", textTransform: "uppercase" }}>
              {projetoSelecionado ? "Projeto ativo" : "Nenhum projeto"}
            </span>
            {projetoSelecionado && (
              <button
                onClick={() => { setProjetoSelecionado(null); setCtxVisible(false); setSelectedClienteId(null); clearSpFiles(); setProjetoDocs([]); setCronogramaItensPorAtividade({}); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 2, lineHeight: 1, display: "flex", alignItems: "center", transition: "color 0.15s" }}
                title="Limpar projeto"
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {projetoSelecionado ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 7, letterSpacing: "-0.01em" }}>{projetoSelecionado.nome_cliente}</div>
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
              <div style={{ fontSize: 9, color: "rgba(57,255,135,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 5 }}>
                {selectedAgenda ? "agenda ativa" : "em foco - selecione uma agenda"}
              </div>
            </>
          ) : (
            /* Estado inicial neutro — sem projeto, sem historico */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0 4px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontFamily: "'DM Mono', monospace", textAlign: "center", lineHeight: 1.6 }}>
                Busque um projeto<br/>ou selecione uma agenda
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" }}>
          {/* Principal */}
          <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.22em", color: "rgba(255,255,255,0.17)", textTransform: "uppercase", padding: "8px 10px 3px", display: "block" }}>Principal</div>
          {[
            { icon: <IcoDashboard />, label: "Dashboard",   fn: () => { setNavAtiva("Dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
            { icon: <IcoPend />,      label: "Pendencias",  badge: totalPendencias > 0 ? totalPendencias : null, badgeColor: RED,   fn: () => { setNavAtiva("Pendencias"); setPendenciasModalOpen(true); } },
            { icon: <IcoReq />,       label: "Requisicoes", badge: requisicoesPendentes.length > 0 ? requisicoesPendentes.length : null, badgeColor: AMBER, fn: () => { setNavAtiva("Requisicoes"); setReqModalOpen(true); loadReqHistorico(); } },
            { icon: <IcoBacklog />,   label: "Meu Backlog",  fn: () => { setNavAtiva("Meu Backlog"); setBacklogModalOpen(true); } },
          ].map(item => {
            const isActive = navAtiva === item.label;
            return (
            <div key={item.label} onClick={item.fn} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "6px 10px", borderRadius: 7, cursor: "pointer",
              color: isActive ? LIME : "rgba(255,255,255,0.4)",
              fontSize: 11, fontWeight: isActive ? 600 : 500,
              background: isActive ? "rgba(57,255,135,0.09)" : "transparent",
              position: "relative", transition: "all 0.15s",
            }}>
              <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isActive ? 1 : 0.65 }}>{item.icon}</div>
              {item.label}
              {item.badge != null && (
                <span style={{ marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 6, fontFamily: "'DM Mono', monospace", fontWeight: 600, background: `${item.badgeColor}22`, color: item.badgeColor }}>{item.badge}</span>
              )}
              {item.badgeText && (
                <span style={{ marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 6, fontFamily: "'DM Mono', monospace", fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.28)" }}>{item.badgeText}</span>
              )}
              {isActive && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 2.5, background: LIME, borderRadius: "0 2px 2px 0" }} />}
            </div>
            );
          })}

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

          {/* Header — saudacao + pendencias na mesma linha */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, minHeight: 56 }}>
            {/* Esquerda: saudacao */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.04em", lineHeight: 1 }}>
                {(() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })()}, {user?.email?.split("@")[0] || "Consultor"}.
              </div>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", letterSpacing: "0.08em", marginTop: 4 }}>
                {"// "}{format(new Date(), "EEE", { locale: ptBR }).toUpperCase()}{" - "}{format(new Date(), "dd MMM yyyy", { locale: ptBR }).toUpperCase()}{" - "}{vgAgendasConfirmadas > 0 ? <span style={{ color: GREEN, fontWeight: 700 }}>{vgAgendasConfirmadas} agenda{vgAgendasConfirmadas !== 1 ? "s" : ""} no mes</span> : "nenhuma agenda confirmada"}
              </div>
            </div>
            {/* Divisor vertical */}
            {totalPendencias > 0 && <div style={{ width: 0.5, alignSelf: "stretch", background: "rgba(0,0,0,0.08)", flexShrink: 0 }} />}
            {/* Direita: pendencias inline */}
            {totalPendencias > 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(245,166,35,0.05)", border: "0.5px solid rgba(245,166,35,0.2)", borderRadius: 9, padding: "8px 12px", minWidth: 0 }}>
                <AlertCircle size={14} style={{ color: "#92400E", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>{totalPendencias} pendencia{totalPendencias !== 1 ? "s" : ""} ativa{totalPendencias !== 1 ? "s" : ""}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 3 }}>
                    {pendencias.slice(0, 2).map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,166,35,0.1)", border: "0.5px solid rgba(245,166,35,0.2)", borderRadius: 5, padding: "2px 7px", fontSize: 9, color: "#92400E", whiteSpace: "nowrap" }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: p.tipo === "doc_pendente" ? RED : AMBER, flexShrink: 0 }} />
                        {p.titulo} - {p.cliente}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setPendenciasModalOpen(true)} style={{ fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#92400E", background: "rgba(245,166,35,0.15)", border: "0.5px solid rgba(245,166,35,0.3)", borderRadius: 5, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  Ver todas +
                </button>
              </div>
            )}
          </div>

          {/* FAIXA KPI — 3 blocos numa linha */}
          <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 10, overflow: "hidden", display: "grid", gridTemplateColumns: "22% 42% 36%" }}>

            {/* BLOCO 1: 3 KPIs empilhados */}
            <div style={{ display: "flex", flexDirection: "column", borderRight: "0.5px solid rgba(0,0,0,0.07)" }}>
              {[
                { label: "Agendas",        value: vgAgendasConfirmadas, sub: "confirmadas mai",  accent: BLUE  },
                { label: "Disponibilidade", value: vgDiasLivres,        sub: "dias livres",       accent: GREEN },
                { label: "Projetos",        value: vgProjetos,           sub: "ativos",            accent: AMBER },
              ].map((kpi, i) => (
                <div key={kpi.label} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderBottom: i < 2 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                  <div style={{ width: 2.5, height: 22, borderRadius: 2, background: kpi.accent, flexShrink: 0 }} />
                  <div style={{ fontSize: 22, fontWeight: 800, color: kpi.accent, lineHeight: 1, letterSpacing: "-0.03em", minWidth: 32 }}>{kpi.value}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
                    <div style={{ fontSize: 8, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{kpi.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* BLOCO 2: Controle de horas + semanas */}
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6, borderRight: "0.5px solid rgba(0,0,0,0.07)" }}>
              {/* Header: titulo + numeros + cobertura */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 8, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em" }}>Controle de Horas — {format(currentMonth, "MMMM", { locale: ptBR })}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: "#111827" }}>{tsAgendadas}</div>
                      <div style={{ fontSize: 7, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", textTransform: "uppercase", marginTop: 1 }}>agend.</div>
                    </div>
                    <div style={{ width: 0.5, height: 24, background: "rgba(0,0,0,0.07)" }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: GREEN }}>{tsApontadas}</div>
                      <div style={{ fontSize: 7, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", textTransform: "uppercase", marginTop: 1 }}>apoint.</div>
                    </div>
                  </div>
                  {/* Cobertura destacada */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, background: coberturaPercent >= 80 ? "rgba(5,150,105,0.08)" : coberturaPercent >= 50 ? "rgba(245,166,35,0.08)" : "rgba(226,75,74,0.08)", border: `0.5px solid ${coberturaPercent >= 80 ? "rgba(5,150,105,0.2)" : coberturaPercent >= 50 ? "rgba(245,166,35,0.2)" : "rgba(226,75,74,0.2)"}`, borderRadius: 6, padding: "3px 9px" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: coberturaColor }}>{coberturaPercent}%</div>
                    <div style={{ fontSize: 7, fontFamily: "'DM Mono', monospace", color: coberturaColor, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em" }}>cobertura</div>
                  </div>
                </div>
              </div>
              {/* Barras semanais como colunas verticais */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${tsSemanas.length}, 1fr)`, gap: 5, alignItems: "end" }}>
                {tsSemanas.map(s => {
                  const pct = s.agendadas === 0 ? 0 : Math.round((s.apontadas / s.agendadas) * 100);
                  const maxSemana = Math.max(...tsSemanas.map(x => x.agendadas), 1);
                  const barH = s.agendadas === 0 ? 0 : Math.max(10, Math.round((s.agendadas / maxSemana) * 100));
                  const barColor = pct >= 80 ? GREEN : pct >= 50 ? AMBER : s.agendadas === 0 ? "#E5E7EB" : RED;
                  const fillH   = s.agendadas === 0 ? 0 : Math.round((s.apontadas / s.agendadas) * barH);
                  return (
                    <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div style={{ fontSize: 7, fontFamily: "'DM Mono', monospace", color: pct > 0 ? barColor : "#9CA3AF", fontWeight: pct > 0 ? 600 : 400 }}>{s.apontadas}/{s.agendadas}</div>
                      <div style={{ width: "100%", height: 28, background: "#F3F4F6", borderRadius: 3, overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
                        <div style={{ width: "100%", height: `${fillH}%`, background: barColor, borderRadius: 3, minHeight: fillH > 0 ? 3 : 0 }} />
                      </div>
                      <div style={{ fontSize: 7, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", letterSpacing: "0.04em" }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BLOCO 3: Proximos KPIs */}
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em" }}>Proximos KPIs</span>
                <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", background: "#F3F4F6", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 4, padding: "1px 6px" }}>em definicao</span>
              </div>
              {[
                { label: "Health Score",        dot: BLUE  },
                { label: "SLA de Atendimento",  dot: GREEN },
                { label: "Desvio de Prazo",     dot: AMBER },
                { label: "Satisfacao do Cliente", dot: RED },
              ].map((item, i) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 3 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: item.dot, flexShrink: 0, opacity: 0.5 }} />
                  <span style={{ fontSize: 10, color: "#6B7280", flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "#9CA3AF", background: "#F9FAFB", borderRadius: 3, padding: "1px 5px", opacity: 0.7 }}>breve</span>
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
                    : projetoSelecionado && !selectedClienteId
                      ? <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(59,130,246,0.1)", color: BLUE, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(59,130,246,0.25)", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{projetoSelecionado.nome_cliente}</span>
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
                            fontSize: 11,
                            color: isSel && !todayDay ? GREEN : todayDay ? LIME : "#4B5563",
                            borderRadius: 5, cursor: "pointer",
                            border: todayDay ? `2px solid ${LIME}` : diasDoProjeto?.has(dateStr) ? "0.5px solid rgba(59,130,246,0.35)" : "none",
                            display: "flex", flexDirection: "column", alignItems: "center",
                            padding: "4px 1px 3px", gap: 2,
                            background: isSel && !todayDay ? "rgba(57,255,135,0.1)" : diasDoProjeto?.has(dateStr) ? "rgba(59,130,246,0.07)" : "transparent",
                            fontWeight: todayDay || isSel || diasDoProjeto?.has(dateStr) ? 700 : 400,
                            opacity: diasDoProjeto && !diasDoProjeto.has(dateStr) && !!status ? 0.4 : 1,
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
                  <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Card projeto em foco via busca — visual neutro/azul, diferente do verde de agenda ativa */}
                    {projetoSelecionado ? (
                      <div style={{ background: "rgba(59,130,246,0.04)", borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(59,130,246,0.15)", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{projetoSelecionado.nome_cliente}</div>
                            <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>projeto em foco</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            {(projetoSelecionado as any)?.monday_board_url ? (
                              <a href={(projetoSelecionado as any).monday_board_url} target="_blank" rel="noopener noreferrer" title="Abrir board no Monday"
                                style={{ width: 24, height: 24, borderRadius: 5, background: "#fff", borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(254,100,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, textDecoration: "none" }}>
                                <svg width="13" height="13" viewBox="0 0 32 32" fill="none"><circle cx="7" cy="22" r="5" fill="#FF3D57"/><circle cx="16" cy="22" r="5" fill="#FFCB00"/><circle cx="25" cy="22" r="5" fill="#00CA72"/><path d="M7 17c0-5 3-13 5-13s5 8 5 13" stroke="#FF3D57" strokeWidth="3" strokeLinecap="round" fill="none"/><path d="M16 17c0-5 3-13 5-13s5 8 5 13" stroke="#FFCB00" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
                              </a>
                            ) : (
                              <div style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(0,0,0,0.02)", borderWidth: "0.5px", borderStyle: "dashed", borderColor: "rgba(0,0,0,0.08)", flexShrink: 0, opacity: 0.4 }} />
                            )}
                            <div style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(0,0,0,0.02)", borderWidth: "0.5px", borderStyle: "dashed", borderColor: "rgba(0,0,0,0.08)", flexShrink: 0 }} />
                          </div>
                        </div>
                        {/* Hint calendário */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", background: "rgba(59,130,246,0.06)", borderRadius: 6, borderWidth: "0.5px", borderStyle: "dashed", borderColor: "rgba(59,130,246,0.2)" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span style={{ fontSize: 9, color: "#3B82F6", fontFamily: "'DM Mono', monospace" }}>Selecione uma data no calendario para registrar</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "10px 0", fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em" }}>
                        Selecione uma agenda no calendario
                      </div>
                    )}
                    <button onClick={() => { if (selectedDate) setReqData(selectedDate); if (projetoSelecionado) setReqCliente(projetoSelecionado.nome_cliente); setReqOpen(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.03)", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8" }}>Requisitar Agenda</div>
                        <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 1 }}>Solicitar nova data ou atividade</div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ margin: "10px 12px 0", background: "rgba(57,255,135,0.04)", border: "0.5px solid rgba(57,255,135,0.15)", borderRadius: 8, padding: "9px 11px" }}>
                      {/* Linha superior: info do projeto */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedAgenda.cliente}</div>
                          <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginTop: 2, letterSpacing: "0.04em" }}>
                            {format(parseISO(selectedAgenda.data), "dd/MM/yyyy")} - {selectedAgenda.atividade} - {getAgendaStatusDisplay(selectedAgenda).label}
                          </div>
                        </div>
                        {/* Barra de integrações: Monday + 2 slots futuros */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          {/* Monday — aparece só se tiver board_url */}
                          {(projetoSelecionado as any)?.monday_board_url ? (
                            <a href={(projetoSelecionado as any).monday_board_url} target="_blank" rel="noopener noreferrer"
                              title="Abrir board no Monday"
                              style={{ width: 28, height: 28, borderRadius: 6, background: "#fff", borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(254,100,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, textDecoration: "none" }}>
                              <svg width="15" height="15" viewBox="0 0 32 32" fill="none"><circle cx="7" cy="22" r="5" fill="#FF3D57"/><circle cx="16" cy="22" r="5" fill="#FFCB00"/><circle cx="25" cy="22" r="5" fill="#00CA72"/><path d="M7 17c0-5 3-13 5-13s5 8 5 13" stroke="#FF3D57" strokeWidth="3" strokeLinecap="round" fill="none"/><path d="M16 17c0-5 3-13 5-13s5 8 5 13" stroke="#FFCB00" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
                            </a>
                          ) : (
                            <div title="Monday nao configurado"
                              style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(0,0,0,0.02)", borderWidth: "0.5px", borderStyle: "dashed", borderColor: "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.4 }}>
                              <svg width="15" height="15" viewBox="0 0 32 32" fill="none"><circle cx="7" cy="22" r="5" fill="#ccc"/><circle cx="16" cy="22" r="5" fill="#ccc"/><circle cx="25" cy="22" r="5" fill="#ccc"/><path d="M7 17c0-5 3-13 5-13s5 8 5 13" stroke="#ccc" strokeWidth="3" strokeLinecap="round" fill="none"/><path d="M16 17c0-5 3-13 5-13s5 8 5 13" stroke="#ccc" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
                            </div>
                          )}
                          {/* Slot 2 — futuro */}
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(0,0,0,0.02)", borderWidth: "0.5px", borderStyle: "dashed", borderColor: "rgba(0,0,0,0.08)", flexShrink: 0 }} />
                          {/* Slot 3 — futuro */}
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(0,0,0,0.02)", borderWidth: "0.5px", borderStyle: "dashed", borderColor: "rgba(0,0,0,0.08)", flexShrink: 0 }} />
                        </div>
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
                      <button onClick={() => { if (selectedDate) setReqData(selectedDate); if (selectedAgenda) setReqCliente(selectedAgenda.cliente); setReqOpen(true); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.03)", textAlign: "left", width: "100%" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#EFF6FF", color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</div>
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
                      {/* Doc Upload — exibir quando agenda tem doc exigido nao satisfeito */}
                      {cronogramaItemDoc?.doc_exigido && !cronogramaItemDoc.doc_satisfeito && (
                        <div style={{ borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.05)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#D97706", display: "flex", alignItems: "center", gap: 5 }}>
                            <FileStack className="h-3.5 w-3.5" />
                            Doc. exigido: {cronogramaItemDoc.codigo}
                          </div>
                          <div style={{ fontSize: 10, color: "#9CA3AF" }}>{cronogramaItemDoc.descricao}</div>
                          <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="text-xs h-7"
                            onChange={e => setDocFile(e.target.files?.[0] || null)} />
                          {docFile && (
                            <button onClick={handleUploadDoc} disabled={docUploading}
                              style={{ height: 30, borderRadius: 7, border: "none", background: "#D97706", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                              {docUploading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <><FileStack className="h-3 w-3" /> Enviar documento</>}
                            </button>
                          )}
                        </div>
                      )}

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

                {/* DIARIO -- BL-CONS-001-F2 */}
                {ctxTab === "diario" && (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>

                    {/* Formulario nova entrada */}
                    {diarioFormOpen ? (
                      <div style={{ background: "rgba(57,255,135,0.04)", border: "0.5px solid rgba(57,255,135,0.2)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <MencaoAutocomplete
                          value={diarioObs}
                          onChange={(t, m, tgs, crit) => { setDiarioObs(t); setDiarioMencionados(m); setDiarioTags(tgs || []); setDiarioCriticidade(crit || null); }}
                          projetoId={projetoSelecionado?.id || ""}
                          currentUserId={user?.id}
                          rows={3}
                          placeholder="Registre uma decisao, ocorrencia ou marco..."
                          disabled={diarioSaving}
                        />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <select
                            value={diarioCategoria}
                            onChange={e => setDiarioCategoria(e.target.value as any)}
                            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: "#374151", height: 28 }}
                          >
                            <option value="geral">Geral</option>
                            <option value="decisao">Decisao</option>
                            <option value="ocorrencia">Ocorrencia</option>
                            <option value="marco">Marco</option>
                            <option value="alerta">Alerta</option>
                          </select>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => { setDiarioFormOpen(false); setDiarioObs(""); setDiarioMencionados([]); setDiarioCategoria("geral"); }}
                              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "0.5px solid rgba(0,0,0,0.15)", background: "transparent", color: "#6B7280", cursor: "pointer" }}
                            >
                              Cancelar
                            </button>
                            <button
                              disabled={diarioSaving || !diarioObs.trim()}
                              onClick={async () => {
                                if (!projetoSelecionado || !diarioObs.trim()) return;
                                const ok = await insertEntrada({
                                  projeto_id: projetoSelecionado.id,
                                  texto: diarioObs.trim(),
                                  categoria: diarioCategoria,
                                  origem: "consultor",
                                  mencionados: diarioMencionados,
                                  tags: diarioTags,
                                  criticidade: diarioCriticidade,
                                });
                                if (ok) { setDiarioFormOpen(false); setDiarioObs(""); setDiarioMencionados([]); setDiarioTags([]); setDiarioCriticidade(null); setDiarioCategoria("geral"); }
                              }}
                              style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", background: "#0B1628", color: "#39FF87", cursor: "pointer", opacity: diarioSaving || !diarioObs.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: 4 }}
                            >
                              {diarioSaving ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : null}
                              Registrar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setDiarioFormOpen(true); if (projetoSelecionado) loadUsuariosMencionaveis(projetoSelecionado.id); }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "7px 0", fontSize: 11, color: "#39FF87", background: "rgba(57,255,135,0.06)", border: "0.5px dashed rgba(57,255,135,0.3)", borderRadius: 7, cursor: "pointer" }}
                      >
                        + Nova entrada do dia
                      </button>
                    )}

                    {/* Feed de entradas */}
                    {diarioLoading ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
                        <Loader2 size={20} style={{ color: "#9CA3AF", animation: "spin 1s linear infinite" }} />
                      </div>
                    ) : diarioEntradas.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 24, color: "#9CA3AF", fontSize: 11 }}>Nenhuma entrada ainda</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {diarioEntradas.slice(0, 5).map(e => {
                          const temMencaoPendente = e.tem_mencao && (e.mencoes_detalhes || []).some(m => m.status !== "resolvido");
                          return (
                            <div key={e.id} style={{ padding: "9px 10px", borderRadius: 8, border: temMencaoPendente ? "1.5px solid #FCA5A5" : "0.5px solid rgba(0,0,0,0.08)", borderLeft: temMencaoPendente ? "3px solid #EF4444" : undefined, background: temMencaoPendente ? "#FFF5F5" : "#FAFAFA" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#9CA3AF" }}>
                                  {format(parseISO(e.data), "dd MMM", { locale: ptBR })} - {e.autor_nome || e.origem}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {temMencaoPendente && (
                                    <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontFamily: "'DM Mono', monospace" }}>@ pendente</span>
                                  )}
                                  <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, fontFamily: "'DM Mono', monospace", background: "#F3F4F6", color: "#6B7280" }}>{e.categoria}</span>
                                </div>
                              </div>
                              <div style={{ fontSize: 11, color: "#4B5563", lineHeight: 1.55, marginBottom: (e.mencoes_detalhes || []).length > 0 || (e.replies || []).length > 0 ? 6 : 0 }}>{renderTextoComChips(e.texto)}</div>

                              {/* Mencoes */}
                              {(e.mencoes_detalhes || []).length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 6, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                                  {(e.mencoes_detalhes || []).map(men => {
                                    const euFuiMencionado = men.mencionado_id === user?.id;
                                    const agedorId = men.resolvido_por || men.mencionado_id;
                                    const fmtTs = (ts: string | null) => !ts ? "" : new Date(ts).toLocaleString("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
                                    return (
                                      <div key={men.id} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                                        {/* chip cinza contexto -- so quando pendente ou ciente */}
                                        {(men.status === "pendente" || men.status === "ciente") && (
                                          <div style={{ display:"flex", justifyContent:"flex-start" }}>
                                            <span style={{ background:"rgba(0,0,0,0.04)", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:"0 7px 7px 7px", padding:"2px 8px", fontSize:9, color:"#9CA3AF" }}>
                                              @{men.mencionado_nome || "usuario"} - {euFuiMencionado ? "voce foi mencionado" : "mencionou"}
                                            </span>
                                          </div>
                                        )}
                                        {/* PENDENTE: botoes esquerda */}
                                        {men.status === "pendente" && (
                                          <div style={{ display:"flex", justifyContent:"flex-start", gap:6 }}>
                                            {euFuiMencionado && <button onClick={() => marcarCiente(men.id)} style={{ fontSize:9, padding:"2px 8px", borderRadius:4, border:"0.5px solid #FCD34D", background:"#FFFBEB", color:"#92400E", cursor:"pointer" }}>Ciente</button>}
                                            {euFuiMencionado && <button onClick={() => marcarResolvido(men.id, e.id)} style={{ fontSize:9, padding:"2px 8px", borderRadius:4, border:"0.5px solid #6EE7B7", background:"#F0FDF4", color:"#065F46", cursor:"pointer" }}>Resolver</button>}
                                          </div>
                                        )}
                                        {/* CIENTE: badge lado do agedor + Resolver direita (minha acao) */}
                                        {men.status === "ciente" && (
                                          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                                            <div style={{ display:"flex", justifyContent: euFuiMencionado ? "flex-start" : "flex-end" }}>
                                              <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:9, color:"#b45309", fontWeight:600, padding:"2px 8px", borderRadius: euFuiMencionado ? "0 12px 12px 12px" : "12px 12px 0 12px", background:"#FFFBEB", border:"0.5px solid #FDE68A" }}>Ciente<span style={{ fontSize:8, color:"#9CA3AF", marginLeft:3 }}>{fmtTs(men.ciente_em)}</span></span>
                                            </div>
                                            {euFuiMencionado && (
                                              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                                                <button onClick={() => marcarResolvido(men.id, e.id)} style={{ fontSize:9, padding:"3px 10px", borderRadius:"12px 12px 0 12px", border:"1px solid #059669", background:"#ffffff", color:"#059669", cursor:"pointer", fontWeight:600 }}>Resolver</button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {/* RESOLVIDO: sem chip contexto, badge lado do agedor */}
                                        {men.status === "resolvido" && (
                                          <div style={{ display:"flex", justifyContent: agedorId === user?.id ? "flex-end" : "flex-start" }}>
                                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:9, color:"#059669", fontWeight:600, padding:"2px 8px", borderRadius: agedorId === user?.id ? "12px 12px 0 12px" : "0 12px 12px 12px", background:"#F0FDF4", border:"0.5px solid #BBF7D0" }}>Resolvido<span style={{ fontSize:8, color:"#9CA3AF", marginLeft:3 }}>{fmtTs(men.resolvido_em)}</span></span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Replies */}
                              {(e.replies || []).length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {(e.replies || []).map(r => (
                                    <div key={r.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                                      <div style={{ maxWidth: "65%", background: "#F0FDF4", border: "0.5px solid #BBF7D0", borderRadius: "12px 12px 0 12px", padding: "7px 11px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                          <span style={{ fontSize: 9, color: "#059669", fontWeight: 500 }}>{r.autor_nome || r.origem}</span>
                                          <span style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{r.data}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>{renderTextoComChips(r.texto)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Botao responder -- so quando mencao pendente ou ciente */}
                              {(e.mencoes_detalhes || []).some(mn => mn.status === "pendente" || mn.status === "ciente") && (
                                diarioReplyId === e.id ? (
                                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                                    <MencaoAutocomplete
                                      value={diarioReplyTexto}
                                      onChange={(t, m) => { setDiarioReplyTexto(t); setDiarioReplyMencionados(m); }}
                                      projetoId={projetoSelecionado?.id || ""}
                                      currentUserId={user?.id}
                                      rows={2}
                                      placeholder="Sua resposta..."
                                      disabled={diarioSaving}
                                    />
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                      <button onClick={() => { setDiarioReplyId(null); setDiarioReplyTexto(""); }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "0.5px solid rgba(0,0,0,0.15)", background: "transparent", color: "#6B7280", cursor: "pointer" }}>Cancelar</button>
                                      <button disabled={diarioSaving || !diarioReplyTexto.trim()} onClick={async () => { if (!projetoSelecionado) return; const ok = await insertReply({ projeto_id: projetoSelecionado.id, entrada_id: e.id, texto: diarioReplyTexto, origem: "consultor", mencionados: diarioReplyMencionados, tags: diarioReplyTags }); if (ok) { setDiarioReplyId(null); setDiarioReplyTexto(""); setDiarioReplyMencionados([]); setDiarioReplyTags([]); } }} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "none", background: "#0B1628", color: "#39FF87", cursor: "pointer", opacity: diarioSaving || !diarioReplyTexto.trim() ? 0.5 : 1 }}>Responder</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => { setDiarioReplyId(e.id); if (projetoSelecionado) loadUsuariosMencionaveis(projetoSelecionado.id); }} style={{ marginTop: 2, fontSize: 9, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Responder</button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
        .modal-navy-header { background:#0B1628; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; border-radius:8px 8px 0 0; }
        .modal-navy-title { font-size:15px; font-weight:600; color:#fff; letter-spacing:-0.01em; }
        .modal-navy-meta { font-size:10px; color:rgba(57,255,135,0.65); font-family:'DM Mono',monospace; margin-top:3px; letter-spacing:0.04em; }
        .modal-navy-close { width:28px; height:28px; border-radius:6px; background:rgba(255,255,255,0.08); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.5); flex-shrink:0; transition:background 0.15s; }
        .modal-navy-close:hover { background:rgba(255,255,255,0.15); color:#fff; }
        .modal-body-padded { padding:18px 20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; flex:1; }
        .modal-field-label { font-size:9px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:5px; }
        .modal-footer-navy { padding:14px 20px; border-top:0.5px solid rgba(0,0,0,0.07); display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.015); border-radius:0 0 8px 8px; }
        .modal-footer-hint { font-size:9px; font-family:'DM Mono',monospace; color:#9CA3AF; display:flex; align-items:center; gap:4px; }
        .modal-btn-primary { height:34px; padding:0 18px; border-radius:8px; border:none; background:#0B1628; color:#39FF87; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; transition:opacity 0.15s; white-space:nowrap; }
        .modal-btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .modal-btn-primary:hover:not(:disabled) { opacity:0.85; }
        .modal-btn-secondary { height:34px; padding:0 16px; border-radius:8px; border:0.5px solid rgba(0,0,0,0.12); background:#fff; color:#4B5563; font-size:12px; cursor:pointer; transition:background 0.15s; }
        .modal-btn-secondary:hover { background:#F9FAFB; }
        .mod-tab-group { display:flex; background:#E2E4E8; border-radius:8px; padding:3px; gap:3px; }
        .mod-tab-btn { flex:1; height:30px; border-radius:6px; border:none; background:transparent; font-size:12px; font-family:'DM Mono',monospace; color:#1E3A5F; font-weight:500; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:5px; }
        .mod-tab-btn.active { background:#0B1628; color:#39FF87; font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,0.15); }
        .mod-tab-btn svg { flex-shrink:0; }
        .crono-field-wrap { display:flex; flex-direction:column; gap:3px; }
        .crono-field-lbl { font-size:9px; font-weight:500; color:#3B82F6; text-transform:uppercase; letter-spacing:0.1em; display:flex; align-items:center; gap:4px; }
        .crono-field-lbl span { color:#9CA3AF; font-weight:400; }
        .crono-sel { height:28px; border-radius:6px; font-size:11px; font-family:'DM Mono',monospace; display:flex; align-items:center; justify-content:space-between; padding:0 10px; cursor:pointer; }
        .crono-sel.empty { border:0.5px dashed rgba(59,130,246,0.3); background:rgba(59,130,246,0.03); color:#9CA3AF; }
        .crono-sel.filled { border:0.5px solid rgba(59,130,246,0.3); background:rgba(59,130,246,0.06); color:#1D4ED8; }
        .atv-tab-group { display:flex; align-items:center; border-bottom:0.5px solid rgba(0,0,0,0.08); margin-bottom:8px; }
        .atv-tab-btn { height:26px; padding:0 10px; font-size:10px; font-family:'DM Mono',monospace; background:transparent; border:none; color:#9CA3AF; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-0.5px; display:flex; align-items:center; gap:4px; transition:all 0.12s; }
        .atv-tab-btn.active { color:#0B1628; border-bottom-color:#39FF87; font-weight:500; }
        .atv-tab-btn.add { color:#059669; margin-left:auto; border-bottom:none; }
        .atv-card-navy { border:0.5px solid rgba(0,0,0,0.07); border-radius:8px; padding:12px; background:#F9FAFB; display:flex; flex-direction:column; gap:8px; }
        .atv-card-navy:focus-within { border-color:rgba(57,255,135,0.35); background:rgba(57,255,135,0.02); }
        .atv-progress { height:3px; background:#E5E7EB; border-radius:2px; overflow:hidden; margin-top:2px; }
        .atv-progress-fill { height:100%; background:#39FF87; border-radius:2px; transition:width 0.3s; }
        .atv-info-badge { display:inline-flex; align-items:center; gap:4px; font-size:9px; font-family:'DM Mono',monospace; color:#059669; background:rgba(5,150,105,0.08); border:0.5px solid rgba(5,150,105,0.2); border-radius:4px; padding:1px 6px; }
        .add-atv-btn { width:100%; height:32px; border:0.5px dashed rgba(57,255,135,0.35); border-radius:8px; background:rgba(57,255,135,0.02); color:#059669; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; transition:all 0.15s; }
        .add-atv-btn:hover { background:rgba(57,255,135,0.05); border-color:rgba(57,255,135,0.5); }
        .diario-section-navy { border:0.5px dashed rgba(0,0,0,0.1); border-radius:8px; padding:10px 12px; background:#FAFAFA; }
        .modal-divider { height:0.5px; background:rgba(0,0,0,0.06); margin:0 -1px; }
        .resumo-info-card { background:#F8FAFC; border:0.5px solid rgba(0,0,0,0.07); border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:4px; }
        .resumo-atv-row { border:0.5px solid rgba(0,0,0,0.07); border-radius:8px; padding:10px 12px; }
        [data-radix-dialog-content] { padding:0 !important; overflow:hidden; }
        [data-radix-dialog-content] > div[role="dialog"] { padding:0 !important; }
        .modal-body-padded::-webkit-scrollbar { width:4px; }
        .modal-body-padded::-webkit-scrollbar-track { background:transparent; }
        .modal-body-padded::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:2px; }
        .modal-body-padded::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,0.22); }
        .scrollbar-hide::-webkit-scrollbar { display:none !important; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
        [role="dialog"] > button[aria-label="Close"] { display:none !important; }
        [role="dialog"] > button:has(svg.lucide-x) { display:none !important; }
        .desc-os-section { border:0.5px solid rgba(0,0,0,0.08); border-radius:8px; overflow:hidden; }
        .desc-os-header { background:#F9FAFB; padding:8px 12px; font-size:9px; font-weight:600; color:#6B7280; text-transform:uppercase; letter-spacing:0.1em; border-bottom:0.5px solid rgba(0,0,0,0.06); display:flex; align-items:center; gap:5px; }
        .desc-os-body { padding:8px 12px; }

      `}</style>
    </div>
  );

  // ── renderDialogs: todos os modais do original portados ────────────────────
  function renderDialogs() {
    return (
      <>
        {/* Modal Meu Backlog -- BL-CONS-001 */}
        <BacklogConsultorModal
          open={backlogModalOpen}
          onClose={() => { setBacklogModalOpen(false); setNavAtiva("Dashboard"); }}
          userId={user?.id}
          onOpenRequisicao={(cliente, _projetoId) => {
            setBacklogModalOpen(false);
            if (cliente) setReqCliente(cliente);
            setReqOpen(true);
          }}
          onOpenUpload={(agendaId, _itemCronograma) => {
            setBacklogModalOpen(false);
            const agenda = agendas.find(a => a.id === agendaId);
            if (agenda) handleSelectAgenda(agenda);
          }}
        />

        {/* Modal Requisições — historico e acompanhamento */}
        <Dialog open={reqModalOpen} onOpenChange={v => { setReqModalOpen(v); if (!v) setNavAtiva("Dashboard"); }}>
          <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Minhas Requisicoes</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Minhas Requisicoes</div>
                <div className="modal-navy-meta">Acompanhamento de solicitacoes e cancelamentos</div>
              </div>
              <button className="modal-navy-close" onClick={() => { setReqModalOpen(false); setNavAtiva("Dashboard"); }} aria-label="Fechar"><XCircle className="h-4 w-4" /></button>
            </div>
            {/* Abas */}
            <div style={{ display: "flex", borderBottom: "0.5px solid rgba(0,0,0,0.07)", background: "rgba(0,0,0,0.01)" }}>
              {([
                { id: "pendentes",      label: "Novas Agendas",  count: reqHistorico.filter(r => r._tipo === "requisicao" && r.status === "pendente").length },
                { id: "cancelamentos",  label: "Cancelamentos",  count: reqHistorico.filter(r => r._tipo === "cancelamento").length },
                { id: "aprovacoes",     label: "Aprovacoes",     count: reqHistorico.filter(r => r._tipo === "requisicao" && ["aprovada","recusada"].includes(r.status)).length },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setReqModalTab(tab.id)}
                  style={{ flex: 1, height: 36, background: "transparent", borderWidth: "0 0 2px 0", borderStyle: "solid", borderColor: reqModalTab === tab.id ? "#0B1628" : "transparent", fontSize: 11, fontWeight: reqModalTab === tab.id ? 600 : 400, color: reqModalTab === tab.id ? "#111827" : "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
                  {tab.label}
                  {tab.count > 0 && <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", background: reqModalTab === tab.id ? "#0B1628" : "#F3F4F6", color: reqModalTab === tab.id ? "#39FF87" : "#6B7280", borderRadius: 10, padding: "1px 6px", fontWeight: 600 }}>{tab.count}</span>}
                </button>
              ))}
            </div>
            {/* Conteúdo */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {reqHistLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, gap: 8 }}>
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#9CA3AF" }} />
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>Carregando...</span>
                </div>
              ) : (
                <>
                  {/* ABA: Novas Agendas (pendentes) */}
                  {reqModalTab === "pendentes" && (() => {
                    const items = reqHistorico.filter(r => r._tipo === "requisicao" && r.status === "pendente");
                    return items.length === 0
                      ? <div style={{ textAlign: "center", padding: 32, fontSize: 12, color: "#9CA3AF" }}>Nenhuma requisicao pendente</div>
                      : items.map(r => (
                        <div key={r.id} style={{ padding: "10px 12px", borderRadius: 8, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(245,166,35,0.25)", background: "rgba(245,166,35,0.04)", display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{r.cliente}</div>
                            <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#D97706", background: "rgba(245,166,35,0.1)", border: "0.5px solid rgba(245,166,35,0.3)", borderRadius: 4, padding: "2px 7px" }}>Aguardando aprovacao</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#6B7280", display: "flex", gap: 12, fontFamily: "'DM Mono', monospace" }}>
                            <span>{r.data ? format(parseISO(r.data), "dd/MM/yyyy") : "-"}</span>
                            <span>{r.atividade || "-"}</span>
                            <span>{r.total_horas ? `${r.total_horas}h` : ""}</span>
                            <span>{r.modalidade}</span>
                          </div>
                          {r.justificativa && <div style={{ fontSize: 10, color: "#9CA3AF", fontStyle: "italic" }}>{r.justificativa}</div>}
                        </div>
                      ));
                  })()}
                  {/* ABA: Cancelamentos aguardando */}
                  {reqModalTab === "cancelamentos" && (() => {
                    const items = reqHistorico.filter(r => r._tipo === "cancelamento");
                    return items.length === 0
                      ? <div style={{ textAlign: "center", padding: 32, fontSize: 12, color: "#9CA3AF" }}>Nenhum cancelamento pendente</div>
                      : items.map(r => (
                        <div key={r.id} style={{ padding: "10px 12px", borderRadius: 8, borderWidth: "0.5px", borderStyle: "solid", borderColor: "rgba(226,75,74,0.2)", background: "rgba(226,75,74,0.04)", display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{r.cliente}</div>
                            <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#E24B4A", background: "rgba(226,75,74,0.08)", border: "0.5px solid rgba(226,75,74,0.2)", borderRadius: 4, padding: "2px 7px" }}>Aguardando cancelamento</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>
                            {r.data ? format(parseISO(r.data), "dd/MM/yyyy") : "-"} - {r.atividade || "-"}
                          </div>
                        </div>
                      ));
                  })()}
                  {/* ABA: Aprovacoes (aprovadas/recusadas) */}
                  {reqModalTab === "aprovacoes" && (() => {
                    const items = reqHistorico.filter(r => r._tipo === "requisicao" && ["aprovada","recusada"].includes(r.status));
                    return items.length === 0
                      ? <div style={{ textAlign: "center", padding: 32, fontSize: 12, color: "#9CA3AF" }}>Nenhuma aprovacao nos ultimos 30 dias</div>
                      : items.map(r => (
                        <div key={r.id} style={{ padding: "10px 12px", borderRadius: 8, borderWidth: "0.5px", borderStyle: "solid", borderColor: r.status === "aprovada" ? "rgba(5,150,105,0.2)" : "rgba(226,75,74,0.2)", background: r.status === "aprovada" ? "rgba(5,150,105,0.04)" : "rgba(226,75,74,0.04)", display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{r.cliente}</div>
                            <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: r.status === "aprovada" ? GREEN : RED, background: r.status === "aprovada" ? "rgba(5,150,105,0.08)" : "rgba(226,75,74,0.08)", border: `0.5px solid ${r.status === "aprovada" ? "rgba(5,150,105,0.2)" : "rgba(226,75,74,0.2)"}`, borderRadius: 4, padding: "2px 7px", textTransform: "capitalize" }}>{r.status}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>
                            {r.data ? format(parseISO(r.data), "dd/MM/yyyy") : "-"} - {r.atividade || "-"}
                          </div>
                        </div>
                      ));
                  })()}
                </>
              )}
            </div>
            <div className="modal-footer-navy">
              <span className="modal-footer-hint"><CalendarDays className="h-3 w-3" /> Ultimos 30 dias + pendentes</span>
              <button className="modal-btn-secondary" onClick={() => { setReqModalOpen(false); setNavAtiva("Dashboard"); }}>Fechar</button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Pendências — todas as pendências */}
        <Dialog open={pendenciasModalOpen} onOpenChange={setPendenciasModalOpen}>
          <DialogContent className="max-w-lg max-h-[80dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Todas as Pendencias</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Pendencias Ativas</div>
                <div className="modal-navy-meta">{totalPendencias} pendencia{totalPendencias !== 1 ? "s" : ""} - todos os projetos</div>
              </div>
              <button className="modal-navy-close" onClick={() => { setPendenciasModalOpen(false); setNavAtiva("Dashboard"); }} aria-label="Fechar"><XCircle className="h-4 w-4" /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {pendencias.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, fontSize: 12, color: "#9CA3AF" }}>Nenhuma pendencia ativa</div>
              ) : (
                pendencias.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, borderWidth: "0.5px", borderStyle: "solid", borderColor: p.tipo === "doc_pendente" ? "rgba(226,75,74,0.2)" : "rgba(245,166,35,0.2)", background: p.tipo === "doc_pendente" ? "rgba(226,75,74,0.04)" : "rgba(245,166,35,0.04)" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.tipo === "doc_pendente" ? RED : AMBER, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{p.titulo}</div>
                      <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                        {p.cliente}{p.data ? " - " + format(parseISO(p.data), "dd/MM/yyyy") : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: p.tipo === "doc_pendente" ? RED : "#D97706", background: p.tipo === "doc_pendente" ? "rgba(226,75,74,0.08)" : "rgba(245,166,35,0.1)", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>
                      {p.tipo === "doc_pendente" ? "Doc pendente" : p.tipo === "apontamento_atrasado" ? "Apontamento" : p.tipo === "requisicao_pendente" ? "Requisicao" : "Backlog"}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer-navy">
              <span className="modal-footer-hint"><AlertCircle className="h-3 w-3" /> Pendencias de todos os projetos</span>
              <button className="modal-btn-secondary" onClick={() => { setPendenciasModalOpen(false); setNavAtiva("Dashboard"); }}>Fechar</button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Apontamento — Conceito A navy */}
        <Dialog open={apontamentoOpen} onOpenChange={setApontamentoOpen}>
          <DialogContent className="max-w-xl max-h-[80dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            {/* Header navy */}
            <DialogTitle className="sr-only">Registrar Apontamento</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Registrar Apontamento</div>
                {selectedAgenda && (
                  <div className="modal-navy-meta">
                    {selectedAgenda.cliente} &nbsp;|&nbsp; {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")} &nbsp;|&nbsp; {selectedAgenda.status === "confirmada" ? "Confirmada" : selectedAgenda.status}
                  </div>
                )}
              </div>
              <button className="modal-navy-close" onClick={() => setApontamentoOpen(false)} aria-label="Fechar">
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            {/* Body — 2 colunas: esq atividades+abas | dir modalidade+obs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden", minHeight: 0 }}>

              {/* COLUNA ESQUERDA — Abas de atividade */}
              <div style={{ padding: "14px 14px 14px 20px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", borderRight: "0.5px solid rgba(0,0,0,0.07)" }}>

                <div className="modal-field-label" style={{ marginBottom: 0 }}>Atividades <span style={{ color: "#9CA3AF", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(max. 3)</span></div>

                {/* Abas de atividade */}
                <div className="atv-tab-group">
                  {atividadesApontadas.map((_, idx) => (
                    <button key={idx} className={"atv-tab-btn" + (atvTabAtiva === idx ? " active" : "")}
                      onClick={() => setAtvTabAtiva(idx)}>
                      Atv. {idx + 1}
                      {atividadesApontadas.length > 1 && atvTabAtiva === idx && (
                        <span onClick={e => { e.stopPropagation(); setAtividadesApontadas(prev => { const next = prev.filter((_, i) => i !== idx); setAtvTabAtiva(Math.max(0, idx - 1)); return next; }); }}
                          style={{ marginLeft: 3, color: "#E24B4A", lineHeight: 1, fontSize: 11 }}>x</span>
                      )}
                    </button>
                  ))}
                  {atividadesApontadas.length < 3 && (
                    <button className="atv-tab-btn add" onClick={() => { setAtividadesApontadas(prev => [...prev, { atividade_codigo: "", atividade_descricao: "", horas: 0, percentual_feeling: null }]); setAtvTabAtiva(atividadesApontadas.length); }}>
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Card da atividade ativa */}
                {atividadesApontadas[atvTabAtiva] !== undefined && (() => {
                  const aa  = atividadesApontadas[atvTabAtiva];
                  const idx = atvTabAtiva;
                  const atv = projetoAtividades.find(a => a.codigo === aa.atividade_codigo);
                  const pct = atv ? getPercentual(atv) : 0;
                  const cronoItens = atv ? (cronogramaItensPorAtividade[atv.id] || []) : [];
                  return (
                    <div style={{ border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "10px 12px", background: "#FAFAFA", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>Atividade {idx + 1}</span>
                        {atv && <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: "#059669", background: "rgba(5,150,105,0.07)", border: "0.5px solid rgba(5,150,105,0.18)", borderRadius: 4, padding: "1px 6px" }}>{getSaldo(atv)}h saldo</span>}
                      </div>
                      {/* Select atividade */}
                      <Select value={aa.atividade_codigo} onValueChange={val => {
                        const a = projetoAtividades.find(x => x.codigo === val);
                        if (!a) return;
                        setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, atividade_codigo: a.codigo, atividade_descricao: a.descricao, horas: 0, percentual_feeling: null, cronograma_item_id: undefined } : item));
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
                        <SelectContent>
                          {projetoAtividades.map(a => (
                            <SelectItem key={a.codigo} value={a.codigo} disabled={getSaldo(a) <= 0 && a.codigo !== aa.atividade_codigo}>
                              <span className="text-xs">{a.codigo} - {a.descricao} <span className="text-muted-foreground">({getSaldo(a)}h)</span></span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Barra progresso */}
                      {atv && <div style={{ height: 2, background: "#E5E7EB", borderRadius: 1, overflow: "hidden" }}><div style={{ height: "100%", background: "#39FF87", borderRadius: 1, width: `${Math.min(100, pct)}%` }} /></div>}
                      {/* Item cronograma — só aparece quando atividade selecionada */}
                      {atv && (
                        <div className="crono-field-wrap">
                          <div className="crono-field-lbl">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                            Item cronograma
                            <span>{cronoItens.length === 0 ? "— sem itens nesta atividade" : "— opcional"}</span>
                          </div>
                          {cronoItens.length > 0 && (
                            <Select value={(aa as any).cronograma_item_id || ""} onValueChange={val => setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, cronograma_item_id: val === "__none__" ? undefined : val } : item))}>
                              <SelectTrigger className={"h-7 text-xs " + ((aa as any).cronograma_item_id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-dashed")}><SelectValue placeholder="Selecionar item..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs text-muted-foreground">Nenhum</SelectItem>
                                {cronoItens.map((ci: any) => (
                                  <SelectItem key={ci.id} value={ci.id} className="text-xs">{ci.codigo} - {ci.descricao}{ci.doc_exigido ? " 📎" : ""}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                      {/* Horas + % */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Horas</div>
                          <Input type="number" min={0} step={0.5} value={aa.horas || ""}
                            onChange={e => setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, horas: Number(e.target.value) } : item))}
                            className="h-7 text-xs" />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>% Conclusao</div>
                          <Input type="number" min={0} max={100} value={aa.percentual_feeling ?? ""}
                            onChange={e => setAtividadesApontadas(prev => prev.map((item, i) => i === idx ? { ...item, percentual_feeling: Number(e.target.value) } : item))}
                            className="h-7 text-xs" placeholder="0-100" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* COLUNA DIREITA — Modalidade + Observacoes */}
              <div style={{ padding: "14px 20px 14px 14px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
                {/* Modalidade — Opção A: fundo cinza, inativo navy, ativo navy+lime */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Modalidade</div>
                  <div className="mod-tab-group">
                    {[
                      { id: "Remoto",     icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M10.83 16.1a6 6 0 0 1 2.41-.63 6 6 0 0 1 2.41.63"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> },
                      { id: "Presencial", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                    ].map(m => (
                      <button key={m.id} className={"mod-tab-btn" + (apontModalidade === m.id ? " active" : "")}
                        onClick={() => setApontModalidade(m.id)}>
                        {m.icon}{m.id}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ height: "0.5px", background: "rgba(0,0,0,0.06)" }} />
                {/* Descricao OS */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText className="h-3 w-3" /> Descricao para a OS
                  </div>
                  <Textarea value={apontDescricao} onChange={e => setApontDescricao(e.target.value)}
                    style={{ fontSize: 12, minHeight: 72, resize: "none", width: "100%", borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.1)", padding: "8px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#374151" }}
                    placeholder="Descreva o que foi realizado..." />
                </div>
                {/* Diario de Bordo */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <ClipboardEdit className="h-3 w-3" /> Diario de Bordo
                    <div style={{ marginLeft: "auto" }}>
                      <Select value={diarioCategoria} onValueChange={val => setDiarioCategoria(val as any)}>
                        <SelectTrigger style={{ height: 22, fontSize: 10, width: 90, border: "0.5px solid rgba(5,150,105,0.2)", background: "rgba(5,150,105,0.04)", borderRadius: 5 }}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["geral","decisao","ocorrencia","marco","alerta"] as const).map(cat => (
                            <SelectItem key={cat} value={cat} className="text-xs capitalize">{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea value={diarioObs} onChange={e => setDiarioObs(e.target.value)}
                    style={{ flex: 1, fontSize: 12, minHeight: 80, resize: "none", width: "100%", borderRadius: 7, border: "0.5px solid rgba(57,255,135,0.25)", padding: "8px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#374151", background: "rgba(57,255,135,0.015)" }}
                    placeholder="Registro para o diario do projeto..." />
                </div>
              </div>
            </div>

            {/* Footer navy-style */}
            <div className="modal-footer-navy">
              <span className="modal-footer-hint">
                <Check className="h-3 w-3" /> OS gerada automaticamente
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="modal-btn-secondary" onClick={() => setApontamentoOpen(false)}>Cancelar</button>
                <button className="modal-btn-primary" onClick={handleGravarApontamento} disabled={apontamentoLoading}>
                  {apontamentoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><span>Continuar</span><ArrowRight className="h-3 w-3" /></>}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Resumo do Apontamento — navy */}
        <Dialog open={resumoOpen} onOpenChange={setResumoOpen}>
          <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Confirmar Apontamento</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Confirmar Apontamento</div>
                <div className="modal-navy-meta">{selectedAgenda?.cliente} &nbsp;|&nbsp; {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</div>
              </div>
              <button className="modal-navy-close" onClick={() => setResumoOpen(false)} aria-label="Fechar">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-body-padded">
              {/* Info card */}
              <div className="resumo-info-card">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#6B7280" }}>Modalidade</span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{apontModalidade}</span>
                </div>
                {projetoDeslocamento > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#6B7280" }}>Deslocamento</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{projetoDeslocamento}h</span>
                  </div>
                )}
              </div>
              {/* Atividades */}
              {atividadesApontadas.map((aa, i) => (
                <div key={i} className="resumo-atv-row">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{aa.atividade_codigo} - {aa.atividade_descricao}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6B7280" }}>
                    <span>{aa.horas}h trabalhadas</span>
                    <span>{aa.percentual_feeling ?? 0}% conclusao</span>
                  </div>
                </div>
              ))}
              {apontDescricao && (
                <div style={{ fontSize: 11, color: "#6B7280", background: "#F9FAFB", border: "0.5px solid rgba(0,0,0,0.06)", borderRadius: 7, padding: "8px 12px" }}>
                  {apontDescricao}
                </div>
              )}
              {/* Documento exigido */}
              {cronogramaItemDoc?.doc_exigido && !cronogramaItemDoc.doc_satisfeito && (
                <div style={{ border: "0.5px solid rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.06)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#D97706", display: "flex", alignItems: "center", gap: 5 }}>
                    <FileStack className="h-3.5 w-3.5" /> Documento exigido: {cronogramaItemDoc.codigo}
                  </div>
                  <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="text-xs h-8" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                  {docFile && (
                    <button className="modal-btn-primary" style={{ background: "#D97706", width: "100%", justifyContent: "center" }}
                      onClick={handleUploadDoc} disabled={docUploading}>
                      {docUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><FileStack className="h-3 w-3" /><span>Enviar documento</span></>}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer-navy">
              <span className="modal-footer-hint" />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="modal-btn-secondary" onClick={() => { setResumoOpen(false); setApontamentoOpen(true); }}>
                  Voltar
                </button>
                <button className="modal-btn-primary" onClick={handleConfirmarApontamento} disabled={resumoLoading}>
                  {resumoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3" /><span>Confirmar</span></>}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Despesa — navy */}
        <Dialog open={despesaOpen} onOpenChange={setDespesaOpen}>
          <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Lancar Despesa</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Lancar Despesa</div>
                {selectedAgenda && <div className="modal-navy-meta">{selectedAgenda.cliente} &nbsp;|&nbsp; {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</div>}
              </div>
              <button className="modal-navy-close" onClick={() => setDespesaOpen(false)} aria-label="Fechar"><XCircle className="h-4 w-4" /></button>
            </div>
            <div className="modal-body-padded">
              <div>
                <div className="modal-field-label">Descricao</div>
                <Input value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className="h-9 text-xs" placeholder="Ex: Uber, Alimentacao, Hotel..." />
              </div>
              <div>
                <div className="modal-field-label">Valor (R$)</div>
                <Input type="number" min={0} step={0.01} value={despValor} onChange={e => setDespValor(e.target.value)} className="h-9 text-xs" placeholder="0,00" />
              </div>
              <div>
                <div className="modal-field-label">Comprovante (opcional)</div>
                <Input type="file" accept="image/*,.pdf" className="h-8 text-xs" onChange={e => setDespFoto(e.target.files?.[0] || null)} />
              </div>
              {despesasLancadas.length > 0 && (
                <div>
                  <div className="modal-field-label">Lancadas hoje</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {despesasLancadas.map(d => (
                      <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, background: "#F9FAFB", border: "0.5px solid rgba(0,0,0,0.06)", borderRadius: 6, padding: "6px 10px" }}>
                        <span style={{ color: "#4B5563" }}>{d.descricao}</span>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer-navy">
              <span className="modal-footer-hint">
                <Receipt className="h-3 w-3" /> Reembolso via financeiro
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="modal-btn-secondary" onClick={() => setDespesaOpen(false)}>Cancelar</button>
                <button className="modal-btn-primary" disabled={despLoading || !despDescricao || !despValor}
                  onClick={async () => {
                    if (!selectedDate || !user || !despDescricao || !despValor) return;
                    setDespLoading(true);
                    const { error } = await supabase.from("despesas").insert({ user_id: user.id, data_despesa: selectedDate, cliente: selectedAgenda?.cliente || "", descricao: despDescricao, valor: parseFloat(despValor) });
                    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
                    else { toast({ title: "Despesa lancada!" }); setDespesaOpen(false); setDespDescricao(""); setDespValor(""); setDespFoto(null); }
                    setDespLoading(false);
                  }}>
                  {despLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CircleDollarSign className="h-3 w-3" /><span>Lancar</span></>}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Requisitar Agenda — navy redesenhado */}
        <Dialog open={reqOpen} onOpenChange={setReqOpen}>
          <DialogContent className="max-w-md max-h-[90dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Requisitar Agenda</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Requisitar Agenda</div>
                {reqCliente
                  ? <div className="modal-navy-meta">{reqCliente}{reqData ? " | " + format(parseISO(reqData), "dd/MM/yyyy") : ""}</div>
                  : <div className="modal-navy-meta">Solicitar nova data ou atividade ao coordenador</div>
                }
              </div>
              <button className="modal-navy-close" onClick={() => setReqOpen(false)} aria-label="Fechar"><XCircle className="h-4 w-4" /></button>
            </div>
            <div className="modal-body-padded">

              {/* Data + Projeto lado a lado */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="modal-field-label">Data solicitada</div>
                  <Input type="date" value={reqData} onChange={e => setReqData(e.target.value)} className="h-9 text-xs" />
                </div>
                <div>
                  <div className="modal-field-label">Projeto</div>
                  <Select value={reqCliente} onValueChange={async (val) => {
                    setReqCliente(val);
                    setReqAtividade(""); setReqAtividadeId(""); setReqCronoItemId(""); setReqCronoItens([]);
                    setReqAtividadesLoading(true);
                    const proj = offProjetos.find(p => p.nome_cliente === val);
                    if (proj) {
                      setReqCoordenador(proj.coordenador_id || "");
                      const { data } = await supabase.from("projeto_atividades").select("id, codigo, descricao, horas, projeto_id").eq("projeto_id", proj.id);
                      setReqAtividades(data || []);
                    }
                    setReqAtividadesLoading(false);
                  }}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {offProjetos.filter(p => p.status === "Liberado").map(p => <SelectItem key={p.id} value={p.nome_cliente}>{p.nome_cliente}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Atividade */}
              <div>
                <div className="modal-field-label">Atividade</div>
                <Select value={reqAtividade} onValueChange={async val => {
                  const atv = reqAtividades.find((a: any) => `${a.codigo} - ${a.descricao}` === val);
                  setReqAtividade(val);
                  setReqAtividadeId(atv?.id || "");
                  setReqCronoItemId("");
                  if (atv?.id) {
                    const { data: cis } = await supabase.from("cronograma_itens")
                      .select("id, codigo, descricao, doc_exigido")
                      .eq("atividade_id", atv.id);
                    setReqCronoItens(cis || []);
                  } else {
                    setReqCronoItens([]);
                  }
                }} disabled={reqAtividadesLoading || !reqCliente}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={reqAtividadesLoading ? "Carregando..." : "Selecione a atividade"} /></SelectTrigger>
                  <SelectContent>
                    {reqAtividades.map((a: any) => <SelectItem key={a.codigo} value={`${a.codigo} - ${a.descricao}`}>{a.codigo} - {a.descricao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Item cronograma — aparece ao selecionar atividade */}
              {reqCronoItens.length > 0 && (
                <div>
                  <div className="crono-field-lbl" style={{ marginBottom: 5 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    Item do cronograma <span style={{ color: "#9CA3AF", fontWeight: 400 }}>— opcional</span>
                  </div>
                  <Select value={reqCronoItemId} onValueChange={setReqCronoItemId}>
                    <SelectTrigger className={"h-8 text-xs " + (reqCronoItemId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-dashed")}>
                      <SelectValue placeholder="Selecionar item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reqCronoItens.map((ci: any) => (
                        <SelectItem key={ci.id} value={ci.id} className="text-xs">
                          {ci.codigo} - {ci.descricao}{ci.doc_exigido ? " 📎" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Horas + Modalidade */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="modal-field-label">Horas</div>
                  <Input type="number" min={0} step={0.5} value={reqHoras} onChange={e => setReqHoras(e.target.value)} className="h-9 text-xs" placeholder="Ex: 8" />
                </div>
                <div>
                  <div className="modal-field-label">Modalidade</div>
                  <div className="mod-tab-group" style={{ padding: 3 }}>
                    {[
                      { id: "Remoto",     icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M10.83 16.1a6 6 0 0 1 2.41-.63 6 6 0 0 1 2.41.63"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> },
                      { id: "Presencial", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                    ].map(m => (
                      <button key={m.id} className={"mod-tab-btn" + (reqModalidade === m.id ? " active" : "")}
                        onClick={() => setReqModalidade(m.id)}>
                        {m.icon}{m.id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Justificativa */}
              <div>
                <div className="modal-field-label">Justificativa (opcional)</div>
                <Textarea value={reqJustificativa} onChange={e => setReqJustificativa(e.target.value)} className="text-xs min-h-[56px] resize-none" placeholder="Motivo da solicitacao..." />
              </div>
            </div>

            <div className="modal-footer-navy">
              <span className="modal-footer-hint">
                <CalendarDays className="h-3 w-3" /> Pendente de aprovacao do coordenador
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="modal-btn-secondary" onClick={() => { setReqOpen(false); setNavAtiva("Dashboard"); setReqData(""); setReqCliente(""); setReqHoras(""); setReqAtividade(""); setReqAtividadeId(""); setReqCronoItemId(""); setReqCronoItens([]); setReqJustificativa(""); }}>Cancelar</button>
                <button className="modal-btn-primary" disabled={!reqData || !reqCliente || !reqHoras}
                  onClick={async () => {
                    if (!user || !reqData || !reqCliente || !reqHoras) return;
                    const { error } = await supabase.from("requisicoes_agenda").insert({
                      user_id: user.id, data: reqData, cliente: reqCliente,
                      coordenador_id: reqCoordenador || null, atividade: reqAtividade || null,
                      total_horas: parseFloat(reqHoras), modalidade: reqModalidade,
                      justificativa: reqJustificativa || null, status: "pendente"
                    });
                    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
                    else {
                      toast({ title: "Requisicao enviada!" });
                      setReqOpen(false); setReqData(""); setReqCliente(""); setReqHoras("");
                      setReqAtividade(""); setReqAtividadeId(""); setReqCronoItemId(""); setReqCronoItens([]);
                      setReqJustificativa(""); await loadData();
                    }
                  }}>
                  <ArrowRight className="h-3 w-3" /><span>Enviar</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancelamento — navy */}
        <Dialog open={cancelAgendaOpen} onOpenChange={setCancelAgendaOpen}>
          <DialogContent className="max-w-sm max-h-[90dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Solicitar Cancelamento</DialogTitle>
            <div className="modal-navy-header" style={{ background: "#7F1D1D" }}>
              <div>
                <div className="modal-navy-title">Solicitar Cancelamento</div>
                {selectedAgenda && (
                  <div className="modal-navy-meta" style={{ color: "rgba(252,165,165,0.8)" }}>
                    {selectedAgenda.cliente} &nbsp;|&nbsp; {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}
                  </div>
                )}
              </div>
              <button className="modal-navy-close" onClick={() => setCancelAgendaOpen(false)} aria-label="Fechar"><XCircle className="h-4 w-4" /></button>
            </div>
            <div className="modal-body-padded">
              <div style={{ fontSize: 12, color: "#4B5563", background: "#FEF2F2", border: "0.5px solid rgba(226,75,74,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                Justifique o motivo do cancelamento. O coordenador sera notificado para aprovacao.
              </div>
              <div>
                <div className="modal-field-label">Motivo do cancelamento</div>
                <Textarea value={cancelJustificativa} onChange={e => setCancelJustificativa(e.target.value)}
                  className="text-xs min-h-[100px] resize-none" placeholder="Descreva o motivo do cancelamento..." />
              </div>
            </div>
            <div className="modal-footer-navy">
              <span className="modal-footer-hint">
                <AlertCircle className="h-3 w-3" style={{ color: "#E24B4A" }} /> Acao irreversivel
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="modal-btn-secondary" onClick={() => { setCancelAgendaOpen(false); setCancelJustificativa(""); }}>Cancelar</button>
                <button className="modal-btn-primary" style={{ background: "#991B1B" }}
                  disabled={!cancelJustificativa.trim()}
                  onClick={async () => {
                    if (!selectedAgenda || !cancelJustificativa.trim()) return;
                    await supabase.from("agendas").update({ status: "aguardando_cancelamento" }).eq("id", selectedAgenda.id);
                    toast({ title: "Solicitacao enviada", description: "O coordenador sera notificado." });
                    setCancelAgendaOpen(false);
                    setCancelJustificativa("");
                    await loadData();
                  }}>
                  <Ban className="h-3 w-3" style={{ color: "#fff" }} /><span style={{ color: "#fff" }}>Confirmar cancelamento</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Relatorio Financeiro */}
        <Dialog open={resumoFinanceiroOpen} onOpenChange={setResumoFinanceiroOpen}>
          <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
            <DialogTitle className="sr-only">Relatorio Financeiro</DialogTitle>
            <div className="modal-navy-header">
              <div>
                <div className="modal-navy-title">Relatorio Financeiro</div>
                <div className="modal-navy-meta">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="modal-navy-close" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Mes anterior">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button className="modal-navy-close" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Proximo mes">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button className="modal-navy-close" onClick={() => setResumoFinanceiroOpen(false)} aria-label="Fechar">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
            </div>
            <div className="modal-footer-navy">
              <span className="modal-footer-hint"><Printer className="h-3 w-3" /> Relatorio de uso interno</span>
              <button className="modal-btn-primary" onClick={() => setExportDialogOpen(true)}>
                <Printer className="h-3 w-3" /><span>Exportar PDF</span>
              </button>
            </div>
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