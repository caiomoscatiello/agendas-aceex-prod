// src/components/consultor/ui/BacklogConsultorModal.tsx
// BL-CONS-001 -- Modal "Meu Backlog" do Consultor
// CRIAR arquivo novo -- nao altera nenhum arquivo existente
// Encoding: UTF-8 sem BOM

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CalendarClock, FileWarning, AlertTriangle, AtSign,
         ArrowDownUp, Calendar, CircleCheck, CalendarPlus, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import {
  useBacklogConsultor,
  type BacklogAgenda,
  type BacklogMencao,
  type BacklogDocumento,
  type BacklogTravado,
  type PeriodoBacklog,
  type OrdenacaoBacklog,
  type BacklogScoreFaixa,
} from "@/components/consultor/hooks/useBacklogConsultor";

// ?? Tipos de props ?????????????????????????????????????????????????????????

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
  onOpenRequisicao?: (cliente: string, projetoId: string) => void;
  onOpenUpload?: (agendaId: string, itemCronograma?: string | null) => void;
};

type TabId = "agendas" | "documentos" | "travados" | "mencoes";

// ?? Constantes visuais (mesmo padrao navy do ConsultorDashboardV2) ??????????

const NAVY  = "#0B1628";
const LIME  = "#39FF87";
const RED   = "#E24B4A";
const AMBER = "#BA7517";
const GREEN = "#639922";

// ?? Helpers de score ???????????????????????????????????????????????????????

function corFaixa(faixa: BacklogScoreFaixa): { texto: string; fundo: string; borda: string; bolinha: string } {
  if (faixa === "critico") return { texto: "#A32D2D", fundo: "rgba(226,75,74,0.08)", borda: "rgba(226,75,74,0.25)", bolinha: RED };
  if (faixa === "atencao") return { texto: "#854F0B", fundo: "rgba(186,117,23,0.08)", borda: "rgba(186,117,23,0.25)", bolinha: AMBER };
  return { texto: "#3B6D11", fundo: "rgba(99,153,34,0.08)", borda: "rgba(99,153,34,0.25)", bolinha: GREEN };
}

function corAlerta(sev: "critico" | "alto" | "normal"): string {
  if (sev === "critico") return RED;
  if (sev === "alto")    return "#BA7517";
  return GREEN;
}

function labelAlerta(sev: "critico" | "alto" | "normal"): string {
  if (sev === "critico") return "critico";
  if (sev === "alto")    return "atencao";
  return "normal";
}

// ?? Sub-componentes ????????????????????????????????????????????????????????

function ScoreBadge({ score, faixa }: { score: number; faixa: BacklogScoreFaixa }) {
  const c = corFaixa(faixa);
  return (
    <span style={{
      background: c.fundo, color: c.texto, border: `0.5px solid ${c.borda}`,
      fontSize: 10, padding: "2px 7px", borderRadius: 4,
      fontFamily: "'DM Mono', monospace", fontWeight: 600, flexShrink: 0,
    }}>
      {score} pts
    </span>
  );
}

function GrupoHeader({ nome, sev }: { nome: string; sev: "critico" | "alto" | "normal" }) {
  const cor = corAlerta(sev);
  const label = labelAlerta(sev);
  return (
    <div style={{
      fontSize: 10, fontWeight: 500, color: "var(--color-text-secondary)",
      textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "6px 0 5px", display: "flex", alignItems: "center", gap: 6,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cor, flexShrink: 0 }} />
      {nome}
      <span style={{
        fontSize: 10, padding: "1px 5px", borderRadius: 4,
        fontFamily: "'DM Mono', monospace",
        background: corFaixa(sev === "critico" ? "critico" : sev === "alto" ? "atencao" : "ok").fundo,
        color: corFaixa(sev === "critico" ? "critico" : sev === "alto" ? "atencao" : "ok").texto,
      }}>
        {label}
      </span>
    </div>
  );
}

