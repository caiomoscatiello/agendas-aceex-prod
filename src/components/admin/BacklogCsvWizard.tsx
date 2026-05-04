// src/components/admin/BacklogCsvWizard.tsx
// BL-004-E ? Wizard de importa??o CSV do Backlog

import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Upload, Download, Loader2, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, ChevronLeft, FileText, Info
} from "lucide-react";

// ?? TIPOS ?????????????????????????????????????????????????????????????????????

type CSVRow = {
  linha: number;
  titulo: string;
  tipo: string;
  prioridade: string;
  frente_modulo: string;
  descricao_solicitante?: string;
  estimativa_horas?: number | null;
  data_prevista?: string | null;
  raw: Record<string, string>;
};

type RowStatus = "valido" | "suspeito" | "erro";

type RowAnalisado = {
  row: CSVRow;
  status: RowStatus;
  erros: string[];
  similaridade?: { codigo: string; titulo: string; score: number };
  selecionado: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  projetoId: string;
  projetoNome: string;
  userId: string;
  itemsExistentes: { codigo: string; titulo: string; descricao_solicitante: string | null }[];
  colunaAbertoId: string;
  onImportConcluido: () => void;
};

// ?? CONSTANTES ????????????????????????????????????????????????????????????????

const TIPOS_VALIDOS = ["melhoria", "bug", "duvida", "configuracao", "treinamento", "outro"];
const PRIORIDADES_VALIDAS = ["critica", "alta", "media", "baixa"];
const FRENTES_VALIDAS = ["fiscal", "financeiro", "estoque", "compras", "rh", "contabil", "outro"];
const MAX_LINHAS = 100;

const TEMPLATE_CSV = [
  "titulo;tipo;prioridade;frente_modulo;descricao_solicitante;estimativa_horas;data_prevista",
  "Configurar parametros de ICMS;configuracao;alta;fiscal;Parametros nao estao aplicando corretamente para vendas;4;2026-06-30",
  "Treinar equipe modulo compras;treinamento;media;compras;Usuarios nao foram treinados no novo fluxo de aprovacao;8;2026-07-15",
].join("\r\n");

// ?? TF-IDF SIMILARIDADE ???????????????????????????????????????????????????????

function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function calcularSimilaridade(textoA: string, textoB: string): number {
  const tokA = new Set(tokenizar(textoA));
  const tokB = new Set(tokenizar(textoB));
  if (tokA.size === 0 || tokB.size === 0) return 0;

  const intersecao = [...tokA].filter(t => tokB.has(t)).length;
  const uniao = new Set([...tokA, ...tokB]).size;

  // Jaccard similarity
  const jaccard = intersecao / uniao;

  // Bonus para termos raros compartilhados (peso extra)
  const bonus = intersecao > 3 ? 0.1 : 0;

  return Math.min(1, jaccard + bonus);
}

const THRESHOLD_SUSPEITO = 0.25; // threshold medio conforme decisao

// ?? PARSE CSV ????????????????????????????????????????????????????????????????

function detectarEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  // BOM UTF-8
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return "utf-8";
  // BOM UTF-16 LE
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return "utf-16le";
  return "utf-8"; // default ? tentar UTF-8 primeiro
}

