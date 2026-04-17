import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, BarChart2, Calendar, CheckCircle, AlertTriangle, Clock, TrendingUp, Save, Eye, Plus } from "lucide-react";
import aceexLogo from "@/assets/aceex_logo.jpg";

type Projeto = {
  id: string;
  nome_cliente: string;
  codigo_cliente: string;
  horas_contratadas: number;
  status: string;
  coordenador_id: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  email_contato: string | null;
};

type Atividade = {
  id: string;
  projeto_id: string;
  codigo: string;
  descricao: string;
  horas: number;
  data_inicio: string | null;
  data_fim: string | null;
};

type CronogramaItem = {
  id: string;
  atividade_id: string;
  codigo: string;
  descricao: string;
  horas_reservadas: number;
  data_inicio: string | null;
  data_fim: string | null;
};

type Apontamento = {
  atividade_codigo: string;
  horas: number;
  data: string;
  cliente: string;
};

type Agenda = {
  id: string;
  data: string;
  usuario: string;
  atividade: string;
  status: string;
  item_cronograma: string | null;
  cliente: string;
};

type Risco = {
  id: string;
  descricao: string;
  probabilidade: string;
  impacto: string;
  status: string;
  acao_mitigadora: string | null;
  responsavel_id: string | null;
};

type Stakeholder = {
  id: string;
  nome: string;
  cargo: string | null;
};

type BaselineItem = {
  id: string;
  codigo: string;
  descricao: string;
  horas_reservadas: number;
  data_inicio: string | null;
  data_fim: string | null;
};

type BaselineAtividade = {
  id: string;
  codigo: string;
  descricao: string;
  horas: number;
  data_inicio: string | null;
  data_fim: string | null;
  itens?: BaselineItem[];
};

type Baseline = {
  id: string;
  versao: string;
  descricao: string | null;
  created_at: string;
  snapshot: { atividades: BaselineAtividade[] };
};

