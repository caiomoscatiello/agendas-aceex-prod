import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etapa 3 (Config PROJTE) — botao "Criar Ambiente".
//
// Espelha o SCHEMA do template PROJTE (migrations do produto, sem dados)
// dentro do projeto Supabase real do cliente (QA ou Producao), usando o
// management_token do PROPRIO projeto-alvo (guardado no Vault via
// projte-manage-secret). Nao usa as credenciais MCP desta sessao porque o
// projeto do cliente vive numa conta/organizacao Supabase separada, que
// essas credenciais nao enxergam -- so o management_token do cliente tem
// acesso a API de gerenciamento daquele projeto especifico.
//
// As 59 migrations do produto vivem em projte_config.template_migrations
// (uma linha por arquivo, coluna sql com o texto completo, vinculadas a
// uma template_release). Nao ficam embutidas no codigo da function --
// carregar 59 migrations como string literal TS demonstrou ser fragil
// demais pra manter (arquivos grandes, risco de erro de transcricao); a
// tabela e a fonte de verdade e pode ser atualizada via SQL direto quando
// uma nova template_release for publicada.
//
// v1 (escopo combinado com o Caio: "sem levar nenhum dado, apenas os
// esquemas... prontos pra rodar") faz SOMENTE schema: roda as migrations
// do produto em sequencia, uma por vez (mesma ordem/isolamento do Supabase
// CLI -- nao agrupa tudo numa unica transacao gigante porque uma das
// migrations faz ALTER TYPE ... ADD VALUE, que nao pode ser usado na mesma
// transacao em que foi criado). Nao sobe edge functions nem configura
// secrets de terceiros (Resend, Monday, etc.) -- isso fica pra uma fase
// futura, documentada em docs/etapa3-config-projte.md secao 3.
//
// Autorizacao: mesma checagem de projte_config.usuarios_autorizados usada
// no resto do painel PROJTE, decoupled do app_role do produto Aceex.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDER = "{{PROJTE_FUNCTIONS_URL}}";
const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";

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

    const { data: ambiente, error: ambienteErr } = await projteSchema
      .from("ambientes")
      .select("id, cliente_id, tipo, supabase_project_ref, supabase_project_url, status")
      .eq("id", ambienteId)
      .maybeSingle();
    if (ambienteErr) throw ambienteErr;
    if (!ambiente) {
      return jsonResponse({ error: "Ambiente não encontrado" }, 404);
    }
    if (!ambiente.supabase_project_ref || !ambiente.supabase_project_url) {
      return jsonResponse(
        { error: "Preencha supabase_project_ref e supabase_project_url do ambiente antes de provisionar." },
        400
      );
    }

    // Busca o management_token guardado no Vault pra ESSE ambiente.
    const { data: tokenRef } = await projteSchema
      .from("ambiente_secrets")
      .select("vault_secret_id")
      .eq("ambiente_id", ambienteId)
      .eq("tipo", "management_token")
      .maybeSingle();
    if (!tokenRef) {
      return jsonResponse(
        { error: "Registre o management_token (Personal Access Token) desse ambiente na seção Segredos antes de provisionar." },
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
    const targetFunctionsUrl = ambiente.supabase_project_url.replace(/\/+$/, "") + "/functions/v1";

    const logStep = async (etapa: string, status: "ok" | "erro", mensagem: string) => {
      await projteSchema.from("provisionamento_logs").insert({
        ambiente_id: ambienteId,
        tipo: "provisionamento",
        etapa,
        status,
        mensagem,
      });
    };

    // Release mais recente e suas migrations, na ordem certa.
    const { data: latestRelease, error: releaseErr } = await projteSchema
      .from("template_releases")
      .select("id, versao")
      .order("publicado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (releaseErr) throw releaseErr;
    if (!latestRelease) {
      return jsonResponse({ error: "Nenhuma template_release publicada ainda." }, 500);
    }

    const { data: migrationsData, error: migrationsErr } = await projteSchema
      .from("template_migrations")
      .select("seq, name, sql")
      .eq("template_release_id", latestRelease.id)
      .order("seq", { ascending: true });
    if (migrationsErr) throw migrationsErr;
    if (!migrationsData || migrationsData.length === 0) {
      return jsonResponse({ error: `Release ${latestRelease.versao} não tem migrations cadastradas.` }, 500);
    }
    const MIGRATIONS = migrationsData as { seq: number; name: string; sql: string }[];

    await projteSchema.from("ambientes").update({ status: "provisionando" }).eq("id", ambienteId);
    await logStep(
      "inicio",
      "ok",
      `Iniciando provisionamento de schema (${MIGRATIONS.length} migrations, release ${latestRelease.versao}) para o projeto ${targetRef}.`
    );

    const runQuery = async (sql: string) => {
      const res = await fetch(`${MANAGEMENT_API_BASE}/projects/${targetRef}/database/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${managementToken}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    };

    for (let i = 0; i < MIGRATIONS.length; i++) {
      const migration = MIGRATIONS[i];
      const sql = migration.sql.split(PLACEHOLDER).join(targetFunctionsUrl);

      const result = await runQuery(sql);

      if (!result.ok) {
        const mensagem = `Falha na migration ${i + 1}/${MIGRATIONS.length} (${migration.name}): HTTP ${result.status} — ${result.text.slice(0, 1000)}`;
        await logStep(migration.name, "erro", mensagem);
        await projteSchema.from("ambientes").update({ status: "erro" }).eq("id", ambienteId);
        return jsonResponse(
          {
            error: mensagem,
            migrations_applied: i,
            migrations_total: MIGRATIONS.length,
            failed_migration: migration.name,
          },
          500
        );
      }

      await logStep(migration.name, "ok", `Migration ${i + 1}/${MIGRATIONS.length} aplicada.`);
    }

    const nowIso = new Date().toISOString();
    await projteSchema
      .from("ambientes")
      .update({
        status: "ativo",
        template_release_id: latestRelease.id,
        provisionado_em: nowIso,
        atualizado_em: nowIso,
      })
      .eq("id", ambienteId);

    await logStep(
      "concluido",
      "ok",
      `Schema provisionado com sucesso (${MIGRATIONS.length} migrations aplicadas). Release: ${latestRelease.versao}.`
    );

    return jsonResponse({
      success: true,
      migrations_applied: MIGRATIONS.length,
      template_release: latestRelease.versao,
    });
  } catch (err) {
    console.error("[projte-provision-ambiente] error:", err);
    if (ambienteId) {
      try {
        await projteSchema.from("provisionamento_logs").insert({
          ambiente_id: ambienteId,
          tipo: "provisionamento",
          etapa: "erro_inesperado",
          status: "erro",
          mensagem: (err as Error).message,
        });
        await projteSchema.from("ambientes").update({ status: "erro" }).eq("id", ambienteId);
      } catch (_logErr) {
        // se nem o log deu certo, so segue pro retorno do erro original
      }
    }
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
