// src/components/admin/AtividadesCsvWizard.tsx
// Wizard de importacao CSV de Atividades e Itens de Cronograma
// Estrutura identica ao BacklogCsvWizard (BL-004-E)

import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  Upload, Download, Loader2, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, FileText, Info, Calendar
} from "lucide-react";

// ?? TIPOS ??????????????????????????????????????????????????????????????????????

export type AtividadeCSV = {
  linha: number;
  codigo: string;
  descricao: string;
  horas: number;
  data_inicio: string | null;
  data_fim: string | null;
};

export type ItemCSV = {
  linha: number;
  codigo_atividade: string;
  descricao: string;
  horas_reservadas: number;
  data_inicio: string | null;
  data_fim: string | null;
  modalidade: string;
};

type RowStatus = "valido" | "aviso" | "erro";

type AtividadeAnalisada = {
  atividade: AtividadeCSV;
  itens: ItemCSV[];
  status: RowStatus;
  avisos: string[];
  erros: string[];
  selecionado: boolean;
};

export type Props = {
  open: boolean;
  onClose: () => void;
  projetoNome: string;
  horasContratadas: number;
  horasJaPlanejadas: number;
  atividadesExistentes: { codigo: string; descricao: string }[];
  onImportConcluido: (atividades: AtividadeCSV[], itensMap: Record<string, ItemCSV[]>) => void;
};

// ?? CONSTANTES ?????????????????????????????????????????????????????????????????

const MODALIDADES_VALIDAS = ["presencial", "remoto", "hibrido"];
const MAX_ATIVIDADES = 50;

const TEMPLATE_CSV = [
  "# TEMPLATE - Atividades e Itens de Cronograma - Aceex",
  "# Instrucoes:",
  "#   tipo=atividade : define uma atividade do projeto",
  "#   tipo=item      : item de cronograma (vinculado via codigo_atividade)",
  "#   Datas          : DD/MM/AAAA ou AAAA-MM-DD",
  "#   modalidade     : presencial | remoto | hibrido",
  "#   Linhas com # sao comentarios ignorados",
  "tipo,codigo,descricao,horas,data_inicio,data_fim,codigo_atividade,horas_reservadas,modalidade",
  "atividade,A01,Mapeamento de processos,50,10/05/2026,10/06/2026,,,",
  "atividade,A02,Parametrizacao modulo Fiscal,80,11/06/2026,11/07/2026,,,",
  "atividade,A03,Testes integrados,40,12/07/2026,12/08/2026,,,",
  "item,,Levantamento AS-IS,,,20/05/2026,A01,20,presencial",
  "item,,Workshop de validacao,,,10/06/2026,A01,30,remoto",
  "item,,Configuracao parametros fiscais,,,30/06/2026,A02,40,presencial",
  "item,,Homologacao com contador,,,11/07/2026,A02,40,remoto",
  "item,,Ciclo de testes 1,,,28/07/2026,A03,20,presencial",
  "item,,Ciclo de testes 2 com correcoes,,,12/08/2026,A03,20,remoto",
].join("\r\n");

// ?? HELPERS ????????????????????????????????????????????????????????????????????

function detectarEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return "utf-8";
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return "utf-16le";
  return "utf-8";
}

