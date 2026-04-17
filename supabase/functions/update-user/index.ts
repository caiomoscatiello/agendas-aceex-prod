import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "coordenador"])
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, new_role, new_name, new_codigo, new_contato } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check target user's current role
    const { data: targetRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .single();

    // Coordenador cannot edit admin users
    if (callerRole.role === "coordenador" && targetRole?.role === "admin") {
      return new Response(JSON.stringify({ error: "Coordenadores não podem editar usuários admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Coordenador cannot set role to admin
    if (callerRole.role === "coordenador" && new_role === "admin") {
      return new Response(JSON.stringify({ error: "Apenas admins podem atribuir o papel admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update name if provided
    if (new_name) {
      await adminClient.from("profiles").update({ name: new_name }).eq("user_id", user_id);
      await adminClient.auth.admin.updateUserById(user_id, {
        user_metadata: { name: new_name },
      });
    }

    // Update codigo if provided
    if (new_codigo !== undefined) {
      await adminClient.from("profiles").update({ codigo: new_codigo }).eq("user_id", user_id);
    }

    // Update contato if provided
    if (new_contato !== undefined) {
      await adminClient.from("profiles").update({ contato: new_contato }).eq("user_id", user_id);
    }

    // Update role if provided
    if (new_role) {
      const validRoles = ["consultor", "coordenador", "admin"];
      if (!validRoles.includes(new_role)) {
        return new Response(JSON.stringify({ error: "Role inválida." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.from("user_roles").update({ role: new_role }).eq("user_id", user_id);
    }

    return new Response(JSON.stringify({ success: true, message: "Usuário atualizado." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
