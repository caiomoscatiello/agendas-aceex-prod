// src/components/consultor/ui/GanttCanvas.tsx
// Gantt Canvas extraido do AdminStatusReport.tsx para uso no ConsultorDashboardV2.
// Zero alteracao no AdminStatusReport original.
// Encoding: UTF-8 sem BOM

import React, { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// ??? Tipos (espelho dos tipos do AdminStatusReport) ???????????????????????????

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
};

type GanttTooltipData = {
  x: number; y: number; label: string;
  inicio: string; fim: string; status: string;
  horas: number; real: number; pct: number; cor: string;
};

// ??? Props ????????????????????????????????????????????????????????????????????

type Props = {
  projetoId: string;
  projetoNome: string;
};

// ??? Helpers (portados 1:1 do AdminStatusReport) ?????????????????????????????

const parseDataUTC = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const fmtDataCurta = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
};

const getStatusAtividade = (a: Atividade, horasReal: number): string => {
  const hoje = new Date().toISOString().slice(0, 10);
  if (horasReal >= a.horas && a.horas > 0) return "Concluido";
  if (a.data_fim && a.data_fim < hoje && horasReal < a.horas) return "Atrasado";
  if (a.data_inicio && a.data_inicio > hoje) return "Nao iniciado";
  return "Em andamento";
};

const getCorAtividade = (status: string): string => {
  switch (status) {
    case "Concluido":    return "#10b981";
    case "Atrasado":     return "#f59e0b";
    case "Nao iniciado": return "#cbd5e1";
    case "Em andamento": return "#3b82f6";
    default:             return "#94a3b8";
  }
};

// ??? Componente ???????????????????????????????????????????????????????????????

