// src/components/consultor/ui/BacklogBoard.tsx
// BL-004-B - Board Kanban do Backlog

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ListTodo, Plus, Search, Loader2, X, ChevronDown, ChevronUp,
  ArrowRight, Lock, Unlock, LayoutGrid, List,
  Tag, AlertCircle, CheckCircle2, Send,
  History, MessageSquare, Edit2, Save,
  Settings2, ChevronLeft, ChevronRight, Trash2, Users, UserPlus, FileDown
} from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useBacklog, BacklogItem, BacklogColuna, BacklogComentario, BacklogHistorico, BacklogParticipante } from "../hooks/useBacklog";

// ?? TIPOS ?????????????????????????????????????????????????????????????????????

type Props = {
  projetoId: string;
  projetoNome: string;
  userId: string;
  isCoordinator?: boolean;
  // Contexto do consultor (opcional)
  agendaData?: string;
  agendaCliente?: string;
};

const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string; corBg: string }> = {
  critica: { label: "Critica",  cor: "text-red-700",    corBg: "bg-red-100" },
  alta:    { label: "Alta",     cor: "text-amber-700",  corBg: "bg-amber-100" },
  media:   { label: "Media",    cor: "text-blue-700",   corBg: "bg-blue-100" },
  baixa:   { label: "Baixa",   cor: "text-emerald-700", corBg: "bg-emerald-100" },
};

const TIPO_OPTIONS = [
  { value: "melhoria",     label: "Melhoria" },
  { value: "bug",          label: "Bug" },
  { value: "duvida",       label: "Duvida" },
  { value: "configuracao", label: "Configuraao" },
  { value: "treinamento",  label: "Treinamento" },
  { value: "outro",        label: "Outro" },
];

const FRENTE_OPTIONS = [
  { value: "fiscal",      label: "Fiscal" },
  { value: "financeiro",  label: "Financeiro" },
  { value: "estoque",     label: "Estoque" },
  { value: "compras",     label: "Compras" },
  { value: "rh",          label: "RH" },
  { value: "contabil",    label: "Contabil" },
  { value: "outro",       label: "Outro" },
];

// ?? HELPERS ???????????????????????????????????????????????????????????????????

function isVencido(data: string | null, colunaStatus: string | null) {
  if (!data) return false;
  if (colunaStatus === "concluido" || colunaStatus === "cancelado") return false;
  return isBefore(parseISO(data), new Date());
}

