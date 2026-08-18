import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sodium from "npm:libsodium-wrappers@0.7.15";

// Etapa 3 (Config PROJTE) — botão "Rodar Suite Completa" (camada 4).
//
// Faz, em sequência, tudo que a suite BL-020 completa (playwright.config.ts
// da raiz, não o smoke isolado da camada 3) precisa pra rodar contra o
// projeto Supabase real de um cliente:
//
//   1. Semeia (ou reaproveita) o fixture de teste no banco do CLIENTE --
//      mesmo formato do fixture QA-COORD-TEST original (ver
//      docs/etapa3-config-projte.md e a investigação que confirmou as
//      formas exatas de projetos/projeto_atividades/user_roles antes desta
//      function ser escrita): 1 projeto (codigo_cliente=QACOORD), 1
//      atividade (codigo=QA01), 3 usuários (admin/coordenador/consultor)
//      com linha em user_roles. Credenciais geradas ficam no Vault deste
//      ambiente (tipo suite_fixture_credentials), reveladas de novo em cada
//      execução (nunca voltam pro navegador de quem clicou).
//   2. Entrega o management_token e o service_role_key do projeto-alvo pro
//      GitHub Actions de forma segura: nenhum dos dois vai como input
//      de workflow_dispatch (isso apareceria em texto puro pra qualquer
//      pessoa com acesso de leitura às Actions do repo). Em vez disso, os
//      dois são criptografados aqui dentro com a chave pública do
//      repositório (libsodium crypto_box_seal, exigido pela API de secrets
//      do GitHub) e gravados como Actions secrets do repo
//      (CLIENT_MANAGEMENT_TOKEN / CLIENT_SERVICE_ROLE_KEY), sobrescritos a
//      cada disparo -- o job só consegue ler o valor via secrets.<NOME>
//      dentro do workflow, nunca em log nenhum.
//      Trade-off aceito (documentado pro Caio): são secrets de escopo do
//      REPOSITÓRIO inteiro, não por-ambiente -- se duas execuções desta
//      function rodarem ao mesmo tempo para clientes diferentes, a segunda
//      sobrescreve o valor que a primeira ia usar. Uso interno, um usuário
//      só, uma execução por vez -- risco aceito por ora; revisitar (GitHub
//      Environments com secret por-ambiente) se isso deixar de ser verdade.
//   3. Dispara .github/workflows/rodar-suite-completa.yml, que primeiro faz
//      deploy das edge functions do produto pro projeto do cliente
//      (usando CLIENT_MANAGEMENT_TOKEN como SUPABASE_ACCESS_TOKEN da CLI) e
//      depois roda a suite BL-020 completa contra o frontend_url do
//      ambiente, pulando IN002 (único teste dependente de Monday.com --
//      decisão do Caio, não configurado por cliente ainda).
//
// Pré-requisitos (nenhum configurado por esta function):
//   - Segredos desta Edge Function (Project Settings > Edge Functions >
//     projte-rodar-suite-completa > Secrets): GITHUB_PAT (mesmo token de
//     projte-verificar-camada3, precisa também de permissão "Secrets:
//     write" além de "Actions: write") e GITHUB_REF (opcional).
//   - Ambiente com frontend_url preenchido e já provisionado (management_token
//     e supabase_project_ref presentes).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_OWNER = "caiomoscatiello";
const GITHUB_REPO = "agendas-aceex-prod";
const WORKFLOW_FILE = "rodar-suite-completa.yml";
const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";

