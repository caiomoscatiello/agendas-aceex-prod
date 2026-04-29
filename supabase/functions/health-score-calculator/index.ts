// supabase/functions/health-score-calculator/index.ts
// BL-007 — Health Score Analytics

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ?? HELPERS ???????????????????????????????????????????????????????????????????

function idpParaPontos(idp: number, config: any): number {
  if (idp >= config.idp_verde) return 100;
  if (idp >= config.idp_amarelo) return 80 - Math.round((config.idp_verde - idp) / (config.idp_verde - config.idp_amarelo) * 20);
  if (idp >= 0.70) return 40;
  return 10;
}

function idcParaPontos(idc: number, config: any): number {
  if (idc >= config.idc_verde) return 100;
  if (idc >= config.idc_amarelo) return 80 - Math.round((config.idc_verde - idc) / (config.idc_verde - config.idc_amarelo) * 20);
  if (idc >= 0.70) return 40;
  return 10;
}

function feelingParaPontos(feeling: number, config: any): number {
  if (feeling >= config.feeling_verde) return 100;
  if (feeling >= config.feeling_amarelo) return 70;
  if (feeling >= 30) return 40;
  return 10;
}

function alertasParaPontos(criticos: number, altos: number, moderados: number, config: any): number {
  const penalidade =
    criticos  * config.penalidade_critico +
    altos     * config.penalidade_alto +
    moderados * config.penalidade_moderado;
  return Math.max(0, 100 - penalidade);
}

function calcularSemaforo(score: number, config: any): string {
  if (score >= config.score_verde) return "verde";
  if (score >= config.score_amarelo) return "amarelo";
  return "vermelho";
}

// ?? CÁLCULO IDP/IDC (fiel ao AdminStatusReport.tsx) ??????????????????????????

function calcularIdp(atividades: any[], apontamentos: any[]): number {
  const hoje = new Date();
  let valorPlanejado = 0;
  let valorAgregado = 0;

  for (const a of atividades) {
    if (!a.data_inicio || !a.data_fim) continue;
    const inicio = new Date(a.data_inicio);
    const fim = new Date(a.data_fim);
    const durTotal = fim.getTime() - inicio.getTime();
    if (durTotal <= 0) continue;

    const agora = Math.min(hoje.getTime(), fim.getTime());
    const decorrido = Math.max(0, agora - inicio.getTime());
    const fracPlano = Math.min(decorrido / durTotal, 1);
    valorPlanejado += a.horas * fracPlano;

    const horasReais = apontamentos
      .filter((ap: any) => ap.atividade_codigo === a.codigo)
      .reduce((s: number, ap: any) => s + Number(ap.horas), 0);
    const fracReal = a.horas > 0 ? Math.min(horasReais / a.horas, 1) : 0;
    valorAgregado += a.horas * fracReal;
  }

  if (valorPlanejado === 0) return 1;
  return Math.round((valorAgregado / valorPlanejado) * 100) / 100;
}

function calcularIdc(atividades: any[], apontamentos: any[]): number {
  let valorAgregado = 0;
  const horasTotaisRealizadas = apontamentos
    .reduce((s: number, ap: any) => s + Number(ap.horas), 0);

  for (const a of atividades) {
    const horasReais = apontamentos
      .filter((ap: any) => ap.atividade_codigo === a.codigo)
      .reduce((s: number, ap: any) => s + Number(ap.horas), 0);
    const fracReal = a.horas > 0 ? Math.min(horasReais / a.horas, 1) : 0;
    valorAgregado += a.horas * fracReal;
  }

  if (horasTotaisRealizadas === 0) return 1;
  return Math.round((valorAgregado / horasTotaisRealizadas) * 100) / 100;
}

// ?? CÁLCULO PRINCIPAL ?????????????????????????????????????????????????????????

