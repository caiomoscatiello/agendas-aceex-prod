import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etapa 3 (Config PROJTE) — botao "Verificar Ambiente".
//
// Responde "o ambiente do cliente esta no ar?" em 3 camadas, sem nunca expor
// o management_token do cliente pro chamador (ele fica so dentro desta
// function, revelado via projte_config.vault_reveal_secret):
//
// 1) Projeto Supabase ativo -- GET /v1/projects/{ref} (status) e
//    GET /v1/projects/{ref}/health (db/auth/rest/storage/realtime).
// 2) Schema funcional -- roda um SELECT de diagnostico via
//    POST /v1/projects/{ref}/database/query contando tabelas do template,
//    conferindo RLS numa tabela-chave e os 3 cron jobs que o template cria
//    (check-alertas-diario, health-score-semanal, sla-evaluator-diario).
// 3) Frontend/app do cliente -- FORA do escopo desta function. O botao
//    "Criar Ambiente" so espelha o schema (Supabase), nao publica nenhum
//    frontend. Ver docs/etapa3-config-projte.md secao 3 ("fase futura").
//
// Cada chamada grava um registro em provisionamento_logs (tipo=
// 'verificacao') pra manter historico de quando o ambiente foi checado.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DIAGNOSTICO_SQL = `
select json_build_object(
  'total_tabelas_public', (
    select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  ),
  'tabelas_chave', (
    select json_object_agg(
      t.nome,
      exists (
        select 1 from information_schema.tables it
        where it.table_schema = 'public' and it.table_name = t.nome
      )
    )
    from (values
      ('projetos'), ('agendas'), ('projeto_atividades'),
      ('projeto_alertas'), ('projeto_health_config'), ('projeto_health_historico')
    ) as t(nome)
  ),
  'rls_projetos', (
    select relrowsecurity from pg_class where oid = 'public.projetos'::regclass
  ),
  'cron_jobs', (
    select coalesce(json_agg(json_build_object(
      'jobname', jobname, 'schedule', schedule, 'active', active
    )), '[]'::json)
    from cron.job
    where jobname in ('check-alertas-diario', 'health-score-semanal', 'sla-evaluator-diario')
  )
) as diagnostico;
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);
  const projteSchema = (adminClient as any).schema("projte_config");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const { data: authRow } = await projteSchema
      .from("usuarios_autorizados")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!authRow) {
      return jsonResponse({ error: "Acesso negado ao Config PROJTE" }, 403);
    }

    const body = await req.json();
    const ambienteId = body.ambiente_id;
    if (!ambienteId) {
      return jsonResponse({ error: "ambiente_id é obrigatório" }, 400);
    }

    const { data: ambiente, error: ambienteErr } = await projteSchema
      .from("ambientes")
      .select("id, tipo, supabase_project_ref, supabase_project_url, status")
      .eq("id", ambienteId)
      .maybeSingle();
    if (ambienteErr) throw ambienteErr;
    if (!ambiente) {
      return jsonResponse({ error: "Ambiente não encontrado" }, 404);
    }
    if (!ambiente.supabase_project_ref) {
      return jsonResponse({ error: "Ambiente sem supabase_project_ref preenchido." }, 400);
    }

    const { data: tokenRef } = await projteSchema
      .from("ambiente_secrets")
      .select("vault_secret_id")
      .eq("ambiente_id", ambienteId)
      .eq("tipo", "management_token")
      .maybeSingle();
    if (!tokenRef) {
      return jsonResponse(
        { error: "Registre o management_token desse ambiente na seção Segredos antes de verificar." },
        400
      );
    }

    const { data: managementToken, error: revealErr } = await projteSchema.rpc("vault_reveal_secret", {
      secret_id: tokenRef.vault_secret_id,
    });
    if (revealErr) throw revealErr;
    if (!managementToken) {
      return jsonResponse({ error: "Não foi possível recuperar o management_token do Vault." }, 500);
    }

    const targetRef = ambiente.supabase_project_ref.trim();
    const mgmtHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${managementToken}`,
    };

    // 1a) Status do projeto (pausado/ativo).
    let projectStatus: string | null = null;
    let projectStatusErro: string | null = null;
    try {
      const res = await fetch(`${MANAGEMENT_API_BASE}/projects/${targetRef}`, { headers: mgmtHeaders });
      const text = await res.text();
      if (res.ok) {
        const json = JSON.parse(text);
        projectStatus = json.status ?? null;
      } else {
        projectStatusErro = `HTTP ${res.status} — ${text.slice(0, 300)}`;
      }
    } catch (e) {
      projectStatusErro = (e as Error).message;
    }

    // 1b) Saude por servico (db, auth, rest, storage, realtime).
    let servicos: Record<string, unknown> | null = null;
    let servicosErro: string | null = null;
    try {
      const services = "db,auth,rest,storage,realtime";
      const res = await fetch(
        `${MANAGEMENT_API_BASE}/projects/${targetRef}/health?services=${services}`,
        { headers: mgmtHeaders }
      );
      const text = await res.text();
      if (res.ok) {
        servicos = JSON.parse(text);
      } else {
        servicosErro = `HTTP ${res.status} — ${text.slice(0, 300)}`;
      }
    } catch (e) {
      servicosErro = (e as Error).message;
    }

    // 2) Diagnostico de schema (tabelas-chave, RLS, cron jobs).
    let diagnostico: Record<string, unknown> | null = null;
    let diagnosticoErro: string | null = null;
    try {
      const res = await fetch(`${MANAGEMENT_API_BASE}/projects/${targetRef}/database/query`, {
        method: "POST",
        headers: mgmtHeaders,
        body: JSON.stringify({ query: DIAGNOSTICO_SQL }),
      });
      const text = await res.text();
      if (res.ok) {
        const rows = JSON.parse(text);
        diagnostico = rows?.[0]?.diagnostico ?? null;
      } else {
        diagnosticoErro = `HTTP ${res.status} — ${text.slice(0, 500)}`;
      }
    } catch (e) {
      diagnosticoErro = (e as Error).message;
    }

    const relatorio = {
      ambiente_id: ambienteId,
      tipo_ambiente: ambiente.tipo,
      project_ref: targetRef,
      projeto: { status: projectStatus, erro: projectStatusErro },
      servicos: { dados: servicos, erro: servicosErro },
      schema: { diagnostico, erro: diagnosticoErro },
      frontend_app: {
        verificado: false,
        nota: "Fora do escopo do botao Criar Ambiente v1 -- so espelha o schema (Supabase), nao publica frontend.",
      },
    };

    const tudoOk = !projectStatusErro && !servicosErro && !diagnosticoErro;

    // Bug real encontrado em 2026-08-24: esse insert vinha falhando sempre
    // (CHECK antigo de provisionamento_logs.tipo só aceitava
    // 'provisionamento'/'atualizacao'), em silêncio, porque o erro do
    // .insert() nunca era checado -- os chips do sequenciador na tela
    // nunca tinham histórico persistido. Corrigido via migration
    // 20260824150000 (CHECK agora aceita 'verificacao'); o check abaixo
    // fica pra não deixar um problema parecido passar batido de novo.
    const { error: logErr } = await projteSchema.from("provisionamento_logs").insert({
      ambiente_id: ambienteId,
      tipo: "verificacao",
      etapa: "verificar_ambiente",
      status: tudoOk ? "ok" : "erro",
      mensagem: JSON.stringify(relatorio).slice(0, 4000),
    });
    if (logErr) console.error("[projte-check-ambiente] falha ao gravar provisionamento_logs:", logErr);

    return jsonResponse({ success: tudoOk, relatorio });
  } catch (err) {
    console.error("[projte-check-ambiente] error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
