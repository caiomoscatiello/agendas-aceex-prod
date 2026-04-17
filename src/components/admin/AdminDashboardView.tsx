import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import aceexLogo from "@/assets/aceex_logo.jpg";

type Projeto = {
  id: string;
  nome_cliente: string;
  site_cliente: string | null;
  horas_contratadas: number;
  coordenador_id: string | null;
  status: string;
};

type ProjetoAtividade = {
  id: string;
  codigo: string;
  descricao: string;
  horas: number;
};

type Agenda = {
  id: string;
  atividade: string;
  data: string;
  usuario: string;
  user_id: string;
  status: string;
  item_cronograma?: string | null;
  modalidade?: string | null;
};

type Apontamento = {
  id: string;
  data: string;
  hora: string;
  tipo: string;
  user_id: string;
  cliente: string;
};

type ApontamentoAtividade = {
  id: string;
  atividade_codigo: string;
  atividade_descricao: string;
  horas: number;
  cliente: string;
  data: string;
  user_id: string;
  agenda_id: string;
  percentual_feeling?: number | null;
};

type FeelingConsultor = {
  nome: string;
  iniciais: string;
  horas: number;
  feeling: number;
  peso: number;
};

type FeelingAtividade = {
  atividade_codigo: string;
  media_ponderada: number;
  consultores: FeelingConsultor[];
  desvio: number;
  previsto: number;
};

type Alerta = {
  id: string;
  projeto_id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  detalhe: string;
  status: string;
  created_at: string;
};


const ACTIVE_AGENDA_STATUSES = ["confirmada", "Pendente", "Em Aprovação", "Apontamento OK", "Apontamento Ajustado"];

const COLORS = {
  plan: "hsl(var(--foreground) / 0.7)",
  efet: "hsl(var(--chart-4))",
  saldo: "hsl(var(--muted-foreground) / 0.3)",
  green: "hsl(var(--chart-2))",
  purple: "hsl(var(--chart-5))",
  accent: "hsl(var(--chart-4))",
};

const PIE_COLORS = ["#334155", "#F59E0B", "#CBD5E1"];

function pctOf(val: number, total: number) {
  return total > 0 ? ((val / total) * 100).toFixed(0) : "0";
}

function SegmentBar({ planejadas, efetivadas, saldo, total, height = 6 }: { planejadas: number; efetivadas: number; saldo: number; total: number; height?: number }) {
  return (
    <div className="flex rounded-full overflow-hidden bg-muted" style={{ height }}>
      <div className="bg-slate-700 transition-all duration-400" style={{ width: `${pctOf(planejadas, total)}%` }} />
      <div className="bg-amber-500 transition-all duration-400" style={{ width: `${pctOf(efetivadas, total)}%` }} />
      <div className="bg-slate-300 transition-all duration-400" style={{ width: `${pctOf(saldo, total)}%` }} />
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-foreground text-background px-3 py-2 rounded-lg text-xs">
        <div className="font-bold">{payload[0].name}</div>
        <div>{payload[0].value}h</div>
      </div>
    );
  }
  return null;
};

type AtividadeData = {
  id: string;
  nome: string;
  contratadas: number;
  planejadas: number;
  efetivadas: number;
  saldo: number;
};

