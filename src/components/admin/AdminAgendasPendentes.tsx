import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";

interface OverdueAgenda {
  id: string;
  usuario: string;
  email: string;
  cliente: string;
  data: string;
  atividade: string;
  status: string;
}

export default function AdminAgendasPendentes() {
  const [agendas, setAgendas] = useState<OverdueAgenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverdueAgendas();
  }, []);

  async function fetchOverdueAgendas() {
    setLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const today = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

      const { data, error } = await supabase
        .from("agendas")
        .select("id, usuario, email, cliente, data, atividade, status")
        .in("status", ["pendente", "confirmada"])
        .gte("data", monthStart)
        .lte("data", today)
        .order("data", { ascending: true });

      if (error) throw error;
      setAgendas(data || []);
    } catch (err) {
      console.error("Erro ao buscar agendas pendentes:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Agendas Pendentes do Mês
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Agendas com status pendente e data até hoje no mês vigente.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : agendas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhuma agenda pendente encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(a.data)}</TableCell>
                    <TableCell>{a.usuario}</TableCell>
                    <TableCell>{a.cliente}</TableCell>
                    <TableCell>{a.atividade}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={a.status === "pendente" ? "text-amber-600 border-amber-400" : "text-blue-600 border-blue-400"}>
                        {a.status === "pendente" ? "Pendente" : "Confirmada"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">
              Total: {agendas.length} agenda{agendas.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