function parsearCSV(texto: string): { rows: CSVRow[]; erros: string[] } {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return { rows: [], erros: ["Arquivo vazio ou sem dados"] };
  if (linhas.length - 1 > MAX_LINHAS) return { rows: [], erros: [`Limite de ${MAX_LINHAS} linhas excedido. Arquivo tem ${linhas.length - 1} linhas.`] };

  const sep = linhas[0].includes(";") ? ";" : ",";
  const headers = linhas[0].split(sep).map(h => h.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\s+/g, "_"));

  const camposObrigatorios = ["titulo", "tipo", "prioridade", "frente_modulo"];
  const faltando = camposObrigatorios.filter(c => !headers.includes(c));
  if (faltando.length > 0) {
    return { rows: [], erros: [`Colunas obrigatorias faltando: ${faltando.join(", ")}`] };
  }

  const rows: CSVRow[] = [];
  const erros: string[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const vals = linhas[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = vals[idx] || ""; });

    const row: CSVRow = {
      linha: i + 1,
      titulo: raw.titulo || "",
      tipo: TIPOS_VALIDOS.includes(raw.tipo) ? raw.tipo : "outro",
      prioridade: PRIORIDADES_VALIDAS.includes(raw.prioridade) ? raw.prioridade : "media",
      frente_modulo: FRENTES_VALIDAS.includes(raw.frente_modulo) ? raw.frente_modulo : "outro",
      descricao_solicitante: raw.descricao_solicitante || undefined,
      estimativa_horas: raw.estimativa_horas ? parseFloat(raw.estimativa_horas) || null : null,
      data_prevista: null, // calculado abaixo
      raw,
    };

    // Converter data: aceita yyyy-MM-dd e dd/MM/yyyy automaticamente
    if (raw.data_prevista) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw.data_prevista)) {
        row.data_prevista = raw.data_prevista;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw.data_prevista)) {
        const [dd, mm, yyyy] = raw.data_prevista.split('/');
        row.data_prevista = `${yyyy}-${mm}-${dd}`;
      } else {
        erros.push(`Linha ${row.linha}: data_prevista com formato invalido "${raw.data_prevista}" ? use DD/MM/AAAA ou AAAA-MM-DD`);
      }
    }

    if (!row.titulo.trim()) {
      erros.push(`Linha ${row.linha}: titulo vazio ? ignorada`);
      continue;
    }

    rows.push(row);
  }

  return { rows, erros };
}

// ?? COMPONENTE PRINCIPAL ??????????????????????????????????????????????????????

