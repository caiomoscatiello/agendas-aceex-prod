import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { format } from "date-fns";

type Profile = { user_id: string; name: string };

type ReportRow = {
  agendaId: string;
  consultor: string;
  data: string;
  status: string;
  cliente: string;
  atividade: string;
  totalHoras: string;
  horaEntrada: string;
  horaSaida: string;
  tipoBatidaEntrada: string;
  tipoBatidaSaida: string;
};

function calcHoras(entrada: string, saida: string): string {
  if (!entrada || !saida) return "—";
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  const diffMin = (sh * 60 + sm) - (eh * 60 + em);
  if (diffMin <= 0) return "—";
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function tipoBatida(lat: number | null, lon: number | null): string {
  return (lat !== null && lon !== null) ? "Online" : "Offline";
}

export default function AdminRelatorio() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("user_id, name").then(({ data }) => setProfiles(data || []));
  }, []);

  const getName = (uid: string) => profiles.find((p) => p.user_id === uid)?.name || "—";

  const handleBuscar = async () => {
    if (!filtroUsuario || !filtroMes) return;
    setLoading(true);
    setSearched(true);

    const [year, month] = filtroMes.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let agendaQuery = supabase
      .from("agendas")
      .select("id, data, cliente, atividade, status, user_id")
      .eq("user_id", filtroUsuario)
      .gte("data", startDate)
      .lte("data", endDate)
      .not("status", "in", '("cancelada","excluida")')
      .order("data", { ascending: true });

    if (filtroCliente.trim()) {
      agendaQuery = agendaQuery.ilike("cliente", `%${filtroCliente.trim()}%`);
    }

    const { data: agendas } = await agendaQuery;

    const { data: apontamentos } = await supabase
      .from("apontamentos")
      .select("data, cliente, tipo, hora, latitude, longitude, user_id")
      .eq("user_id", filtroUsuario)
      .gte("data", startDate)
      .lte("data", endDate);

    const consultor = getName(filtroUsuario);
    const result: ReportRow[] = (agendas || []).map((ag) => {
      const dayAps = (apontamentos || []).filter(
        (ap) => ap.data === ag.data && ap.cliente === ag.cliente
      );
      const entrada = dayAps.find((ap) => ap.tipo === "ENTRADA");
      const saida = dayAps.find((ap) => ap.tipo === "SAIDA");
      const hasApontamento = !!entrada || !!saida;

      // Status: prioridade para batidas de ponto, fallback para status da agenda
      const statusOkPorBatida = !!entrada && !!saida;
      const statusOkPorAgenda = ["apontamento_ok", "apontamento_ajustado", "doc_pendente"].includes(ag.status?.toLowerCase() || "");
      const statusLabel = statusOkPorBatida || statusOkPorAgenda ? "Apontamento OK" : "Pendente";

      return {
        agendaId: ag.id,
        consultor,
        data: ag.data,
        status: statusLabel,
        cliente: ag.cliente,
        atividade: ag.atividade,
        totalHoras: entrada && saida ? calcHoras(entrada.hora, saida.hora) : "—",
        horaEntrada: entrada?.hora || "—",
        horaSaida: saida?.hora || "—",
        tipoBatidaEntrada: entrada ? tipoBatida(entrada.latitude, entrada.longitude) : "—",
        tipoBatidaSaida: saida ? tipoBatida(saida.latitude, saida.longitude) : "—",
      };
    });

    setRows(result);
    setLoading(false);
  };

  const exportCsv = () => {
    const header = "Consultor,Data,Status,Cliente,Atividade,Total Horas,Hora Entrada,Hora Saída,Batida Entrada,Batida Saída\n";
    const csv = rows
      .map((r) =>
        `"${r.consultor}","${r.data}","${r.status}","${r.cliente}","${r.atividade}","${r.totalHoras}","${r.horaEntrada}","${r.horaSaida}","${r.tipoBatidaEntrada}","${r.tipoBatidaSaida}"`
      )
      .join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Relatório de Apontamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Consultor *</Label>
            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mês *</Label>
            <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cliente (opcional)</Label>
            <Input placeholder="Filtrar cliente..." value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between">
          <Button onClick={handleBuscar} disabled={!filtroUsuario || !filtroMes || loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Buscar
          </Button>
          {rows.length > 0 && (
            <Button variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>

        {searched && !loading && (
          <div className="max-h-[500px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Total Horas</TableHead>
                  <TableHead>H. Entrada</TableHead>
                  <TableHead>H. Saída</TableHead>
                  <TableHead>Bat. Entrada</TableHead>
                  <TableHead>Bat. Saída</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">Nenhum registro encontrado</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.agendaId}>
                      <TableCell>{r.consultor}</TableCell>
                      <TableCell>{r.data}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "Apontamento OK" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell>{r.cliente}</TableCell>
                      <TableCell>{r.atividade}</TableCell>
                      <TableCell>{r.totalHoras}</TableCell>
                      <TableCell>{r.horaEntrada}</TableCell>
                      <TableCell>{r.horaSaida}</TableCell>
                      <TableCell>
                        {r.tipoBatidaEntrada !== "—" && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.tipoBatidaEntrada === "Online" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                            {r.tipoBatidaEntrada}
                          </span>
                        )}
                        {r.tipoBatidaEntrada === "—" && "—"}
                      </TableCell>
                      <TableCell>
                        {r.tipoBatidaSaida !== "—" && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.tipoBatidaSaida === "Online" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                            {r.tipoBatidaSaida}
                          </span>
                        )}
                        {r.tipoBatidaSaida === "—" && "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
