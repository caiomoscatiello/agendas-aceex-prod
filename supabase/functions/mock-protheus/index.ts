import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-origem-integracao",
};

/**
 * mock-protheus — Simulador do Protheus ERP para testes de integração
 * 
 * Simula o comportamento do endpoint Protheus que recebe agendas do Aceex.
 * Responde dinamicamente com total_processado = items.length.
 * 
 * Endpoints simulados:
 *   POST /mock-protheus  { action: "incluir"|"excluir", items: [...] }
 * 
 * Autenticação: x-api-key validada contra protheus_integracoes código 0003
 * Origem: x-origem-integracao deve ser APP
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const apiKey = req.headers.get("x-api-key") || "";

    const { data: integracao } = await supabase
      .from("protheus_integracoes")
      .select("api_key, ativo")
      .eq("codigo", "0003")
      .eq("ativo", true)
      .maybeSingle();

    if (!integracao || integracao.api_key !== apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key inválida ou integração inativa" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { action, items } = body;

    if (!action || !["incluir", "excluir"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "action deve ser 'incluir' ou 'excluir'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "items é obrigatório e deve ser um array não vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Simular processamento ──────────────────────────────────────────────
    // Loga o recebimento para rastreabilidade
    await supabase.from("integration_logs").insert({
      codigo: action === "incluir" ? "0003" : "0004",
      status: "success",
      message: `[MOCK] Protheus simulado recebeu ${items.length} item(s) — action: ${action}`,
      http_status: 200,
      payload: { simulado: true, action, items },
    });

    // ── 4. Resposta dinâmica ─────────────────────────────────────────────────
    const response = {
      success: true,
      total_processado: items.length,      // dinâmico — sempre igual ao enviado
      action,
      simulado: true,
      mensagem: `[MOCK] ${items.length} agenda(s) ${action === "incluir" ? "incluída(s)" : "excluída(s)"} com sucesso no Protheus simulado`,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("mock-protheus error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
