import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { requestId, action, atividade, motivoRejeicao, modalidade, totalHoras, itemCronograma } = body;

    if (!requestId || !action) {
      return new Response(JSON.stringify({ error: "requestId e action são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch the request
    const { data: requisicao, error: reqErr } = await adminClient
      .from("requisicoes_agenda")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !requisicao) {
      return new Response(JSON.stringify({ error: "Requisição não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is coordinator of this project
    const { data: projeto } = await adminClient
      .from("projetos")
      .select("id, coordenador_id")
      .eq("nome_cliente", requisicao.cliente)
      .eq("coordenador_id", user.id)
      .maybeSingle();

    // Also allow admins
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (!projeto && !isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile of the requester for the agenda
    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("name, email")
      .eq("user_id", requisicao.user_id)
      .single();

    if (!requesterProfile) {
      return new Response(JSON.stringify({ error: "Perfil do solicitante não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "aceitar") {
      if (!atividade) {
        return new Response(JSON.stringify({ error: "Atividade é obrigatória para aceitar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create agenda
      const approvedModalidade = modalidade || requisicao.modalidade || "Remoto";
      const approvedHoras = totalHoras || Number(requisicao.total_horas);
      
      // Check if values match the original request (no changes by coordinator)
      const requestedAtividade = requisicao.atividade || "";
      const requestedModalidade = requisicao.modalidade || "Remoto";
      const requestedHoras = Number(requisicao.total_horas);
      const noChanges = (
        atividade === requestedAtividade &&
        approvedModalidade === requestedModalidade &&
        approvedHoras === requestedHoras
      );

      // Auto-approve only if no changes AND date is in the past (before today)
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const isPastDate = requisicao.data < today;
      const autoApprove = noChanges && isPastDate;
      const agendaStatus = autoApprove ? "apontamento_ok" : "confirmada";

      const { data: newAgenda, error: agendaErr } = await adminClient.from("agendas").insert({
        data: requisicao.data,
        status: agendaStatus,
        atividade: atividade,
        cliente: requisicao.cliente,
        email: requesterProfile.email,
        usuario: requesterProfile.name,
        user_id: requisicao.user_id,
        flag_integracao: "LOVABLE",
        item_cronograma: itemCronograma || null,
      }).select("id, flag_integracao").single();

      if (agendaErr) throw agendaErr;

      // Sync with Protheus (only if origin is LOVABLE)
      if (newAgenda && newAgenda.flag_integracao === "LOVABLE") {
        try {
          await adminClient.functions.invoke("protheus-agenda-sync", {
            body: {
              action: "incluir",
              agendas: [{
                data: requisicao.data,
                cliente: requisicao.cliente,
                user_id: requisicao.user_id,
                atividade: atividade,
                flag_integracao: newAgenda.flag_integracao,
              }],
            },
          });
        } catch (syncErr) {
          console.error("Erro ao sincronizar com Protheus:", syncErr);
        }
      }

      // Sync Monday — fire-and-forget
      if (newAgenda?.id) {
        adminClient.functions.invoke("monday-agenda-sync", {
          body: { action: "create", agenda_id: newAgenda.id },
        }).catch(() => {});
      }

      // Create entrada and saida apontamentos only for past dates (auto-approve flow)
      if (autoApprove) {
        const finalHoras = approvedHoras;
        const startHour = 8;
        const endHour = startHour + Math.floor(finalHoras);
        const endMinutes = Math.round((finalHoras - Math.floor(finalHoras)) * 60);
        const startTime = `${String(startHour).padStart(2, "0")}:00:00`;
        const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;

        const apontamentoBase = {
          data: requisicao.data,
          cliente: requisicao.cliente,
          user_id: requisicao.user_id,
        };

        const { error: aptErr } = await adminClient.from("apontamentos").insert([
          { ...apontamentoBase, tipo: "ENTRADA", hora: startTime },
          { ...apontamentoBase, tipo: "SAIDA", hora: endTime },
        ]);

        if (aptErr) throw aptErr;
      }

      // If auto-approved, also create apontamento_atividades record
      if (autoApprove && newAgenda) {
        const atividadeParts = atividade.split(" - ");
        const atividadeCodigo = atividadeParts[0]?.trim() || atividade;
        const atividadeDescricao = atividadeParts.slice(1).join(" - ").trim() || atividade;

        await adminClient.from("apontamento_atividades").insert({
          agenda_id: newAgenda.id,
          user_id: requisicao.user_id,
          data: requisicao.data,
          cliente: requisicao.cliente,
          atividade_codigo: atividadeCodigo,
          atividade_descricao: atividadeDescricao,
          horas: approvedHoras,
          modalidade: approvedModalidade,
          descricao: "Apontamento automático - aprovado sem alterações",
        });
      }

      // Update requisicao status with approved values
      await adminClient
        .from("requisicoes_agenda")
        .update({ 
          status: "aprovada",
          atividade: atividade,
          modalidade: approvedModalidade,
          total_horas: approvedHoras,
        })
        .eq("id", requestId);

      const msg = autoApprove
        ? "Agenda criada e apontamento aprovado automaticamente"
        : "Agenda criada com sucesso";

      return new Response(JSON.stringify({ success: true, message: msg, autoApproved: autoApprove }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "declinar") {
      if (!motivoRejeicao) {
        return new Response(JSON.stringify({ error: "Motivo da rejeição é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create agenda with REJEITADA status
      const { error: agendaErr } = await adminClient.from("agendas").insert({
        data: requisicao.data,
        status: "REJEITADA",
        atividade: "Requisição rejeitada: " + motivoRejeicao,
        cliente: requisicao.cliente,
        email: requesterProfile.email,
        usuario: requesterProfile.name,
        user_id: requisicao.user_id,
      });

      if (agendaErr) throw agendaErr;

      // Update requisicao status
      await adminClient
        .from("requisicoes_agenda")
        .update({ status: "rejeitada", motivo_rejeicao: motivoRejeicao })
        .eq("id", requestId);

      return new Response(JSON.stringify({ success: true, message: "Requisição declinada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