// ?? Aba 1: Agendas ?????????????????????????????????????????????????????????

function PaneAgendas({
  agendas,
  onOpenRequisicao,
}: {
  agendas: BacklogAgenda[];
  onOpenRequisicao?: Props["onOpenRequisicao"];
}) {
  if (agendas.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
        Nenhuma agenda futura no periodo selecionado
      </div>
    );
  }

  // Agrupar por projeto
  const grupos: Record<string, BacklogAgenda[]> = {};
  for (const ag of agendas) {
    if (!grupos[ag.projeto]) grupos[ag.projeto] = [];
    grupos[ag.projeto].push(ag);
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
      {Object.entries(grupos).map(([projeto, itens]) => {
        const sev = itens[0].alertaSeveridade;
        return (
          <div key={projeto}>
            <GrupoHeader nome={projeto} sev={sev} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 4 }}>
              {itens.map(ag => {
                const c = corFaixa(ag.faixa);
                return (
                  <div key={ag.id} style={{
                    border: `0.5px solid var(--color-border-tertiary)`,
                    borderLeft: `3px solid ${c.bolinha}`,
                    borderRadius: "0 8px 8px 0", padding: "9px 12px",
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--color-background-primary)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ag.itemCronograma || ag.atividade}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                        {format(parseISO(ag.data), "EEE dd/MM", { locale: ptBR })}
                        
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <ScoreBadge score={ag.score} faixa={ag.faixa} />
                      {onOpenRequisicao && (
                        <button
                          onClick={() => onOpenRequisicao(ag.projeto, ag.projetoId)}
                          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}>
                          Alterar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ?? Aba 2: Documentos ??????????????????????????????????????????????????????

function PaneDocumentos({
  docsPassados,
  docsPlanejados,
  onOpenUpload,
}: {
  docsPassados: BacklogDocumento[];
  docsPlanejados: BacklogDocumento[];
  onOpenUpload?: Props["onOpenUpload"];
}) {
  if (docsPassados.length === 0 && docsPlanejados.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
        Nenhum documento pendente no periodo selecionado
      </div>
    );
  }

  const renderItem = (doc: BacklogDocumento) => {
    const c = corFaixa(doc.faixa);
    const isPassado = doc.tipo === "doc_passado";
    return (
      <div key={doc.id} style={{
        border: `0.5px solid ${isPassado ? "rgba(226,75,74,0.2)" : "var(--color-border-tertiary)"}`,
        borderLeft: `3px solid ${c.bolinha}`,
        borderRadius: "0 8px 8px 0", padding: "9px 12px",
        background: isPassado ? "rgba(226,75,74,0.02)" : "var(--color-background-primary)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {doc.itemCronograma || doc.atividade}
          </div>
          <div style={{ fontSize: 11, marginTop: 2, fontFamily: "'DM Mono', monospace", color: isPassado ? "#A32D2D" : "var(--color-text-secondary)" }}>
            {doc.projeto}
            {isPassado && doc.diasEmAberto ? ` - ${doc.diasEmAberto}d em aberto` : ""}
            {!isPassado ? ` - agenda ${format(parseISO(doc.data), "dd/MM", { locale: ptBR })}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <ScoreBadge score={doc.score} faixa={doc.faixa} />
          {isPassado && onOpenUpload ? (
            <button
              onClick={() => onOpenUpload(doc.agendaId, doc.itemCronograma)}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "0.5px solid rgba(226,75,74,0.3)", background: "rgba(226,75,74,0.06)", color: "#A32D2D", cursor: "pointer", whiteSpace: "nowrap" }}>
              Upload
            </button>
          ) : (
            <button
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}>
              Ver agenda
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
      {docsPassados.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 500, color: "#A32D2D", textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 0 5px", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: RED }} />
            Pendencias passadas
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
            {docsPassados.map(renderItem)}
          </div>
        </>
      )}
      {docsPlanejados.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 500, color: "#854F0B", textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 0 5px", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#BA7517" }} />
            Documentos planejados
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {docsPlanejados.map(renderItem)}
          </div>
        </>
      )}
    </div>
  );
}

// ?? Aba 3: Travados ????????????????????????????????????????????????????????

function PaneTravados({
  travados,
  onConcluir,
  onOpenRequisicao,
}: {
  travados: BacklogTravado[];
  onConcluir: (id: string) => Promise<void>;
  onOpenRequisicao?: Props["onOpenRequisicao"];
}) {
  const [concluindo, setConcluindo] = useState<string | null>(null);

  if (travados.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
        Nenhum item travado
      </div>
    );
  }

  const handleConcluir = async (t: BacklogTravado) => {
    setConcluindo(t.cronogramaItemId);
    await onConcluir(t.cronogramaItemId);
    toast({ title: `${t.codigoItem} concluido`, description: "Feeling atualizado para 100%." });
    setConcluindo(null);
  };

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      {travados.map(t => {
        const c = corFaixa(t.faixa);
        const isConcluindo = concluindo === t.cronogramaItemId;
        return (
          <div key={t.id} style={{
            border: `0.5px solid ${c.borda}`,
            borderLeft: `3px solid ${c.bolinha}`,
            borderRadius: "0 8px 8px 0", padding: "10px 12px",
            background: "var(--color-background-primary)",
            display: "flex", alignItems: "flex-start", gap: 10,
            opacity: isConcluindo ? 0.5 : 1, transition: "opacity 0.2s",
          }}>
            {/* Corpo esquerdo */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 2 }}>
                {t.codigoItem} - {t.descricaoItem}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
                {t.projeto} - feeling {t.feelingAtual}%
              </div>
              {/* Badge "parado ha X dias" inline */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.fundo, border: `0.5px solid ${c.borda}`, borderRadius: 5, padding: "3px 8px" }}>
                <span style={{ fontSize: 10, color: c.texto, fontFamily: "'DM Mono', monospace" }}>
                  parado ha {t.paradoHaDias} dias
                </span>
              </div>
            </div>

            {/* Direita: score + botoes empilhados */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
              <ScoreBadge score={t.score} faixa={t.faixa} />
              <button
                disabled={isConcluindo}
                onClick={() => onOpenRequisicao?.(t.projeto, t.projetoId)}
                style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: `0.5px solid ${c.borda}`, background: c.fundo, color: c.texto, cursor: "pointer", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>
                Solicitar agenda
              </button>
              <button
                disabled={isConcluindo}
                onClick={() => handleConcluir(t)}
                style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "0.5px solid rgba(5,150,105,0.3)", background: "rgba(5,150,105,0.06)", color: "#0F6E56", cursor: isConcluindo ? "not-allowed" : "pointer", whiteSpace: "nowrap", width: "100%", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {isConcluindo
                  ? <Loader2 style={{ width: 10, height: 10, animation: "spin 1s linear infinite" }} />
                  : <CircleCheck style={{ width: 10, height: 10 }} />}
                Concluir item
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Aba 4: Mencoes (BL-CONS-001-F2) ------------------------------------------

function PaneMencoes({
  mencoes,
  onCiente,
  onResolver,
}: {
  mencoes: BacklogMencao[];
  onCiente: (id: string) => Promise<void>;
  onResolver: (id: string) => Promise<void>;
}) {
  const [agindo, setAgindo] = useState<string | null>(null);

  if (mencoes.length === 0) {
    return (
      <div style={{ padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <AtSign style={{ width: 28, height: 28, color: "var(--color-text-secondary)", opacity: 0.3 }} />
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontFamily: "'DM Mono', monospace", textAlign: "center", lineHeight: 1.7 }}>
          Nenhuma mencao pendente
        </div>
      </div>
    );
  }

  const handleCiente = async (m: BacklogMencao) => {
    setAgindo(m.mencaoId);
    await onCiente(m.mencaoId);
    setAgindo(null);
  };

  const handleResolver = async (m: BacklogMencao) => {
    setAgindo(m.mencaoId);
    await onResolver(m.mencaoId);
    setAgindo(null);
  };

  const grupos: Record<string, BacklogMencao[]> = {};
  for (const m of mencoes) {
    if (!grupos[m.projeto]) grupos[m.projeto] = [];
    grupos[m.projeto].push(m);
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(grupos).map(([projeto, itens]) => (
        <div key={projeto}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 0 5px", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1d4ed8" }} />
            {projeto}
          </div>
          {itens.map(m => {
            const isAgindo = agindo === m.mencaoId;
            const textoLimpo = m.textoEntrada
              .replace(/@\[([^\]]+)\]\([a-f0-9-]{36}\)/g, "@$1")
              .replace(/#\[([^\]]+)\]/g, "#$1")
              .replace(/!\[(alta|media|baixa)\]/g, "!$1");
            return (
              <div key={m.id} style={{ border: "0.5px solid rgba(37,99,235,0.2)", borderLeft: "3px solid #1d4ed8", borderRadius: "0 8px 8px 0", padding: "10px 12px", background: "rgba(37,99,235,0.02)", display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 5, opacity: isAgindo ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#1d4ed8", fontFamily: "'DM Mono', monospace", marginBottom: 3 }}>
                    {m.autorNome || "Alguem"} mencionou voce
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.5, marginBottom: 4, wordBreak: "break-word" }}>
                    {textoLimpo.slice(0, 120)}{textoLimpo.length > 120 ? "..." : ""}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-text-secondary)", fontFamily: "'DM Mono', monospace" }}>
                    {format(parseISO(m.dataEntrada), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <span style={{ background: "#EFF6FF", color: "#1d4ed8", border: "0.5px solid rgba(37,99,235,0.25)", fontSize: 10, padding: "2px 7px", borderRadius: 4, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                    {m.score} pts
                  </span>
                  {m.status === "pendente" && (
                    <button disabled={isAgindo} onClick={() => handleCiente(m)}
                      style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "0.5px solid rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.08)", color: "rgb(146,64,14)", cursor: "pointer" }}>
                      Ciente
                    </button>
                  )}
                  {(m.status === "pendente" || m.status === "ciente") && (
                    <button disabled={isAgindo} onClick={() => handleResolver(m)}
                      style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "0.5px solid rgba(5,150,105,0.3)", background: "rgba(5,150,105,0.08)", color: "rgb(6,95,70)", cursor: "pointer" }}>
                      {isAgindo ? <Loader2 style={{ width: 10, height: 10, animation: "spin 1s linear infinite" }} /> : null}
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
export function BacklogConsultorModal({ open, onClose, userId, onOpenRequisicao, onOpenUpload }: Props) {
  const [tabAtiva, setTabAtiva]       = useState<TabId>("agendas");
  const [periodo, setPeriodo]         = useState<PeriodoBacklog>("mes");
  const [ordenacao, setOrdenacao]     = useState<OrdenacaoBacklog>("urgencia");
  const [sortOpen, setSortOpen]       = useState(false);
  const [periodOpen, setPeriodOpen]   = useState(false);

  const {
    agendas, docsPassados, docsPlanejados, travados, mencoes,
    totalAgendas, totalDocumentos, totalTravados, totalMencoes,
    loading, loadBacklog, concluirItemTravado,
    marcarCienteMencao, marcarResolvidaMencao,
  } = useBacklogConsultor(userId);

  // Carregar ao abrir ou trocar filtro
  useEffect(() => {
    if (open && userId) loadBacklog(periodo, ordenacao);
  }, [open, userId, periodo, ordenacao]);

  const handleConcluir = useCallback(async (cronogramaItemId: string) => {
    await concluirItemTravado(cronogramaItemId);
  }, [concluirItemTravado]);

  const periodoLabel: Record<PeriodoBacklog, string> = {
    mes: "este mes", "30": "30 dias", "60": "60 dias", "90": "90 dias",
  };

  const ordenacaoLabel: Record<OrdenacaoBacklog, string> = {
    urgencia: "urgencia", data: "data", projeto: "projeto",
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count: number | null; fase2?: boolean }[] = [
    { id: "agendas",    label: "Agendas",    icon: <CalendarClock style={{ width: 13, height: 13 }} />, count: totalAgendas },
    { id: "documentos", label: "Documentos", icon: <FileWarning   style={{ width: 13, height: 13 }} />, count: totalDocumentos },
    { id: "travados",   label: "Travados",   icon: <AlertTriangle style={{ width: 13, height: 13 }} />, count: totalTravados },
    { id: "mencoes",    label: "Mencoes",    icon: <AtSign        style={{ width: 13, height: 13 }} />, count: totalMencoes },
  ];

  const badgeCorTab = (id: TabId, count: number | null) => {
    if (!count) return { bg: "var(--color-background-secondary)", cor: "var(--color-text-secondary)" };
    if (id === "documentos") return { bg: "#FCEBEB", cor: "#A32D2D" };
    if (id === "travados")   return { bg: "#FAEEDA", cor: "#854F0B" };
    return { bg: "#EAF3DE", cor: "#3B6D11" };
  };

  const totalItens = totalAgendas + totalDocumentos + totalTravados;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[82dvh] flex flex-col !p-0 !gap-0 overflow-hidden [&>button[aria-label=Close]]:!hidden">
        <DialogTitle className="sr-only">Meu Backlog</DialogTitle>

        {/* Header navy */}
        <div className="modal-navy-header">
          <div>
            <div className="modal-navy-title">Meu Backlog</div>
            <div className="modal-navy-meta">
              {loading ? "carregando..." : `${totalItens} ite${totalItens !== 1 ? "ns" : "m"} | ${totalItens > 0 ? "ordenado por " + ordenacaoLabel[ordenacao] : "sem pendencias"}`}
            </div>
          </div>

          {/* Controles: sort + periodo */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

            {/* Ordenacao */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => { setSortOpen(v => !v); setPeriodOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>
                <ArrowDownUp style={{ width: 11, height: 11, color: "rgba(57,255,135,0.6)" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>{ordenacaoLabel[ordenacao]}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>v</span>
              </button>
              {sortOpen && (
                <div style={{ position: "absolute", top: 34, right: 0, width: 130, background: "#0F1E35", border: "0.5px solid rgba(57,255,135,0.15)", borderRadius: 8, zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", overflow: "hidden" }}>
                  {(["urgencia", "data", "projeto"] as OrdenacaoBacklog[]).map(op => (
                    <div key={op} onClick={() => { setOrdenacao(op); setSortOpen(false); }}
                      style={{ padding: "7px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer", color: ordenacao === op ? LIME : "rgba(255,255,255,0.5)", background: ordenacao === op ? "rgba(57,255,135,0.08)" : "transparent", display: "flex", alignItems: "center", gap: 6 }}>
                      {ordenacao === op && <span style={{ fontSize: 10 }}>+</span>}
                      <span style={{ paddingLeft: ordenacao === op ? 0 : 16 }}>{op}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Periodo */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => { setPeriodOpen(v => !v); setSortOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>
                <Calendar style={{ width: 11, height: 11, color: "rgba(57,255,135,0.6)" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>{periodoLabel[periodo]}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>v</span>
              </button>
              {periodOpen && (
                <div style={{ position: "absolute", top: 34, right: 0, width: 130, background: "#0F1E35", border: "0.5px solid rgba(57,255,135,0.15)", borderRadius: 8, zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", overflow: "hidden" }}>
                  {(["mes", "30", "60", "90"] as PeriodoBacklog[]).map(op => (
                    <div key={op} onClick={() => { setPeriodo(op); setPeriodOpen(false); }}
                      style={{ padding: "7px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer", color: periodo === op ? LIME : "rgba(255,255,255,0.5)", background: periodo === op ? "rgba(57,255,135,0.08)" : "transparent", display: "flex", alignItems: "center", gap: 6 }}>
                      {periodo === op && <span style={{ fontSize: 10 }}>+</span>}
                      <span style={{ paddingLeft: periodo === op ? 0 : 16 }}>{periodoLabel[op]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", flexShrink: 0 }}>
          {tabs.map(tab => {
            const ativa = tabAtiva === tab.id;
            const bc = badgeCorTab(tab.id, tab.count);
            return (
              <button key={tab.id} onClick={() => setTabAtiva(tab.id)}
                style={{ flex: 1, padding: "10px 4px", background: ativa ? "var(--color-background-primary)" : "transparent", border: "none", borderBottom: `2.5px solid ${ativa ? LIME : "transparent"}`, fontSize: 11, fontWeight: ativa ? 500 : 400, color: ativa ? "var(--color-text-primary)" : "var(--color-text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, opacity: tab.fase2 ? 0.5 : 1, transition: "all 0.15s" }}>
                {tab.icon}
                {tab.label}
                {tab.fase2
                  ? <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontFamily: "'DM Mono', monospace" }}>F2</span>
                  : tab.count !== null && (
                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 10, background: bc.bg, color: bc.cor, fontFamily: "'DM Mono', monospace" }}>
                      {tab.count}
                    </span>
                  )
                }
              </button>
            );
          })}
        </div>

        {/* Legenda score - fixa abaixo das tabs */}
        <div style={{ padding: "6px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 8, background: "var(--color-background-secondary)", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "var(--color-text-secondary)", fontFamily: "'DM Mono', monospace" }}>score:</span>
          {([
            { label: "critico 60+", bolinha: RED,    texto: "#A32D2D" },
            { label: "atencao 30-59", bolinha: "#BA7517", texto: "#854F0B" },
            { label: "ok ate 29",   bolinha: GREEN,  texto: "#3B6D11" },
          ] as const).map((f, i) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <div style={{ width: "0.5px", height: 10, background: "var(--color-border-tertiary)" }} />}
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: f.bolinha }} />
              <span style={{ fontSize: 10, color: f.texto, fontFamily: "'DM Mono', monospace" }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Conteudo da aba - scrollavel */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48, gap: 10 }}>
              <Loader2 style={{ width: 18, height: 18, color: "var(--color-text-secondary)", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontFamily: "'DM Mono', monospace" }}>carregando backlog...</span>
            </div>
          ) : (
            <>
              {tabAtiva === "agendas"    && <PaneAgendas agendas={agendas} onOpenRequisicao={onOpenRequisicao} />}
              {tabAtiva === "documentos" && <PaneDocumentos docsPassados={docsPassados} docsPlanejados={docsPlanejados} onOpenUpload={onOpenUpload} />}
              {tabAtiva === "travados"   && <PaneTravados travados={travados} onConcluir={handleConcluir} onOpenRequisicao={onOpenRequisicao} />}
              {tabAtiva === "mencoes"    && <PaneMencoes mencoes={mencoes} onCiente={async (id) => { await marcarCienteMencao(id); }} onResolver={async (id) => { await marcarResolvidaMencao(id); }} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer-navy">
          <span className="modal-footer-hint">
            <CalendarClock style={{ width: 12, height: 12 }} />
            {totalItens} ite{totalItens !== 1 ? "ns" : "m"} | {periodoLabel[periodo]}
          </span>
          <button className="modal-btn-secondary" onClick={onClose}>Fechar</button>
        </div>

      </DialogContent>
    </Dialog>
  );
}