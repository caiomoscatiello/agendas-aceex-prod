import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etapa 3 (Config PROJTE) — botão "5. Publicar Frontend".
//
// Pedido do Caio (2026-08-24): o painel Config PROJTE deve ser o
// instalador/configurador de verdade -- automatizar TAMBÉM a publicação do
// frontend (Vercel), não só o schema (Supabase, via projte-provision-ambiente).
//
// CORREÇÃO DE ARQUITETURA (2026-08-24, mesma tarde): a primeira versão desta
// function assumia uma conta Vercel ÚNICA da PROJTE, com um projeto por
// ambiente linkado ao repo Git da PROJTE. ERRADO -- o Caio corrigiu: "o
// cliente tem seu vercel... o vercel do projte é o repositório... cada
// cliente terá seu vercel com qa e prod". Ou seja:
//   - Cada AMBIENTE (QA e Produção de cada cliente) tem sua PRÓPRIA conta
//     Vercel, separada -- mesmo princípio de isolamento já usado pro
//     Supabase ("zero compartilhamento entre clientes").
//   - Como a conta Vercel do cliente não tem (nem deveria ter) acesso ao
//     repositório Git privado da PROJTE, não dá pra linkar por Git. Publica
//     direto: baixa o código-fonte do GitHub (via GITHUB_PAT, já configurado
//     nesta função pra outras finalidades) e envia os arquivos pra API da
//     Vercel (mesmo mecanismo que `vercel deploy` usa por baixo: upload de
//     arquivo por SHA1 + criação de deployment referenciando os SHAs).
//
// Fluxo:
//   1. Token da Vercel DESSE ambiente (Vault, tipo 'vercel_token' --
//      registrado pelo Caio em Segredos, gerado pelo CLIENTE na conta Vercel
//      dele). Nunca um secret global.
//   2. Cria (ou reaproveita -- ambientes.vercel_project_id) o projeto Vercel
//      dentro da conta do cliente e configura as env vars de build
//      (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, buscadas frescas
//      via Management API do Supabase desse ambiente -- nunca hardcoded).
//   3. Baixa o tarball do repo no GitHub (branch configurável via
//      VERCEL_GIT_REF, default "master"), filtra só o necessário pro build
//      Vite (package.json, configs, src/, public/ -- fora node_modules,
//      supabase/, QA/, docs/, .env), calcula SHA1 de cada arquivo e faz
//      upload pra Vercel.
//   4. Cria o deployment (target=production) referenciando os arquivos por
//      SHA1, espera (polling) ficar READY, grava a URL final em
//      ambientes.frontend_url.
//
// Pré-requisitos:
//   - Secret GITHUB_PAT nesta Edge Function (já configurado -- mesmo usado
//     por projte-verificar-camada3/projte-rodar-suite-completa).
//   - Um segredo tipo 'vercel_token' registrado em Ambiente > Segredos, POR
//     AMBIENTE (Personal Access Token gerado pelo CLIENTE em
//     vercel.com/account/tokens, na conta Vercel dele).
//
// NOTA HONESTA: essa é a primeira versão desta automação -- em especial o
// parser de tar (formato ustar, sem biblioteca externa) e a dança de upload
// de arquivo por SHA1 da API da Vercel ainda não foram validados contra um
// deploy real. Todo erro é logado em detalhe (corpo da resposta, não só o
// status) em provisionamento_logs, pra ajuste rápido na primeira tentativa
// real.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_OWNER = "caiomoscatiello";
const GITHUB_REPO = "agendas-aceex-prod";
const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";
const VERCEL_API_BASE = "https://api.vercel.com";

// Só isso é necessário pra `npm install && vite build` -- fora fica de fora
// (supabase/, QA/, docs/, .git, .env, node_modules, etc.), tanto por
// tamanho quanto porque não faz sentido subir código de backend/testes/
// segredos locais pra dentro da conta Vercel do cliente.
const INCLUDE_TOP_LEVEL = [
  "package.json",
  "package-lock.json",
  "index.html",
  "components.json",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "public",
  "src",
];

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

