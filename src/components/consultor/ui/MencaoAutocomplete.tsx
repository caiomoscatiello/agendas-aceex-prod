// src/components/consultor/ui/MencaoAutocomplete.tsx
// BL-CONS-001-F2 v6 -- contenteditable com chips atomicos
// Suporta: @mencao (azul), #tag (roxo), !criticidade (vermelho/ambar/verde)
// Encoding: UTF-8 sem BOM

import { useRef, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// -- Tipos ------------------------------------------------------------------

type UsuarioSugestao = { id: string; name: string };
type TagSugestao     = { label: string };
type CriticidadeOpt  = { label: string; valor: "alta" | "media" | "baixa" };

type TipoChip = "mencao" | "tag" | "criticidade";

type ChipInfo = {
  tipo: TipoChip;
  id?: string;       // user_id para mencao
  nome: string;      // nome exibido
  valor?: string;    // "alta"|"media"|"baixa" para criticidade, texto para tag
};

type Props = {
  value: string;
  onChange: (texto: string, mencionados: string[], tags: string[], criticidade: string | null) => void;
  projetoId: string;
  currentUserId?: string;  // bloqueia mencao ao proprio usuario
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
};

// -- Constantes -------------------------------------------------------------

const CRITICIDADES: CriticidadeOpt[] = [
  { label: "Alta",  valor: "alta"  },
  { label: "Media", valor: "media" },
  { label: "Baixa", valor: "baixa" },
];

const CHIP_STYLES: Record<TipoChip, { bg: string; color: string; border: string }> = {
  mencao:      { bg: "rgba(37,99,235,0.10)",   color: "#1d4ed8", border: "rgba(37,99,235,0.25)"   },
  tag:         { bg: "rgba(124,58,237,0.10)",  color: "#6d28d9", border: "rgba(124,58,237,0.25)"  },
  criticidade: { bg: "rgba(220,38,38,0.10)",   color: "#b91c1c", border: "rgba(220,38,38,0.25)"   },
};

// Cor da criticidade individual
function corCriticidade(valor: string): { bg: string; color: string; border: string } {
  if (valor === "alta")  return { bg: "rgba(220,38,38,0.10)",   color: "#b91c1c", border: "rgba(220,38,38,0.25)"   };
  if (valor === "media") return { bg: "rgba(217,119,6,0.10)",   color: "#b45309", border: "rgba(217,119,6,0.25)"   };
  return                        { bg: "rgba(22,163,74,0.10)",   color: "#15803d", border: "rgba(22,163,74,0.25)"   };
}

function simboloCriticidade(valor: string): string {
  if (valor === "alta")  return "!!! ";
  if (valor === "media") return "!! ";
  return "! ";
}

// -- Helpers de DOM ---------------------------------------------------------

function extrairDoDOM(el: HTMLDivElement): {
  texto: string; mencionados: string[]; tags: string[]; criticidade: string | null;
} {
  const mencionados: string[] = [];
  const tags: string[]        = [];
  let criticidade: string | null = null;
  let texto = "";

  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      texto += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const span = node as HTMLElement;
      if (span.dataset.tipo === "mencao" && span.dataset.userId) {
        mencionados.push(span.dataset.userId);
        texto += `@[${span.dataset.userName}](${span.dataset.userId})`;
      } else if (span.dataset.tipo === "tag" && span.dataset.tagValor) {
        tags.push(span.dataset.tagValor);
        texto += `#[${span.dataset.tagValor}]`;
      } else if (span.dataset.tipo === "criticidade" && span.dataset.critValor) {
        criticidade = span.dataset.critValor;
        texto += `![${span.dataset.critValor}]`;
      } else {
        texto += span.textContent || "";
      }
    }
  });

  return {
    texto,
    mencionados: [...new Set(mencionados)],
    tags:        [...new Set(tags)],
    criticidade,
  };
}

function textoCursor(el: HTMLDivElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString();
}

function cursorAposChip(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return null;
  const { startContainer, startOffset } = range;
  if (startOffset === 0 && startContainer.previousSibling) {
    const prev = startContainer.previousSibling as HTMLElement;
    if (prev.dataset?.tipo) return prev;
  }
  if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
    const prev = startContainer.previousSibling as HTMLElement;
    if (prev?.dataset?.tipo) return prev;
  }
  return null;
}

function criarChipEl(info: ChipInfo): { chip: HTMLElement; espaco: Text } {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.tipo = info.tipo;

  let estilo = CHIP_STYLES[info.tipo];
  let exibicao = "";

  if (info.tipo === "mencao") {
    chip.dataset.userId   = info.id!;
    chip.dataset.userName = info.nome;
    exibicao = `@${info.nome}`;
  } else if (info.tipo === "tag") {
    chip.dataset.tagValor = info.valor || info.nome;
    exibicao = `#${info.nome}`;
  } else if (info.tipo === "criticidade") {
    chip.dataset.critValor = info.valor!;
    estilo = corCriticidade(info.valor!);
    exibicao = `${simboloCriticidade(info.valor!)}${info.nome}`;
  }

  chip.textContent = exibicao;
  chip.setAttribute("style", [
    `display:inline-flex`,
    `align-items:center`,
    `background:${estilo.bg}`,
    `color:${estilo.color}`,
    `border:1px solid ${estilo.border}`,
    `border-radius:999px`,
    `padding:0 8px`,
    `font-size:11px`,
    `font-weight:500`,
    `line-height:1.6`,
    `margin:0 2px`,
    `cursor:default`,
    `user-select:none`,
    `white-space:nowrap`,
  ].join(";"));

  const espaco = document.createTextNode("\u00A0");
  return { chip, espaco };
}

