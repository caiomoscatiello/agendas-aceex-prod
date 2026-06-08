// src/components/admin/AdminAgendas.tsx
// BL-ADM-004 -- Adapta para receber subAtivo via prop (flyout do AdminDashboard)
// Preserva: todas as 6 sub-abas e comportamento mobile (Select)
// Encoding: UTF-8 sem BOM

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminCarregarAgendas          from "./AdminCarregarAgendas";
import AdminManutencaoAgendas        from "./AdminManutencaoAgendas";
import AdminSolicitacoesCancelamento from "./AdminSolicitacoesCancelamento";
import AdminPendentes                from "./AdminPendentes";
import AdminAprovarOS                from "./AdminAprovarOS";
import AdminAgendasPendentes         from "./AdminAgendasPendentes";

type SubAgendas = "solicitacoes" | "pendentes" | "aprovar" | "carregar" | "manutencao" | "cancelamentos";

const SUB_OPTIONS: { value: SubAgendas; label: string }[] = [
  { value: "solicitacoes",  label: "Solicitacoes"  },
  { value: "pendentes",     label: "Pendentes"     },
  { value: "aprovar",       label: "Aprovar OS"    },
  { value: "carregar",      label: "Incluir"       },
  { value: "manutencao",    label: "Manutencao"    },
  { value: "cancelamentos", label: "Cancelamentos" },
];

type Props = {
  subAtivo?: string;
};

export default function AdminAgendas({ subAtivo }: Props) {
  const [aba, setAba] = useState<SubAgendas>("solicitacoes");
  const isMobile = useIsMobile();

  // Sincroniza com o flyout do AdminDashboard
  useEffect(() => {
    const valido = SUB_OPTIONS.map(o => o.value);
    if (subAtivo && valido.includes(subAtivo as SubAgendas)) {
      setAba(subAtivo as SubAgendas);
    }
  }, [subAtivo]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mobile: select dropdown como antes */}
      {isMobile && (
        <Select value={aba} onValueChange={v => setAba(v as SubAgendas)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUB_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Desktop: sub-tabs em pill row — compacto, sem ocupar espaco do flyout */}
      {!isMobile && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SUB_OPTIONS.map(opt => {
            const isAtiva = aba === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setAba(opt.value)}
                style={{
                  padding: "5px 13px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: isAtiva ? 500 : 400,
                  cursor: "pointer",
                  border: isAtiva
                    ? "0.5px solid rgba(57,255,135,0.45)"
                    : "0.5px solid rgba(0,0,0,0.1)",
                  background: isAtiva ? "rgba(57,255,135,0.1)" : "#fff",
                  color: isAtiva ? "#065f46" : "#6b7280",
                  transition: "all 0.12s",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteudo da sub-aba */}
      {aba === "solicitacoes"  && <AdminPendentes />}
      {aba === "pendentes"     && <AdminAgendasPendentes />}
      {aba === "aprovar"       && <AdminAprovarOS />}
      {aba === "carregar"      && <AdminCarregarAgendas />}
      {aba === "manutencao"    && <AdminManutencaoAgendas />}
      {aba === "cancelamentos" && <AdminSolicitacoesCancelamento />}
    </div>
  );
}
