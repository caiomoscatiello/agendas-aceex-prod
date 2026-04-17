import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "coordenador";

type Profile = {
  user_id: string;
  name: string;
  email: string;
};

type Agenda = {
  id: string;
  usuario: string;
  email: string;
  cliente: string;
  data: string;
  atividade: string;
  status: string;
};

async function getCallerRole(adminClient: ReturnType<typeof createClient>, callerId: string): Promise<Role | null> {
  const { data, error } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["admin", "coordenador"])
    .single();

  if (error || !data?.role) return null;
  return data.role as Role;
}

async function getCoordinatorClients(
  adminClient: ReturnType<typeof createClient>,
  coordinatorId: string,
): Promise<string[]> {
  const { data, error } = await adminClient.from("projetos").select("nome_cliente").eq("coordenador_id", coordinatorId);

  if (error) throw error;
  return (data ?? []).map((p) => p.nome_cliente).filter(Boolean);
}

async function listConsultantsForCoordinator(
  adminClient: ReturnType<typeof createClient>,
  coordinatorId: string,
): Promise<Profile[]> {
  const clientes = await getCoordinatorClients(adminClient, coordinatorId);
  if (clientes.length === 0) return [];

  const { data: agendasData, error: agendasErr } = await adminClient
    .from("agendas")
    .select("user_id")
    .in("cliente", clientes);

  if (agendasErr) throw agendasErr;
  const uniqueUserIds = [...new Set((agendasData ?? []).map((a) => a.user_id).filter(Boolean))];
  if (uniqueUserIds.length === 0) return [];

  const { data: consultores, error: rolesErr } = await adminClient
    .from("user_roles")
    .select("user_id")
    .in("user_id", uniqueUserIds)
    .eq("role", "consultor");

  if (rolesErr) throw rolesErr;
  const consultorIds = [...new Set((consultores ?? []).map((r) => r.user_id))];
  if (consultorIds.length === 0) return [];

  const { data: profiles, error: profilesErr } = await adminClient
    .from("profiles")
    .select("user_id, name, email")
    .in("user_id", consultorIds)
    .order("name");

  if (profilesErr) throw profilesErr;
  return (profiles ?? []) as Profile[];
}