export function BacklogCsvWizard({
  open, onClose, projetoId, projetoNome, userId,
  itemsExistentes, colunaAbertoId, onImportConcluido,
}: Props) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [errosEstrutura, setErrosEstrutura] = useState<string[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [linhasAnalisadas, setLinhasAnalisadas] = useState<RowAnalisado[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; ignorados: number; erros: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEtapa(1);
    setCsvFile(null);
    setErrosEstrutura([]);
    setAnalisando(false);
    setProgresso(0);
    setLinhasAnalisadas([]);
    setImportando(false);
    setResultado(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Download template
  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_backlog_${projetoNome.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Processar arquivo
  const processarArquivo = useCallback(async (file: File) => {
    setCsvFile(file);
    setErrosEstrutura([]);

    // Detectar encoding e ler
    const buffer = await file.arrayBuffer();
    const encoding = detectarEncoding(buffer);

    let texto: string;
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      texto = decoder.decode(buffer);
      // Remover BOM se presente
      if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    } catch {
      try {
        // Fallback: tentar windows-1252
        const decoder = new TextDecoder("windows-1252");
        texto = decoder.decode(buffer);
        toast({
          title: "Encoding detectado: Windows-1252",
          description: "Arquivo convertido automaticamente. Para evitar problemas, salve como CSV UTF-8 no Excel.",
        });
      } catch {
        setErrosEstrutura(["Nao foi possivel ler o arquivo. Salve como CSV UTF-8 (Dados > Salvar como > CSV UTF-8) e tente novamente."]);
        return;
      }
    }

    const { rows, erros } = parsearCSV(texto);

    if (erros.some(e => e.startsWith("Colunas") || e.startsWith("Arquivo") || e.startsWith("Limite"))) {
      setErrosEstrutura(erros);
      setCsvFile(null);
      return;
    }

    if (rows.length === 0) {
      setErrosEstrutura(["Nenhuma linha v?lida encontrada no arquivo."]);
      setCsvFile(null);
      return;
    }

    // Avan?ar para etapa 2 e analisar
    setEtapa(2);
    setAnalisando(true);
    setProgresso(0);

    const analisados: RowAnalisado[] = [];
    const errosEstrutura: string[] = erros;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Timeout safety ? processar com pequeno delay para n?o travar UI
      await new Promise(r => setTimeout(r, 10));
      setProgresso(Math.round(((i + 1) / rows.length) * 100));
      setLinhasAnalisadas(a => [...a, {
        row, status: "valido", erros: [], selecionado: true,
      }]);

      // Calcular similaridade com itens existentes
      let melhorSimilaridade: RowAnalisado["similaridade"] | undefined;
      let melhorScore = 0;

      for (const existente of itemsExistentes) {
        const textoExistente = existente.titulo + " " + (existente.descricao_solicitante || "");
        const textoNovo = row.titulo + " " + (row.descricao_solicitante || "");
        const score = calcularSimilaridade(textoNovo, textoExistente);

        if (score > melhorScore) {
          melhorScore = score;
          melhorSimilaridade = { codigo: existente.codigo, titulo: existente.titulo, score };
        }
      }

      const status: RowStatus = melhorScore >= THRESHOLD_SUSPEITO ? "suspeito" : "valido";

      analisados[i] = {
        row,
        status,
        erros: errosEstrutura.filter(e => e.startsWith(`Linha ${row.linha}:`)),
        similaridade: melhorScore >= THRESHOLD_SUSPEITO ? melhorSimilaridade : undefined,
        selecionado: status === "valido", // suspeitos v?m desmarcados
      };

      setLinhasAnalisadas([...analisados]);
    }

    setAnalisando(false);
  }, [itemsExistentes]);

  const handleFileChange = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setErrosEstrutura(["Apenas arquivos .csv s?o aceitos."]);
      return;
    }
    processarArquivo(file);
  };

  const toggleSelecionado = (idx: number) => {
    setLinhasAnalisadas(prev => prev.map((l, i) =>
      i === idx ? { ...l, selecionado: !l.selecionado } : l
    ));
  };

  const marcarTodosValidos = () => {
    setLinhasAnalisadas(prev => prev.map(l =>
      l.status !== "erro" ? { ...l, selecionado: true } : l
    ));
  };

  const desmarcarSuspeitos = () => {
    setLinhasAnalisadas(prev => prev.map(l =>
      l.status === "suspeito" ? { ...l, selecionado: false } : l
    ));
  };

  // Importar
  const handleImportar = async () => {
    const paraImportar = linhasAnalisadas.filter(l => l.selecionado && l.status !== "erro");
    if (paraImportar.length === 0) {
      toast({ title: "Nenhum item selecionado", variant: "destructive" });
      return;
    }

    setImportando(true);
    let ok = 0;
    let erros = 0;
    const loteId = crypto.randomUUID();

    // Insert sequencial (um por vez) para evitar race condition no trigger de c?digo
    for (const linha of paraImportar) {
      const { data: novo, error } = await supabase
        .from("projeto_backlog")
        .insert({
          projeto_id: projetoId,
          coluna_id: colunaAbertoId,
          titulo: linha.row.titulo,
          descricao_solicitante: linha.row.descricao_solicitante || null,
          tipo: linha.row.tipo,
          prioridade: linha.row.prioridade,
          frente_modulo: linha.row.frente_modulo,
          estimativa_horas: linha.row.estimativa_horas || null,
          data_prevista: linha.row.data_prevista || null,
          criado_por: userId,
          ordem: 0,
          visivel_cliente: false,
          hierarquia_bloqueada: true,
        })
        .select()
        .single();

      if (error || !novo) { erros++; continue; }

      // Hist?rico individual
      await supabase.from("projeto_backlog_historico").insert({
        backlog_item_id: novo.id,
        para_coluna_id: colunaAbertoId,
        movido_por: userId,
        tipo_evento: "criacao",
        detalhe: { titulo: novo.titulo, origem: "csv", lote_id: loteId },
      });

      ok++;
    }

    // Registro de auditoria do lote ? usando o primeiro item como refer?ncia
    // (registrado no hist?rico geral como evento especial)
    const primeiroItem = await supabase
      .from("projeto_backlog")
      .select("id")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (primeiroItem.data) {
      await supabase.from("projeto_backlog_historico").insert({
        backlog_item_id: primeiroItem.data.id,
        para_coluna_id: colunaAbertoId,
        movido_por: userId,
        tipo_evento: "importacao_lote",
        detalhe: {
          lote_id: loteId,
          arquivo: csvFile?.name || "desconhecido",
          total_selecionados: paraImportar.length,
          importados: ok,
          com_erro: erros,
          ignorados: linhasAnalisadas.length - paraImportar.length,
        },
      });
    }

    setImportando(false);
    setResultado({
      ok,
      ignorados: linhasAnalisadas.length - paraImportar.length,
      erros,
    });
    setEtapa(3);
    onImportConcluido();
  };

  // Download CSV dos n?o importados
  const downloadNaoImportados = () => {
    const naoImportados = linhasAnalisadas.filter(l => !l.selecionado || l.status === "erro");
    if (naoImportados.length === 0) return;

    const headers = "titulo;tipo;prioridade;frente_modulo;descricao_solicitante;estimativa_horas;data_prevista";
    const linhas = naoImportados.map(l =>
      [
        l.row.titulo,
        l.row.tipo,
        l.row.prioridade,
        l.row.frente_modulo,
        l.row.descricao_solicitante || "",
        l.row.estimativa_horas || "",
        l.row.data_prevista || "",
      ].join(";")
    );

    const csv = "\uFEFF" + [headers, ...linhas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nao_importados_${projetoNome.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Contadores para etapa 2
  const totalValidos = linhasAnalisadas.filter(l => l.status === "valido").length;
  const totalSuspeitos = linhasAnalisadas.filter(l => l.status === "suspeito").length;
  const totalErros = linhasAnalisadas.filter(l => l.status === "erro").length;
  const totalSelecionados = linhasAnalisadas.filter(l => l.selecionado).length;
  const naoImportadosCount = linhasAnalisadas.filter(l => !l.selecionado || l.status === "erro").length;

  // ?? RENDER ?????????????????????????????????????????????????????????????????

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-2xl">

        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-violet-600" />
            Importar CSV ? {projetoNome}
          </DialogTitle>
          {/* Steps indicator */}
          <div className="flex items-center gap-2 mt-2">
            {[
              { n: 1, label: "Upload" },
              { n: 2, label: "Analise" },
              { n: 3, label: "Resultado" },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${etapa >= s.n ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"}`}>
                  {s.n}
                </div>
                <span className={`text-xs ${etapa === s.n ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto">

          {/* ETAPA 1 ? Upload */}
          {etapa === 1 && (
            <div className="px-5 py-6 space-y-5">
              <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
                <Info className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-violet-700 space-y-1">
                  <p className="font-semibold">Campos obrigatorios: titulo, tipo, prioridade, frente_modulo</p>
                  <p>Campos opcionais: descricao_solicitante, estimativa_horas, data_prevista (formato: YYYY-MM-DD)</p>
                  <p>Separador: ponto-e-v?rgula (;) · Encoding: UTF-8 · M?ximo: {MAX_LINHAS} linhas</p>
                </div>
              </div>

              <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Baixar template CSV
              </Button>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-violet-400 bg-violet-50" : "border-muted hover:border-violet-300 hover:bg-muted/30"}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileChange(file);
                }}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Arraste o arquivo CSV aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
                />
              </div>

              {/* Erros de estrutura */}
              {errosEstrutura.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                  {errosEstrutura.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2 ? Analise e Preview */}
          {etapa === 2 && (
            <div className="px-5 py-4 space-y-4">
              {/* Barra de progresso */}
              {analisando && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analisando item {linhasAnalisadas.length} de {linhasAnalisadas.length + 1}...
                    </span>
                    <span className="font-semibold">{progresso}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
                  </div>
                </div>
              )}

              {/* Resumo */}
              {!analisando && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />{totalValidos} v?lidos
                    </span>
                    {totalSuspeitos > 0 && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />{totalSuspeitos} suspeitos
                      </span>
                    )}
                    {totalErros > 0 && (
                      <span className="flex items-center gap-1 text-red-700">
                        <XCircle className="h-3.5 w-3.5" />{totalErros} com erro
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={marcarTodosValidos}>
                      Marcar todos v?lidos
                    </Button>
                    {totalSuspeitos > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={desmarcarSuspeitos}>
                        Desmarcar suspeitos
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Tabela de preview */}
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="w-8 p-2"></th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">T?tulo</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground w-20">Tipo</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground w-20">Prioridade</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAnalisadas.map((linha, idx) => (
                      <tr
                        key={idx}
                        className={`border-t ${linha.status === "erro" ? "bg-red-50/50" : linha.status === "suspeito" ? "bg-amber-50/50" : ""}`}
                      >
                        <td className="p-2 text-center">
                          {linha.status === "erro" ? (
                            <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                          ) : (
                            <Checkbox
                              checked={linha.selecionado}
                              onCheckedChange={() => toggleSelecionado(idx)}
                            />
                          )}
                        </td>
                        <td className="p-2">
                          <div className="font-medium truncate max-w-[240px]">{linha.row.titulo}</div>
                          {/* Mostrar similaridade com item existente */}
                          {linha.similaridade && (
                            <div className="text-[9px] text-amber-700 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />
                              Similar ({Math.round(linha.similaridade.score * 100)}%): [{linha.similaridade.codigo}] {linha.similaridade.titulo.slice(0, 40)}
                            </div>
                          )}
                          {linha.erros.map((e, i) => (
                            <div key={i} className="text-[9px] text-red-600 mt-0.5">{e}</div>
                          ))}
                        </td>
                        <td className="p-2 text-muted-foreground capitalize">{linha.row.tipo}</td>
                        <td className="p-2">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            linha.row.prioridade === "critica" ? "bg-red-100 text-red-700" :
                            linha.row.prioridade === "alta" ? "bg-amber-100 text-amber-700" :
                            linha.row.prioridade === "media" ? "bg-blue-100 text-blue-700" :
                            "bg-emerald-100 text-emerald-700"
                          }`}>
                            {linha.row.prioridade}
                          </span>
                        </td>
                        <td className="p-2">
                          {linha.status === "valido" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {linha.status === "suspeito" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {linha.status === "erro" && <XCircle className="h-4 w-4 text-red-500" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!analisando && (
                <p className="text-xs text-muted-foreground">
                  {totalSelecionados} item{totalSelecionados !== 1 ? "s" : ""} selecionado{totalSelecionados !== 1 ? "s" : ""} para importar
                </p>
              )}
            </div>
          )}

          {/* ETAPA 3 ? Resultado */}
          {etapa === 3 && resultado && (
            <div className="px-5 py-8 space-y-5 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <p className="text-base font-semibold">Importacao concluida!</p>
                <p className="text-xs text-muted-foreground mt-1">{projetoNome}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-xl font-bold text-emerald-700">{resultado.ok}</div>
                  <div className="text-[10px] text-emerald-600">importados</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-xl font-bold text-amber-700">{resultado.ignorados}</div>
                  <div className="text-[10px] text-amber-600">ignorados</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="text-xl font-bold text-red-700">{resultado.erros}</div>
                  <div className="text-[10px] text-red-600">com erro</div>
                </div>
              </div>
              {naoImportadosCount > 0 && (
                <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium">Deseja avaliar os itens n?o importados?</p>
                  <p className="text-xs text-muted-foreground">
                    {naoImportadosCount} {naoImportadosCount === 1 ? "item foi ignorado ou teve erro" : "itens foram ignorados ou tiveram erro"}.
                    Baixe o CSV para revisar e reimportar.
                  </p>
                  <Button size="sm" variant="outline" className="gap-2" onClick={downloadNaoImportados}>
                    <Download className="h-4 w-4" />
                    Baixar CSV dos n?o importados
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t px-5 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {etapa === 3 ? "Fechar" : "Cancelar"}
          </Button>
          <div className="flex items-center gap-2">
            {etapa === 2 && !analisando && (
              <Button
                size="sm"
                onClick={handleImportar}
                disabled={importando || totalSelecionados === 0}
                className="gap-2"
              >
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {totalSelecionados} {totalSelecionados === 1 ? "item" : "itens"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