function inserirChipNoCursor(info: ChipInfo, buscaLen: number) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.setStart(range.startContainer, Math.max(0, range.startOffset - buscaLen - 1));
  range.deleteContents();

  const { chip, espaco } = criarChipEl(info);
  range.insertNode(espaco);
  range.insertNode(chip);

  const novo = document.createRange();
  novo.setStartAfter(espaco);
  novo.collapse(true);
  sel.removeAllRanges();
  sel.addRange(novo);
}

// -- Componente -------------------------------------------------------------

export function MencaoAutocomplete({
  value,
  onChange,
  projetoId,
  currentUserId,
  placeholder = "Registre uma decisao, ocorrencia ou marco... use @ # !",
  rows = 3,
  disabled = false,
}: Props) {
  const editorRef                           = useRef<HTMLDivElement>(null);
  const [modo, setModo]                     = useState<"@" | "#" | "!" | null>(null);
  const [busca, setBusca]                   = useState<string>("");
  const [usuarios, setUsuarios]             = useState<UsuarioSugestao[]>([]);
  const [tagsSugeridas, setTagsSugeridas]   = useState<TagSugestao[]>([]);
  const [indiceSel, setIndiceSel]           = useState(0);
  const [carregando, setCarregando]         = useState(false);
  const projetoCarregadoRef                 = useRef<string>("");
  const suprimirRef                         = useRef(false);

  const minHeight = `${rows * 1.6}rem`;

  // Reset
  useEffect(() => {
    if (value === "" && editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }, [value]);

  // Buscar usuarios (lazy)
  const buscarUsuarios = useCallback(async (pid: string) => {
    if (!pid || pid === projetoCarregadoRef.current) return;
    projetoCarregadoRef.current = pid;
    setCarregando(true);
    try {
      const { data, error } = await supabase.functions.invoke("diario-entry", {
        body: { action: "usuarios_mencionaveis", projeto_id: pid },
      });
      if (!error && data?.usuarios) setUsuarios(data.usuarios);
    } catch { /* silencioso */ }
    setCarregando(false);
  }, []);

  // Buscar tags usadas no projeto (lazy, a partir do texto das entradas)
  const buscarTags = useCallback(async (pid: string) => {
    if (!pid) return;
    try {
      const { data } = await supabase
        .from("projeto_diario")
        .select("tags")
        .eq("projeto_id", pid)
        .not("tags", "eq", "{}");
      const todas = new Set<string>();
      for (const row of data || []) {
        for (const t of row.tags || []) todas.add(t);
      }
      setTagsSugeridas([...todas].map(t => ({ label: t })));
    } catch { /* silencioso */ }
  }, []);

  // Notificar mudanca
  const notificar = useCallback(() => {
    if (!editorRef.current) return;
    const { texto, mencionados, tags, criticidade } = extrairDoDOM(editorRef.current);
    onChange(texto, mencionados, tags, criticidade);
  }, [onChange]);

  // Sugestoes atuais baseadas no modo e busca
  const sugestoes: Array<{ label: string; sub?: string; action: () => void }> = [];

  if (modo === "@") {
    const q = busca.toLowerCase();
    usuarios
      .filter(u => u.name.toLowerCase().includes(q) && u.id !== currentUserId)
      .slice(0, 5)
      .forEach(u => sugestoes.push({
        label: u.name,
        action: () => {
          inserirChipNoCursor({ tipo: "mencao", id: u.id, nome: u.name }, busca.length);
          setModo(null); setBusca(""); setTimeout(() => { notificar(); editorRef.current?.focus(); }, 0);
        },
      }));
  } else if (modo === "#") {
    const q = busca.toLowerCase();
    const existentes = tagsSugeridas.filter(t => t.label.toLowerCase().includes(q)).slice(0, 4);
    existentes.forEach(t => sugestoes.push({
      label: t.label,
      action: () => {
        inserirChipNoCursor({ tipo: "tag", nome: t.label, valor: t.label }, busca.length);
        setModo(null); setBusca(""); setTimeout(() => { notificar(); editorRef.current?.focus(); }, 0);
      },
    }));
    // Opcao de criar nova tag se busca nao esta na lista
    if (busca.trim() && !existentes.find(t => t.label.toLowerCase() === busca.toLowerCase())) {
      sugestoes.push({
        label: busca.trim(),
        sub: "Nova tag",
        action: () => {
          inserirChipNoCursor({ tipo: "tag", nome: busca.trim(), valor: busca.trim() }, busca.length);
          setModo(null); setBusca(""); setTimeout(() => { notificar(); editorRef.current?.focus(); }, 0);
        },
      });
    }
  } else if (modo === "!") {
    const q = busca.toLowerCase();
    CRITICIDADES.filter(c => c.label.toLowerCase().includes(q)).forEach(c => {
      const cor = corCriticidade(c.valor);
      sugestoes.push({
        label: c.label,
        action: () => {
          inserirChipNoCursor({ tipo: "criticidade", nome: c.label, valor: c.valor }, busca.length);
          setModo(null); setBusca(""); setTimeout(() => { notificar(); editorRef.current?.focus(); }, 0);
        },
      });
    });
  }

  // onInput
  const handleInput = useCallback(() => {
    if (suprimirRef.current) { suprimirRef.current = false; return; }
    if (!editorRef.current) return;

    const ante  = textoCursor(editorRef.current);
    const matchMencao = ante.match(/@([^\s@]*)$/);
    const matchTag    = ante.match(/#([^\s#]*)$/);
    const matchCrit   = ante.match(/!([^\s!]*)$/);

    if (matchMencao) {
      setModo("@"); setBusca(matchMencao[1]);
      buscarUsuarios(projetoId);
    } else if (matchTag) {
      setModo("#"); setBusca(matchTag[1]);
      buscarTags(projetoId);
    } else if (matchCrit) {
      setModo("!"); setBusca(matchCrit[1]);
    } else {
      setModo(null); setBusca("");
    }
    notificar();
  }, [buscarUsuarios, buscarTags, projetoId, notificar]);

  // onKeyDown
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (modo !== null && sugestoes.length > 0) {
      if (e.key === "ArrowDown")  { e.preventDefault(); setIndiceSel(i => Math.min(i+1, sugestoes.length-1)); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); setIndiceSel(i => Math.max(i-1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); sugestoes[indiceSel].action(); return; }
      if (e.key === "Escape")     { setModo(null); setBusca(""); return; }
    }
    if (e.key === "Backspace") {
      const chip = cursorAposChip();
      if (chip) { e.preventDefault(); chip.remove(); notificar(); }
    }
  }, [modo, sugestoes, indiceSel, notificar]);

  // onPaste
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setModo(null); setBusca("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <>
      <style>{`
        .mencao-editor:focus { outline: none; }
        .mencao-editor[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>

      <div style={{ position: "relative" }}>
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="mencao-editor w-full text-xs rounded-md border px-3 py-2 bg-background focus:ring-1 focus:ring-ring"
          style={{
            minHeight,
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowY: "auto",
            cursor: disabled ? "not-allowed" : "text",
            opacity: disabled ? 0.5 : 1,
          }}
          data-placeholder={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        {/* Hint de atalhos */}
        {!disabled && modo === null && (
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>
              <span style={{ color: "#1d4ed8", fontWeight: 500 }}>@</span> mencionar
            </span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>
              <span style={{ color: "#6d28d9", fontWeight: 500 }}>#</span> tag
            </span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>
              <span style={{ color: "#b91c1c", fontWeight: 500 }}>!</span> criticidade
            </span>
          </div>
        )}

        {/* Dropdown */}
        {modo !== null && (
          <div
            className="absolute z-50 w-56 bg-popover border rounded-lg shadow-lg overflow-hidden"
            style={{ bottom: "calc(100% + 4px)", left: 0 }}
          >
            {/* Header do modo */}
            <div style={{
              padding: "5px 12px",
              fontSize: 10,
              fontWeight: 600,
              color: modo === "@" ? "#1d4ed8" : modo === "#" ? "#6d28d9" : "#b91c1c",
              borderBottom: "0.5px solid var(--border)",
              background: "var(--muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              {modo === "@" ? "Mencionar" : modo === "#" ? "Tag" : "Criticidade"}
            </div>

            {carregando && modo === "@" ? (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">Buscando...</div>
            ) : sugestoes.length > 0 ? (
              sugestoes.map((s, idx) => (
                <button
                  key={s.label}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); s.action(); setIndiceSel(idx); }}
                  className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                    idx === indiceSel ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  }`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {modo === "@" && (
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#1d4ed8" }}>{s.label.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    {modo === "!" && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: corCriticidade(CRITICIDADES.find(c => c.label === s.label)?.valor || "baixa").color }}>
                        {simboloCriticidade(CRITICIDADES.find(c => c.label === s.label)?.valor || "baixa")}
                      </span>
                    )}
                    <span className="truncate">{s.label}</span>
                  </div>
                  {s.sub && <span style={{ fontSize: 9, color: "#9ca3af", flexShrink: 0 }}>{s.sub}</span>}
                </button>
              ))
            ) : busca.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                {modo === "@" ? "Digite para filtrar..." : modo === "#" ? "Digite o nome da tag..." : "Digite a criticidade..."}
              </div>
            ) : (
              <div className="px-3 py-2 text-[11px] text-muted-foreground">Nenhum resultado</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
