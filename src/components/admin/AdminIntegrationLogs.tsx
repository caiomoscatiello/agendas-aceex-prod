import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Eye, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface LogEntry {
  id: string;
  timestamp: string;
  codigo: string | null;
  status: string;
  message: string | null;
  http_status: number | null;
  payload: Json | null;
  response: Json | null;
}

export default function AdminIntegrationLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reprocessing, setReprocessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    let query = supabase
      .from("integration_logs")
      .select("id, timestamp, codigo, status, message, http_status, payload, response")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (filter === "success") query = query.eq("status", "success");
    if (filter === "error") query = query.eq("status", "error");

    const { data } = await query;
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  };

  const errorLogs = logs.filter((l) => l.status === "error");
  const allErrorSelected = errorLogs.length > 0 && errorLogs.every((l) => selectedIds.has(l.id));
  const allSelected = logs.length > 0 && logs.every((l) => selectedIds.has(l.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllErrors = () => {
    if (allErrorSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(errorLogs.map((l) => l.id)));
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((l) => l.id)));
    }
  };

  const handleReprocess = async () => {
    const logsToReprocess = logs.filter((l) => selectedIds.has(l.id) && l.status !== "success" && l.payload);
    if (logsToReprocess.length === 0) {
      toast({ title: "Nenhum log elegível para reprocessamento (apenas erros)", variant: "destructive" });
      return;
    }

    setReprocessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const log of logsToReprocess) {
      try {
        const payload = log.payload as Record<string, any>;
        const action = payload?.action;
        const items = payload?.items;

        if (!action || !items || !Array.isArray(items)) {
          failCount++;
          continue;
        }

        // Re-build agendas array with flag_integracao = LOVABLE to force re-send
        const agendas = items.map((item: any) => ({
          data: item.data,
          cliente: item.codigo_cliente || item.projeto || "",
          user_id: item.user_id || "",
          atividade: item.codigo_atividade || "",
          flag_integracao: "LOVABLE",
          ...(item.user_id ? {} : {}),
        }));

        const { error } = await supabase.functions.invoke("protheus-agenda-sync", {
          body: { action, agendas },
        });

        if (error) {
          failCount++;
        } else {
          successCount++;
        }
      } catch {
        failCount++;
      }
    }

    toast({
      title: "Reprocessamento concluído",
      description: `${successCount} sucesso(s), ${failCount} falha(s)`,
      variant: failCount > 0 && successCount === 0 ? "destructive" : "default",
    });

    setSelectedIds(new Set());
    setReprocessing(false);
    await loadLogs();
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Deseja excluir ${selectedIds.size} log(s) selecionado(s)?`)) return;
    setDeleting(true);
    const { error } = await supabase
      .from("integration_logs")
      .delete()
      .in("id", Array.from(selectedIds));
    if (error) {
      toast({ title: "Erro ao excluir logs", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${selectedIds.size} log(s) excluído(s)` });
    }
    setSelectedIds(new Set());
    setDeleting(false);
    await loadLogs();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs de Integração
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReprocess}
                    disabled={reprocessing || deleting}
                    className="gap-1.5"
                  >
                    {reprocessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Reprocessar ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteSelected}
                    disabled={deleting || reprocessing}
                    className="gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Excluir ({selectedIds.size})
                  </Button>
                </>
              )}
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      {logs.length > 0 && (
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          title="Selecionar todos"
                        />
                      )}
                    </TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead className="text-center">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className={selectedIds.has(log.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(log.id)}
                          onCheckedChange={() => toggleSelect(log.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.codigo || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.status === "success"
                              ? "text-emerald-600 border-emerald-400"
                              : log.status === "info"
                              ? "text-blue-600 border-blue-400"
                              : "text-destructive border-destructive"
                          }
                        >
                          {log.status === "success" ? "Sucesso" : log.status === "info" ? "Info" : "Erro"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate">{log.message || "-"}</TableCell>
                      <TableCell className="text-xs">{log.http_status ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        {log.payload != null ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedLog(log)}
                            title="Ver payload"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              Detalhes do Log — {selectedLog?.codigo || "N/A"}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Data/Hora:</span>{" "}
                  {new Date(selectedLog.timestamp).toLocaleString("pt-BR")}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Status HTTP:</span>{" "}
                  {selectedLog.http_status ?? "-"}
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">Mensagem:</span>{" "}
                  {selectedLog.message || "-"}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Payload Enviado:</p>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Retorno da API:</p>
                {selectedLog.response != null ? (
                  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                    {JSON.stringify(selectedLog.response, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum retorno registrado</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