function parseData(s: string): string | null {
  if (!s || !s.trim()) return null;
  const v = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

function parsearCSV(texto: string): {
  atividades: AtividadeCSV[];
  itensRaw: ItemCSV[];
  errosEstrutura: string[];
} {
  const errosEstrutura: string[] = [];
  const atividades: AtividadeCSV[] = [];
  const itensRaw: ItemCSV[] = [];

  const linhas = texto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  if (linhas.length < 2) {
    errosEstrutura.push("Arquivo vazio ou sem dados apos remover comentarios.");
    return { atividades, itensRaw, errosEstrutura };
  }

  const sep = linhas[0].includes(";") ? ";" : ",";
  const headers = linhas[0]
    .split(sep)
    .map(h => h.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\s+/g, "_"));
  const col = (row: string[], nome: string) =>
    row[headers.indexOf(nome)]?.trim().replace(/^"|"$/g, "") ?? "";

  if (!headers.includes("tipo")) {
    errosEstrutura.push("Coluna obrigatoria faltando: tipo");
    return { atividades, itensRaw, errosEstrutura };
  }

  let atividadesCount = 0;

  for (let i = 1; i < linhas.length; i++) {
    const rowArr = linhas[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    const tipo = col(rowArr, "tipo").toLowerCase();

    if (tipo === "atividade") {
      atividadesCount++;
      if (atividadesCount > MAX_ATIVIDADES) {
        errosEstrutura.push(`Limite de ${MAX_ATIVIDADES} atividades excedido.`);
        break;
      }
      const codigo    = col(rowArr, "codigo");
      const descricao = col(rowArr, "descricao");
      const horas     = parseFloat(col(rowArr, "horas"));
      const dataIni   = parseData(col(rowArr, "data_inicio"));
      const dataFim   = parseData(col(rowArr, "data_fim"));

      if (!codigo)               { errosEstrutura.push(`L${i+1}: codigo obrigatorio.`); continue; }
      if (!descricao)            { errosEstrutura.push(`L${i+1}: descricao obrigatoria.`); continue; }
      if (isNaN(horas)||horas<=0){ errosEstrutura.push(`L${i+1}: horas invalidas "${col(rowArr,"horas")}".`); continue; }
      if (atividades.some(a => a.codigo === codigo)) { errosEstrutura.push(`L${i+1}: codigo duplicado "${codigo}".`); continue; }
      if (col(rowArr,"data_inicio") && !dataIni) errosEstrutura.push(`L${i+1}: data_inicio com formato invalido.`);
      if (col(rowArr,"data_fim")   && !dataFim)  errosEstrutura.push(`L${i+1}: data_fim com formato invalido.`);
      if (dataIni && dataFim && dataFim < dataIni) { errosEstrutura.push(`L${i+1}: data_fim anterior a data_inicio.`); continue; }

      atividades.push({ linha: i+1, codigo, descricao, horas, data_inicio: dataIni, data_fim: dataFim });

    } else if (tipo === "item") {
      const codAtiv   = col(rowArr, "codigo_atividade");
      const descricao = col(rowArr, "descricao");
      const horasRes  = parseFloat(col(rowArr, "horas_reservadas"));
      const dataIni   = parseData(col(rowArr, "data_inicio"));
      const dataFim   = parseData(col(rowArr, "data_fim"));
      const mod       = col(rowArr, "modalidade") || "presencial";

      if (!codAtiv)                  { errosEstrutura.push(`L${i+1}: codigo_atividade obrigatorio.`); continue; }
      if (!descricao)                { errosEstrutura.push(`L${i+1}: descricao obrigatoria.`); continue; }
      if (isNaN(horasRes)||horasRes<=0){ errosEstrutura.push(`L${i+1}: horas_reservadas invalidas.`); continue; }
      if (!MODALIDADES_VALIDAS.includes(mod)) { errosEstrutura.push(`L${i+1}: modalidade "${mod}" invalida.`); continue; }

      itensRaw.push({ linha: i+1, codigo_atividade: codAtiv, descricao, horas_reservadas: horasRes, data_inicio: dataIni, data_fim: dataFim, modalidade: mod });

    } else if (tipo) {
      errosEstrutura.push(`L${i+1}: tipo desconhecido "${tipo}" (use "atividade" ou "item").`);
    }
  }

  return { atividades, itensRaw, errosEstrutura };
}

// ?? COMPONENTE PRINCIPAL ???????????????????????????????????????????????????????

export function AtividadesCsvWizard({
  open, onClose, projetoNome, horasContratadas, horasJaPlanejadas,
  atividadesExistentes, onImportConcluido,
}: Props) {
  const [etapa, setEtapa]                         = useState<1 | 2 | 3>(1);
  const [csvFile, setCsvFile]                     = useState<File | null>(null);
  const [errosEstrutura, setErrosEstrutura]       = useState<string[]>([]);
  const [analisando, setAnalisando]               = useState(false);
  const [progresso, setProgresso]                 = useState(0);
  const [linhasAnalisadas, setLinhasAnalisadas]   = useState<AtividadeAnalisada[]>([]);
  const [resultado, setResultado]                 = useState<{ ok: number; ignorados: number } | null>(null);
  const [dragging, setDragging]                   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setEtapa(1); setCsvFile(null); setErrosEstrutura([]);
    setAnalisando(false); setProgresso(0); setLinhasAnalisadas([]); setResultado(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_atividades_${projetoNome.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processarArquivo = useCallback(async (file: File) => {
    setCsvFile(file);
    setErrosEstrutura([]);

    const buffer = await file.arrayBuffer();
    const encoding = detectarEncoding(buffer);
    let texto: string;
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      texto = decoder.decode(buffer);
      if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    } catch {
      try {
        texto = new TextDecoder("windows-1252").decode(buffer);
        toast({ title: "Encoding detectado: Windows-1252", description: "Arquivo convertido. Salve como CSV UTF-8 para evitar problemas." });
      } catch {
        setErrosEstrutura(["Nao foi possivel ler o arquivo. Salve como CSV UTF-8 e tente novamente."]);
        return;
      }
    }

    const { atividades, itensRaw, errosEstrutura: errosParser } = parsearCSV(texto);

    const errosFatais = errosParser.filter(e =>
      e.startsWith("Coluna") || e.startsWith("Arquivo") || e.startsWith("Limite")
    );
    if (errosFatais.length > 0) { setErrosEstrutura(errosFatais); setCsvFile(null); return; }
    if (atividades.length === 0) {
      setErrosEstrutura(["Nenhuma atividade valida encontrada. Verifique linhas com tipo=atividade."]);
      setCsvFile(null); return;
    }

    setEtapa(2); setAnalisando(true); setProgresso(0);

    const analisados: AtividadeAnalisada[] = [];
    const errosGlobais: string[] = [];

    // Validacao global: horas totais
    const totalNovas = atividades.reduce((s, a) => s + a.horas, 0);
    const totalFinal = horasJaPlanejadas + totalNovas;
    if (horasContratadas > 0 && totalFinal > horasContratadas) {
      errosGlobais.push(`Total apos importacao (${totalFinal}h) excede horas contratadas (${horasContratadas}h).`);
    }

    // Itens orfaos
    const codAtivs = new Set(atividades.map(a => a.codigo));
    const orfaos = itensRaw.filter(it => !codAtivs.has(it.codigo_atividade));
    if (orfaos.length > 0) {
      errosGlobais.push(`${orfaos.length} item(ns) referenciam atividades nao encontradas: ${[...new Set(orfaos.map(i => i.codigo_atividade))].join(", ")}`);
    }

    if (errosGlobais.length > 0) setErrosEstrutura(errosGlobais);

    for (let i = 0; i < atividades.length; i++) {
      await new Promise(r => setTimeout(r, 8));
      setProgresso(Math.round(((i + 1) / atividades.length) * 100));

      const atv = atividades[i];
      const itensAtv = itensRaw.filter(it => it.codigo_atividade === atv.codigo);
      const avisos: string[] = [];
      const erros: string[] = [];

      errosParser.filter(e => e.startsWith(`L${atv.linha}:`)).forEach(e => erros.push(e));

      if (atividadesExistentes.some(ex => ex.codigo === atv.codigo))
        avisos.push(`Codigo "${atv.codigo}" ja existe no projeto.`);

      const totalItensHoras = itensAtv.reduce((s, it) => s + it.horas_reservadas, 0);
      if (totalItensHoras > atv.horas)
        erros.push(`Soma dos itens (${totalItensHoras}h) excede horas da atividade (${atv.horas}h).`);

      for (const it of itensAtv) {
        if (it.data_inicio && atv.data_inicio && it.data_inicio < atv.data_inicio)
          erros.push(`Item "${it.descricao}": data_inicio antes da atividade.`);
        if (it.data_fim && atv.data_fim && it.data_fim > atv.data_fim)
          erros.push(`Item "${it.descricao}": data_fim apos atividade.`);
      }

      const status: RowStatus = erros.length > 0 ? "erro" : avisos.length > 0 ? "aviso" : "valido";
      analisados.push({ atividade: atv, itens: itensAtv, status, avisos, erros, selecionado: status !== "erro" });
      setLinhasAnalisadas([...analisados]);
    }

    setAnalisando(false);
  }, [atividadesExistentes, horasContratadas, horasJaPlanejadas]);

  const handleFileChange = (file: File) => {
    if (!file.name.endsWith(".csv")) { setErrosEstrutura(["Apenas arquivos .csv sao aceitos."]); return; }
    processarArquivo(file);
  };

  const toggleSelecionado = (idx: number) =>
    setLinhasAnalisadas(prev => prev.map((l, i) => i === idx ? { ...l, selecionado: !l.selecionado } : l));

  const marcarTodosValidos = () =>
    setLinhasAnalisadas(prev => prev.map(l => l.status !== "erro" ? { ...l, selecionado: true } : l));

  const desmarcarAvisos = () =>
    setLinhasAnalisadas(prev => prev.map(l => l.status === "aviso" ? { ...l, selecionado: false } : l));

  const handleImportar = () => {
    const selecionadas = linhasAnalisadas.filter(l => l.selecionado && l.status !== "erro");
    if (selecionadas.length === 0) { toast({ title: "Nenhuma atividade selecionada", variant: "destructive" }); return; }
    const atividadesParaImportar = selecionadas.map(l => l.atividade);
    const itensMap: Record<string, ItemCSV[]> = {};
    for (const linha of selecionadas) itensMap[linha.atividade.codigo] = linha.itens;
    onImportConcluido(atividadesParaImportar, itensMap);
    setResultado({ ok: selecionadas.length, ignorados: linhasAnalisadas.length - selecionadas.length });
    setEtapa(3);
  };

  const totalValidos      = linhasAnalisadas.filter(l => l.status === "valido").length;
  const totalAvisos       = linhasAnalisadas.filter(l => l.status === "aviso").length;
  const totalErros        = linhasAnalisadas.filter(l => l.status === "erro").length;
  const totalSelecionados = linhasAnalisadas.filter(l => l.selecionado).length;
  const totalItens        = linhasAnalisadas.filter(l => l.selecionado).reduce((s, l) => s + l.itens.length, 0);

  // ?? RENDER ??????????????????????????????????????????????????????????????????

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col gap-0 p-0 max-h-[90dvh] w-full max-w-2xl">

        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-violet-600" />
            Importar CSV &middot; {projetoNome}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            {[{ n: 1, label: "Upload" }, { n: 2, label: "Analise" }, { n: 3, label: "Resultado" }].map((s, i) => (
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

        <div className="flex-1 overflow-y-auto">

          {/* ETAPA 1 - Upload */}
          {etapa === 1 && (
            <div className="px-5 py-6 space-y-5">
              <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
                <Info className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-violet-700 space-y-1">
                  <p className="font-semibold">Campos obrigatorios por tipo:</p>
                  <p><span className="font-medium">atividade:</span> tipo, codigo, descricao, horas</p>
                  <p><span className="font-medium">item:</span> tipo, codigo_atividade, descricao, horas_reservadas</p>
                  <p>Opcionais: data_inicio, data_fim (DD/MM/AAAA), modalidade (presencial | remoto | hibrido)</p>
                  <p>Separador: virgula (,) &middot; Encoding: UTF-8 &middot; Maximo: {MAX_ATIVIDADES} atividades</p>
                  {horasContratadas > 0 && (
                    <p className="font-medium">
                      Horas disponiveis: {horasContratadas - horasJaPlanejadas}h de {horasContratadas}h contratadas
                    </p>
                  )}
                </div>
              </div>

              <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Baixar template CSV
              </Button>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-violet-400 bg-violet-50" : "border-muted hover:border-violet-300 hover:bg-muted/30"}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Arraste o arquivo CSV aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
                <input ref={inputRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
              </div>

              {errosEstrutura.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                  {errosEstrutura.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2 - Analise */}
          {etapa === 2 && (
            <div className="px-5 py-4 space-y-4">
              {analisando && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analisando atividade {linhasAnalisadas.length + 1}...
                    </span>
                    <span className="font-semibold">{progresso}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
                  </div>
                </div>
              )}

              {errosEstrutura.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  {errosEstrutura.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{e}
                    </div>
                  ))}
                </div>
              )}

              {!analisando && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />{totalValidos} validas
                    </span>
                    {totalAvisos > 0 && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />{totalAvisos} com aviso
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
                      Marcar todos validos
                    </Button>
                    {totalAvisos > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={desmarcarAvisos}>
                        Desmarcar com aviso
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="w-8 p-2"></th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Codigo</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Descricao</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground w-16">Horas</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground w-12">Itens</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAnalisadas.map((linha, idx) => (
                      <tr key={idx} className={`border-t ${linha.status === "erro" ? "bg-red-50/50" : linha.status === "aviso" ? "bg-amber-50/50" : ""}`}>
                        <td className="p-2 text-center">
                          {linha.status === "erro" ? (
                            <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                          ) : (
                            <Checkbox checked={linha.selecionado} onCheckedChange={() => toggleSelecionado(idx)} />
                          )}
                        </td>
                        <td className="p-2 font-mono text-muted-foreground">{linha.atividade.codigo}</td>
                        <td className="p-2">
                          <div className="font-medium truncate max-w-[200px]">{linha.atividade.descricao}</div>
                          {linha.avisos.map((a, i) => (
                            <div key={i} className="text-[9px] text-amber-700 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />{a}
                            </div>
                          ))}
                          {linha.erros.map((e, i) => (
                            <div key={i} className="text-[9px] text-red-600 mt-0.5">{e}</div>
                          ))}
                        </td>
                        <td className="p-2 text-muted-foreground">{linha.atividade.horas}h</td>
                        <td className="p-2">
                          {linha.itens.length > 0 && (
                            <span className="flex items-center gap-1 text-violet-600">
                              <Calendar className="h-3 w-3" />{linha.itens.length}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {linha.status === "valido" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {linha.status === "aviso"  && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {linha.status === "erro"   && <XCircle className="h-4 w-4 text-red-500" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!analisando && (
                <p className="text-xs text-muted-foreground">
                  {totalSelecionados} atividade{totalSelecionados !== 1 ? "s" : ""} selecionada{totalSelecionados !== 1 ? "s" : ""}
                  {totalItens > 0 && ` com ${totalItens} item${totalItens !== 1 ? "ns" : ""} de cronograma`}
                </p>
              )}
            </div>
          )}

          {/* ETAPA 3 - Resultado */}
          {etapa === 3 && resultado && (
            <div className="px-5 py-8 space-y-5 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <p className="text-base font-semibold">Importacao concluida!</p>
                <p className="text-xs text-muted-foreground mt-1">{projetoNome}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-xl font-bold text-emerald-700">{resultado.ok}</div>
                  <div className="text-[10px] text-emerald-600">atividade{resultado.ok !== 1 ? "s" : ""} importada{resultado.ok !== 1 ? "s" : ""}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-xl font-bold text-amber-700">{resultado.ignorados}</div>
                  <div className="text-[10px] text-amber-600">ignorada{resultado.ignorados !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Atividades e itens adicionados. Clique em Salvar para persistir as alteracoes.
              </p>
            </div>
          )}

        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {etapa === 3 ? "Fechar" : "Cancelar"}
          </Button>
          <div className="flex items-center gap-2">
            {etapa === 2 && !analisando && (
              <Button size="sm" onClick={handleImportar} disabled={totalSelecionados === 0} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar {totalSelecionados} {totalSelecionados === 1 ? "atividade" : "atividades"}
                {totalItens > 0 && ` + ${totalItens} ${totalItens === 1 ? "item" : "itens"}`}
              </Button>
            )}
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