async function sha1Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Parser mínimo de tar (formato ustar/GNU, o que o endpoint de tarball do
// GitHub devolve, dentro de um .gz). Só extrai entradas do tipo "arquivo
// regular" (typeflag '0' ou '\0') que estejam dentro de INCLUDE_TOP_LEVEL,
// já removendo o prefixo "<owner>-<repo>-<sha>/" que o GitHub sempre inclui.
async function fetchGithubSourceFiles(
  pat: string,
  ref: string
): Promise<{ path: string; data: Uint8Array }[]> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tarball/${ref}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      "User-Agent": "projte-publish-frontend",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ao baixar tarball do GitHub (ref="${ref}"): ${text.slice(0, 300)}`);
  }
  const gzBytes = new Uint8Array(await res.arrayBuffer());
  const stream = new Blob([gzBytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const tarBytes = new Uint8Array(await new Response(stream).arrayBuffer());

  const decoder = new TextDecoder();
  const files: { path: string; data: Uint8Array }[] = [];
  let offset = 0;
  while (offset + 512 <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + 512);
    const nameBytes = header.subarray(0, 100);
    const nameEnd = nameBytes.indexOf(0);
    const name = decoder.decode(nameBytes.subarray(0, nameEnd === -1 ? 100 : nameEnd));
    if (!name) break; // bloco de padding no fim do arquivo

    const typeFlag = String.fromCharCode(header[156]);
    const sizeOctalRaw = decoder.decode(header.subarray(124, 136)).replace(/\0/g, "").trim();
    const size = sizeOctalRaw ? parseInt(sizeOctalRaw, 8) : 0;

    offset += 512;

    if (typeFlag === "0" || typeFlag === "\0") {
      const data = tarBytes.subarray(offset, offset + size);
      const slashIdx = name.indexOf("/");
      const relPath = slashIdx >= 0 ? name.slice(slashIdx + 1) : name;
      if (relPath) {
        const top = relPath.split("/")[0];
        if (INCLUDE_TOP_LEVEL.includes(top)) {
          files.push({ path: relPath, data: data.slice() });
        }
      }
    }

    offset += Math.ceil(size / 512) * 512;
  }

  if (files.length === 0) {
    throw new Error(
      `Tarball do GitHub baixado, mas nenhum arquivo bateu com INCLUDE_TOP_LEVEL -- confira se o ref "${ref}" existe e se a estrutura do repo mudou.`
    );
  }
  return files;
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

    const githubPat = Deno.env.get("GITHUB_PAT");
    if (!githubPat) {
      const mensagem =
        "GITHUB_PAT não configurado nos secrets desta Edge Function (Project Settings > Edge Functions > Secrets).";
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }
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

    // ---- Tokens desse ambiente específico (Vault) -- nunca globais ----
    const { data: secretRefs } = await projteSchema
      .from("ambiente_secrets")
      .select("tipo, vault_secret_id")
      .eq("ambiente_id", ambienteId)
      .in("tipo", ["management_token", "vercel_token"]);

    const managementTokenRef = secretRefs?.find((s: any) => s.tipo === "management_token");
    const vercelTokenRef = secretRefs?.find((s: any) => s.tipo === "vercel_token");

    if (!managementTokenRef) {
      return jsonResponse({ error: "Nenhum management_token registrado pra esse ambiente (Segredos, passo 2)." }, 400);
    }
    if (!vercelTokenRef) {
      return jsonResponse({
        error:
          "Nenhum vercel_token registrado pra esse ambiente (Segredos). Peça pro cliente gerar um Personal Access Token em vercel.com/account/tokens (na conta Vercel DELE) e registre aqui com o tipo 'vercel_token'.",
      }, 400);
    }

    const { data: managementToken, error: mtErr } = await projteSchema.rpc("vault_reveal_secret", {
      secret_id: managementTokenRef.vault_secret_id,
    });
    if (mtErr) throw mtErr;
    if (!managementToken) {
      return jsonResponse({ error: "Não foi possível recuperar o management_token do Vault." }, 500);
    }

    const { data: vercelToken, error: vtErr } = await projteSchema.rpc("vault_reveal_secret", {
      secret_id: vercelTokenRef.vault_secret_id,
    });
    if (vtErr) throw vtErr;
    if (!vercelToken) {
      return jsonResponse({ error: "Não foi possível recuperar o vercel_token do Vault." }, 500);
    }

    const targetRef = ambiente.supabase_project_ref.trim();
    const targetBaseUrl = ambiente.supabase_project_url.replace(/\/+$/, "");

    // ---- Chave anon fresca do Supabase desse ambiente ----
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

    // ---- Helper genérico pra chamadas na API da Vercel (token DESTE ambiente) ----
    const vercelFetch = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${VERCEL_API_BASE}${path}`, {
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

    const projectName = `aceex-${ambiente.tipo}`;

    // ---- 1. Cria (ou reaproveita) o projeto Vercel na conta DESTE cliente ----
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
        body: JSON.stringify({ name: projectName, framework: "vite" }),
      });
      if (!createRes.ok) {
        const mensagem = `Falha ao criar projeto Vercel "${projectName}": HTTP ${createRes.status} — ${createRes.text.slice(0, 800)}`;
        await logStep("publicar_frontend", "erro", mensagem);
        return jsonResponse({ error: mensagem }, 500);
      }
      vercelProjectId = createRes.json.id;
      await projteSchema.from("ambientes").update({ vercel_project_id: vercelProjectId }).eq("id", ambienteId);
    }

    // ---- 2. Configura as env vars de build (idempotente) ----
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

    // ---- 3. Baixa o código-fonte do GitHub e faz upload dos arquivos pra Vercel ----
    const sourceFiles = await fetchGithubSourceFiles(githubPat, gitRef);

    const filesWithSha = await Promise.all(
      sourceFiles.map(async (f) => ({ ...f, sha: await sha1Hex(f.data) }))
    );

    for (const f of filesWithSha) {
      const uploadRes = await fetch(`${VERCEL_API_BASE}/v2/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Length": String(f.data.byteLength),
          "x-vercel-digest": f.sha,
        },
        body: f.data,
      });
      if (!uploadRes.ok) {
        const uploadText = await uploadRes.text().catch(() => "");
        const mensagem = `Falha ao subir arquivo "${f.path}" pra Vercel: HTTP ${uploadRes.status} — ${uploadText.slice(0, 500)}`;
        await logStep("publicar_frontend", "erro", mensagem);
        return jsonResponse({ error: mensagem }, 500);
      }
    }

    // ---- 4. Cria o deployment referenciando os arquivos por SHA1 ----
    const deployRes = await vercelFetch("/v13/deployments", {
      method: "POST",
      body: JSON.stringify({
        name: projectName,
        project: vercelProjectId,
        target: "production",
        projectSettings: { framework: "vite" },
        files: filesWithSha.map((f) => ({ file: f.path, sha: f.sha, size: f.data.byteLength })),
      }),
    });
    if (!deployRes.ok) {
      const mensagem = `Falha ao criar deployment na Vercel: HTTP ${deployRes.status} — ${deployRes.text.slice(0, 800)}`;
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }
    const deploymentId = deployRes.json?.id;
    if (!deploymentId) {
      const mensagem = `Deployment criado, mas resposta da Vercel não trouxe um id: ${deployRes.text.slice(0, 500)}`;
      await logStep("publicar_frontend", "erro", mensagem);
      return jsonResponse({ error: mensagem }, 500);
    }

    // ---- 5. Aguarda (polling) o deployment ficar READY (~4min) ----
    let finalUrl: string | null = null;
    let readyState = "";
    const inicioPolling = Date.now();
    while (Date.now() - inicioPolling < 240_000) {
      await new Promise((r) => setTimeout(r, 8_000));
      const statusRes = await vercelFetch(`/v13/deployments/${deploymentId}`);
      if (!statusRes.ok) continue;
      readyState = statusRes.json?.readyState ?? "";
      if (readyState === "READY") {
        finalUrl = statusRes.json?.url ? `https://${statusRes.json.url}` : null;
        break;
      }
      if (readyState === "ERROR" || readyState === "CANCELED") {
        const mensagem = `Deploy na Vercel terminou com estado "${readyState}" -- confira o dashboard da Vercel do cliente pro log de build completo.`;
        await logStep("publicar_frontend", "erro", mensagem);
        return jsonResponse({ error: mensagem }, 500);
      }
    }

    if (!finalUrl) {
      const mensagem = `Deploy disparado, mas não ficou READY em 4min (último estado: "${readyState || "desconhecido"}"). Confira o dashboard da Vercel do cliente -- pode só estar demorando mais que o esperado.`;
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
