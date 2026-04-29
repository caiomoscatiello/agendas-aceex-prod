// src/components/consultor/ui/VisaoGeralCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock, AlertCircle, LayoutDashboard, BarChart2 } from "lucide-react";

type Props = {
  vgAgendasApontadas: number;
  vgAgendasConfirmadas: number;
  vgDiasLivres: number;
  vgProjetos: number;
  totalPendencias: number;
};

export function VisaoGeralCard({
  vgAgendasApontadas,
  vgAgendasConfirmadas,
  vgDiasLivres,
  vgProjetos,
  totalPendencias,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-500 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="h-4 w-4 text-white" />
          </div>
          <CardTitle className="text-sm font-bold">Visão Geral</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid grid-cols-2 gap-2">
          {/* Agendas */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Agendas</span>
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 leading-none">
              {vgAgendasApontadas}
              <span className="text-sm font-medium opacity-50 ml-1">/ {vgAgendasConfirmadas}</span>
            </div>
            <div className="text-[9px] text-blue-600 dark:text-blue-400">
              apontadas de {vgAgendasConfirmadas} confirmadas
            </div>
          </div>

          {/* Disponibilidade */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Clock className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Disponibilidade</span>
            </div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 leading-none">
              {vgDiasLivres}
            </div>
            <div className="text-[9px] text-emerald-600 dark:text-emerald-400">dias livres no mês</div>
          </div>

          {/* Pendências — agora com dado real */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Pendências</span>
            </div>
            <div className={`text-2xl font-bold leading-none ${totalPendencias > 0 ? "text-amber-900 dark:text-amber-100" : "text-muted-foreground"}`}>
              {totalPendencias > 0 ? totalPendencias : "0"}
            </div>
            <div className="text-[9px] text-amber-600 dark:text-amber-400">
              {totalPendencias === 0 ? "nenhuma pendência" : totalPendencias === 1 ? "pendência ativa" : "pendências ativas"}
            </div>
          </div>

          {/* Projetos */}
          <div className="rounded-xl bg-violet-50 border border-violet-200 dark:bg-violet-950/30 dark:border-violet-800 p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">Projetos</span>
            </div>
            <div className="text-2xl font-bold text-violet-900 dark:text-violet-100 leading-none">
              {vgProjetos}
            </div>
            <div className="text-[9px] text-violet-600 dark:text-violet-400">projetos ativos</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