async function calcularHealthScore(supabase: any, projeto: any): Promise<any> {
  const defaultConfig = {
    peso_prazo: 25, peso_custo: 25, peso_feeling: 25, peso_alertas: 25,
    idp_verde: 1.00, idp_amarelo: 0.80,
    idc_verde: 1.00, idc_amarelo: 0.80,
    feeling_verde: 70, feeling_amarelo: 50,
    penalidade_critico: 20, penalidade_alto: 10, penalidade_moderado: 5,
    score_verde: 75, score_amarelo: 50,
  };

  const { data: configRaw } = await supabase
    .from("projeto_health_config")
    .select("*")
    .eq("projeto_id", projeto.id)
    .maybeSingle();

  const config = { ...defaultConfig, ...configRaw };

  const { data: atividades } = await supabase
    .from("projeto_atividades")
    .select("id, codigo, descricao, horas, data_inicio, data_fim")
    .eq("projeto_id", projeto.id);

  if (!atividades?.length) return null;

  const { data: agendasAprovadas } = await supabase
    .from("agendas")
    .select("id")
    .eq("cliente", projeto.nome_cliente)
    .in("status", ["apontamento_ok", "apontamento_ajustado"]);

  const agendaIds = (agendasAprovadas || []).map((a: any) => a.id);

  let apontamentos: any[] = [];
  if (agendaIds.length > 0) {
    const { data: ap } = await supabase
      .from("apontamento_atividades")
      .select("atividade_codigo, horas, percentual_feeling, agenda_id")
      .in("agenda_id", agendaIds);
    apontamentos = ap || [];
  }

  const idp = calcularIdp(atividades, apontamentos);
  const idc = calcularIdc(atividades, apontamentos);

  const apontsComFeeling = apontamentos.filter((a: any) => a.percentual_feeling !== null && a.percentual_feeling !== undefined);
  let feelingMedio: number | null = null;
  let temFeeling = false;

  if (apontsComFeeling.length > 0) {
    const totalHoras = apontsComFeeling.reduce((s: number, a: any) => s + Number(a.horas), 0);
    if (totalHoras > 0) {
      feelingMedio = Math.round(
        apontsComFeeling.reduce((s: number, a: any) => s + a.percentual_feeling * Number(a.horas), 0) / totalHoras
      );
      temFeeling = true;
    }
  }

  const { data: alertasAtivos } = await supabase
    .from("projeto_alertas")
    .select("severidade")
    .eq("projeto_id", projeto.id)
    .eq("status", "ativo");

  const criticos  = (alertasAtivos || []).filter((a: any) => a.severidade === "critico").length;
  const altos     = (alertasAtivos || []).filter((a: any) => a.severidade === "alto").length;
  const moderados = (alertasAtivos || []).filter((a: any) => a.severidade === "moderado").length;

  const scorePrazo   = idpParaPontos(idp, config);
  const scoreCusto   = idcParaPontos(idc, config);
  const scoreFeeling = temFeeling ? feelingParaPontos(feelingMedio!, config) : 0;
  const scoreAlertas = alertasParaPontos(criticos, altos, moderados, config);

  let pesoPrazo   = config.peso_prazo;
  let pesoCusto   = config.peso_custo;
  let pesoFeeling = config.peso_feeling;
  let pesoAlertas = config.peso_alertas;

  if (!temFeeling && pesoFeeling > 0) {
    const totalSemFeeling = pesoPrazo + pesoCusto + pesoAlertas;
    if (totalSemFeeling > 0) {
      pesoPrazo   = Math.round(pesoPrazo   / totalSemFeeling * 100);
      pesoCusto   = Math.round(pesoCusto   / totalSemFeeling * 100);
      pesoAlertas = 100 - pesoPrazo - pesoCusto;
    }
    pesoFeeling = 0;
  }

  const scoreTotal = Math.round(
    (scorePrazo   * pesoPrazo   / 100) +
    (scoreCusto   * pesoCusto   / 100) +
    (scoreFeeling * pesoFeeling / 100) +
    (scoreAlertas * pesoAlertas / 100)
  );

  return {
    projeto_id:        projeto.id,
    data_calculo:      new Date().toISOString().split("T")[0],
    score_total:       scoreTotal,
    score_prazo:       scorePrazo,
    score_custo:       scoreCusto,
    score_feeling:     scoreFeeling,
    score_alertas:     scoreAlertas,
    idp_valor:         idp,
    idc_valor:         idc,
    feeling_medio:     feelingMedio,
    alertas_criticos:  criticos,
    alertas_altos:     altos,
    alertas_moderados: moderados,
    semaforo:          calcularSemaforo(scoreTotal, config),
    pesos_snapshot: {
      prazo: pesoPrazo, custo: pesoCusto,
      feeling: pesoFeeling, alertas: pesoAlertas,
      feeling_disponivel: temFeeling,
    },
  };
}

// ?? HANDLER PRINCIPAL ?????????????????????????????????????????????????????????

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const projetoIdFiltro = body?.projeto_id || null;

    let query = supabase
      .from("projetos")
      .select("id, nome_cliente, coordenador_id, status")
      .eq("status", "Liberado")
      .not("coordenador_id", "is", null);

    if (projetoIdFiltro) {
      query = query.eq("id", projetoIdFiltro);
    }

    const { data: projetos, error } = await query;
    if (error) throw error;

    if (!projetos?.length) {
      return new Response(
        JSON.stringify({ ok: true, projetos: 0, resultados: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: any[] = [];

    for (const projeto of projetos) {
      const snapshot = await calcularHealthScore(supabase, projeto);
      if (!snapshot) {
        resultados.push({ projeto: projeto.nome_cliente, score: null, motivo: "sem_atividades" });
        continue;
      }

      await supabase
        .from("projeto_health_historico")
        .upsert(snapshot, { onConflict: "projeto_id,data_calculo" });

      resultados.push({
        projeto:  projeto.nome_cliente,
        score:    snapshot.score_total,
        semaforo: snapshot.semaforo,
        idp:      snapshot.idp_valor,
        idc:      snapshot.idc_valor,
        feeling:  snapshot.feeling_medio,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, projetos: projetos.length, resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("health-score-calculator error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});