import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

type Requisicao = {
  id: string;
  user_id: string;
  cliente: string;
  coordenador: string;
  data: string;
  total_horas: number;
  created_at: string;
  status: string;
  atividade?: string;
  modalidade?: string;
  consultor_nome?: string;
  descricao_atividade?: string;
  justificativa?: string;
};

type Atividade = {
  id: string;
  codigo: string;
  descricao: string;
  horas: number;
  horasAprovadas: number;
  saldo: number;
  percentual: number;
};

type CronogramaItem = {
  id: string;
  codigo: string;
  descricao: string;
  horas_reservadas: number;
  user_id: string;
};

export default function AdminPendentes() {
  const { toast } = useToast();
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Accept dialog
  const [acceptDialog, setAcceptDialog] = useState<Requisicao | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [selectedAtividade, setSelectedAtividade] = useState("");
  const [loadingAtividades, setLoadingAtividades] = useState(false);
  const [acceptModalidade, setAcceptModalidade] = useState("Remoto");
  const [acceptHoras, setAcceptHoras] = useState("");
  const [cronogramaItens, setCronogramaItens] = useState<CronogramaItem[]>([]);
  const [selectedCronogramaItem, setSelectedCronogramaItem] = useState("");

  // Decline dialog
  const [declineDialog, setDeclineDialog] = useState<Requisicao | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const fetchRequisicoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("requisicoes_agenda")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar requisições", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch consultant names
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.name]) || []);
      const enriched = data.map((r) => ({
        ...r,
        consultor_nome: profileMap.get(r.user_id) || "Desconhecido",
      }));
      setRequisicoes(enriched);
    } else {
      setRequisicoes([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequisicoes();
  }, []);

  const openAcceptDialog = async (req: Requisicao) => {
    setAcceptDialog(req);
    setSelectedAtividade("");
    setSelectedCronogramaItem("");
    setCronogramaItens([]);
    setAcceptModalidade(req.modalidade || "Remoto");
    setAcceptHoras(String(req.total_horas || ""));
    setLoadingAtividades(true);

    const { data: projetos } = await supabase
      .from("projetos")
      .select("id")
      .eq("nome_cliente", req.cliente)
      .maybeSingle();

    if (projetos) {
      const { data: ativs } = await supabase
        .from("projeto_atividades")
        .select("id, codigo, descricao, horas")
        .eq("projeto_id", projetos.id);

      // Fetch approved hours from apontamento_atividades (effective hours)
      const { data: agendasAprovadas } = await supabase
        .from("agendas")
        .select("id, status")
        .eq("cliente", req.cliente)
        .in("status", ["apontamento_ok", "apontamento_ajustado"]);

      const approvedAgendaIds = new Set(agendasAprovadas?.map((a) => a.id) || []);

      const { data: apontAprovados } = await supabase
        .from("apontamento_atividades")
        .select("atividade_codigo, horas, agenda_id")
        .eq("cliente", req.cliente);

      const horasEfetivasMap = new Map<string, number>();
      (apontAprovados || []).forEach((ap) => {
        if (approvedAgendaIds.has(ap.agenda_id)) {
          horasEfetivasMap.set(ap.atividade_codigo, (horasEfetivasMap.get(ap.atividade_codigo) || 0) + Number(ap.horas));
        }
      });

      // Fetch planned hours from active agendas (confirmada, pendente, apontamento_ok, apontamento_ajustado)
      const { data: agendasAtivas } = await supabase
        .from("agendas")
        .select("atividade, status")
        .eq("cliente", req.cliente)
        .not("status", "in", '("REJEITADA","cancelada")');

      const horasPlanejadasMap = new Map<string, number>();
      (agendasAtivas || []).forEach((ag) => {
        // Extract activity code from "CODE - Description" format
        const code = ag.atividade?.split(" - ")[0]?.trim();
        if (code) {
          horasPlanejadasMap.set(code, (horasPlanejadasMap.get(code) || 0) + 8);
        }
      });

      const enriched: Atividade[] = (ativs || []).map((a) => {
        const horasEfetivas = horasEfetivasMap.get(a.codigo) || 0;
        const horasPlanejadas = horasPlanejadasMap.get(a.codigo) || 0;
        const horasConsumidas = Math.max(horasEfetivas, horasPlanejadas);
        const saldo = Math.max(0, Number(a.horas) - horasConsumidas);
        const percentual = Number(a.horas) > 0 ? Math.min(100, (horasConsumidas / Number(a.horas)) * 100) : 0;
        return { ...a, horas: Number(a.horas), horasAprovadas: horasConsumidas, saldo, percentual };
      });

      setAtividades(enriched);

      // Pre-select matching activity from request
      if (req.atividade) {
        const match = enriched.find((a) => `${a.codigo} - ${a.descricao}` === req.atividade || a.codigo === req.atividade);
        if (match) {
          setSelectedAtividade(match.id);
          loadCronogramaItens(match.id);
        }
      }
    } else {
      setAtividades([]);
    }
    setLoadingAtividades(false);
  };

  // Load cronograma items when activity changes
  const loadCronogramaItens = async (atividadeId: string) => {
    setSelectedCronogramaItem("");
    setCronogramaItens([]);
    if (!atividadeId) return;

    const { data } = await supabase
      .from("cronograma_itens")
      .select("id, codigo, descricao, horas_reservadas, user_id")
      .eq("atividade_id", atividadeId);

    setCronogramaItens(data || []);
  };

  const handleAtividadeChange = (value: string) => {
    setSelectedAtividade(value);
    loadCronogramaItens(value);
  };

  const handleAccept = async () => {
    if (!acceptDialog || !selectedAtividade) return;
    setProcessing(true);

    const atv = atividades.find((a) => a.id === selectedAtividade);
    const atividadeLabel = atv ? `${atv.codigo} - ${atv.descricao}` : selectedAtividade;

    const cronItem = cronogramaItens.find((c) => c.id === selectedCronogramaItem);
    const itemCronogramaLabel = cronItem ? `${cronItem.codigo} - ${cronItem.descricao}` : undefined;

    const { data, error } = await supabase.functions.invoke("process-agenda-request", {
      body: {
        requestId: acceptDialog.id,
        action: "aceitar",
        atividade: atividadeLabel,
        modalidade: acceptModalidade,
        totalHoras: parseFloat(acceptHoras) || acceptDialog.total_horas,
        itemCronograma: itemCronogramaLabel,
      },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao aceitar", description: data?.error || error?.message, variant: "destructive" });
    } else {
      const msg = data?.autoApproved
        ? "Agenda aprovada e apontamento realizado automaticamente"
        : "Agenda aprovada com sucesso";
      toast({ title: msg });
      setAcceptDialog(null);
      fetchRequisicoes();
    }
    setProcessing(false);
  };

  const handleDecline = async () => {
    if (!declineDialog || !motivoRejeicao.trim()) return;
    setProcessing(true);

    const { data, error } = await supabase.functions.invoke("process-agenda-request", {
      body: {
        requestId: declineDialog.id,
        action: "declinar",
        motivoRejeicao: motivoRejeicao.trim(),
      },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao declinar", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Requisição declinada" });
      setDeclineDialog(null);
      setMotivoRejeicao("");
      fetchRequisicoes();
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Requisições Pendentes</CardTitle>
      </CardHeader>
      <CardContent>
        {requisicoes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma requisição pendente.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Data Agenda</TableHead>
                  <TableHead>Data Solicitada</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisicoes.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.consultor_nome}</TableCell>
                    <TableCell>{format(parseISO(req.data), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(parseISO(req.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{req.cliente}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{req.total_horas}h</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="default" className="gap-1" onClick={() => openAcceptDialog(req)}>
                        <Check className="h-3 w-3" /> Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => {
                          setDeclineDialog(req);
                          setMotivoRejeicao("");
                        }}
                      >
                        <X className="h-3 w-3" /> Declinar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Accept Dialog */}
        <Dialog open={!!acceptDialog} onOpenChange={(open) => !open && setAcceptDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aceitar Requisição</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Consultor: <strong>{acceptDialog?.consultor_nome}</strong></p>
                <p className="text-sm text-muted-foreground mb-1">Projeto: <strong>{acceptDialog?.cliente}</strong></p>
                <p className="text-sm text-muted-foreground mb-1">Horas solicitadas: <strong>{acceptDialog?.total_horas}h</strong></p>
                <p className="text-sm text-muted-foreground">Modalidade solicitada: <strong>{acceptDialog?.modalidade || "Remoto"}</strong></p>
                {acceptDialog?.atividade && (
                  <p className="text-sm text-muted-foreground">Atividade solicitada: <strong>{acceptDialog.atividade}</strong></p>
                )}
                {acceptDialog?.descricao_atividade && (
                  <div className="mt-2 p-2 rounded bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground">Descrição da Atividade:</p>
                    <p className="text-sm whitespace-pre-wrap">{acceptDialog.descricao_atividade}</p>
                  </div>
                )}
                {acceptDialog?.justificativa && (
                  <div className="mt-1 p-2 rounded bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground">Justificativa:</p>
                    <p className="text-sm whitespace-pre-wrap">{acceptDialog.justificativa}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Atividade *</label>
                {loadingAtividades ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : atividades.length === 0 ? (
                  <p className="text-sm text-destructive">Nenhuma atividade cadastrada para este projeto.</p>
                ) : (
                  <Select value={selectedAtividade} onValueChange={handleAtividadeChange}>
                    <SelectTrigger className="h-auto min-h-[2.5rem] py-2 w-full text-left [&>span]:text-left [&>span]:whitespace-normal [&>span]:line-clamp-none [&>span]:overflow-visible">
                      <SelectValue placeholder="Selecione a atividade" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[420px]">
                      {atividades.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-left">
                          <div className="flex flex-col gap-1 w-full text-left">
                            <span className="text-left whitespace-normal break-words">{a.codigo} - {a.descricao}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Saldo: {a.saldo}h</span>
                              <span>•</span>
                              <span>{a.percentual.toFixed(0)}%</span>
                              <Progress value={a.percentual} className="h-1.5 w-16" />
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {cronogramaItens.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Cronograma</label>
                  <Select value={selectedCronogramaItem} onValueChange={setSelectedCronogramaItem}>
                    <SelectTrigger className="h-auto min-h-[2.5rem] py-2 w-full text-left [&>span]:text-left [&>span]:whitespace-normal [&>span]:line-clamp-none [&>span]:overflow-visible">
                      <SelectValue placeholder="Selecione um item (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[420px]">
                      {cronogramaItens.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-left">
                          <div className="flex flex-col gap-1 w-full text-left">
                            <span className="text-left whitespace-normal break-words">{c.codigo} - {c.descricao}</span>
                            <span className="text-xs text-muted-foreground">Horas reservadas: {c.horas_reservadas}h</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Modalidade *</label>
                <Select value={acceptModalidade} onValueChange={setAcceptModalidade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remoto">Remoto</SelectItem>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total de Horas *</label>
                <Input type="number" step="0.5" value={acceptHoras} onChange={(e) => setAcceptHoras(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAcceptDialog(null)}>Cancelar</Button>
              <Button onClick={handleAccept} disabled={!selectedAtividade || processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline Dialog */}
        <Dialog open={!!declineDialog} onOpenChange={(open) => !open && setDeclineDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Declinar Requisição</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Consultor: <strong>{declineDialog?.consultor_nome}</strong></p>
                <p className="text-sm text-muted-foreground">Projeto: <strong>{declineDialog?.cliente}</strong></p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo da rejeição *</label>
                <Textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Informe o motivo..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeclineDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDecline} disabled={!motivoRejeicao.trim() || processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Declinar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
