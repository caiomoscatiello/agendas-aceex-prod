// src/components/consultor/ui/TimesheetCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type Semana = { label: string; agendadas: number; apontadas: number };
type Projeto = { cliente: string; horas: number };

type Props = {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  tsAgendadas: number;
  tsApontadas: number;
  tsSemanas: Semana[];
  tsProjetos: Projeto[];
};

export function TimesheetCard({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  tsAgendadas,
  tsApontadas,
  tsSemanas,
  tsProjetos,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">Controle de Horas</CardTitle>
              <Badge className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700">ativo</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPrevMonth}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-muted-foreground capitalize min-w-[80px] text-center">
              {format(currentMonth, "MMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNextMonth}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Agendado</div>
            <div className="text-base font-bold">{tsAgendadas}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Apontado</div>
            <div className="text-base font-bold">{tsApontadas}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cobertura</div>
            <div className={`text-base font-bold ${
              tsAgendadas === 0 ? "text-foreground" :
              (tsApontadas / tsAgendadas) >= 0.8 ? "text-emerald-600" :
              (tsApontadas / tsAgendadas) >= 0.5 ? "text-amber-600" : "text-red-600"
            }`}>
              {tsAgendadas === 0 ? "—" : `${Math.round((tsApontadas / tsAgendadas) * 100)}%`}
            </div>
          </div>
        </div>

        {/* Barras semanais */}
        <div className="space-y-2">
          {tsSemanas.map((s) => {
            const pct = s.agendadas === 0 ? 0 : Math.round((s.apontadas / s.agendadas) * 100);
            const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
            const textColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
            return (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground w-5">{s.label}</span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${barColor}`}
                    style={{ width: `${s.agendadas === 0 ? 0 : Math.min(100, pct)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-semibold min-w-[60px] text-right ${textColor}`}>
                  {s.apontadas} / {s.agendadas}
                </span>
              </div>
            );
          })}
          {tsSemanas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma agenda no mês</p>
          )}
        </div>

        {/* Breakdown por projeto */}
        {tsProjetos.length > 0 && (
          <div className="border-t pt-3 flex flex-wrap gap-x-4 gap-y-1">
            {tsProjetos.map((p) => (
              <span key={p.cliente} className="text-[10px] text-muted-foreground">
                {p.cliente} <strong className="text-foreground">{p.horas}</strong>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
