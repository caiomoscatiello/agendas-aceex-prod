import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { LogOut, Loader2, XCircle, PlusCircle, ChevronLeft, ChevronRight, Ban, Receipt, Camera, Settings, ChevronsUpDown, Check, ClipboardEdit, Plus, Trash2, CircleDollarSign, FileDown, Clock, LayoutDashboard, FileText, CalendarDays, ListTodo, BarChart2, FileStack, AlertCircle, Printer, ExternalLink, ArrowRight, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import aceexLogo from "@/assets/aceex_logo.jpg";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { usePendencias } from "@/components/consultor/hooks/usePendencias";
import { VisaoGeralCard } from "@/components/consultor/ui/VisaoGeralCard";
import { TimesheetCard } from "@/components/consultor/ui/TimesheetCard";
import { PendenciasPMOCard } from "@/components/consultor/ui/PendenciasPMOCard";
import { BacklogBoard } from "@/components/consultor/ui/BacklogBoard";

type Agenda = {
  id: string;
  cliente: string;
  data: string;
  atividade: string;
  status: string;
  atividade_descricao: string | null;
  item_cronograma: string | null;
};
type Apontamento = { id: string; data: string; hora: string; cliente: string; tipo: string; endereco: string | null };
type ProjetoDespesa = { id: string; tipo_despesa: string; valor_maximo: number };
type Despesa = { id: string; descricao: string; valor: number; data_despesa: string; envio_financeiro: string | null; cliente: string };
type ProjetoAtividade = { id: string; codigo: string; descricao: string; horas: number; projeto_id: string };
type RequisicaoPendente = { id: string; data: string; cliente: string; atividade: string | null; total_horas: number; modalidade: string };
type AtividadeApontada = {
  atividade_codigo: string;
  atividade_descricao: string;
  horas: number;
  percentual_feeling: number | null;
};

type RfAgenda = {
  id: string; data: string; cliente: string; status: string;
  horas_apontadas: number; horas_planejadas: number; deslocamento: number;
};
type RfDespesa = {
  id: string; data: string; cliente: string;
  descricao: string; status_despesa: string; valor: number;
};

export default function ConsultorDashboard() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [cancelAgendaOpen, setCancelAgendaOpen] = useState(false);
  const [cancelJustificativa, setCancelJustificativa] = useState("");

  // New apontamento flow state
  const [apontamentoOpen, setApontamentoOpen] = useState(false);
  const [apontamentoLoading, setApontamentoLoading] = useState(false);
  const [projetoAtividades, setProjetoAtividades] = useState<ProjetoAtividade[]>([]);
  const [horasAprovadas, setHorasAprovadas] = useState<Record<string, number>>({});
  const [atividadesApontadas, setAtividadesApontadas] = useState<AtividadeApontada[]>([]);
  const [apontModalidade, setApontModalidade] = useState("Remoto");
  const [apontDescricao, setApontDescricao] = useState("");

  // Despesas state
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [despDescricao, setDespDescricao] = useState("");
  const [despValor, setDespValor] = useState("");
  const [despFoto, setDespFoto] = useState<File | null>(null);
  // Upload de documento
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [cronogramaItemDoc, setCronogramaItemDoc] = useState<{ id: string; doc_exigido: boolean; doc_satisfeito: boolean; codigo: string; descricao: string; codigo_cliente: string; nome_cliente: string } | null>(null);
  const [despLoading, setDespLoading] = useState(false);
  const [projetoDespesas, setProjetoDespesas] = useState<ProjetoDespesa[]>([]);
  const [despValorMaximo, setDespValorMaximo] = useState<number | null>(null);
  const [despesasLancadas, setDespesasLancadas] = useState<Despesa[]>([]);

  // Requisitar agenda state
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

  const [offProjetos, setOffProjetos] = useState<{ id: string; nome_cliente: string; coordenador_id: string | null; deslocamento?: number; email_contato?: string | null; status?: string; monday_board_url?: string | null; sharepoint_pasta_url?: string | null }[]>([]);
  
  // Summary dialog state
  const [resumoOpen, setResumoOpen] = useState(false);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [projetoDeslocamento, setProjetoDeslocamento] = useState(0);
  const [requisicoesPendentes, setRequisicoesPendentes] = useState<RequisicaoPendente[]>([]);

  // Resumo Financeiro state
  const [resumoFinanceiroOpen, setResumoFinanceiroOpen] = useState(false);
  const [osResumoOpen, setOsResumoOpen] = useState(false);
  const [rfAgendas, setRfAgendas] = useState<RfAgenda[]>([]);
  const [rfDespesas, setRfDespesas] = useState<RfDespesa[]>([]);
  const [rfLoading, setRfLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Layout desktop
  const isMobile = useIsMobile();

  // Aba ativa no mobile (nav bar inferior)
  const [mobileTab, setMobileTab] = useState<"agenda" | "timesheet" | "backlog" | "pendencias">("agenda");

  // BL-019 — Pendências PMO
  const { pendencias, totalPendencias, porTipo, loadingPendencias, loadPendencias } = usePendencias(user?.id);

  // Dados do timesheet
  const [tsAgendadas, setTsAgendadas] = useState(0);
  const [tsApontadas, setTsApontadas] = useState(0);
  const [tsSemanas, setTsSemanas] = useState<{ label: string; agendadas: number; apontadas: number }[]>([]);
  const [tsProjetos, setTsProjetos] = useState<{ cliente: string; horas: number }[]>([]);

  // Dados da visão geral
  const [vgAgendasConfirmadas, setVgAgendasConfirmadas] = useState(0);
  const [vgAgendasApontadas, setVgAgendasApontadas] = useState(0);
  const [vgDiasLivres, setVgDiasLivres] = useState(0);
  const [vgProjetos, setVgProjetos] = useState(0);

  useEffect(() => {
    if (user) {
      loadData();
      loadProjetos();
      loadPendencias();
    }
  }, [user, currentMonth]);

  const loadData = async () => {
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const [agRes, apRes, reqRes] = await Promise.all([
      supabase.from("agendas").select("id, cliente, data, atividade, status, atividade_descricao, item_cronograma").eq("user_id", user!.id).gte("data", start).lte("data", end),
      supabase.from("apontamentos").select("id, data, hora, cliente, tipo, endereco").eq("user_id", user!.id).gte("data", start).lte("data", end),
      supabase.from("requisicoes_agenda").select("id, data, cliente, atividade, total_horas, modalidade").eq("user_id", user!.id).eq("status", "pendente").gte("data", start).lte("data", end),
    ]);
    setAgendas(agRes.data || []);
    setApontamentos(apRes.data || []);
    setRequisicoesPendentes(reqRes.data || []);
  };

  const loadProjetos = async () => {
    const { data } = await supabase.from("projetos").select("id, nome_cliente, coordenador_id, deslocamento, email_contato, status, monday_board_url, sharepoint_pasta_url");
    setOffProjetos((data as any) || []);
  };

  const formatHoras = (h: number): string => {
    const totalMin = Math.round(h * 60);
    const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const mm = (totalMin % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const getRfStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      confirmada: "Prevista", em_aprovacao: "Em Aprovação",
      apontamento_ok: "Apontamento Ok", apontamento_ajustado: "Ajustado",
    };
    return map[status] || status;
  };

  const getRfStatusClass = (status: string): string => {
    const map: Record<string, string> = {
      confirmada: "bg-blue-100 text-blue-800",
      em_aprovacao: "bg-yellow-100 text-yellow-800",
      apontamento_ok: "bg-emerald-100 text-emerald-800",
      apontamento_ajustado: "bg-teal-100 text-teal-800",
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  const getDespStatusClass = (s: string): string => {
    if (!s || s === "Pendente") return "bg-orange-100 text-orange-800";
    if (s.toLowerCase().includes("financeiro") || s.toLowerCase().includes("aprovad"))
      return "bg-emerald-100 text-emerald-800";
    return "bg-blue-100 text-blue-800";
  };

  const loadResumoFinanceiro = async () => {
    if (!user) return;
    setRfLoading(true);
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data: agendasRaw } = await supabase
      .from("agendas")
      .select("id, data, cliente, status")
      .eq("user_id", user.id)
      .gte("data", start).lte("data", end)
      .in("status", ["confirmada", "em_aprovacao", "apontamento_ok", "apontamento_ajustado", "doc_pendente"])
      .order("data", { ascending: true });

    const agendasData = agendasRaw || [];
    const agendaIds = agendasData.map((a) => a.id);

    let horasPorAgenda: Record<string, number> = {};
    if (agendaIds.length > 0) {
      const { data: apontAtiv } = await supabase
        .from("apontamento_atividades")
        .select("agenda_id, horas")
        .in("agenda_id", agendaIds);
      for (const aa of (apontAtiv || []) as any[])
        horasPorAgenda[aa.agenda_id] = (horasPorAgenda[aa.agenda_id] || 0) + Number(aa.horas);
    }

    const { data: requisicoes } = await supabase
      .from("requisicoes_agenda")
      .select("cliente, data, total_horas")
      .eq("user_id", user.id).eq("status", "aprovada")
      .gte("data", start).lte("data", end);

    const reqMap: Record<string, number> = {};
    for (const r of (requisicoes || []) as any[]) {
      const key = `${r.cliente}|${r.data}`;
      if (!reqMap[key] || r.total_horas > reqMap[key]) reqMap[key] = Number(r.total_horas);
    }

    const deslocPorCliente: Record<string, number> = {};
    for (const p of offProjetos) deslocPorCliente[p.nome_cliente] = Number(p.deslocamento || 0);

    const statusEfetivado = ["em_aprovacao", "apontamento_ok", "apontamento_ajustado", "doc_pendente"];
    setRfAgendas(agendasData.map((ag) => {
      const isEfetivada = statusEfetivado.includes(ag.status);
      return {
        id: ag.id, data: ag.data, cliente: ag.cliente, status: ag.status,
        horas_apontadas: isEfetivada ? (horasPorAgenda[ag.id] || 0) : 0,
        horas_planejadas: isEfetivada ? 0 : (reqMap[`${ag.cliente}|${ag.data}`] || 0),
        deslocamento: deslocPorCliente[ag.cliente] || 0,
      };
    }));

    const { data: despesasRaw } = await supabase
      .from("despesas")
      .select("id, data_despesa, cliente, descricao, envio_financeiro, valor")
      .eq("user_id", user.id)
      .gte("data_despesa", start).lte("data_despesa", end)
      .order("data_despesa", { ascending: true });

    setRfDespesas((despesasRaw || []).map((d) => ({
      id: d.id, data: d.data_despesa, cliente: d.cliente,
      descricao: d.descricao, status_despesa: d.envio_financeiro || "Pendente",
      valor: Number(d.valor),
    })));

    setRfLoading(false);
  };

  useEffect(() => {
    if (resumoFinanceiroOpen) loadResumoFinanceiro();
  }, [resumoFinanceiroOpen, currentMonth]);

  const exportarPDF = (tipo: "horas" | "despesas") => {
    setExportDialogOpen(false);
    const mesAno = format(currentMonth, "MMMM yyyy", { locale: ptBR });
    const mesAnoArquivo = format(currentMonth, "MM-yyyy");
    const agora = format(new Date(), "dd/MM/yyyy HH:mm");
    const periodoFim = format(endOfMonth(currentMonth), "dd/MM/yyyy");
    const periodoInicio = `01/${format(currentMonth, "MM/yyyy")}`;

    const horasTrab = rfAgendas.reduce((s, a) => s + a.horas_apontadas, 0);
    const horasPrev = rfAgendas.reduce((s, a) => s + a.horas_planejadas, 0);
    const translados = rfAgendas.reduce((s, a) => s + a.deslocamento, 0);
    const totalGeralHoras = rfAgendas.reduce((s, a) => s + (a.horas_apontadas || a.horas_planejadas) + a.deslocamento, 0);
    const totalValorDesp = rfDespesas.reduce((s, d) => s + d.valor, 0);

    const porClienteHoras: Record<string, number> = {};
    for (const a of rfAgendas)
      porClienteHoras[a.cliente] = (porClienteHoras[a.cliente] || 0) + (a.horas_apontadas || a.horas_planejadas) + a.deslocamento;

    const porClienteDesp: Record<string, number> = {};
    for (const d of rfDespesas)
      porClienteDesp[d.cliente] = (porClienteDesp[d.cliente] || 0) + d.valor;

    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#1a1a18;padding:32px}
      .doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #185FA5;margin-bottom:14px}
      .brand{font-size:20px;font-weight:700;color:#185FA5}
      .brand-sub{font-size:9px;color:#888780;margin-top:2px}
      .meta-title{font-size:13px;font-weight:700;text-align:right}
      .meta-line{font-size:9px;color:#5F5E5A;text-align:right;margin-top:2px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #e0dfd8;border-radius:4px;margin-bottom:14px;overflow:hidden}
      .info-cell{padding:7px 11px;border-right:1px solid #e0dfd8}
      .info-cell:last-child{border-right:none}
      .info-label{font-size:8px;color:#888780;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
      .info-value{font-size:11px;font-weight:700}
      .section-title{font-size:10px;font-weight:700;color:#185FA5;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 7px;padding-bottom:4px;border-bottom:1px solid #E6F1FB}
      table{width:100%;border-collapse:collapse}
      thead tr{background:#185FA5}
      thead th{color:#fff;padding:6px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.03em}
      th.r,td.r{text-align:right}
      tbody td{padding:5px 8px;border-bottom:1px solid #f0efe8}
      tbody tr:nth-child(even) td{background:#f8f7f3}
      tr.sub td{background:#f0efe8;font-style:italic;font-weight:600;font-size:9px}
      tr.tot td{background:#E6F1FB;font-weight:700;border-top:1px solid #B5D4F4}
      .tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:600;background:#f0efe8;color:#5F5E5A}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px}
      .scard{border:1px solid #e0dfd8;border-radius:4px;padding:8px 10px}
      .scard.hi{background:#E6F1FB;border-color:#B5D4F4}
      .slabel{font-size:8px;color:#888780;margin-bottom:3px}
      .svalue{font-size:15px;font-weight:700}
      .svalue.blue{color:#185FA5}
      .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e0dfd8;display:flex;justify-content:space-between;font-size:8px;color:#888780}
      @media print{body{padding:20px}@page{size:A4;margin:1.5cm}}
    `;

    const linhasHoras = rfAgendas.map((ag) => {
      const hL = ag.horas_apontadas || ag.horas_planejadas;
      const tot = hL + ag.deslocamento;
      return `<tr>
        <td>${format(parseISO(ag.data), "dd/MM/yyyy")}</td>
        <td>${ag.cliente}</td>
        <td><span class="tag">${getRfStatusLabel(ag.status)}</span></td>
        <td class="r">${formatHoras(hL)}</td>
        <td class="r">${ag.deslocamento > 0 ? formatHoras(ag.deslocamento) : "—"}</td>
        <td class="r">${formatHoras(tot)}</td>
      </tr>`;
    }).join("");

    const subtotaisHoras = Object.entries(porClienteHoras).map(([cli, h]) =>
      `<tr class="sub"><td colspan="5">Subtotal — ${cli}</td><td class="r">${formatHoras(h)}</td></tr>`
    ).join("");

    const linhasDesp = rfDespesas.map((d) =>
      `<tr>
        <td>${format(parseISO(d.data), "dd/MM/yyyy")}</td>
        <td>${d.cliente}</td>
        <td>${d.descricao}</td>
        <td><span class="tag">${d.status_despesa}</span></td>
        <td class="r">${d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      </tr>`
    ).join("");

    const subtotaisDesp = Object.entries(porClienteDesp).map(([cli, val]) =>
      `<tr class="sub"><td colspan="4">Subtotal — ${cli}</td><td class="r">${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr>`
    ).join("");

    const conteudoHoras = `
      <table>
        <thead><tr>
          <th>Data</th><th>Cliente</th><th>Status</th>
          <th class="r">Horas</th><th class="r">Transl.</th><th class="r">Total</th>
        </tr></thead>
        <tbody>
          ${linhasHoras}
          ${subtotaisHoras}
          <tr class="tot">
            <td colspan="3">TOTAL GERAL</td>
            <td class="r">${formatHoras(horasTrab + horasPrev)}</td>
            <td class="r">${formatHoras(translados)}</td>
            <td class="r">${formatHoras(totalGeralHoras)}</td>
          </tr>
        </tbody>
      </table>
      <div class="summary">
        <div class="scard"><div class="slabel">Agendas</div><div class="svalue">${rfAgendas.length}</div></div>
        <div class="scard"><div class="slabel">Trabalhadas</div><div class="svalue">${formatHoras(horasTrab)}</div></div>
        <div class="scard"><div class="slabel">Previstas</div><div class="svalue">${formatHoras(horasPrev)}</div></div>
        <div class="scard"><div class="slabel">Translados</div><div class="svalue">${formatHoras(translados)}</div></div>
        <div class="scard hi" style="grid-column:span 2">
          <div class="slabel">Total geral</div>
          <div class="svalue blue">${formatHoras(totalGeralHoras)}</div>
        </div>
      </div>`;

    const conteudoDesp = `
      <table>
        <thead><tr>
          <th>Data</th><th>Cliente</th><th>Despesa</th><th>Status</th><th class="r">Valor</th>
        </tr></thead>
        <tbody>
          ${linhasDesp}
          ${subtotaisDesp}
          <tr class="tot">
            <td colspan="4">TOTAL GERAL</td>
            <td class="r">${totalValorDesp.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
          </tr>
        </tbody>
      </table>
      <div class="summary">
        <div class="scard"><div class="slabel">Lançamentos</div><div class="svalue">${rfDespesas.length}</div></div>
        <div class="scard hi" style="grid-column:span 2">
          <div class="slabel">Total geral</div>
          <div class="svalue blue">${totalValorDesp.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        </div>
      </div>`;

    const titulo = tipo === "horas" ? "Relatório de Horas" : "Relatório de Despesas";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
      <div class="doc-header">
        <div><div class="brand">ACEEX</div><div class="brand-sub">Grupo ACEEX — Sistema de Gestão</div></div>
        <div><div class="meta-title">${titulo}</div><div class="meta-line">Competência: ${mesAno}</div><div class="meta-line">Emissão: ${agora}</div></div>
      </div>
      <div class="info-grid">
        <div class="info-cell"><div class="info-label">Consultor</div><div class="info-value">${user?.email || ""}</div></div>
        <div class="info-cell"><div class="info-label">Período</div><div class="info-value">${periodoInicio} – ${periodoFim}</div></div>
        <div class="info-cell"><div class="info-label">Gerado em</div><div class="info-value">${agora}</div></div>
      </div>
      <div class="section-title">Detalhamento</div>
      ${tipo === "horas" ? conteudoHoras : conteudoDesp}
      <div class="footer"><span>Gerado pelo Sistema ACEEX — Documento de uso interno</span><span>Exportado em ${agora}</span></div>
    </body></html>`;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => printWin.print(), 400);
    }
  };


  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getStatus = (dateStr: string) => {
    const dayAgendas = agendas.filter((a) => a.data === dateStr);
    const dayRequisicoes = requisicoesPendentes.filter((r) => r.data === dateStr);
    
    if (dayAgendas.length === 0 && dayRequisicoes.length === 0) return null;
    
    // If there are only pending requests (no real agendas), show amber
    if (dayAgendas.length === 0 && dayRequisicoes.length > 0) return "aguardando";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = parseISO(dateStr);

    const allDone = dayAgendas.every((ag) => {
      if (ag.status === "aguardando_cancelamento") return true;
      return ag.status === "em_aprovacao" || ag.status === "apontamento_ok" || ag.status === "apontamento_ajustado";
    });
    if (allDone && dayRequisicoes.length === 0) return "feito";
    if (allDone && dayRequisicoes.length > 0) return "aguardando";
    if (isBefore(date, today)) return "atrasada";
    return "planejada";
  };

  const statusColors: Record<string, string> = {
    feito: "bg-emerald-500",
    atrasada: "bg-red-500",
    planejada: "bg-blue-500",
    aguardando: "bg-amber-500",
  };

  const selectedAgendas = agendas.filter((a) => a.data === selectedDate);
  const selectedApontamentos = apontamentos.filter((a) => a.data === selectedDate);
  const selectedRequisicoes = requisicoesPendentes.filter((r) => r.data === selectedDate);

  useEffect(() => {
    if (selectedAgendas.length === 1) {
      setSelectedClienteId(selectedAgendas[0].id);
    } else if (selectedAgendas.length === 0) {
      setSelectedClienteId(null);
    }
  }, [selectedDate, selectedAgendas.length]);

  const selectedAgenda = selectedAgendas.find((a) => a.id === selectedClienteId);

  // Load despesas for selected date
  useEffect(() => {
    if (!selectedDate || !user) {
      setDespesasLancadas([]);
      return;
    }
    supabase
      .from("despesas")
      .select("id, descricao, valor, data_despesa, envio_financeiro, cliente")
      .eq("user_id", user.id)
      .eq("data_despesa", selectedDate)
      .then(({ data }) => setDespesasLancadas(data || []));
  }, [selectedDate, user]);

  const isDateFuture = selectedDate ? (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = parseISO(selectedDate);
    return isAfter(sel, today);
  })() : false;

  // Check if apontamento already done for this agenda
  const isApontamentoDone = selectedAgenda ? 
    ["em_aprovacao", "apontamento_ok", "apontamento_ajustado"].includes(selectedAgenda.status) : false;

  const isProjetoNaoLiberado = selectedAgenda ? (() => {
    const projeto = offProjetos.find((p) => p.nome_cliente === selectedAgenda.cliente);
    return projeto ? projeto.status !== "Liberado" : false;
  })() : false;

  const getAgendaStatusDisplay = (agenda: Agenda) => {
    if (agenda.status === "aguardando_cancelamento") {
      return { label: "Aguardando Cancelamento", color: "bg-orange-500 text-white" };
    }
    if (agenda.status === "em_aprovacao") {
      return { label: "EM APROVAÇÃO", color: "bg-yellow-500 text-white" };
    }
    if (agenda.status === "doc_pendente") {
      return { label: "DOC. PENDENTE", color: "bg-amber-600 text-white" };
    }
    if (agenda.status === "apontamento_ok") {
      return { label: "APONTAMENTO OK", color: "bg-emerald-500 text-white" };
    }
    if (agenda.status === "apontamento_ajustado") {
      return { label: "APONTAMENTO AJUSTADO", color: "bg-teal-500 text-white" };
    }
    return { label: "Confirmada", color: "bg-blue-500 text-white" };
  };

  // ===== NEW APONTAMENTO FLOW =====
  const loadAtividadesParaApontamento = async (cliente: string) => {
    const projeto = offProjetos.find((p) => p.nome_cliente === cliente);
    if (!projeto) return;

    // Load all activities for the project
    const { data: atividades } = await supabase
      .from("projeto_atividades")
      .select("id, codigo, descricao, horas, projeto_id")
      .eq("projeto_id", projeto.id);
    
    setProjetoAtividades(atividades || []);

    // Load approved hours per activity (from apontamento_atividades where agenda status is approved)
    // We need to sum hours from apontamento_atividades for agendas that are approved
    const { data: allApontAtividades } = await supabase
      .from("apontamento_atividades" as any)
      .select("atividade_codigo, horas, agenda_id")
      .eq("cliente", cliente);

    // Get approved agenda IDs
    const { data: approvedAgendas } = await supabase
      .from("agendas")
      .select("id")
      .eq("cliente", cliente)
      .in("status", ["apontamento_ok", "apontamento_ajustado"]);

    const approvedIds = new Set((approvedAgendas || []).map((a: any) => a.id));

    const horasMap: Record<string, number> = {};
    if (allApontAtividades) {
      for (const aa of allApontAtividades as any[]) {
        if (approvedIds.has(aa.agenda_id)) {
          horasMap[aa.atividade_codigo] = (horasMap[aa.atividade_codigo] || 0) + Number(aa.horas);
        }
      }
    }
    setHorasAprovadas(horasMap);
  };

  const getSaldo = (atv: ProjetoAtividade) => {
    const aprovado = horasAprovadas[atv.codigo] || 0;
    return Math.max(0, Number(atv.horas) - aprovado);
  };

  const getPercentual = (atv: ProjetoAtividade) => {
    if (Number(atv.horas) <= 0) return 100;
    const aprovado = horasAprovadas[atv.codigo] || 0;
    return Math.min(100, Math.round((aprovado / Number(atv.horas)) * 100));
  };

  const handleOpenApontamento = async () => {
    if (!selectedAgenda) return;
    const projeto = offProjetos.find((p) => p.nome_cliente === selectedAgenda.cliente);
    if (projeto && projeto.status !== "Liberado") {
      toast({ title: "Projeto não liberado", description: `O projeto "${selectedAgenda.cliente}" está com status "${projeto.status || 'Em planejamento'}". Apontamentos só são permitidos para projetos liberados.`, variant: "destructive" });
      return;
    }
    await loadAtividadesParaApontamento(selectedAgenda.cliente);

    // Pré-preencher descrição da atividade vinda da requisição aprovada
    const { data: reqData } = await supabase
      .from("requisicoes_agenda")
      .select("descricao_atividade")
      .eq("user_id", user!.id)
      .eq("data", selectedAgenda.data)
      .eq("cliente", selectedAgenda.cliente)
      .eq("status", "aprovada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setAtividadesApontadas([{ atividade_codigo: "", atividade_descricao: "", horas: 0, percentual_feeling: null }]);
    setApontModalidade("Remoto");
    setApontDescricao((reqData as any)?.descricao_atividade || "");
    setApontamentoOpen(true);
  };

  // After projetoAtividades loads, pre-fill with planned activity
  useEffect(() => {
    if (apontamentoOpen && projetoAtividades.length > 0 && atividadesApontadas.length === 0 && selectedAgenda) {
      const planned = selectedAgenda.atividade;
      const match = projetoAtividades.find((a) => {
        const full = `${a.codigo} - ${a.descricao}`;
        return planned === a.descricao || planned === a.codigo || planned === full || planned.startsWith(a.codigo + " ");
      });
      if (match && getSaldo(match) > 0) {
        setAtividadesApontadas([{
          atividade_codigo: match.codigo,
          atividade_descricao: match.descricao,
          horas: 0,
          percentual_feeling: null,
        }]);
      }
    }
  }, [apontamentoOpen, projetoAtividades]);

  const handleAddAtividade = () => {
    setAtividadesApontadas((prev) => [...prev, { atividade_codigo: "", atividade_descricao: "", horas: 0, percentual_feeling: null }]);
  };

  const handleRemoveAtividade = (index: number) => {
    setAtividadesApontadas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeAtividade = (index: number, codigo: string) => {
    const atv = projetoAtividades.find((a) => a.codigo === codigo);
    if (!atv) return;
    setAtividadesApontadas((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, atividade_codigo: atv.codigo, atividade_descricao: atv.descricao, horas: 0, percentual_feeling: null } : item
      )
    );
  };

  const handleChangeHoras = (index: number, horas: number) => {
    setAtividadesApontadas((prev) =>
      prev.map((item, i) => (i === index ? { ...item, horas } : item))
    );
  };

  const handleChangeFeeling = (index: number, valor: number) => {
    setAtividadesApontadas((prev) =>
      prev.map((item, i) => i === index ? { ...item, percentual_feeling: valor } : item)
    );
  };

  // Check if apontamento matches approved request exactly
  const checkAutoApprove = async (agenda: Agenda): Promise<boolean> => {
    // Find approved requisicao for this agenda (same user, date, client)
    const { data: requisicoes } = await supabase
      .from("requisicoes_agenda")
      .select("atividade, modalidade, total_horas")
      .eq("user_id", user!.id)
      .eq("data", agenda.data)
      .eq("cliente", agenda.cliente)
      .eq("status", "aprovada")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!requisicoes || requisicoes.length === 0) return false;

    const req = requisicoes[0];
    const totalHorasApontadas = atividadesApontadas.reduce((s, a) => s + a.horas, 0);

    // Check modalidade
    if (apontModalidade !== (req.modalidade || "Remoto")) return false;

    // Check total hours
    if (totalHorasApontadas !== Number(req.total_horas)) return false;

    // Check activity (single activity matching)
    if (atividadesApontadas.length === 1) {
      const atvLabel = `${atividadesApontadas[0].atividade_codigo} - ${atividadesApontadas[0].atividade_descricao}`;
      if (atvLabel !== req.atividade) return false;
    } else {
      // Multiple activities = different from request, needs approval
      return false;
    }

    return true;
  };

  const handleGravarApontamento = async () => {
    if (!selectedAgenda || !selectedDate || atividadesApontadas.length === 0) return;

    // Validate all activities have hours > 0
    for (const aa of atividadesApontadas) {
      if (!aa.atividade_codigo) {
        toast({ title: "Erro", description: "Selecione uma atividade para todas as linhas.", variant: "destructive" });
        return;
      }
      if (aa.horas <= 0) {
        toast({ title: "Erro", description: `Informe as horas para ${aa.atividade_codigo}.`, variant: "destructive" });
        return;
      }
      // Check saldo
      const atv = projetoAtividades.find((a) => a.codigo === aa.atividade_codigo);
      if (atv) {
        const saldo = getSaldo(atv);
        if (aa.horas > saldo) {
          toast({ title: "Erro", description: `Horas excedem o saldo de ${saldo}h para ${aa.atividade_codigo}.`, variant: "destructive" });
          return;
        }
      }
    }

    // Validar feeling obrigatório
    for (const aa of atividadesApontadas) {
      if (aa.percentual_feeling === null || aa.percentual_feeling === undefined) {
        toast({
          title: "% de conclusão obrigatório",
          description: `Informe o % de conclusão para ${aa.atividade_codigo || "a atividade"}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Get deslocamento from project
    const projeto = offProjetos.find((p) => p.nome_cliente === selectedAgenda.cliente);
    setProjetoDeslocamento(apontModalidade === "Presencial" && projeto?.deslocamento ? projeto.deslocamento : 0);

    // Show summary dialog
    setApontamentoOpen(false);
    setResumoOpen(true);

    // Buscar dados do item de cronograma para upload de documento
    if (selectedAgenda?.item_cronograma) {
      const codigoItem = selectedAgenda.item_cronograma.split(" - ")[0].trim();
      supabase
        .from("cronograma_itens")
        .select("id, codigo, descricao, doc_exigido, doc_satisfeito")
        .ilike("codigo", codigoItem)
        .maybeSingle()
        .then(({ data: ci }) => {
          if (ci?.doc_exigido) {
            // Buscar codigo_cliente e nome_cliente do projeto
            supabase
              .from("projetos")
              .select("codigo_cliente, nome_cliente")
              .eq("nome_cliente", selectedAgenda.cliente)
              .maybeSingle()
              .then(({ data: proj }) => {
                setCronogramaItemDoc({
                  id: ci.id,
                  doc_exigido: ci.doc_exigido,
                  doc_satisfeito: ci.doc_satisfeito,
                  codigo: ci.codigo,
                  descricao: ci.descricao,
                  codigo_cliente: proj?.codigo_cliente || "",
                  nome_cliente: proj?.nome_cliente || selectedAgenda.cliente,
                });
              });
          } else {
            setCronogramaItemDoc(null);
          }
        });
    } else {
      setCronogramaItemDoc(null);
    }
    setDocFile(null);
  };

  const handleConfirmarApontamento = async () => {
    if (!selectedAgenda || !selectedDate) return;
    setResumoLoading(true);

    // Insert all activity records
    const inserts = atividadesApontadas.map((aa) => ({
      agenda_id: selectedAgenda.id,
      user_id: user!.id,
      data: selectedDate,
      cliente: selectedAgenda.cliente,
      atividade_codigo: aa.atividade_codigo,
      atividade_descricao: aa.atividade_descricao,
      horas: aa.horas,
      modalidade: apontModalidade,
      descricao: apontDescricao || null,
      percentual_feeling: aa.percentual_feeling ?? null,
    }));

    const { error } = await supabase.from("apontamento_atividades" as any).insert(inserts as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setResumoLoading(false);
      return;
    }

    // Check if apontamento matches the approved request exactly (auto-approve)
    const shouldAutoApprove = await checkAutoApprove(selectedAgenda);
    const newStatus = shouldAutoApprove ? "apontamento_ok" : "em_aprovacao";

    await supabase.from("agendas").update({ status: newStatus }).eq("id", selectedAgenda.id);

    // Sync Monday — fire-and-forget
    supabase.functions.invoke("monday-agenda-sync", {
      body: { action: "update", agenda_id: selectedAgenda.id },
    }).catch(() => {});

    if (shouldAutoApprove) {
      toast({ title: "Apontamento aprovado automaticamente!", description: "Os dados conferem com a solicitação aprovada." });
    } else {
      toast({ title: "Apontamento registrado!", description: "Enviado para aprovação do coordenador." });
    }
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

      const { data, error } = await supabase.functions.invoke("sharepoint-upload", {
        body: formData,
      });

      if (error) throw error;
      if (data?.success) {
        toast({ title: "Documento enviado!", description: "Arquivo enviado ao SharePoint com sucesso." });
        setCronogramaItemDoc((prev) => prev ? { ...prev, doc_satisfeito: true } : null);
        setDocFile(null);
        // Sync Monday — fire-and-forget
        supabase.functions.invoke("monday-agenda-sync", {
          body: { action: "update", agenda_id: selectedAgenda?.id },
        }).catch(() => {});
      }
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    }
    setDocUploading(false);
  };

  const handleEnviarOS = async () => {
    if (!selectedAgenda || !selectedDate) return;
    setResumoLoading(true);

    // First save the apontamento
    const inserts = atividadesApontadas.map((aa) => ({
      agenda_id: selectedAgenda.id,
      user_id: user!.id,
      data: selectedDate,
      cliente: selectedAgenda.cliente,
      atividade_codigo: aa.atividade_codigo,
      atividade_descricao: aa.atividade_descricao,
      horas: aa.horas,
      modalidade: apontModalidade,
      descricao: apontDescricao || null,
      percentual_feeling: aa.percentual_feeling ?? null,
    }));

    const { error } = await supabase.from("apontamento_atividades" as any).insert(inserts as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setResumoLoading(false);
      return;
    }

    // Check if apontamento matches the approved request exactly (auto-approve)
    const shouldAutoApprove = await checkAutoApprove(selectedAgenda);
    const newStatus = shouldAutoApprove ? "apontamento_ok" : "em_aprovacao";
    await supabase.from("agendas").update({ status: newStatus }).eq("id", selectedAgenda.id);

    // Sync Monday — fire-and-forget
    supabase.functions.invoke("monday-agenda-sync", {
      body: { action: "update", agenda_id: selectedAgenda.id },
    }).catch(() => {});

    // Send OS email
    const projeto = offProjetos.find((p) => p.nome_cliente === selectedAgenda.cliente);
    const totalAtividades = atividadesApontadas.reduce((s, a) => s + a.horas, 0);
    const totalGeral = totalAtividades + projetoDeslocamento;

    try {
      const { error: fnError } = await supabase.functions.invoke("send-os-email", {
        body: {
          cliente: selectedAgenda.cliente,
          data: selectedDate,
          atividades: atividadesApontadas,
          modalidade: apontModalidade,
          descricao: apontDescricao,
          deslocamento: projetoDeslocamento,
          total_horas: totalGeral,
          projeto_id: projeto?.id,
        },
      });
      if (fnError) {
        console.error("Erro ao enviar OS:", fnError);
        toast({ title: "Apontamento salvo", description: "Mas houve erro ao enviar OS por email.", variant: "destructive" });
      } else {
        toast({ title: "OS Enviada!", description: "Apontamento registrado e OS enviada por email." });
      }
    } catch (e) {
      console.error("Erro ao enviar OS:", e);
      toast({ title: "Apontamento salvo", description: "Mas houve erro ao enviar OS por email.", variant: "destructive" });
    }

    setResumoOpen(false);
    setResumoLoading(false);
    await loadData();
  };

  const handleEnviarOSRedundante = async () => {
    if (!selectedAgenda || !selectedDate) return;

    const { data: apontAtividades, error } = await supabase
      .from("apontamento_atividades" as any)
      .select("atividade_codigo, atividade_descricao, horas, modalidade, descricao")
      .eq("agenda_id", selectedAgenda.id);

    if (error || !apontAtividades || (apontAtividades as any[]).length === 0) {
      toast({ title: "Erro", description: "Nenhum apontamento encontrado para esta agenda.", variant: "destructive" });
      return;
    }

    const modalidade = (apontAtividades as any[])[0]?.modalidade || "Remoto";
    const descricao = (apontAtividades as any[])[0]?.descricao || "";
    const atividades = (apontAtividades as any[]).map((a: any) => ({
      atividade_codigo: a.atividade_codigo,
      atividade_descricao: a.atividade_descricao,
      horas: a.horas,
    }));

    const projeto = offProjetos.find((p) => p.nome_cliente === selectedAgenda.cliente);
    const deslocamento = modalidade === "Presencial" && projeto?.deslocamento ? projeto.deslocamento : 0;
    const totalHoras = atividades.reduce((s: number, a: any) => s + Number(a.horas), 0) + deslocamento;

    try {
      const { error: fnError } = await supabase.functions.invoke("send-os-email", {
        body: {
          cliente: selectedAgenda.cliente,
          data: selectedDate,
          atividades,
          modalidade,
          descricao,
          deslocamento,
          total_horas: totalHoras,
          projeto_id: projeto?.id,
        },
      });

      if (fnError) {
        toast({ title: "Erro ao enviar OS", description: fnError.message, variant: "destructive" });
      } else {
        toast({ title: "OS Enviada!", description: "OS reenviada por email com sucesso." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar OS", description: e?.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  // ===== EXISTING FLOWS (kept) =====
  const handleSolicitarCancelamento = async () => {
    if (!selectedAgenda || !cancelJustificativa.trim()) return;
    const { error } = await supabase.from("solicitacoes_cancelamento").insert({
      agenda_id: selectedAgenda.id, user_id: user!.id, justificativa: cancelJustificativa.trim(),
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("agendas").update({ status: "aguardando_cancelamento" }).eq("id", selectedAgenda.id);

    // Sync Monday — fire-and-forget
    supabase.functions.invoke("monday-agenda-sync", {
      body: { action: "update", agenda_id: selectedAgenda.id },
    }).catch(() => {});

    toast({ title: "Solicitação enviada", description: "Aguardando aprovação do administrador." });
    setCancelAgendaOpen(false);
    setCancelJustificativa("");
    await loadData();
  };

  const loadReqAtividades = async (cliente: string) => {
    setReqAtividadesLoading(true);
    const projeto = offProjetos.find((p) => p.nome_cliente === cliente);
    if (!projeto) { setReqAtividades([]); setReqAtividadesLoading(false); return; }
    const { data } = await supabase
      .from("projeto_atividades")
      .select("id, codigo, descricao, horas, projeto_id")
      .eq("projeto_id", projeto.id);
    setReqAtividades(data || []);
    setReqAtividadesLoading(false);
  };

  const handleRequisitar = async () => {
    if (!reqData || !reqCliente || !reqHoras || !reqCoordenador || !reqAtividade) return;
    const atv = reqAtividades.find((a) => a.id === reqAtividade);
    const atividadeLabel = atv ? `${atv.codigo} - ${atv.descricao}` : reqAtividade;
    const { error } = await supabase.from("requisicoes_agenda").insert({
      user_id: user!.id, data: reqData, cliente: reqCliente,
      total_horas: parseFloat(reqHoras), coordenador: reqCoordenador,
      atividade: atividadeLabel,
      modalidade: reqModalidade,
      descricao_atividade: reqDescricaoAtividade || null,
      justificativa: reqJustificativa || null,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Requisição enviada!" });
      setReqOpen(false);
      setReqData(""); setReqCliente(""); setReqHoras(""); setReqCoordenador(""); setReqAtividade(""); setReqAtividades([]); setReqModalidade("Remoto");
      setReqDescricaoAtividade(""); setReqJustificativa("");
    }
  };

  // Despesas
  const loadProjetoDespesas = async (cliente: string) => {
    const { data: projetos } = await supabase.from("projetos").select("id").eq("nome_cliente", cliente);
    if (projetos && projetos.length > 0) {
      const { data: despesasTipos } = await supabase
        .from("projeto_despesas")
        .select("id, tipo_despesa, valor_maximo")
        .eq("projeto_id", projetos[0].id);
      setProjetoDespesas(despesasTipos || []);
    } else {
      setProjetoDespesas([]);
    }
  };

  const handleOpenDespesa = () => {
    if (selectedAgenda) {
      loadProjetoDespesas(selectedAgenda.cliente);
    }
    setDespDescricao("");
    setDespValor("");
    setDespFoto(null);
    setDespValorMaximo(null);
    setDespesaOpen(true);
  };

  const handleDespesaTipoChange = (tipo: string) => {
    setDespDescricao(tipo);
    const found = projetoDespesas.find((d) => d.tipo_despesa === tipo);
    setDespValorMaximo(found ? found.valor_maximo : null);
    if (found && despValor && parseFloat(despValor) > found.valor_maximo) {
      setDespValor(found.valor_maximo.toString());
    }
  };

  const handleDespesaValorChange = (val: string) => {
    if (despValorMaximo !== null && parseFloat(val) > despValorMaximo) {
      setDespValor(despValorMaximo.toString());
      toast({ title: "Valor ajustado", description: `Valor máximo para esta despesa é R$ ${despValorMaximo.toFixed(2)}` });
    } else {
      setDespValor(val);
    }
  };

  const handleDespesa = async () => {
    if (!selectedDate || !selectedAgenda || !despDescricao || !despValor) return;
    setDespLoading(true);

    const now = new Date();
    const dataLancamento = format(now, "yyyy-MM-dd");
    const horaLancamento = format(now, "HH:mm:ss");

    let localLancamento: string | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      localLancamento = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    } catch {
      localLancamento = "Localização indisponível";
    }

    let fotoUrl: string | null = null;
    if (despFoto) {
      const filePath = `${user!.id}/${Date.now()}_${despFoto.name}`;
      const { error: uploadError } = await supabase.storage
        .from("despesas-fotos")
        .upload(filePath, despFoto);
      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        setDespLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("despesas-fotos").getPublicUrl(filePath);
      fotoUrl = urlData.publicUrl;
    }

    let valorFinal = parseFloat(despValor);
    if (despValorMaximo !== null && valorFinal > despValorMaximo) {
      valorFinal = despValorMaximo;
    }

    const { error } = await supabase.from("despesas").insert({
      user_id: user!.id,
      data_lancamento: dataLancamento,
      hora_lancamento: horaLancamento,
      local_lancamento: localLancamento,
      data_despesa: selectedDate,
      cliente: selectedAgenda.cliente,
      valor: valorFinal,
      descricao: despDescricao,
      foto_url: fotoUrl,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Despesa registrada!" });
      setDespesaOpen(false);
      setDespDescricao("");
      setDespValor("");
      setDespFoto(null);
      // Reload despesas for the grid
      supabase
        .from("despesas")
        .select("id, descricao, valor, data_despesa, envio_financeiro, cliente")
        .eq("user_id", user!.id)
        .eq("data_despesa", selectedDate!)
        .then(({ data }) => setDespesasLancadas(data || []));
    }
    setDespLoading(false);
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const firstDayOffset = getDay(startOfMonth(currentMonth));
  const canRequestCancel = selectedAgenda && (selectedAgenda.status === "confirmada" || selectedAgenda.status === "pendente");

  // Activities available for selection (exclude already selected, with saldo > 0)
  const getAvailableAtividades = (currentIndex: number) => {
    const selectedCodigos = atividadesApontadas
      .filter((_, i) => i !== currentIndex)
      .map((a) => a.atividade_codigo);
    return projetoAtividades.filter(
      (a) => !selectedCodigos.includes(a.codigo) && getSaldo(a) > 0
    );
  };
  const calcularTimesheet = async () => {
    if (!user) return;

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    // Buscar agendas confirmadas do mês
    const { data: agendasMes } = await supabase
      .from("agendas")
      .select("id, data, cliente, status")
      .eq("user_id", user.id)
      .eq("status", "confirmada")
      .gte("data", start)
      .lte("data", end);
/*
    const totalAgendadas = (agendasMes || []).length;
    setTsAgendadas(totalAgendadas);
*/
    // Total agendadas = confirmadas + já apontadas (todos os status ativos do mês)
  const { data: todasAgendasMes } = await supabase
  .from("agendas")
  .select("id, data, cliente")
  .eq("user_id", user.id)
  .in("status", ["confirmada", "apontamento_ok", "apontamento_ajustado", "em_aprovacao", "doc_pendente"])
  .gte("data", start)
  .lte("data", end);

const totalAgendadas = (todasAgendasMes || []).length;
setTsAgendadas(totalAgendadas);
    // Buscar agendas apontadas (apontamento_ok + em_aprovacao)
    const { data: agendasApontadas } = await supabase
      .from("agendas")
      .select("id, data, cliente")
      .eq("user_id", user.id)
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
        //const ag = (agendasMes || []).filter(a => a.data >= startStr && a.data <= endStr).length;
        const ap = (agendasApontadas || []).filter(a => a.data >= startStr && a.data <= endStr).length;
        semanas.push({ label: `S${semanaAtual}`, agendadas: ag, apontadas: ap });
        semanaAtual++;
        if (i < diasDoMes.length - 1) inicioSemana = diasDoMes[i + 1];
      }
    }
    setTsSemanas(semanas);

    // Breakdown por projeto (cliente)
    const projetoMap: Record<string, number> = {};
    for (const ag of agendasApontadas || []) {
      projetoMap[ag.cliente] = (projetoMap[ag.cliente] || 0) + 1;
    }
    setTsProjetos(Object.entries(projetoMap).map(([cliente, horas]) => ({ cliente, horas })));

    // Visão geral
    setVgAgendasConfirmadas(totalAgendadas);
    setVgAgendasApontadas((agendasApontadas || []).length);
    setVgProjetos(new Set([...(agendasMes || []), ...(agendasApontadas || [])].map(a => a.cliente)).size);

    // Dias livres = dias úteis do mês sem agenda confirmada nem apontada
    const todasAgendas = new Set([
      //...(agendasMes || []).map(a => a.data),
      ...(todasAgendasMes || []).map(a => a.data),
      ...(agendasApontadas || []).map(a => a.data),
    ]);
    const diasUteis = diasDoMes.filter(d => getDay(d) !== 0 && getDay(d) !== 6);
    setVgDiasLivres(diasUteis.filter(d => !todasAgendas.has(format(d, "yyyy-MM-dd"))).length);
  };

  useEffect(() => {
    calcularTimesheet();
  }, [currentMonth, user]);

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <img src={aceexLogo} alt="Grupo ACEEX" className="h-8 object-contain" />
          <div className="flex items-center gap-1">
            {role === "coordenador" && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1 text-muted-foreground">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setResumoFinanceiroOpen(true)} className="gap-1 text-muted-foreground" title="Resumo Financeiro">
              <CircleDollarSign className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full flex-1 overflow-y-auto p-4 space-y-4" style={{ maxWidth: isMobile ? '32rem' : '80rem' }}>
        {isMobile ? (
          /* ── MOBILE: conteúdo empilhado atual (sem alteração) ── */
          <div className="flex flex-col min-h-[calc(100vh-57px)]">
            <div className="flex-1 space-y-4 pb-20">
              {mobileTab === "agenda" && (
                <>
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekDays.map((d) => (
                <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const status = getStatus(dateStr);
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`relative flex flex-col items-center justify-center rounded-lg py-2 text-sm transition-colors ${
                      isSelected ? "bg-primary text-primary-foreground" : isToday(day) ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    {day.getDate()}
                    {status && (
                      <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${statusColors[status]}`} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Feito</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Atrasada</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Planejada</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Aguard.</span>
            </div>
          </CardContent>
        </Card>

        {/* Day Detail */}
        {selectedDate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedAgendas.length === 0 && selectedRequisicoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma agenda para este dia.</p>
              ) : (
                <div className="space-y-2">
                  {selectedAgendas.length > 1 && (
                    <p className="text-xs font-medium text-muted-foreground">Selecione o cliente:</p>
                  )}
                  {selectedAgendas.map((a) => {
                    const statusDisplay = getAgendaStatusDisplay(a);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedClienteId(a.id)}
                        className={`w-full rounded-lg border p-3 space-y-1 text-left transition-colors ${
                          selectedClienteId === a.id
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{a.cliente}</p>
                          <Badge className={`text-xs ${statusDisplay.color}`}>{statusDisplay.label}</Badge>
                        </div>
                        {/* Atividade com hierarquia visual */}
                        <div className="mt-1 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground opacity-50">↳</span>
                            <span className="text-xs font-medium text-foreground">
                              {a.atividade}
                              {a.atividade_descricao ? ` — ${a.atividade_descricao}` : ""}
                            </span>
                          </div>

                          {a.item_cronograma && (
                            <div className="flex items-center gap-1 pl-3">
                              <span className="text-[10px] text-muted-foreground opacity-45">↳</span>
                              <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                {a.item_cronograma}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Requisições pendentes — visual only */}
              {selectedRequisicoes.length > 0 && (
                <div className="space-y-2">
                  {selectedRequisicoes.map((r) => (
                    <div
                      key={r.id}
                      className="w-full rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1 opacity-80"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{r.cliente}</p>
                        <Badge className="text-xs bg-amber-500 text-white">Aguard. Aprov.</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.atividade || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.total_horas}h • {r.modalidade}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              {selectedAgenda && selectedAgenda.status !== "aguardando_cancelamento" && (
                <div className="space-y-2 pt-2">
                  {/* NEW APONTAMENTO BUTTON */}
                  <Button
                    onClick={handleOpenApontamento}
                    disabled={isApontamentoDone || isDateFuture || isProjetoNaoLiberado}
                    className="w-full h-12 text-base font-semibold gap-2"
                  >
                    {isProjetoNaoLiberado ? (
                      <>Projeto não liberado</>
                    ) : isDateFuture ? (
                      <>Data futura — não permitido</>
                    ) : isApontamentoDone ? (
                      <>Apontamento Registrado</>
                    ) : (
                      <>
                        <ClipboardEdit className="h-5 w-5" />
                        APONTAMENTO
                      </>
                    )}
                  </Button>

                  {/* Enviar OS (reenvio) + links apps */}
                  {isApontamentoDone && (() => {
                    const proj = offProjetos.find((p) => p.nome_cliente === selectedAgenda?.cliente);
                    return (
                      <div className="space-y-2">
                        <Button
                          onClick={() => setOsResumoOpen(true)}
                          variant="outline"
                          className="w-full h-12 text-base font-semibold gap-2 border-primary text-primary hover:bg-primary/10"
                        >
                          <Receipt className="h-5 w-5" />
                          ENVIAR OS
                        </Button>
                        {(proj?.monday_board_url || proj?.sharepoint_pasta_url) && (
                          <div className="flex gap-2">
                            {proj?.monday_board_url && (
                              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => window.open(proj.monday_board_url!, "_blank")}>
                                <ExternalLink className="h-3 w-3" />
                                Monday
                              </Button>
                            )}
                            {proj?.sharepoint_pasta_url && (
                              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => window.open(proj.sharepoint_pasta_url!, "_blank")}>
                                <ExternalLink className="h-3 w-3" />
                                SharePoint
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Solicitar cancelamento de agenda */}
                  {canRequestCancel && (
                    <Button variant="outline" className="w-full gap-2 text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => setCancelAgendaOpen(true)}>
                      <Ban className="h-4 w-4" />
                      Solicitar Cancelamento de Agenda
                    </Button>
                  )}

                  {/* Despesas */}
                  <Button variant="outline" className="w-full gap-2" onClick={() => { handleOpenDespesa(); setDespesaOpen(true); }}>
                    <Receipt className="h-4 w-4" />
                    DESPESAS
                  </Button>

                  {/* Despesas já lançadas */}
                  {despesasLancadas.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        Despesas Lançadas ({despesasLancadas.length})
                      </p>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left p-2 font-medium text-muted-foreground">Despesa</th>
                              <th className="text-right p-2 font-medium text-muted-foreground">Valor</th>
                              <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {despesasLancadas.map((d) => (
                              <tr key={d.id} className="border-t">
                                <td className="p-2 truncate max-w-[140px]">{d.descricao}</td>
                                <td className="p-2 text-right font-medium whitespace-nowrap">
                                  R$ {Number(d.valor).toFixed(2)}
                                </td>
                                <td className="p-2 text-center">
                                  <Badge
                                    variant={d.envio_financeiro ? "default" : "secondary"}
                                    className={`text-[10px] ${d.envio_financeiro ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
                                  >
                                    {d.envio_financeiro ? "Enviada" : "Pendente"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bottom Actions */}
        <div className="flex justify-center">
          <Button variant="outline" className="h-12 gap-2 w-full" onClick={() => { if (selectedDate) setReqData(selectedDate); setReqOpen(true); }}>
            <PlusCircle className="h-4 w-4" />
            Requisitar Agenda
          </Button>
        </div>
                </>
              )}

              {/* ABA: TIMESHEET */}
              {mobileTab === "timesheet" && (
                <div className="space-y-4">
                  {/* Visão Geral */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold">Visão Geral</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 p-3 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
                              <CalendarDays className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-blue-700">Agendas</span>
                          </div>
                          <div className="text-xl font-bold text-blue-900 leading-none">
                            {vgAgendasApontadas}
                            <span className="text-xs font-medium opacity-50 ml-1">/ {vgAgendasConfirmadas}</span>
                          </div>
                          <div className="text-[9px] text-blue-600">apontadas de {vgAgendasConfirmadas}</div>
                        </div>

                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 p-3 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center">
                              <Clock className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700">Disponibilidade</span>
                          </div>
                          <div className="text-xl font-bold text-emerald-900 leading-none">{vgDiasLivres}</div>
                          <div className="text-[9px] text-emerald-600">dias livres</div>
                        </div>

                        <div className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 p-3 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-amber-600 flex items-center justify-center">
                              <FileStack className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-amber-700">Pendências</span>
                          </div>
                          <div className={`text-xl font-bold leading-none ${totalPendencias > 0 ? "text-amber-900" : "text-muted-foreground"}`}>{totalPendencias}</div>
                          <div className="text-[9px] text-amber-600">{totalPendencias === 0 ? "nenhuma pendência" : "pendências ativas"}</div>
                        </div>

                        <div className="rounded-xl bg-violet-50 border border-violet-200 dark:bg-violet-950/30 p-3 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-violet-600 flex items-center justify-center">
                              <LayoutDashboard className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-violet-700">Projetos</span>
                          </div>
                          <div className="text-xl font-bold text-violet-900 leading-none">{vgProjetos}</div>
                          <div className="text-[9px] text-violet-600">ativos</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Controle de Horas */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold">Controle de Horas</CardTitle>
                          <Badge className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700">ativo</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {format(currentMonth, "MMM yyyy", { locale: ptBR })}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <div className="text-[9px] font-semibold uppercase text-muted-foreground mb-0.5">Agendado</div>
                          <div className="text-sm font-bold">{tsAgendadas}</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <div className="text-[9px] font-semibold uppercase text-muted-foreground mb-0.5">Apontado</div>
                          <div className="text-sm font-bold">{tsApontadas}</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <div className="text-[9px] font-semibold uppercase text-muted-foreground mb-0.5">Cobertura</div>
                          <div className={`text-sm font-bold ${
                            tsAgendadas === 0 ? "" :
                            (tsApontadas / tsAgendadas) >= 0.8 ? "text-emerald-600" :
                            (tsApontadas / tsAgendadas) >= 0.5 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {tsAgendadas === 0 ? "—" : `${Math.round((tsApontadas / tsAgendadas) * 100)}%`}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {tsSemanas.map((s) => {
                          const pct = s.agendadas === 0 ? 0 : Math.round((s.apontadas / s.agendadas) * 100);
                          const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
                          const textColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
                          return (
                            <div key={s.label} className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground w-5">{s.label}</span>
                              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className={`text-[10px] font-semibold min-w-[50px] text-right ${textColor}`}>
                                {s.apontadas} / {s.agendadas}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {tsProjetos.length > 0 && (
                        <div className="border-t pt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {tsProjetos.map((p) => (
                            <span key={p.cliente} className="text-[10px] text-muted-foreground">
                              {p.cliente} <strong className="text-foreground">{p.horas}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ABA: BACKLOG */}
              {/* ABA: BACKLOG — BL-004-B */}
              {mobileTab === "backlog" && (() => {
                const projetoSelecionado = selectedAgenda
                  ? offProjetos.find(p => p.nome_cliente === selectedAgenda.cliente)
                  : null;
                return projetoSelecionado ? (
                  <Card>
                    <CardContent className="pt-4">
                      <BacklogBoard
                        projetoId={projetoSelecionado.id}
                        projetoNome={projetoSelecionado.nome_cliente}
                        userId={user?.id || ""}
                        isCoordinator={false}
                        agendaData={selectedDate || undefined}
                        agendaCliente={selectedAgenda?.cliente}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center">
                          <ListTodo className="h-7 w-7 text-violet-400" />
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">Backlog do Projeto</p>
                        <p className="text-xs text-muted-foreground/60">Selecione uma agenda no calendário para ver o backlog do projeto</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* ABA: PENDÊNCIAS PMO — BL-019 */}
              {mobileTab === "pendencias" && (
                <PendenciasPMOCard
                  pendencias={pendencias}
                  totalPendencias={totalPendencias}
                  loadingPendencias={loadingPendencias}
                  onNavigateToDate={(data, agendaId) => {
                    setSelectedDate(data);
                    if (agendaId) setSelectedClienteId(agendaId);
                    setMobileTab("agenda");
                  }}
                  onOpenUpload={(agendaId, itemCronograma) => {
                    setSelectedClienteId(agendaId);
                    setApontamentoOpen(true);
                  }}
                />
              )}

            </div>

            {/* NAV BAR INFERIOR FIXA */}
            <nav className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-sm border-t safe-area-bottom">
              <div className="mx-auto max-w-lg flex items-center justify-around px-2 py-1">
                <button
                  onClick={() => setMobileTab("agenda")}
                  className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
                    mobileTab === "agenda" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <CalendarDays className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Agenda</span>
                  {mobileTab === "agenda" && <span className="w-1 h-1 rounded-full bg-primary" />}
                </button>

                <button
                  onClick={() => setMobileTab("timesheet")}
                  className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
                    mobileTab === "timesheet" ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  <Clock className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Timesheet</span>
                  {mobileTab === "timesheet" && <span className="w-1 h-1 rounded-full bg-emerald-600" />}
                </button>

                <button
                  onClick={() => setMobileTab("backlog")}
                  className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
                    mobileTab === "backlog" ? "text-violet-600" : "text-muted-foreground"
                  }`}
                >
                  <ListTodo className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Backlog</span>
                  {mobileTab === "backlog" && <span className="w-1 h-1 rounded-full bg-violet-600" />}
                </button>

                <button
                  onClick={() => setMobileTab("pendencias")}
                  className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
                    mobileTab === "pendencias" ? "text-amber-600" : "text-muted-foreground"
                  }`}
                >
                  <AlertCircle className="h-5 w-5" />
                  {totalPendencias > 0 && (
                    <span className="absolute -top-0.5 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {totalPendencias > 9 ? "9+" : totalPendencias}
                    </span>
                  )}
                  <span className="text-[10px] font-medium">Pendências</span>
                  {mobileTab === "pendencias" && <span className="w-1 h-1 rounded-full bg-amber-600" />}
                </button>
              </div>
            </nav>
          </div>
        ) : (
          /* ── DESKTOP: grid 60/40 ── */
          <div className="grid grid-cols-5 gap-6">
            {/* Coluna esquerda — operacional */}
            <div className="col-span-3 space-y-4">
              {/* ── CARD 1: MINHA AGENDA (Calendário) ── */}
              <Card>
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-sm font-bold">Minha Agenda</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold capitalize">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {["D","S","T","Q","Q","S","S"].map((d, i) => (
                      <div key={i} className="text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                    ))}
                    {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const status = getStatus(dateStr);
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`relative flex flex-col items-center justify-center rounded-md py-1.5 text-xs transition-colors ${
                            isSelected ? "bg-primary text-primary-foreground font-bold" : isToday(day) ? "bg-accent font-semibold" : "hover:bg-accent/50"
                          }`}
                        >
                          {day.getDate()}
                          {status && (
                            <span className={`mt-0.5 h-1 w-1 rounded-full ${statusColors[status]}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 text-[10px] text-muted-foreground mt-2">
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Feito</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Atrasada</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Planejada</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Aguard.</span>
                  </div>
                </CardContent>
              </Card>

              {/* ── CARD 2: PROJETOS DO DIA ── */}
              <Card>
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-400 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">
                        Projetos{selectedDate ? ` — ${format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })}` : ""}
                      </CardTitle>
                      {selectedDate && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {selectedAgendas.length} agenda(s) · selecione para agir
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  {!selectedDate ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Selecione um dia no calendário</p>
                  ) : selectedAgendas.length === 0 && selectedRequisicoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma agenda para este dia.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAgendas.map((a) => {
                        const statusDisplay = getAgendaStatusDisplay(a);
                        return (
                          <button
                            key={a.id}
                            onClick={() => setSelectedClienteId(a.id)}
                            className={`w-full rounded-xl border p-3 space-y-1 text-left transition-all ${
                              selectedClienteId === a.id
                                ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-200"
                                : "hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm">{a.cliente}</p>
                              <Badge className={`text-[10px] ${statusDisplay.color}`}>{statusDisplay.label}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground opacity-50">↳</span>
                              <span className="text-xs font-medium text-foreground">
                                {a.atividade}
                                {a.atividade_descricao ? ` — ${a.atividade_descricao}` : ""}
                              </span>
                            </div>
                            {a.item_cronograma && (
                              <div className="flex items-center gap-1 pl-3">
                                <span className="text-[10px] text-muted-foreground opacity-45">↳</span>
                                <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                  {a.item_cronograma}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {selectedRequisicoes.map((r) => (
                        <div
                          key={r.id}
                          className="w-full rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1 opacity-80"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sm">{r.cliente}</p>
                            <Badge className="text-[10px] bg-amber-500 text-white">Aguard. Aprov.</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.atividade || "—"}</p>
                          <p className="text-xs text-muted-foreground">{r.total_horas}h • {r.modalidade}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── CARD 3: REGISTRAR (dinâmico) ── */}
              <Card>
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <ClipboardEdit className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">Registrar</CardTitle>
                      {selectedAgenda ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {selectedAgenda.cliente} · {selectedAgenda.atividade}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Nenhum projeto selecionado</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  {!selectedAgenda || selectedAgenda.status === "aguardando_cancelamento" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-muted-foreground">Selecione um projeto acima para ver as ações disponíveis</span>
                      </div>
                      <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => { if (selectedDate) setReqData(selectedDate); setReqOpen(true); }}>
                        <PlusCircle className="h-4 w-4" />
                        Requisitar Agenda
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={handleOpenApontamento}
                        disabled={isApontamentoDone || isDateFuture || isProjetoNaoLiberado}
                        className="w-full h-11 text-sm font-bold gap-2"
                      >
                        {isProjetoNaoLiberado ? <>Projeto não liberado</> :
                         isDateFuture ? <>Data futura — não permitido</> :
                         isApontamentoDone ? <>Apontamento Registrado</> : (
                          <><ClipboardEdit className="h-4 w-4" />APONTAMENTO</>
                        )}
                      </Button>
                      {isApontamentoDone && (() => {
                        const proj = offProjetos.find((p) => p.nome_cliente === selectedAgenda?.cliente);
                        return (
                          <div className="space-y-2">
                            <Button
                              onClick={() => setOsResumoOpen(true)}
                              variant="outline"
                              className="w-full gap-2 text-sm border-primary text-primary hover:bg-primary/10"
                            >
                              <Receipt className="h-4 w-4" />
                              ENVIAR OS
                            </Button>
                            {(proj?.monday_board_url || proj?.sharepoint_pasta_url) && (
                              <div className="flex gap-2">
                                {proj?.monday_board_url && (
                                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => window.open(proj.monday_board_url!, "_blank")}>
                                    <ExternalLink className="h-3 w-3" />
                                    Monday
                                  </Button>
                                )}
                                {proj?.sharepoint_pasta_url && (
                                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => window.open(proj.sharepoint_pasta_url!, "_blank")}>
                                    <ExternalLink className="h-3 w-3" />
                                    SharePoint
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {canRequestCancel && (
                        <Button
                          variant="outline"
                          className="w-full gap-2 text-sm text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => setCancelAgendaOpen(true)}
                        >
                          <Ban className="h-4 w-4" />
                          Solicitar Cancelamento
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-sm"
                        onClick={handleOpenDespesa}
                      >
                        <Receipt className="h-4 w-4" />
                        Despesas
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── CARD 4: BACKLOG — BL-004-B ── */}
              <Card>
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                      <ListTodo className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-sm font-bold">Backlog</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  {(() => {
                    const projetoSelecionado = selectedAgenda
                      ? offProjetos.find(p => p.nome_cliente === selectedAgenda.cliente)
                      : null;
                    return projetoSelecionado ? (
                      <BacklogBoard
                        projetoId={projetoSelecionado.id}
                        projetoNome={projetoSelecionado.nome_cliente}
                        userId={user?.id || ""}
                        isCoordinator={false}
                        agendaData={selectedDate || undefined}
                        agendaCliente={selectedAgenda?.cliente}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <ListTodo className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">Selecione uma agenda no calendário</p>
                        <p className="text-[10px] text-muted-foreground/60">O backlog do projeto será exibido aqui</p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Coluna direita — gerencial */}
            <div className="col-span-2 space-y-4">
              {/* ── CARD 1: VISÃO GERAL ── */}
              <Card>
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-500 flex items-center justify-center flex-shrink-0">
                      <BarChart2 className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-sm font-bold">Visão Geral</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Agendas */}
                    <div className="rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Agendas</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 leading-none">
                        {vgAgendasApontadas}
                        <span className="text-sm font-medium opacity-50 ml-1">/ {vgAgendasConfirmadas}</span>
                      </div>
                      <div className="text-[9px] text-blue-600 dark:text-blue-400">
                        apontadas de {vgAgendasConfirmadas} confirmadas
                      </div>
                    </div>
                    {/* Disponibilidade */}
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Disponibilidade</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 leading-none">
                        {vgDiasLivres}
                      </div>
                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400">dias livres no mês</div>
                    </div>
                    {/* Pendências */}
                    <div className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-amber-600 flex items-center justify-center flex-shrink-0">
                          <FileStack className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Pendências</span>
                      </div>
                      <div className={`text-2xl font-bold leading-none ${totalPendencias > 0 ? "text-amber-900 dark:text-amber-100" : "text-muted-foreground"}`}>{totalPendencias}</div>
                      <div className="text-[9px] text-amber-600 dark:text-amber-400">{totalPendencias === 0 ? "nenhuma pendência" : "pendências ativas"}</div>
                    </div>
                    {/* Projetos */}
                    <div className="rounded-xl bg-violet-50 border border-violet-200 dark:bg-violet-950/30 dark:border-violet-800 p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
                          <LayoutDashboard className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">Projetos</span>
                      </div>
                      <div className="text-2xl font-bold text-violet-900 dark:text-violet-100 leading-none">
                        {vgProjetos}
                      </div>
                      <div className="text-[9px] text-violet-600 dark:text-violet-400">projetos ativos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── CARD 2: CONTROLE DE HORAS ── */}
              <Card>
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold">Controle de Horas</CardTitle>
                        <Badge className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700">ativo</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground capitalize min-w-[80px] text-center">
                        {format(currentMonth, "MMM yyyy", { locale: ptBR })}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-4">
                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Agendado</div>
                      <div className="text-base font-bold">{tsAgendadas}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Apontado</div>
                      <div className="text-base font-bold">{tsApontadas}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cobertura</div>
                      <div className={`text-base font-bold ${
                        tsAgendadas === 0 ? "text-foreground" :
                        (tsApontadas / tsAgendadas) >= 0.8 ? "text-emerald-600" :
                        (tsApontadas / tsAgendadas) >= 0.5 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {tsAgendadas === 0 ? "—" : `${Math.round((tsApontadas / tsAgendadas) * 100)}%`}
                      </div>
                    </div>
                  </div>
                  {/* Barras semanais */}
                  <div className="space-y-2">
                    {tsSemanas.map((s) => {
                      const pct = s.agendadas === 0 ? 0 : Math.round((s.apontadas / s.agendadas) * 100);
                      const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
                      const textColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
                      return (
                        <div key={s.label} className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-muted-foreground w-5">{s.label}</span>
                          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all ${barColor}`}
                              style={{ width: `${s.agendadas === 0 ? 0 : Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-semibold min-w-[60px] text-right ${textColor}`}>
                            {s.apontadas} / {s.agendadas}
                          </span>
                        </div>
                      );
                    })}
                    {tsSemanas.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhuma agenda no mês</p>
                    )}
                  </div>
                  {/* Breakdown por projeto */}
                  {tsProjetos.length > 0 && (
                    <div className="border-t pt-3 flex flex-wrap gap-x-4 gap-y-1">
                      {tsProjetos.map((p) => (
                        <span key={p.cliente} className="text-[10px] text-muted-foreground">
                          {p.cliente} <strong className="text-foreground">{p.horas}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── CARD 3: PENDÊNCIAS PMO — BL-019 ── */}
              <PendenciasPMOCard
                pendencias={pendencias}
                totalPendencias={totalPendencias}
                loadingPendencias={loadingPendencias}
                onNavigateToDate={(data, agendaId) => {
                  setSelectedDate(data);
                  if (agendaId) setSelectedClienteId(agendaId);
                }}
                onOpenUpload={(agendaId, itemCronograma) => {
                  setSelectedClienteId(agendaId);
                  setApontamentoOpen(true);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── DIALOGS GLOBAIS — funcionam em mobile e desktop ── */}

      {/* Cancelamento de Agenda */}
      <Dialog open={cancelAgendaOpen} onOpenChange={setCancelAgendaOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Solicitar Cancelamento</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{selectedAgenda?.cliente}</strong> — {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Justificativa</Label>
              <Textarea
                value={cancelJustificativa}
                onChange={(e) => setCancelJustificativa(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <div className="shrink-0 border-t px-4 py-3">
            <Button
              className="w-full"
              onClick={handleSolicitarCancelamento}
              disabled={!cancelJustificativa.trim()}
            >
              Enviar Solicitação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Despesas */}
      <Dialog open={despesaOpen} onOpenChange={setDespesaOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Registrar Despesa</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{selectedAgenda?.cliente}</strong> — {selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Despesa</Label>
              {projetoDespesas.length > 0 ? (
                <Select value={despDescricao} onValueChange={handleDespesaTipoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {projetoDespesas.map((d) => (
                      <SelectItem key={d.id} value={d.tipo_despesa}>
                        {d.tipo_despesa} (máx R$ {d.valor_maximo.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={despDescricao} onChange={(e) => setDespDescricao(e.target.value)} placeholder="Ex: Almoço, Combustível..." />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Valor (R$)
                {despValorMaximo !== null && (
                  <span className="text-muted-foreground ml-1">— máx R$ {despValorMaximo.toFixed(2)}</span>
                )}
              </Label>
              <Input type="number" step="0.01" value={despValor} onChange={(e) => handleDespesaValorChange(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Foto da Despesa</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent/50 transition-colors">
                    <Camera className="h-4 w-4" />
                    {despFoto ? despFoto.name : "Tirar foto ou selecionar arquivo"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setDespFoto(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t px-4 py-3">
            <Button
              className="w-full"
              onClick={handleDespesa}
              disabled={despLoading || !despDescricao || !despValor}
            >
              {despLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Despesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Requisitar Agenda */}
      <Dialog open={reqOpen} onOpenChange={(open) => {
        setReqOpen(open);
        if (open && selectedDate) setReqData(selectedDate);
      }}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Requisitar Agenda</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={reqData} onChange={(e) => setReqData(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total de Horas</Label>
                <Input type="number" value={reqHoras} onChange={(e) => setReqHoras(e.target.value)} placeholder="8" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Popover open={reqClienteOpen} onOpenChange={setReqClienteOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={reqClienteOpen} className="w-full justify-between font-normal">
                    {reqCliente || "Selecione o cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {offProjetos.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.nome_cliente}
                            onSelect={async (value) => {
                              const projeto = offProjetos.find((proj) => proj.nome_cliente.toLowerCase() === value.toLowerCase());
                              const selectedName = projeto?.nome_cliente || value;
                              const isSame = selectedName === reqCliente;

                              if (isSame) {
                                setReqCliente("");
                                setReqCoordenador("");
                                setReqClienteOpen(false);
                                return;
                              }

                              setReqCliente(selectedName);
                              setReqClienteOpen(false);
                              setReqAtividade("");

                              loadReqAtividades(selectedName);

                              if (!projeto?.id) {
                                setReqCoordenador("");
                                return;
                              }

                              const { data, error } = await supabase.functions.invoke("project-coordinator", {
                                body: { projectId: projeto.id },
                              });

                              if (error) {
                                setReqCoordenador("");
                                return;
                              }

                              setReqCoordenador(data?.coordinator_name || "");
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", reqCliente === p.nome_cliente ? "opacity-100" : "opacity-0")} />
                            {p.nome_cliente}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Atividade *</Label>
              {reqAtividadesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : reqAtividades.length === 0 && reqCliente ? (
                <p className="text-sm text-destructive">Nenhuma atividade cadastrada.</p>
              ) : (
                <Select value={reqAtividade} onValueChange={setReqAtividade} disabled={!reqCliente}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    {reqAtividades.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.codigo} - {a.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Modalidade *</Label>
                <Select value={reqModalidade} onValueChange={setReqModalidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remoto">Remoto</SelectItem>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Coordenador</Label>
                <Input value={reqCoordenador} readOnly disabled placeholder="Auto" className="bg-muted" />
              </div>
            </div>
            <div className="border-t pt-1" />
            <div className="space-y-1">
              <Label className="text-xs">Descrição da atividade</Label>
              <Textarea
                value={reqDescricaoAtividade}
                onChange={(e) => setReqDescricaoAtividade(e.target.value)}
                placeholder="Descreva a atividade que será executada..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Justificativa{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                value={reqJustificativa}
                onChange={(e) => setReqJustificativa(e.target.value)}
                placeholder="Justificativa para a solicitação..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <div className="shrink-0 border-t px-4 py-3">
            <Button className="w-full" onClick={handleRequisitar} disabled={!reqAtividade}>
              Enviar Requisição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apontamento */}
      <Dialog open={apontamentoOpen} onOpenChange={setApontamentoOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Apontamento — {selectedAgenda?.cliente}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Data: <strong>{selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</strong> — Atividade planejada: <strong>{selectedAgenda?.atividade}</strong>
            </p>

            {/* Selected activities for apontamento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Atividades a Apontar</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddAtividade} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
              {atividadesApontadas.map((aa, index) => {
                const available = getAvailableAtividades(index);
                const selectedAtv = projetoAtividades.find((a) => a.codigo === aa.atividade_codigo);
                const maxHoras = selectedAtv ? getSaldo(selectedAtv) : 0;
                  return (
                  <div key={index} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Atividade</Label>
                      <Select value={aa.atividade_codigo} onValueChange={(v) => handleChangeAtividade(index, v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((a) => (
                            <SelectItem key={a.codigo} value={a.codigo}>
                              {a.codigo} - {a.descricao}
                            </SelectItem>
                          ))}
                          {aa.atividade_codigo && !available.find((a) => a.codigo === aa.atividade_codigo) && selectedAtv && (
                            <SelectItem value={aa.atividade_codigo}>
                              {aa.atividade_codigo} - {aa.atividade_descricao}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Horas</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max={maxHoras}
                        value={aa.horas || ""}
                        onChange={(e) => handleChangeHoras(index, parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveAtividade(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    </div>

                    {/* Feeling de conclusão */}
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-semibold">
                            % de conclusão da atividade
                            <span className="ml-2 text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                              obrigatório
                            </span>
                          </Label>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Seu feeling sobre o avanço desta atividade
                          </p>
                        </div>
                        <div className={`min-w-[52px] h-10 rounded-lg flex flex-col items-center justify-center text-sm font-bold border ${
                          aa.percentual_feeling === null ? "bg-muted border-border text-muted-foreground" :
                          aa.percentual_feeling >= 70 ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                          aa.percentual_feeling >= 40 ? "bg-amber-50 border-amber-300 text-amber-700" :
                          "bg-red-50 border-red-300 text-red-700"
                        }`}>
                          {aa.percentual_feeling === null ? "—" : `${aa.percentual_feeling}%`}
                          <span className="text-[9px] font-normal opacity-60 leading-none">feeling</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={aa.percentual_feeling ?? 0}
                          onChange={(e) => handleChangeFeeling(index, parseInt(e.target.value))}
                          className="w-full accent-primary h-2 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {(() => {
                        if (aa.percentual_feeling === null) return null;
                        const atv = projetoAtividades.find((a) => a.codigo === aa.atividade_codigo);
                        if (!atv || atv.horas === 0) return null;
                        const horasConsumidas = atv.horas - getSaldo(atv) + aa.horas;
                        const previsto = Math.round((horasConsumidas / atv.horas) * 100);
                        const desvio = previsto - aa.percentual_feeling;
                        if (desvio <= 20) return null;
                        return (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                            <p className="text-[10px] text-amber-700 font-medium">
                              Desvio de {desvio}pp detectado — feeling ({aa.percentual_feeling}%) abaixo do previsto ({previsto}%). O coordenador será notificado.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              {atividadesApontadas.length === 0 && (
                <p className="text-xs text-muted-foreground">Clique em "Adicionar" para incluir uma atividade.</p>
              )}
            </div>

            {/* Modalidade */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Modalidade</Label>
              <Select value={apontModalidade} onValueChange={setApontModalidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Remoto">Remoto</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Descrição das atividades realizadas</Label>
              <Textarea
                value={apontDescricao}
                onChange={(e) => setApontDescricao(e.target.value)}
                placeholder="Descreva as atividades realizadas..."
                rows={3}
              />
            </div>
          </div>
          <div className="shrink-0 border-t px-4 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setApontamentoOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleGravarApontamento}
              disabled={apontamentoLoading || atividadesApontadas.length === 0}
            >
              {apontamentoLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gravar Apontamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo do Apontamento */}
      <Dialog open={resumoOpen} onOpenChange={setResumoOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Resumo do Apontamento</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="text-sm space-y-1">
              <p>Cliente: <strong>{selectedAgenda?.cliente}</strong></p>
              <p>Data: <strong>{selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</strong></p>
              <p>Modalidade: <strong>{apontModalidade}</strong></p>
            </div>

            <div className="rounded-lg border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Atividade</th>
                    <th className="text-right px-3 py-2 font-medium">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {atividadesApontadas.map((aa, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">{aa.atividade_codigo} - {aa.atividade_descricao}</td>
                      <td className="px-3 py-2 text-right">{aa.horas}h</td>
                    </tr>
                  ))}
                  {projetoDeslocamento > 0 && (
                    <tr className="border-b">
                      <td className="px-3 py-2 italic">Deslocamento</td>
                      <td className="px-3 py-2 text-right">{projetoDeslocamento}h</td>
                    </tr>
                  )}
                  <tr className="font-semibold bg-muted/30">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">
                      {atividadesApontadas.reduce((s, a) => s + a.horas, 0) + projetoDeslocamento}h
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {apontDescricao && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Descrição</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{apontDescricao}</p>
              </div>
            )}

            {/* Seção de documento */}
            {cronogramaItemDoc && (
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documento</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cronogramaItemDoc.doc_satisfeito ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {cronogramaItemDoc.doc_satisfeito ? "✓ Entregue" : "Pendente"}
                  </span>
                </div>

                {cronogramaItemDoc.doc_satisfeito ? (
                  <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    Documento já entregue via Monday ou APP. Nenhuma ação necessária.
                  </p>
                ) : (
                  <>
                    {docFile ? (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {docFile.name.split(".").pop()?.toUpperCase().slice(0,3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-blue-800 truncate">{docFile.name}</p>
                          <p className="text-xs text-blue-600">{(docFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-600" onClick={() => setDocFile(null)}>✕</Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-1 border-2 border-dashed border-muted-foreground/30 rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <span className="text-xs font-medium text-muted-foreground">Clique para anexar documento</span>
                        <span className="text-xs text-muted-foreground/60">PDF, Word, imagem — qualquer formato</span>
                        <input type="file" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                      </label>
                    )}
                    {docFile && (
                      <Button size="sm" className="w-full gap-2" onClick={handleUploadDoc} disabled={docUploading}>
                        {docUploading && <Loader2 className="h-3 w-3 animate-spin" />}
                        Enviar documento ao SharePoint
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      Opcional — você pode enviar depois pelo Monday ou APP
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0 border-t px-4 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => { setResumoOpen(false); setApontamentoOpen(true); }}>
              Voltar
            </Button>
            <Button onClick={handleConfirmarApontamento} disabled={resumoLoading}>
              {resumoLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
            <Button onClick={handleEnviarOS} disabled={resumoLoading} className="gap-1">
              {resumoLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar OS
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal OS Resumo com Impressão */}
      <Dialog open={osResumoOpen} onOpenChange={setOsResumoOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" id="os-print-area">
            {(() => {
              const proj = offProjetos.find((p) => p.nome_cliente === selectedAgenda?.cliente);
              return (
                <>
                  <div className="text-sm space-y-1">
                    <p>Cliente: <strong>{selectedAgenda?.cliente}</strong></p>
                    <p>Data: <strong>{selectedDate && format(parseISO(selectedDate), "dd/MM/yyyy")}</strong></p>
                    <p>Consultor: <strong>{user?.email}</strong></p>
                  </div>
                  <div className="rounded-lg border overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium">Atividade</th>
                          <th className="text-right px-3 py-2 font-medium">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atividadesApontadas.map((aa, i) => (
                          <tr key={i} className="border-b">
                            <td className="px-3 py-2">{aa.atividade_codigo} - {aa.atividade_descricao}</td>
                            <td className="px-3 py-2 text-right">{aa.horas}h</td>
                          </tr>
                        ))}
                        <tr className="font-semibold bg-muted/30">
                          <td className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right">{atividadesApontadas.reduce((s, a) => s + a.horas, 0)}h</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {(proj?.monday_board_url || proj?.sharepoint_pasta_url) && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acessos do Projeto</p>
                      <div className="flex gap-2">
                        {proj?.monday_board_url && (
                          <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => window.open(proj.monday_board_url!, "_blank")}>
                            <ExternalLink className="h-3 w-3" />
                            Monday
                          </Button>
                        )}
                        {proj?.sharepoint_pasta_url && (
                          <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => window.open(proj.sharepoint_pasta_url!, "_blank")}>
                            <ExternalLink className="h-3 w-3" />
                            SharePoint
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="shrink-0 border-t px-4 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setOsResumoOpen(false)}>Fechar</Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              const el = document.getElementById("os-print-area");
              if (!el) return;
              const w = window.open("", "_blank")!;
              w.document.write(`<html><head><title>OS</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>${el.innerHTML}</body></html>`);
              w.document.close();
              w.print();
            }}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button className="gap-2" onClick={() => { handleEnviarOSRedundante(); setOsResumoOpen(false); }}>
              <Receipt className="h-4 w-4" />
              Enviar por Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exportar PDF */}
      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exportar PDF</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o relatório de{" "}
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" className="gap-1" onClick={() => exportarPDF("horas")}>
              <FileDown className="h-4 w-4" /> Horas
            </Button>
            <Button variant="outline" className="gap-1" onClick={() => exportarPDF("despesas")}>
              <FileDown className="h-4 w-4" /> Despesas
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resumo Financeiro */}
      <Dialog open={resumoFinanceiroOpen} onOpenChange={setResumoFinanceiroOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="h-5 w-5 text-emerald-600" />
              Resumo Financeiro
              <span className="text-sm font-normal text-muted-foreground capitalize">
                — {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end px-4 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setExportDialogOpen(true)} disabled={rfLoading}>
              <FileDown className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
          </div>

          {rfLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="horas" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 shrink-0">
                <TabsTrigger value="horas">Horas</TabsTrigger>
                <TabsTrigger value="despesas">Despesas</TabsTrigger>
              </TabsList>

              <TabsContent value="horas" className="flex-1 overflow-y-auto px-4 pb-4 mt-0">
                <p className="text-[11px] text-muted-foreground mb-2 italic">
                  Role para ver Translado e Total
                </p>

                <div className="rounded-lg border overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium text-muted-foreground">Data</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Horas</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Transl.</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfAgendas.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhuma agenda no mês.</td></tr>
                      ) : rfAgendas.map((ag) => {
                        const hLinha = ag.horas_apontadas || ag.horas_planejadas;
                        const total = hLinha + ag.deslocamento;
                        return (
                          <tr key={ag.id} className="border-t">
                            <td className="p-2 whitespace-nowrap">{format(parseISO(ag.data), "dd/MM/yyyy")}</td>
                            <td className="p-2">{ag.cliente}</td>
                            <td className="p-2">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getRfStatusClass(ag.status)}`}>
                                {getRfStatusLabel(ag.status)}
                              </span>
                            </td>
                            <td className="p-2 text-right">{formatHoras(hLinha)}</td>
                            <td className="p-2 text-right">{ag.deslocamento > 0 ? formatHoras(ag.deslocamento) : "—"}</td>
                            <td className="p-2 text-right font-medium">{formatHoras(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {rfAgendas.length > 0 && (() => {
                  const horasTrab = rfAgendas.reduce((s, a) => s + a.horas_apontadas, 0);
                  const horasPrev = rfAgendas.reduce((s, a) => s + a.horas_planejadas, 0);
                  const translados = rfAgendas.reduce((s, a) => s + a.deslocamento, 0);
                  const totalGeral = rfAgendas.reduce((s, a) => s + (a.horas_apontadas || a.horas_planejadas) + a.deslocamento, 0);
                  const porCliente: Record<string, number> = {};
                  for (const a of rfAgendas) {
                    porCliente[a.cliente] = (porCliente[a.cliente] || 0) + (a.horas_apontadas || a.horas_planejadas) + a.deslocamento;
                  }
                  return (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold">Totalizadores do mês</p>
                      <div className="space-y-1">
                        {Object.entries(porCliente).map(([cli, h]) => (
                          <div key={cli} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{cli}</span>
                            <span className="font-medium">{formatHoras(h)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Agendas</p>
                          <p className="font-semibold text-sm">{rfAgendas.length}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Translados</p>
                          <p className="font-semibold text-sm">{formatHoras(translados)}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Trabalhadas</p>
                          <p className="font-semibold text-sm">{formatHoras(horasTrab)}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Previstas</p>
                          <p className="font-semibold text-sm">{formatHoras(horasPrev)}</p>
                        </div>
                        <div className="col-span-2 rounded-lg border p-2 text-center bg-muted/30">
                          <p className="text-muted-foreground">Total geral</p>
                          <p className="font-bold text-base">{formatHoras(totalGeral)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="despesas" className="flex-1 overflow-y-auto px-4 pb-4 mt-0">
                <p className="text-[11px] text-muted-foreground mb-2 italic">
                  Role para ver Status e Valor
                </p>

                <div className="rounded-lg border overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium text-muted-foreground">Data</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Despesa</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfDespesas.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma despesa no mês.</td></tr>
                      ) : rfDespesas.map((d) => (
                        <tr key={d.id} className="border-t">
                          <td className="p-2 whitespace-nowrap">{format(parseISO(d.data), "dd/MM/yyyy")}</td>
                          <td className="p-2">{d.cliente}</td>
                          <td className="p-2">{d.descricao}</td>
                          <td className="p-2">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getDespStatusClass(d.status_despesa)}`}>
                              {d.status_despesa}
                            </span>
                          </td>
                          <td className="p-2 text-right whitespace-nowrap font-medium">
                            {d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {rfDespesas.length > 0 && (() => {
                  const totalValor = rfDespesas.reduce((s, d) => s + d.valor, 0);
                  const porCliente: Record<string, number> = {};
                  for (const d of rfDespesas) porCliente[d.cliente] = (porCliente[d.cliente] || 0) + d.valor;
                  return (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold">Totalizadores do mês</p>
                      <div className="space-y-1">
                        {Object.entries(porCliente).map(([cli, val]) => (
                          <div key={cli} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{cli}</span>
                            <span className="font-medium">{val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Lançamentos</p>
                          <p className="font-semibold text-sm">{rfDespesas.length}</p>
                        </div>
                        <div className="rounded-lg border p-2 text-center">
                          <p className="text-muted-foreground">Total valor</p>
                          <p className="font-semibold text-sm">{totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
