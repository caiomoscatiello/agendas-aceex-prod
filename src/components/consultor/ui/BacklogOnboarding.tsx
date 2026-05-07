// src/components/consultor/ui/BacklogOnboarding.tsx
// BL-004 Onboarding board vazio -- 3 templates Protheus/ERP

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Headphones, TrendingUp, ArrowRight, FileDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type TemplateItem = {
  titulo: string;
  tipo: string;
  prioridade: string;
  frente_modulo: string;
  descricao_solicitante: string;
};

type Template = {
  id: string;
  nome: string;
  descricao: string;
  icone: React.ReactNode;
  cor: string;
  corBg: string;
  corBorda: string;
  itens: TemplateItem[];
};

const TEMPLATES: Template[] = [
  {
    id: "implantacao",
    nome: "Implantacao",
    descricao: "Roteiro completo para projetos de implantacao Protheus com fases de mapeamento, parametrizacao, testes e go-live.",
    icone: <Rocket className="h-6 w-6" />,
    cor: "text-violet-700",
    corBg: "bg-violet-50",
    corBorda: "border-violet-200 hover:border-violet-400",
    itens: [
      { titulo: "Mapeamento de processos atuais", tipo: "melhoria", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Levantamento detalhado dos processos atuais do cliente para baseline da implantacao." },
      { titulo: "Parametrizacao modulo Estoque", tipo: "configuracao", prioridade: "alta", frente_modulo: "estoque", descricao_solicitante: "Configuracao inicial do modulo de Estoque conforme requisitos mapeados." },
      { titulo: "Parametrizacao modulo Financeiro", tipo: "configuracao", prioridade: "alta", frente_modulo: "financeiro", descricao_solicitante: "Configuracao inicial do modulo Financeiro conforme requisitos mapeados." },
      { titulo: "Parametrizacao modulo Fiscal", tipo: "configuracao", prioridade: "alta", frente_modulo: "fiscal", descricao_solicitante: "Configuracao fiscal e tributaria conforme legislacao vigente." },
      { titulo: "Carga inicial de dados mestres", tipo: "configuracao", prioridade: "critica", frente_modulo: "outro", descricao_solicitante: "Importacao de clientes, fornecedores, produtos e plano de contas." },
      { titulo: "Testes integrados - ciclo 1", tipo: "teste", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Execucao do primeiro ciclo de testes integrados com usuarios chave." },
      { titulo: "Correcoes pos-teste ciclo 1", tipo: "bug", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Tratamento das nao-conformidades identificadas no ciclo 1 de testes." },
      { titulo: "Testes integrados - ciclo 2", tipo: "teste", prioridade: "media", frente_modulo: "outro", descricao_solicitante: "Execucao do segundo ciclo de testes com validacao das correcoes." },
      { titulo: "Treinamento usuarios chave", tipo: "treinamento", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Capacitacao dos usuarios chave antes do go-live." },
      { titulo: "Treinamento usuarios finais", tipo: "treinamento", prioridade: "media", frente_modulo: "outro", descricao_solicitante: "Capacitacao dos usuarios finais do sistema." },
      { titulo: "Go-live e acompanhamento", tipo: "melhoria", prioridade: "critica", frente_modulo: "outro", descricao_solicitante: "Entrada em producao e suporte intensivo nos primeiros dias." },
      { titulo: "Documentacao tecnica final", tipo: "documentacao", prioridade: "baixa", frente_modulo: "outro", descricao_solicitante: "Elaboracao da documentacao tecnica e operacional do projeto." },
    ],
  },
  {
    id: "suporte",
    nome: "Suporte",
    descricao: "Estrutura para gestao de chamados de suporte continuo, bugs e melhorias pontuais pos-implantacao.",
    icone: <Headphones className="h-6 w-6" />,
    cor: "text-blue-700",
    corBg: "bg-blue-50",
    corBorda: "border-blue-200 hover:border-blue-400",
    itens: [
      { titulo: "Fila de atendimento - Fiscal", tipo: "bug", prioridade: "alta", frente_modulo: "fiscal", descricao_solicitante: "Chamados de suporte relacionados ao modulo Fiscal." },
      { titulo: "Fila de atendimento - Financeiro", tipo: "bug", prioridade: "alta", frente_modulo: "financeiro", descricao_solicitante: "Chamados de suporte relacionados ao modulo Financeiro." },
      { titulo: "Fila de atendimento - Estoque", tipo: "bug", prioridade: "media", frente_modulo: "estoque", descricao_solicitante: "Chamados de suporte relacionados ao modulo de Estoque." },
      { titulo: "Fila de atendimento - Compras", tipo: "bug", prioridade: "media", frente_modulo: "compras", descricao_solicitante: "Chamados de suporte relacionados ao modulo de Compras." },
      { titulo: "Revisao de parametros pos-atualizacao", tipo: "configuracao", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Verificacao de parametros apos atualizacao de patch ou versao." },
      { titulo: "Ajuste de relatorios customizados", tipo: "melhoria", prioridade: "media", frente_modulo: "outro", descricao_solicitante: "Correcao e melhoria de relatorios personalizados existentes." },
      { titulo: "Duvidas de operacao do sistema", tipo: "duvida", prioridade: "baixa", frente_modulo: "outro", descricao_solicitante: "Esclarecimento de duvidas operacionais dos usuarios." },
    ],
  },
  {
    id: "melhoria",
    nome: "Melhoria Continua",
    descricao: "Evolucao continua do sistema com novas funcionalidades, otimizacoes de processos e integra??es.",
    icone: <TrendingUp className="h-6 w-6" />,
    cor: "text-emerald-700",
    corBg: "bg-emerald-50",
    corBorda: "border-emerald-200 hover:border-emerald-400",
    itens: [
      { titulo: "Levantamento de melhorias priorizadas", tipo: "melhoria", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Reuniao de alinhamento para priorizacao das melhorias do ciclo." },
      { titulo: "Automacao de processo Fiscal", tipo: "melhoria", prioridade: "alta", frente_modulo: "fiscal", descricao_solicitante: "Identificacao e automacao de processos manuais no modulo Fiscal." },
      { titulo: "Integracao com sistema legado", tipo: "melhoria", prioridade: "critica", frente_modulo: "outro", descricao_solicitante: "Desenvolvimento de interface de integracao com sistemas externos." },
      { titulo: "Otimizacao de relatorios gerenciais", tipo: "melhoria", prioridade: "media", frente_modulo: "outro", descricao_solicitante: "Melhoria de performance e layout dos relatorios gerenciais." },
      { titulo: "Desenvolvimento de BI/Dashboard", tipo: "melhoria", prioridade: "media", frente_modulo: "outro", descricao_solicitante: "Criacao de paineis de indicadores para gestao." },
      { titulo: "Revisao de permissoes e acessos", tipo: "configuracao", prioridade: "alta", frente_modulo: "outro", descricao_solicitante: "Revisao e adequacao do perfil de acesso de usuarios." },
      { titulo: "Treinamento em novas funcionalidades", tipo: "treinamento", prioridade: "media", frente_modulo: "outro", descricao_solicitante: "Capacitacao da equipe nas novas funcionalidades implementadas." },
      { titulo: "Documentacao de evolucoes", tipo: "documentacao", prioridade: "baixa", frente_modulo: "outro", descricao_solicitante: "Registro das evolucoes e mudancas implementadas no periodo." },
    ],
  },
];

type Props = {
  projetoNome: string;
  onAplicarTemplate: (itens: TemplateItem[]) => Promise<void>;
  onComecarEmBranco: () => void;
};

export function BacklogOnboarding({ projetoNome, onAplicarTemplate, onComecarEmBranco }: Props) {
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<string | null>(null);

  const handleAplicar = async (template: Template) => {
    setAplicando(template.id);
    try {
      await onAplicarTemplate(template.itens);
      toast({ title: `Template "${template.nome}" aplicado!`, description: `${template.itens.length} itens criados no backlog.` });
    } catch {
      toast({ title: "Erro ao aplicar template", variant: "destructive" });
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
          Escolha um template para iniciar rapidamente ou comece com um board em branco.
          Os itens podem ser editados e personalizados a qualquer momento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-6">
        {TEMPLATES.map(template => (
          <button
            key={template.id}
            onClick={() => setTemplateSelecionado(template.id === templateSelecionado ? null : template.id)}
            className={`text-left rounded-xl border-2 p-4 transition-all ${template.corBorda} ${template.corBg} ${templateSelecionado === template.id ? "ring-2 ring-offset-1 ring-violet-400" : ""}`}
          >
            <div className={`${template.cor} mb-3`}>{template.icone}</div>
            <div className={`text-sm font-semibold ${template.cor} mb-1`}>{template.nome}</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{template.descricao}</p>
            <div className={`text-[10px] font-medium ${template.cor}`}>
              {template.itens.length} itens inclusos
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onComecarEmBranco}
          className="text-xs"
        >
          Comecar em branco
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
            {aplicando ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Criando itens...</>
            ) : (
              <><ArrowRight className="h-3 w-3" />Aplicar template</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
