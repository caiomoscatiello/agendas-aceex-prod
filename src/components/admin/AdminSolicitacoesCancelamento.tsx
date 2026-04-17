import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

type Solicitacao = {
  id: string;
  agenda_id: string;
  user_id: string;
  justificativa: string;
  status: string;
  created_at: string;
  agenda_cliente?: string;
  agenda_data?: string;
  agenda_atividade?: string;
  usuario_nome?: string;
  usuario_email?: string;
};

export default function AdminSolicitacoesCancelamento() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadSolicitacoes();
  }, []);

  const loadSolicitacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_cancelamento")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Enrich with agenda and user info
    const enriched: Solicitacao[] = [];
    for (const s of data || []) {
      const [agRes, profRes] = await Promise.all([
        supabase.from("agendas").select("cliente, data, atividade").eq("id", s.agenda_id).single(),
        supabase.from("profiles").select("name, email").eq("user_id", s.user_id).single(),
      ]);
      enriched.push({
        ...s,
        agenda_cliente: agRes.data?.cliente,
        agenda_data: agRes.data?.data,
        agenda_atividade: agRes.data?.atividade,
        usuario_nome: profRes.data?.name,
        usuario_email: profRes.data?.email,
      });
    }
    setSolicitacoes(enriched);
    setLoading(false);
  };

  const handleAceitar = async (sol: Solicitacao) => {
    setActionLoading(sol.id);

    // Fetch agenda data before deleting (for Protheus sync)
    const { data: agendaData } = await supabase
      .from("agendas")
      .select("id, data, cliente, user_id, atividade, flag_integracao")
      .eq("id", sol.agenda_id)
      .single();

    // Sync Monday — cancelar subitem antes de deletar (fire-and-forget)
    supabase.functions.invoke("monday-agenda-sync", {
      body: { action: "cancel", agenda_id: sol.agenda_id },
    }).catch(() => {});

    // Delete the agenda
    const { error: delError } = await supabase.from("agendas").delete().eq("id", sol.agenda_id);
    if (delError) {
      toast({ title: "Erro ao excluir agenda", description: delError.message, variant: "destructive" });
      setActionLoading(null);
      return;
    }

    // Sync exclusion with Protheus (API 0004)
    if (agendaData) {
      supabase.functions.invoke("protheus-agenda-sync", {
        body: {
          action: "excluir",
          agendas: [{
            data: agendaData.data,
            cliente: agendaData.cliente,
            user_id: agendaData.user_id,
            atividade: agendaData.atividade,
            flag_integracao: agendaData.flag_integracao,
          }],
        },
      }).catch((err) => console.error("Erro ao sincronizar exclusão com Protheus:", err));
    }

    // Update solicitacao status - teste
    await supabase.from("solicitacoes_cancelamento").update({ status: "aceita" }).eq("id", sol.id);
    toast({ title: "Agenda cancelada com sucesso" });
    setActionLoading(null);
    await loadSolicitacoes();
  };

  const handleDeclinar = async (sol: Solicitacao) => {
    setActionLoading(sol.id);
    // Return agenda to confirmada
    await supabase.from("agendas").update({ status: "confirmada" }).eq("id", sol.agenda_id);

    // Sync Monday — fire-and-forget
    supabase.functions.invoke("monday-agenda-sync", {
      body: { action: "update", agenda_id: sol.agenda_id },
    }).catch(() => {});

    // Update solicitacao status
    await supabase.from("solicitacoes_cancelamento").update({ status: "declinada" }).eq("id", sol.id);
    toast({ title: "Solicitação declinada", description: "Agenda retornada ao status Confirmada." });
    setActionLoading(null);
    await loadSolicitacoes();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solicitações de Cancelamento</CardTitle>
      </CardHeader>
      <CardContent>
        {solicitacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="space-y-3">
            {solicitacoes.map((sol) => (
              <div key={sol.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{sol.agenda_cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      {sol.agenda_data ? format(parseISO(sol.agenda_data), "dd/MM/yyyy") : ""} — {sol.agenda_atividade}
                    </p>
                  </div>
                  <Badge className="bg-orange-500 text-white text-xs">Pendente</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Consultor: {sol.usuario_nome || sol.usuario_email}
                </p>
                <div className="rounded bg-muted p-2">
                  <p className="text-xs"><strong>Justificativa:</strong> {sol.justificativa}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleAceitar(sol)}
                    disabled={actionLoading === sol.id}
                  >
                    {actionLoading === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => handleDeclinar(sol)}
                    disabled={actionLoading === sol.id}
                  >
                    <X className="h-3 w-3" />
                    Declinar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
