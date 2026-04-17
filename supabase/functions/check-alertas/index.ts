// supabase/functions/check-alertas/index.ts
// BL-011 — Alertas Proativos + E-mail diário via SMTP

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIAS_UTEIS_SEMANA = [1, 2, 3, 4, 5];

function diasUteis(dataInicio: Date, dataFim: Date): number {
  let count = 0;
  const cur = new Date(dataInicio);
  while (cur < dataFim) {
    if (DIAS_UTEIS_SEMANA.includes(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── CONFIG ───────────────────────────────────────────────

async function getConfig(projetoId: string) {
  const { data } = await supabase
    .from("projeto_alertas_config")
    .select("*")
    .eq("projeto_id", projetoId)
    .maybeSingle();

  return {
    alerta_feeling_ativo: true,
    alerta_feeling_threshold: 20,
    alerta_apontamento_ativo: true,
    alerta_apontamento_dias: 2,
    alerta_consumo_ativo: true,
    alerta_consumo_threshold: 90,
    alerta_parada_ativo: true,
    alerta_parada_dias: 7,
    ...data,
  };
}

// ── UPSERT / RESOLVE ─────────────────────────────────────

async function upsertAlerta(payload: {
  projeto_id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  detalhe: string;
  referencia_id?: string;
  referencia_tipo?: string;
}) {
  let query = supabase
    .from("projeto_alertas")
    .select("id")
    .eq("projeto_id", payload.projeto_id)
    .eq("tipo", payload.tipo)
    .eq("status", "ativo");

  if (payload.referencia_id) {
    query = query.eq("referencia_id", payload.referencia_id);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    await supabase
      .from("projeto_alertas")
      .update({
        severidade: payload.severidade,
        titulo: payload.titulo,
        detalhe: payload.detalhe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("projeto_alertas").insert({
      ...payload,
      status: "ativo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

async function autoResolver(projetoId: string, tipo: string, referenciaId?: string) {
  let query = supabase
    .from("projeto_alertas")
    .update({ status: "resolvido_auto", updated_at: new Date().toISOString() })
    .eq("projeto_id", projetoId)
    .eq("tipo", tipo)
    .eq("status", "ativo");

  if (referenciaId) query = query.eq("referencia_id", referenciaId);
  await query;
}

// ── VARREDURAS ───────────────────────────────────────────

async function verificarFeeling(projeto: any, config: any) {
  if (!config.alerta_feeling_ativo) return;

  const { data: atividades } = await supabase
    .from("projeto_atividades")
    .select("id, codigo, descricao, horas")
    .eq("projeto_id", projeto.id);

  if (!atividades?.length) return;

  for (const atv of atividades) {
    const { data: aponts } = await supabase
      .from("apontamento_atividades")
      .select("user_id, horas, percentual_feeling")
      .eq("cliente", projeto.nome_cliente)
      .eq("atividade_codigo", atv.codigo)
      .not("percentual_feeling", "is", null);

    if (!aponts?.length) {
      await autoResolver(projeto.id, "feeling", atv.id);
      continue;
    }

    const totalHoras = aponts.reduce((s: number, a: any) => s + Number(a.horas), 0);
    const mediaPonderada = totalHoras > 0
      ? Math.round(aponts.reduce((s: number, a: any) => s + a.percentual_feeling * Number(a.horas), 0) / totalHoras)
      : 0;

    const { data: agendasAtv } = await supabase
      .from("agendas")
      .select("id")
      .eq("cliente", projeto.nome_cliente)
      .in("status", ["confirmada", "apontamento_ok", "apontamento_ajustado", "em_aprovacao", "doc_pendente"]);

    const planejadas = (agendasAtv?.length || 0) * 8;
    const previsto = atv.horas > 0 ? Math.round((planejadas / atv.horas) * 100) : 0;
    const desvio = Math.abs(previsto - mediaPonderada);

    if (desvio > config.alerta_feeling_threshold) {
      await upsertAlerta({
        projeto_id: projeto.id,
        tipo: "feeling",
        severidade: desvio > 30 ? "critico" : "alto",
        titulo: `Desvio de feeling — ${atv.codigo} ${atv.descricao}`,
        detalhe: `Feeling: ${mediaPonderada}% · Previsto: ${previsto}% · Desvio: ${desvio}pp`,
        referencia_id: atv.id,
        referencia_tipo: "atividade",
      });
    } else {
      await autoResolver(projeto.id, "feeling", atv.id);
    }
  }
}

async function verificarApontamento(projeto: any, config: any) {
  if (!config.alerta_apontamento_ativo) return;

  const limiteData = new Date();
  limiteData.setDate(limiteData.getDate() - config.alerta_apontamento_dias);
  const limiteStr = limiteData.toISOString().split("T")[0];

  const { data: agendas } = await supabase
    .from("agendas")
    .select("id, data, usuario, atividade")
    .eq("cliente", projeto.nome_cliente)
    .eq("status", "confirmada")
    .lt("data", limiteStr);

  if (!agendas?.length) {
    await autoResolver(projeto.id, "apontamento");
    return;
  }

  for (const agenda of agendas) {
    const { data: apontamento } = await supabase
      .from("apontamento_atividades")
      .select("id")
      .eq("agenda_id", agenda.id)
      .maybeSingle();

    if (!apontamento) {
      const diasAtraso = Math.floor(
        (new Date().getTime() - new Date(agenda.data + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)
      );
      await upsertAlerta({
        projeto_id: projeto.id,
        tipo: "apontamento",
        severidade: diasAtraso > 5 ? "critico" : "alto",
        titulo: `Agenda sem apontamento — ${agenda.atividade}`,
        detalhe: `${agenda.usuario} · agenda ${agenda.data} · ${diasAtraso} dias sem apontamento`,
        referencia_id: agenda.id,
        referencia_tipo: "agenda",
      });
    } else {
      await autoResolver(projeto.id, "apontamento", agenda.id);
    }
  }
}

async function verificarConsumo(projeto: any, config: any) {
  if (!config.alerta_consumo_ativo) return;

  const { data: atividades } = await supabase
    .from("projeto_atividades")
    .select("id, codigo, descricao, horas")
    .eq("projeto_id", projeto.id);

  if (!atividades?.length) return;

  for (const atv of atividades) {
    const { data: agendasAtv } = await supabase
      .from("agendas")
      .select("id")
      .eq("cliente", projeto.nome_cliente)
      .in("status", ["confirmada", "apontamento_ok", "apontamento_ajustado", "em_aprovacao", "doc_pendente"]);

    const planejadas = (agendasAtv?.length || 0) * 8;

    if (planejadas === 0 || atv.horas === 0) {
      await autoResolver(projeto.id, "consumo", atv.id);
      continue;
    }

    const pctConsumido = Math.round((planejadas / atv.horas) * 100);

    if (pctConsumido >= config.alerta_consumo_threshold) {
      await upsertAlerta({
        projeto_id: projeto.id,
        tipo: "consumo",
        severidade: pctConsumido >= 100 ? "critico" : "alto",
        titulo: `Consumo crítico de horas — ${atv.codigo} ${atv.descricao}`,
        detalhe: `${pctConsumido}% do planejado consumido · ${atv.horas - planejadas}h restantes de ${atv.horas}h`,
        referencia_id: atv.id,
        referencia_tipo: "atividade",
      });
    } else {
      await autoResolver(projeto.id, "consumo", atv.id);
    }
  }
}

async function verificarParada(projeto: any, config: any) {
  if (!config.alerta_parada_ativo) return;

  const { data: atividades } = await supabase
    .from("projeto_atividades")
    .select("id, codigo, descricao")
    .eq("projeto_id", projeto.id);

  if (!atividades?.length) return;

  for (const atv of atividades) {
    const { data: ultimaAgenda } = await supabase
      .from("agendas")
      .select("id, data")
      .eq("cliente", projeto.nome_cliente)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ultimaAgenda) {
      await autoResolver(projeto.id, "parada", atv.id);
      continue;
    }

    const diasParados = diasUteis(
      new Date(ultimaAgenda.data + "T00:00:00"),
      new Date()
    );

    if (diasParados >= config.alerta_parada_dias) {
      await upsertAlerta({
        projeto_id: projeto.id,
        tipo: "parada",
        severidade: "moderado",
        titulo: `Atividade parada — ${atv.codigo} ${atv.descricao}`,
        detalhe: `${diasParados} dias úteis sem nova agenda · última em ${ultimaAgenda.data}`,
        referencia_id: atv.id,
        referencia_tipo: "atividade",
      });
    } else {
      await autoResolver(projeto.id, "parada", atv.id);
    }
  }
}

// ── E-MAIL DIÁRIO ────────────────────────────────────────

async function enviarEmailAlertas(coordenadorId: string, projetos: any[]) {
  // Buscar config SMTP
  const { data: smtp } = await supabase
    .from("email_settings")
    .select("smtp_host, smtp_port, smtp_user, smtp_password, smtp_security, sender_email, sender_name")
    .limit(1)
    .maybeSingle();

  if (!smtp?.smtp_host) {
    console.warn("SMTP não configurado — e-mail de alertas não enviado");
    return;
  }

  // Buscar perfil do coordenador
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("user_id", coordenadorId)
    .maybeSingle();

  if (!profile?.email) {
    console.warn(`E-mail não encontrado para coordenador ${coordenadorId}`);
    return;
  }

  // Buscar alertas ativos
  const projetoIds = projetos.map((p: any) => p.id);
  const { data: alertas } = await supabase
    .from("projeto_alertas")
    .select("tipo, severidade, titulo, detalhe, projeto_id")
    .in("projeto_id", projetoIds)
    .eq("status", "ativo")
    .order("severidade");

  if (!alertas?.length) return;

  const criticos  = alertas.filter((a: any) => a.severidade === "critico");
  const altos     = alertas.filter((a: any) => a.severidade === "alto");
  const moderados = alertas.filter((a: any) => a.severidade === "moderado");

  const projetoNome = (id: string) =>
    projetos.find((p: any) => p.id === id)?.nome_cliente || id;

  const tipoLabel: Record<string, string> = {
    feeling: "📉 Feeling",
    apontamento: "📋 Apontamento",
    consumo: "⏱ Consumo",
    parada: "⏸ Parada",
  };

  const renderLinhas = (lista: any[]) =>
    lista.map((a: any) => `
      <tr style="border-bottom:1px solid #f0f0ee;">
        <td style="padding:7px 10px;font-size:12px;color:#666;">${projetoNome(a.projeto_id)}</td>
        <td style="padding:7px 10px;font-size:12px;color:#555;">${tipoLabel[a.tipo] || a.tipo}</td>
        <td style="padding:7px 10px;font-size:12px;color:#1a1a1a;font-weight:600;">${a.titulo}</td>
        <td style="padding:7px 10px;font-size:11px;color:#888;">${a.detalhe}</td>
      </tr>`).join("");

  const secao = (cor: string, fundo: string, borda: string, label: string, lista: any[]) =>
    lista.length === 0 ? "" : `
      <div style="margin:16px 24px 0;">
        <div style="font-size:11px;font-weight:700;color:${cor};text-transform:uppercase;
                    letter-spacing:0.06em;margin-bottom:8px;">${label} (${lista.length})</div>
        <table width="100%" style="border-collapse:collapse;background:${fundo};
               border:1px solid ${borda};border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:rgba(0,0,0,0.03);">
              <th style="padding:6px 10px;font-size:10px;color:#999;text-align:left;">Projeto</th>
              <th style="padding:6px 10px;font-size:10px;color:#999;text-align:left;">Tipo</th>
              <th style="padding:6px 10px;font-size:10px;color:#999;text-align:left;">Alerta</th>
              <th style="padding:6px 10px;font-size:10px;color:#999;text-align:left;">Detalhe</th>
            </tr>
          </thead>
          <tbody>${renderLinhas(lista)}</tbody>
        </table>
      </div>`;

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f2f2f0;margin:0;padding:20px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e0de;">
    <div style="background:#0f1117;padding:20px 24px;">
      <div style="font-size:18px;font-weight:800;color:#fff;">ACEEX</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">Resumo de Alertas · ${hoje}</div>
    </div>
    <div style="padding:20px 24px 0;">
      <p style="font-size:14px;color:#555;">Olá, <strong>${profile.name}</strong></p>
      <p style="font-size:13px;color:#888;margin-top:4px;">
        ${alertas.length} alerta${alertas.length !== 1 ? "s" : ""} ativo${alertas.length !== 1 ? "s" : ""}
        em ${projetos.length} projeto${projetos.length !== 1 ? "s" : ""}.
      </p>
    </div>
    ${secao("#A32D2D", "#fff5f5", "#F7C1C1", "🔴 Críticos", criticos)}
    ${secao("#854F0B", "#fffbf4", "#FAD8A0", "🟠 Altos", altos)}
    ${secao("#185FA5", "#f8fbff", "#b5d4f4", "🔵 Moderados", moderados)}
    <div style="padding:24px;text-align:center;">
      <a href="https://preview--agendas-aceex.lovable.app/admin"
         style="background:#1a1a1a;color:#fff;text-decoration:none;font-size:12px;
                font-weight:700;padding:10px 24px;border-radius:8px;display:inline-block;">
        Abrir Dashboard
      </a>
    </div>
    <div style="border-top:1px solid #f0f0ee;padding:14px 24px;text-align:center;">
      <p style="font-size:10px;color:#bbb;">ACEEX · Resumo automático diário · ${hoje}</p>
    </div>
  </div>
</body>
</html>`;

  // Invocar a Edge Function de e-mail já existente no projeto
  await supabase.functions.invoke("send-os-email", {
    body: {
      to: profile.email,
      subject: `⚠️ ACEEX — ${alertas.length} alerta${alertas.length !== 1 ? "s" : ""} em ${projetos.length} projeto${projetos.length !== 1 ? "s" : ""} · ${hoje}`,
      html,
    },
  });

  console.log(`E-mail enviado para ${profile.email} — ${alertas.length} alertas`);
}

// ── HANDLER PRINCIPAL ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { data: projetos, error } = await supabase
      .from("projetos")
      .select("id, nome_cliente, coordenador_id, status")
      .eq("status", "Liberado")
      .not("coordenador_id", "is", null);

    if (error) throw error;

    if (!projetos?.length) {
      return new Response(JSON.stringify({ ok: true, projetos: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados: any[] = [];

    for (const projeto of projetos) {
      const config = await getConfig(projeto.id);

      await Promise.all([
        verificarFeeling(projeto, config),
        verificarApontamento(projeto, config),
        verificarConsumo(projeto, config),
        verificarParada(projeto, config),
      ]);

      const { count } = await supabase
        .from("projeto_alertas")
        .select("*", { count: "exact", head: true })
        .eq("projeto_id", projeto.id)
        .eq("status", "ativo");

      resultados.push({ projeto: projeto.nome_cliente, alertas_ativos: count });
    }

    // Agrupar por coordenador e enviar e-mail
    const porCoordenador: Record<string, any[]> = {};
    for (const projeto of projetos) {
      if (!porCoordenador[projeto.coordenador_id]) {
        porCoordenador[projeto.coordenador_id] = [];
      }
      porCoordenador[projeto.coordenador_id].push(projeto);
    }

    for (const [coordenadorId, projetosDoCoordenador] of Object.entries(porCoordenador)) {
      await enviarEmailAlertas(coordenadorId, projetosDoCoordenador);
    }

    return new Response(
      JSON.stringify({ ok: true, projetos: projetos.length, resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-alertas error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});