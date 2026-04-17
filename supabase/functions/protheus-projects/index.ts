import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INTEG_CODIGO = "0002";

async function logIntegration(
  adminClient: ReturnType<typeof createClient>,
  codigo: string | null,
  payload: unknown,
  status: string,
  message: string,
  httpStatus: number
) {
  try {
    await adminClient.from("integration_logs").insert({
      codigo,
      payload,
      status,
      message,
      http_status: httpStatus,
    });
  } catch (e) {
    console.error("Failed to write integration log:", e);
  }
}

function respond(status: number, body: Record<string, unknown>, headers = corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  let body: any = null;

  try {
    // 1. Validate API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      const msg = "API key ausente";
      await logIntegration(adminClient, INTEG_CODIGO, null, "error", msg, 401);
      return respond(401, { success: false, error: msg });
    }

    const { data: integRow } = await adminClient
      .from("protheus_integracoes")
      .select("api_key, ativo")
      .eq("codigo", INTEG_CODIGO)
      .single();

    if (!integRow || integRow.api_key !== apiKey || !integRow.ativo) {
      const msg = "API key inválida ou integração inativa";
      await logIntegration(adminClient, INTEG_CODIGO, null, "error", msg, 401);
      return respond(401, { success: false, error: msg });
    }

    // 2. Parse body
    body = await req.json();
    const { projeto, despesas, atividades } = body;

    // 3. Validate projeto
    if (!projeto) {
      const msg = "Campo 'projeto' é obrigatório";
      await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 400);
      return respond(400, { success: false, error: msg });
    }

    const requiredFields = ["codigo_cliente", "nome_cliente", "coordenador_cliente", "total_horas", "deslocamento"];
    for (const field of requiredFields) {
      if (projeto[field] === undefined || projeto[field] === null || projeto[field] === "") {
        const msg = `Campo obrigatório ausente: projeto.${field}`;
        await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 400);
        return respond(400, { success: false, error: msg });
      }
    }

    // 4. Validate atividades (at least 1)
    if (!Array.isArray(atividades) || atividades.length === 0) {
      const msg = "É necessário ao menos 1 atividade";
      await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 400);
      return respond(400, { success: false, error: msg });
    }

    for (let i = 0; i < atividades.length; i++) {
      const atv = atividades[i];
      for (const field of ["codigo", "descricao", "horas"]) {
        if (atv[field] === undefined || atv[field] === null || atv[field] === "") {
          const msg = `Campo obrigatório ausente: atividades[${i}].${field}`;
          await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 400);
          return respond(400, { success: false, error: msg });
        }
      }
      if (Array.isArray(atv.itens_cronograma)) {
        for (let j = 0; j < atv.itens_cronograma.length; j++) {
          const item = atv.itens_cronograma[j];
          for (const field of ["codigo", "descricao", "horas"]) {
            if (item[field] === undefined || item[field] === null || item[field] === "") {
              const msg = `Campo obrigatório ausente: atividades[${i}].itens_cronograma[${j}].${field}`;
              await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 400);
              return respond(400, { success: false, error: msg });
            }
          }
        }
      }
    }

    // 5. Validate despesas if present
    if (despesas && Array.isArray(despesas)) {
      for (let i = 0; i < despesas.length; i++) {
        const d = despesas[i];
        for (const field of ["tipo_despesa", "valor_maximo"]) {
          if (d[field] === undefined || d[field] === null || d[field] === "") {
            const msg = `Campo obrigatório ausente: despesas[${i}].${field}`;
            await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 400);
            return respond(400, { success: false, error: msg });
          }
        }
      }
    }

    // 6. Find coordenador by email
    const { data: coordProfile } = await adminClient
      .from("profiles")
      .select("user_id")
      .ilike("email", projeto.coordenador_cliente)
      .maybeSingle();

    // 7. Insert projeto
    const { data: newProjeto, error: projetoErr } = await adminClient
      .from("projetos")
      .insert({
        codigo_cliente: String(projeto.codigo_cliente).toUpperCase(),
        nome_cliente: projeto.nome_cliente,
        coordenador_id: coordProfile?.user_id || null,
        horas_contratadas: Number(projeto.total_horas),
        deslocamento: Number(projeto.deslocamento),
        contato_nome: projeto.nome_contato || null,
        contato_telefone: projeto.contato || null,
        endereco_cliente: projeto.endereco || null,
        site_cliente: projeto.site || null,
        email_contato: projeto.email_contato || null,
        status: "Em planejamento",
      })
      .select("id")
      .single();

    if (projetoErr || !newProjeto) {
      const msg = `Erro ao inserir projeto: ${projetoErr?.message || "desconhecido"}`;
      await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 500);
      // Rollback: nothing to rollback yet
      return respond(500, { success: false, error: msg });
    }

    const projetoId = newProjeto.id;

    // 8. Insert despesas
    if (despesas && Array.isArray(despesas) && despesas.length > 0) {
      const { error: despErr } = await adminClient.from("projeto_despesas").insert(
        despesas.map((d: any) => ({
          projeto_id: projetoId,
          tipo_despesa: d.tipo_despesa,
          valor_maximo: Number(d.valor_maximo),
        }))
      );
      if (despErr) {
        // Rollback
        await adminClient.from("projetos").delete().eq("id", projetoId);
        const msg = `Erro ao inserir despesas: ${despErr.message}`;
        await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 500);
        return respond(500, { success: false, error: msg });
      }
    }

    // 9. Insert atividades
    const { data: insertedAtivs, error: ativErr } = await adminClient
      .from("projeto_atividades")
      .insert(
        atividades.map((a: any) => ({
          projeto_id: projetoId,
          codigo: a.codigo,
          descricao: a.descricao,
          horas: Number(a.horas),
        }))
      )
      .select("id");

    if (ativErr || !insertedAtivs) {
      // Rollback
      await adminClient.from("projeto_despesas").delete().eq("projeto_id", projetoId);
      await adminClient.from("projetos").delete().eq("id", projetoId);
      const msg = `Erro ao inserir atividades: ${ativErr?.message || "desconhecido"}`;
      await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 500);
      return respond(500, { success: false, error: msg });
    }

    // 10. Insert cronograma items
    const allCronogramaInserts: any[] = [];
    for (let i = 0; i < atividades.length; i++) {
      const atv = atividades[i];
      const newAtivId = insertedAtivs[i]?.id;
      if (newAtivId && Array.isArray(atv.itens_cronograma)) {
        for (const item of atv.itens_cronograma) {
          allCronogramaInserts.push({
            atividade_id: newAtivId,
            codigo: item.codigo,
            descricao: item.descricao,
            horas_reservadas: Number(item.horas),
            user_id: coordProfile?.user_id || "00000000-0000-0000-0000-000000000000",
          });
        }
      }
    }

    if (allCronogramaInserts.length > 0) {
      const { error: cronErr } = await adminClient.from("cronograma_itens").insert(allCronogramaInserts);
      if (cronErr) {
        // Rollback
        await adminClient.from("projeto_atividades").delete().eq("projeto_id", projetoId);
        await adminClient.from("projeto_despesas").delete().eq("projeto_id", projetoId);
        await adminClient.from("projetos").delete().eq("id", projetoId);
        const msg = `Erro ao inserir itens de cronograma: ${cronErr.message}`;
        await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 500);
        return respond(500, { success: false, error: msg });
      }
    }

    // 11. Log success
    const successMsg = `Projeto "${projeto.nome_cliente}" criado com sucesso`;
    await logIntegration(adminClient, INTEG_CODIGO, body, "success", successMsg, 201);

    return respond(201, {
      success: true,
      message: successMsg,
      projeto_id: projetoId,
    });
  } catch (err: any) {
    const msg = err?.message || "Erro interno";
    await logIntegration(adminClient, INTEG_CODIGO, body, "error", msg, 500);
    return respond(500, { success: false, error: msg });
  }
});