export default function AdminStatusReport() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoSelecionado, setProjetoSelecionado] = useState<Projeto | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [cronogramaMap, setCronogramaMap] = useState<Record<string, CronogramaItem[]>>({});
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [proximas, setProximas] = useState<Agenda[]>([]);
  const [concluidas, setConcluidas] = useState<Agenda[]>([]);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselineSelecionada, setBaselineSelecionada] = useState<Baseline | null>(null);
  const [exibirBaseline, setExibirBaseline] = useState(false);
  const [exibirSubitens, setExibirSubitens] = useState(false);
  const [exibirEncerrados, setExibirEncerrados] = useState(false);
  const [hideHoras, setHideHoras] = useState(false);
  const [coordenadorNome, setCoordenadorNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [modalBaselineOpen, setModalBaselineOpen] = useState(false);
  const [baselineVersao, setBaselineVersao] = useState("");
  const [baselineDescricao, setBaselineDescricao] = useState("");
  const ganttRef = useRef<HTMLCanvasElement>(null);

  type GanttTooltipData = {
    x: number; y: number; label: string;
    inicio: string; fim: string; status: string;
    horas: number; real: number; pct: number; cor: string;
  };
  const [ganttTooltip, setGanttTooltip] = useState<GanttTooltipData | null>(null);
  const [ganttThumbW, setGanttThumbW] = useState(40);
  const [ganttThumbL, setGanttThumbL] = useState(0);

  useEffect(() => {
    loadProjetos();
  }, []);

  useEffect(() => {
    if (projetoSelecionado) loadDados(projetoSelecionado);
  }, [projetoSelecionado]);

  useEffect(() => {
    if (!projetoSelecionado || loading) return;
    const tryDraw = () => {
      const canvas = ganttRef.current;
      if (!canvas) return;
      const w = canvas.parentElement?.clientWidth
             || canvas.parentElement?.offsetWidth || 0;
      if (w > 0) {
        drawGantt();
      } else {
        requestAnimationFrame(tryDraw);
      }
    };
    const container = ganttRef.current?.parentElement;
    if (!container) { requestAnimationFrame(tryDraw); return; }
    const ro = new ResizeObserver(() => requestAnimationFrame(tryDraw));
    ro.observe(container);
    requestAnimationFrame(tryDraw);
    return () => ro.disconnect();
  }, [atividades, apontamentos, cronogramaMap,
      exibirSubitens, exibirBaseline, baselineSelecionada, loading]);

  const loadProjetos = async () => {
    const { data } = await supabase
      .from("projetos")
      .select("id, nome_cliente, codigo_cliente, horas_contratadas, status, coordenador_id, contato_nome, contato_telefone, email_contato")
      .order("nome_cliente");
    setProjetos(data || []);
    if (data && data.length > 0) setProjetoSelecionado(data[0]);
  };

  const loadDados = async (projeto: Projeto) => {
    setLoading(true);

    // Load atividades first to get IDs for cronograma
    const { data: ativsData } = await supabase
      .from("projeto_atividades")
      .select("*")
      .eq("projeto_id", projeto.id)
      .order("codigo");
    const ativs = ativsData || [];
    setAtividades(ativs);

    const atividadeIds = ativs.map((a) => a.id);

    const [cronRes, apontRes, proxRes, conclRes, riscosRes, stakRes, baseRes] = await Promise.all([
      atividadeIds.length > 0
        ? supabase.from("cronograma_itens").select("*").in("atividade_id", atividadeIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("apontamento_atividades")
        .select("atividade_codigo, horas, data, cliente")
        .eq("cliente", projeto.codigo_cliente),
      supabase
        .from("agendas")
        .select("*")
        .eq("cliente", projeto.codigo_cliente)
        .gte("data", new Date().toISOString().slice(0, 10))
        .neq("status", "Cancelado")
        .order("data", { ascending: true })
        .limit(8),
      supabase
        .from("agendas")
        .select("*")
        .eq("cliente", projeto.codigo_cliente)
        .eq("status", "Concluído")
        .order("data", { ascending: false })
        .limit(8),
      supabase
        .from("projeto_riscos")
        .select("*")
        .eq("projeto_id", projeto.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("projeto_stakeholders")
        .select("id, nome, cargo")
        .eq("projeto_id", projeto.id)
        .order("nome"),
      supabase
        .from("projeto_baseline")
        .select("*")
        .eq("projeto_id", projeto.id)
        .order("created_at", { ascending: false }),
    ]);

    // Build cronograma map
    const map: Record<string, CronogramaItem[]> = {};
    ((cronRes.data as any[]) || []).forEach((item) => {
      if (!map[item.atividade_id]) map[item.atividade_id] = [];
      map[item.atividade_id].push(item);
    });
    setCronogramaMap(map);

    setApontamentos((apontRes.data as Apontamento[]) || []);
    setProximas((proxRes.data as Agenda[]) || []);
    setConcluidas((conclRes.data as Agenda[]) || []);
    setRiscos((riscosRes.data as Risco[]) || []);
    setStakeholders((stakRes.data as Stakeholder[]) || []);

    const baselinesList = ((baseRes.data as any[]) || []).map((b) => ({
      ...b,
      snapshot: typeof b.snapshot === "string" ? JSON.parse(b.snapshot) : b.snapshot,
    })) as Baseline[];
    setBaselines(baselinesList);
    if (baselinesList.length > 0) setBaselineSelecionada(baselinesList[0]);
    else setBaselineSelecionada(null);

    if (projeto.coordenador_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", projeto.coordenador_id)
        .single();
      setCoordenadorNome(prof?.name || "—");
    } else {
      setCoordenadorNome("");
    }

    setLoading(false);
  };

  // === Calculation helpers ===

  const getHorasRealizadasAtividade = (atividade: Atividade): number => {
    return apontamentos
      .filter((a) => a.atividade_codigo === atividade.codigo)
      .reduce((sum, a) => sum + a.horas, 0);
  };

  const getHorasRealizadasTotal = (): number => {
    return atividades.reduce((sum, a) => sum + getHorasRealizadasAtividade(a), 0);
  };

  const getStatusAtividade = (atividade: Atividade): string => {
    const realizado = getHorasRealizadasAtividade(atividade);
    const hoje = new Date().toISOString().slice(0, 10);
    if (realizado >= atividade.horas) return "Concluído";
    if (atividade.data_fim && atividade.data_fim < hoje && realizado < atividade.horas) return "Atrasado";
    if (atividade.data_inicio && atividade.data_inicio > hoje) return "Não iniciado";
    return "Em andamento";
  };

  const getCorAtividade = (status: string): string => {
    switch (status) {
      case "Concluído": return "#10b981";
      case "Atrasado": return "#f59e0b";
      case "Não iniciado": return "#cbd5e1";
      case "Em andamento": return "#3b82f6";
      default: return "#94a3b8";
    }
  };

  const formatarData = (iso: string | null): string => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatarDataCurta = (iso: string): string => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  const calcularIdp = (): number => {
    const hoje = new Date();
    let valorPlanejado = 0;
    let valorAgregado = 0;
    atividades.forEach(a => {
      if (!a.data_inicio || !a.data_fim) return;
      const inicio = new Date(a.data_inicio);
      const fim = new Date(a.data_fim);
      const durTotal = fim.getTime() - inicio.getTime();
      if (durTotal <= 0) return;
      const agora = Math.min(hoje.getTime(), fim.getTime());
      const decorrido = Math.max(0, agora - inicio.getTime());
      const fracPlano = Math.min(decorrido / durTotal, 1);
      valorPlanejado += a.horas * fracPlano;
      const horasReais = getHorasRealizadasAtividade(a);
      const fracReal = a.horas > 0 ? Math.min(horasReais / a.horas, 1) : 0;
      valorAgregado += a.horas * fracReal;
    });
    if (valorPlanejado === 0) return 1;
    return Math.round((valorAgregado / valorPlanejado) * 100) / 100;
  };

  const calcularIdc = (): number => {
    let valorAgregado = 0;
    const horasTotaisRealizadas = getHorasRealizadasTotal();
    atividades.forEach(a => {
      const horasReais = getHorasRealizadasAtividade(a);
      const fracReal = a.horas > 0 ? Math.min(horasReais / a.horas, 1) : 0;
      valorAgregado += a.horas * fracReal;
    });
    if (horasTotaisRealizadas === 0) return 1;
    return Math.round((valorAgregado / horasTotaisRealizadas) * 100) / 100;
  };

  const getIndiceStatus = (valor: number) => {
    if (valor >= 1.0) return { label: "No controle", classe: "bg-emerald-100 text-emerald-800" };
    if (valor >= 0.8) return { label: "Atenção", classe: "bg-yellow-100 text-yellow-800" };
    return { label: "Crítico", classe: "bg-red-100 text-red-800" };
  };

  const handlePrint = () => {
    drawGantt();
    const printEl = document.getElementById('print-status-report');
    if (printEl) printEl.style.display = 'block';
    setTimeout(() => {
      window.print();
      if (printEl) printEl.style.display = 'none';
    }, 400);
  };

  // === Helpers ===

  const parseDataUTC = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };

  const fmtDataCurta = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
  };

  const getGanttRowAt = (
    canvas: HTMLCanvasElement, cx: number, cy: number
  ) => {
    const rows   = (canvas as any)._ganttRows   as any[];
    const HEAD_H = (canvas as any)._ganttHeadH  as number;
    const ROW_H  = (canvas as any)._ganttRowH   as number;
    const LW     = (canvas as any)._ganttLabelW as number;
    if (!rows || cy < HEAD_H || cx < LW) return null;
    const i = Math.floor((cy - HEAD_H) / ROW_H);
    return (i >= 0 && i < rows.length) ? rows[i] : null;
  };

  const buildTooltipData = (
    row: any,
    canvas: HTMLCanvasElement,
    cx: number, cy: number
  ): GanttTooltipData | null => {
    const d = row.atividade || row.sub;
    if (!d) return null;
    const dataI = row.atividade ? row.atividade.data_inicio : row.sub.data_inicio;
    const dataF = row.atividade ? row.atividade.data_fim : row.sub.data_fim;
    if (!dataI || !dataF) return null;
    const horas  = row.atividade ? row.atividade.horas : row.sub.horas_reservadas;
    const real   = row.atividade ? getHorasRealizadasAtividade(row.atividade) : 0;
    const pct    = horas > 0 ? Math.round(real / horas * 100) : 0;
    const cor    = row.atividade
      ? getCorAtividade(getStatusAtividade(row.atividade))
      : "#3b82f6";
    const status = row.atividade
      ? getStatusAtividade(row.atividade)
      : (pct === 100 ? "Concluído" : pct > 0 ? "Em andamento" : "Não iniciado");
    const ttW    = 200;
    let tx = cx + 14;
    if (tx + ttW > canvas.offsetWidth) tx = cx - ttW - 8;
    return {
      x: Math.max(0, tx), y: Math.max(0, cy - 10),
      label: row.label, inicio: fmtDataCurta(dataI),
      fim: fmtDataCurta(dataF), status, horas, real, pct, cor,
    };
  };

  const handleGanttHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ganttRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const row  = getGanttRowAt(canvas, cx, cy);
    if (!row) { setGanttTooltip(null); return; }
    setGanttTooltip(buildTooltipData(row, canvas, cx, cy));
  };

  const handleGanttTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = ganttRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.touches[0].clientX - rect.left;
    const cy   = e.touches[0].clientY - rect.top;
    const row  = getGanttRowAt(canvas, cx, cy);
    if (!row) { setGanttTooltip(null); return; }
    setGanttTooltip(buildTooltipData(row, canvas, cx, cy));
  };

  const updateGanttScrollThumb = () => {
    const el = document.getElementById("gantt-scroll-container");
    const track = document.getElementById("gantt-scroll-track");
    if (!el || !track) return;
    const sw = el.scrollWidth, cw = el.clientWidth;
    const tw = track.clientWidth;
    if (sw <= cw) { setGanttThumbW(tw); setGanttThumbL(0); return; }
    const thw = Math.max(cw / sw * tw, 24);
    const thl = (el.scrollLeft / (sw - cw)) * (tw - thw);
    setGanttThumbW(thw);
    setGanttThumbL(thl);
  };

  const handleScrollTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el    = document.getElementById("gantt-scroll-container");
    const track = document.getElementById("gantt-scroll-track");
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const tw   = track.clientWidth;
    const thw  = ganttThumbW;
    const frac = (e.clientX - rect.left - thw / 2) / (tw - thw);
    el.scrollLeft = Math.max(0, frac * (el.scrollWidth - el.clientWidth));
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = document.getElementById("gantt-scroll-container");
    const track = document.getElementById("gantt-scroll-track");
    if (!el || !track) return;
    const startX   = e.clientX;
    const startScr = el.scrollLeft;
    const tw       = track.clientWidth;
    const onMove   = (mv: MouseEvent) => {
      const delta = (mv.clientX - startX) / (tw - ganttThumbW)
        * (el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(0, startScr + delta);
      updateGanttScrollThumb();
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    e.preventDefault();
  };

  const handleThumbTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = document.getElementById("gantt-scroll-container");
    const track = document.getElementById("gantt-scroll-track");
    if (!el || !track) return;
    const startX   = e.touches[0].clientX;
    const startScr = el.scrollLeft;
    const tw       = track.clientWidth;
    const onMove   = (mv: TouchEvent) => {
      const delta =
        (mv.touches[0].clientX - startX) / (tw - ganttThumbW)
        * (el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(0, startScr + delta);
      updateGanttScrollThumb();
    };
    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend",  onEnd);
  };

  useEffect(() => {
    const el = document.getElementById("gantt-scroll-container");
    if (!el) return;
    const onScroll = () => updateGanttScrollThumb();
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [ganttThumbW]);

  useEffect(() => {
    updateGanttScrollThumb();
  }, [atividades, exibirSubitens]);

  // === drawGantt — Canvas ===

  const drawGantt = () => {
    const canvas = ganttRef.current;
    if (!canvas) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const scrollEl = canvas.parentElement;
    if (!scrollEl) return;
    const visibleW = scrollEl.clientWidth || scrollEl.offsetWidth || 500;

    const isMobile  = visibleW < 500;
    const YEAR_H    = isMobile ? 14 : 16;
    const MON_H     = isMobile ? 15 : 18;
    const HEAD_H    = YEAR_H + MON_H;
    const ROW_H     = isMobile ? 26 : 30;
    const BAR_MAIN  = isMobile ? 11 : 14;
    const BAR_SUB   = isMobile ? 8  : 10;
    const PAD_R     = isMobile ? 10 : 16;
    const MON_MIN_W = isMobile ? 28 : 36;
    const FONT_LBL  = isMobile ? 10 : 11;
    const FONT_SUB  = isMobile ? 9  : 10;
    const MON_PT    = ['Jan','Fev','Mar','Abr','Mai','Jun',
                       'Jul','Ago','Set','Out','Nov','Dez'];

    type GRow = {
      label: string; isSub: boolean;
      atividade?: Atividade; sub?: CronogramaItem;
    };
    const rows: GRow[] = [];
    atividades.forEach(a => {
      rows.push({ label: a.descricao, isSub: false, atividade: a });
      if (exibirSubitens) {
        (cronogramaMap[a.id] || []).forEach(s =>
          rows.push({ label: s.descricao, isSub: true, sub: s })
        );
      }
    });

    if (rows.length === 0) {
      canvas.width  = visibleW;
      canvas.height = 40;
      canvas.style.width  = visibleW + "px";
      canvas.style.height = "40px";
      const ctx = canvas.getContext("2d")!;
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#888";
      ctx.fillText(
        "Cadastre datas de início e fim nas atividades para visualizar o Gantt.",
        10, 24
      );
      return;
    }

    const tmpCtx = canvas.getContext("2d")!;
    tmpCtx.font = `500 ${FONT_LBL}px sans-serif`;
    let maxLblW = 0;
    rows.forEach(r => {
      const pad = r.isSub ? 20 : 8;
      const w = tmpCtx.measureText(r.label).width + pad + 8;
      if (w > maxLblW) maxLblW = w;
    });
    const LABEL_W = Math.ceil(maxLblW) + 4;

    let minMs = Infinity, maxMs = -Infinity;
    atividades.forEach(a => {
      if (a.data_inicio) { const t = parseDataUTC(a.data_inicio); if (t < minMs) minMs = t; }
      if (a.data_fim) { const t = parseDataUTC(a.data_fim); if (t > maxMs) maxMs = t; }
      if (exibirSubitens) {
        (cronogramaMap[a.id] || []).forEach(s => {
          if (s.data_inicio) { const t = parseDataUTC(s.data_inicio); if (t < minMs) minMs = t; }
          if (s.data_fim) { const t = parseDataUTC(s.data_fim); if (t > maxMs) maxMs = t; }
        });
      }
    });
    if (exibirBaseline && baselineSelecionada) {
      baselineSelecionada.snapshot.atividades.forEach(b => {
        if (b.data_inicio) { const t = parseDataUTC(b.data_inicio); if (t < minMs) minMs = t; }
        if (b.data_fim) { const t = parseDataUTC(b.data_fim); if (t > maxMs) maxMs = t; }
      });
    }

    if (minMs === Infinity || maxMs === -Infinity) {
      canvas.style.height = "40px";
      return;
    }

    const minDate    = new Date(minMs);
    const rangeMinMs = Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1);
    const maxDate    = new Date(maxMs);
    const rangeMaxMs = Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 3, 1);
    const totalDias  = Math.max(Math.round((rangeMaxMs - rangeMinMs) / 86400000), 1);

    type Mes = { y: number; m: number; label: string; x1: number; x2: number };
    let ym = new Date(rangeMinMs).getUTCFullYear() * 12 + new Date(rangeMinMs).getUTCMonth();
    const ymMax = new Date(rangeMaxMs).getUTCFullYear() * 12 + new Date(rangeMaxMs).getUTCMonth() - 1;
    const meses: Mes[] = [];
    while (ym <= ymMax) {
      const y = Math.floor(ym / 12), m = ym % 12;
      meses.push({ y, m, label: MON_PT[m], x1: 0, x2: 0 });
      ym++;
    }

    const minChartW = meses.length * MON_MIN_W;
    const chartW    = Math.max(visibleW - LABEL_W - PAD_R, minChartW);
    const totalW    = LABEL_W + chartW + PAD_R;
    const totalH    = HEAD_H + rows.length * ROW_H + 4;

    const dX = (iso: string): number => {
      const ts   = parseDataUTC(iso);
      const diff = Math.round((ts - rangeMinMs) / 86400000);
      return LABEL_W + (diff / totalDias) * chartW;
    };

    meses.forEach(mes => {
      const iso = `${mes.y}-${String(mes.m + 1).padStart(2, "0")}-01`;
      mes.x1 = dX(iso);
      const ny = Math.floor((mes.y * 12 + mes.m + 1) / 12);
      const nm = (mes.y * 12 + mes.m + 1) % 12;
      const isoNext = `${ny}-${String(nm + 1).padStart(2, "0")}-01`;
      mes.x2 = Math.min(
        parseDataUTC(isoNext) > rangeMaxMs ? LABEL_W + chartW : dX(isoNext),
        LABEL_W + chartW
      );
    });

    const anos: Record<number, { x1: number; x2: number }> = {};
    meses.forEach(mes => {
      if (!anos[mes.y]) {
        anos[mes.y] = { x1: mes.x1, x2: mes.x2 };
      } else {
        if (mes.x1 < anos[mes.y].x1) anos[mes.y].x1 = mes.x1;
        if (mes.x2 > anos[mes.y].x2) anos[mes.y].x2 = mes.x2;
      }
    });

    canvas.width  = totalW * DPR;
    canvas.height = totalH * DPR;
    canvas.style.width  = totalW + "px";
    canvas.style.height = totalH + "px";
    if (canvas.parentElement) {
      canvas.parentElement.style.width = totalW + "px";
    }

    const ctx = canvas.getContext("2d")!;
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, totalW, totalH);

    rows.forEach((_, i) => {
      const y = HEAD_H + i * ROW_H;
      ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.018)" : "transparent";
      ctx.fillRect(0, y, totalW, ROW_H);
    });

    meses.forEach(mes => {
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(mes.x1, HEAD_H);
      ctx.lineTo(mes.x1, totalH);
      ctx.stroke();
    });

    Object.entries(anos).forEach(([yr, a]) => {
      ctx.fillStyle   = "rgba(30,58,95,0.09)";
      ctx.fillRect(a.x1, 0, a.x2 - a.x1, YEAR_H);
      ctx.strokeStyle = "rgba(30,58,95,0.15)";
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(a.x1 + 0.25, 0.25, a.x2 - a.x1 - 0.5, YEAR_H - 0.5);
      ctx.fillStyle    = "#1e3a5f";
      ctx.font         = `500 ${isMobile ? 8 : 9}px sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(yr, (a.x1 + a.x2) / 2, YEAR_H / 2);
    });

    meses.forEach(mes => {
      const colW = mes.x2 - mes.x1;
      ctx.fillStyle   = "rgba(0,0,0,0.022)";
      ctx.fillRect(mes.x1, YEAR_H, colW, MON_H);
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(mes.x1 + 0.25, YEAR_H + 0.25, colW - 0.5, MON_H - 0.5);
      if (colW >= 20) {
        ctx.fillStyle    = "#888";
        ctx.font         = `400 ${isMobile ? 8 : 9}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(mes.label, (mes.x1 + mes.x2) / 2, YEAR_H + MON_H / 2);
      }
    });

    const hoje  = new Date().toISOString().slice(0, 10);
    const hojeX = dX(hoje);
    if (hojeX >= LABEL_W && hojeX <= LABEL_W + chartW) {
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hojeX, HEAD_H);
      ctx.lineTo(hojeX, totalH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle    = "#ef4444";
      ctx.font         = `400 ${isMobile ? 7 : 8}px sans-serif`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Hoje", hojeX + 2, HEAD_H + 2);
      ctx.restore();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(LABEL_W, 0);
    ctx.lineTo(LABEL_W, totalH);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.025)";
    ctx.fillRect(0, 0, LABEL_W, HEAD_H);
    ctx.fillStyle    = "#555";
    ctx.font         = `500 ${isMobile ? 9 : 10}px sans-serif`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Atividade", 8, HEAD_H / 2);

    const blMap: Record<string, BaselineAtividade>    = {};
    const blItemMap: Record<string, BaselineItem>     = {};
    if (exibirBaseline && baselineSelecionada) {
      baselineSelecionada.snapshot.atividades.forEach(b => {
        blMap[b.codigo] = b;
        (b.itens || []).forEach(it => {
          blItemMap[`${b.codigo}__${it.codigo}`] = it;
        });
      });
    }

    rows.forEach((row, i) => {
      const y    = HEAD_H + i * ROW_H;
      const barH = row.isSub ? BAR_SUB : BAR_MAIN;
      const barY = y + (ROW_H - barH) / 2;

      ctx.strokeStyle = "rgba(0,0,0,0.04)";
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(totalW, y);
      ctx.stroke();

      const lx = row.isSub ? 18 : 8;
      ctx.fillStyle    = row.isSub ? "#888" : "#222";
      ctx.font         = row.isSub
        ? `400 ${FONT_SUB}px sans-serif`
        : `500 ${FONT_LBL}px sans-serif`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(row.label, lx, y + ROW_H / 2);

      let dataInicio: string | null = null;
      let dataFim:    string | null = null;
      let horasPrev  = 0;
      let horasReal  = 0;
      let cor        = "#3b82f6";

      if (!row.isSub && row.atividade) {
        const a    = row.atividade;
        dataInicio = a.data_inicio;
        dataFim    = a.data_fim;
        horasPrev  = a.horas;
        horasReal  = getHorasRealizadasAtividade(a);
        cor        = getCorAtividade(getStatusAtividade(a));
      } else if (row.isSub && row.sub) {
        const s    = row.sub;
        dataInicio = s.data_inicio;
        dataFim    = s.data_fim;
        horasPrev  = s.horas_reservadas;
        cor        = "#3b82f6";
      }

      if (!dataInicio || !dataFim) return;

      const bx    = dX(dataInicio);
      const bxEnd = dX(dataFim);
      const bw    = Math.max(bxEnd - bx, 3);
      const pct   = horasPrev > 0 ? Math.min(horasReal / horasPrev, 1) : 0;
      const doneW = bw * pct;
      const pctLbl = Math.round(pct * 100);
      const r3    = Math.min(3, barH / 2);

      ctx.save();
      ctx.beginPath();
      ctx.rect(LABEL_W, 0, chartW + 2, totalH);
      ctx.clip();

      // Baseline overlay
      if (!row.isSub && row.atividade) {
        const bl = blMap[row.atividade.codigo];
        if (bl?.data_inicio && bl?.data_fim) {
          const blX = dX(bl.data_inicio);
          const blW = Math.max(dX(bl.data_fim) - blX, 3);
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = "#7c3aed";
          ctx.lineWidth   = 1;
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(blX, barY - 1, blW, barH + 2);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          const delta = Math.round(
            (parseDataUTC(dataFim) - parseDataUTC(bl.data_fim)) / 86400000
          );
          if (delta !== 0) {
            const ex = Math.max(bxEnd, dX(bl.data_fim)) + 4;
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(LABEL_W, 0, chartW + PAD_R - 2, totalH);
            ctx.clip();
            ctx.fillStyle    = delta > 0 ? "#dc2626" : "#059669";
            ctx.font         = `500 ${isMobile ? 7 : 9}px sans-serif`;
            ctx.textAlign    = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(delta > 0 ? `+${delta}d` : `${delta}d`, ex, barY + barH / 2);
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(LABEL_W, 0, chartW + 2, totalH);
            ctx.clip();
          }
        }
      }

      if (row.isSub && row.sub) {
        const atv = atividades.find(a => a.id === row.sub!.atividade_id);
        if (atv) {
          const blItem = blItemMap[`${atv.codigo}__${row.sub.codigo}`];
          if (blItem?.data_inicio && blItem?.data_fim) {
            const blX = dX(blItem.data_inicio);
            const blW = Math.max(dX(blItem.data_fim) - blX, 3);
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = "#7c3aed";
            ctx.lineWidth   = 1;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(blX, barY - 1, blW, barH + 2);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
        }
      }

      // Planned bar (light)
      ctx.globalAlpha = 0.18;
      ctx.fillStyle   = cor;
      ctx.beginPath();
      (ctx as any).roundRect(bx, barY, bw, barH, r3);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Done bar (solid)
      if (doneW > 0) {
        ctx.fillStyle = cor;
        ctx.beginPath();
        (ctx as any).roundRect(bx, barY, doneW, barH, r3);
        ctx.fill();
      }

      // Percentage label
      ctx.font         = `500 ${isMobile ? 7 : 8}px sans-serif`;
      ctx.textBaseline = "middle";
      if (doneW > (isMobile ? 16 : 20)) {
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(pctLbl + "%", bx + doneW / 2, barY + barH / 2);
      } else if (bx + bw + 20 < LABEL_W + chartW) {
        ctx.fillStyle = "#888";
        ctx.textAlign = "left";
        ctx.fillText(pctLbl + "%", bx + bw + 3, barY + barH / 2);
      }

      ctx.restore();
    });

    // Store data for tooltip
    (canvas as any)._ganttRows   = rows;
    (canvas as any)._ganttHeadH  = HEAD_H;
    (canvas as any)._ganttRowH   = ROW_H;
    (canvas as any)._ganttLabelW = LABEL_W;
  };

  // === Baseline ===

  const handleSalvarBaseline = async () => {
    if (!baselineVersao.trim()) {
      toast({ title: "Erro", description: "Informe a versão da baseline.", variant: "destructive" });
      return;
    }
    setSavingBaseline(true);
    const snapshot = {
      atividades: atividades.map(a => ({
        id: a.id,
        codigo: a.codigo,
        descricao: a.descricao,
        horas: a.horas,
        data_inicio: a.data_inicio,
        data_fim: a.data_fim,
        itens: (cronogramaMap[a.id] || []).map(s => ({
          id: s.id,
          codigo: s.codigo,
          descricao: s.descricao,
          horas_reservadas: s.horas_reservadas,
          data_inicio: s.data_inicio,
          data_fim: s.data_fim,
        })),
      }))
    };
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("projeto_baseline")
      .insert({
        projeto_id: projetoSelecionado!.id,
        versao: baselineVersao.trim(),
        descricao: baselineDescricao.trim() || null,
        snapshot,
        salvo_por: user.user?.id,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const parsed = { ...data, snapshot: typeof data.snapshot === "string" ? JSON.parse(data.snapshot) : data.snapshot } as Baseline;
      const novasBaselines = [parsed, ...baselines];
      setBaselines(novasBaselines);
      setBaselineSelecionada(parsed);
      setModalBaselineOpen(false);
      setBaselineVersao("");
      setBaselineDescricao("");
      toast({ title: "Baseline salva!", description: `Versão ${parsed.versao} registrada.` });
    }
    setSavingBaseline(false);
  };

  const getBadgeStatus = (status: string) => {
    if (status === "Liberado") return "bg-emerald-100 text-emerald-800";
    if (status === "Encerrado") return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  // === Render ===

  return (
    <div className="space-y-4" id="print-status-report">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          body * { visibility: hidden !important; }
          #print-status-report,
          #print-status-report * { visibility: visible !important; }
          #print-status-report {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
          }
          .print\\:hidden { display: none !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-panel {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-grid-2 {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      {/* Modal Baseline */}
      <Dialog open={modalBaselineOpen} onOpenChange={setModalBaselineOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Baseline do Cronograma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Registra o estado atual das atividades como referência.
              Use "Exibir Baseline" para comparar com a situação futura.
            </p>
            {baselines.length > 0 && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
                Já existe(m) {baselines.length} baseline(s) salva(s).
                Uma nova versão será adicionada.
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Versão *</Label>
              <Input
                placeholder="ex: v1, v2, Baseline Jan/26"
                value={baselineVersao}
                onChange={e => setBaselineVersao(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                placeholder="ex: Baseline inicial aprovada em reunião"
                value={baselineDescricao}
                onChange={e => setBaselineDescricao(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalBaselineOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarBaseline} disabled={savingBaseline}
              className="bg-purple-700 hover:bg-purple-800 text-white">
              {savingBaseline && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Salvar Baseline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            Status Report
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("pt-BR",
              { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={projetoSelecionado?.id || ""}
            onValueChange={id => {
              const p = projetos.find(p => p.id === id);
              if (p) {
                setProjetoSelecionado(p);
                setExibirBaseline(false);
                setBaselineSelecionada(null);
              }
            }}>
            <SelectTrigger className="w-56 text-xs">
              <SelectValue placeholder="Selecione o projeto..." />
            </SelectTrigger>
            <SelectContent>
              {projetos.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.codigo_cliente} — {p.nome_cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projetoSelecionado && (
            <Badge className={cn("text-[10px]",
              getBadgeStatus(projetoSelecionado.status))}>
              {projetoSelecionado.status || "Em planejamento"}
            </Badge>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground print:hidden">
            <input
              type="checkbox"
              checked={exibirSubitens}
              onChange={e => setExibirSubitens(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            Subitens
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground print:hidden">
            <input
              type="checkbox"
              checked={hideHoras}
              onChange={e => setHideHoras(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            Ocultar carga horária
          </label>
          <Button variant="outline" size="sm" className="text-xs print:hidden"
            onClick={handlePrint}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !projetoSelecionado ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum projeto encontrado.
        </p>
      ) : (
        <div className="space-y-4">
          {/* KPIs — Modo interno */}
          {!hideHoras && (() => {
            const realizadas = getHorasRealizadasTotal();
            const contratadas = projetoSelecionado.horas_contratadas;
            const saldo = contratadas - realizadas;
            const pct = contratadas > 0
              ? Math.round(realizadas / contratadas * 100)
              : 0;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Horas Contratadas
                    </p>
                    <p className="text-xl font-medium">{contratadas}h</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Contrato vigente
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Horas Realizadas
                    </p>
                    <p className="text-xl font-medium">{realizadas}h</p>
                    <Progress value={pct} className="h-1.5 mt-2" />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {pct}% do contrato
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Saldo de Horas
                    </p>
                    <p className={cn("text-xl font-medium",
                      saldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {saldo >= 0 ? "+" : ""}{saldo}h
                    </p>
                    <Progress value={Math.max(0, Math.round(saldo / contratadas * 100))}
                      className="h-1.5 mt-2" />
                    <p className={cn("text-[10px] mt-1",
                      saldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {saldo >= 0 ? "Dentro do orçamento" : "Orçamento excedido"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      % Conclusão
                    </p>
                    <p className="text-xl font-medium">{pct}%</p>
                    <Progress value={pct} className="h-1.5 mt-2" />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {atividades.length} atividade(s)
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Aderência ao Prazo
                    </p>
                    {baselineSelecionada ? (() => {
                      let maxDesvio = 0;
                      let atrasadas = 0;
                      atividades.forEach(a => {
                        const blSnap = baselineSelecionada.snapshot.atividades.find(b => b.codigo === a.codigo);
                        if (blSnap && blSnap.data_fim && a.data_fim) {
                          const desvio = Math.round((new Date(a.data_fim).getTime() - new Date(blSnap.data_fim).getTime()) / 86400000);
                          if (desvio > maxDesvio) maxDesvio = desvio;
                          if (desvio > 0) atrasadas++;
                        }
                      });
                      const statusLabel = maxDesvio <= 0 ? "No prazo" : maxDesvio <= 7 ? "Em atenção" : "Atrasado";
                      const badgeCls = maxDesvio <= 0
                        ? "bg-emerald-100 text-emerald-800"
                        : maxDesvio <= 7
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800";
                      return (
                        <>
                          <Badge className={cn("text-[10px]", badgeCls)}>{statusLabel}</Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            vs. baseline {baselineSelecionada.versao}
                          </p>
                          <p className="text-[10px] mt-0.5">
                            {atrasadas > 0
                              ? `${atrasadas} atividade(s) em atraso`
                              : "Todas as atividades no prazo"}
                          </p>
                        </>
                      );
                    })() : (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Salve uma baseline para monitorar prazos
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* KPIs — Modo cliente */}
          {hideHoras && (() => {
            const realizadas = getHorasRealizadasTotal();
            const contratadas = projetoSelecionado.horas_contratadas;
            const pct = contratadas > 0
              ? Math.round(realizadas / contratadas * 100) : 0;
            const idp = calcularIdp();
            const idc = calcularIdc();
            const idpSt = getIndiceStatus(idp);
            const idcSt = getIndiceStatus(idc);
            const corIndice = (v: number) =>
              v >= 1 ? "text-emerald-600"
              : v >= 0.8 ? "text-blue-700"
              : "text-red-600";
            const bgIndice = (st: { classe: string }) =>
              st.classe.includes("emerald")
                ? "bg-emerald-100 text-emerald-800"
              : st.classe.includes("yellow")
                ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800";
            return (
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                      Avanço físico
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">
                      Progresso realizado
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-2xl font-medium">{pct}%</p>
                      <div className="flex-1">
                        <p className="text-[9px] text-muted-foreground mb-1">
                          Conclusão geral
                        </p>
                        <Progress value={pct} className="h-2" />
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      {atividades.length} atividades · Meta: 100%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3 relative">
                    <Badge className={cn("text-[9px] absolute top-2 right-2", bgIndice(idpSt))}>
                      {idpSt.label}
                    </Badge>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">IDP</p>
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">
                      Índice de Desempenho de Prazo
                    </p>
                    <p className={cn("text-2xl font-medium mb-1", corIndice(idp))}>
                      {idp.toFixed(2)}
                    </p>
                    <Progress value={Math.min(idp * 100, 100)} className="h-1.5 mb-1" />
                    <div className="flex justify-between">
                      <p className="text-[9px] text-muted-foreground">Ref: 1,00 = no prazo</p>
                      <p className={cn("text-[9px]", corIndice(idp))}>
                        {idp >= 1 ? "▲" : "▼"} {Math.abs(Math.round((idp - 1) * 100))}%
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-secondary border-0">
                  <CardContent className="p-3 relative">
                    <Badge className={cn("text-[9px] absolute top-2 right-2", bgIndice(idcSt))}>
                      {idcSt.label}
                    </Badge>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">IDC</p>
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">
                      Índice de Desempenho de Custo
                    </p>
                    <p className={cn("text-2xl font-medium mb-1", corIndice(idc))}>
                      {idc.toFixed(2)}
                    </p>
                    <Progress value={Math.min(idc * 100, 100)} className="h-1.5 mb-1" />
                    <div className="flex justify-between">
                      <p className="text-[9px] text-muted-foreground">Ref: 1,00 = no custo</p>
                      <p className={cn("text-[9px]", corIndice(idc))}>
                        {idc >= 1 ? "▲" : "▼"} {Math.abs(Math.round((idc - 1) * 100))}%
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Gantt */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Gantt — Cronograma de Atividades</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap print:hidden">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {[
                      { cor: "#10b981", label: "Concluído" },
                      { cor: "#3b82f6", label: "Em andamento" },
                      { cor: "#f59e0b", label: "Atrasado" },
                      { cor: "#cbd5e1", label: "Não iniciado" },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1">
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: l.cor, display: "inline-block" }} />
                        {l.label}
                      </span>
                    ))}
                    {exibirBaseline && (
                      <span className="flex items-center gap-1">
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: "repeating-linear-gradient(45deg,#7c3aed 0,#7c3aed 2px,transparent 2px,transparent 4px)", border: "1px solid #7c3aed", display: "inline-block" }} />
                        Baseline
                      </span>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                    <input type="checkbox" checked={exibirSubitens}
                      onChange={e => setExibirSubitens(e.target.checked)}
                      className="h-3.5 w-3.5 rounded" />
                    Subitens
                  </label>
                  <Button size="sm" variant="outline"
                    className={cn("h-7 text-xs gap-1", baselines.length > 0 && "border-purple-400 text-purple-700")}
                    onClick={() => setModalBaselineOpen(true)}>
                    <Save className="h-3 w-3" />
                    Salvar Baseline
                  </Button>
                  {baselines.length > 0 && (
                    <Select
                      value={baselineSelecionada?.id || ""}
                      onValueChange={id => {
                        const bl = baselines.find(b => b.id === id);
                        if (bl) { setBaselineSelecionada(bl); setExibirBaseline(false); }
                      }}>
                      <SelectTrigger className="h-7 text-xs w-44">
                        <SelectValue placeholder="Selecionar baseline..." />
                      </SelectTrigger>
                      <SelectContent>
                        {baselines.map(b => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">
                            {b.versao} · {formatarData(b.created_at)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {baselines.length > 0 && (
                    <Button size="sm"
                      className={cn("h-7 text-xs gap-1",
                        exibirBaseline ? "bg-purple-700 hover:bg-purple-800 text-white" : "")}
                      variant={exibirBaseline ? "default" : "outline"}
                      onClick={() => setExibirBaseline(v => !v)}>
                      <Eye className="h-3 w-3" />
                      {exibirBaseline ? "Ocultar Baseline" : "Exibir Baseline"}
                    </Button>
                  )}
                </div>
              </div>
              {exibirBaseline && baselineSelecionada && (
                <div className="flex items-center gap-2 rounded-md bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs text-purple-800 mb-3">
                  <Eye className="h-3 w-3 flex-shrink-0" />
                  Baseline <strong>{baselineSelecionada.versao}</strong> ativa —
                  barras tracejadas mostram o planejado original.
                  Desvios em dias exibidos à direita de cada barra.
                </div>
              )}
              <div
                className="overflow-x-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#1e3a5f40 transparent" }}
                id="gantt-scroll-container"
              >
                <div id="gantt-canvas-wrap" style={{ position: "relative" }}>
                  <canvas
                    ref={ganttRef}
                    style={{ display: "block" }}
                    onMouseMove={handleGanttHover}
                    onMouseLeave={() => setGanttTooltip(null)}
                    onTouchStart={handleGanttTouch}
                    onTouchEnd={() => setTimeout(() => setGanttTooltip(null), 2000)}
                  />
                  {ganttTooltip && (
                    <div
                      style={{
                        position: "absolute",
                        left: ganttTooltip.x,
                        top:  ganttTooltip.y,
                        background: "var(--background)",
                        border: "0.5px solid hsl(var(--border))",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 11,
                        pointerEvents: "none",
                        zIndex: 50,
                        minWidth: 180,
                        maxWidth: 220,
                      }}
                    >
                      <p style={{ fontWeight: 500, marginBottom: 4, fontSize: 12, lineHeight: 1.3 }}>
                        {ganttTooltip.label}
                      </p>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted-foreground)", marginTop:2 }}>
                        <span>Início</span>
                        <span style={{ fontWeight:500, color:"var(--foreground)" }}>{ganttTooltip.inicio}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted-foreground)", marginTop:2 }}>
                        <span>Término</span>
                        <span style={{ fontWeight:500, color:"var(--foreground)" }}>{ganttTooltip.fim}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted-foreground)", marginTop:2 }}>
                        <span>Status</span>
                        <span style={{ fontWeight:500, color: ganttTooltip.cor }}>{ganttTooltip.status}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted-foreground)", marginTop:2 }}>
                        <span>Previsto</span>
                        <span style={{ fontWeight:500, color:"var(--foreground)" }}>{ganttTooltip.horas}h</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted-foreground)", marginTop:2 }}>
                        <span>Realizado</span>
                        <span style={{ fontWeight:500, color:"var(--foreground)" }}>{ganttTooltip.real}h ({ganttTooltip.pct}%)</span>
                      </div>
                      <div style={{ width:"100%", height:4, background:"var(--border)", borderRadius:2, marginTop:6, overflow:"hidden" }}>
                        <div style={{ width:`${ganttTooltip.pct}%`, height:4, background: ganttTooltip.cor, borderRadius:2 }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Custom scroll bar */}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                <button
                  className="print:hidden"
                  style={{ width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
                    border:"0.5px solid hsl(var(--border))", borderRadius:6, cursor:"pointer", fontSize:12,
                    background:"transparent", color:"var(--muted-foreground)" }}
                  onClick={() => {
                    const el = document.getElementById("gantt-scroll-container");
                    el?.scrollBy({ left: -120, behavior: "smooth" });
                  }}>
                  ‹
                </button>
                <div
                  id="gantt-scroll-track"
                  style={{ flex:1, height:6, background:"var(--secondary)", borderRadius:3, position:"relative",
                    cursor:"pointer", border:"0.5px solid hsl(var(--border))" }}
                  onClick={handleScrollTrackClick}
                >
                  <div
                    id="gantt-scroll-thumb"
                    style={{ position:"absolute", height:6, background:"#1e3a5f", borderRadius:3,
                      opacity:0.5, cursor:"grab", width: ganttThumbW + "px", left: ganttThumbL + "px" }}
                    onMouseDown={handleThumbMouseDown}
                    onTouchStart={handleThumbTouchStart}
                  />
                </div>
                <button
                  className="print:hidden"
                  style={{ width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
                    border:"0.5px solid hsl(var(--border))", borderRadius:6, cursor:"pointer", fontSize:12,
                    background:"transparent", color:"var(--muted-foreground)" }}
                  onClick={() => {
                    const el = document.getElementById("gantt-scroll-container");
                    el?.scrollBy({ left: 120, behavior: "smooth" });
                  }}>
                  ›
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Próximas + Concluídas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Próximas Atividades</span>
                </div>
                {proximas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade agendada.</p>
                ) : (
                  <div className="space-y-2">
                    {proximas.map(a => (
                      <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary text-xs">
                        <span className="text-muted-foreground min-w-[40px]">{formatarDataCurta(a.data)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{a.atividade}</p>
                          <p className="text-muted-foreground">{a.usuario}</p>
                        </div>
                        <Badge className={cn("text-[10px] shrink-0",
                          a.status === "Confirmado" && "bg-emerald-100 text-emerald-800",
                          a.status === "Cancelado" && "bg-red-100 text-red-800",
                          !["Confirmado","Cancelado"].includes(a.status) && "bg-blue-100 text-blue-800",
                        )}>
                          {a.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Atividades Concluídas</span>
                </div>
                {concluidas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade concluída.</p>
                ) : (
                  <div className="space-y-2">
                    {concluidas.map(a => (
                      <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary text-xs">
                        <span className="text-muted-foreground min-w-[40px]">{formatarDataCurta(a.data)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{a.atividade}</p>
                          <p className="text-muted-foreground">{a.usuario}</p>
                        </div>
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 shrink-0">Concluído</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Riscos + Saldo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Mapeamento de Riscos</span>
                    {riscos.filter(r => r.status !== "Encerrado").length > 0 && (
                      <Badge className="text-[10px] bg-red-100 text-red-800">
                        {riscos.filter(r => r.status !== "Encerrado").length} ativo(s)
                      </Badge>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground print:hidden">
                    <input type="checkbox" checked={exibirEncerrados}
                      onChange={e => setExibirEncerrados(e.target.checked)}
                      className="h-3.5 w-3.5 rounded" />
                    Exibir encerrados
                  </label>
                </div>
                {(() => {
                  const riscosFiltrados = exibirEncerrados
                    ? riscos
                    : riscos.filter(r => r.status !== "Encerrado");
                  return riscosFiltrados.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum risco cadastrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {riscosFiltrados.map(r => {
                        const resp = stakeholders.find(s => s.id === r.responsavel_id);
                        return (
                          <div key={r.id} className="rounded-md border p-2 text-xs space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium flex-1">{r.descricao}</p>
                              <Badge className={cn("text-[10px] shrink-0",
                                r.status === "Identificado" && "bg-blue-100 text-blue-800",
                                r.status === "Em Mitigação" && "bg-yellow-100 text-yellow-800",
                                r.status === "Encerrado" && "bg-gray-100 text-gray-600",
                              )}>
                                {r.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cn("text-[10px]",
                                r.probabilidade === "Alta" && "bg-red-100 text-red-800",
                                r.probabilidade === "Média" && "bg-yellow-100 text-yellow-800",
                                r.probabilidade === "Baixa" && "bg-emerald-100 text-emerald-800",
                              )}>
                                Prob: {r.probabilidade}
                              </Badge>
                              <Badge className={cn("text-[10px]",
                                r.impacto === "Alto" && "bg-red-100 text-red-800",
                                r.impacto === "Médio" && "bg-yellow-100 text-yellow-800",
                                r.impacto === "Baixo" && "bg-emerald-100 text-emerald-800",
                              )}>
                                Imp: {r.impacto}
                              </Badge>
                              {resp && (
                                <span className="text-muted-foreground">
                                  {resp.nome}{resp.cargo ? ` · ${resp.cargo}` : ""}
                                </span>
                              )}
                            </div>
                            {r.acao_mitigadora && (
                              <p className="text-muted-foreground">Ação: {r.acao_mitigadora}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <p className="text-[10px] text-muted-foreground mt-3 print:hidden">
                  Edição de riscos disponível em Cadastros › Projetos.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                {!hideHoras ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Saldo de Horas por Atividade</span>
                    </div>
                    {atividades.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma atividade cadastrada.</p>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pb-2 font-medium text-muted-foreground">Atividade</th>
                              <th className="text-right pb-2 font-medium text-muted-foreground w-12">Prev.</th>
                              <th className="text-right pb-2 font-medium text-muted-foreground w-12">Real.</th>
                              <th className="pb-2 w-20"></th>
                              <th className="text-right pb-2 font-medium text-muted-foreground w-14">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {atividades.map(a => {
                              const real = getHorasRealizadasAtividade(a);
                              const saldo = a.horas - real;
                              const pct = a.horas > 0 ? Math.min(Math.round(real / a.horas * 100), 100) : 0;
                              const cor = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-yellow-500";
                              return (
                                <tr key={a.id} className="border-b last:border-0">
                                  <td className="py-2 pr-2">{a.descricao}</td>
                                  <td className="py-2 text-right text-muted-foreground">{a.horas}h</td>
                                  <td className="py-2 text-right text-muted-foreground">{real}h</td>
                                  <td className="py-2 px-2">
                                    <div className="w-full bg-secondary rounded-full h-1.5">
                                      <div className={cn("h-1.5 rounded-full", cor)} style={{ width: `${pct}%` }} />
                                    </div>
                                  </td>
                                  <td className={cn("py-2 text-right font-medium",
                                    saldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                                    {saldo >= 0 ? "+" : ""}{saldo}h
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            {(() => {
                              const tPrev = atividades.reduce((s, a) => s + a.horas, 0);
                              const tReal = getHorasRealizadasTotal();
                              const tSaldo = tPrev - tReal;
                              return (
                                <tr className="border-t font-medium">
                                  <td className="pt-2">Total</td>
                                  <td className="pt-2 text-right text-muted-foreground">{tPrev}h</td>
                                  <td className="pt-2 text-right text-muted-foreground">{tReal}h</td>
                                  <td />
                                  <td className={cn("pt-2 text-right",
                                    tSaldo >= 0 ? "text-emerald-600" : "text-red-600")}>
                                    {tSaldo >= 0 ? "+" : ""}{tSaldo}h
                                  </td>
                                </tr>
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Avanço Físico por Atividade</span>
                    </div>
                    {atividades.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma atividade cadastrada.</p>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pb-2 font-medium text-muted-foreground">Atividade</th>
                              <th className="text-right pb-2 font-medium text-muted-foreground w-14">Avanço</th>
                              <th className="pb-2 pl-2 font-medium text-muted-foreground" style={{ width: '40%' }}>Progresso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {atividades.map(a => {
                              const real = getHorasRealizadasAtividade(a);
                              const pct = a.horas > 0 ? Math.min(Math.round(real / a.horas * 100), 100) : 0;
                              const cor = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct > 0 ? "bg-yellow-500" : "bg-muted";
                              const corText = pct >= 100 ? "text-emerald-600" : pct >= 50 ? "text-blue-600" : pct > 0 ? "text-yellow-600" : "text-muted-foreground";
                              return (
                                <tr key={a.id} className="border-b last:border-0">
                                  <td className="py-2 pr-2">{a.descricao}</td>
                                  <td className={cn("py-2 text-right font-medium", corText)}>{pct}%</td>
                                  <td className="py-2 pl-2">
                                    <div className="w-full bg-secondary rounded-full h-1.5">
                                      <div className={cn("h-1.5 rounded-full", cor)} style={{ width: `${pct}%` }} />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            {(() => {
                              const realizadas = getHorasRealizadasTotal();
                              const contratadas = projetoSelecionado.horas_contratadas;
                              const pctGeral = contratadas > 0 ? Math.round(realizadas / contratadas * 100) : 0;
                              return (
                                <tr className="border-t font-medium">
                                  <td className="pt-2">Avanço geral</td>
                                  <td className="pt-2 text-right">{pctGeral}%</td>
                                  <td className="pt-2 pl-2">
                                    <div className="w-full bg-secondary rounded-full h-1.5">
                                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pctGeral}%` }} />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {/* Container de impressão oculto */}
      <div id="print-status-report" style={{ display: 'none' }}>
        {projetoSelecionado && (
          <PrintLayout
            projeto={projetoSelecionado}
            coordenadorNome={coordenadorNome}
            atividades={atividades}
            apontamentos={apontamentos}
            cronogramaMap={cronogramaMap}
            proximas={proximas}
            concluidas={concluidas}
            riscos={riscos}
            stakeholders={stakeholders}
            exibirSubitens={exibirSubitens}
            hideHoras={hideHoras}
            getHorasRealizadasAtividade={getHorasRealizadasAtividade}
            getHorasRealizadasTotal={getHorasRealizadasTotal}
            getStatusAtividade={getStatusAtividade}
            getCorAtividade={getCorAtividade}
            calcularIdp={calcularIdp}
            calcularIdc={calcularIdc}
            getIndiceStatus={getIndiceStatus}
            formatarData={formatarData}
            formatarDataCurta={formatarDataCurta}
          />
        )}
      </div>
    </div>
  );
}

type PrintLayoutProps = {
  projeto: Projeto;
  coordenadorNome: string;
  atividades: Atividade[];
  apontamentos: Apontamento[];
  cronogramaMap: Record<string, CronogramaItem[]>;
  proximas: Agenda[];
  concluidas: Agenda[];
  riscos: Risco[];
  stakeholders: Stakeholder[];
  exibirSubitens: boolean;
  hideHoras: boolean;
  getHorasRealizadasAtividade: (a: Atividade) => number;
  getHorasRealizadasTotal: () => number;
  getStatusAtividade: (a: Atividade) => string;
  getCorAtividade: (s: string) => string;
  calcularIdp: () => number;
  calcularIdc: () => number;
  getIndiceStatus: (v: number) => { label: string; classe: string };
  formatarData: (iso: string | null) => string;
  formatarDataCurta: (iso: string) => string;
};

function PrintLayout({ projeto, coordenadorNome, atividades,
  apontamentos, cronogramaMap, proximas, concluidas, riscos,
  stakeholders, exibirSubitens, hideHoras,
  getHorasRealizadasAtividade, getHorasRealizadasTotal,
  getStatusAtividade, getCorAtividade,
  calcularIdp, calcularIdc, getIndiceStatus,
  formatarData, formatarDataCurta }: PrintLayoutProps) {

  const NAVY  = '#1e3a5f';
  const GRAY9 = '#111111';
  const GRAY6 = '#666666';
  const GRAY4 = '#aaaaaa';
  const BGOFF = '#f9fafb';
  const BORD  = '#e5e7eb';
  const BGFT  = '#f8fafc';

  const proximaReuniao = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('pt-BR');
  })();

  const realizadas  = getHorasRealizadasTotal();
  const contratadas = projeto.horas_contratadas;
  const pctGeral    = contratadas > 0
    ? Math.round(realizadas / contratadas * 100) : 0;
  const saldo       = contratadas - realizadas;

  const idp = calcularIdp();
  const idc = calcularIdc();
  const idpStatus = getIndiceStatus(idp);
  const idcStatus = getIndiceStatus(idc);

  const todasDatas: string[] = [];
  atividades.forEach(a => {
    if (a.data_inicio) todasDatas.push(a.data_inicio);
    if (a.data_fim)    todasDatas.push(a.data_fim);
    if (exibirSubitens) {
      (cronogramaMap[a.id] || []).forEach(s => {
        if (s.data_inicio) todasDatas.push(s.data_inicio);
        if (s.data_fim)    todasDatas.push(s.data_fim);
      });
    }
  });
  const temDatas = todasDatas.length > 0;
  const dataMin  = temDatas
    ? new Date(todasDatas.reduce((a,b) => a < b ? a : b))
    : new Date();
  const dataMax  = temDatas
    ? new Date(todasDatas.reduce((a,b) => a > b ? a : b))
    : new Date();
  if (temDatas) {
    dataMin.setDate(dataMin.getDate() - 3);
    dataMax.setDate(dataMax.getDate() + 3);
  }
  const totalDias = temDatas
    ? Math.max(Math.ceil(
        (dataMax.getTime() - dataMin.getTime()) / 86400000), 1)
    : 1;

  const dX = (iso: string): number => {
    const d    = new Date(iso);
    const diff = Math.ceil(
      (d.getTime() - dataMin.getTime()) / 86400000);
    return diff / totalDias * 100;
  };

  const hoje     = new Date().toISOString().slice(0, 10);
  const hojeXpct = temDatas ? dX(hoje) : -1;

  const meses: { label: string; startPct: number; widthPct: number }[] = [];
  if (temDatas) {
    const cur = new Date(
      dataMin.getFullYear(), dataMin.getMonth(), 1);
    while (cur <= dataMax) {
      const startPct = dX(cur.toISOString().slice(0,10));
      const next     = new Date(cur);
      next.setMonth(next.getMonth() + 1);
      const endPct   = Math.min(dX(next.toISOString().slice(0,10)), 100);
      meses.push({
        label: cur.toLocaleDateString('pt-BR',
          { month:'short', year:'2-digit' }),
        startPct: Math.max(startPct, 0),
        widthPct: endPct - Math.max(startPct, 0),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const LABEL_W = '130px';
  const stSec: React.CSSProperties = {
    fontSize: 8, fontWeight: 500, color: NAVY,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    borderBottom: `0.5px solid ${BORD}`,
    paddingBottom: 3, marginBottom: 6,
  };
  const stKpiC: React.CSSProperties = {
    border: `0.5px solid ${BORD}`, borderRadius: 6,
    padding: '7px 9px', background: BGOFF,
  };

  return (
    <div style={{
      background: '#fff', width: '100%',
      fontFamily: '-apple-system, Arial, sans-serif',
    }}>
      {/* ── CABEÇALHO ── */}
      <div style={{
        display:'flex', justifyContent:'space-between',
        alignItems:'flex-start',
        padding: '12px 24px 10px',
        borderBottom: `2px solid ${NAVY}`,
        gap: 12,
      }}>
        <div>
          <div style={{ display:'flex', alignItems:'center',
            gap:8, marginBottom:4 }}>
            <img src={aceexLogo} alt="Grupo Aceex"
              style={{ height:28, objectFit:'contain' }} />
            <span style={{ fontSize:10, fontWeight:500,
              color: NAVY }}>
              Grupo Aceex · Consultoria & Implantação
            </span>
          </div>
          <div style={{ fontSize:15, fontWeight:500,
            color: GRAY9 }}>
            Status Report do Projeto
          </div>
          <div style={{ fontSize:9, color:'#888', marginTop:1 }}>
            Relatório executivo de acompanhamento
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:500,
            color: GRAY9 }}>
            {projeto.nome_cliente}
          </div>
          <div style={{ fontSize:9, color: GRAY6, marginTop:2 }}>
            Coordenador: {coordenadorNome}
          </div>
          <div style={{
            display:'inline-block', marginTop:4,
            fontSize:8, padding:'2px 8px', borderRadius:9,
            background: projeto.status === 'Liberado'
              ? '#d1fae5' : projeto.status === 'Encerrado'
              ? '#fee2e2' : '#fef3c7',
            color: projeto.status === 'Liberado'
              ? '#065f46' : projeto.status === 'Encerrado'
              ? '#991b1b' : '#92400e',
            fontWeight: 500,
          }}>
            {projeto.status || 'Em planejamento'}
          </div>
          <div style={{ fontSize:9, color:'#999', marginTop:3 }}>
            Emitido em {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
      </div>

      <div style={{ padding:'12px 24px',
        display:'flex', flexDirection:'column', gap:10 }}>

        {/* ── KPIs MODO INTERNO ── */}
        {!hideHoras && (
          <div>
            <div style={stSec}>Indicadores do projeto</div>
            <div style={{ display:'grid',
              gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              <div style={stKpiC}>
                <div style={{ fontSize:8,color:'#999',marginBottom:2 }}>
                  Horas Contratadas</div>
                <div style={{ fontSize:15,fontWeight:500 }}>
                  {contratadas}h</div>
                <div style={{ fontSize:8,color:'#999',marginTop:2 }}>
                  Contrato vigente</div>
              </div>
              <div style={stKpiC}>
                <div style={{ fontSize:8,color:'#999',marginBottom:2 }}>
                  Horas Realizadas</div>
                <div style={{ fontSize:15,fontWeight:500 }}>
                  {realizadas}h</div>
                <div style={{ width:'100%',height:3,
                  background:'#e5e7eb',borderRadius:2,
                  marginTop:4,overflow:'hidden' }}>
                  <div style={{ width:`${pctGeral}%`,height:3,
                    background: NAVY,borderRadius:2 }}/>
                </div>
                <div style={{ fontSize:8,color:'#999',marginTop:2 }}>
                  {pctGeral}% do contrato</div>
              </div>
              <div style={stKpiC}>
                <div style={{ fontSize:8,color:'#999',marginBottom:2 }}>
                  Saldo de Horas</div>
                <div style={{ fontSize:15,fontWeight:500,
                  color: saldo >= 0 ? '#059669' : '#dc2626' }}>
                  {saldo >= 0 ? '+' : ''}{saldo}h</div>
                <div style={{ width:'100%',height:3,
                  background:'#e5e7eb',borderRadius:2,
                  marginTop:4,overflow:'hidden' }}>
                  <div style={{
                    width:`${Math.max(0,
                      Math.round(saldo/contratadas*100))}%`,
                    height:3,
                    background: saldo >= 0 ? '#059669':'#dc2626',
                    borderRadius:2 }}/>
                </div>
                <div style={{ fontSize:8,marginTop:2,
                  color: saldo >= 0 ? '#059669':'#dc2626' }}>
                  {saldo >= 0
                    ? 'Dentro do orçamento'
                    : 'Orçamento excedido'}
                </div>
              </div>
              <div style={stKpiC}>
                <div style={{ fontSize:8,color:'#999',marginBottom:2 }}>
                  % Conclusão</div>
                <div style={{ fontSize:15,fontWeight:500 }}>
                  {pctGeral}%</div>
                <div style={{ width:'100%',height:3,
                  background:'#e5e7eb',borderRadius:2,
                  marginTop:4,overflow:'hidden' }}>
                  <div style={{ width:`${pctGeral}%`,height:3,
                    background: NAVY,borderRadius:2 }}/>
                </div>
                <div style={{ fontSize:8,color:'#999',marginTop:2 }}>
                  {atividades.length} atividade(s)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KPIs MODO CLIENTE (IDP/IDC) ── */}
        {hideHoras && (
          <div>
            <div style={stSec}>
              Indicadores de desempenho do projeto
            </div>
            <div style={{ display:'grid',
              gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {/* Avanço físico */}
              <div style={{ ...stKpiC }}>
                <div style={{ fontSize:8,color:'#999',
                  textTransform:'uppercase',
                  letterSpacing:'0.05em',marginBottom:3 }}>
                  Avanço físico
                </div>
                <div style={{ fontSize:9,fontWeight:500,
                  color:'#444',marginBottom:6 }}>
                  Progresso realizado
                </div>
                <div style={{ display:'flex',
                  alignItems:'center',gap:8,marginBottom:4 }}>
                  <div style={{ fontSize:26,fontWeight:500,
                    color: NAVY }}>
                    {pctGeral}%
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:8,color:'#999',
                      marginBottom:3 }}>
                      Conclusão geral
                    </div>
                    <div style={{ width:'100%',height:6,
                      background:'#e5e7eb',borderRadius:3,
                      overflow:'hidden' }}>
                      <div style={{ width:`${pctGeral}%`,
                        height:6,background: NAVY,
                        borderRadius:3 }}/>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:8,color:'#bbb' }}>
                  {atividades.length} atividades ·
                  Meta: 100%
                </div>
              </div>

              {/* IDP */}
              <div style={{ ...stKpiC, position:'relative' }}>
                <span style={{
                  position:'absolute',top:8,right:8,
                  fontSize:8,padding:'2px 7px',borderRadius:9,
                  fontWeight:500,
                  background: idpStatus.classe.includes('emerald')
                    ? '#d1fae5' : idpStatus.classe.includes('yellow')
                    ? '#fef3c7' : '#fee2e2',
                  color: idpStatus.classe.includes('emerald')
                    ? '#065f46' : idpStatus.classe.includes('yellow')
                    ? '#92400e' : '#991b1b',
                }}>
                  {idpStatus.label}
                </span>
                <div style={{ fontSize:8,color:'#999',
                  textTransform:'uppercase',
                  letterSpacing:'0.05em',marginBottom:2 }}>
                  IDP
                </div>
                <div style={{ fontSize:9,fontWeight:500,
                  color:'#444',marginBottom:6 }}>
                  Índice de Desempenho de Prazo
                </div>
                <div style={{ fontSize:26,fontWeight:500,
                  color: idp >= 1 ? '#059669'
                    : idp >= 0.8 ? '#1e40af' : '#dc2626',
                  marginBottom:4 }}>
                  {idp.toFixed(2)}
                </div>
                <div style={{ width:'100%',height:5,
                  background:'#e5e7eb',borderRadius:2,
                  overflow:'hidden',marginBottom:3 }}>
                  <div style={{
                    width:`${Math.min(idp * 100, 100)}%`,
                    height:5,borderRadius:2,
                    background: idp >= 1 ? '#059669'
                      : idp >= 0.8 ? '#3b82f6' : '#ef4444',
                  }}/>
                </div>
                <div style={{ display:'flex',
                  justifyContent:'space-between' }}>
                  <div style={{ fontSize:8,color:'#bbb' }}>
                    Ref: 1,00 = no prazo
                  </div>
                  <div style={{ fontSize:8,
                    color: idp >= 1 ? '#059669'
                      : idp >= 0.8 ? '#92400e' : '#dc2626' }}>
                    {idp >= 1 ? '▲' : '▼'}
                    {' '}{Math.abs(
                      Math.round((idp - 1) * 100)
                    )}%
                  </div>
                </div>
              </div>

              {/* IDC */}
              <div style={{ ...stKpiC, position:'relative' }}>
                <span style={{
                  position:'absolute',top:8,right:8,
                  fontSize:8,padding:'2px 7px',borderRadius:9,
                  fontWeight:500,
                  background: idcStatus.classe.includes('emerald')
                    ? '#d1fae5' : idcStatus.classe.includes('yellow')
                    ? '#fef3c7' : '#fee2e2',
                  color: idcStatus.classe.includes('emerald')
                    ? '#065f46' : idcStatus.classe.includes('yellow')
                    ? '#92400e' : '#991b1b',
                }}>
                  {idcStatus.label}
                </span>
                <div style={{ fontSize:8,color:'#999',
                  textTransform:'uppercase',
                  letterSpacing:'0.05em',marginBottom:2 }}>
                  IDC
                </div>
                <div style={{ fontSize:9,fontWeight:500,
                  color:'#444',marginBottom:6 }}>
                  Índice de Desempenho de Custo
                </div>
                <div style={{ fontSize:26,fontWeight:500,
                  color: idc >= 1 ? '#059669'
                    : idc >= 0.8 ? '#1e40af' : '#dc2626',
                  marginBottom:4 }}>
                  {idc.toFixed(2)}
                </div>
                <div style={{ width:'100%',height:5,
                  background:'#e5e7eb',borderRadius:2,
                  overflow:'hidden',marginBottom:3 }}>
                  <div style={{
                    width:`${Math.min(idc * 100, 100)}%`,
                    height:5,borderRadius:2,
                    background: idc >= 1 ? '#059669'
                      : idc >= 0.8 ? '#3b82f6' : '#ef4444',
                  }}/>
                </div>
                <div style={{ display:'flex',
                  justifyContent:'space-between' }}>
                  <div style={{ fontSize:8,color:'#bbb' }}>
                    Ref: 1,00 = no custo
                  </div>
                  <div style={{ fontSize:8,
                    color: idc >= 1 ? '#059669'
                      : idc >= 0.8 ? '#92400e' : '#dc2626' }}>
                    {idc >= 1 ? '▲' : '▼'}
                    {' '}{Math.abs(
                      Math.round((idc - 1) * 100)
                    )}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GANTT ── */}
        <div className="print-panel" style={{
          border:`0.5px solid ${BORD}`,
          borderRadius:6, padding:10, overflow:'hidden',
        }}>
          <div style={stSec}>
            Cronograma de atividades (Gantt)
          </div>
          {!temDatas ? (
            <p style={{ fontSize:10,color:'#999' }}>
              Cadastre datas de início e fim nas atividades
              para visualizar o Gantt.
            </p>
          ) : (
            <>
              {/* Cabeçalho meses */}
              <div style={{ display:'flex',
                marginLeft: LABEL_W,
                borderBottom:`0.5px solid ${BORD}`,
                paddingBottom:2, marginBottom:3 }}>
                {meses.map((m,i) => (
                  <div key={i} style={{
                    width:`${m.widthPct}%`,
                    fontSize:7, color:'#bbb',
                    textAlign:'center',
                    borderRight:`0.5px solid #f3f4f6`,
                    flexShrink:0,
                  }}>
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Linhas */}
              <div style={{ position:'relative' }}>
                {/* Linha de hoje */}
                {hojeXpct >= 0 && hojeXpct <= 100 && (
                  <div style={{
                    position:'absolute', top:0, bottom:0,
                    left:`calc(${LABEL_W} + (100% - ${LABEL_W}) * ${hojeXpct / 100})`,
                    width:1,
                    background:'repeating-linear-gradient(to bottom,#ef4444 0,#ef4444 3px,transparent 3px,transparent 6px)',
                    zIndex:10, pointerEvents:'none',
                  }}/>
                )}
                {atividades.map((a, ai) => {
                  const hasStart = !!a.data_inicio;
                  const hasEnd   = !!a.data_fim;
                  const planL = hasStart ? dX(a.data_inicio!) : 0;
                  const planW = (hasStart && hasEnd)
                    ? dX(a.data_fim!) - planL : 0;
                  const horasR = getHorasRealizadasAtividade(a);
                  const doneW  = planW * (
                    a.horas > 0
                      ? Math.min(horasR / a.horas, 1) : 0);
                  const pctV = a.horas > 0
                    ? Math.round(horasR / a.horas * 100) : 0;
                  const cor = getCorAtividade(
                    getStatusAtividade(a));
                  return (
                    <React.Fragment key={a.id}>
                      {ai > 0 && (
                        <div style={{
                          height:.5, background:'#f3f4f6',
                          margin:`2px 0 2px ${LABEL_W}`,
                        }}/>
                      )}
                      {/* Linha principal */}
                      <div style={{ display:'flex',
                        alignItems:'center',
                        gap:4, marginBottom:2 }}>
                        <div style={{
                          width: LABEL_W,minWidth: LABEL_W,
                          maxWidth: LABEL_W,
                          fontSize:9,fontWeight:500,
                          color:'#222',whiteSpace:'nowrap',
                          overflow:'hidden',
                          textOverflow:'ellipsis',
                          flexShrink:0,
                        }}>
                          {a.descricao}
                        </div>
                        <div style={{
                          flex:1, minWidth:0,
                          position:'relative', height:13,
                        }}>
                          <div style={{
                            position:'absolute',top:0,
                            left:0,right:0,bottom:0,
                            background:'#f3f4f6',
                            borderRadius:3,
                          }}/>
                          {(hasStart && hasEnd) && (<>
                            <div style={{
                              position:'absolute',top:0,
                              left:`${planL}%`,
                              width:`${planW}%`,height:'100%',
                              background:cor,opacity:.2,
                              borderRadius:3,
                            }}/>
                            <div style={{
                              position:'absolute',top:0,
                              left:`${planL}%`,
                              width:`${doneW}%`,height:'100%',
                              background:cor,borderRadius:3,
                            }}/>
                            {doneW > 6 && (
                              <div style={{
                                position:'absolute',top:0,
                                left:`${planL}%`,height:'100%',
                                display:'flex',
                                alignItems:'center',
                                fontSize:8,color:'#fff',
                                fontWeight:500,paddingLeft:3,
                                zIndex:3,
                              }}>
                                {pctV}%
                              </div>
                            )}
                          </>)}
                        </div>
                        <div style={{
                          fontSize:8,color:'#888',
                          width:22,minWidth:22,
                          textAlign:'right',flexShrink:0,
                        }}>
                          {doneW <= 6 ? `${pctV}%` : ''}
                        </div>
                      </div>
                      {/* Subitens */}
                      {exibirSubitens &&
                        (cronogramaMap[a.id] || []).map(s => {
                          const sL = s.data_inicio
                            ? dX(s.data_inicio) : 0;
                          const sW = (s.data_inicio && s.data_fim)
                            ? dX(s.data_fim) - sL : 0;
                          return (
                            <div key={s.id} style={{
                              display:'flex',alignItems:'center',
                              gap:4,marginBottom:2,
                            }}>
                              <div style={{
                                width: LABEL_W,
                                minWidth: LABEL_W,
                                maxWidth: LABEL_W,
                                fontSize:8,color:'#999',
                                whiteSpace:'nowrap',
                                overflow:'hidden',
                                textOverflow:'ellipsis',
                                flexShrink:0,
                                paddingLeft:10,
                              }}>
                                {s.descricao}
                              </div>
                              <div style={{
                                flex:1,minWidth:0,
                                position:'relative',height:10,
                              }}>
                                <div style={{
                                  position:'absolute',top:0,
                                  left:0,right:0,bottom:0,
                                  background:'#f9fafb',
                                  borderRadius:2,
                                  border:`0.5px solid #f3f4f6`,
                                }}/>
                                {(s.data_inicio && s.data_fim) && (
                                  <div style={{
                                    position:'absolute',top:0,
                                    left:`${sL}%`,
                                    width:`${sW}%`,height:'100%',
                                    background: cor,
                                    opacity:.25,borderRadius:2,
                                  }}/>
                                )}
                              </div>
                              <div style={{
                                fontSize:8,color:'#bbb',
                                width:22,textAlign:'right',
                                flexShrink:0,
                              }}>0%</div>
                            </div>
                          );
                        })
                      }
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Legenda */}
              <div style={{ display:'flex',gap:10,
                marginTop:5,paddingTop:5,
                borderTop:`0.5px solid #f3f4f6`,
                flexWrap:'wrap' }}>
                {[
                  { cor:'#059669', label:'Concluído' },
                  { cor:'#3b82f6', label:'Em andamento' },
                  { cor:'#f59e0b', label:'Atrasado' },
                  { cor:'#cbd5e1', label:'Não iniciado' },
                ].map(l => (
                  <div key={l.label} style={{
                    display:'flex',alignItems:'center',
                    gap:3,fontSize:7,color:'#888',
                  }}>
                    <div style={{
                      width:7,height:7,borderRadius:2,
                      background:l.cor,flexShrink:0,
                    }}/>
                    {l.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── PRÓXIMAS + CONCLUÍDAS ── */}
        <div className="print-grid-2" style={{
          display:'grid',
          gridTemplateColumns:'repeat(2,minmax(0,1fr))',
          gap:8,
        }}>
          <div className="print-panel" style={{
            border:`0.5px solid ${BORD}`,
            borderRadius:6,padding:9,overflow:'hidden',
          }}>
            <div style={stSec}>Próximas atividades</div>
            {proximas.length === 0 ? (
              <p style={{ fontSize:9,color:'#999' }}>
                Nenhuma atividade agendada.
              </p>
            ) : proximas.slice(0, 6).map(a => (
              <div key={a.id} style={{
                display:'flex',gap:5,padding:'3px 0',
                borderBottom:`0.5px solid #f3f4f6`,
                alignItems:'flex-start',fontSize:9,
              }}>
                <span style={{
                  fontSize:8,color:'#aaa',minWidth:26,
                  flexShrink:0,paddingTop:1,
                }}>
                  {formatarDataCurta(a.data)}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ color:'#222',lineHeight:1.3 }}>
                    {a.atividade}
                  </div>
                  <div style={{ fontSize:8,color:'#bbb' }}>
                    {a.usuario}
                  </div>
                </div>
                <span style={{
                  fontSize:7,padding:'1px 5px',
                  borderRadius:9,fontWeight:500,
                  flexShrink:0,whiteSpace:'nowrap',
                  background: a.status === 'Confirmado'
                    ? '#d1fae5' : '#dbeafe',
                  color: a.status === 'Confirmado'
                    ? '#065f46' : '#1e40af',
                }}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
          <div className="print-panel" style={{
            border:`0.5px solid ${BORD}`,
            borderRadius:6,padding:9,overflow:'hidden',
          }}>
            <div style={stSec}>Atividades concluídas</div>
            {concluidas.length === 0 ? (
              <p style={{ fontSize:9,color:'#999' }}>
                Nenhuma atividade concluída.
              </p>
            ) : concluidas.slice(0, 6).map(a => (
              <div key={a.id} style={{
                display:'flex',gap:5,padding:'3px 0',
                borderBottom:`0.5px solid #f3f4f6`,
                alignItems:'flex-start',fontSize:9,
              }}>
                <span style={{
                  fontSize:8,color:'#aaa',minWidth:26,
                  flexShrink:0,paddingTop:1,
                }}>
                  {formatarDataCurta(a.data)}
                </span>
                <div style={{ flex:1 }}>
                  <div style={{ color:'#222',lineHeight:1.3 }}>
                    {a.atividade}
                  </div>
                  <div style={{ fontSize:8,color:'#bbb' }}>
                    {a.usuario}
                  </div>
                </div>
                <span style={{
                  fontSize:7,padding:'1px 5px',
                  borderRadius:9,fontWeight:500,
                  flexShrink:0,
                  background:'#d1fae5',color:'#065f46',
                }}>
                  Concluído
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RISCOS + SALDO/AVANÇO ── */}
        <div className="print-grid-2" style={{
          display:'grid',
          gridTemplateColumns:'repeat(2,minmax(0,1fr))',
          gap:8,
        }}>
          <div className="print-panel" style={{
            border:`0.5px solid ${BORD}`,
            borderRadius:6,padding:9,overflow:'hidden',
          }}>
            <div style={{ ...stSec,
              display:'flex',alignItems:'center',
              justifyContent:'space-between' }}>
              <span>Mapeamento de riscos</span>
              {riscos.filter(r=>r.status!=='Encerrado').length>0&&(
                <span style={{
                  fontSize:7,padding:'1px 6px',
                  borderRadius:9,fontWeight:500,
                  background:'#fee2e2',color:'#991b1b',
                }}>
                  {riscos.filter(r=>r.status!=='Encerrado').length}
                  {' '}ativo(s)
                </span>
              )}
            </div>
            {riscos.filter(r=>r.status!=='Encerrado')
              .slice(0,4).map(r => {
              const resp = stakeholders.find(
                s => s.id === r.responsavel_id);
              return (
                <div key={r.id} style={{
                  padding:'4px 0',
                  borderBottom:`0.5px solid #f3f4f6`,
                }}>
                  <div style={{
                    display:'flex',
                    justifyContent:'space-between',
                    gap:4,marginBottom:2,
                    alignItems:'flex-start',
                  }}>
                    <span style={{
                      fontSize:9,fontWeight:500,
                      color:'#222',flex:1,lineHeight:1.3,
                    }}>
                      {r.descricao}
                    </span>
                    <div style={{
                      display:'flex',gap:3,flexShrink:0,
                    }}>
                      {[r.probabilidade, r.impacto, r.status]
                        .map((v,i) => (
                        <span key={i} style={{
                          fontSize:7,padding:'1px 5px',
                          borderRadius:9,fontWeight:500,
                          background:
                            v==='Alta'||v==='Alto'
                              ? '#fee2e2'
                            : v==='Média'||v==='Médio'
                              ? '#fef3c7'
                            : v==='Identificado'
                              ? '#dbeafe'
                            : v==='Em Mitigação'
                              ? '#fef3c7'
                            : '#f3f4f6',
                          color:
                            v==='Alta'||v==='Alto'
                              ? '#991b1b'
                            : v==='Média'||v==='Médio'
                              ? '#92400e'
                            : v==='Identificado'
                              ? '#1e40af'
                            : v==='Em Mitigação'
                              ? '#92400e'
                            : '#6b7280',
                        }}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  {r.acao_mitigadora && (
                    <div style={{ fontSize:8,color:'#999' }}>
                      Ação: {r.acao_mitigadora}
                      {resp && ` · Resp: ${resp.nome}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Saldo modo interno / Avanço modo cliente */}
          <div className="print-panel" style={{
            border:`0.5px solid ${BORD}`,
            borderRadius:6,padding:9,overflow:'hidden',
          }}>
            {!hideHoras ? (
              <>
                <div style={stSec}>
                  Saldo de horas por atividade
                </div>
                <table style={{
                  width:'100%',borderCollapse:'collapse',
                  fontSize:9,tableLayout:'fixed',
                }}>
                  <colgroup>
                    <col style={{width:'44%'}}/>
                    <col style={{width:'13%'}}/>
                    <col style={{width:'13%'}}/>
                    <col style={{width:'14%'}}/>
                    <col style={{width:'16%'}}/>
                  </colgroup>
                  <thead>
                    <tr style={{
                      borderBottom:`0.5px solid ${BORD}` }}>
                      {['Atividade','Prev.','Real.','','Saldo']
                        .map((h,i) => (
                        <th key={i} style={{
                          textAlign: i>=1 ? 'right':'left',
                          fontSize:8,fontWeight:500,
                          color:'#aaa',padding:'0 3px 3px',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {atividades.map(a => {
                      const r = getHorasRealizadasAtividade(a);
                      const s = a.horas - r;
                      const p = a.horas > 0
                        ? Math.min(
                          Math.round(r/a.horas*100),100) : 0;
                      const cor = p>=100?'#059669'
                        :p>=50?'#3b82f6':'#f59e0b';
                      return (
                        <tr key={a.id} style={{
                          borderBottom:`0.5px solid #f9fafb` }}>
                          <td style={{
                            padding:3,overflow:'hidden',
                            textOverflow:'ellipsis',
                            whiteSpace:'nowrap',
                          }}>
                            {a.descricao}
                          </td>
                          <td style={{
                            textAlign:'right',
                            color:'#888',padding:3,
                          }}>
                            {a.horas}h
                          </td>
                          <td style={{
                            textAlign:'right',
                            color:'#888',padding:3,
                          }}>
                            {r}h
                          </td>
                          <td style={{ padding:3 }}>
                            <div style={{
                              width:36,height:3,
                              background:'#e5e7eb',
                              borderRadius:2,overflow:'hidden',
                            }}>
                              <div style={{
                                width:`${p}%`,height:3,
                                background:cor,borderRadius:2,
                              }}/>
                            </div>
                          </td>
                          <td style={{
                            textAlign:'right',padding:3,
                            color: s>=0?'#059669':'#dc2626',
                          }}>
                            {s>=0?'+':''}{s}h
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const tP = atividades.reduce(
                        (s,a)=>s+a.horas, 0);
                      const tR = getHorasRealizadasTotal();
                      const ts = tP - tR;
                      return (
                        <tr style={{
                          borderTop:`1px solid ${BORD}` }}>
                          <td style={{
                            fontWeight:500,paddingTop:4,
                          }}>
                            Total
                          </td>
                          <td style={{
                            textAlign:'right',
                            color:'#888',paddingTop:4,
                          }}>
                            {tP}h
                          </td>
                          <td style={{
                            textAlign:'right',
                            color:'#888',paddingTop:4,
                          }}>
                            {tR}h
                          </td>
                          <td/>
                          <td style={{
                            textAlign:'right',paddingTop:4,
                            fontWeight:500,
                            color: ts>=0?'#059669':'#dc2626',
                          }}>
                            {ts>=0?'+':''}{ts}h
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </>
            ) : (
              <>
                <div style={stSec}>
                  Avanço físico por atividade
                </div>
                <table style={{
                  width:'100%',borderCollapse:'collapse',
                  fontSize:9,tableLayout:'fixed',
                }}>
                  <colgroup>
                    <col style={{width:'46%'}}/>
                    <col style={{width:'14%'}}/>
                    <col style={{width:'40%'}}/>
                  </colgroup>
                  <thead>
                    <tr style={{
                      borderBottom:`0.5px solid ${BORD}` }}>
                      <th style={{
                        textAlign:'left',fontSize:8,
                        fontWeight:500,color:'#aaa',
                        padding:'0 3px 3px',
                      }}>
                        Atividade
                      </th>
                      <th style={{
                        textAlign:'right',fontSize:8,
                        fontWeight:500,color:'#aaa',
                        padding:'0 3px 3px',
                      }}>
                        Avanço
                      </th>
                      <th style={{
                        fontSize:8,fontWeight:500,
                        color:'#aaa',padding:'0 3px 3px 8px',
                      }}>
                        Progresso
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividades.map(a => {
                      const r = getHorasRealizadasAtividade(a);
                      const p = a.horas > 0
                        ? Math.min(
                          Math.round(r/a.horas*100),100) : 0;
                      const cor = p>=100?'#059669'
                        :p>=50?'#3b82f6'
                        :p>0?'#f59e0b':'#cbd5e1';
                      return (
                        <tr key={a.id} style={{
                          borderBottom:`0.5px solid #f9fafb` }}>
                          <td style={{
                            padding:3,overflow:'hidden',
                            textOverflow:'ellipsis',
                            whiteSpace:'nowrap',
                          }}>
                            {a.descricao}
                          </td>
                          <td style={{
                            textAlign:'right',padding:3,
                            fontWeight:500,color:cor,
                          }}>
                            {p}%
                          </td>
                          <td style={{ padding:'3px 3px 3px 8px' }}>
                            <div style={{
                              width:'100%',height:5,
                              background:'#e5e7eb',
                              borderRadius:2,overflow:'hidden',
                            }}>
                              <div style={{
                                width:`${p}%`,height:5,
                                background:cor,borderRadius:2,
                              }}/>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:`1px solid ${BORD}` }}>
                      <td style={{
                        fontWeight:500,paddingTop:5,
                        color: NAVY,
                      }}>
                        Avanço geral
                      </td>
                      <td style={{
                        textAlign:'right',paddingTop:5,
                        fontWeight:500,color: NAVY,
                      }}>
                        {pctGeral}%
                      </td>
                      <td style={{
                        padding:'5px 3px 0 8px',
                      }}>
                        <div style={{
                          width:'100%',height:5,
                          background:'#e5e7eb',
                          borderRadius:2,overflow:'hidden',
                        }}>
                          <div style={{
                            width:`${pctGeral}%`,height:5,
                            background: NAVY,borderRadius:2,
                          }}/>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── RODAPÉ ── */}
      <div style={{
        borderTop:`2px solid ${NAVY}`,
        padding:'9px 24px',
        background: BGFT,
      }}>
        <div style={{
          fontSize:7,fontWeight:500,color: NAVY,
          letterSpacing:'0.06em',textTransform:'uppercase',
          marginBottom:6,
        }}>
          Responsabilidades e aprovação
        </div>
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(3,minmax(0,1fr))',
          gap:12,marginBottom:5,
        }}>
          <div>
            <div style={{ fontSize:7,color:'#bbb',
              textTransform:'uppercase',
              letterSpacing:'0.04em' }}>
              Coordenador do projeto
            </div>
            <div style={{ fontSize:10,fontWeight:500,
              color:'#222',marginTop:2 }}>
              {coordenadorNome}
            </div>
            <div style={{ fontSize:8,color:'#777',
              marginTop:1 }}>
              Grupo Aceex · Consultoria
            </div>
            <div style={{ marginTop:4,paddingTop:3,
              borderTop:`0.5px solid #cbd5e1`,
              fontSize:7,color:'#ccc' }}>
              Emitido em:{' '}
              {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div>
            <div style={{ fontSize:7,color:'#bbb',
              textTransform:'uppercase',
              letterSpacing:'0.04em' }}>
              Responsável pelo cliente
            </div>
            <div style={{ fontSize:10,fontWeight:500,
              color:'#222',marginTop:2 }}>
              {projeto.contato_nome || '—'}
            </div>
            <div style={{ fontSize:8,color:'#777',
              marginTop:1 }}>
              {projeto.nome_cliente}
              {projeto.contato_telefone
                ? ` · ${projeto.contato_telefone}` : ''}
            </div>
            <div style={{ marginTop:4,paddingTop:3,
              borderTop:`0.5px solid #cbd5e1`,
              fontSize:7,color:'#ccc' }}>
              {projeto.email_contato || ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize:7,color:'#bbb',
              textTransform:'uppercase',
              letterSpacing:'0.04em' }}>
              Competência do relatório
            </div>
            <div style={{ fontSize:10,fontWeight:500,
              color:'#222',marginTop:2 }}>
              {new Date().toLocaleDateString('pt-BR',
                { month:'long', year:'numeric' })}
            </div>
            <div style={{ fontSize:8,color:'#777',
              marginTop:1 }}>
              Status: {projeto.status || 'Em andamento'}
            </div>
            <div style={{ marginTop:4,paddingTop:3,
              borderTop:`0.5px solid #cbd5e1`,
              fontSize:7,color:'#ccc' }}>
              Próxima reunião: {proximaReuniao}
            </div>
          </div>
        </div>
        <div style={{
          display:'flex',justifyContent:'space-between',
          paddingTop:4,
          borderTop:`0.5px solid #e5e7eb`,
          fontSize:7,color:'#bbb',
        }}>
          <span>
            Grupo Aceex — Documento confidencial.
            Uso restrito ao cliente e equipe do projeto.
          </span>
          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
}
