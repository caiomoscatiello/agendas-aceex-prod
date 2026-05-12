// BL-013 P4 -- Componente: SLABadge
// Arquivo: src/components/ui/SLABadge.tsx
// CRIAR arquivo novo -- nao altera nenhum arquivo existente
// Merge de OPP-1 (badge de status) + OPP-2 (contador regressivo)
// Encoding: UTF-8 sem BOM

import { SLAResultado, StatusSLA } from "@/components/consultor/hooks/useSLA";

type Props = {
  resultado: SLAResultado;
  // Modo compacto (so icone + dias) ou completo (icone + label + dias)
  compacto?: boolean;
};

const ICONE: Record<StatusSLA, string> = {
  no_prazo: "??",
  em_risco: "??",
  vencido:  "??",
  concluido: "?",
};

export function SLABadge({ resultado, compacto = false }: Props) {
  const { status, label, cor, corBg, corBorda } = resultado;

  if (status === "concluido") return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${corBg} ${corBorda}`}
      title={`SLA: ${label}`}
    >
      <span className="text-[9px] leading-none">{ICONE[status]}</span>
      {!compacto && (
        <span className={`text-[9px] font-semibold ${cor} whitespace-nowrap`}>
          {label}
        </span>
      )}
    </span>
  );
}

// Versao sem resultado pre-calculado -- calcula direto da data
// Usa os defaults globais (sem config de projeto carregada)
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
