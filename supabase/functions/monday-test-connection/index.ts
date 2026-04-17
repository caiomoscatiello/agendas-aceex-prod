import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["monday_api_key", "monday_workspace_id"]);

    const map: Record<string, string> = {};
    (settings || []).forEach((s: any) => { map[s.key] = s.value; });

    const apiKey = map["monday_api_key"]?.trim();
    const workspaceId = map["monday_workspace_id"]?.trim();

    if (!apiKey || !workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "API-Version": "2023-10",
      },
      body: JSON.stringify({
        query: `query { workspaces(ids: [${parseInt(workspaceId)}]) { id name } }`,
      }),
    });

    if (res.status === 401) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key inválida ou Workspace ID não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const workspace = json?.data?.workspaces?.[0];

    if (workspace) {
      return new Response(
        JSON.stringify({ success: true, workspace_name: workspace.name, workspace_id: workspace.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "API Key inválida ou Workspace ID não encontrado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
