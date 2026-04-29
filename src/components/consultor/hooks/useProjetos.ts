// src/components/consultor/hooks/useProjetos.ts

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OffProjeto } from "../types/consultor.types";

export function useProjetos() {
  const [offProjetos, setOffProjetos] = useState<OffProjeto[]>([]);

  const loadProjetos = async () => {
    const { data } = await supabase
      .from("projetos")
      .select("id, nome_cliente, coordenador_id, deslocamento, email_contato, status, monday_board_url, sharepoint_pasta_url");
    setOffProjetos((data as OffProjeto[]) || []);
  };

  return { offProjetos, loadProjetos };
}
