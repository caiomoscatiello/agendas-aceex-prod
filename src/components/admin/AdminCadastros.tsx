// src/components/admin/AdminCadastros.tsx
// BL-ADM-002 -- Adapta para receber subAtivo via prop (flyout do AdminDashboard)
// Preserva: AdminProjetos, AdminCadastroUsuarios, AdminTiposDocumento integrais
// Encoding: UTF-8 sem BOM

import { useEffect, useState } from "react";
import AdminProjetos          from "./AdminProjetos";
import AdminCadastroUsuarios  from "./AdminCadastroUsuarios";
import AdminTiposDocumento    from "./AdminTiposDocumento";

type SubCadastros = "projetos" | "usuarios" | "documentos";

type Props = {
  subAtivo?: string;
};

export default function AdminCadastros({ subAtivo }: Props) {
  const [aba, setAba] = useState<SubCadastros>("projetos");

  // Sincroniza com o flyout do AdminDashboard
  useEffect(() => {
    if (subAtivo === "projetos" || subAtivo === "usuarios" || subAtivo === "documentos") {
      setAba(subAtivo as SubCadastros);
    }
  }, [subAtivo]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {aba === "projetos"   && <AdminProjetos />}
      {aba === "usuarios"   && <AdminCadastroUsuarios />}
      {aba === "documentos" && <AdminTiposDocumento />}
    </div>
  );
}
