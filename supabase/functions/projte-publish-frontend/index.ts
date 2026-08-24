import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etapa 3 (Config PROJTE) — botão "5. Publicar Frontend".
//
// Pedido do Caio (2026-08-24): o painel Config PROJTE deve ser o
// instalador/configurador de verdade -- automatizar TAMBÉM a publicação do
// frontend (Vercel), não só o schema (Supabase, via projte-provision-ambiente)
// e os testes (via projte-rodar-suite-completa). Até aqui esse passo era
// 100% manual: publicar via dashboard da Vercel e colar a URL no campo
// Frontend URL. Essa function fecha esse ciclo:
//
//   1. Cria (ou reaproveita, se já criado antes -- ambientes.vercel_project_id)
//      um projeto Vercel NOVO por ambiente, ligado a este mesmo repositório
//      Git (branch/ref configurável via VERCEL_GIT_REF, default "master") --
//      mesmo princípio de isolamento já usado pro Supabase ("zero
//      compartilhamento entre clientes", ver docs/etapa3-config-projte.md):
//      cada ambiente tem seu PRÓPRIO projeto Vercel, nunca reaproveita o de
//      outro cliente.
//   2. Configura as env vars do projeto (VITE_SUPABASE_URL e
//      VITE_SUPABASE_PUBLISHABLE_KEY) apontando pro Supabase DESSE ambiente
//      -- a chave anon é buscada fresca via Management API do Supabase
//      (mesmo padrão de projte-rodar-suite-completa pra service_role_key),
//      nunca fica hardcoded em nenhum lugar.
//   3. Garante um Deploy Hook (URL de trigger criada uma vez, reaproveitada
//      depois) e chama ele -- mais robusto do que montar a chamada de
//      "criar deployment" direto (schema dessa API muda mais entre versões
//      do que deploy hooks, que são simples e estáveis).
//   4. Espera (polling) o deployment mais recente do projeto ficar READY,
//      grava a URL final em ambientes.frontend_url e ambientes.vercel_project_id.
//
// Pré-requisito (não configurado por esta function): secret VERCEL_API_TOKEN
// nesta Edge Function (Project Settings > Edge Functions >
// projte-publish-frontend > Secrets) -- Personal Access Token gerado em
// vercel.com/account/tokens, com permissão de criar/gerenciar projetos.
// Se a conta Vercel for de TIME (não pessoal), configurar também
// VERCEL_TEAM_ID (Settings do time > General > Team ID).
//
// NOTA HONESTA: essa é a primeira versão desta automação -- diferente do
// resto do painel (que já passou por várias rodadas reais de teste hoje),
// esta function ainda não foi validada contra um deploy real. Todo erro é
// logado em detalhe (corpo da resposta da Vercel, não só o status) em
// provisionamento_logs, pra qualquer ajuste de schema/endpoint ser rápido
// de diagnosticar na primeira tentativa real.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_OWNER = "caiomoscatiello";
const GITHUB_REPO = "agendas-aceex-prod";
const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";
const VERCEL_API_BASE = "https://api.vercel.com";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKeyEnv = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);
  const projteSchema = (adminClient as any).schema("projte_config");

  let ambienteId: string | undefined;

  const logStep = async (etapa: string, status: "ok" | "erro", mensagem: string) => {
    if (!ambienteId) return;
    const { error } = await projteSchema.from("provisionamento_logs").insert({
      ambiente_id: ambienteId,
      tipo: "verificacao",
      etapa,
      status,
      mensagem,
    });
    if (error) console.error("[projte-publish-frontend] falha ao gravar provisionamento_logs:", error);
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKeyEnv, {
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

    const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
    if (!vercelToken) {
      const mensagem =
        "VERCEL_API_TOKEN não configurado nos secrets desta Edge Function (Project Settings > Edge Functions > projte-publish-frontend > Secrets). Gere em vercel.com/account/tokens.";
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }
    const vercelTeamId = Deno.env.get("VERCEL_TEAM_ID") || undefined;
    const gitRef = Deno.env.get("VERCEL_GIT_REF") || "master";

    const { data: ambiente, error: ambienteErr } = await projteSchema
      .from("ambientes")
      .select("id, cliente_id, tipo, supabase_project_ref, supabase_project_url, frontend_url, vercel_project_id, status")
      .eq("id", ambienteId)
      .maybeSingle();
    if (ambienteErr) throw ambienteErr;
    if (!ambiente) {
      return jsonResponse({ error: "Ambiente não encontrado" }, 404);
    }
    if (ambiente.status !== "ativo") {
      return jsonResponse(
        { error: `Ambiente está com status "${ambiente.status}" -- rode 'Criar Ambiente' com sucesso antes de publicar o frontend.` },
        400
      );
    }
    if (!ambiente.supabase_project_ref || !ambiente.supabase_project_url) {
      return jsonResponse({ error: "Ambiente sem supabase_project_ref/supabase_project_url preenchidos." }, 400);
    }

    const { data: cliente, error: clienteErr } = await projteSchema
      .from("clientes")
      .select("nome_fantasia")
      .eq("id", ambiente.cliente_id)
      .maybeSingle();
    if (clienteErr) throw clienteErr;

    const projectName = `projte-${slugify(cliente?.nome_fantasia || "cliente")}-${ambiente.tipo}`;

    // management_token do projeto-alvo (revelado só aqui dentro) -- necessário
    // pra buscar a chave anon fresca via Management API do Supabase.
    const { data: tokenRef } = await projteSchema
      .from("ambiente_secrets")
      .select("vault_secret_id")
      .eq("ambiente_id", ambienteId)
      .eq("tipo", "management_token")
      .maybeSingle();
    if (!tokenRef) {
      return jsonResponse({ error: "Nenhum management_token registrado pra esse ambiente." }, 400);
    }
    const { data: managementToken, error: mtErr } = await projteSchema.rpc("vault_reveal_secret", {
      secret_id: tokenRef.vault_secret_id,
    });
    if (mtErr) throw mtErr;
    if (!managementToken) {
      return jsonResponse({ error: "Não foi possível recuperar o management_token do Vault." }, 500);
    }

    const targetRef = ambiente.supabase_project_ref.trim();
    const targetBaseUrl = ambiente.supabase_project_url.replace(/\/+$/, "");

    const keysRes = await fetch(`${MANAGEMENT_API_BASE}/projects/${targetRef}/api-keys?reveal=true`, {
      headers: { Authorization: `Bearer ${managementToken}` },
    });
    const keysText = await keysRes.text();
    if (!keysRes.ok) throw new Error(`HTTP ${keysRes.status} ao buscar api-keys do Supabase: ${keysText.slice(0, 300)}`);
    const keys = JSON.parse(keysText) as { name: string; api_key: string }[];
    const anonKey =
      keys.find((k) => k.name === "anon")?.api_key ?? keys.find((k) => k.name === "publishable")?.api_key;
    if (!anonKey) {
      throw new Error("Nenhuma chave anon/publishable encontrada nas api-keys do projeto Supabase do ambiente.");
    }

    // ---- Helper genérico pra chamadas na API da Vercel ----
    const vercelFetch = async (path: string, init: RequestInit = {}) => {
      const url = new URL(`${VERCEL_API_BASE}${path}`);
      if (vercelTeamId) url.searchParams.set("teamId", vercelTeamId);
      const res = await fetch(url.toString(), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vercelToken}`,
          ...(init.headers || {}),
        },
      });
      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* corpo não-JSON */ }
      return { ok: res.ok, status: res.status, text, json };
    };

    // ---- 1. Cria (ou reaproveita) o projeto Vercel ----
    let vercelProjectId = ambiente.vercel_project_id as string | null;

    if (vercelProjectId) {
      const existing = await vercelFetch(`/v9/projects/${vercelProjectId}`);
      if (!existing.ok) {
        // Projeto pode ter sido apagado manualmente no dashboard -- recria.
        vercelProjectId = null;
      }
    }

    if (!vercelProjectId) {
      const createRes = await vercelFetch("/v10/projects", {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          framework: "vite",
          gitRepository: { type: "github", repo: `${GITHUB_OWNER}/${GITHUB_REPO}` },
        }),
      });
      if (!createRes.ok) {
        const mensagem = `Falha ao criar projeto Vercel "${projectName}": HTTP ${createRes.status} — ${createRes.text.slice(0, 800)}`;
        await logStep("publicar_frontend", "erro", mensagem);
        return jsonResponse({ error: mensagem }, 500);
      }
      vercelProjectId = createRes.json.id;
      await projteSchema.from("ambientes").update({ vercel_project_id: vercelProjectId }).eq("id", ambienteId);
    }

    // ---- 2. Configura as env vars (idempotente: atualiza se já existir) ----
    const desiredEnvs = [
      { key: "VITE_SUPABASE_URL", value: targetBaseUrl },
      { key: "VITE_SUPABASE_PUBLISHABLE_KEY", value: anonKey },
    ];
    const existingEnvsRes = await vercelFetch(`/v9/projects/${vercelProjectId}/env`);
    const existingEnvs: any[] = existingEnvsRes.ok ? (existingEnvsRes.json?.envs ?? []) : [];

    for (const desired of desiredEnvs) {
      const found = existingEnvs.find((e: any) => e.key === desired.key);
      if (found) {
        const patchRes = await vercelFetch(`/v9/projects/${vercelProjectId}/env/${found.id}`, {
          method: "PATCH",
          body: JSON.stringify({ value: desired.value }),
        });
        if (!patchRes.ok) {
          await logStep(
            "publicar_frontend",
            "erro",
            `Falha ao atualizar env var ${desired.key}: HTTP ${patchRes.status} — ${patchRes.text.slice(0, 500)}`
          );
        }
      } else {
        const createEnvRes = await vercelFetch(`/v10/projects/${vercelProjectId}/env`, {
          method: "POST",
          body: JSON.stringify({
            key: desired.key,
            value: desired.value,
            type: "encrypted",
            target: ["production", "preview", "development"],
          }),
        });
        if (!createEnvRes.ok) {
          await logStep(
            "publicar_frontend",
            "erro",
            `Falha ao criar env var ${desired.key}: HTTP ${createEnvRes.status} — ${createEnvRes.text.slice(0, 500)}`
          );
        }
      }
    }

    // ---- 3. Garante um Deploy Hook e dispara ----
    const hooksRes = await vercelFetch(`/v1/projects/${vercelProjectId}/deploy-hooks`);
    let hookUrl: string | null = null;
    if (hooksRes.ok) {
      const found = (hooksRes.json?.hooks ?? hooksRes.json ?? []).find?.((h: any) => h.name === "projte-auto");
      if (found?.url) hookUrl = found.url;
    }
    if (!hookUrl) {
      const createHookRes = await vercelFetch(`/v10/projects/${vercelProjectId}/deploy-hooks`, {
        method: "POST",
        body: JSON.stringify({ name: "projte-auto", ref: gitRef }),
      });
      if (createHookRes.ok) {
        hookUrl = createHookRes.json?.link?.url ?? createHookRes.json?.url ?? null;
      } else {
        const mensagem = `Falha ao criar deploy hook: HTTP ${createHookRes.status} — ${createHookRes.text.slice(0, 800)}`;
        await logStep("publicar_frontend", "erro", mensagem);
        return jsonResponse({ error: mensagem }, 500);
      }
    }
    if (!hookUrl) {
      const mensagem = "Deploy hook criado mas sem URL na resposta da Vercel -- não deu pra disparar o deploy.";
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }

    const triggerRes = await fetch(hookUrl, { method: "POST" });
    if (!triggerRes.ok) {
      const triggerText = await triggerRes.text().catch(() => "");
      const mensagem = `Falha ao disparar o deploy hook: HTTP ${triggerRes.status} — ${triggerText.slice(0, 500)}`;
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }

    // ---- 4. Aguarda o deployment mais recente ficar READY (polling, ~4min) ----
    let finalUrl: string | null = null;
    let readyState = "";
    const inicioPolling = Date.now();
    while (Date.now() - inicioPolling < 240_000) {
      await new Promise((r) => setTimeout(r, 8_000));
      const deploysRes = await vercelFetch(`/v6/deployments?projectId=${vercelProjectId}&limit=1`);
      if (!deploysRes.ok) continue;
      const latest = deploysRes.json?.deployments?.[0];
      if (!latest) continue;
      readyState = latest.readyState ?? latest.state ?? "";
      if (readyState === "READY") {
        finalUrl = latest.url ? `https://${latest.url}` : null;
        break;
      }
      if (readyState === "ERROR" || readyState === "CANCELED") {
        const mensagem = `Deploy na Vercel terminou com estado "${readyState}" -- confira o dashboard da Vercel pro log de build completo.`;
        await logStep("publicar_frontend", "erro", mensagem);
        return jsonResponse({ error: mensagem }, 500);
      }
    }

    if (!finalUrl) {
      const mensagem = `Deploy disparado, mas não ficou READY em 4min (último estado: "${readyState || "desconhecido"}"). Confira o dashboard da Vercel -- pode só estar demorando mais que o esperado.`;
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }

    await projteSchema.from("ambientes").update({ frontend_url: finalUrl }).eq("id", ambienteId);
    await logStep("publicar_frontend", "ok", `Frontend publicado com sucesso: ${finalUrl}`);

    return jsonResponse({ success: true, frontend_url: finalUrl, vercel_project_id: vercelProjectId });
  } catch (err) {
    console.error("[projte-publish-frontend] error:", err);
    if (ambienteId) {
      try {
        await logStep("publicar_frontend", "erro", (err as Error).message);
      } catch (_logErr) {
        // segue pro retorno do erro original
      }
    }
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
