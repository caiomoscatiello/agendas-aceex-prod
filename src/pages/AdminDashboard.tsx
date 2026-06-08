// src/pages/AdminDashboard.tsx
// BL-ADM-001 v3 -- Flyout posicionado dinamicamente no item clicado
// Encoding: UTF-8 sem BOM

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminDashboardView   from "@/components/admin/AdminDashboardView";
import AdminCadastros       from "@/components/admin/AdminCadastros";
import AdminAgendas         from "@/components/admin/AdminAgendas";
import AdminRelatorio       from "@/components/admin/AdminRelatorio";
import AdminWorkflows       from "@/components/admin/AdminWorkflows";
import AdminStatusReport    from "@/components/admin/AdminStatusReport";
import AdminIntegrationLogs from "@/components/admin/AdminIntegrationLogs";

// ── Tokens identicos ao ConsultorDashboardV2 ──────────────────────────────────
const NAVY  = "#0B1628";
const LIME  = "#39FF87";
const BG    = "#EDF0F5";
const AMBER = "#F5A623";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Secao = "dashboard" | "cadastros" | "agendas" | "relatorio" | "workflows" | "statusreport" | "logs";

type FlyoutPos = { top: number; left: number };

// ── SVG icons (13x13, mesma convencao do ConsultorDashboardV2) ────────────────
const IcoDash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IcoCad = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const IcoAg = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoRel = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IcoWf = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const IcoSR = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IcoLog = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);
const IcoSettings = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IcoLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IcoChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ── Logo Chevron (identico ao ConsultorDashboardV2) ───────────────────────────
const LogoChevron = () => (
  <svg width="42" height="42" viewBox="0 0 88 88" fill="none" style={{ flexShrink: 0 }}>
    <path d="M10 16 L26 44 L10 72" stroke="rgba(255,255,255,0.18)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28 16 L44 44 L28 72" stroke="rgba(255,255,255,0.55)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M46 16 L62 44 L46 72" stroke="#39FF87" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="62" cy="44" r="6" fill="rgba(57,255,135,0.15)"/>
    <circle cx="62" cy="44" r="4" fill="#39FF87">
      <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite"/>
    </circle>
  </svg>
);

// ── Helpers de role ───────────────────────────────────────────────────────────
function roleLabel(role: string | null | undefined): string {
  if (role === "admin")        return "Admin";
  if (role === "coordenador")  return "Coordenador";
  if (role === "diretoria")    return "Diretoria";
  if (role === "consultor")    return "Consultor";
  return "Usuario";
}
function roleSubLabel(role: string | null | undefined): string {
  if (role === "coordenador")  return "Gestao de projetos e equipe";
  if (role === "admin")        return "Acesso total ao sistema";
  if (role === "diretoria")    return "Visao executiva";
  return "";
}

// ── Nav items ─────────────────────────────────────────────────────────────────
type NavItem = {
  id: Secao;
  label: string;
  icon: React.ReactNode;
  flyout?: { value: string; label: string }[];
};

const NAV_GESTAO: NavItem[] = [
  { id: "dashboard",    label: "Dashboard",     icon: <IcoDash /> },
  { id: "statusreport", label: "Status Report", icon: <IcoSR   /> },
  { id: "relatorio",    label: "Relatorio",     icon: <IcoRel  /> },
];

const NAV_OPERACAO: NavItem[] = [
  {
    id: "cadastros", label: "Cadastros", icon: <IcoCad />,
    flyout: [
      { value: "projetos",   label: "Projetos"   },
      { value: "usuarios",   label: "Usuarios"   },
      { value: "documentos", label: "Documentos" },
    ],
  },
  {
    id: "agendas", label: "Agendas", icon: <IcoAg />,
    flyout: [
      { value: "solicitacoes",  label: "Solicitacoes"  },
      { value: "pendentes",     label: "Pendentes"     },
      { value: "aprovar",       label: "Aprovar OS"    },
      { value: "carregar",      label: "Incluir"       },
      { value: "manutencao",    label: "Manutencao"    },
      { value: "cancelamentos", label: "Cancelamentos" },
    ],
  },
  { id: "workflows", label: "Workflows", icon: <IcoWf /> },
];

const NAV_SISTEMA: NavItem[] = [
  { id: "logs", label: "Logs de Integracao", icon: <IcoLog /> },
];

const ALL_NAV = [...NAV_GESTAO, ...NAV_OPERACAO, ...NAV_SISTEMA];