function AtividadeCard({ atv }: { atv: AtividadeData }) {
  const pctConsumido = atv.planejadas > 0 ? Number(pctOf(atv.efetivadas, atv.planejadas)) : 0;
  const consumidoColor = pctConsumido >= 90 ? "text-red-500" : pctConsumido >= 70 ? "text-amber-500" : "text-emerald-500";
  const consumidoBg = pctConsumido >= 90 ? "bg-red-500" : pctConsumido >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const consumidoBgLight = pctConsumido >= 90 ? "bg-red-50 border-red-100" : pctConsumido >= 70 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100";

  return (
    <Card>
      <CardContent className="p-3.5 space-y-3">
        {/* Name + total */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold leading-tight mb-0.5">{atv.nome}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-extrabold leading-none">{atv.contratadas}<span className="text-[10px] font-medium text-muted-foreground"> h</span></div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">contratadas</div>
          </div>
        </div>

        <SegmentBar planejadas={atv.planejadas} efetivadas={atv.efetivadas} saldo={atv.saldo} total={atv.contratadas} />

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "Planejadas", value: atv.planejadas, colorDot: "bg-slate-700" },
            { label: "Efetivadas", value: atv.efetivadas, colorDot: "bg-amber-500" },
            { label: "Saldo", value: atv.saldo, colorDot: "bg-slate-300" },
          ].map((m) => (
            <div key={m.label} className="bg-muted/50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-sm ${m.colorDot} shrink-0`} />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{m.label}</span>
              </div>
              <div className="text-sm font-bold">{m.value}<span className="text-[9px] text-muted-foreground"> h</span></div>
              <div className="text-[9px] text-muted-foreground">{pctOf(m.value, atv.contratadas)}%</div>
            </div>
          ))}
        </div>

        {/* Consumption */}
        <div className={`p-2.5 rounded-lg border ${consumidoBgLight}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Consumo do Planejado</span>
            <span className={`text-[11px] font-extrabold ${consumidoColor}`}>{pctConsumido}%</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${consumidoBg}`} style={{ width: `${Math.min(pctConsumido, 100)}%` }} />
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">
            {atv.efetivadas}h efetivadas de {atv.planejadas}h planejadas
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardView() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [coordenadorName, setCoordenadorName] = useState("");
  const [atividades, setAtividades] = useState<ProjetoAtividade[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [apontAtividades, setApontAtividades] = useState<ApontamentoAtividade[]>([]);
  const [periodoIdx, setPeriodoIdx] = useState(1);
  const [loadKey, setLoadKey] = useState(0);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasAberto, setAlertasAberto] = useState(false);
  const [showFeeling, setShowFeeling] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  const periodos = [
    { label: "7 dias", days: 7 },
    { label: "15 dias", days: 15 },
    { label: "30 dias", days: 30 },
    { label: "Todos", days: 9999 },
  ];

  const loadProjetos = async () => {
    const { data } = await supabase.from("projetos").select("id, nome_cliente, site_cliente, horas_contratadas, coordenador_id, status").order("nome_cliente");
    setProjetos(data || []);
  };

  // Carregar alertas consolidados (todos os projetos do coordenador)
  const loadAlertas = async (projetoId?: string) => {
    let query = supabase
      .from("projeto_alertas")
      .select("id, projeto_id, tipo, severidade, titulo, detalhe, status, created_at")
      .eq("status", "ativo")
      .order("severidade");

    if (projetoId) {
      query = query.eq("projeto_id", projetoId);
    } else {
      const ids = projetos.map((p) => p.id);
      if (!ids.length) return;
      query = query.in("projeto_id", ids);
    }

    const { data } = await query;
    setAlertas(data || []);
  };

  const resolverAlerta = async (alertaId: string) => {
    setResolvendo(alertaId);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("projeto_alertas")
      .update({
        status: "resolvido_manual",
        resolvido_por: user?.id,
        resolvido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertaId);
    setAlertas((prev) => prev.filter((a) => a.id !== alertaId));
    setResolvendo(null);
  };

  // Reload projects on mount
  useEffect(() => {
    loadProjetos();
  }, []);

  // Carregar alertas consolidados quando projetos carregam
  useEffect(() => {
    if (projetos.length > 0 && !selectedProjetoId) {
      loadAlertas();
    }
  }, [projetos]);

  // Carregar alertas do projeto selecionado
  useEffect(() => {
    if (selectedProjetoId) {
      loadAlertas(selectedProjetoId);
    }
  }, [selectedProjetoId, loadKey]);

  const selectedProjeto = useMemo(() => projetos.find((p) => p.id === selectedProjetoId), [projetos, selectedProjetoId]);

  useEffect(() => {
    if (!selectedProjetoId || !selectedProjeto) return;
    setLoading(true);

    const loadAll = async () => {
      // Load coordinator name
      if (selectedProjeto.coordenador_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", selectedProjeto.coordenador_id)
          .single();
        setCoordenadorName(profile?.name || "—");
      } else {
        setCoordenadorName("—");
      }

      // Load atividades, agendas, apontamentos, apontamento_atividades in parallel
      const [ativRes, agRes, apRes, apAtvRes] = await Promise.all([
        supabase.from("projeto_atividades").select("*").eq("projeto_id", selectedProjetoId),
        supabase.from("agendas").select("*").eq("cliente", selectedProjeto.nome_cliente),
        supabase.from("apontamentos").select("*").eq("cliente", selectedProjeto.nome_cliente),
        supabase.from("apontamento_atividades").select("*").eq("cliente", selectedProjeto.nome_cliente),
      ]);

      setAtividades(ativRes.data || []);
      setAgendas(agRes.data || []);
      setApontamentos(apRes.data || []);
      setApontAtividades(apAtvRes.data || []);

      // Carregar nomes dos consultores
      const userIds = [...new Set([
        ...(agRes.data || []).map((a: any) => a.user_id),
        ...(apAtvRes.data || []).map((a: any) => a.user_id),
      ].filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", userIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { map[p.user_id] = p.name; });
        setProfilesMap(map);
      }

      setLoading(false);
    };

    loadAll();
  }, [selectedProjeto, loadKey]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedProjeto) return;
    const cliente = selectedProjeto.nome_cliente;

    const channel = supabase
      .channel(`dashboard-${selectedProjetoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agendas", filter: `cliente=eq.${cliente}` }, () => {
        supabase.from("agendas").select("*").eq("cliente", cliente).then(({ data }) => setAgendas(data || []));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamentos", filter: `cliente=eq.${cliente}` }, () => {
        supabase.from("apontamentos").select("*").eq("cliente", cliente).then(({ data }) => setApontamentos(data || []));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamento_atividades", filter: `cliente=eq.${cliente}` }, () => {
        supabase.from("apontamento_atividades").select("*").eq("cliente", cliente).then(({ data }) => setApontAtividades(data || []));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedProjetoId, selectedProjeto?.nome_cliente]);

  // Calculate activity data using current agenda statuses and apontamento_atividades
  const atividadesData: AtividadeData[] = useMemo(() => {
    return atividades.map((atv) => {
      const combinedLabel = `${atv.codigo} - ${atv.descricao}`;
      const matchAtividade = (a: Agenda) =>
        a.atividade === atv.descricao || a.atividade === atv.codigo || a.atividade === combinedLabel || a.atividade.startsWith(atv.codigo + " ");

      // Planejadas: agendas with active statuses × 8h
      const atividadeAgendas = agendas.filter((a) => matchAtividade(a) && ACTIVE_AGENDA_STATUSES.includes(a.status));
      const planejadas = atividadeAgendas.length * 8;

      // Efetivadas: sum of real hours from apontamento_atividades
      const efetivadas = apontAtividades
        .filter((ap) => ap.atividade_codigo === atv.codigo)
        .reduce((sum, ap) => sum + Number(ap.horas), 0);

      const saldo = Math.max(0, atv.horas - planejadas - efetivadas);

      return {
        id: atv.id,
        nome: `${atv.codigo} - ${atv.descricao}`,
        contratadas: atv.horas,
        planejadas,
        efetivadas,
        saldo,
      };
    });
  }, [atividades, agendas, apontAtividades]);

  const feelingPorAtividade: FeelingAtividade[] = useMemo(() => {
    return atividades.map((atv) => {
      const aponts = apontAtividades.filter(
        (ap) => ap.atividade_codigo === atv.codigo && ap.percentual_feeling !== null && ap.percentual_feeling !== undefined
      );
      if (aponts.length === 0) return { atividade_codigo: atv.codigo, media_ponderada: 0, consultores: [], desvio: 0, previsto: 0 };
      const porConsultor: Record<string, { horas: number; feeling: number }> = {};
      for (const ap of aponts) {
        if (!porConsultor[ap.user_id]) porConsultor[ap.user_id] = { horas: 0, feeling: ap.percentual_feeling! };
        porConsultor[ap.user_id].horas += Number(ap.horas);
        porConsultor[ap.user_id].feeling = ap.percentual_feeling!;
      }
      const totalHoras = Object.values(porConsultor).reduce((s, c) => s + c.horas, 0);
      const consultores: FeelingConsultor[] = Object.entries(porConsultor).map(([uid, c]) => {
        const nome = profilesMap[uid] || "Consultor";
        return { nome, iniciais: nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(), horas: c.horas, feeling: c.feeling, peso: totalHoras > 0 ? Math.round((c.horas / totalHoras) * 100) : 0 };
      });
      const mediaPonderada = totalHoras > 0 ? Math.round(consultores.reduce((s, c) => s + c.feeling * c.horas, 0) / totalHoras) : 0;
      const atvData = atividadesData.find((a) => a.id === atv.id);
      const previsto = atvData && atvData.contratadas > 0 ? Math.round((atvData.planejadas / atvData.contratadas) * 100) : 0;
      return { atividade_codigo: atv.codigo, media_ponderada: mediaPonderada, consultores, desvio: Math.abs(previsto - mediaPonderada), previsto };
    });
  }, [atividades, apontAtividades, profilesMap, atividadesData]);

  const totalAlertas = useMemo(() => feelingPorAtividade.filter((f) => f.desvio > 20 && f.consultores.length > 0).length, [feelingPorAtividade]);

  const totais = useMemo(() => {
    const base = atividadesData.reduce(
      (acc, a) => ({
        contratadas: acc.contratadas + a.contratadas,
        planejadas: acc.planejadas + a.planejadas,
        efetivadas: acc.efetivadas + a.efetivadas,
        saldo: acc.saldo + a.saldo,
      }),
      { contratadas: 0, planejadas: 0, efetivadas: 0, saldo: 0 }
    );
    // Use project-level horas_contratadas
    if (selectedProjeto) {
      base.contratadas = selectedProjeto.horas_contratadas;
      base.saldo = Math.max(0, base.contratadas - base.planejadas - base.efetivadas);
    }
    return base;
  }, [atividadesData, selectedProjeto]);

  const pieData = [
    { name: "Planejadas", value: totais.planejadas },
    { name: "Efetivadas", value: totais.efetivadas },
    { name: "Saldo", value: totais.saldo },
  ];

  // Filter agendas for "Próximas Agendas" section
  const filteredAgendas = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDays = periodos[periodoIdx].days;

    return agendas
      .filter((a) => {
        const target = new Date(a.data + "T00:00:00");
        const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= selectedDays;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [agendas, periodoIdx]);

  const getAgendaConclusao = (ag: Agenda) => {
    // Find the activity this agenda belongs to
    const atv = atividadesData.find((a) => {
      const codigo = a.nome.split(" - ")[0];
      const descricao = a.nome.substring(codigo.length + 3);
      return ag.atividade === descricao || ag.atividade === codigo || ag.atividade === a.nome || ag.atividade.startsWith(codigo + " ");
    });
    if (!atv || atv.contratadas <= 0) return 0;
    return Math.min(100, Math.round((atv.efetivadas / atv.contratadas) * 100));
  };

  const conclusaoColor = (pct: number) => {
    if (pct === 100) return "text-emerald-500";
    if (pct >= 60) return "text-amber-500";
    if (pct >= 20) return "text-violet-500";
    return "text-muted-foreground";
  };

  const conclusaoBg = (pct: number) => {
    if (pct === 100) return "bg-emerald-500";
    if (pct >= 60) return "bg-amber-500";
    if (pct >= 20) return "bg-violet-500";
    return "bg-slate-300";
  };

  const clientFavicon = selectedProjeto?.site_cliente
    ? `https://www.google.com/s2/favicons?domain=${selectedProjeto.site_cliente.replace(/^https?:\/\//, "")}&sz=64`
    : null;

  // Labels de tipo de alerta
  const tipoLabel: Record<string, string> = {
    feeling: "📉 Feeling",
    apontamento: "📋 Apontamento",
    consumo: "⏱ Consumo",
    parada: "⏸ Parada",
  };

  const projetoNome = (id: string) => projetos.find((p) => p.id === id)?.nome_cliente || "—";

  if (!selectedProjetoId) {
    const criticos  = alertas.filter((a) => a.severidade === "critico");
    const altos     = alertas.filter((a) => a.severidade === "alto");
    const moderados = alertas.filter((a) => a.severidade === "moderado");

    // Resolvidos na última semana
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

    const renderGrupo = (lista: Alerta[], corBorda: string, corFundo: string) =>
      lista.map((alerta) => (
        <div key={alerta.id} className={`bg-card border ${corFundo} ${corBorda} rounded-xl p-3 flex items-start gap-3`}>
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
            {tipoLabel[alerta.tipo]?.split(" ")[0] || "⚠️"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold text-muted-foreground">{projetoNome(alerta.projeto_id)}</span>
              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-semibold text-muted-foreground">
                {tipoLabel[alerta.tipo]?.split(" ").slice(1).join(" ") || alerta.tipo}
              </span>
            </div>
            <div className="text-[11px] font-semibold leading-tight">{alerta.titulo}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{alerta.detalhe}</div>
          </div>
          <button
            onClick={() => resolverAlerta(alerta.id)}
            disabled={resolvendo === alerta.id}
            className="text-[9px] px-2 py-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground font-semibold flex-shrink-0 disabled:opacity-50"
          >
            {resolvendo === alerta.id ? "..." : "Resolver"}
          </button>
        </div>
      ));

    return (
      <div className="space-y-4">
        {/* Select projeto */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Selecione um projeto para o dashboard detalhado:</p>
            <Select value={selectedProjetoId} onValueChange={setSelectedProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_cliente}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Header gerencial */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">Painel do Coordenador</div>
              <div className="text-base font-extrabold">{projetos.length} projeto{projetos.length !== 1 ? "s" : ""} ativos</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{alertas.length} alerta{alertas.length !== 1 ? "s" : ""} pendente{alertas.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
              <button onClick={() => { loadProjetos(); }} className="text-[10px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 ml-auto">
                <RefreshCw className="h-3 w-3" /> Atualizar
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 4 totalizadores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Críticos",  num: criticos.length,  bg: "bg-red-50 border-red-200 dark:bg-red-950/20",     text: "text-red-700 dark:text-red-400",    sub: "requerem ação imediata" },
            { label: "Altos",     num: altos.length,     bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-400", sub: "acompanhar hoje" },
            { label: "Moderados", num: moderados.length, bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20",   text: "text-blue-700 dark:text-blue-400",   sub: "monitorar" },
            { label: "Resolvidos (7d)", num: 0,          bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-400", sub: "últimos 7 dias" },
          ].map((t) => (
            <Card key={t.label} className={`border ${t.bg}`}>
              <CardContent className="p-4">
                <div className={`text-3xl font-extrabold ${t.text}`}>{t.num}</div>
                <div className={`text-[11px] font-bold mt-1 ${t.text}`}>{t.label}</div>
                <div className={`text-[10px] mt-0.5 opacity-70 ${t.text}`}>{t.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Distribuição por tipo */}
        {alertas.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Distribuição por tipo
                <span className="font-normal ml-2 normal-case">independente da severidade</span>
              </div>
              {(["feeling", "apontamento", "consumo", "parada"] as const).map((tipo) => {
                const count = alertas.filter((a) => a.tipo === tipo).length;
                const pct = alertas.length > 0 ? Math.round((count / alertas.length) * 100) : 0;
                const labels: Record<string, string> = { feeling: "📉 Feeling", apontamento: "📋 Agenda s/ Apontamento", consumo: "⏱ Consumo de Horas", parada: "⏸ Atividade Parada" };
                return (
                  <div key={tipo} className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-foreground w-44 shrink-0">{labels[tipo]}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-foreground/60" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-foreground w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Listagem por severidade */}
        {alertas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-2xl mb-2">✅</div>
              <div className="text-sm font-semibold text-muted-foreground">Nenhum alerta ativo</div>
              <div className="text-xs text-muted-foreground mt-1">Todos os projetos estão saudáveis</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {criticos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Críticos · {criticos.length}</span>
                </div>
                <div className="space-y-2">{renderGrupo(criticos, "border-red-200", "bg-red-50/50 dark:bg-red-950/10")}</div>
              </div>
            )}
            {altos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Altos · {altos.length}</span>
                </div>
                <div className="space-y-2">{renderGrupo(altos, "border-amber-200", "bg-amber-50/50 dark:bg-amber-950/10")}</div>
              </div>
            )}
            {moderados.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Moderados · {moderados.length}</span>
                </div>
                <div className="space-y-2">{renderGrupo(moderados, "border-blue-200", "bg-blue-50/50 dark:bg-blue-950/10")}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Project selector */}
      <Select value={selectedProjetoId} onValueChange={setSelectedProjetoId}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projetos.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.nome_cliente}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white/10 pointer-events-none" />
        {/* Top row: logos left, project name + refresh right */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            {clientFavicon && (
              <img src={clientFavicon} alt="Logo cliente" className="h-12 w-12 rounded-xl bg-white p-1 shadow-lg" />
            )}
            <img src={aceexLogo} alt="ACEEX" className="h-10 object-contain rounded-lg bg-white px-2 py-0.5 shadow-lg" />
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1">Dashboard</div>
            <div className="text-xl font-extrabold leading-tight">{selectedProjeto?.nome_cliente}</div>
            {selectedProjeto?.status && (
              <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                selectedProjeto.status === "Liberado" ? "bg-emerald-500/20 text-emerald-400" :
                selectedProjeto.status === "Encerrado" ? "bg-red-500/20 text-red-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {selectedProjeto.status}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="relative z-10 mt-2 gap-1 text-xs text-slate-300 hover:text-white hover:bg-white/10"
              onClick={() => { loadProjetos(); setLoadKey((k) => k + 1); }}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
        {/* Bottom row: date + coordinator left */}
        <div className="flex flex-col gap-0.5">
          <div className="text-xs text-slate-400">
            {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </div>
          <div className="text-xs text-slate-400">Coordenador: {coordenadorName}</div>
        </div>
      </div>

      {/* Bloco de alertas do projeto — colapsado por padrão */}
      {alertas.length > 0 && (() => {
        const criticos  = alertas.filter((a) => a.severidade === "critico");
        const altos     = alertas.filter((a) => a.severidade === "alto");
        const moderados = alertas.filter((a) => a.severidade === "moderado");

        return (
          <Card className="overflow-hidden">
            {/* Header colapsável */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
              onClick={() => setAlertasAberto((v) => !v)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-sm">⚠️</div>
                <span className="text-xs font-bold">Alertas do Projeto</span>
                {criticos.length > 0 && (
                  <span className="text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                    🔴 {criticos.length} crítico{criticos.length !== 1 ? "s" : ""}
                  </span>
                )}
                {altos.length > 0 && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                    🟠 {altos.length} alto{altos.length !== 1 ? "s" : ""}
                  </span>
                )}
                {moderados.length > 0 && (
                  <span className="text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                    🔵 {moderados.length} moderado{moderados.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <span className={`text-muted-foreground text-xs transition-transform duration-200 ${alertasAberto ? "rotate-180" : ""}`}>▾</span>
            </button>

            {/* Corpo colapsável */}
            {alertasAberto && (
              <CardContent className="p-3 space-y-3">
                {[
                  { lista: criticos,  cor: "border-red-200",   fundo: "bg-red-50/50 dark:bg-red-950/10",   label: "Crítico",  dotCor: "bg-red-500",   textCor: "text-red-700 dark:text-red-400" },
                  { lista: altos,     cor: "border-amber-200", fundo: "bg-amber-50/50 dark:bg-amber-950/10", label: "Alto",    dotCor: "bg-amber-500", textCor: "text-amber-700 dark:text-amber-400" },
                  { lista: moderados, cor: "border-blue-200",  fundo: "bg-blue-50/50 dark:bg-blue-950/10",  label: "Moderado", dotCor: "bg-blue-500",  textCor: "text-blue-700 dark:text-blue-400" },
                ].filter((g) => g.lista.length > 0).map((grupo) => (
                  <div key={grupo.label}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${grupo.dotCor}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${grupo.textCor}`}>
                        {grupo.label} · {grupo.lista.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {grupo.lista.map((alerta) => (
                        <div key={alerta.id} className={`border ${grupo.cor} ${grupo.fundo} rounded-lg p-2.5 flex items-start gap-2`}>
                          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            {tipoLabel[alerta.tipo]?.split(" ")[0] || "⚠️"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-semibold text-muted-foreground">
                                {tipoLabel[alerta.tipo]?.split(" ").slice(1).join(" ") || alerta.tipo}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold leading-tight">{alerta.titulo}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{alerta.detalhe}</div>
                          </div>
                          <button
                            onClick={() => resolverAlerta(alerta.id)}
                            disabled={resolvendo === alerta.id}
                            className="text-[9px] px-2 py-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground font-semibold flex-shrink-0 disabled:opacity-50"
                          >
                            {resolvendo === alerta.id ? "..." : "Resolver"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })()}

      {/* Totais do Projeto */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Horas Contratadas — Projeto</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold">{totais.contratadas}</span>
            <span className="text-base text-muted-foreground font-medium">horas</span>
          </div>
          <SegmentBar planejadas={totais.planejadas} efetivadas={totais.efetivadas} saldo={totais.saldo} total={totais.contratadas} height={8} />
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Planejadas", value: totais.planejadas, colorDot: "bg-slate-700" },
              { label: "Efetivadas", value: totais.efetivadas, colorDot: "bg-amber-500" },
              { label: "Saldo", value: totais.saldo, colorDot: "bg-slate-300" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-2 h-2 rounded-sm ${item.colorDot} shrink-0`} />
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
                <div className="text-lg font-bold">{item.value}</div>
                <div className="text-[10px] text-muted-foreground">{pctOf(item.value, totais.contratadas)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição (Pie) */}
      <Card>
        <CardContent className="p-5">
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Distribuição</div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="square" iconSize={8} formatter={(v: string) => <span className="text-[11px] text-muted-foreground">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Atividades do Projeto */}
      <div>
        <div className="mb-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Atividades do Projeto</div>
          <div className="text-xs text-muted-foreground mt-0.5">{atividades.length} atividades · {totais.contratadas}h contratadas</div>
        </div>
        {/* Legenda + Toggle Feeling */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex gap-2.5 flex-wrap items-center">
            {[{ label: "Planejadas", dot: "bg-slate-700" }, { label: "Efetivadas", dot: "bg-amber-500" }, { label: "Saldo", dot: "bg-slate-300" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${l.dot}`} />
                <span className="text-[10px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowFeeling((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${showFeeling ? "bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-950/30 dark:border-violet-700" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            <div className={`w-7 h-4 rounded-full relative transition-colors ${showFeeling ? "bg-violet-500" : "bg-muted-foreground/30"}`}>
              <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${showFeeling ? "left-3.5" : "left-0.5"}`} />
            </div>
            {showFeeling ? "Feeling ativo" : "Exibir Feeling"}
            {totalAlertas > 0 && <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{totalAlertas}</span>}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {atividadesData.map((atv) => {
            const codigo = atv.nome.split(" - ")[0];
            const feeling = feelingPorAtividade.find((f) => f.atividade_codigo === codigo);
            const pctConsumido = atv.planejadas > 0 ? Number(pctOf(atv.efetivadas, atv.planejadas)) : 0;
            const consumidoColor = pctConsumido >= 90 ? "text-red-500" : pctConsumido >= 70 ? "text-amber-500" : "text-emerald-500";
            const consumidoBg = pctConsumido >= 90 ? "bg-red-500" : pctConsumido >= 70 ? "bg-amber-500" : "bg-emerald-500";
            const consumidoBgLight = pctConsumido >= 90 ? "bg-red-50 border-red-100" : pctConsumido >= 70 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100";
            const temAlerta = showFeeling && feeling && feeling.desvio > 20 && feeling.consultores.length > 0;
            return (
              <Card key={atv.id} className={temAlerta ? "border-red-400/60 shadow-red-500/5 shadow-md" : ""}>
                <CardContent className="p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="text-xs font-bold leading-tight mb-0.5">{atv.nome}</div></div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-extrabold leading-none">{atv.contratadas}<span className="text-[10px] font-medium text-muted-foreground"> h</span></div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">contratadas</div>
                    </div>
                  </div>
                  <SegmentBar planejadas={atv.planejadas} efetivadas={atv.efetivadas} saldo={atv.saldo} total={atv.contratadas} />
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ label: "Planejadas", value: atv.planejadas, colorDot: "bg-slate-700" }, { label: "Efetivadas", value: atv.efetivadas, colorDot: "bg-amber-500" }, { label: "Saldo", value: atv.saldo, colorDot: "bg-slate-300" }].map((m) => (
                      <div key={m.label} className="bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-0.5">
                          <div className={`w-1.5 h-1.5 rounded-sm ${m.colorDot} shrink-0`} />
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{m.label}</span>
                        </div>
                        <div className="text-sm font-bold">{m.value}<span className="text-[9px] text-muted-foreground"> h</span></div>
                        <div className="text-[9px] text-muted-foreground">{pctOf(m.value, atv.contratadas)}%</div>
                      </div>
                    ))}
                  </div>
                  <div className={`p-2.5 rounded-lg border ${consumidoBgLight}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Consumo do Planejado</span>
                      <span className={`text-[11px] font-extrabold ${consumidoColor}`}>{pctConsumido}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${consumidoBg}`} style={{ width: `${Math.min(pctConsumido, 100)}%` }} />
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-1">{atv.efetivadas}h efetivadas de {atv.planejadas}h planejadas</div>
                  </div>
                  {/* Feeling consolidado */}
                  {showFeeling && feeling && feeling.consultores.length > 0 && (
                    <div className="border-t border-dashed pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-violet-600">Feeling Consolidado</span>
                        <span className="text-[9px] text-muted-foreground">média ponderada por horas</span>
                      </div>
                      {feeling.consultores.map((c) => (
                        <div key={c.nome} className="bg-muted/40 rounded-lg p-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[9px] font-semibold flex items-center gap-1">
                              <div className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[7px] font-bold">{c.iniciais}</div>
                              {c.nome}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{c.horas}h · peso {c.peso}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-violet-400" style={{ width: `${c.feeling}%` }} />
                            </div>
                            <span className="text-[9px] font-bold text-violet-600">{c.feeling}%</span>
                          </div>
                        </div>
                      ))}
                      <div className={`rounded-lg p-2.5 border space-y-1.5 ${feeling.desvio > 20 ? "bg-red-50 border-red-200 dark:bg-red-950/20" : feeling.desvio > 10 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20" : "bg-violet-50 border-violet-200 dark:bg-violet-950/20"}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-violet-700">Média ponderada</span>
                          <span className={`text-sm font-extrabold ${feeling.desvio > 20 ? "text-red-600" : feeling.desvio > 10 ? "text-amber-600" : "text-violet-700"}`}>{feeling.media_ponderada}%</span>
                        </div>
                        {[{ label: "Previsto", pct: Math.min(100, feeling.previsto), color: "bg-slate-700" }, { label: "Realizado", pct: Math.min(100, Math.round((atv.efetivadas / atv.contratadas) * 100)), color: "bg-amber-500" }, { label: "Feeling", pct: feeling.media_ponderada, color: "bg-violet-500" }].map((bar) => (
                          <div key={bar.label} className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground w-12 shrink-0">{bar.label}</span>
                            <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${Math.min(100, bar.pct)}%` }} />
                            </div>
                            <span className="text-[9px] font-bold w-7 text-right">{bar.pct}%</span>
                          </div>
                        ))}
                        <div className={`flex items-center gap-1.5 mt-1 text-[9px] font-semibold ${feeling.desvio > 20 ? "text-red-600" : feeling.desvio > 10 ? "text-amber-600" : "text-emerald-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${feeling.desvio > 20 ? "bg-red-500" : feeling.desvio > 10 ? "bg-amber-500" : "bg-emerald-500"}`} />
                          {feeling.desvio > 20 ? `Desvio crítico de ${feeling.desvio}pp — equipe sente atraso` : feeling.desvio > 10 ? `Desvio de ${feeling.desvio}pp — acompanhar` : feeling.desvio > 0 ? `Desvio de ${feeling.desvio}pp — feeling alinhado` : `Sem desvio — feeling alinhado com o previsto`}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {atividadesData.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade cadastrada.</p>
          )}
        </div>
      </div>

      {/* Próximas Agendas */}
      <div>
        <div className="mb-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Próximas Agendas</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {filteredAgendas.length} agenda{filteredAgendas.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Period filter */}
        <div className="flex gap-1 mb-4 bg-card p-1 rounded-xl border">
          {periodos.map((p, idx) => (
            <button
              key={p.label}
              onClick={() => setPeriodoIdx(idx)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                periodoIdx === idx
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Header */}
        {filteredAgendas.length > 0 && (
          <div className="grid grid-cols-[52px_1fr_64px] gap-2.5 px-3.5 pb-2 border-b mb-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Data</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Atividade / Recurso</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider text-right">Conclusão</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {filteredAgendas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma agenda no período
              </CardContent>
            </Card>
          ) : (
            filteredAgendas.map((agenda) => {
              const conclusao = getAgendaConclusao(agenda);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const target = new Date(agenda.data + "T00:00:00");
              const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isToday = diff === 0;
              const urgente = diff <= 2;

              return (
                <Card key={agenda.id} className={urgente ? "border-amber-500/35 shadow-amber-500/10" : ""}>
                  <CardContent className="p-3 grid grid-cols-[52px_1fr_64px] gap-2.5 items-center">
                    {/* Date */}
                    <div className={`text-center rounded-lg py-1.5 px-1 ${isToday ? "bg-slate-900 text-white" : "bg-muted"}`}>
                      <div className="text-sm font-extrabold leading-none">
                        {new Date(agenda.data + "T00:00:00").getDate()}
                      </div>
                      <div className={`text-[9px] uppercase tracking-tight mt-0.5 ${isToday ? "text-white/65" : "text-muted-foreground"}`}>
                        {new Date(agenda.data + "T00:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                      </div>
                    </div>

                    {/* Activity + Resource */}
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate mb-1">{agenda.atividade}</div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                          {initials(agenda.usuario)}
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">{agenda.usuario}</span>
                      </div>
                    </div>

                    {/* Completion */}
                    <div className="text-right">
                      <div className={`text-sm font-extrabold mb-1 ${conclusaoColor(conclusao)}`}>{conclusao}%</div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${conclusaoBg(conclusao)}`} style={{ width: `${conclusao}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Legend */}
        {filteredAgendas.length > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: "Concluído", dot: "bg-emerald-500" },
              { label: "Em andamento", dot: "bg-violet-500" },
              { label: "Não iniciado", dot: "bg-slate-300" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-sm ${l.dot}`} />
                <span className="text-[10px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
