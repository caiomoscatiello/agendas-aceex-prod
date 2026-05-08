// src/components/consultor/ui/BacklogOnboarding.tsx
// BL-004-H - Wizard de onboarding do backlog
// Templates criam colunas de fase com status_sistema correto para compatibilidade
// com KPIs, filtros de vencidos e relatorios PMO.
// "Comecar em branco" cria 2 colunas minimas (Aberto + Cancelado).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Headphones, TrendingUp, ArrowRight, FileDown, FilePlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type TemplateColuna = {
  nome: string;
  cor: string;
  status_sistema: string | null;
};

type Template = {
  id: string;
  nome: string;
  descricao: string;
  icone: React.ReactNode;
  cor: string;
  corBg: string;
  corBorda: string;
  colunas: TemplateColuna[];
};

// ---------------------------------------------------------------------------
// TEMPLATES DE FASE - BL-004-H
// Cada template replica a semantica do trigger_colunas_backlog_padrao,
// mapeando status_sistema para compatibilidade com todos os calculos do board.
// ---------------------------------------------------------------------------
const TEMPLATES: Template[] = [
  {
    id: "implantacao",
    nome: "Implantacao",
    descricao: "Fluxo completo de projeto Protheus do mapeamento ao go-live.",
    icone: <Rocket className="h-6 w-6" />,
    cor: "text-violet-700",
    corBg: "bg-violet-50",
    corBorda: "border-violet-200 hover:border-violet-400",
    colunas: [
      { nome: "Mapeamento", cor: "#E24B4A", status_sistema: "aberto" },
      { nome: "Parametrizacao", cor: "#7F77DD", status_sistema: null },
      { nome: "Testes", cor: "#EF9F27", status_sistema: "em_andamento" },
      { nome: "Treinamento", cor: "#378ADD", status_sistema: "em_revisao" },
      { nome: "Go-live", cor: "#639922", status_sistema: "concluido" },
      { nome: "Cancelado", cor: "#888780", status_sistema: "cancelado" },
    ],
  },
  {
    id: "suporte",
    nome: "Suporte",
    descricao: "Gestao de chamados, bugs e melhorias pontuais pos-implantacao.",
    icone: <Headphones className="h-6 w-6" />,
    cor: "text-blue-700",
    corBg: "bg-blue-50",
    corBorda: "border-blue-200 hover:border-blue-400",
    colunas: [
      { nome: "Aberto", cor: "#E24B4A", status_sistema: "aberto" },
      { nome: "Em analise", cor: "#BA7517", status_sistema: null },
      { nome: "Em correcao", cor: "#EF9F27", status_sistema: "em_andamento" },
      { nome: "Em homologacao", cor: "#378ADD", status_sistema: "em_revisao" },
      { nome: "Concluido", cor: "#639922", status_sistema: "concluido" },
      { nome: "Cancelado", cor: "#888780", status_sistema: "cancelado" },
    ],
  },
  {
    id: "melhoria",
    nome: "Melhoria continua",
    descricao: "Evolucao pos go-live com novas funcionalidades e otimizacoes.",
    icone: <TrendingUp className="h-6 w-6" />,
    cor: "text-emerald-700",
    corBg: "bg-emerald-50",
    corBorda: "border-emerald-200 hover:border-emerald-400",
    colunas: [
      { nome: "Ideia", cor: "#E24B4A", status_sistema: "aberto" },
      { nome: "Aprovado", cor: "#7F77DD", status_sistema: null },
      { nome: "Em desenvolvimento", cor: "#EF9F27", status_sistema: "em_andamento" },
      { nome: "Em teste", cor: "#378ADD", status_sistema: "em_revisao" },
      { nome: "Entregue", cor: "#639922", status_sistema: "concluido" },
      { nome: "Cancelado", cor: "#888780", status_sistema: "cancelado" },
    ],
  },
];

// Colunas para "Comecar em branco": minimo absoluto funcional.
// O coordenador adiciona colunas intermediarias manualmente pelo board.
export const COLUNAS_MINIMAS: TemplateColuna[] = [
  { nome: "Aberto",   cor: "#E24B4A", status_sistema: "aberto"   },
  { nome: "Cancelado",cor: "#888780", status_sistema: "cancelado" },
];

type Props = {
  projetoNome: string;
  onAplicarTemplate: (colunas: TemplateColuna[]) => Promise<boolean>;
  onComecarEmBranco: () => Promise<boolean>;
};

export function BacklogOnboarding({ projetoNome, onAplicarTemplate, onComecarEmBranco }: Props) {
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<string | null>(null);

  const handleAplicar = async (template: Template) => {
    setAplicando(template.id);
    try {
      const ok = await onAplicarTemplate(template.colunas);
      if (ok) {
        toast({
          title: `Template "${template.nome}" aplicado!`,
          description: `${template.colunas.length} colunas criadas no board.`,
        });
      } else {
        toast({ title: "Nao foi possivel aplicar o template", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao aplicar template", variant: "destructive" });
    }
    setAplicando(null);
  };

  const handleComecarEmBranco = async () => {
    setAplicando("__branco__");
    try {
      const ok = await onComecarEmBranco();
      if (!ok) {
        toast({ title: "Nao foi possivel inicializar o board", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao inicializar o board", variant: "destructive" });
    }
    setAplicando(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-8 px-4">
      <div className="text-center mb-8 max-w-lg">
        <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
          <FileDown className="h-6 w-6 text-violet-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Backlog de {projetoNome}</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um template de fases para iniciar rapidamente ou comece com um board minimo.
          Itens serao adicionados manualmente ou por upload posteriormente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-6">
        {TEMPLATES.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => setTemplateSelecionado(template.id === templateSelecionado ? null : template.id)}
            disabled={!!aplicando}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${template.corBorda} ${template.corBg} ${templateSelecionado === template.id ? "ring-2 ring-offset-1 ring-violet-400" : ""}`}
          >
            <div className={`${template.cor} mb-3`}>{template.icone}</div>
            <div className={`text-sm font-semibold ${template.cor} mb-1`}>{template.nome}</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{template.descricao}</p>
            <div className={`text-[10px] font-medium ${template.cor} mb-2`}>
              {template.colunas.length} colunas incluidas
            </div>
            <div className="flex flex-wrap gap-1">
              {template.colunas.map((col, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-white/70 border border-white/80"
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: col.cor }} />
                  <span className="text-gray-700">{col.nome}</span>
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleComecarEmBranco}
          disabled={!!aplicando}
          className="text-xs gap-1.5"
        >
          {aplicando === "__branco__" ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Inicializando...</>
          ) : (
            <><FilePlus className="h-3 w-3" />Comecar em branco</>
          )}
        </Button>
        {templateSelecionado && (
          <Button
            size="sm"
            className="text-xs gap-1.5"
            disabled={!!aplicando}
            onClick={() => {
              const t = TEMPLATES.find(t => t.id === templateSelecionado);
              if (t) handleAplicar(t);
            }}
          >
            {aplicando && aplicando !== "__branco__" ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Criando colunas...</>
            ) : (
              <><ArrowRight className="h-3 w-3" />Aplicar template</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
