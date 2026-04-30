// src/components/consultor/ui/BacklogBoard.tsx
// BL-004-B — Board Kanban do Backlog

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  ListTodo, Plus, Search, Filter, Loader2, X, ChevronDown, ChevronUp,
  ArrowRight, Lock, Unlock, LayoutGrid, List, GripVertical,
  Calendar, Clock, User, Tag, AlertCircle, CheckCircle2
} from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBacklog, BacklogItem, BacklogColuna } from "../hooks/useBacklog";

// ── TIPOS ─────────────────────────────────────────────────────────────────────

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
  critica: { label: "Crítica",  cor: "text-red-700",    corBg: "bg-red-100" },
  alta:    { label: "Alta",     cor: "text-amber-700",  corBg: "bg-amber-100" },
  media:   { label: "Média",    cor: "text-blue-700",   corBg: "bg-blue-100" },
  baixa:   { label: "Baixa",   cor: "text-emerald-700", corBg: "bg-emerald-100" },
};

const TIPO_OPTIONS = [
  { value: "melhoria",     label: "Melhoria" },
  { value: "bug",          label: "Bug" },
  { value: "duvida",       label: "Dúvida" },
  { value: "configuracao", label: "Configuração" },
  { value: "treinamento",  label: "Treinamento" },
  { value: "outro",        label: "Outro" },
];

const FRENTE_OPTIONS = [
  { value: "fiscal",      label: "Fiscal" },
  { value: "financeiro",  label: "Financeiro" },
  { value: "estoque",     label: "Estoque" },
  { value: "compras",     label: "Compras" },
  { value: "rh",          label: "RH" },
  { value: "contabil",    label: "Contábil" },
  { value: "outro",       label: "Outro" },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────

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
      {reclassificada && reclassificada !== prioridade ? `↑ ${cfg.label}` : cfg.label}
    </span>
  );
}