function PriBadge({ prioridade, reclassificada }: { prioridade: string; reclassificada?: string | null }) {
  const efetiva = reclassificada || prioridade;
  const cfg = PRIORIDADE_CONFIG[efetiva] || PRIORIDADE_CONFIG.media;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.corBg} ${cfg.cor}`}>
      {reclassificada && reclassificada !== prioridade ? `? ${cfg.label}` : cfg.label}
    </span>
  );
}

// ?? CARD DO ITEM ??????????????????????????????????????????????????????????????

function ItemCard({
  item, colunaStatus, colunas, onMove, onOpen, isDragging, onDragStart, onDragEnd,
  filhos, isCoordinator,
}: {
  item: BacklogItem;
  colunaStatus: string | null;
  colunas: BacklogColuna[];
  onMove: (itemId: string, colunaId: string, comFilhos?: boolean) => void;
  onOpen: (item: BacklogItem) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  filhos: BacklogItem[];
  isCoordinator: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const vencido = isVencido(item.data_prevista, colunaStatus);
  const temFilhos = filhos.length > 0;
  const hoje = new Date().toISOString().split("T")[0];

  return (
    <div
      className={`bg-card border rounded-xl p-3 cursor-pointer transition-all space-y-2 ${
        isDragging ? "opacity-40 scale-95" : "hover:shadow-sm hover:border-border/80"
      } ${vencido ? "border-red-200" : ""} ${dimmed ? "opacity-30" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item)}
    >
      {/* Topo */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">{item.codigo}</span>
        <PriBadge prioridade={item.prioridade} reclassificada={item.prioridade_reclassificada} />
      </div>

      {/* Titulo */}
      <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{item.titulo}</p>

      {/* Meta */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
          {FRENTE_OPTIONS.find(f => f.value === item.frente_modulo)?.label || item.frente_modulo}
        </span>
        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
          {TIPO_OPTIONS.find(t => t.value === item.tipo)?.label || item.tipo}
        </span>
        {item.estimativa_horas && (
          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
            {item.estimativa_horas}h
          </span>
        )}
      </div>

      {/* Data e atribuiao */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {item.data_prevista && (
            <span className={`text-[9px] flex items-center gap-0.5 ${vencido ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
              {vencido && "! "}
              {format(parseISO(item.data_prevista), "dd/MM", { locale: ptBR })}
            </span>
          )}
          {(item as any).data_conclusao_desejada && (
            <span className="text-[9px] text-amber-600 font-semibold">
              meta:{format(parseISO((item as any).data_conclusao_desejada), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {temFilhos && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
              className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              {item.hierarquia_bloqueada ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
              {filhos.length}
              {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            </button>
          )}
          {item.atribuido_para_nome && (
            <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[8px] font-bold flex items-center justify-center border-2 border-violet-300" title={item.atribuido_para_nome}>
              {item.atribuido_para_nome.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Botao mover (alternativa ao drag) */}
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {colunas
          .filter(c => c.id !== item.coluna_id)
          .slice(0, 3)
          .map(c => (
            <button
              key={c.id}
              onClick={() => onMove(item.id, c.id, temFilhos && item.hierarquia_bloqueada)}
              className="text-[9px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 hover:bg-accent transition-colors"
              title={`Mover para ${c.nome}`}
            >
              ? {c.nome.length > 8 ? c.nome.slice(0, 8) + "" : c.nome}
            </button>
          ))}
      </div>

      {/* Filhos expandidos */}
      {expanded && temFilhos && (
        <div className="border-t pt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {filhos.map(filho => (
            <div key={filho.id} className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5">
              <span className="text-[8px] opacity-50">?</span>
              <span className="font-mono text-[9px]">{filho.codigo}</span>
              <span className="flex-1 truncate font-medium text-foreground">{filho.titulo}</span>
              <PriBadge prioridade={filho.prioridade} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ?? MODAL NOVO ITEM ???????????????????????????????????????????????????????????

function NovoItemModal({
  open, onClose, onSave, colunas, saving, projetoNome, colunaInicial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<BacklogItem>) => void;
  colunas: BacklogColuna[];
  saving: boolean;
  projetoNome: string;
  colunaInicial?: string;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("melhoria");
  const [prioridade, setPrioridade] = useState("media");
  const [frente, setFrente] = useState("outro");
  const [desc, setDesc] = useState("");
  const [horas, setHoras] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [colunaId, setColunaId] = useState(colunaInicial || "");

  useEffect(() => {
    if (open) {
      setTitulo(""); setTipo("melhoria"); setPrioridade("media");
      setFrente("outro"); setDesc(""); setHoras(""); setDataPrevista("");
      setColunaId(colunaInicial || colunas.find(c => c.status_sistema === "aberto")?.id || "");
    }
  }, [open, colunaInicial, colunas]);

  const handleSave = () => {
    if (!titulo.trim()) { toast({ title: "Informe o titulo", variant: "destructive" }); return; }
    onSave({
      titulo: titulo.trim(),
      tipo, prioridade, frente_modulo: frente,
      descricao_solicitante: desc || null,
      estimativa_horas: horas ? parseFloat(horas) : null,
      data_prevista: dataPrevista || null,
      coluna_id: colunaId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-5 w-5 text-violet-600" />
            Novo item - {projetoNome}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Titulo *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Descreva o item de backlog..." autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Detalhamento do solicitante</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Contexto e detalhes..." rows={3} className="resize-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critica">Critica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frente / Modulo</Label>
              <Select value={frente} onValueChange={setFrente}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FRENTE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estimativa (horas)</Label>
              <Input type="number" min="0" step="0.5" value={horas} onChange={e => setHoras(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data prevista</Label>
              <Input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Coluna inicial</Label>
              <Select value={colunaId} onValueChange={setColunaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{colunas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t px-5 py-3 flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ?? BOARD PRINCIPAL ???????????????????????????????????????????????????????????

export function BacklogBoard({ projetoId, projetoNome, userId, isCoordinator = false, agendaData, agendaCliente }: Props) {
  const {
    colunas, items, loadingBoard, savingItem,
    loadBoard, moverItem, criarItem, salvarItem, adicionarComentario,
    loadComentarios, loadHistorico, loadHistoricoEvolutivo,
    criarColuna, renomearColuna, excluirColuna, reordenarColunas,
    loadParticipantes, adicionarParticipante, removerParticipante,
    itemsPorColuna, filhosDoItem, temBoard,
  } = useBacklog(projetoId, userId);

  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = useState("");
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroVencidos, setFiltroVencidos] = useState(false);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string[]>([]);
  const [filtroFrente, setFiltroFrente] = useState<string[]>([]);
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("");
  const [ocultarCancelados, setOcultarCancelados] = useState(true);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [novoItemOpen, setNovoItemOpen] = useState(false);
  const [novoItemColuna, setNovoItemColuna] = useState<string | undefined>();
  const [itemDetalhado, setItemDetalhado] = useState<BacklogItem | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverColuna, setDragOverColuna] = useState<string | null>(null);
  // BL-004-C - Detalhe, historico e comentarios
  const [detalheTab, setDetalheTab] = useState("info");
  const [comentarios, setComentarios] = useState<BacklogComentario[]>([]);
  const [historico, setHistorico] = useState<BacklogHistorico[]>([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [novoComentario, setNovoComentario] = useState("");
  const [savingComentario, setSavingComentario] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState<Partial<BacklogItem>>({});
  // BL-004-D - Colunas e participantes
  const [configColunasOpen, setConfigColunasOpen] = useState(false);
  const [novaColunaNome, setNovaColunaNome] = useState("");
  const [novaColunaCor, setNovaColunaCor] = useState("#6366f1");
  const [savingColuna, setSavingColuna] = useState(false);
  const [editandoColuna, setEditandoColuna] = useState<string | null>(null);
  const [editColunaNome, setEditColunaNome] = useState("");
  const [editColunaCor, setEditColunaCor] = useState("");
  const [participantes, setParticipantes] = useState<BacklogParticipante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [profilesDisponiveis, setProfilesDisponiveis] = useState<{user_id: string; name: string}[]>([]);
  const [novoPartUserId, setNovoPartUserId] = useState("");
  const [novoPartPapel, setNovoPartPapel] = useState("observador");
  const [excelExporting, setExcelExporting] = useState(false);


  const handleExportarExcel = async () => {
    if (!projetoId) return;
    setExcelExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Aceex";
      wb.created = new Date();

      const hoje = new Date().toLocaleDateString("pt-BR");
      const nomeArq = `${projetoNome}_Backlog_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Cores
      const COR_HEADER = "1F4E79";
      const COR_HEADER_FONT = "FFFFFF";
      const COR_ALT = "F2F2F2";
      const COR_CRIT_BG = "FCEBEB"; const COR_CRIT_FG = "A32D2D";
      const COR_ALTA_BG = "FAEEDA"; const COR_ALTA_FG = "854F0B";
      const COR_MED_BG  = "E6F1FB"; const COR_MED_FG  = "185FA5";
      const COR_BX_BG   = "EAF3DE"; const COR_BX_FG   = "3B6D11";
      const COR_VENC    = "A32D2D";

      const priCores: Record<string, { bg: string; fg: string }> = {
        critica: { bg: COR_CRIT_BG, fg: COR_CRIT_FG },
        alta:    { bg: COR_ALTA_BG, fg: COR_ALTA_FG },
        media:   { bg: COR_MED_BG,  fg: COR_MED_FG  },
        baixa:   { bg: COR_BX_BG,   fg: COR_BX_FG   },
      };

      const stCores: Record<string, { bg: string; fg: string }> = {
        aberto:       { bg: "FAEEDA", fg: "854F0B" },
        em_andamento: { bg: "E6F1FB", fg: "185FA5" },
        em_revisao:   { bg: "EEEDFE", fg: "3C3489" },
        concluido:    { bg: "EAF3DE", fg: "3B6D11" },
        cancelado:    { bg: "F1EFE8", fg: "5F5E5A" },
      };

      const styleHeader = (row: ExcelJS.Row) => {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_HEADER } };
          cell.font = { bold: true, color: { argb: "FF" + COR_HEADER_FONT }, name: "Arial", size: 10 };
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
          cell.border = { bottom: { style: "thin", color: { argb: "FF2a5a8a" } } };
        });
        row.height = 20;
      };

      const styleAlt = (row: ExcelJS.Row, rowIdx: number) => {
        if (rowIdx % 2 === 0) {
          row.eachCell(cell => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_ALT } };
          });
        }
        row.eachCell(cell => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = { vertical: "middle" };
        });
        row.height = 18;
      };

      const fmtData = (d: string | null | undefined) =>
        d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "";

      const isVencida = (d: string | null | undefined, colId: string) => {
        if (!d) return false;
        const col = colunas.find(c => c.id === colId);
        if (col?.status_sistema === "concluido" || col?.status_sistema === "cancelado") return false;
        return new Date(d + "T00:00:00") < new Date();
      };

      const itensFiltrados = items.filter(i => !i.pai_id);

      // ?? ABA DASHBOARD ?????????????????????????????????????????????????????
      const wsDash = wb.addWorksheet("Dashboard");
      wsDash.columns = [
        { key: "a", width: 28 }, { key: "b", width: 22 },
        { key: "c", width: 14 }, { key: "d", width: 14 },
        { key: "e", width: 14 }, { key: "f", width: 14 },
      ];

      // Titulo
      wsDash.mergeCells("A1:F1");
      const tituloCell = wsDash.getCell("A1");
      tituloCell.value = `Backlog do Projeto - ${projetoNome}`;
      tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_HEADER } };
      tituloCell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 13 };
      tituloCell.alignment = { horizontal: "left", vertical: "middle" };
      wsDash.getRow(1).height = 28;

      wsDash.getCell("A2").value = "Gerado em";
      wsDash.getCell("B2").value = hoje;
      wsDash.getCell("A3").value = "Exportado por";
      wsDash.getCell("B3").value = "coordenador";
      [2,3].forEach(r => {
        wsDash.getRow(r).font = { name: "Arial", size: 10, color: { argb: "FF666666" } };
        wsDash.getRow(r).height = 16;
      });

      // KPIs
      const total = itensFiltrados.length;
      const concluidos = itensFiltrados.filter(i => colunas.find(c => c.id === i.coluna_id)?.status_sistema === "concluido").length;
      const criticos = itensFiltrados.filter(i => (i.prioridade_reclassificada || i.prioridade) === "critica" && colunas.find(c => c.id === i.coluna_id)?.status_sistema !== "concluido").length;
      const vencidos = itensFiltrados.filter(i => isVencida(i.data_prevista, i.coluna_id)).length;

      wsDash.addRow([]);
      const kpiHeaderRow = wsDash.addRow(["KPI", "Valor"]);
      styleHeader(kpiHeaderRow);
      wsDash.mergeCells(`A${kpiHeaderRow.number}:B${kpiHeaderRow.number}`);
      kpiHeaderRow.getCell(1).value = "Indicadores";

      const kpis = [
        ["Total de itens", total, "FF185FA5"],
        ["Concluidos", concluidos, "FF3B6D11"],
        ["Criticos em aberto", criticos, "FFA32D2D"],
        ["Vencidos", vencidos, "FF854F0B"],
      ];
      kpis.forEach(([label, val, color], idx) => {
        const r = wsDash.addRow([label, val]);
        styleAlt(r, idx);
        r.getCell(2).font = { bold: true, color: { argb: color as string }, name: "Arial", size: 11 };
      });

      wsDash.addRow([]);
      const colHeaderRow = wsDash.addRow(["Coluna", "Total", "Critica", "Alta", "Media", "Baixa"]);
      styleHeader(colHeaderRow);

      colunas.sort((a, b) => a.ordem - b.ordem).forEach((col, idx) => {
        const iCol = itensFiltrados.filter(i => i.coluna_id === col.id);
        const r = wsDash.addRow([
          col.nome,
          iCol.length,
          iCol.filter(i => (i.prioridade_reclassificada || i.prioridade) === "critica").length,
          iCol.filter(i => (i.prioridade_reclassificada || i.prioridade) === "alta").length,
          iCol.filter(i => (i.prioridade_reclassificada || i.prioridade) === "media").length,
          iCol.filter(i => (i.prioridade_reclassificada || i.prioridade) === "baixa").length,
        ]);
        styleAlt(r, idx);
        if (iCol.filter(i => (i.prioridade_reclassificada || i.prioridade) === "critica").length > 0) {
          r.getCell(3).font = { bold: true, color: { argb: "FF" + COR_CRIT_FG }, name: "Arial", size: 10 };
        }
      });

      // ?? ABA BACKLOG ????????????????????????????????????????????????????????
      const wsBacklog = wb.addWorksheet("Backlog");
      wsBacklog.columns = [
        { header: "Codigo",        key: "codigo",    width: 10 },
        { header: "Titulo",        key: "titulo",    width: 42 },
        { header: "Tipo",          key: "tipo",      width: 14 },
        { header: "Prioridade",    key: "prioridade",width: 12 },
        { header: "Frente",        key: "frente",    width: 14 },
        { header: "Status",        key: "status",    width: 16 },
        { header: "Responsavel",   key: "resp",      width: 22 },
        { header: "Est (h)",       key: "est",       width: 10 },
        { header: "Efetivo (h)",   key: "ef",        width: 12 },
        { header: "Data prevista", key: "prev",      width: 14 },
        { header: "Meta conclusao",key: "meta",      width: 14 },
        { header: "Conclusao",     key: "concl",     width: 14 },
        { header: "Criado em",     key: "criado",    width: 14 },
        { header: "Criado por",    key: "criadopor", width: 22 },
      ];

      styleHeader(wsBacklog.getRow(1));
      wsBacklog.views = [{ state: "frozen", ySplit: 1 }];
      wsBacklog.autoFilter = { from: "A1", to: "N1" };

      itensFiltrados.forEach((item, idx) => {
        const col = colunas.find(c => c.id === item.coluna_id);
        const pri = item.prioridade_reclassificada || item.prioridade;
        const venc = isVencida(item.data_prevista, item.coluna_id);

        const r = wsBacklog.addRow({
          codigo: item.codigo,
          titulo: item.titulo,
          tipo: item.tipo,
          prioridade: pri,
          frente: item.frente_modulo,
          status: col?.nome || "",
          resp: item.atribuido_para_nome || "",
          est: item.estimativa_horas || "",
          ef: item.tempo_efetivo_horas || "",
          prev: fmtData(item.data_prevista),
          meta: fmtData((item as any).data_conclusao_desejada),
          concl: fmtData(item.data_conclusao),
          criado: fmtData(item.created_at.split("T")[0]),
          criadopor: item.criado_por_nome || "",
        });
        styleAlt(r, idx);

        // Cor prioridade
        const pc = priCores[pri];
        if (pc) {
          r.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + pc.bg } };
          r.getCell(4).font = { bold: true, color: { argb: "FF" + pc.fg }, name: "Arial", size: 10 };
        }

        // Cor status
        const sc = stCores[col?.status_sistema || ""];
        if (sc) {
          r.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + sc.bg } };
          r.getCell(6).font = { bold: true, color: { argb: "FF" + sc.fg }, name: "Arial", size: 10 };
        }

        // Data vencida em vermelho
        if (venc) {
          r.getCell(10).font = { bold: true, color: { argb: "FF" + COR_VENC }, name: "Arial", size: 10 };
        }

        // Codigo em mono
        r.getCell(1).font = { name: "Courier New", size: 9, color: { argb: "FF666666" } };
      });

      // ?? ABA RESUMO ?????????????????????????????????????????????????????????
      const wsResumo = wb.addWorksheet("Resumo");
      wsResumo.columns = [
        { width: 20 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      ];

      const addResumoHeader = (titulo: string) => {
        const r = wsResumo.addRow([titulo]);
        wsResumo.mergeCells(`A${r.number}:F${r.number}`);
        r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_HEADER } };
        r.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
        r.height = 20;
        return r;
      };

      addResumoHeader("Itens por coluna x prioridade");
      const rh = wsResumo.addRow(["Coluna", "Total", "Critica", "Alta", "Media", "Baixa"]);
      styleHeader(rh);

      colunas.sort((a,b) => a.ordem - b.ordem).forEach((col, idx) => {
        const iCol = itensFiltrados.filter(i => i.coluna_id === col.id);
        const r = wsResumo.addRow([
          col.nome, iCol.length,
          iCol.filter(i => (i.prioridade_reclassificada||i.prioridade)==="critica").length,
          iCol.filter(i => (i.prioridade_reclassificada||i.prioridade)==="alta").length,
          iCol.filter(i => (i.prioridade_reclassificada||i.prioridade)==="media").length,
          iCol.filter(i => (i.prioridade_reclassificada||i.prioridade)==="baixa").length,
        ]);
        styleAlt(r, idx);
        r.getCell(1).font = { bold: false, name: "Arial", size: 10 };
      });

      wsResumo.addRow([]);
      addResumoHeader("Acuracia de estimativas");
      const estH = wsResumo.addRow(["Metrica", "Valor"]);
      styleHeader(estH);
      const concl = itensFiltrados.filter(i => colunas.find(c=>c.id===i.coluna_id)?.status_sistema==="concluido");
      const totalEst = itensFiltrados.reduce((s,i) => s+(i.estimativa_horas||0), 0);
      const totalEf = concl.reduce((s,i) => s+(i.tempo_efetivo_horas||0), 0);
      [
        ["Total estimado (h)", totalEst],
        ["Total efetivo - concluidos (h)", totalEf],
        ["Itens vencidos", vencidos],
        ["Itens concluidos", concluidos],
      ].forEach(([label, val], idx) => {
        const r = wsResumo.addRow([label, val]);
        styleAlt(r, idx);
      });

      // ?? ABA EVOLUTIVO ??????????????????????????????????????????????????????
      const wsEv = wb.addWorksheet("Evolutivo");
      const colsSorted = [...colunas].sort((a,b) => a.ordem - b.ordem)
        .filter(c => c.status_sistema !== "cancelado");

      // Calcular larguras
      const evColWidths = [10, 38, 12, 14];
      colsSorted.forEach(() => { evColWidths.push(22, 18); });
      wsEv.columns = evColWidths.map(w => ({ width: w }));

      // Linha 1 - grupos de colunas (merged)
      const ev1 = wsEv.addRow(["Codigo", "Titulo", "Prioridade", "Meta",
        ...colsSorted.flatMap(col => [col.nome, ""])]);
      styleHeader(ev1);
      // Merge grupos
      let colOffset = 5;
      colsSorted.forEach(col => {
        const startCol = colOffset;
        const endCol = colOffset + 1;
        if (startCol !== endCol) {
          wsEv.mergeCells(1, startCol, 1, endCol);
        }
        const cell = wsEv.getCell(1, startCol);
        cell.value = col.nome;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16457A" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        colOffset += 2;
      });

      // Linha 2 - sub-headers
      const ev2 = wsEv.addRow(["", "", "", "",
        ...colsSorted.flatMap(() => ["Entrada / Resp", "Saida / Prev"])]);
      styleHeader(ev2);
      ev2.eachCell(cell => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      wsEv.views = [{ state: "frozen", ySplit: 2, xSplit: 2 }];

      const historico = await loadHistoricoEvolutivo();

      // Cores para fases
      const COR_FASE_PAST_BG = "F5F5F5";
      const COR_FASE_PAST_FG = "999999";
      const COR_FASE_CUR_BG  = "EAF3FB";
      const COR_FASE_CUR_FG  = "0C447C";
      const COR_FASE_CUR_BD  = "1F4E79";

      itensFiltrados.forEach((item, rowIdx) => {
        const pri = item.prioridade_reclassificada || item.prioridade;
        const pc = priCores[pri];
        const rowData: any[] = [
          item.codigo,
          item.titulo,
          pri,
          fmtData((item as any).data_conclusao_desejada),
        ];

        const itemHist = historico
          .filter((h: any) => h.backlog_item_id === item.id)
          .sort((a: any, b: any) => new Date(a.moved_at).getTime() - new Date(b.moved_at).getTime());

        colsSorted.forEach(col => {
          const entrada = itemHist.find((h: any) => h.para_coluna_id === col.id);
          const saida = itemHist.find((h: any) => h.de_coluna_id === col.id);

          if (!entrada) {
            rowData.push("", "");
          } else {
            const entradaStr = fmtData(entrada.moved_at.split("T")[0]);
            const resp = entrada.atribuido_para_nome || entrada.movido_por_nome || "";
            const saidaStr = saida ? fmtData(saida.moved_at.split("T")[0]) : "";
            const prevStr = entrada.data_prevista_fase ? fmtData(entrada.data_prevista_fase) : "";
            rowData.push(
              entradaStr + (resp ? " / " + resp : ""),
              saidaStr || (prevStr ? "prev: " + prevStr : "")
            );
          }
        });

        const r = wsEv.addRow(rowData);
        r.height = 18;
        r.getCell(1).font = { name: "Courier New", size: 9, color: { argb: "FF888888" } };

        // Cor prioridade
        if (pc) {
          r.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + pc.bg } };
          r.getCell(3).font = { bold: true, color: { argb: "FF" + pc.fg }, name: "Arial", size: 10 };
        }

        // Colorir fases
        const colIdx = colunas.findIndex(c => c.id === item.coluna_id);
        let cellOffset = 5;
        colsSorted.forEach((col, ci) => {
          const faseIdx = colsSorted.findIndex(c2 => c2.id === col.id);
          const itemColIdx = colsSorted.findIndex(c2 => c2.id === item.coluna_id);
          const entrada = itemHist.find((h: any) => h.para_coluna_id === col.id);

          if (!entrada) {
            // Futura - transparente
            [cellOffset, cellOffset+1].forEach(cc => {
              const cell = r.getCell(cc);
              cell.font = { color: { argb: "FFCCCCCC" }, name: "Arial", size: 9 };
              cell.alignment = { horizontal: "center", vertical: "middle" };
            });
          } else if (faseIdx < itemColIdx) {
            // Passada - cinza claro
            [cellOffset, cellOffset+1].forEach(cc => {
              const cell = r.getCell(cc);
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_FASE_PAST_BG } };
              cell.font = { color: { argb: "FF" + COR_FASE_PAST_FG }, name: "Arial", size: 9 };
              cell.alignment = { horizontal: "center", vertical: "middle" };
            });
          } else {
            // Atual - azul claro com borda
            [cellOffset, cellOffset+1].forEach(cc => {
              const cell = r.getCell(cc);
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_FASE_CUR_BG } };
              cell.font = { bold: true, color: { argb: "FF" + COR_FASE_CUR_FG }, name: "Arial", size: 9 };
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.border = {
                top: { style: "thin", color: { argb: "FF" + COR_FASE_CUR_BD } },
                bottom: { style: "thin", color: { argb: "FF" + COR_FASE_CUR_BD } },
                left: cc === cellOffset ? { style: "medium", color: { argb: "FF" + COR_FASE_CUR_BD } } : undefined,
                right: cc === cellOffset+1 ? { style: "medium", color: { argb: "FF" + COR_FASE_CUR_BD } } : undefined,
              };
            });
          }
          cellOffset += 2;
        });

        // Linhas alternadas para colunas fixas
        if (rowIdx % 2 === 0) {
          [1,2,3,4].forEach(cc => {
            const cell = r.getCell(cc);
            if (!cell.fill || (cell.fill as any).fgColor?.argb === "00000000") {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COR_ALT } };
            }
          });
        }
        [1,2,3,4].forEach(cc => {
          r.getCell(cc).font = r.getCell(cc).font || { name: "Arial", size: 10 };
        });
      });

      // Download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArq;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel exportado!", description: nomeArq });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
    setExcelExporting(false);
  };
