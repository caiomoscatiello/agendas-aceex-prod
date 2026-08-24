import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Etapa 3 (Config PROJTE) — ponte para o Supabase Vault.
// O role "authenticated" nao tem permissao de executar vault.create_secret/
// update_secret diretamente (confirmado via has_function_privilege) -- por
// design do Supabase, so service_role pode. Esta function e o unico caminho
// pela tela de Ambientes pra criar/rotacionar/remover um segredo, e ela nunca
// devolve o valor real de volta pro cliente, so o UUID do vault.secrets.
// Chama projte_config.vault_create_secret/vault_update_secret/vault_delete_secret
// (funcoes security definer, ver migration 20260804190100), ja que o schema
// "vault" em si nao e exposto via PostgREST.
//
// Autorizacao: nao usa o app_role do produto Aceex (coordenador/consultor/
// admin) -- exige que o usuario esteja em projte_config.usuarios_autorizados,
// mesma checagem usada no resto do painel PROJTE.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_VALIDOS = ["service_role_key", "anon_key", "db_password", "management_token", "monitor_credentials", "suite_fixture_credentials", "vercel_token", "outro"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Autorização específica do control-plane PROJTE, não o app_role do Aceex.
    const { data: authRow } = await (adminClient as any)
      .schema("projte_config")
      .from("usuarios_autorizados")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!authRow) {
      return new Response(JSON.stringify({ error: "Acesso negado ao Config PROJTE" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ambiente_id, tipo, valor, descricao } = await req.json();

    if (!ambiente_id || !tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return new Response(JSON.stringify({ error: "ambiente_id e tipo (válido) são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projteSchema = (adminClient as any).schema("projte_config");

    if (action === "remove") {
      const { data: existing } = await projteSchema
        .from("ambiente_secrets")
        .select("id, vault_secret_id")
        .eq("ambiente_id", ambiente_id)
        .eq("tipo", tipo)
        .maybeSingle();

      if (existing) {
        const { error: vaultErr } = await projteSchema.rpc("vault_delete_secret", {
          secret_id: existing.vault_secret_id,
        });
        if (vaultErr) throw vaultErr;

        await projteSchema.from("ambiente_secrets").delete().eq("id", existing.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action padrão: criar ou rotacionar (upsert)
    if (!valor || typeof valor !== "string" || valor.trim().length === 0) {
      return new Response(JSON.stringify({ error: "valor é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRef } = await projteSchema
      .from("ambiente_secrets")
      .select("id, vault_secret_id")
      .eq("ambiente_id", ambiente_id)
      .eq("tipo", tipo)
      .maybeSingle();

    let vaultSecretId: string;

    if (existingRef) {
      const { error: updateErr } = await projteSchema.rpc("vault_update_secret", {
        secret_id: existingRef.vault_secret_id,
        new_secret: valor,
      });
      if (updateErr) throw updateErr;
      vaultSecretId = existingRef.vault_secret_id;

      await projteSchema
        .from("ambiente_secrets")
        .update({ descricao: descricao || null })
        .eq("id", existingRef.id);
    } else {
      const secretName = `ambiente_${ambiente_id}_${tipo}_${Date.now()}`;
      const { data: newId, error: createErr } = await projteSchema.rpc("vault_create_secret", {
        new_secret: valor,
        new_name: secretName,
        new_description: descricao || "",
      });
      if (createErr) throw createErr;
      vaultSecretId = newId as string;

      const { error: insertErr } = await projteSchema
        .from("ambiente_secrets")
        .insert({ ambiente_id, tipo, vault_secret_id: vaultSecretId, descricao: descricao || null });
      if (insertErr) throw insertErr;
    }

    return new Response(JSON.stringify({ success: true, vault_secret_id: vaultSecretId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[projte-manage-secret] error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
