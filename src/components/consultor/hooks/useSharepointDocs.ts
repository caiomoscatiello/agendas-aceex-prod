// src/components/consultor/hooks/useSharepointDocs.ts
// Hook para listar documentos da pasta do projeto no SharePoint.
// Chama a EF sharepoint-upload com action "list".
// Zero alteracao em outros arquivos.
// Encoding: UTF-8 sem BOM

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SpFile = {
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
};

type UseSharepointDocsResult = {
  files: SpFile[];
  loading: boolean;
  error: string | null;
  loadFiles: (codigoCliente: string, nomeCliente: string) => Promise<void>;
  clear: () => void;
};

export function useSharepointDocs(): UseSharepointDocsResult {
  const [files, setFiles]     = useState<SpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const loadFiles = useCallback(async (codigoCliente: string, nomeCliente: string) => {
    if (!codigoCliente || !nomeCliente) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sharepoint-upload", {
        body: {
          action:          "list",
          codigo_cliente:  codigoCliente,
          nome_cliente:    nomeCliente,
        },
      });

      if (fnError) {
        setError(fnError.message || "Erro ao buscar documentos");
        setFiles([]);
        return;
      }

      if (!data?.success) {
        setError(data?.error || "Erro inesperado na listagem");
        setFiles([]);
        return;
      }

      setFiles(data.files || []);
    } catch (e: any) {
      setError(e.message || "Erro de rede");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  return { files, loading, error, loadFiles, clear };
}

// ??? Helpers ??????????????????????????????????????????????????????????????????

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mimeType: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (mimeType.includes("pdf") || ext === "pdf")                    return "pdf";
  if (mimeType.includes("word") || ext === "doc" || ext === "docx") return "doc";
  if (mimeType.includes("excel") || ext === "xls" || ext === "xlsx") return "xls";
  if (mimeType.includes("image") || ["jpg","jpeg","png","gif","webp"].includes(ext)) return "img";
  return "file";
}
