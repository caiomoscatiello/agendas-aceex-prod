// BL-009 -- Edge Function: diario-entry
// Caminho: supabase/functions/diario-entry/index.ts
// Deploy: VSCode -> salvar -> git add . -> git commit -> git push
// Supabase fara o deploy automaticamente via GitHub integration
// Encoding: UTF-8 sem BOM

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Categoria = "geral" | "decisao" | "ocorrencia" | "marco" | "alerta";
type Origem = "coordenador" | "consultor";

type DiarioPayload = {
  action: "insert" | "list";
  projeto_id: string;
  categoria?: Categoria;
  texto?: string;
  origem?: Origem;
  agenda_id?: string | null;
  data?: string;
  limit?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nao autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuario nao autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: DiarioPayload = await req.json();
    const { action, projeto_id } = payload;

    if (!projeto_id) {
      return new Response(JSON.stringify({ error: "projeto_id obrigatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: list
    // -----------------------------------------------------------------------
    if (action === "list") {
      const limit = payload.limit || 50;
      const { data: entradas, error: listError } = await supabase
        .from("projeto_diario")
        .select(`
          id, projeto_id, user_id, data, categoria, texto, origem, agenda_id, created_at,
          profiles!projeto_diario_user_id_fkey(name)
        `)
        .eq("projeto_id", projeto_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ entradas: entradas || [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: insert
    // -----------------------------------------------------------------------
    if (action === "insert") {
      const { categoria, texto, origem, agenda_id, data } = payload;

      if (!texto || texto.trim().length === 0) {
        return new Response(JSON.stringify({ error: "texto obrigatorio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const categoriasValidas: Categoria[] = ["geral", "decisao", "ocorrencia", "marco", "alerta"];
      if (categoria && !categoriasValidas.includes(categoria)) {
        return new Response(JSON.stringify({ error: "categoria invalida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const origensValidas: Origem[] = ["coordenador", "consultor"];
      if (origem && !origensValidas.includes(origem)) {
        return new Response(JSON.stringify({ error: "origem invalida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hoje = new Date().toISOString().split("T")[0];

      const { data: entrada, error: insertError } = await supabase
        .from("projeto_diario")
        .insert({
          projeto_id,
          user_id: user.id,
          data: data || hoje,
          categoria: categoria || "geral",
          texto: texto.trim(),
          origem: origem || "coordenador",
          agenda_id: agenda_id || null,
        })
        .select("id, projeto_id, user_id, data, categoria, texto, origem, agenda_id, created_at")
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ entrada, success: true }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action invalida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