// ── CARD DO ITEM ──────────────────────────────────────────────────────────────

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
      } ${vencido ? "border-red-200" : ""}`}
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

      {/* Título */}
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

      {/* Data e atribuição */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {item.data_prevista && (
            <span className={`text-[9px] flex items-center gap-0.5 ${vencido ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
              {vencido && "⚠ "}
              {format(parseISO(item.data_prevista), "dd/MM", { locale: ptBR })}
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
            <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[8px] font-bold flex items-center justify-center">
              {item.atribuido_para_nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Botão mover (alternativa ao drag) */}
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
              → {c.nome.length > 8 ? c.nome.slice(0, 8) + "…" : c.nome}
            </button>
          ))}
      </div>

      {/* Filhos expandidos */}
      {expanded && temFilhos && (
        <div className="border-t pt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {filhos.map(filho => (
            <div key={filho.id} className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5">
              <span className="text-[8px] opacity-50">↳</span>
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

// ── MODAL NOVO ITEM ───────────────────────────────────────────────────────────

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
    if (!titulo.trim()) { toast({ title: "Informe o título", variant: "destructive" }); return; }
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
            Novo item — {projetoNome}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título *</Label>
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
                  <SelectItem value="critica">🔴 Crítica</SelectItem>
                  <SelectItem value="alta">🟠 Alta</SelectItem>
                  <SelectItem value="media">🔵 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frente / Módulo</Label>
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

// ── BOARD PRINCIPAL ───────────────────────────────────────────────────────────

export function BacklogBoard({ projetoId, projetoNome, userId, isCoordinator = false, agendaData, agendaCliente }: Props) {
  const {
    colunas, items, loadingBoard, savingItem,
    loadBoard, moverItem, criarItem, itemsPorColuna, filhosDoItem, temBoard,
  } = useBacklog(projetoId, userId);

  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = useState("");
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroVencidos, setFiltroVencidos] = useState(false);
  const [novoItemOpen, setNovoItemOpen] = useState(false);
  const [novoItemColuna, setNovoItemColuna] = useState<string | undefined>();
  const [itemDetalhado, setItemDetalhado] = useState<BacklogItem | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverColuna, setDragOverColuna] = useState<string | null>(null);

  useEffect(() => {
    if (projetoId) loadBoard();
  }, [projetoId, loadBoard]);

  const filtrarItems = (lista: BacklogItem[]) => {
    return lista.filter(i => {
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
      return true;
    });
  };

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

  // ── ONBOARDING ──
  if (loadingBoard) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalItems = items.filter(i => !i.pai_id).length;
  const itemsFiltrados = filtrarItems(items.filter(i => !i.pai_id));

  // ── VISTA LISTA ──
  const renderLista = () => (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            {["Código", "Título", "Frente", "Prioridade", "Status", "Prevista", "Responsável"].map(h => (
              <th key={h} className="text-left p-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itemsFiltrados.length === 0 ? (
            <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum item encontrado</td></tr>
          ) : itemsFiltrados.map(item => {
            const col = colunas.find(c => c.id === item.coluna_id);
            const vencido = isVencido(item.data_prevista, col?.status_sistema || null);
            return (
              <tr key={item.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setItemDetalhado(item)}>
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
                  {item.data_prevista ? format(parseISO(item.data_prevista), "dd/MM/yy") : "—"}
                </td>
                <td className="p-2 text-muted-foreground">{item.atribuido_para_nome || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── VISTA KANBAN ──
  const renderKanban = () => (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {colunas.map(col => {
        const colItems = filtrarItems(itemsPorColuna(col.id));
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
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${wipAtingido ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
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
                  onOpen={setItemDetalhado}
                  isDragging={dragItemId === item.id}
                  onDragStart={() => setDragItemId(item.id)}
                  onDragEnd={() => { setDragItemId(null); setDragOverColuna(null); }}
                  filhos={filhosDoItem(item.id)}
                  isCoordinator={isCoordinator}
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
              {totalItems} {totalItems === 1 ? "item" : "itens"} · {items.filter(i => !i.pai_id && colunas.find(c => c.id === i.coluna_id)?.status_sistema === "concluido").length} concluídos
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
              placeholder="Buscar código, título..."
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
            ⚠ Vencidos
          </button>
          {(busca || filtroMeus || filtroVencidos) && (
            <button
              onClick={() => { setBusca(""); setFiltroMeus(false); setFiltroVencidos(false); }}
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

      {/* Modal detalhe do item (placeholder para BL-004-C) */}
      {itemDetalhado && (
        <Dialog open={!!itemDetalhado} onOpenChange={() => setItemDetalhado(null)}>
          <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-lg">
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground text-xs">{itemDetalhado.codigo}</span>
                {itemDetalhado.titulo}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <PriBadge prioridade={itemDetalhado.prioridade} reclassificada={itemDetalhado.prioridade_reclassificada} />
                <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {FRENTE_OPTIONS.find(f => f.value === itemDetalhado.frente_modulo)?.label}
                </span>
                <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {TIPO_OPTIONS.find(t => t.value === itemDetalhado.tipo)?.label}
                </span>
              </div>
              {itemDetalhado.descricao_solicitante && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Detalhamento</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{itemDetalhado.descricao_solicitante}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-[10px] text-muted-foreground">Criado por</p><p className="font-medium">{itemDetalhado.criado_por_nome || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Atribuído para</p><p className="font-medium">{itemDetalhado.atribuido_para_nome || "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Estimativa</p><p className="font-medium">{itemDetalhado.estimativa_horas ? `${itemDetalhado.estimativa_horas}h` : "—"}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Data prevista</p><p className="font-medium">{itemDetalhado.data_prevista ? format(parseISO(itemDetalhado.data_prevista), "dd/MM/yyyy") : "—"}</p></div>
              </div>
              <div className="border-t pt-3">
                <p className="text-[10px] text-muted-foreground">Histórico e comentários disponíveis no BL-004-C</p>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setItemDetalhado(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

