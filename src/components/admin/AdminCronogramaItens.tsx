import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type CronogramaItem = {
  id: string;
  atividade_id: string;
  codigo: string;
  descricao: string;
  horas_reservadas: number;
  user_id: string;
  data_inicio: string | null;
  data_fim: string | null;
  doc_exigido: boolean;
  tipo_documento_id: string | null;
  doc_satisfeito: boolean;
  doc_satisfeito_em: string | null;
  monday_item_id: string | null;
};

export type TipoDocumento = {
  id: string;
  codigo: string;
  descricao: string;
};

type UserOption = {
  user_id: string;
  name: string;
};

type Props = {
  atividadeId: string;
  atividadeCodigo: string;
  atividadeHoras: number;
  itens: CronogramaItem[];
  usuarios: UserOption[];
  tiposDocumento: TipoDocumento[];
  onUpdate: (atividadeId: string, itens: CronogramaItem[]) => void;
  atividadeDataInicio: string | null;
  atividadeDataFim: string | null;
};

export default function AdminCronogramaItens({ atividadeId, atividadeCodigo, atividadeHoras, itens, usuarios, tiposDocumento, onUpdate, atividadeDataInicio, atividadeDataFim }: Props) {
  const [open, setOpen] = useState(false);
  const [newCodigo, setNewCodigo] = useState("");
  const [newDescricao, setNewDescricao] = useState("");
  const [newHoras, setNewHoras] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newDataInicio, setNewDataInicio] = useState("");
  const [newDataFim, setNewDataFim] = useState("");
  const [newDocExigido, setNewDocExigido] = useState(false);
  const [newTipoDocumentoId, setNewTipoDocumentoId] = useState("");

  const totalHorasUsadas = itens.reduce((sum, item) => sum + item.horas_reservadas, 0);

  const addItem = () => {
    if (!newCodigo || !newDescricao || !newHoras || !newUserId) {
      toast({ title: "Erro", description: "Preencha todos os campos do item cronograma.", variant: "destructive" });
      return;
    }
    if (newDataInicio && newDataFim && newDataFim < newDataInicio) {
      toast({ title: "Erro", description: "Data fim deve ser igual ou posterior à data início.", variant: "destructive" });
      return;
    }
    // Validar código duplicado
    const codigoDuplicado = itens.some(
      (i) => i.codigo.trim().toLowerCase() === newCodigo.trim().toLowerCase()
    );
    if (codigoDuplicado) {
      toast({
        title: "Código duplicado",
        description: `Já existe um item com o código "${newCodigo}". Use um código único.`,
        variant: "destructive",
      });
      return;
    }
    // Validar se datas do item estão dentro do range da atividade pai
    if (newDataInicio && atividadeDataInicio && newDataInicio < atividadeDataInicio) {
      toast({
        title: "Data inválida",
        description: `A data início do item (${newDataInicio}) é anterior à data início da atividade (${atividadeDataInicio}).`,
        variant: "destructive",
      });
      return;
    }
    if (newDataFim && atividadeDataFim && newDataFim > atividadeDataFim) {
      toast({
        title: "Data inválida",
        description: `A data fim do item (${newDataFim}) é posterior à data fim da atividade (${atividadeDataFim}).`,
        variant: "destructive",
      });
      return;
    }
    if (newDocExigido && !newTipoDocumentoId) {
      toast({ title: "Erro", description: "Selecione o tipo de documento exigido.", variant: "destructive" });
      return;
    }
    const horas = parseFloat(newHoras);
    if (isNaN(horas) || horas <= 0) {
      toast({ title: "Erro", description: "Horas reservadas deve ser maior que zero.", variant: "destructive" });
      return;
    }
    if (totalHorasUsadas + horas > atividadeHoras) {
      toast({
        title: "Erro",
        description: `Total de horas dos itens cronograma (${totalHorasUsadas + horas}h) excede as horas da atividade ${atividadeCodigo} (${atividadeHoras}h).`,
        variant: "destructive",
      });
      return;
    }
    const newItem: CronogramaItem = {
      id: `temp_${Date.now()}`,
      atividade_id: atividadeId,
      codigo: newCodigo,
      descricao: newDescricao,
      horas_reservadas: horas,
      user_id: newUserId,
      data_inicio: newDataInicio || null,
      data_fim: newDataFim || null,
      doc_exigido: newDocExigido,
      tipo_documento_id: newDocExigido ? newTipoDocumentoId : null,
      doc_satisfeito: false,
      doc_satisfeito_em: null,
      monday_item_id: null,
    };
    onUpdate(atividadeId, [...itens, newItem]);
    setNewCodigo("");
    setNewDescricao("");
    setNewHoras("");
    setNewUserId("");
    setNewDataInicio("");
    setNewDataFim("");
    setNewDocExigido(false);
    setNewTipoDocumentoId("");
  };

  const removeItem = (idx: number) => {
    onUpdate(atividadeId, itens.filter((_, i) => i !== idx));
  };

  const getUserName = (userId: string) => {
    const u = usuarios.find((u) => u.user_id === userId);
    return u ? u.name : "—";
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <CalendarClock className="h-3 w-3" />
          Cronograma ({itens.length}) — {totalHorasUsadas}h / {atividadeHoras}h
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 ml-4 space-y-2 overflow-visible">
        {itens.length > 0 && (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                   <TableHead className="text-xs">Horas</TableHead>
                   <TableHead className="text-xs">Início</TableHead>
                   <TableHead className="text-xs">Fim</TableHead>
                   <TableHead className="text-xs">Responsável</TableHead>
                   <TableHead className="text-xs">Doc</TableHead>
                   <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs font-mono">{item.codigo}</TableCell>
                    <TableCell className="text-xs">{item.descricao}</TableCell>
                    <TableCell className="text-xs">{item.horas_reservadas}h</TableCell>
                    <TableCell className="text-xs">{item.data_inicio ? item.data_inicio.split("-").reverse().join("/") : "—"}</TableCell>
                    <TableCell className="text-xs">{item.data_fim ? item.data_fim.split("-").reverse().join("/") : "—"}</TableCell>
                    <TableCell className="text-xs">{getUserName(item.user_id)}</TableCell>
                    <TableCell className="text-xs">
                      {item.doc_exigido ? (
                        <div className="space-y-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 ${
                              item.doc_satisfeito
                                ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                                : "border-amber-500 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {item.doc_satisfeito ? "✓ Doc OK" : "⚠ Doc Pend."}
                          </Badge>
                          {!item.doc_satisfeito && (
                            <p className="text-[10px] text-muted-foreground">
                              {tiposDocumento.find(t => t.id === item.tipo_documento_id)?.codigo || ""}
                            </p>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="w-20 space-y-1">
            <Label className="text-[10px]">Código</Label>
            <Input className="h-8 text-xs" value={newCodigo} onChange={(e) => setNewCodigo(e.target.value)} placeholder="C01" />
          </div>
          <div className="flex-1 min-w-[120px] space-y-1">
            <Label className="text-[10px]">Descrição</Label>
            <Input className="h-8 text-xs" value={newDescricao} onChange={(e) => setNewDescricao(e.target.value)} placeholder="Descrição do item" />
          </div>
          <div className="w-16 space-y-1">
            <Label className="text-[10px]">Horas</Label>
            <Input className="h-8 text-xs" type="number" min="0" step="0.5" value={newHoras} onChange={(e) => setNewHoras(e.target.value)} placeholder="0" />
          </div>
          <div className="w-40 space-y-1">
            <Label className="text-[10px]">Responsável</Label>
            <Select value={newUserId} onValueChange={setNewUserId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px] space-y-1">
            <Label className="text-[10px]">Data início</Label>
            <Input className="h-8 text-xs min-w-[150px]" type="date" value={newDataInicio} onChange={(e) => setNewDataInicio(e.target.value)} />
          </div>
          <div className="min-w-[150px] space-y-1">
            <Label className="text-[10px]">Data fim</Label>
            <Input className="h-8 text-xs min-w-[150px]" type="date" value={newDataFim} onChange={(e) => setNewDataFim(e.target.value)} />
          </div>
          {/* Toggle doc exigido */}
          <div className="flex items-center gap-1.5 h-8">
            <Switch
              checked={newDocExigido}
              onCheckedChange={(v) => {
                setNewDocExigido(v);
                if (!v) setNewTipoDocumentoId("");
              }}
              className="scale-75"
            />
            <Label className="text-[10px] whitespace-nowrap">
              Exige doc
            </Label>
          </div>
          {/* Select tipo documento — aparece só se toggle ativo */}
          {newDocExigido && (
            <div className="w-full sm:w-48 space-y-1">
              <Label className="text-[10px]">Tipo de Documento</Label>
              <Select value={newTipoDocumentoId} onValueChange={setNewTipoDocumentoId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposDocumento.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Nenhum tipo cadastrado
                    </SelectItem>
                  ) : (
                    tiposDocumento.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.codigo} — {t.descricao}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
