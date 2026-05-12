// BL-013 P4 -- Componente: SLABadge
// Arquivo: src/components/ui/SLABadge.tsx
// CRIAR arquivo novo -- nao altera nenhum arquivo existente
// Merge de OPP-1 (badge de status) + OPP-2 (contador regressivo)
// Encoding: UTF-8 sem BOM

import { SLAResultado, StatusSLA } from "@/components/consultor/hooks/useSLA";

type Props = {
  resultado: SLAResultado;
  // Modo compacto: apenas icone colorido (sem texto)
  // Modo completo: icone + label legivel
  compacto?: boolean;
};

const ICONE: Record<StatusSLA, string> = {
  no_prazo:  "??",
  em_risco:  "??",
  vencido:   "??",
  concluido: "?",
};

export function SLABadge({ resultado, compacto = false }: Props) {
  const { status, label, cor, corBg, corBorda } = resultado;

  if (status === "concluido") return null;

  if (compacto) {
    // Modo compacto: apenas icone, sem borda, sem tooltip agressivo
    return (
      <span
        aria-label={`SLA: ${label}`}
        className="text-[11px] leading-none select-none"
      >
        {ICONE[status]}
      </span>
    );
  }

  // Modo completo: icone + label + dias — legivel
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${corBg} ${corBorda}`}
    >
      <span className="text-[10px] leading-none">{ICONE[status]}</span>
      <span className={`text-[10px] font-semibold ${cor} whitespace-nowrap`}>
        {label}
      </span>
    </span>
  );
}

// Versao sem resultado pre-calculado -- calcula direto da data com defaults globais
import { calcularSLA, SLA_DEFAULTS, DominioSLA } from "@/components/consultor/hooks/useSLA";

type PropsSimples = {
  dominio: DominioSLA;
  dataRef: string;
  compacto?: boolean;
};

export function SLABadgeSimples({ dominio, dataRef, compacto = false }: PropsSimples) {
  const resultado = calcularSLA(dataRef, SLA_DEFAULTS[dominio]);
  return <SLABadge resultado={resultado} compacto={compacto} />;
}
