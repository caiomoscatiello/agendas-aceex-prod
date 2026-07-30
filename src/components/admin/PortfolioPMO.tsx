// src/components/admin/PortfolioPMO.tsx
// BL-PORTFOLIO Fase 3 -- Dashboard de Portfolio PMO integrado ao Admin
// Encoding: UTF-8 sem BOM

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Users, FolderOpen, AlertTriangle, Clock } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---- Tipos ----------------------------------------------------------------

type Projeto = {
  id: string;
  nome_cliente: string;
  status: string;
  horas_contratadas: number;
  codigo_cliente: string;
  coordenador_id: string | null;
};

type HealthSnapshot = {
  projeto_id: string;
  score_total: number;
  score_prazo: number;
  score_custo: number;
  score_feeling: number;
  score_alertas: number;
  semaforo: string;
  data_calculo: string;
  idp_valor: number;
  idc_valor: number;
  feeling_medio: number | null;
};

type HealthHistorico = {
  projeto_id: string;
  data_calculo: string;
  score_total: number;
  semaforo: string;
};

type OcupacaoConsultor = {
  user_id: string;
  name: string;
  especialidade: string | null;
  horas_dia: number;
  role: string;
  ano: number;
  mes: number;
  disponibilidade_pct: number;
  dias_uteis: number;
  capacidade_horas: number;
  horas_apontadas: number;
  pct_ocupacao: number;
};

type Alerta = {
  id: string;
  projeto_id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  status: string;
};

type SlaConfig = {
  dominio: string;
  dias_sla: number;
};

// ---- Constantes -------------------------------------------------------------

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const ESPECIALIDADE_LABELS: Record<string, string> = {
  funcional:     "Funcional",
  desenvolvedor: "Dev",
  qa:            "QA",
  techlead:      "Tech Lead",
};

const ESPECIALIDADE_COLORS: Record<string, string> = {
  funcional:     "#8b5cf6",
  desenvolvedor: "#3b82f6",
  qa:            "#10b981",
  techlead:      "#f59e0b",
};

const PIE_COLORS_STATUS = ["#6366f1","#10b981","#f59e0b","#ef4444","#64748b"];

const SLA_LABELS: Record<string, string> = {
  apontamento:    "Apontamento",
  documentacao:   "Documentacao",
  ocorrencia:     "Ocorrencia",
  kanban_fase:    "Kanban / Fase",
  pendencia:      "Pendencia",
  change_request: "Change Request",
  mencao:         "Mencao",
};

// ---- Helpers ------------------------------------------------------------------

function semaforoCor(s: string): string {
  if (s === "verde")    return "#10b981";
  if (s === "amarelo")  return "#f59e0b";
  if (s === "vermelho") return "#ef4444";
  return "#64748b";
}

function ocupacaoCor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  return "#10b981";
}

// ---- Sub-componentes ------------------------------------------------------------

function KpiCard({ label, value, sub, icon, cor }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; cor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: cor }}>{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-muted/60 text-muted-foreground flex-shrink-0">{icon}</div>
      </CardContent>
    </Card>
  );
}

function HealthBar({ score, semaforo: sem }: { score: number; semaforo: string }) {
  const cor = semaforoCor(sem);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: cor }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color: cor }}>{score}</span>
    </div>
  );
}

function SemaforoDot({ status }: { status: string }) {
  const cor = semaforoCor(status);
  return <span className="inline-block w-2.5 h-2.5 rounded-full align-middle" style={{ background: cor }} />;
}

// ---- Componente principal --------------------------------------------------------