const FIXTURE_CODIGO_CLIENTE = "QACOORD";
const FIXTURE_NOME_CLIENTE = "QA-COORD-TEST";
const FIXTURE_ATIVIDADE_CODIGO = "QA01";
const FIXTURE_ATIVIDADE_DESCRICAO = "Atividade de teste QA (BL-020)";
const FIXTURE_USERS = [
  { chave: "admin", email: "tst.admin@projte.com", role: "admin" },
  { chave: "coordenador", email: "tst.coord@projte.com", role: "coordenador" },
  { chave: "consultor", email: "tst.cons@projte.com", role: "consultor" },
] as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  const logStep = async (etapa: string, status: "ok" | "erro", mensagem: string) => {
    if (!ambienteId) return;
    await projteSchema.from("provisionamento_logs").insert({
      ambiente_id: ambienteId,
      tipo: "verificacao",
      etapa,
      status,
      mensagem,
    });
  };

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
      // Mesma correção aplicada em projte-verificar-camada3 (2026-08-18):
      // erro de configuração precisa deixar rastro em provisionamento_logs,
      // não só um 500 mudo pro navegador.
      const mensagem =
        "GITHUB_PAT não configurado nos secrets desta Edge Function (Project Settings > Edge Functions > projte-rodar-suite-completa > Secrets). Precisa de permissão 'Actions: write' e 'Secrets: write'.";
      await logStep("suite_disparo", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }
    const githubRef = Deno.env.get("GITHUB_REF") || "master";

    const { data: ambiente, error: ambienteErr } = await projteSchema
      .from("ambientes")
      .select("id, tipo, frontend_url, supabase_project_ref, supabase_project_url, status")
      .eq("id", ambienteId)
      .maybeSingle();
    if (ambienteErr) throw ambienteErr;
    if (!ambiente) {
      return jsonResponse({ error: "Ambiente não encontrado" }, 404);
    }
    if (!ambiente.frontend_url?.trim()) {
      return jsonResponse(
        { error: "Preencha o Frontend URL do ambiente antes de rodar a suite completa." },
        400
      );
    }
    if (!ambiente.supabase_project_ref || !ambiente.supabase_project_url) {
      return jsonResponse(
        { error: "Ambiente sem supabase_project_ref/supabase_project_url preenchidos." },
        400
      );
    }
    if (ambiente.status !== "ativo") {
      return jsonResponse(
        { error: `Ambiente está com status "${ambiente.status}" -- rode 'Criar Ambiente' com sucesso antes de rodar a suite completa.` },
        400
      );
    }

    const targetRef = ambiente.supabase_project_ref.trim();
    const targetBaseUrl = ambiente.supabase_project_url.replace(/\/+$/, "");

    // management_token do projeto-alvo (revelado só aqui dentro).
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

    // service_role_key do projeto-alvo -- necessário pro globalSetup/teardown
    // da suite (bypass de RLS pra semear/limpar dados de teste) e pra criar
    // os 3 usuários fixture via GoTrue Admin API. Busca sempre fresco via
    // Management API (não depende de já estar salvo em ambiente_secrets).
    const keysRes = await fetch(`${MANAGEMENT_API_BASE}/projects/${targetRef}/api-keys?reveal=true`, {
      headers: { Authorization: `Bearer ${managementToken}` },
    });
    const keysText = await keysRes.text();
    if (!keysRes.ok) throw new Error(`HTTP ${keysRes.status} ao buscar api-keys: ${keysText.slice(0, 300)}`);
    const keys = JSON.parse(keysText) as { name: string; api_key: string }[];
    const serviceRoleKey =
      keys.find((k) => k.name === "service_role")?.api_key ?? keys.find((k) => k.name === "secret")?.api_key;
    if (!serviceRoleKey) {
      throw new Error("Nenhuma chave service_role/secret encontrada nas api-keys do projeto.");
    }

    const authAdminHeaders = {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    };

    // ---- 1. Fixture: 3 usuários (GoTrue Admin API, cria ou reseta senha) ----
    const fixtureCreds: Record<string, { email: string; password: string; id: string }> = {};
    for (const u of FIXTURE_USERS) {
      const password = crypto.randomUUID() + "-Aa1!";
      const createRes = await fetch(`${targetBaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: authAdminHeaders,
        body: JSON.stringify({ email: u.email, password, email_confirm: true }),
      });

      let userId: string;
      if (createRes.ok) {
        const created = await createRes.json();
        userId = created.id;
      } else {
        const listRes = await fetch(`${targetBaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(u.email)}`, {
          headers: authAdminHeaders,
        });
        const listText = await listRes.text();
        if (!listRes.ok) throw new Error(`HTTP ${listRes.status} ao buscar usuário fixture ${u.email}: ${listText.slice(0, 300)}`);
        const listJson = JSON.parse(listText);
        const usersArray = Array.isArray(listJson) ? listJson : listJson.users;
        const existingUser = (usersArray || []).find((x: any) => x.email === u.email);
        if (!existingUser) {
          const createText = await createRes.text();
          throw new Error(`Falha ao criar usuário fixture ${u.email} e não encontrei um existente: HTTP ${createRes.status} — ${createText.slice(0, 300)}`);
        }
        userId = existingUser.id;
        const patchRes = await fetch(`${targetBaseUrl}/auth/v1/admin/users/${userId}`, {
          method: "PUT",
          headers: authAdminHeaders,
          body: JSON.stringify({ password }),
        });
        if (!patchRes.ok) {
          const patchText = await patchRes.text();
          throw new Error(`HTTP ${patchRes.status} ao resetar senha do usuário fixture ${u.email}: ${patchText.slice(0, 300)}`);
        }
      }
      fixtureCreds[u.chave] = { email: u.email, password, id: userId };
    }

    // ---- 2. Fixture: projeto + atividade (SQL idempotente via Management API) ----
    const runQuery = async (sql: string) => {
      const res = await fetch(`${MANAGEMENT_API_BASE}/projects/${targetRef}/database/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${managementToken}` },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    };

    const coordId = fixtureCreds.coordenador.id;
    const adminId = fixtureCreds.admin.id;
    const consultorId = fixtureCreds.consultor.id;

    const fixtureSql = `
      insert into public.projetos (nome_cliente, codigo_cliente, coordenador_id, horas_contratadas, deslocamento, status)
      select '${FIXTURE_NOME_CLIENTE}', '${FIXTURE_CODIGO_CLIENTE}', '${coordId}'::uuid, 999, 0, 'Liberado'
      where not exists (select 1 from public.projetos where codigo_cliente = '${FIXTURE_CODIGO_CLIENTE}');

      update public.projetos set coordenador_id = '${coordId}'::uuid
      where codigo_cliente = '${FIXTURE_CODIGO_CLIENTE}' and coordenador_id is distinct from '${coordId}'::uuid;

      insert into public.projeto_atividades (projeto_id, codigo, descricao, horas)
      select p.id, '${FIXTURE_ATIVIDADE_CODIGO}', '${FIXTURE_ATIVIDADE_DESCRICAO}', 999
      from public.projetos p
      where p.codigo_cliente = '${FIXTURE_CODIGO_CLIENTE}'
        and not exists (
          select 1 from public.projeto_atividades a where a.projeto_id = p.id and a.codigo = '${FIXTURE_ATIVIDADE_CODIGO}'
        );

      insert into public.user_roles (user_id, role)
      select '${adminId}'::uuid, 'admin'::app_role
      where not exists (select 1 from public.user_roles where user_id = '${adminId}'::uuid);

      insert into public.user_roles (user_id, role)
      select '${coordId}'::uuid, 'coordenador'::app_role
      where not exists (select 1 from public.user_roles where user_id = '${coordId}'::uuid);

      insert into public.user_roles (user_id, role)
      select '${consultorId}'::uuid, 'consultor'::app_role
      where not exists (select 1 from public.user_roles where user_id = '${consultorId}'::uuid);
    `;
    const fixtureResult = await runQuery(fixtureSql);
    if (!fixtureResult.ok) {
      throw new Error(`Falha ao semear fixture de teste no banco do cliente: HTTP ${fixtureResult.status} — ${fixtureResult.text.slice(0, 800)}`);
    }

    // Guarda as 3 credenciais no Vault deste ambiente (uma linha JSON, mesmo
    // padrão de monitor_credentials).
    const credenciaisJson = JSON.stringify({
      admin: { email: fixtureCreds.admin.email, password: fixtureCreds.admin.password },
      coordenador: { email: fixtureCreds.coordenador.email, password: fixtureCreds.coordenador.password },
      consultor: { email: fixtureCreds.consultor.email, password: fixtureCreds.consultor.password },
    });
    const { data: existingFixtureSecret } = await projteSchema
      .from("ambiente_secrets")
      .select("id, vault_secret_id")
      .eq("ambiente_id", ambienteId)
      .eq("tipo", "suite_fixture_credentials")
      .maybeSingle();
    if (existingFixtureSecret) {
      const { error: updErr } = await projteSchema.rpc("vault_update_secret", {
        secret_id: existingFixtureSecret.vault_secret_id,
        new_secret: credenciaisJson,
      });
      if (updErr) throw updErr;
    } else {
      const secretName = `ambiente_${ambienteId}_suite_fixture_credentials_${Date.now()}`;
      const { data: newSecretId, error: createErr } = await projteSchema.rpc("vault_create_secret", {
        new_secret: credenciaisJson,
        new_name: secretName,
        new_description: "Credenciais dos 3 usuários fixture (admin/coordenador/consultor) da suite BL-020 completa.",
      });
      if (createErr) throw createErr;
      const { error: insErr } = await projteSchema.from("ambiente_secrets").insert({
        ambiente_id: ambienteId,
        tipo: "suite_fixture_credentials",
        vault_secret_id: newSecretId,
        descricao: "Fixture de teste (projeto+atividade+3 usuários) para a suite BL-020 completa.",
      });
      if (insErr) throw insErr;
    }

    await logStep("suite_fixture", "ok", "Fixture de teste (projeto QA-COORD-TEST, atividade QA01, 3 usuários) pronto no banco do cliente.");

    // ---- 3. Criptografa management_token e service_role_key como GitHub Actions secrets ----
    await sodium.ready;
    const encryptForGithub = async (secretValue: string) => {
      const pkRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/secrets/public-key`, {
        headers: { Authorization: `Bearer ${githubPat}`, Accept: "application/vnd.github+json" },
      });
      const pkText = await pkRes.text();
      if (!pkRes.ok) throw new Error(`HTTP ${pkRes.status} ao buscar chave pública do GitHub: ${pkText.slice(0, 300)}`);
      const pk = JSON.parse(pkText) as { key_id: string; key: string };

      const binKey = sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL);
      const binSecret = sodium.from_string(secretValue);
      const encBytes = sodium.crypto_box_seal(binSecret, binKey);
      const encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
      return { encryptedValue, keyId: pk.key_id };
    };

    const setGithubSecret = async (name: string, value: string) => {
      const { encryptedValue, keyId } = await encryptForGithub(value);
      const putRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/secrets/${name}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubPat}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId }),
      });
      if (!putRes.ok) {
        const putText = await putRes.text();
        throw new Error(`HTTP ${putRes.status} ao gravar secret ${name} no GitHub: ${putText.slice(0, 300)}`);
      }
    };

    await setGithubSecret("CLIENT_MANAGEMENT_TOKEN", managementToken as string);
    await setGithubSecret("CLIENT_SERVICE_ROLE_KEY", serviceRoleKey);
    await logStep("suite_secrets_github", "ok", "management_token e service_role_key criptografados e gravados como GitHub Actions secrets (repo-level, sobrescritos nesta execução).");

    // ---- 4. Dispara o workflow ----
    const label = ambiente.tipo === "qa" ? "QA" : "Produção";
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${githubPat}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: githubRef,
          inputs: {
            ambiente_label: label,
            base_url: ambiente.frontend_url.trim(),
            project_ref: targetRef,
            project_url: targetBaseUrl,
            admin_email: fixtureCreds.admin.email,
            admin_password: fixtureCreds.admin.password,
            coordenador_email: fixtureCreds.coordenador.email,
            coordenador_password: fixtureCreds.coordenador.password,
            consultor_email: fixtureCreds.consultor.email,
            consultor_password: fixtureCreds.consultor.password,
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      const mensagem = `HTTP ${dispatchRes.status} ao disparar workflow: ${text.slice(0, 500)}`;
      await logStep("suite_disparo", "erro", mensagem);
      return jsonResponse({ error: `Falha ao disparar o workflow no GitHub: HTTP ${dispatchRes.status} — ${text.slice(0, 300)}` }, 500);
    }

    let runUrl: string | null = null;
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const runsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=1`,
        { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${githubPat}` } }
      );
      if (runsRes.ok) {
        const runsJson = await runsRes.json();
        runUrl = runsJson?.workflow_runs?.[0]?.html_url ?? null;
      }
    } catch (_e) {
      // best-effort
    }

    await logStep(
      "suite_disparo",
      "ok",
      runUrl ? `Suite completa (camada 4) disparada. Acompanhe em: ${runUrl}` : "Suite completa (camada 4) disparada no GitHub Actions."
    );

    return jsonResponse({ success: true, run_url: runUrl });
  } catch (err) {
    console.error("[projte-rodar-suite-completa] error:", err);
    if (ambienteId) {
      try {
        await logStep("erro_inesperado", "erro", (err as Error).message);
      } catch (_logErr) {
        // segue pro retorno do erro original
      }
    }
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