;

  const abrirDetalhe = async (item: BacklogItem) => {
    setItemDetalhado(item);
    setDetalheTab("info");
    setEditando(false);
    setEditForm({});
    setLoadingDetalhe(true);
    setLoadingParticipantes(true);
    const [coms, hist, parts] = await Promise.all([
      loadComentarios(item.id),
      loadHistorico(item.id),
      loadParticipantes(item.id),
    ]);
    setComentarios(coms);
    setHistorico(hist);
    setParticipantes(parts);
    setLoadingDetalhe(false);
    setLoadingParticipantes(false);
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").order("name");
    setProfilesDisponiveis(profiles || []);
  };

  const handleCriarColuna = async () => {
    if (!novaColunaNome.trim()) return;
    setSavingColuna(true);
    await criarColuna(novaColunaNome.trim(), novaColunaCor);
    setNovaColunaNome("");
    setNovaColunaCor("#6366f1");
    setSavingColuna(false);
    toast({ title: "Coluna criada!" });
  };

  const handleRenomearColuna = async (colunaId: string) => {
    if (!editColunaNome.trim()) return;
    await renomearColuna(colunaId, editColunaNome.trim(), editColunaCor);
    setEditandoColuna(null);
    toast({ title: "Coluna atualizada!" });
  };

  const handleExcluirColuna = async (colunaId: string) => {
    const ok = await excluirColuna(colunaId);
    if (!ok) {
      toast({ title: "Nao e possivel excluir", description: "Coluna protegida ou com itens.", variant: "destructive" });
    } else {
      toast({ title: "Coluna excluida!" });
    }
  };

  const handleAdicionarParticipante = async () => {
    if (!itemDetalhado || !novoPartUserId) return;
    await adicionarParticipante(itemDetalhado.id, novoPartUserId, novoPartPapel);
    const parts = await loadParticipantes(itemDetalhado.id);
    setParticipantes(parts);
    setNovoPartUserId("");
    toast({ title: "Participante adicionado!" });
  };

  const handleRemoverParticipante = async (partId: string) => {
    await removerParticipante(partId);
    setParticipantes(prev => prev.filter(p => p.id !== partId));
  };

  const handleSalvarEdicao = async () => {
    if (!itemDetalhado) return;
    const formParaSalvar = {
      ...editForm,
      prioridade_reclassificada: editForm.prioridade_reclassificada === "none" ? null : editForm.prioridade_reclassificada,
    };
    await salvarItem(itemDetalhado.id, formParaSalvar);
    toast({ title: "Item atualizado!" });
    setEditando(false);
    setEditForm({});
    setItemDetalhado(prev => prev ? { ...prev, ...editForm } : null);
  };

  const handleEnviarComentario = async () => {
    if (!itemDetalhado || !novoComentario.trim()) return;
    setSavingComentario(true);
    const ok = await adicionarComentario(itemDetalhado.id, novoComentario);
    if (ok) {
      setNovoComentario("");
      const coms = await loadComentarios(itemDetalhado.id);
      setComentarios(coms);
      toast({ title: "Comentario adicionado!" });
    }
    setSavingComentario(false);
  };

  const labelEvento = (tipo: string) => {
    const labels: Record<string, string> = {
      criacao: "Item criado",
      movimentacao: "Movido",
      movimentacao_bloco: "Movido em bloco",
      edicao: "Editado",
      comentario: "Comentario adicionado",
      atribuicao: "Atribuiao alterada",
      cadeado_alterado: "Cadeado alterado",
    };
    return labels[tipo] || tipo;
  };

  useEffect(() => {
    if (projetoId) loadBoard();
  }, [projetoId, loadBoard]);

  const itemPassaFiltro = (i: BacklogItem): boolean => {
    if (busca) {
      const q = busca.toLowerCase();
      if (!i.codigo.toLowerCase().includes(q) &&
          !i.titulo.toLowerCase().includes(q) &&
          !(i.descricao_solicitante || "").toLowerCase().includes(q)) return false;
    }
    if (filtroMeus && i.atribuido_para !== userId) return false;
    if (filtroVencidos) {
      const col = colunas.find(c => c.id === i.coluna_id);
      if (!isVencido(i.data_prevista, col?.status_sistema || null)) return false;
    }
    if (filtroPrioridade.length > 0) {
      const pri = i.prioridade_reclassificada || i.prioridade;
      if (!filtroPrioridade.includes(pri)) return false;
    }
    if (filtroFrente.length > 0 && !filtroFrente.includes(i.frente_modulo)) return false;
    if (filtroResponsavel && i.atribuido_para !== filtroResponsavel) return false;
    if (ocultarCancelados) {
      const col = colunas.find(c => c.id === i.coluna_id);
      if (col?.status_sistema === "cancelado") return false;
    }
    return true;
  };

  const filtrarItems = (lista: BacklogItem[]) => lista.filter(itemPassaFiltro);

  // Ordenacao: prioridade desc + created_at asc dentro da coluna
  const PRIO_ORDER: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
  const sortItems = (lista: BacklogItem[]) =>
    [...lista].sort((a, b) => {
      const pa = PRIO_ORDER[a.prioridade_reclassificada || a.prioridade] ?? 9;
      const pb = PRIO_ORDER[b.prioridade_reclassificada || b.prioridade] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const handleDrop = async (colunaId: string) => {
    if (!dragItemId || dragItemId === colunaId) return;
    const item = items.find(i => i.id === dragItemId);
    if (!item) return;
    const filhos = filhosDoItem(dragItemId);
    const comFilhos = filhos.length > 0 && item.hierarquia_bloqueada;
    await moverItem(dragItemId, colunaId, comFilhos);
    setDragItemId(null);
    setDragOverColuna(null);
  };

  const handleCriarItem = async (data: Partial<BacklogItem>) => {
    const novo = await criarItem(data);
    if (novo) {
      toast({ title: "Item criado!", description: novo.codigo });
      setNovoItemOpen(false);
    } else {
      toast({ title: "Erro ao criar item", variant: "destructive" });
    }
  };

  // ?? ONBOARDING ??
  if (loadingBoard) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalItems = items.filter(i => !i.pai_id).length;
  const itemsFiltrados = filtrarItems(items.filter(i => !i.pai_id));

  // ?? VISTA LISTA ??
  const renderLista = () => (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            {["Codigo", "Titulo", "Frente", "Prioridade", "Status", "Prevista", "Responsavel"].map(h => (
              <th key={h} className="text-left p-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortItems(itemsFiltrados).length === 0 ? (
            <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum item encontrado</td></tr>
          ) : sortItems(itemsFiltrados).map(item => {
            const col = colunas.find(c => c.id === item.coluna_id);
            const vencido = isVencido(item.data_prevista, col?.status_sistema || null);
            return (
              <tr key={item.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => abrirDetalhe(item)}>
                <td className="p-2 font-mono text-[10px] text-muted-foreground">{item.codigo}</td>
                <td className="p-2 font-medium max-w-[180px] truncate">{item.titulo}</td>
                <td className="p-2 text-muted-foreground">{FRENTE_OPTIONS.find(f => f.value === item.frente_modulo)?.label}</td>
                <td className="p-2"><PriBadge prioridade={item.prioridade} reclassificada={item.prioridade_reclassificada} /></td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: col?.cor + "22", color: col?.cor }}>
                    {col?.nome}
                  </span>
                </td>
                <td className={`p-2 ${vencido ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                  {item.data_prevista ? format(parseISO(item.data_prevista), "dd/MM/yy") : "-"}
                </td>
                <td className="p-2 text-muted-foreground">{item.atribuido_para_nome || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ?? VISTA KANBAN ??
  const renderKanban = () => (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {colunas.map(col => {
        const colItems = sortItems(filtrarItems(itemsPorColuna(col.id)));
        const wipAtingido = col.wip_limite !== null && colItems.length >= col.wip_limite;
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-52 flex flex-col gap-2"
            onDragOver={e => { e.preventDefault(); setDragOverColuna(col.id); }}
            onDragLeave={() => setDragOverColuna(null)}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Header coluna */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${dragOverColuna === col.id ? "bg-accent/50 border-accent" : "bg-muted/30"}`}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.cor }} />
                <span className="text-xs font-semibold truncate max-w-[90px]">{col.nome}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${wipAtingido ? "bg-red-100 text-red-700 animate-pulse" : "bg-muted text-muted-foreground"}`}>
                  {wipAtingido && <AlertCircle className="h-2.5 w-2.5" />}
                  {colItems.length}{col.wip_limite ? `/${col.wip_limite}` : ""}
                </span>
                <button
                  onClick={() => { setNovoItemColuna(col.id); setNovoItemOpen(true); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className={`flex flex-col gap-2 min-h-[80px] rounded-xl p-1 transition-colors ${dragOverColuna === col.id ? "bg-accent/20" : ""}`}>
              {colItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  colunaStatus={col.status_sistema}
                  colunas={colunas}
                  onMove={moverItem}
                  onOpen={abrirDetalhe}
                  isDragging={dragItemId === item.id}
                  onDragStart={() => setDragItemId(item.id)}
                  onDragEnd={() => { setDragItemId(null); setDragOverColuna(null); }}
                  filhos={filhosDoItem(item.id)}
                  isCoordinator={isCoordinator}
                  dimmed={!!busca && !itemPassaFiltro(item)}
                />
              ))}
              {colItems.length === 0 && (
                <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground/50 border border-dashed rounded-lg">
                  Solte aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Header do board */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-semibold text-foreground">{projetoNome}</div>
            <div className="text-[10px] text-muted-foreground">
              {totalItems} {totalItems === 1 ? "item" : "itens"} · {items.filter(i => !i.pai_id && colunas.find(c => c.id === i.coluna_id)?.status_sistema === "concluido").length} concluidos
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("kanban")}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${view === "kanban" ? "bg-muted border-border" : "border-transparent text-muted-foreground"}`}
              title="Kanban"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("lista")}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${view === "lista" ? "bg-muted border-border" : "border-transparent text-muted-foreground"}`}
              title="Lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            {isCoordinator && (
              <>
                <button
                  onClick={() => setConfigColunasOpen(true)}
                  className="p-1.5 rounded-lg border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Configurar colunas"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleExportarExcel}
                  disabled={excelExporting}
                  className="p-1.5 rounded-lg border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  title="Exportar Excel"
                >
                  {excelExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                </button>
              </>
            )}
            <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => { setNovoItemColuna(undefined); setNovoItemOpen(true); }}>
              <Plus className="h-3.5 w-3.5" />
              Novo item
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar codigo, titulo..."
              className="pl-7 h-7 text-xs"
            />
          </div>
          <button
            onClick={() => setFiltroMeus(v => !v)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${filtroMeus ? "bg-violet-100 border-violet-300 text-violet-700" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Meus itens
          </button>
          <button
            onClick={() => setFiltroVencidos(v => !v)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${filtroVencidos ? "bg-red-100 border-red-300 text-red-700" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Vencidos
          </button>
          <button
            onClick={() => setOcultarCancelados(v => !v)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${!ocultarCancelados ? "bg-amber-100 border-amber-300 text-amber-700" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {ocultarCancelados ? "Ver cancelados" : "Ocultar cancelados"}
          </button>
          {/* Filtro por prioridade */}
          {["critica","alta","media","baixa"].map(pri => (
            <button key={pri}
              onClick={() => setFiltroPrioridade(prev => prev.includes(pri) ? prev.filter(p=>p!==pri) : [...prev,pri])}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors capitalize ${filtroPrioridade.includes(pri) ? "bg-violet-100 border-violet-300 text-violet-700" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {pri}
            </button>
          ))}
          {/* Filtro responsavel (coordenador) */}
          {isCoordinator && (
            <select
              value={filtroResponsavel}
              onChange={e => setFiltroResponsavel(e.target.value)}
              className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted-foreground bg-background hover:bg-muted h-7"
            >
              <option value="">Todos responsaveis</option>
              {[...new Set(items.map(i => i.atribuido_para).filter(Boolean))].map(uid => {
                const nome = items.find(i => i.atribuido_para === uid)?.atribuido_para_nome || uid;
                return <option key={uid} value={uid!}>{nome}</option>;
              })}
            </select>
          )}
          {(busca || filtroMeus || filtroVencidos || filtroPrioridade.length > 0 || filtroResponsavel || !ocultarCancelados) && (
            <button
              onClick={() => { setBusca(""); setFiltroMeus(false); setFiltroVencidos(false); setFiltroPrioridade([]); setFiltroResponsavel(""); setOcultarCancelados(true); }}
              className="text-[10px] px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Board */}
        {view === "kanban" ? renderKanban() : renderLista()}
      </div>

      {/* Modal novo item */}
      <NovoItemModal
        open={novoItemOpen}
        onClose={() => setNovoItemOpen(false)}
        onSave={handleCriarItem}
        colunas={colunas}
        saving={savingItem}
        projetoNome={projetoNome}
        colunaInicial={novoItemColuna}
      />

      {/* Modal detalhe do item - BL-004-C */}
      {itemDetalhado && (
        <Dialog open={!!itemDetalhado} onOpenChange={() => { setItemDetalhado(null); setEditando(false); }}>
          <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-2xl">
            <DialogHeader className="shrink-0 border-b px-5 py-3">
              <div className="flex items-center gap-2 pr-8">
                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{itemDetalhado.codigo}</span>
                <DialogTitle className="flex-1 truncate text-sm">{itemDetalhado.titulo}</DialogTitle>
                {isCoordinator && !editando && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs shrink-0" onClick={() => { setEditando(true); setEditForm({ titulo: itemDetalhado.titulo, descricao_solicitante: itemDetalhado.descricao_solicitante, descricao_complementar: itemDetalhado.descricao_complementar, descricao_solucao: itemDetalhado.descricao_solucao, prioridade: itemDetalhado.prioridade, prioridade_reclassificada: itemDetalhado.prioridade_reclassificada || "none", estimativa_horas: itemDetalhado.estimativa_horas, tempo_efetivo_horas: itemDetalhado.tempo_efetivo_horas, data_prevista: itemDetalhado.data_prevista, data_conclusao: itemDetalhado.data_conclusao, atribuido_para: itemDetalhado.atribuido_para, data_conclusao_desejada: (itemDetalhado as any).data_conclusao_desejada || null }); }}>
                    <Edit2 className="h-3 w-3" /> Editar
                  </Button>
                )}
              </div>
            </DialogHeader>

            <Tabs value={detalheTab} onValueChange={setDetalheTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-5 mt-3 shrink-0 w-fit">
                <TabsTrigger value="info" className="text-xs gap-1"><Tag className="h-3 w-3" />Detalhe</TabsTrigger>
                <TabsTrigger value="participantes" className="text-xs gap-1">
                  <Users className="h-3 w-3" />Participantes
                  {participantes.length > 0 && <span className="text-[9px] bg-muted rounded-full px-1">{participantes.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="comentarios" className="text-xs gap-1">
                  <MessageSquare className="h-3 w-3" />Comentarios
                  {comentarios.length > 0 && <span className="text-[9px] bg-muted rounded-full px-1">{comentarios.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-xs gap-1"><History className="h-3 w-3" />Historico</TabsTrigger>
              </TabsList>

              {/* ?? ABA INFO ?? */}
              <TabsContent value="info" className="flex-1 overflow-y-auto px-5 pb-4 mt-3 space-y-4">
                {editando ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Titulo</Label>
                      <Input value={editForm.titulo || ""} onChange={e => setEditForm(p => ({ ...p, titulo: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Detalhamento do solicitante</Label>
                      <Textarea rows={3} className="resize-none text-sm" value={editForm.descricao_solicitante || ""} onChange={e => setEditForm(p => ({ ...p, descricao_solicitante: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Complemento (coordenador)</Label>
                      <Textarea rows={2} className="resize-none text-sm" value={editForm.descricao_complementar || ""} onChange={e => setEditForm(p => ({ ...p, descricao_complementar: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Prioridade original</Label>
                        <Select value={editForm.prioridade || "media"} onValueChange={v => setEditForm(p => ({ ...p, prioridade: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critica">Critica</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="baixa">Baixa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Reclassificaao</Label>
                        <Select value={editForm.prioridade_reclassificada || "none"} onValueChange={v => setEditForm(p => ({ ...p, prioridade_reclassificada: v || null }))}>
                          <SelectTrigger><SelectValue placeholder="Sem reclassificaao" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem reclassificaao</SelectItem>
                            <SelectItem value="critica">Critica</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="baixa">Baixa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Estimativa (h)</Label>
                        <Input type="number" min="0" step="0.5" value={editForm.estimativa_horas || ""} onChange={e => setEditForm(p => ({ ...p, estimativa_horas: parseFloat(e.target.value) || null }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tempo efetivo (h)</Label>
                        <Input type="number" min="0" step="0.5" value={editForm.tempo_efetivo_horas || ""} onChange={e => setEditForm(p => ({ ...p, tempo_efetivo_horas: parseFloat(e.target.value) || null }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data prevista</Label>
                        <Input type="date" value={editForm.data_prevista || ""} onChange={e => setEditForm(p => ({ ...p, data_prevista: e.target.value || null }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data conclusao</Label>
                        <Input type="date" value={editForm.data_conclusao || ""} onChange={e => setEditForm(p => ({ ...p, data_conclusao: e.target.value || null }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Atribuido para</Label>
                        <Select value={editForm.atribuido_para || "none"} onValueChange={v => setEditForm(p => ({ ...p, atribuido_para: v === "none" ? null : v }))}>
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {profilesDisponiveis.map(p => (
                              <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Meta de conclusao desejada</Label>
                        <Input type="date" value={(editForm as any).data_conclusao_desejada || ""} onChange={e => setEditForm(p => ({ ...p, data_conclusao_desejada: e.target.value || null }))} />
                      </div>
                    </div>
                    {isCoordinator && (
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="checkbox"
                          id="visivel_cliente"
                          checked={!!(editForm as any).visivel_cliente}
                          onChange={e => setEditForm(p => ({ ...p, visivel_cliente: e.target.checked }))}
                          className="h-4 w-4 rounded border-border"
                        />
                        <label htmlFor="visivel_cliente" className="text-xs text-muted-foreground cursor-pointer">
                          Visivel para o cliente (Portal do Cliente)
                        </label>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Detalhamento da soluao</Label>
                      <Textarea rows={3} className="resize-none text-sm" value={editForm.descricao_solucao || ""} onChange={e => setEditForm(p => ({ ...p, descricao_solucao: e.target.value }))} placeholder="Descreva a soluao implementada..." />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={handleSalvarEdicao} disabled={savingItem} className="gap-1">
                        {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditando(false); setEditForm({}); }}>Cancelar</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <PriBadge prioridade={itemDetalhado.prioridade} reclassificada={itemDetalhado.prioridade_reclassificada} />
                      <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{FRENTE_OPTIONS.find(f => f.value === itemDetalhado.frente_modulo)?.label}</span>
                      <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{TIPO_OPTIONS.find(t => t.value === itemDetalhado.tipo)?.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-[10px] text-muted-foreground">Criado por</p><p className="font-medium">{itemDetalhado.criado_por_nome || "-"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Atribuido para</p><p className="font-medium">{itemDetalhado.atribuido_para_nome || "-"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Estimativa</p><p className="font-medium">{itemDetalhado.estimativa_horas ? `${itemDetalhado.estimativa_horas}h` : "-"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Tempo efetivo</p><p className="font-medium">{itemDetalhado.tempo_efetivo_horas ? `${itemDetalhado.tempo_efetivo_horas}h` : "-"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Data prevista</p><p className="font-medium">{itemDetalhado.data_prevista ? format(parseISO(itemDetalhado.data_prevista), "dd/MM/yyyy") : "-"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Data conclusao</p><p className="font-medium">{itemDetalhado.data_conclusao ? format(parseISO(itemDetalhado.data_conclusao), "dd/MM/yyyy") : "-"}</p></div>
                    </div>
                    {itemDetalhado.descricao_solicitante && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Detalhamento do solicitante</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{itemDetalhado.descricao_solicitante}</p>
                      </div>
                    )}
                    {itemDetalhado.descricao_complementar && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Complemento (coordenador)</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{itemDetalhado.descricao_complementar}</p>
                      </div>
                    )}
                    {itemDetalhado.descricao_solucao && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Soluao implementada</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap bg-emerald-50 border border-emerald-100 rounded-lg p-3">{itemDetalhado.descricao_solucao}</p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ?? ABA PARTICIPANTES ?? */}
              <TabsContent value="participantes" className="flex-1 overflow-y-auto px-5 pb-4 mt-3 space-y-4">
                {loadingParticipantes ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {participantes.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-6 text-center">
                          <Users className="h-6 w-6 text-muted-foreground/30" />
                          <p className="text-xs text-muted-foreground">Nenhum participante adicionado</p>
                        </div>
                      ) : participantes.map(p => (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                            {(p.nome || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{p.nome}</p>
                            <p className="text-[9px] text-muted-foreground capitalize">{p.papel}</p>
                          </div>
                          {isCoordinator && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoverParticipante(p.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {isCoordinator && (
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Adicionar participante</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={novoPartUserId} onValueChange={setNovoPartUserId}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar usuario" /></SelectTrigger>
                            <SelectContent>
                              {profilesDisponiveis.filter(p => !participantes.find(pt => pt.user_id === p.user_id)).map(p => (
                                <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={novoPartPapel} onValueChange={setNovoPartPapel}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="observador">Observador</SelectItem>
                              <SelectItem value="revisor">Revisor</SelectItem>
                              <SelectItem value="aprovador">Aprovador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" className="w-full gap-1.5 h-7 text-xs" onClick={handleAdicionarParticipante} disabled={!novoPartUserId}>
                          <UserPlus className="h-3 w-3" /> Adicionar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ?? ABA COMENTARIOS ?? */}
              <TabsContent value="comentarios" className="flex-1 flex flex-col overflow-hidden mt-3">
                <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-3">
                  {loadingDetalhe ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : comentarios.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <MessageSquare className="h-6 w-6 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Nenhum comentario ainda</p>
                    </div>
                  ) : (
                    comentarios.map(com => (
                      <div key={com.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {(com.autor_nome || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 bg-muted/40 rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold">{com.autor_nome}</span>
                            <span className="text-[9px] text-muted-foreground">{format(new Date(com.created_at), "dd/MM/yyyy HH:mm")}</span>
                          </div>
                          <p className="text-xs text-foreground whitespace-pre-wrap">{com.texto}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="shrink-0 border-t px-5 py-3 flex gap-2">
                  <Textarea
                    value={novoComentario}
                    onChange={e => setNovoComentario(e.target.value)}
                    placeholder="Escreva um comentario..."
                    rows={2}
                    className="resize-none text-sm flex-1"
                    onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleEnviarComentario(); }}
                  />
                  <Button size="sm" onClick={handleEnviarComentario} disabled={savingComentario || !novoComentario.trim()} className="self-end gap-1">
                    {savingComentario ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </TabsContent>

              {/* ?? ABA HISTORICO ?? */}
              <TabsContent value="historico" className="flex-1 overflow-y-auto px-5 pb-4 mt-3">
                {loadingDetalhe ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : historico.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <History className="h-6 w-6 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Nenhum historico disponivel</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4 pl-8">
                      {historico.map((h, i) => (
                        <div key={h.id} className="relative">
                          <div className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-background bg-muted-foreground/30" />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold">{labelEvento(h.tipo_evento)}</span>
                              {h.de_coluna_nome && h.para_coluna_nome && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                  {h.de_coluna_nome} <ArrowRight className="h-2.5 w-2.5" /> {h.para_coluna_nome}
                                </span>
                              )}
                              {!h.de_coluna_nome && h.para_coluna_nome && (
                                <span className="text-[9px] text-muted-foreground">em {h.para_coluna_nome}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                              <span>{h.movido_por_nome}</span>
                              <span>·</span>
                              <span>{format(new Date(h.moved_at), "dd/MM/yyyy HH:mm")}</span>
                            </div>
                            {h.comentario && (
                              <p className="text-[10px] text-foreground bg-muted/30 rounded px-2 py-1 mt-1">{h.comentario}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
      {/* Dialog configuraao de colunas - BL-004-D */}
      {isCoordinator && (
        <Dialog open={configColunasOpen} onOpenChange={setConfigColunasOpen}>
          <DialogContent className="flex flex-col gap-0 p-0 max-h-[85dvh] w-full max-w-md">
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <div className="flex items-center gap-2 pr-8">
                <Settings2 className="h-5 w-5 text-violet-600" />
                <DialogTitle className="text-base">Configurar colunas - {projetoNome}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div className="space-y-2">
                {[...colunas].sort((a, b) => a.ordem - b.ordem).map((col, idx, arr) => (
                  <div key={col.id} className="rounded-xl border px-3 py-2.5 space-y-2">
                    {editandoColuna === col.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="color" value={editColunaCor} onChange={e => setEditColunaCor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                          <Input value={editColunaNome} onChange={e => setEditColunaNome(e.target.value)} className="h-7 text-xs flex-1" autoFocus />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-6 text-xs gap-1" onClick={() => handleRenomearColuna(col.id)}><Save className="h-3 w-3" />Salvar</Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setEditandoColuna(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: col.cor }} />
                        <span className="text-xs font-medium flex-1">{col.nome}</span>
                        {col.status_sistema && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">protegida</span>}
                        <div className="flex items-center gap-1">
                          <button onClick={() => reordenarColunas(col.id, "esquerda")} disabled={idx === 0 || col.status_sistema === "cancelado"} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronLeft className="h-3 w-3" /></button>
                          <button onClick={() => reordenarColunas(col.id, "direita")} disabled={idx === arr.length - 1 || col.status_sistema === "cancelado"} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="h-3 w-3" /></button>
                          <button onClick={() => { setEditandoColuna(col.id); setEditColunaNome(col.nome); setEditColunaCor(col.cor); }} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 className="h-3 w-3" /></button>
                          {!col.status_sistema && <button onClick={() => handleExcluirColuna(col.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Nova coluna</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={novaColunaCor} onChange={e => setNovaColunaCor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent flex-shrink-0" />
                  <Input value={novaColunaNome} onChange={e => setNovaColunaNome(e.target.value)} placeholder="Nome da coluna..." className="h-8 text-xs flex-1" onKeyDown={e => { if (e.key === "Enter") handleCriarColuna(); }} />
                  <Button size="sm" onClick={handleCriarColuna} disabled={savingColuna || !novaColunaNome.trim()} className="h-8 gap-1 text-xs shrink-0">
                    {savingColuna ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Criar
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground">Nova coluna inserida antes de Cancelado. Colunas protegidas podem ser renomeadas mas nao excluidas.</p>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setConfigColunasOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}