export function GanttCanvas({ projetoId, projetoNome }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading]             = useState(true);
  const [atividades, setAtividades]       = useState<Atividade[]>([]);
  const [cronogramaMap, setCronogramaMap] = useState<Record<string, CronogramaItem[]>>({});
  const [apontamentos, setApontamentos]   = useState<Apontamento[]>([]);
  const [exibirSubitens, setExibirSubitens] = useState(false);
  const [tooltip, setTooltip]             = useState<GanttTooltipData | null>(null);
  const [thumbW, setThumbW]               = useState(40);
  const [thumbL, setThumbL]               = useState(0);

  // ?? Carga de dados ??????????????????????????????????????????????????????????

  useEffect(() => {
    if (projetoId) loadDados();
  }, [projetoId]);

  const loadDados = async () => {
    setLoading(true);
    try {
      // Atividades do projeto
      const { data: ativData } = await supabase
        .from("projeto_atividades")
        .select("id, projeto_id, codigo, descricao, horas, data_inicio, data_fim")
        .eq("projeto_id", projetoId)
        .order("codigo");

      const ativs = (ativData || []) as Atividade[];
      setAtividades(ativs);

      // Cronograma itens por atividade
      if (ativs.length > 0) {
        const ativIds = ativs.map(a => a.id);
        const { data: ciData } = await supabase
          .from("cronograma_itens")
          .select("id, atividade_id, codigo, descricao, horas_reservadas, data_inicio, data_fim")
          .in("atividade_id", ativIds)
          .order("codigo");

        const cMap: Record<string, CronogramaItem[]> = {};
        (ciData || []).forEach((ci: CronogramaItem) => {
          if (!cMap[ci.atividade_id]) cMap[ci.atividade_id] = [];
          cMap[ci.atividade_id].push(ci);
        });
        setCronogramaMap(cMap);
      }

      // Apontamentos do projeto (via atividade_codigo)
      const codigos = ativs.map(a => a.codigo);
      if (codigos.length > 0) {
        const { data: apData } = await supabase
          .from("apontamento_atividades" as any)
          .select("atividade_codigo, horas")
          .in("atividade_codigo", codigos);
        setApontamentos((apData || []) as Apontamento[]);
      }
    } catch (e) {
      console.error("GanttCanvas loadDados error:", e);
    }
    setLoading(false);
  };

  // ?? Helpers de calculo ??????????????????????????????????????????????????????

  const getHorasRealizadas = (atv: Atividade): number =>
    apontamentos
      .filter(a => a.atividade_codigo === atv.codigo)
      .reduce((sum, a) => sum + a.horas, 0);

  // ?? Draw Gantt (portado 1:1 do AdminStatusReport) ???????????????????????????

  const drawGantt = () => {
    const canvas = canvasRef.current;
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
    const MON_PT    = ["Jan","Fev","Mar","Abr","Mai","Jun",
                       "Jul","Ago","Set","Out","Nov","Dez"];

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
      ctx.font      = "12px sans-serif";
      ctx.fillStyle = "#888";
      ctx.fillText("Cadastre datas nas atividades para visualizar o Gantt.", 10, 24);
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
      if (a.data_fim)    { const t = parseDataUTC(a.data_fim);    if (t > maxMs) maxMs = t; }
      if (exibirSubitens) {
        (cronogramaMap[a.id] || []).forEach(s => {
          if (s.data_inicio) { const t = parseDataUTC(s.data_inicio); if (t < minMs) minMs = t; }
          if (s.data_fim)    { const t = parseDataUTC(s.data_fim);    if (t > maxMs) maxMs = t; }
        });
      }
    });

    if (minMs === Infinity || maxMs === -Infinity) {
      canvas.style.height = "40px";
      const ctx2 = canvas.getContext("2d")!;
      ctx2.font      = "12px sans-serif";
      ctx2.fillStyle = "#888";
      ctx2.fillText("Cadastre datas nas atividades.", 10, 24);
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
    if (canvas.parentElement) canvas.parentElement.style.width = totalW + "px";

    const ctx = canvas.getContext("2d")!;
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, totalW, totalH);

    // Zebra rows
    rows.forEach((_, i) => {
      const y = HEAD_H + i * ROW_H;
      ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.018)" : "transparent";
      ctx.fillRect(0, y, totalW, ROW_H);
    });

    // Grid lines
    meses.forEach(mes => {
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(mes.x1, HEAD_H);
      ctx.lineTo(mes.x1, totalH);
      ctx.stroke();
    });

    // Year headers
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

    // Month headers
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

    // Today line
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

    // Label column divider
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

    // Rows with bars
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
        horasReal  = getHorasRealizadas(a);
        cor        = getCorAtividade(getStatusAtividade(a, horasReal));
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

    // Store metadata for tooltip
    (canvas as any)._ganttRows   = rows;
    (canvas as any)._ganttHeadH  = HEAD_H;
    (canvas as any)._ganttRowH   = ROW_H;
    (canvas as any)._ganttLabelW = LABEL_W;
  };

  // ?? Draw effect (portado 1:1) ???????????????????????????????????????????????

  useEffect(() => {
    if (loading) return;
    const tryDraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.parentElement?.clientWidth
             || canvas.parentElement?.offsetWidth || 0;
      if (w > 0) drawGantt();
      else requestAnimationFrame(tryDraw);
    };
    const container = canvasRef.current?.parentElement;
    if (!container) { requestAnimationFrame(tryDraw); return; }
    const ro = new ResizeObserver(() => requestAnimationFrame(tryDraw));
    ro.observe(container);
    requestAnimationFrame(tryDraw);
    return () => ro.disconnect();
  }, [atividades, apontamentos, cronogramaMap, exibirSubitens, loading]);

  // ?? Scroll thumb ???????????????????????????????????????????????????????????

  const updateThumb = () => {
    const el    = document.getElementById("gantt-v2-scroll");
    const track = document.getElementById("gantt-v2-track");
    if (!el || !track) return;
    const sw = el.scrollWidth, cw = el.clientWidth, tw = track.clientWidth;
    if (sw <= cw) { setThumbW(tw); setThumbL(0); return; }
    const thw = Math.max(cw / sw * tw, 24);
    const thl = (el.scrollLeft / (sw - cw)) * (tw - thw);
    setThumbW(thw);
    setThumbL(thl);
  };

  useEffect(() => {
    const el = document.getElementById("gantt-v2-scroll");
    if (!el) return;
    el.addEventListener("scroll", updateThumb);
    return () => el.removeEventListener("scroll", updateThumb);
  }, [thumbW]);

  useEffect(() => { updateThumb(); }, [atividades, exibirSubitens, loading]);

  // ?? Tooltip handlers ???????????????????????????????????????????????????????

  const getRowAt = (canvas: HTMLCanvasElement, cx: number, cy: number) => {
    const rows   = (canvas as any)._ganttRows   as any[];
    const HEAD_H = (canvas as any)._ganttHeadH  as number;
    const ROW_H  = (canvas as any)._ganttRowH   as number;
    const LW     = (canvas as any)._ganttLabelW as number;
    if (!rows || cy < HEAD_H || cx < LW) return null;
    const i = Math.floor((cy - HEAD_H) / ROW_H);
    return (i >= 0 && i < rows.length) ? rows[i] : null;
  };

  const buildTooltip = (
    row: any, canvas: HTMLCanvasElement, cx: number, cy: number
  ): GanttTooltipData | null => {
    const d = row.atividade || row.sub;
    if (!d) return null;
    const dataI = row.atividade ? row.atividade.data_inicio : row.sub.data_inicio;
    const dataF = row.atividade ? row.atividade.data_fim    : row.sub.data_fim;
    if (!dataI || !dataF) return null;
    const horas   = row.atividade ? row.atividade.horas : row.sub.horas_reservadas;
    const real    = row.atividade ? getHorasRealizadas(row.atividade) : 0;
    const pct     = horas > 0 ? Math.round(real / horas * 100) : 0;
    const status  = row.atividade ? getStatusAtividade(row.atividade, real) : (pct === 100 ? "Concluido" : pct > 0 ? "Em andamento" : "Nao iniciado");
    const cor     = getCorAtividade(status);
    const ttW     = 200;
    let tx = cx + 14;
    if (tx + ttW > canvas.offsetWidth) tx = cx - ttW - 8;
    return {
      x: Math.max(0, tx), y: Math.max(0, cy - 10),
      label: row.label,
      inicio: fmtDataCurta(dataI), fim: fmtDataCurta(dataF),
      status, horas, real, pct, cor,
    };
  };

  const handleHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const row  = getRowAt(canvas, cx, cy);
    if (!row) { setTooltip(null); return; }
    setTooltip(buildTooltip(row, canvas, cx, cy));
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.touches[0].clientX - rect.left;
    const cy   = e.touches[0].clientY - rect.top;
    const row  = getRowAt(canvas, cx, cy);
    if (!row) { setTooltip(null); return; }
    setTooltip(buildTooltip(row, canvas, cx, cy));
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el    = document.getElementById("gantt-v2-scroll");
    const track = document.getElementById("gantt-v2-track");
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const frac = (e.clientX - rect.left - thumbW / 2) / (track.clientWidth - thumbW);
    el.scrollLeft = Math.max(0, frac * (el.scrollWidth - el.clientWidth));
  };

  const handleThumbDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el    = document.getElementById("gantt-v2-scroll");
    const track = document.getElementById("gantt-v2-track");
    if (!el || !track) return;
    const startX   = e.clientX;
    const startScr = el.scrollLeft;
    const tw       = track.clientWidth;
    const onMove   = (mv: MouseEvent) => {
      const delta = (mv.clientX - startX) / (tw - thumbW) * (el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(0, startScr + delta);
      updateThumb();
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    e.preventDefault();
  };

  // ?? Render ??????????????????????????????????????????????????????????????????

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, gap: 8 }}>
        <Loader2 size={16} style={{ color: "#9CA3AF", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>
          Carregando cronograma...
        </span>
      </div>
    );
  }

  const semDatas = atividades.every(a => !a.data_inicio && !a.data_fim);

  if (semDatas) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 32, textAlign: "center" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF" }}>
          Sem datas no cronograma
        </span>
        <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>
          O coordenador deve cadastrar datas nas atividades
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 16px" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
            Cronograma - {projetoNome}
          </div>
          <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
            {atividades.length} atividade{atividades.length !== 1 ? "s" : ""}
            {exibirSubitens && Object.values(cronogramaMap).reduce((s, arr) => s + arr.length, 0) > 0
              ? ` + ${Object.values(cronogramaMap).reduce((s, arr) => s + arr.length, 0)} subitens`
              : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Legenda */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["#10b981", "Concluido"],
              ["#3b82f6", "Em andamento"],
              ["#f59e0b", "Atrasado"],
              ["#cbd5e1", "Nao iniciado"],
            ].map(([cor, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#9CA3AF" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
          {/* Toggle subitens */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none" }}
            onClick={() => setExibirSubitens(v => !v)}
          >
            <div style={{
              position: "relative", width: 26, height: 15,
              background: exibirSubitens ? "#0B1628" : "#D1D5DB",
              borderRadius: 8, transition: "background 0.2s", flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 2, left: exibirSubitens ? 13 : 2,
                width: 11, height: 11, background: "#fff", borderRadius: "50%",
                transition: "left 0.2s", pointerEvents: "none",
              }} />
            </div>
            <span style={{ fontSize: 10, color: "#6B7280" }}>Subitens</span>
          </div>
        </div>
      </div>

      {/* Canvas container com scroll */}
      <div style={{ position: "relative" }}>
        <div
          id="gantt-v2-scroll"
          style={{ overflowX: "auto", overflowY: "hidden", width: "100%" }}
          onMouseLeave={() => setTooltip(null)}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleHover}
            onMouseLeave={() => setTooltip(null)}
            onTouchStart={handleTouch}
            style={{ display: "block", cursor: "default" }}
          />
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: "absolute",
            left: tooltip.x, top: tooltip.y,
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.1)",
            borderRadius: 7,
            padding: "7px 10px",
            fontSize: 11,
            color: "#111827",
            pointerEvents: "none",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            minWidth: 180,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{tooltip.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: tooltip.cor, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#6B7280" }}>{tooltip.status}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6B7280" }}>
              {tooltip.inicio} - {tooltip.fim}
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
              {tooltip.real}h / {tooltip.horas}h ({tooltip.pct}%)
            </div>
          </div>
        )}
      </div>

      {/* Scrollbar customizada */}
      <div
        id="gantt-v2-track"
        onClick={handleTrackClick}
        style={{
          position: "relative", height: 6, background: "rgba(0,0,0,0.05)",
          borderRadius: 3, marginTop: 6, cursor: "pointer",
        }}
      >
        <div
          onMouseDown={handleThumbDown}
          style={{
            position: "absolute", top: 0, left: thumbL,
            width: thumbW, height: 6, background: "#0B1628",
            borderRadius: 3, cursor: "grab", opacity: 0.35,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.6")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.35")}
        />
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
