// BL-013 P4 -- Componente: SLABadge
// Arquivo: src/components/ui/SLABadge.tsx
// Encoding: UTF-8 sem BOM

import { SLAResultado, StatusSLA } from "@/components/consultor/hooks/useSLA";

type Props = {
  resultado: SLAResultado;
  compacto?: boolean;
};

const ICONE_SVG: Record<StatusSLA, JSX.Element> = {
  no_prazo: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
    </svg>
  ),
  em_risco: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
    </svg>
  ),
  vencido: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  concluido: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
};

export function SLABadge({ resultado, compacto = false }: Props) {
  const { status, label, cor, corBg, corBorda } = resultado;

  if (status === "concluido") return null;

  if (compacto) {
    return (
      <span aria-label={"SLA: " + label} style={{ lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
        {ICONE_SVG[status]}
      </span>
    );
  }

  return (
    <span
      className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " + corBg + " " + corBorda}
    >
      {ICONE_SVG[status]}
      <span className={"text-[10px] font-semibold whitespace-nowrap " + cor}>
        {label}
      </span>
    </span>
  );
}

// Versao sem resultado pre-calculado
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