export default function PortfolioPMO() {
  const hoje = new Date();
  const [anoSel, setAnoSel]     = useState<number>(hoje.getFullYear());
  const [mesSel, setMesSel]     = useState<number>(hoje.getMonth() + 1);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [projetos, setProjetos]           = useState<Projeto[]>([]);
  const [healthMap, setHealthMap]         = useState<Record<string, HealthSnapshot>>({});
  const [historico, setHistorico]         = useState<HealthHistorico[]>([]);
  const [ocupacao, setOcupacao]           = useState<OcupacaoConsultor[]>([]);
  const [alertas, setAlertas]             = useState<Alerta[]>([]);
  const [slaConfig, setSlaConfig]         = useState<SlaConfig[]>([]);
  const [projetoFoco, setProjetoFoco]     = useState<string>("todos");
  const [apontHoras, setApontHoras]       = useState<number>(0);

  // Anos/meses disponiveis para navegacao
  const anosDisponiveis = Array.from({ length: 3 }, (_, i) => hoje.getFullYear() - 1 + i);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Projetos
      const { data: proj } = await supabase
        .from("projetos")
        .select("id, nome_cliente, status, horas_contratadas, codigo_cliente, coordenador_id")
        .order("nome_cliente");
      const projs: Projeto[] = proj || [];
      setProjetos(projs);

      // 2. Ultimo health score de cada projeto
      if (projs.length > 0) {
        const { data: scores } = await supabase
          .from("projeto_health_historico")
          .select("projeto_id, score_total, score_prazo, score_custo, score_feeling, score_alertas, semaforo, data_calculo, idp_valor, idc_valor, feeling_medio")
          .in("projeto_id", projs.map(p => p.id))
          .order("data_calculo", { ascending: false });

        const map: Record<string, HealthSnapshot> = {};
        for (const s of (scores || []) as HealthSnapshot[]) {
          if (!map[s.projeto_id]) map[s.projeto_id] = s;
        }
        setHealthMap(map);

        // 3. Historico para o grafico (ultimas semanas do projeto em foco)
        const { data: hist } = await supabase
          .from("projeto_health_historico")
          .select("projeto_id, data_calculo, score_total, semaforo")
          .in("projeto_id", projs.map(p => p.id))
          .order("data_calculo", { ascending: true })
          .limit(200);
        setHistorico((hist || []) as HealthHistorico[]);
      }

      // 4. Ocupacao via view (mes/ano selecionado)
      const { data: ocup } = await supabase
        .from("vw_ocupacao_consultor")
        .select("user_id, name, especialidade, horas_dia, role, ano, mes, disponibilidade_pct, dias_uteis, capacidade_horas, horas_apontadas, pct_ocupacao")
        .eq("ano", anoSel)
        .eq("mes", mesSel);
      setOcupacao((ocup || []) as OcupacaoConsultor[]);

      // 5. Alertas ativos
      const { data: aler } = await supabase
        .from("projeto_alertas")
        .select("id, projeto_id, tipo, severidade, titulo, status")
        .eq("status", "ativo");
      setAlertas((aler || []) as Alerta[]);

      // 6. SLA Global
      const { data: sla } = await supabase
        .from("sla_config_global")
        .select("dominio, dias_sla")
        .order("dominio");
      setSlaConfig((sla || []) as SlaConfig[]);

      // 7. Total horas apontadas no mes
      const { data: aponts } = await supabase
        .from("apontamento_atividades")
        .select("horas, data");
      const totalApt = (aponts || [])
        .filter(a => {
          const d = new Date(a.data);
          return d.getFullYear() === anoSel && (d.getMonth() + 1) === mesSel;
        })
        .reduce((s, a) => s + Number(a.horas || 0), 0);
      setApontHoras(totalApt);

      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [anoSel, mesSel]);

  useEffect(() => { load(); }, [load]);

  // ---- Calculos -----------------------------------------------------------------

  const projetosFiltrados = projetoFoco === "todos"
    ? projetos
    : projetos.filter(p => p.id === projetoFoco);

  const totalProjetos  = projetosFiltrados.length;
  const comHealth      = projetosFiltrados.filter(p => healthMap[p.id]);
  const mediaHealth    = comHealth.length
    ? Math.round(comHealth.reduce((s, p) => s + healthMap[p.id].score_total, 0) / comHealth.length)
    : null;
  const totalAlertas   = alertas.filter(a => projetosFiltrados.find(p => p.id === a.projeto_id)).length;

  // Distribuicao de status
  const statusDist = projetos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const pieDataStatus = Object.entries(statusDist).map(([name, value]) => ({ name, value }));

  // Capacidade total do time no mes
  const capTotal  = ocupacao.reduce((s, o) => s + Number(o.capacidade_horas || 0), 0);
  const pctGlobal = capTotal > 0 ? Math.round(apontHoras / capTotal * 100) : 0;

  // Historico do projeto selecionado para grafico
  const histFoco = projetoFoco === "todos"
    ? historico.filter(h => comHealth.find(p => p.id === h.projeto_id))
    : historico.filter(h => h.projeto_id === projetoFoco);

  // Agrupar por data para o grafico (media se multiplos projetos)
  const histChart: { data: string; score: number }[] = (() => {
    const byDate: Record<string, number[]> = {};
    histFoco.forEach(h => {
      const key = h.data_calculo;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(h.score_total);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([d, scores]) => ({
        data: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      }));
  })();

  // Semaforo do portfolio
  const portfolioSem = (() => {
    if (!comHealth.length) return "neutro";
    const verdes    = comHealth.filter(p => healthMap[p.id]?.semaforo === "verde").length;
    const vermelhos = comHealth.filter(p => healthMap[p.id]?.semaforo === "vermelho").length;
    if (vermelhos > 0) return "vermelho";
    if (verdes === comHealth.length) return "verde";
    return "amarelo";
  })();

  // ---- Render ---------------------------------------------------------------------

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-500" />
            Portfolio PMO
            <SemaforoDot status={portfolioSem} />
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastUpdate
              ? `Atualizado ${format(lastUpdate, "HH:mm 'de' dd/MM", { locale: ptBR })}`
              : "Carregando..."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro projeto */}
          <Select value={projetoFoco} onValueChange={setProjetoFoco}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os projetos</SelectItem>
              {projetos.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome_cliente}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Navegacao mes/ano */}
          <Select value={String(mesSel)} onValueChange={v => setMesSel(Number(v))}>
            <SelectTrigger className="h-8 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES_PT.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anoSel)} onValueChange={v => setAnoSel(Number(v))}>
            <SelectTrigger className="h-8 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Projetos ativos"
              value={totalProjetos}
              sub="no portfolio"
              icon={<FolderOpen className="h-4 w-4" />}
            />
            <KpiCard
              label="Saude media"
              value={mediaHealth !== null ? `${mediaHealth}%` : "N/A"}
              sub={mediaHealth !== null
                ? mediaHealth >= 75 ? "Portfolio saudavel" : mediaHealth >= 50 ? "Atencao necessaria" : "Critico"
                : "Sem historico"}
              icon={<TrendingUp className="h-4 w-4" />}
              cor={mediaHealth !== null ? semaforoCor(mediaHealth >= 75 ? "verde" : mediaHealth >= 50 ? "amarelo" : "vermelho") : undefined}
            />
            <KpiCard
              label={`Ocupacao - ${MESES_PT[mesSel - 1]}/${anoSel}`}
              value={`${apontHoras.toFixed(0)}h`}
              sub={capTotal > 0 ? `${pctGlobal}% de ${capTotal.toFixed(0)}h capacidade` : "Sem disponibilidade cadastrada"}
              icon={<Clock className="h-4 w-4" />}
              cor={ocupacaoCor(pctGlobal)}
            />
            <KpiCard
              label="Alertas ativos"
              value={totalAlertas}
              sub={totalAlertas === 0 ? "Todos os projetos OK" : "Requerem atencao"}
              icon={<AlertTriangle className="h-4 w-4" />}
              cor={totalAlertas > 0 ? "#f59e0b" : "#10b981"}
            />
          </div>

          {/* Linha 2: Health History + Status Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Health Score Historico */}
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Evolucao Health Score
                  {projetoFoco !== "todos" && (
                    <span className="ml-1 normal-case font-normal">
                      - {projetos.find(p => p.id === projetoFoco)?.nome_cliente}
                    </span>
                  )}
                </p>
                {histChart.length > 0 ? (
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={histChart}>
                        <XAxis dataKey="data" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                        <ReTooltip
                          formatter={(v: number) => [`${v}`, "Health Score"]}
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "#6366f1" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
                    Sem historico disponivel
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuicao de Status */}
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Distribuicao de Status
                </p>
                {pieDataStatus.length > 0 ? (
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieDataStatus}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieDataStatus.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS_STATUS[i % PIE_COLORS_STATUS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend
                          iconType="square"
                          iconSize={8}
                          formatter={v => <span style={{ fontSize: 11 }}>{v}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
                    Sem projetos
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Projetos */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-semibold">Projetos do Portfolio</p>
                <span className="text-[11px] text-muted-foreground">{projetosFiltrados.length} projeto{projetosFiltrados.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Cliente</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide min-w-[180px]">Health Score</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Horas</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosFiltrados.map(p => {
                      const hs = healthMap[p.id];
                      return (
                        <tr key={p.id} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-semibold">{p.nome_cliente}</span>
                            <span className="block text-[10px] text-muted-foreground font-mono">{p.codigo_cliente}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {p.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {hs ? (
                              <HealthBar score={hs.score_total} semaforo={hs.semaforo} />
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Sem historico</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold">{p.horas_contratadas}h</span>
                            <span className="block text-[10px] text-muted-foreground">contratadas</span>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const qtd = alertas.filter(a => a.projeto_id === p.id).length;
                              return qtd > 0
                                ? <span className="font-bold text-amber-600">{qtd} alerta{qtd !== 1 ? "s" : ""}</span>
                                : <span className="text-muted-foreground">-</span>;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                    {projetosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhum projeto encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Ocupacao do Time */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  Ocupacao do Time - {MESES_PT[mesSel - 1]}/{anoSel}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Capacidade total: <strong>{capTotal.toFixed(0)}h</strong>
                </span>
              </div>

              {ocupacao.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhuma disponibilidade cadastrada para este mes.
                  <br />
                  <span className="text-muted-foreground/70">
                    Acesse Cadastros - Usuarios - aba Disponibilidade Mensal para configurar.
                  </span>
                </div>
              ) : (
                <>
                  {/* Barra global */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Ocupacao global do time</span>
                      <span className="font-bold" style={{ color: ocupacaoCor(pctGlobal) }}>
                        {apontHoras.toFixed(0)}h / {capTotal.toFixed(0)}h ({pctGlobal}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pctGlobal, 100)}%`, background: ocupacaoCor(pctGlobal) }}
                      />
                    </div>
                  </div>

                  {/* Por especialidade */}
                  {(["funcional","desenvolvedor","qa","techlead"] as const).some(
                    esp => ocupacao.some(o => o.especialidade === esp)
                  ) && (
                    <div className="px-4 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {(["funcional","desenvolvedor","qa","techlead"] as const)
                        .filter(esp => ocupacao.some(o => o.especialidade === esp))
                        .map(esp => {
                          const grupo = ocupacao.filter(o => o.especialidade === esp);
                          const capEsp = grupo.reduce((s, o) => s + Number(o.capacidade_horas || 0), 0);
                          const aptEsp = grupo.reduce((s, o) => s + Number(o.horas_apontadas || 0), 0);
                          const pct = capEsp > 0 ? Math.round(aptEsp / capEsp * 100) : 0;
                          const cor = ESPECIALIDADE_COLORS[esp];
                          return (
                            <div key={esp} className="p-2.5 rounded-lg border bg-muted/20">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-2 h-2 rounded-sm" style={{ background: cor }} />
                                <span className="text-[10px] font-semibold">{ESPECIALIDADE_LABELS[esp]}</span>
                              </div>
                              <div className="text-sm font-bold">{aptEsp.toFixed(0)}<span className="text-[10px] text-muted-foreground">h</span></div>
                              <div className="text-[10px] text-muted-foreground mb-1.5">de {capEsp.toFixed(0)}h</div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
                              </div>
                              <div className="text-[10px] font-bold mt-0.5" style={{ color: cor }}>{pct}%</div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Tabela individual */}
                  <div className="overflow-x-auto border-t">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Consultor</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Especialidade</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Disponib.</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">Capacidade</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide min-w-[160px]">Ocupacao</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ocupacao
                          .sort((a, b) => Number(b.pct_ocupacao) - Number(a.pct_ocupacao))
                          .map(o => {
                            const pct = Number(o.pct_ocupacao) || 0;
                            const cor = ocupacaoCor(pct);
                            return (
                              <tr key={o.user_id} className="border-t hover:bg-muted/20">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                      {(o.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium truncate max-w-[140px]">{o.name || o.user_id}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  {o.especialidade ? (
                                    <div className="flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-sm" style={{ background: ESPECIALIDADE_COLORS[o.especialidade] }} />
                                      <span>{ESPECIALIDADE_LABELS[o.especialidade] || o.especialidade}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="font-semibold">{o.disponibilidade_pct}%</span>
                                  <span className="block text-[10px] text-muted-foreground">{o.dias_uteis} dias uteis</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="font-semibold">{Number(o.capacidade_horas).toFixed(0)}h</span>
                                  <span className="block text-[10px] text-muted-foreground">{o.horas_dia}h/dia</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${Math.min(pct, 100)}%`, background: cor }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-bold w-9 text-right" style={{ color: cor }}>
                                      {pct.toFixed(0)}%
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {Number(o.horas_apontadas).toFixed(0)}h de {Number(o.capacidade_horas).toFixed(0)}h
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* SLA Global */}
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                SLA Global Configurado
              </p>
              {slaConfig.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum SLA configurado.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {slaConfig.map(s => (
                    <div key={s.dominio} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border">
                      <span className="text-xs font-medium">{SLA_LABELS[s.dominio] || s.dominio}</span>
                      <Badge variant="secondary" className="text-[10px] ml-2 flex-shrink-0">
                        {s.dias_sla}d
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
