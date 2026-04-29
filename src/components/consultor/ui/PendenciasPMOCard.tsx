// src/components/consultor/ui/PendenciasPMOCard.tsx
// BL-019 — Pendências PMO do Consultor

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp, FileText, Clock, CalendarDays, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pendencia } from "../types/consultor.types";

type Props = {
  pendencias: Pendencia[];
  totalPendencias: number;
  loadingPendencias: boolean;
  onNavigateToDate?: (data: string, agendaId?: string) => void;
  onOpenUpload?: (agendaId: string, itemCronograma?: string) => void;
};

function BadgeDias({ dias }: { dias: number }) {
  if (dias === 0) return null;
  const cor = dias >= 5 ? "bg-red-100 text-red-700" : dias >= 3 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600";
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cor}`}>
      {dias}d {dias >= 5 ? "⚠️" : ""}
    </span>
  );
}

type GrupoProps = {
  titulo: string;
  icone: React.ReactNode;
  cor: string;
  corBg: string;
  itens: Pendencia[];
  onNavigate?: Props["onNavigateToDate"];
  onUpload?: Props["onOpenUpload"];
};

function GrupoPendencias({ titulo, icone, cor, corBg, itens, onNavigate, onUpload }: GrupoProps) {
  const [aberto, setAberto] = useState(true);

  if (itens.length === 0) return null;

  return (
    <div className={`rounded-xl border ${corBg} overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between px-3 py-2.5"
        onClick={() => setAberto(v => !v)}
      >
        <div className="flex items-center gap-2">
          {icone}
          <span className={`text-xs font-bold ${cor}`}>{titulo}</span>
          <Badge className={`text-[9px] px-1.5 py-0.5 ${cor} bg-white/60`}>{itens.length}</Badge>
        </div>
        {aberto ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="border-t divide-y divide-white/40">
          {itens.map((p) => (
            <div key={p.id} className="px-3 py-2.5 bg-white/50 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{p.cliente}</span>
                    <BadgeDias dias={p.diasEmAberto} />
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-tight mt-0.5">{p.titulo}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{p.detalhe}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(parseISO(p.data), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>

                {/* Ação inline */}
                <div className="flex-shrink-0">
                  {p.tipo === "doc_pendente" && onUpload && p.agendaId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] gap-1 border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => onUpload(p.agendaId!, p.itemCronograma)}
                    >
                      <FileText className="h-3 w-3" />
                      Anexar
                    </Button>
                  )}
                  {p.tipo === "apontamento_atrasado" && onNavigate && p.agendaId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => onNavigate(p.data, p.agendaId)}
                    >
                      <ArrowRight className="h-3 w-3" />
                      Apontar
                    </Button>
                  )}
                  {p.tipo === "requisicao_pendente" && (
                    <span className="text-[9px] text-muted-foreground bg-white/70 px-2 py-1 rounded-lg border">
                      Aguardando
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PendenciasPMOCard({ pendencias, totalPendencias, loadingPendencias, onNavigateToDate, onOpenUpload }: Props) {
  const [cardAberto, setCardAberto] = useState(true);

  const docsPendentes = pendencias.filter(p => p.tipo === "doc_pendente");
  const apontamentosAtrasados = pendencias.filter(p => p.tipo === "apontamento_atrasado");
  const requisicoesPendentes = pendencias.filter(p => p.tipo === "requisicao_pendente");

  const severidadeMaxima = docsPendentes.length > 0
    ? "red"
    : apontamentosAtrasados.length > 0
    ? "orange"
    : totalPendencias > 0 ? "amber" : "green";

  const badgeColor = severidadeMaxima === "red"
    ? "bg-red-500"
    : severidadeMaxima === "orange"
    ? "bg-orange-500"
    : severidadeMaxima === "amber"
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <Card>
      <CardHeader className="pb-0 bg-muted/30">
        <button
          className="w-full flex items-center justify-between py-2"
          onClick={() => setCardAberto(v => !v)}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${totalPendencias > 0 ? "bg-amber-600" : "bg-gray-400"}`}>
              <AlertCircle className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">Pendências PMO</CardTitle>
              {loadingPendencias ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : totalPendencias > 0 ? (
                <Badge className={`text-[9px] px-1.5 py-0.5 text-white ${badgeColor}`}>
                  {totalPendencias}
                </Badge>
              ) : (
                <Badge className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700">
                  ✓ Em dia
                </Badge>
              )}
            </div>
          </div>
          {cardAberto
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </button>
      </CardHeader>

      {cardAberto && (
        <CardContent className="pt-3 space-y-2">
          {loadingPendencias ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : totalPendencias === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhuma pendência</p>
              <p className="text-[10px] text-muted-foreground/60">Tudo em dia 🎉</p>
            </div>
          ) : (
            <>
              <GrupoPendencias
                titulo="DOCUMENTOS"
                icone={<FileText className="h-3.5 w-3.5 text-red-600" />}
                cor="text-red-700"
                corBg="bg-red-50 border-red-200"
                itens={docsPendentes}
                onUpload={onOpenUpload}
              />
              <GrupoPendencias
                titulo="AGENDAS"
                icone={<Clock className="h-3.5 w-3.5 text-orange-600" />}
                cor="text-orange-700"
                corBg="bg-orange-50 border-orange-200"
                itens={apontamentosAtrasados}
                onNavigate={onNavigateToDate}
              />
              <GrupoPendencias
                titulo="REQUISIÇÕES"
                icone={<CalendarDays className="h-3.5 w-3.5 text-amber-600" />}
                cor="text-amber-700"
                corBg="bg-amber-50 border-amber-200"
                itens={requisicoesPendentes}
              />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