async function listAllConsultants(adminClient: ReturnType<typeof createClient>): Promise<Profile[]> {
  const { data: consultores, error: rolesErr } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("role", "consultor");

  if (rolesErr) throw rolesErr;
  const consultorIds = [...new Set((consultores ?? []).map((r) => r.user_id))];
  if (consultorIds.length === 0) return [];

  const { data: profiles, error: profilesErr } = await adminClient
    .from("profiles")
    .select("user_id, name, email")
    .in("user_id", consultorIds)
    .order("name");

  if (profilesErr) throw profilesErr;
  return (profiles ?? []) as Profile[];
}

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
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const callerRole = await getCallerRole(adminClient, caller.id);

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    // ── list_consultants ──
    if (action === "list_consultants") {
      const profiles =
        callerRole === "admin"
          ? await listAllConsultants(adminClient)
          : await listConsultantsForCoordinator(adminClient, caller.id);

      return new Response(JSON.stringify({ success: true, profiles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── list_projects ──
    if (action === "list_projects") {
      let projects: { id: string; nome_cliente: string }[];

      if (callerRole === "admin") {
        const { data, error } = await adminClient.from("projetos").select("id, nome_cliente").order("nome_cliente");
        if (error) throw error;
        projects = data ?? [];
      } else {
        const { data, error } = await adminClient
          .from("projetos")
          .select("id, nome_cliente")
          .eq("coordenador_id", caller.id)
          .order("nome_cliente");
        if (error) throw error;
        projects = data ?? [];
      }

      return new Response(JSON.stringify({ success: true, projects }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── search_agendas ── (now supports optional user_id + optional cliente)
    if (action === "search_agendas") {
      const targetUserId = body?.user_id as string | undefined;
      const cliente = body?.cliente as string | undefined;
      const startDate = body?.start_date as string | undefined;
      const endDate = body?.end_date as string | undefined;

      if (!startDate || !endDate) {
        return new Response(JSON.stringify({ error: "start_date e end_date são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!targetUserId && !cliente) {
        return new Response(JSON.stringify({ error: "Informe ao menos um consultor ou projeto." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Coordinator scope
      let coordClientes: string[] | null = null;
      if (callerRole === "coordenador") {
        coordClientes = await getCoordinatorClients(adminClient, caller.id);
        if (coordClientes.length === 0) {
          return new Response(JSON.stringify({ success: true, agendas: [] as Agenda[] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (cliente && !coordClientes.includes(cliente)) {
          return new Response(JSON.stringify({ success: true, agendas: [] as Agenda[] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // 1) Search agendas table
      let q = adminClient
        .from("agendas")
        .select(
          "id, usuario, email, cliente, data, atividade, status, user_id, monday_item_id, item_cronograma, flag_integracao",
        )
        //        .select("id, usuario, email, cliente, data, atividade, status")
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data");

      if (targetUserId) q = q.eq("user_id", targetUserId);
      if (cliente) q = q.eq("cliente", cliente);
      if (callerRole === "coordenador" && !cliente && coordClientes) {
        q = q.in("cliente", coordClientes);
      }

      const { data: agendasData, error: agendasErr } = await q;
      if (agendasErr) throw agendasErr;

      const agendasResult = (agendasData ?? []).map((a) => ({
        ...a,
        origem: "agendas" as const,
      }));

      // 2) Search requisicoes_agenda table (pending requests)
      let qReq = adminClient
        .from("requisicoes_agenda")
        .select("id, user_id, cliente, data, atividade, status, modalidade, total_horas, coordenador")
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data");

      if (targetUserId) qReq = qReq.eq("user_id", targetUserId);
      if (cliente) qReq = qReq.eq("cliente", cliente);
      if (callerRole === "coordenador" && !cliente && coordClientes) {
        qReq = qReq.in("cliente", coordClientes);
      }

      const { data: reqData, error: reqErr } = await qReq;
      if (reqErr) throw reqErr;

      // Get profile names for requisicoes
      const reqUserIds = [...new Set((reqData ?? []).map((r) => r.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (reqUserIds.length > 0) {
        const { data: profs } = await adminClient
          .from("profiles")
          .select("user_id, name, email")
          .in("user_id", reqUserIds);
        for (const p of profs ?? []) {
          profileMap[p.user_id] = p.name;
        }
      }

      const reqResult = (reqData ?? []).map((r) => ({
        id: r.id,
        usuario: profileMap[r.user_id] || "Desconhecido",
        email: "",
        cliente: r.cliente,
        data: r.data,
        atividade: r.atividade || "Aguardando aprovação",
        status: r.status === "pendente" ? "aguard_aprovacao" : r.status,
        origem: "requisicoes_agenda" as const,
      }));

      const combined = [...agendasResult, ...reqResult].sort((a, b) => a.data.localeCompare(b.data));

      return new Response(JSON.stringify({ success: true, agendas: combined }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── delete_agendas ──
    if (action === "delete_agendas") {
      const ids = (body?.ids as string[] | undefined) ?? [];
      const reqIds = (body?.requisicao_ids as string[] | undefined) ?? [];

      if ((!Array.isArray(ids) || ids.length === 0) && (!Array.isArray(reqIds) || reqIds.length === 0)) {
        return new Response(JSON.stringify({ error: "ids ou requisicao_ids é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let deletedAgendas = 0;
      let deletedReqs = 0;
      let skipped = 0;

      // Delete from agendas table
      if (ids.length > 0) {
        let idsToDelete = ids;

        if (callerRole === "coordenador") {
          const clientes = await getCoordinatorClients(adminClient, caller.id);
          if (clientes.length === 0) {
            skipped += ids.length;
          } else {
            const { data: allowed, error: allowedErr } = await adminClient
              .from("agendas")
              .select("id")
              .in("id", ids)
              .in("cliente", clientes);
            if (allowedErr) throw allowedErr;
            idsToDelete = (allowed ?? []).map((a) => a.id);
            skipped += ids.length - idsToDelete.length;
          }
        }

        if (idsToDelete.length > 0) {
          const { data: agendasToDelete } = await adminClient
            .from("agendas")
            .select("id, data, cliente, user_id, atividade, flag_integracao, monday_item_id")
            .in("id", idsToDelete);

          const { error: delErr } = await adminClient.from("agendas").delete().in("id", idsToDelete);
          if (delErr) throw delErr;

          deletedAgendas = idsToDelete.length;

          const toSync = (agendasToDelete || []).map((a) => ({
            data: a.data,
            cliente: a.cliente,
            user_id: a.user_id,
            atividade: a.atividade,
            flag_integracao: a.flag_integracao,
          }));

          if (toSync.length > 0) {
            try {
              await adminClient.functions.invoke("protheus-agenda-sync", {
                body: { action: "excluir", agendas: toSync },
              });
            } catch (syncErr) {
              console.error("Erro ao sincronizar exclusão com Protheus:", syncErr);
            }
          }

          // Sync Monday — arquivar subitens deletados (fire-and-forget)
          for (const ag of agendasToDelete || []) {
            if (ag.monday_item_id) {
              adminClient.functions
                .invoke("monday-agenda-sync", {
                  body: { action: "delete", agenda_id: ag.id, monday_item_id: ag.monday_item_id },
                })
                .catch(() => {});
            }
          }
        }
      }

      // Delete from requisicoes_agenda table
      if (reqIds.length > 0) {
        let reqIdsToDelete = reqIds;

        if (callerRole === "coordenador") {
          const clientes = await getCoordinatorClients(adminClient, caller.id);
          if (clientes.length === 0) {
            skipped += reqIds.length;
          } else {
            const { data: allowed, error: allowedErr } = await adminClient
              .from("requisicoes_agenda")
              .select("id")
              .in("id", reqIds)
              .in("cliente", clientes);
            if (allowedErr) throw allowedErr;
            reqIdsToDelete = (allowed ?? []).map((a) => a.id);
            skipped += reqIds.length - reqIdsToDelete.length;
          }
        }

        if (reqIdsToDelete.length > 0) {
          const { error: delErr } = await adminClient.from("requisicoes_agenda").delete().in("id", reqIdsToDelete);
          if (delErr) throw delErr;
          deletedReqs = reqIdsToDelete.length;
        }
      }

      const totalDeleted = deletedAgendas + deletedReqs;

      return new Response(
        JSON.stringify({
          success: true,
          deleted: totalDeleted,
          skipped,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
