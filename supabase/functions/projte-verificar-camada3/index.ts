import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etapa 3 (Config PROJTE) — dispara a verificação de camada 3 ("login real
// via Playwright") de um ambiente, rodando num workflow do GitHub Actions
// (.github/workflows/verificar-ambiente-cliente.yml) -- uma Edge Function
// (Deno) não consegue abrir um navegador de verdade, então essa etapa
// precisa acontecer fora do Supabase.
//
// Pré-requisitos pra essa function funcionar (nenhum dos dois é
// configurado por ela):
//   1. Segredos da PRÓPRIA function no Supabase (Project Settings > Edge
//      Functions > projte-verificar-camada3 > Secrets), não em
//      projte_config.ambiente_secrets (aqueles são por-ambiente-de-cliente;
//      este é um segredo do control-plane, usado pra TODOS os ambientes):
//        GITHUB_PAT  -- fine-grained personal access token, permissão
//                       "Actions: write" no repositório do painel PROJTE.
//        GITHUB_REF  -- opcional, branch a disparar (default "master").
//   2. O ambiente precisa ter frontend_url preenchido (tela Ambientes) e já
//      ter passado por "Criar Ambiente" pelo menos uma vez (é isso que cria
//      o usuário sintético de monitoramento em ambiente_secrets, tipo
//      monitor_credentials).
//
// Segurança: as credenciais do usuário de monitoramento são reveladas aqui
// dentro (nunca voltam pro navegador de quem clicou) e mandadas como inputs
// do workflow_dispatch -- ver aviso de trade-off no próprio arquivo do
// workflow.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_OWNER = "caiomoscatiello";
const GITHUB_REPO = "agendas-aceex-prod";
const WORKFLOW_FILE = "verificar-ambiente-cliente.yml";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Bug real encontrado em 2026-08-24: os inserts em provisionamento_logs
// desta function vinham falhando sempre (CHECK antigo de
// provisionamento_logs.tipo só aceitava 'provisionamento'/'atualizacao'),
// em silêncio, porque nenhum call site checava o erro do .insert() -- o
// chip 6 do sequenciador nunca tinha histórico persistido. Corrigido via
// migration 20260824150000 (CHECK agora aceita 'verificacao'); esse helper
// centraliza o log e o check de erro pra não deixar isso passar batido de
// novo.
async function logProvisionamento(
  projteSchema: any,
  row: { ambiente_id: string; tipo: string; etapa: string; status: "ok" | "erro"; mensagem: string }
) {
  const { error } = await projteSchema.from("provisionamento_logs").insert(row);
  if (error) console.error("[projte-verificar-camada3] falha ao gravar provisionamento_logs:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);
  const projteSchema = (adminClient as any).schema("projte_config");

  let ambienteId: string | undefined;

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
    ambienteId = body.ambiente_id;
    if (!ambienteId) {
      return jsonResponse({ error: "ambiente_id é obrigatório" }, 400);
    }

    const githubPat = Deno.env.get("GITHUB_PAT");
    if (!githubPat) {
      // Log direto aqui (não só no catch): esse é um erro de configuração,
      // não uma exceção -- sem isso, um 500 por PAT ausente não deixava
      // NENHUM rastro em provisionamento_logs, dificultando diagnosticar à
      // distância (bug real encontrado em 2026-08-18, testando o QA
      // republicado no Vercel).
      const mensagem =
        "GITHUB_PAT não configurado nos secrets desta Edge Function (Project Settings > Edge Functions > projte-verificar-camada3 > Secrets).";
      await logProvisionamento(projteSchema, {
        ambiente_id: ambienteId,
        tipo: "verificacao",
        etapa: "camada3_disparo",
        status: "erro",
        mensagem,
      });
      return jsonResponse({ error: mensagem }, 500);
    }
    const githubRef = Deno.env.get("GITHUB_REF") || "master";

    const { data: ambiente, error: ambienteErr } = await projteSchema
      .from("ambientes")
      .select("id, tipo, frontend_url")
      .eq("id", ambienteId)
      .maybeSingle();
    if (ambienteErr) throw ambienteErr;
    if (!ambiente) {
      return jsonResponse({ error: "Ambiente não encontrado" }, 404);
    }
    if (!ambiente.frontend_url?.trim()) {
      return jsonResponse(
        {
          error:
            "Preencha o Frontend URL do ambiente antes de rodar a verificação de camada 3 (sem isso não há o que o Playwright abrir).",
        },
        400
      );
    }

    const { data: credRef } = await projteSchema
      .from("ambiente_secrets")
      .select("vault_secret_id")
      .eq("ambiente_id", ambienteId)
      .eq("tipo", "monitor_credentials")
      .maybeSingle();
    if (!credRef) {
      return jsonResponse(
        {
          error:
            "Nenhum usuário de monitoramento encontrado pra esse ambiente. Rode 'Criar Ambiente' pelo menos uma vez antes (ele cria esse usuário automaticamente).",
        },
        400
      );
    }

    const { data: credJson, error: revealErr } = await projteSchema.rpc("vault_reveal_secret", {
      secret_id: credRef.vault_secret_id,
    });
    if (revealErr) throw revealErr;
    if (!credJson) {
      return jsonResponse({ error: "Não foi possível recuperar as credenciais de monitoramento do Vault." }, 500);
    }
    const { email: monitorEmail, password: monitorPassword } = JSON.parse(credJson as string);

    const label = ambiente.tipo === "qa" ? "QA" : "Produção";

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${githubPat}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: githubRef,
          inputs: {
            ambiente_label: label,
            base_url: ambiente.frontend_url.trim(),
            monitor_email: monitorEmail,
            monitor_password: monitorPassword,
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      await logProvisionamento(projteSchema, {
        ambiente_id: ambienteId,
        tipo: "verificacao",
        etapa: "camada3_disparo",
        status: "erro",
        mensagem: `HTTP ${dispatchRes.status} ao disparar workflow: ${text.slice(0, 500)}`,
      });
      return jsonResponse({ error: `Falha ao disparar o workflow no GitHub: HTTP ${dispatchRes.status} — ${text.slice(0, 300)}` }, 500);
    }

    // workflow_dispatch nao devolve o run id direto -- espera um instante e
    // busca a run mais recente pra dar um link clicavel. Best-effort: se nao
    // achar (ou se outra run tiver disparado nesse meio-tempo), ainda assim
    // o disparo em si funcionou.
    let runUrl: string | null = null;
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const runsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=1`,
        {
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${githubPat}`,
          },
        }
      );
      if (runsRes.ok) {
        const runsJson = await runsRes.json();
        runUrl = runsJson?.workflow_runs?.[0]?.html_url ?? null;
      }
    } catch (_e) {
      // best-effort, nao falha o disparo por causa disso
    }

    await logProvisionamento(projteSchema, {
      ambiente_id: ambienteId,
      tipo: "verificacao",
      etapa: "camada3_disparo",
      status: "ok",
      mensagem: runUrl
        ? `Verificação de camada 3 disparada. Acompanhe em: ${runUrl}`
        : "Verificação de camada 3 disparada no GitHub Actions.",
    });

    return jsonResponse({ success: true, run_url: runUrl });
  } catch (err) {
    console.error("[projte-verificar-camada3] error:", err);
    if (ambienteId) {
      try {
        await logProvisionamento(projteSchema, {
          ambiente_id: ambienteId,
          tipo: "verificacao",
          etapa: "camada3_disparo",
          status: "erro",
          mensagem: (err as Error).message,
        });
      } catch (_logErr) {
        // segue pro retorno do erro original
      }
    }
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
