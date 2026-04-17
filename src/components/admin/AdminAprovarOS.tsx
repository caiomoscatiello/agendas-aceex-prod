import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";
//alterar
type AgendaOS = {
  id: string;
  data: string;
  cliente: string;
  usuario: string;
  user_id: string;
  atividade: string;
  status: string;
  email: string;
  item_cronograma?: string;
  codigo_cliente?: string;
};

type Apontamento = {
  id: string;
  data: string;
  hora: string;
  tipo: string;
  user_id: string;
  cliente: string;
  endereco: string | null;
};

export default function AdminAprovarOS() {
  const { user, role } = useAuth();
  const [agendas, setAgendas] = useState<AgendaOS[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; nome_cliente: string; coordenador_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");
  const [filterConsultor, setFilterConsultor] = useState("todos");
  const [filterProjeto, setFilterProjeto] = useState("todos");

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectAgendaId, setRejectAgendaId] = useState<string | null>(null);
  const [rejectJustificativa, setRejectJustificativa] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAgenda, setEditAgenda] = useState<AgendaOS | null>(null);
  const [editAtividade, setEditAtividade] = useState("");
  const [editData, setEditData] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [projRes, agRes] = await Promise.all([
      supabase.from("projetos").select("id, nome_cliente, coordenador_id"),
      supabase
        .from("agendas")
        .select("id, data, cliente, usuario, user_id, atividade, status, email, item_cronograma, codigo_cliente")
        .eq("status", "em_aprovacao"),
    ]);

    const allProjetos = projRes.data || [];
    setProjetos(allProjetos);

    // Filter by coordinator projects (unless admin)
    let filteredAgendas = agRes.data || [];
    if (role === "coordenador") {
      const myProjects = allProjetos.filter((p) => p.coordenador_id === user?.id).map((p) => p.nome_cliente);
      filteredAgendas = filteredAgendas.filter((a) => myProjects.includes(a.cliente));
    }

    setAgendas(filteredAgendas);

    // Load apontamentos for these agendas
    if (filteredAgendas.length > 0) {
      const clients = [...new Set(filteredAgendas.map((a) => a.cliente))];
      const apPromises = clients.map((c) => supabase.from("apontamentos").select("*").eq("cliente", c));
      const apResults = await Promise.all(apPromises);
      const allAps = apResults.flatMap((r) => r.data || []);
      setApontamentos(allAps);
    } else {
      setApontamentos([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Get hours from apontamento_atividades for an agenda
  const [apontAtividades, setApontAtividades] = useState<any[]>([]);

  useEffect(() => {
    const loadApontAtividades = async () => {
      if (agendas.length === 0) {
        setApontAtividades([]);
        return;
      }
      const agendaIds = agendas.map((a) => a.id);
      const { data } = await supabase
        .from("apontamento_atividades" as any)
        .select("*")
        .in("agenda_id", agendaIds);
      setApontAtividades(data || []);
    };
    loadApontAtividades();
  }, [agendas]);

  const getHorasApontadas = (agenda: AgendaOS) => {
    const items = apontAtividades.filter((a: any) => a.agenda_id === agenda.id);
    if (items.length > 0) {
      return items.reduce((sum: number, a: any) => sum + Number(a.horas), 0);
    }
    const dayAps = apontamentos.filter(
      (ap) => ap.data === agenda.data && ap.user_id === agenda.user_id && ap.cliente === agenda.cliente,
    );
    const entrada = dayAps.find((a) => a.tipo === "ENTRADA");
    const saida = dayAps.find((a) => a.tipo === "SAIDA");
    if (entrada && saida) {
      const [eh, em] = entrada.hora.split(":").map(Number);
      const [sh, sm] = saida.hora.split(":").map(Number);
      const diff = (sh * 60 + sm - (eh * 60 + em)) / 60;
      return Math.max(0, Math.round(diff * 10) / 10);
    }
    return 8;
  };

  const getPresencialRemoto = (agenda: AgendaOS) => {
    const items = apontAtividades.filter((a: any) => a.agenda_id === agenda.id);
    if (items.length > 0) {
      return items[0]?.modalidade || "Remoto";
    }
    const dayAps = apontamentos.filter(
      (ap) => ap.data === agenda.data && ap.user_id === agenda.user_id && ap.cliente === agenda.cliente,
    );
    const entrada = dayAps.find((a) => a.tipo === "ENTRADA");
    if (entrada?.endereco && entrada.endereco !== "Localização indisponível") {
      return "Presencial";
    }
    return "Remoto";
  };

  // Filtered list
  const filteredAgendas = useMemo(() => {
    return agendas.filter((ag) => {
      if (filterDataDe && ag.data < filterDataDe) return false;
      if (filterDataAte && ag.data > filterDataAte) return false;
      if (filterConsultor !== "todos" && ag.usuario !== filterConsultor) return false;
      if (filterProjeto !== "todos" && ag.cliente !== filterProjeto) return false;
      return true;
    });
  }, [agendas, filterDataDe, filterDataAte, filterConsultor, filterProjeto]);

  const consultores = useMemo(() => [...new Set(agendas.map((a) => a.usuario))].sort(), [agendas]);
  const projetosFilter = useMemo(() => [...new Set(agendas.map((a) => a.cliente))].sort(), [agendas]);

  const handleAprovar = async (agendaId: string) => {
    // Verificar se item de cronograma exige documento
    const agenda = agendas.find((a) => a.id === agendaId);
    let novoStatus = "apontamento_ok";

    if (agenda?.item_cronograma) {
      const codigoItem = agenda.item_cronograma.split(" - ")[0].trim();
      const { data: ci } = await supabase
        .from("cronograma_itens")
        .select("doc_exigido, doc_satisfeito")
        .ilike("codigo", codigoItem)
        .maybeSingle();

      if (ci?.doc_exigido && !ci?.doc_satisfeito) {
        novoStatus = "doc_pendente"; // Aprovado mas aguarda documento
      }
    }

    const { error } = await supabase.from("agendas").update({ status: novoStatus }).eq("id", agendaId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Sync Monday — fire-and-forget
      supabase.functions
        .invoke("monday-agenda-sync", {
          body: { action: "update", agenda_id: agendaId },
        })
        .catch(() => {});

      // Enviar para Autentique se doc_satisfeito=true (documento já entregue)
      if (novoStatus === "apontamento_ok" && agenda?.item_cronograma) {
        const codigoItem = agenda.item_cronograma.split(" - ")[0].trim();
        const { data: ciCheck } = await supabase
          .from("cronograma_itens")
          .select("id, doc_exigido, doc_satisfeito, doc_referencia, autentique_envelope_id")
          .ilike("codigo", codigoItem)
          .maybeSingle();

        if (
          ciCheck?.doc_exigido &&
          ciCheck?.doc_satisfeito &&
          ciCheck?.doc_referencia &&
          !ciCheck?.autentique_envelope_id
        ) {
          supabase.functions
            .invoke("autentique-send", {
              body: { agenda_id: agendaId, cronograma_item_id: ciCheck.id },
            })
            .catch(() => {});
        }
      }

      const msg =
        novoStatus === "doc_pendente"
          ? "Apontamento aprovado — aguardando entrega do documento."
          : "OS aprovada com sucesso!";
      toast({ title: msg });
      await loadData();
    }
  };

  const handleRejeitar = async () => {
    if (!rejectAgendaId || !rejectJustificativa.trim()) return;
    const { error } = await supabase.from("agendas").update({ status: "confirmada" }).eq("id", rejectAgendaId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Delete the apontamentos for this agenda so the consultant can redo
      const agenda = agendas.find((a) => a.id === rejectAgendaId);
      if (agenda) {
        await supabase
          .from("apontamentos")
          .delete()
          .eq("data", agenda.data)
          .eq("user_id", agenda.user_id)
          .eq("cliente", agenda.cliente);
      }
      toast({ title: "OS recusada", description: "Apontamento retornado para pendente." });
      setRejectOpen(false);
      setRejectJustificativa("");
      setRejectAgendaId(null);
      await loadData();
    }
  };

  const handleOpenEdit = (agenda: AgendaOS) => {
    setEditAgenda(agenda);
    setEditAtividade(agenda.atividade);
    setEditData(agenda.data);
    setEditOpen(true);
  };

  const handleSalvarAlteracao = async () => {
    if (!editAgenda) return;
    const { error } = await supabase
      .from("agendas")
      .update({ atividade: editAtividade, data: editData, status: "apontamento_ajustado" })
      .eq("id", editAgenda.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "OS alterada e ajustada!" });
      setEditOpen(false);
      setEditAgenda(null);
      await loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Data de</Label>
              <Input type="date" value={filterDataDe} onChange={(e) => setFilterDataDe(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data até</Label>
              <Input type="date" value={filterDataAte} onChange={(e) => setFilterDataAte(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Consultor</Label>
              <Select value={filterConsultor} onValueChange={setFilterConsultor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {consultores.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Projeto</Label>
              <Select value={filterProjeto} onValueChange={setFilterProjeto}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {projetosFilter.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredAgendas.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma OS pendente de aprovação.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgendas.map((ag) => (
                  <TableRow key={ag.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(ag.data + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{ag.cliente}</TableCell>
                    <TableCell>{ag.usuario}</TableCell>
                    <TableCell>{ag.atividade}</TableCell>
                    <TableCell>{getHorasApontadas(ag)}h</TableCell>
                    <TableCell>
                      <Badge variant={getPresencialRemoto(ag) === "Presencial" ? "default" : "secondary"}>
                        {getPresencialRemoto(ag)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleAprovar(ag.id)}
                          title="Aprovar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setRejectAgendaId(ag.id);
                            setRejectOpen(true);
                          }}
                          title="Recusar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleOpenEdit(ag)}
                          title="Alterar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar OS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Justificativa</Label>
            <Textarea
              value={rejectJustificativa}
              onChange={(e) => setRejectJustificativa(e.target.value)}
              placeholder="Informe o motivo da recusa..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejeitar} disabled={!rejectJustificativa.trim()}>
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar OS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} />
            </div>
            <div>
              <Label>Atividade</Label>
              <Input value={editAtividade} onChange={(e) => setEditAtividade(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarAlteracao}>Salvar e Ajustar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