// ── Componente principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, signOut, role } = useAuth();
  const navigate = useNavigate();

  const SIDEBAR_W = 232;
  const TOPBAR_H  = 58;

  const [secaoAtiva, setSecaoAtiva]     = useState<Secao>("dashboard");
  const [subAtivo, setSubAtivo]         = useState<string>("");
  const [flyoutAberto, setFlyoutAberto] = useState<Secao | null>(null);
  // Posicao dinamica do flyout — calculada no click do item
  const [flyoutPos, setFlyoutPos]       = useState<FlyoutPos>({ top: 0, left: 0 });

  const flyoutRef  = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "CM";
  const userName     = user?.email?.split("@")[0] || "Coordenador";

  // Fechar flyout ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        flyoutRef.current  && !flyoutRef.current.contains(e.target as Node) &&
        sidebarRef.current && !sidebarRef.current.contains(e.target as Node)
      ) {
        setFlyoutAberto(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Click no item de nav
  const handleNavClick = useCallback((item: NavItem, e: React.MouseEvent<HTMLDivElement>) => {
    if (item.flyout) {
      if (flyoutAberto === item.id) {
        // Fechar se ja estava aberto
        setFlyoutAberto(null);
        return;
      }
      // Calcular posicao baseada no elemento clicado
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // Alinhar topo do flyout com o topo do item clicado
      // Garantir que nao ultrapasse o viewport verticalmente
      const flyoutHeight = (item.flyout.length * 38) + 40; // estimativa
      const maxTop = window.innerHeight - flyoutHeight - 8;
      const idealTop = rect.top;
      setFlyoutPos({
        top: Math.min(idealTop, maxTop),
        left: SIDEBAR_W + 6,
      });
      setFlyoutAberto(item.id);
    } else {
      setFlyoutAberto(null);
      setSecaoAtiva(item.id);
      setSubAtivo("");
    }
  }, [flyoutAberto]);

  function handleFlyoutItem(secId: Secao, value: string) {
    setSecaoAtiva(secId);
    setSubAtivo(value);
    setFlyoutAberto(null);
  }

  function isItemAtivo(item: NavItem): boolean {
    return secaoAtiva === item.id || flyoutAberto === item.id;
  }

  function breadcrumb(): string {
    const base = `/ admin / ${secaoAtiva}`;
    if (subAtivo) return `${base} / ${subAtivo}`;
    return base;
  }

  function renderConteudo() {
    switch (secaoAtiva) {
      case "dashboard":    return <AdminDashboardView />;
      case "cadastros":    return <AdminCadastros subAtivo={subAtivo} />;
      case "agendas":      return <AdminAgendas   subAtivo={subAtivo} />;
      case "relatorio":    return <AdminRelatorio />;
      case "workflows":    return <AdminWorkflows />;
      case "statusreport": return <AdminStatusReport />;
      case "logs":         return <AdminIntegrationLogs />;
      default:             return <AdminDashboardView />;
    }
  }

  // Item de nav
  function NavItemEl({ item }: { item: NavItem }) {
    const isAtivo   = isItemAtivo(item);
    const hasFlyout = !!item.flyout;
    return (
      <div
        onClick={e => handleNavClick(item, e)}
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "6px 10px", borderRadius: 7, cursor: "pointer",
          color: isAtivo ? LIME : "rgba(255,255,255,0.4)",
          fontSize: 11, fontWeight: isAtivo ? 600 : 500,
          background: isAtivo ? "rgba(57,255,135,0.09)" : "transparent",
          position: "relative", transition: "all 0.15s",
          userSelect: "none",
        }}
        onMouseEnter={e => { if (!isAtivo) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { if (!isAtivo) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isAtivo ? 1 : 0.65 }}>
          {item.icon}
        </div>
        <span style={{ flex: 1 }}>{item.label}</span>
        {hasFlyout && (
          <div style={{ opacity: 0.35, transform: flyoutAberto === item.id ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <IcoChevronRight />
          </div>
        )}
        {isAtivo && (
          <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 2.5, background: LIME, borderRadius: "0 2px 2px 0" }} />
        )}
      </div>
    );
  }

  function SidebarSectionLabel({ label }: { label: string }) {
    return (
      <div style={{
        fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.22em",
        color: "rgba(255,255,255,0.17)", textTransform: "uppercase",
        padding: "10px 10px 3px",
      }}>
        {label}
      </div>
    );
  }

  // Dados do flyout aberto
  const flyoutSec = flyoutAberto ? ALL_NAV.find(s => s.id === flyoutAberto) : null;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── TOPBAR ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: TOPBAR_H,
        background: NAVY, zIndex: 300,
        display: "flex", alignItems: "center",
        borderBottom: "0.5px solid rgba(57,255,135,0.08)",
      }}>
        {/* Logo zone */}
        <div style={{
          width: SIDEBAR_W, height: "100%", flexShrink: 0,
          display: "flex", alignItems: "center", padding: "0 18px", gap: 12,
          borderRight: "0.5px solid rgba(57,255,135,0.07)",
        }}>
          <LogoChevron />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>
              projt<span style={{ color: LIME }}>e</span>
            </div>
            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.35)", letterSpacing: "0.1em", marginTop: 3 }}>
              admin panel
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 20px" }}>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
            {breadcrumb()}
          </span>
        </div>

        {/* Acoes direita */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 18 }}>
          {/* Badge role */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(57,255,135,0.08)", border: "0.5px solid rgba(57,255,135,0.18)",
            borderRadius: 100, padding: "4px 14px",
            fontSize: 9, fontFamily: "'DM Mono', monospace", color: LIME, letterSpacing: "0.08em",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: LIME }} />
            {roleLabel(role).toUpperCase()}
          </div>

          {/* Settings — apenas admin */}
          {role === "admin" && (
            <button onClick={() => navigate("/settings/email")} title="Settings" style={{
              width: 32, height: 32, borderRadius: 7,
              background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.35)", cursor: "pointer",
            }}>
              <IcoSettings />
            </button>
          )}

          {/* Sair */}
          <button onClick={signOut} title="Sair" style={{
            width: 32, height: 32, borderRadius: 7,
            background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.35)", cursor: "pointer",
          }}>
            <IcoLogout />
          </button>

          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(57,255,135,0.1)", border: "1.5px solid rgba(57,255,135,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: LIME, cursor: "pointer", flexShrink: 0,
          }}>
            {userInitials}
          </div>
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <aside ref={sidebarRef} style={{
        position: "fixed", top: TOPBAR_H, bottom: 0, left: 0,
        width: SIDEBAR_W, background: NAVY,
        borderRight: "0.5px solid rgba(57,255,135,0.06)",
        zIndex: 200, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Card coordenador */}
        <div style={{
          margin: "12px 12px 4px",
          background: "rgba(57,255,135,0.06)", border: "0.5px solid rgba(57,255,135,0.14)",
          borderRadius: 9, padding: 12, flexShrink: 0,
        }}>
          <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: "0.14em", color: "rgba(57,255,135,0.45)", textTransform: "uppercase", marginBottom: 6 }}>
            Painel de gestao
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 2 }}>
            {roleLabel(role)}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
            {roleSubLabel(role)}
          </div>
          <div style={{ marginTop: 8, height: 0.5, background: "rgba(57,255,135,0.12)" }} />
          <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "rgba(57,255,135,0.1)", border: "1.5px solid rgba(57,255,135,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: LIME, flexShrink: 0,
            }}>
              {userInitials}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{userName}</div>
              <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.4)", letterSpacing: "0.06em" }}>{roleLabel(role).toLowerCase()}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "4px 10px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SidebarSectionLabel label="Gestao" />
          {NAV_GESTAO.map(item => <NavItemEl key={item.id} item={item} />)}

          <div style={{ marginTop: 4 }}>
            <SidebarSectionLabel label="Operacao" />
            {NAV_OPERACAO.map(item => <NavItemEl key={item.id} item={item} />)}
          </div>

          <div style={{ marginTop: 4 }}>
            <SidebarSectionLabel label="Sistema" />
            {NAV_SISTEMA.map(item => <NavItemEl key={item.id} item={item} />)}
          </div>
        </nav>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: "0.5px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 4px", borderRadius: 7 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(57,255,135,0.1)", border: "1.5px solid rgba(57,255,135,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: LIME, flexShrink: 0,
            }}>
              {userInitials}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{userName}</div>
              <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", color: "rgba(57,255,135,0.4)", letterSpacing: "0.06em" }}>{roleLabel(role).toLowerCase()}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── FLYOUT — posicionado dinamicamente no item clicado ── */}
      {flyoutSec && flyoutSec.flyout && (
        <div
          ref={flyoutRef}
          style={{
            position: "fixed",
            top: flyoutPos.top,
            left: flyoutPos.left,
            background: "#0F1E35",
            border: "0.5px solid rgba(57,255,135,0.15)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 250,
            minWidth: 190,
            paddingTop: 4,
            paddingBottom: 6,
          }}
        >
          {/* Label do flyout */}
          <div style={{
            padding: "7px 14px 5px",
            fontSize: 8, fontFamily: "'DM Mono', monospace",
            color: "rgba(57,255,135,0.4)", letterSpacing: "0.12em", textTransform: "uppercase",
            borderBottom: "0.5px solid rgba(255,255,255,0.06)", marginBottom: 4,
          }}>
            {flyoutSec.label}
          </div>
          {flyoutSec.flyout.map(item => {
            const isSubAtivo = secaoAtiva === flyoutAberto && subAtivo === item.value;
            return (
              <button
                key={item.value}
                onClick={() => handleFlyoutItem(flyoutAberto!, item.value)}
                style={{
                  display: "flex", alignItems: "center", width: "100%",
                  padding: "8px 14px", border: "none", cursor: "pointer",
                  background: isSubAtivo ? "rgba(57,255,135,0.08)" : "transparent",
                  color: isSubAtivo ? LIME : "rgba(255,255,255,0.55)",
                  fontSize: 12, fontWeight: isSubAtivo ? 600 : 400,
                  textAlign: "left",
                  borderLeft: isSubAtivo ? `2px solid ${LIME}` : "2px solid transparent",
                  transition: "background 0.1s",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={e => { if (!isSubAtivo) (e.currentTarget as HTMLElement).style.background = "rgba(57,255,135,0.05)"; }}
                onMouseLeave={e => { if (!isSubAtivo) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── CONTEUDO ── */}
      <main style={{ marginLeft: SIDEBAR_W, paddingTop: TOPBAR_H, minHeight: "100vh" }}>
        <div style={{ padding: "20px 24px", minHeight: `calc(100vh - ${TOPBAR_H}px)` }}>
          {renderConteudo()}
        </div>
      </main>

    </div>
  );
}
