import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, Check, AlertTriangle, ClipboardList, CalendarIcon, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── CSV Types ───
type CsvRow = {
  usuario: string;
  email: string;
  cliente: string;
  data: string;
  atividade: string;
  item_cronograma: string;
};

type ValidationError = {
  row: number;
  field: string;
  value: string;
  message: string;
};

type ValidatedRow = CsvRow & {
  user_id?: string;
  errors: ValidationError[];
};

// ─── Manual Types ───
type ProjetoAtividade = { id: string; codigo: string; descricao: string };
type CronogramaItem = { id: string; codigo: string; descricao: string; atividade_id: string };
type ExistingAgenda = { cliente: string; atividade: string; item_cronograma: string | null; status: string };

// ─── CSV Tab ───
function CsvTab() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [validationDone, setValidationDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const normalize = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const convertDateToISO = (dateStr: string): string => {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return dateStr;
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const rawHeaders = parseCSVLine(lines[0], delimiter).map(normalize);

    const fieldAliases: Record<string, string[]> = {
      usuario: ["usuario", "nome", "name"],
      email: ["email", "e-mail"],
      cliente: ["cliente", "client"],
      data: ["data", "date"],
      atividade: ["atividade", "activity"],
      item_cronograma: ["item_cronograma", "item cronograma", "cronograma", "item"],
    };

    const colMap: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(fieldAliases)) {
      const idx = rawHeaders.findIndex(h => aliases.some(a => h.includes(a)));
      if (idx !== -1) colMap[field] = idx;
    }

    const requiredFields = ["usuario", "email", "cliente", "data", "atividade"];
    const missing = requiredFields.filter(f => !(f in colMap));
    if (missing.length > 0) {
      toast({ title: "Erro no CSV", description: `Colunas não encontradas: ${missing.join(", ")}`, variant: "destructive" });
      return [];
    }

    return lines.slice(1).map((line) => {
      const values = parseCSVLine(line, delimiter);
      return {
        usuario: values[colMap.usuario] || "",
        email: values[colMap.email] || "",
        cliente: values[colMap.cliente] || "",
        data: values[colMap.data] || "",
        atividade: values[colMap.atividade] || "",
        item_cronograma: colMap.item_cronograma !== undefined ? (values[colMap.item_cronograma] || "") : "",
      };
    }).filter(r => r.email && r.data);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationDone(false);
    setValidatedRows([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleValidateAndUpload = async () => {
    if (rows.length === 0) return;

    if (!validationDone) {
      setValidating(true);

      const emails = [...new Set(rows.map((r) => r.email))];

      const [profilesRes, projetosRes, atividadesRes, cronogramaRes, existingAgendasRes] = await Promise.all([
        supabase.from("profiles").select("user_id, email").in("email", emails),
        supabase.from("projetos").select("id, nome_cliente"),
        supabase.from("projeto_atividades").select("id, codigo, projeto_id, descricao, horas"),
        supabase.from("cronograma_itens").select("id, atividade_id, codigo, user_id, horas_reservadas"),
        supabase.from("agendas").select("user_id, data, cliente, atividade"),
      ]);

      const emailToUserId = new Map(profilesRes.data?.map((p) => [p.email, p.user_id]) || []);
      const projetosByNome = new Map(projetosRes.data?.map((p) => [p.nome_cliente, p.id]) || []);

      const projetoAtividades = new Map<string, Set<string>>();
      atividadesRes.data?.forEach((a) => {
        if (!projetoAtividades.has(a.projeto_id)) {
          projetoAtividades.set(a.projeto_id, new Set());
        }
        projetoAtividades.get(a.projeto_id)!.add(a.codigo);
      });

      const atividadeIdMap = new Map<string, string>();
      atividadesRes.data?.forEach((a) => {
        atividadeIdMap.set(`${a.projeto_id}|${a.codigo}`, a.id);
      });

      const cronogramaMap = new Map<string, typeof cronogramaRes.data extends (infer T)[] | null ? T : never>();
      cronogramaRes.data?.forEach((c) => {
        cronogramaMap.set(`${c.atividade_id}|${c.codigo}|${c.user_id}`, c);
      });

      const existingAgendaKeys = new Set<string>();
      existingAgendasRes.data?.forEach((a) => {
        existingAgendaKeys.add(`${a.user_id}|${a.data}|${a.cliente}|${a.atividade}`);
      });

      const csvDuplicateTracker = new Map<string, number>();

      const validated: ValidatedRow[] = rows.map((r, idx) => {
        const errors: ValidationError[] = [];
        const userId = emailToUserId.get(r.email);
        const dataISO = convertDateToISO(r.data);

        if (!userId) {
          errors.push({ row: idx + 2, field: "email", value: r.email, message: "Consultor não cadastrado" });
        }

        const projetoId = projetosByNome.get(r.cliente);
        if (!projetoId) {
          errors.push({ row: idx + 2, field: "cliente", value: r.cliente, message: "Projeto/cliente não cadastrado" });
        } else {
          const atividades = projetoAtividades.get(projetoId);
          if (!atividades || !atividades.has(r.atividade)) {
            errors.push({ row: idx + 2, field: "atividade", value: r.atividade, message: `Atividade não cadastrada no projeto "${r.cliente}"` });
          }
        }

        if (userId) {
          const dupKey = `${userId}|${dataISO}|${r.cliente}|${r.atividade}`;
          const prevRow = csvDuplicateTracker.get(dupKey);
          if (prevRow !== undefined) {
            errors.push({
              row: idx + 2,
              field: "data",
              value: r.data,
              message: `Duplicada no CSV (mesma data/cliente/atividade da linha ${prevRow})`,
            });
          } else {
            csvDuplicateTracker.set(dupKey, idx + 2);
          }

          if (existingAgendaKeys.has(dupKey)) {
            errors.push({
              row: idx + 2,
              field: "data",
              value: r.data,
              message: "Agenda já existe no sistema (mesma data/cliente/atividade/consultor)",
            });
          }
        }

        if (r.item_cronograma && projetoId && userId) {
          const atividadeId = atividadeIdMap.get(`${projetoId}|${r.atividade}`);
          if (atividadeId) {
            const cronogramaKey = `${atividadeId}|${r.item_cronograma}|${userId}`;
            const cronogramaItem = cronogramaMap.get(cronogramaKey);
            if (!cronogramaItem) {
              const itemExistsForOther = Array.from(cronogramaMap.keys()).some(
                (k) => k.startsWith(`${atividadeId}|${r.item_cronograma}|`) && !k.endsWith(`|${userId}`)
              );
              if (itemExistsForOther) {
                errors.push({
                  row: idx + 2,
                  field: "item_cronograma",
                  value: r.item_cronograma,
                  message: `Item cronograma "${r.item_cronograma}" não está atribuído a este consultor`,
                });
              } else {
                errors.push({
                  row: idx + 2,
                  field: "item_cronograma",
                  value: r.item_cronograma,
                  message: `Item cronograma "${r.item_cronograma}" não existe na atividade "${r.atividade}"`,
                });
              }
            }
          }
        }

        return { ...r, user_id: userId, errors };
      });

      setValidatedRows(validated);
      setValidationDone(true);
      setValidating(false);

      const errorCount = validated.filter((r) => r.errors.length > 0).length;
      const validCount = validated.filter((r) => r.errors.length === 0).length;

      if (errorCount > 0) {
        toast({
          title: "Validação concluída com erros",
          description: `${validCount} válidos, ${errorCount} com erros. Corrija ou confirme o upload apenas dos válidos.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Validação OK", description: `Todos os ${validCount} registros estão válidos.` });
      }
    } else {
      setLoading(true);

      const validRows = validatedRows.filter((r) => r.errors.length === 0 && r.user_id);
      if (validRows.length === 0) {
        toast({ title: "Nenhum registro válido", description: "Corrija os erros e tente novamente.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const insertData = validRows.map((r) => ({
        user_id: r.user_id!,
        usuario: r.usuario,
        email: r.email,
        cliente: r.cliente,
        data: convertDateToISO(r.data),
        atividade: r.atividade,
        item_cronograma: r.item_cronograma || null,
        flag_integracao: "LOVABLE",
      }));

      const { data: inserted, error } = await supabase.from("agendas").insert(insertData).select("id, data, cliente, user_id, atividade, flag_integracao");
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Sucesso", description: `${insertData.length} agendas carregadas no sistema!` });

        const toSync = (inserted || [])
          .filter((a) => a.flag_integracao === "LOVABLE")
          .map((a) => ({
            data: a.data,
            cliente: a.cliente,
            user_id: a.user_id,
            atividade: a.atividade,
            flag_integracao: a.flag_integracao,
          }));

        if (toSync.length > 0) {
          try {
            const { data: syncResult, error: syncError } = await supabase.functions.invoke("protheus-agenda-sync", {
              body: { action: "incluir", agendas: toSync },
            });

            if (syncError) {
              toast({ title: "Aviso Protheus", description: `Agendas salvas, mas erro ao sincronizar: ${syncError.message}`, variant: "destructive" });
            } else if (syncResult) {
              const totalReal = syncResult.synced ?? toSync.length;
              if (syncResult.divergencia) {
                toast({
                  title: "Sincronizado com divergência",
                  description: `${totalReal} agenda(s) enviada(s). Confirmação do Protheus: ${syncResult.sincronizados ?? "N/A"} (divergência detectada)`,
                });
              } else {
                toast({
                  title: "Sincronizado",
                  description: `${totalReal} agenda(s) incluída(s) com sucesso no Protheus`,
                });
              }
            }
          } catch (err: any) {
            console.error("Erro ao sincronizar com Protheus:", err);
          }
        }
        // Sync Monday — fire-and-forget apenas para agendas com item_cronograma
        const mondayIds = (inserted || [])
          .filter((a) => {
            const row = validRows.find((r) => r.user_id === a.user_id && convertDateToISO(r.data) === a.data && r.cliente === a.cliente);
            return row?.item_cronograma;
          })
          .map((a) => a.id)
          .filter(Boolean);
        if (mondayIds.length > 0) {
          Promise.all(
            mondayIds.map((id) =>
              supabase.functions.invoke("monday-agenda-sync", {
                body: { action: "create", agenda_id: id },
              }).catch(() => {})
            )
          );
        }
      }

      setRows([]);
      setValidatedRows([]);
      setValidationDone(false);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      setLoading(false);
    }
  };

  const validCount = validatedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = validatedRows.filter((r) => r.errors.length > 0).length;
  const hasItemCronograma = rows.some((r) => r.item_cronograma);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
          <FileText className="h-4 w-4" />
          Selecionar CSV
        </Button>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      <p className="text-xs text-muted-foreground">
        Formato esperado: Usuario, Email, Cliente, Data (DD/MM/YYYY), Atividade{" "}
        <span className="text-muted-foreground/70">[, Item Cronograma (opcional)]</span>
      </p>

      {rows.length > 0 && (
        <>
          {validationDone && (
            <div className="flex gap-2 text-sm">
              <Badge variant="default">{validCount} válidos</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} com erros</Badge>}
            </div>
          )}

          <div className="max-h-64 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {validationDone && <TableHead className="w-10">Status</TableHead>}
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Atividade</TableHead>
                  {hasItemCronograma && <TableHead>Item Cron.</TableHead>}
                  {validationDone && <TableHead>Erros</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(validationDone ? validatedRows : rows).slice(0, 50).map((r, i) => {
                  const vr = validationDone ? (r as ValidatedRow) : null;
                  const hasError = vr && vr.errors.length > 0;
                  return (
                    <TableRow key={i} className={hasError ? "bg-destructive/10" : ""}>
                      {validationDone && (
                        <TableCell>
                          {hasError ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </TableCell>
                      )}
                      <TableCell>{r.usuario}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.cliente}</TableCell>
                      <TableCell>{r.data}</TableCell>
                      <TableCell>{r.atividade}</TableCell>
                      {hasItemCronograma && <TableCell className="text-xs">{r.item_cronograma || "—"}</TableCell>}
                      {validationDone && (
                        <TableCell className="text-xs text-destructive">
                          {vr?.errors.map((e, j) => (
                            <div key={j}>{e.message}</div>
                          ))}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {rows.length > 50 && (
            <p className="text-xs text-muted-foreground">Exibindo 50 de {rows.length} registros</p>
          )}
          <Button
            onClick={handleValidateAndUpload}
            disabled={loading || validating}
            className="w-full gap-2"
            variant={validationDone && errorCount > 0 ? "destructive" : "default"}
          >
            {(loading || validating) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : validationDone ? (
              <Check className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {!validationDone
              ? `Validar (${rows.length} registros)`
              : validCount > 0
                ? `Confirmar Upload (${validCount} válidos)`
                : "Nenhum registro válido"
            }
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Manual Input Tab ───
function ManualTab() {
  // Form state
  const [codCliente, setCodCliente] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteError, setClienteError] = useState("");
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [atividades, setAtividades] = useState<ProjetoAtividade[]>([]);
  const [selectedAtividade, setSelectedAtividade] = useState("");
  const [cronogramaItens, setCronogramaItens] = useState<CronogramaItem[]>([]);
  const [selectedCronograma, setSelectedCronograma] = useState("");
  const [horas, setHoras] = useState("");
  const [modalidade, setModalidade] = useState("Remoto");
  const [codConsultor, setCodConsultor] = useState("");
  const [consultorNome, setConsultorNome] = useState("");
  const [consultorError, setConsultorError] = useState("");
  const [consultorUserId, setConsultorUserId] = useState<string | null>(null);
  const [consultorEmail, setConsultorEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Search dialogs
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState("");
  const [clienteSearchResults, setClienteSearchResults] = useState<{ id: string; codigo_cliente: string; nome_cliente: string }[]>([]);
  const [clienteSearchLoading, setClienteSearchLoading] = useState(false);

  const [consultorSearchOpen, setConsultorSearchOpen] = useState(false);
  const [consultorSearchTerm, setConsultorSearchTerm] = useState("");
  const [consultorSearchResults, setConsultorSearchResults] = useState<{ user_id: string; codigo: string; name: string; email: string }[]>([]);
  const [consultorSearchLoading, setConsultorSearchLoading] = useState(false);

  // Conflict dialog
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [existingAgendas, setExistingAgendas] = useState<ExistingAgenda[]>([]);

  // Lookup Cód. Cliente
  const handleClienteLookup = async () => {
    if (!codCliente.trim()) {
      setClienteNome("");
      setProjetoId(null);
      setClienteError("");
      setAtividades([]);
      setSelectedAtividade("");
      setCronogramaItens([]);
      setSelectedCronograma("");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from("projetos")
      .select("id, nome_cliente")
      .eq("codigo_cliente", codCliente.trim())
      .eq("coordenador_id", userId)
      .maybeSingle();

    if (error || !data) {
      setClienteNome("");
      setProjetoId(null);
      setAtividades([]);
      setSelectedAtividade("");
      setCronogramaItens([]);
      setSelectedCronograma("");
      setClienteError("Projeto não encontrado ou você não é o coordenador.");
    } else {
      setClienteNome(data.nome_cliente);
      setProjetoId(data.id);
      setClienteError("");
      setSelectedAtividade("");
      setCronogramaItens([]);
      setSelectedCronograma("");
      const { data: ativData } = await supabase
        .from("projeto_atividades")
        .select("id, codigo, descricao")
        .eq("projeto_id", data.id);
      setAtividades(ativData || []);
    }
  };

  // Search Cliente by name
  const handleClienteSearch = async (term: string) => {
    setClienteSearchTerm(term);
    if (term.trim().length < 2) {
      setClienteSearchResults([]);
      return;
    }
    setClienteSearchLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) { setClienteSearchLoading(false); return; }

    const { data } = await supabase
      .from("projetos")
      .select("id, codigo_cliente, nome_cliente")
      .eq("coordenador_id", userId)
      .ilike("nome_cliente", `%${term.trim()}%`)
      .limit(20);
    setClienteSearchResults(data || []);
    setClienteSearchLoading(false);
  };

  const handleSelectClienteFromSearch = async (proj: { id: string; codigo_cliente: string; nome_cliente: string }) => {
    setCodCliente(proj.codigo_cliente);
    setClienteNome(proj.nome_cliente);
    setProjetoId(proj.id);
    setClienteError("");
    setSelectedAtividade("");
    setCronogramaItens([]);
    setSelectedCronograma("");
    setClienteSearchOpen(false);
    setClienteSearchTerm("");
    setClienteSearchResults([]);
    const { data: ativData } = await supabase
      .from("projeto_atividades")
      .select("id, codigo, descricao")
      .eq("projeto_id", proj.id);
    setAtividades(ativData || []);
  };

  // Lookup Cód. Consultor
  const handleConsultorLookup = async () => {
    if (!codConsultor.trim()) {
      setConsultorNome("");
      setConsultorUserId(null);
      setConsultorEmail("");
      setConsultorError("");
      setCronogramaItens([]);
      setSelectedCronograma("");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, email")
      .eq("codigo", codConsultor.trim())
      .maybeSingle();

    if (error || !data) {
      setConsultorNome("");
      setConsultorUserId(null);
      setConsultorEmail("");
      setConsultorError("Consultor não encontrado.");
      setCronogramaItens([]);
      setSelectedCronograma("");
    } else {
      setConsultorNome(data.name);
      setConsultorUserId(data.user_id);
      setConsultorEmail(data.email);
      setConsultorError("");
      setSelectedCronograma("");
    }
  };

  // Search Consultor by name
  const handleConsultorSearch = async (term: string) => {
    setConsultorSearchTerm(term);
    if (term.trim().length < 2) {
      setConsultorSearchResults([]);
      return;
    }
    setConsultorSearchLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, codigo, name, email")
      .ilike("name", `%${term.trim()}%`)
      .limit(20);
    setConsultorSearchResults((data || []).map(d => ({ ...d, codigo: d.codigo || "" })));
    setConsultorSearchLoading(false);
  };

  const handleSelectConsultorFromSearch = (prof: { user_id: string; codigo: string; name: string; email: string }) => {
    setCodConsultor(prof.codigo);
    setConsultorNome(prof.name);
    setConsultorUserId(prof.user_id);
    setConsultorEmail(prof.email);
    setConsultorError("");
    setSelectedCronograma("");
    setConsultorSearchOpen(false);
    setConsultorSearchTerm("");
    setConsultorSearchResults([]);
  };

  // Load cronograma itens when atividade + consultor are set
  useEffect(() => {
    const loadCronograma = async () => {
      if (!selectedAtividade || !consultorUserId) {
        setCronogramaItens([]);
        setSelectedCronograma("");
        return;
      }
      const atv = atividades.find(a => a.codigo === selectedAtividade);
      if (!atv) return;
      const { data } = await supabase
        .from("cronograma_itens")
        .select("id, codigo, descricao, atividade_id")
        .eq("atividade_id", atv.id);
      setCronogramaItens(data || []);
      setSelectedCronograma("");
    };
    loadCronograma();
  }, [selectedAtividade, consultorUserId, atividades]);

  const isFormValid =
    !!projetoId && !!selectedDate && !!selectedAtividade && !!horas && !!modalidade && !!consultorUserId;

  const resetForm = () => {
    setCodCliente("");
    setClienteNome("");
    setClienteError("");
    setProjetoId(null);
    setSelectedDate(undefined);
    setAtividades([]);
    setSelectedAtividade("");
    setCronogramaItens([]);
    setSelectedCronograma("");
    setHoras("");
    setModalidade("Remoto");
    setCodConsultor("");
    setConsultorNome("");
    setConsultorError("");
    setConsultorUserId(null);
    setConsultorEmail("");
  };

  const doInsert = async () => {
    setLoading(true);
    const dataISO = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

    const insertPayload = {
      user_id: consultorUserId!,
      usuario: consultorNome,
      email: consultorEmail,
      cliente: clienteNome,
      data: dataISO,
      atividade: selectedAtividade,
      item_cronograma: selectedCronograma || null,
      flag_integracao: "LOVABLE" as const,
    };

    const { data: inserted, error } = await supabase
      .from("agendas")
      .insert(insertPayload)
      .select("id, data, cliente, user_id, atividade, flag_integracao");

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Agenda incluída com sucesso!" });

    // Sync with Protheus
    const toSync = (inserted || [])
      .filter((a) => a.flag_integracao === "LOVABLE")
      .map((a) => ({
        data: a.data,
        cliente: a.cliente,
        user_id: a.user_id,
        atividade: a.atividade,
        flag_integracao: a.flag_integracao,
      }));

    if (toSync.length > 0) {
      try {
        const { data: syncResult, error: syncError } = await supabase.functions.invoke("protheus-agenda-sync", {
          body: { action: "incluir", agendas: toSync },
        });
        if (syncError) {
          toast({ title: "Aviso Protheus", description: `Agenda salva, mas erro ao sincronizar: ${syncError.message}`, variant: "destructive" });
        } else if (syncResult) {
          const totalReal = syncResult.synced ?? toSync.length;
          if (syncResult.divergencia) {
            toast({
              title: "Sincronizado com divergência",
              description: `${totalReal} agenda(s) enviada(s). Confirmação do Protheus: ${syncResult.sincronizados ?? "N/A"} (divergência detectada)`,
            });
          } else {
            toast({ title: "Sincronizado", description: `${totalReal} agenda(s) incluída(s) com sucesso no Protheus` });
          }
        }
      } catch (err: any) {
        console.error("Erro ao sincronizar com Protheus:", err);
      }
    }
    resetForm();
    setLoading(false);
    setConflictDialogOpen(false);

    // Sync Monday — fire-and-forget apenas se agenda tem item de cronograma
    const agendaId = (inserted || [])[0]?.id;
    if (agendaId && selectedCronograma) {
      supabase.functions.invoke("monday-agenda-sync", {
        body: { action: "create", agenda_id: agendaId },
      }).catch(() => {});
    }
  };

  const handleVerificarEIncluir = async () => {
    if (!isFormValid || !selectedDate) return;
    setLoading(true);

    const dataISO = format(selectedDate, "yyyy-MM-dd");

    const { data: existing, error } = await supabase
      .from("agendas")
      .select("cliente, atividade, item_cronograma, status")
      .eq("user_id", consultorUserId!)
      .eq("data", dataISO);

    if (error) {
      toast({ title: "Erro ao verificar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (existing && existing.length > 0) {
      setExistingAgendas(existing);
      setConflictDialogOpen(true);
      setLoading(false);
    } else {
      await doInsert();
    }
  };

  const dataFormatted = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "";

  return (
    <div className="space-y-4">
      {/* Row 1: Cód. Cliente + Cliente */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cód. Cliente</Label>
          <div className="flex gap-1">
            <Input
              value={codCliente}
              onChange={(e) => { setCodCliente(e.target.value); setClienteError(""); }}
              onBlur={handleClienteLookup}
              onKeyDown={(e) => e.key === "Enter" && handleClienteLookup()}
              placeholder="Ex: CLI001"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => { setClienteSearchOpen(true); setClienteSearchTerm(""); setClienteSearchResults([]); }}
              title="Pesquisar por nome"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {clienteError && <p className="text-xs text-destructive">{clienteError}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cliente</Label>
          <Input value={clienteNome} disabled placeholder="Auto" className="bg-muted" />
        </div>
      </div>

      {/* Row 2: Data + Horas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? dataFormatted : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Horas</Label>
          <Input
            type="number"
            min={0.5}
            step={0.5}
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            placeholder="8"
          />
        </div>
      </div>

      {/* Row 3: Atividade */}
      <div className="space-y-1">
        <Label className="text-xs">Atividade</Label>
        <Select
          value={selectedAtividade}
          onValueChange={setSelectedAtividade}
          disabled={!projetoId || atividades.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={!projetoId ? "Informe o cliente primeiro" : "Selecione a atividade"} />
          </SelectTrigger>
          <SelectContent>
            {atividades.map((a) => (
              <SelectItem key={a.id} value={a.codigo}>
                [{a.codigo}] - {a.descricao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 4: Item Cronograma + Modalidade */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Item Cronograma <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Select
            value={selectedCronograma}
            onValueChange={setSelectedCronograma}
            disabled={!selectedAtividade || !consultorUserId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {cronogramaItens.map((c) => (
                <SelectItem key={c.id} value={c.codigo}>
                  [{c.codigo}] - {c.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Modalidade</Label>
          <Select value={modalidade} onValueChange={setModalidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Presencial">Presencial</SelectItem>
              <SelectItem value="Remoto">Remoto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 5: Cód. Consultor + Consultor */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cód. Consultor</Label>
          <div className="flex gap-1">
            <Input
              value={codConsultor}
              onChange={(e) => { setCodConsultor(e.target.value); setConsultorError(""); }}
              onBlur={handleConsultorLookup}
              onKeyDown={(e) => e.key === "Enter" && handleConsultorLookup()}
              placeholder="Ex: CON001"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => { setConsultorSearchOpen(true); setConsultorSearchTerm(""); setConsultorSearchResults([]); }}
              title="Pesquisar por nome"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {consultorError && <p className="text-xs text-destructive">{consultorError}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Consultor</Label>
          <Input value={consultorNome} disabled placeholder="Auto" className="bg-muted" />
        </div>
      </div>

      {/* Submit */}
      <Button
        onClick={handleVerificarEIncluir}
        disabled={!isFormValid || loading}
        className="w-full gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Check className="h-4 w-4" />
        Verificar e Incluir
      </Button>

      {/* Cliente Search Dialog */}
      <Dialog open={clienteSearchOpen} onOpenChange={setClienteSearchOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-md">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Pesquisar Cliente</DialogTitle>
          </DialogHeader>
          <div className="shrink-0 px-4 pt-3">
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Digite parte do nome do cliente..."
                value={clienteSearchTerm}
                onChange={(e) => handleClienteSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-[120px] max-h-[50dvh]">
            {clienteSearchLoading && <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>}
            {!clienteSearchLoading && clienteSearchTerm.length >= 2 && clienteSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado.</p>
            )}
            {!clienteSearchLoading && clienteSearchTerm.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">Digite ao menos 2 caracteres.</p>
            )}
            {clienteSearchResults.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex justify-between items-center gap-2"
                onClick={() => handleSelectClienteFromSearch(p)}
              >
                <span className="truncate">{p.nome_cliente}</span>
                <Badge variant="outline" className="shrink-0 text-xs">{p.codigo_cliente}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Consultor Search Dialog */}
      <Dialog open={consultorSearchOpen} onOpenChange={setConsultorSearchOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-md">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Pesquisar Consultor</DialogTitle>
          </DialogHeader>
          <div className="shrink-0 px-4 pt-3">
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Digite parte do nome do consultor..."
                value={consultorSearchTerm}
                onChange={(e) => handleConsultorSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-[120px] max-h-[50dvh]">
            {consultorSearchLoading && <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>}
            {!consultorSearchLoading && consultorSearchTerm.length >= 2 && consultorSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum consultor encontrado.</p>
            )}
            {!consultorSearchLoading && consultorSearchTerm.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">Digite ao menos 2 caracteres.</p>
            )}
            {consultorSearchResults.map((p) => (
              <button
                key={p.user_id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex justify-between items-center gap-2"
                onClick={() => handleSelectConsultorFromSearch(p)}
              >
                <span className="truncate">{p.name}</span>
                <Badge variant="outline" className="shrink-0 text-xs">{p.codigo}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Consultor já possui agenda(s) nesta data</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              As agendas abaixo já existem para este consultor em{" "}
              <strong>{dataFormatted}</strong>. O input manual é apenas informativo — você pode incluir mesmo assim.
            </p>
            <div className="rounded-lg border overflow-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Item Cron.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingAgendas.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{a.cliente}</TableCell>
                      <TableCell className="text-sm">{a.atividade}</TableCell>
                      <TableCell className="text-sm">{a.item_cronograma || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="shrink-0 border-t px-4 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setConflictDialogOpen(false)}>Cancelar</Button>
            <Button onClick={doInsert} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Incluir mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Component ───
export default function AdminCarregarAgendas() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          INPUT AGENDA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="csv">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="csv" className="flex-1 gap-1">
              <Upload className="h-4 w-4" />
              Carga via CSV
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-1">
              <ClipboardList className="h-4 w-4" />
              Input Manual
            </TabsTrigger>
          </TabsList>
          <TabsContent value="csv">
            <CsvTab />
          </TabsContent>
          <TabsContent value="manual">
            <ManualTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
