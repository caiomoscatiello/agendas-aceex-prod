import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

/* ============================================================
 * ACEEX V2 - LoginPage
 * Predictive Operations Core - Login com hero 3D-style
 * ============================================================
 * Versao: V1 funcional (SVG animado, sem WebGL ainda)
 * Stack: React + framer-motion + Tailwind
 * Encoding: UTF-8 sem BOM
 * ============================================================ */

// ----- CONTADOR ANIMADO -----
function CountUp({
  to,
  duration = 800,
  decimals = 0,
  suffix = "",
  delay = 0,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  delay?: number;
}) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(to);
      return;
    }
    const start = performance.now() + delay;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - start);
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * to);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay, reduceMotion]);

  return (
    <span>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ----- CAPSULA DE MODULO (com LED verde pulsante) -----
function ModuleCapsule({
  x,
  y,
  label,
  accent,
  delay,
}: {
  x: number;
  y: number;
  label: string;
  accent: "purple" | "cyan";
  delay: number;
}) {
  const stroke = accent === "purple" ? "rgba(168, 85, 247, 0.55)" : "rgba(6, 182, 212, 0.55)";
  const glow = accent === "purple" ? "url(#mgPurple)" : "url(#mgCyan)";

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: "easeOut" }}
    >
      {/* Halo glow */}
      <circle cx={x} cy={y} r={42} fill={glow} />

      {/* Capsule body */}
      <rect
        x={x - 40}
        y={y - 17}
        width={80}
        height={34}
        rx={17}
        fill="rgba(15, 23, 42, 0.7)"
        stroke={stroke}
        strokeWidth={1}
        filter="url(#g5)"
      />
      <rect
        x={x - 40}
        y={y - 17}
        width={80}
        height={34}
        rx={17}
        fill="none"
        stroke="url(#eg5)"
        strokeWidth={0.5}
        opacity={0.4}
      />

      {/* LED verde pulsante */}
      <circle cx={x - 28} cy={y} r={3.5} fill="url(#ledGreen)" filter="url(#ledGlow)">
        <animate attributeName="r" values="3.5;4.5;3.5" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.7;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={x - 28} cy={y} r={1.8} fill="#86EFAC" />

      {/* Label */}
      <text
        x={x + 5}
        y={y + 5}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={label.length > 4 ? 11 : 12}
        fontFamily="Inter, sans-serif"
        fontWeight={500}
        letterSpacing={label.length > 4 ? "0.05em" : "0.08em"}
      >
        {label}
      </text>
    </motion.g>
  );
}

// ----- ENERGY STREAM (linha curva com particulas) -----
function EnergyStream({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.85 }}
      transition={{ delay: delay / 1000, duration: 0.6 }}
    >
      <path d={d} stroke="url(#sg5)" strokeWidth={1.8} fill="none" filter="url(#g5)" />
      <path d={d} stroke="#FFFFFF" strokeWidth={0.5} fill="none" opacity={0.6} />
    </motion.g>
  );
}

// ----- ICOSAEDRO ANIMADO (SVG com rotacao CSS) -----
function Icosahedron() {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.9, ease: "easeOut" }}
      style={{ transformOrigin: "420px 310px" }}
    >
      {/* Octaedro interno (rotacao inversa) */}
      <g transform="translate(420 310)" filter="url(#g5)" opacity={0.45}>
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        >
          <line x1={0} y1={-55} x2={52} y2={17} stroke="#06B6D4" strokeWidth={0.6} />
          <line x1={52} y1={17} x2={32} y2={52} stroke="#06B6D4" strokeWidth={0.6} />
          <line x1={32} y1={52} x2={-32} y2={52} stroke="#06B6D4" strokeWidth={0.6} />
          <line x1={-32} y1={52} x2={-52} y2={17} stroke="#06B6D4" strokeWidth={0.6} />
          <line x1={-52} y1={17} x2={0} y2={-55} stroke="#06B6D4" strokeWidth={0.6} />
          <line x1={0} y1={-55} x2={32} y2={52} stroke="#06B6D4" strokeWidth={0.35} />
          <line x1={0} y1={-55} x2={-32} y2={52} stroke="#06B6D4" strokeWidth={0.35} />
        </motion.g>
      </g>

      {/* Icosaedro principal */}
      <g transform="translate(420 310)" filter="url(#g5)" opacity={0.85}>
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        >
          <line x1={0} y1={-120} x2={104} y2={60} stroke="url(#eg5)" strokeWidth={1.3} />
          <line x1={0} y1={-120} x2={-104} y2={60} stroke="url(#eg5)" strokeWidth={1.3} />
          <line x1={104} y1={60} x2={-104} y2={60} stroke="url(#eg5)" strokeWidth={1.3} />
          <line x1={0} y1={-120} x2={0} y2={120} stroke="url(#eg5)" strokeWidth={0.9} />
          <line x1={104} y1={60} x2={0} y2={120} stroke="url(#eg5)" strokeWidth={0.9} />
          <line x1={-104} y1={60} x2={0} y2={120} stroke="url(#eg5)" strokeWidth={0.9} />
          <line x1={0} y1={-120} x2={72} y2={-37} stroke="url(#eg5)" strokeWidth={0.7} opacity={0.75} />
          <line x1={0} y1={-120} x2={-72} y2={-37} stroke="url(#eg5)" strokeWidth={0.7} opacity={0.75} />
          <line x1={72} y1={-37} x2={104} y2={60} stroke="url(#eg5)" strokeWidth={0.7} opacity={0.75} />
          <line x1={-72} y1={-37} x2={-104} y2={60} stroke="url(#eg5)" strokeWidth={0.7} opacity={0.75} />
          <line x1={72} y1={-37} x2={-72} y2={-37} stroke="url(#eg5)" strokeWidth={0.7} opacity={0.75} />
          <line x1={72} y1={-37} x2={0} y2={120} stroke="url(#eg5)" strokeWidth={0.4} opacity={0.5} />
          <line x1={-72} y1={-37} x2={0} y2={120} stroke="url(#eg5)" strokeWidth={0.4} opacity={0.5} />
          <circle cx={0} cy={-120} r={4} fill="#FFFFFF" filter="url(#sg5f)" />
          <circle cx={104} cy={60} r={4} fill="#FFFFFF" filter="url(#sg5f)" />
          <circle cx={-104} cy={60} r={4} fill="#FFFFFF" filter="url(#sg5f)" />
          <circle cx={0} cy={120} r={4} fill="#FFFFFF" filter="url(#sg5f)" />
          <circle cx={72} cy={-37} r={3} fill="#06B6D4" filter="url(#g5)" />
          <circle cx={-72} cy={-37} r={3} fill="#06B6D4" filter="url(#g5)" />
        </motion.g>
      </g>

      {/* Nucleo luminoso central pulsante */}
      <motion.g
        animate={{ scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "420px 310px" }}
      >
        <circle cx={420} cy={310} r={45} fill="url(#ic5)" filter="url(#ug5)" opacity={0.85} />
        <circle cx={420} cy={310} r={18} fill="#FFFFFF" opacity={0.95} filter="url(#sg5f)" />
        <circle cx={420} cy={310} r={8} fill="#FFFFFF" />
      </motion.g>
    </motion.g>
  );
}

// ----- LOGIN PAGE PRINCIPAL -----
export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  // Definicao dos modulos orbitais (posicoes fixas no viewBox 760x620)
  const modules = [
    { x: 155, y: 260, label: "ERP", accent: "cyan" as const, delay: 1400 },
    { x: 155, y: 335, label: "CRM", accent: "purple" as const, delay: 1480 },
    { x: 180, y: 430, label: "FIN", accent: "purple" as const, delay: 1560 },
    { x: 685, y: 225, label: "KANBAN", accent: "purple" as const, delay: 1640 },
    { x: 700, y: 310, label: "BI", accent: "cyan" as const, delay: 1720 },
    { x: 685, y: 420, label: "PMO", accent: "cyan" as const, delay: 1800 },
  ];

  // Tentaculos energeticos (caminhos Bezier do nucleo ate cada modulo)
  const streams = [
    "M 420 230 Q 350 240 270 250 Q 200 258 175 260",
    "M 415 295 Q 340 305 260 320 Q 200 330 175 335",
    "M 420 350 Q 360 370 300 395 Q 240 415 200 430",
    "M 470 250 Q 540 240 600 230 Q 640 225 665 225",
    "M 475 310 Q 545 310 615 310 Q 655 310 680 310",
    "M 470 370 Q 540 390 600 405 Q 640 415 665 420",
  ];

  return (
    /* CONTAINER RAIZ: fixed inset-0 para anular o #root { max-width: 1280px } do App.css */
    <div className="fixed inset-0 bg-[#0B0E14] text-white overflow-hidden font-sans">

      {/* DESKTOP: grid 33% / 67% */}
      <div className="hidden md:grid md:grid-cols-[33%_67%] h-full">

        {/* ============================== */}
        {/* PAINEL ESQUERDO - LOGIN        */}
        {/* ============================== */}
        <aside className="bg-[#0B0E14] border-r border-white/5 flex flex-col px-9 py-10 relative z-10 min-w-0">

          {/* Logo gradient unificado */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span
              className="text-[22px] font-medium tracking-wide"
              style={{
                background: "linear-gradient(135deg, #FFFFFF 0%, #C084FC 60%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              aceex v2
            </span>
          </motion.div>

          {/* Titulo + Tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h1 className="text-4xl font-medium tracking-tighter leading-none mb-3">ACEEX V2</h1>
            <p className="text-slate-400 text-[12px] leading-relaxed mb-1">
              Integrated multi-channel project management platform.
            </p>
            <p className="text-slate-500 text-[11px] leading-relaxed mb-9">
              AI-powered delivery, predictive control.
            </p>
          </motion.div>

          {/* Card de login */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-[#161B22]/50 border border-white/[0.06] rounded-2xl p-7"
          >
            <div className="mb-5">
              <Label htmlFor="email" className="text-[10px] text-slate-400 uppercase tracking-[0.15em] mb-2 block">
                User
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@aceex.com"
                className="bg-[#0B0E14]/60 border-white/10 h-12 text-sm focus-visible:ring-violet-500 focus-visible:border-violet-500/50"
                autoComplete="email"
              />
            </div>

            <div className="mb-6">
              <Label htmlFor="password" className="text-[10px] text-slate-400 uppercase tracking-[0.15em] mb-2 block">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#0B0E14]/60 border-white/10 h-12 text-sm focus-visible:ring-violet-500 focus-visible:border-violet-500/50"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-md p-2 mb-4">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium tracking-[0.25em] text-xs shadow-[0_0_28px_rgba(124,58,237,0.35)] uppercase"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start"}
            </Button>

            <div className="text-center mt-4">
              <Link
                to="/reset-password"
                className="text-cyan-400 text-[11px] hover:text-cyan-300 transition-colors"
              >
                Recover access
              </Link>
            </div>
          </motion.form>

          {/* Rodape */}
          <div className="mt-auto pt-6 text-center">
            <span className="text-slate-600 text-[9px] tracking-[0.25em] leading-relaxed">
              PREDICTIVE TECHNOLOGY
              <br />
              INTEGRATED GOVERNANCE
            </span>
          </div>
        </aside>

        {/* ============================== */}
        {/* PAINEL DIREITO - HERO 3D       */}
        {/* ============================== */}
        <section
          className="relative overflow-hidden min-w-0"
          style={{
            background:
              "radial-gradient(ellipse at 55% 50%, #2D1B4E 0%, #1A0B2E 35%, #0B0E14 70%, #050608 100%)",
          }}
        >
          {/* Hero superior esquerdo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="absolute top-9 left-11 z-[5]"
          >
            <div className="text-white text-[17px] font-medium tracking-tight">
              Predictive Operations Core
            </div>
            <div className="text-slate-400 text-[11px] mt-1 tracking-wide">
              Integrated multi-channel project intelligence
            </div>
          </motion.div>

          {/* Bloco de metricas (agrupado, com borda esquerda) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="absolute top-[100px] left-11 z-[5] bg-slate-900/30 border-l-2 border-violet-500/40 px-4 py-3 rounded-r-lg backdrop-blur-sm"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-4">
                <span className="text-slate-500 text-[9px] tracking-[0.2em] min-w-[130px]">DELIVERY ON-TIME</span>
                <span
                  className="text-cyan-400 text-[15px] font-medium tracking-tight"
                  style={{ textShadow: "0 0 12px rgba(6, 182, 212, 0.5)" }}
                >
                  <CountUp to={94.2} decimals={1} suffix="%" delay={250} />
                </span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-slate-500 text-[9px] tracking-[0.2em] min-w-[130px]">PREDICTIVE ACCURACY</span>
                <span
                  className="text-violet-400 text-[15px] font-medium tracking-tight"
                  style={{ textShadow: "0 0 12px rgba(168, 85, 247, 0.5)" }}
                >
                  <CountUp to={98.7} decimals={1} suffix="%" delay={330} />
                </span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-slate-500 text-[9px] tracking-[0.2em] min-w-[130px]">ACTIVE INTEGRATIONS</span>
                <span
                  className="text-cyan-400 text-[15px] font-medium tracking-tight"
                  style={{ textShadow: "0 0 12px rgba(6, 182, 212, 0.5)" }}
                >
                  <CountUp to={12} decimals={0} suffix=" / 12" delay={410} />
                </span>
              </div>
            </div>
          </motion.div>

          {/* SVG do organismo - preserveAspectRatio meet garante que cabe sempre */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 760 620"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0"
          >
            <defs>
              <radialGradient id="cg5" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                <stop offset="15%" stopColor="#E0D5FF" stopOpacity="0.55" />
                <stop offset="40%" stopColor="#A855F7" stopOpacity="0.35" />
                <stop offset="75%" stopColor="#7C3AED" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ic5" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="25%" stopColor="#E0D5FF" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#C084FC" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="eg5" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E0D5FF" />
                <stop offset="40%" stopColor="#A855F7" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
              <radialGradient id="sg5" cx="0%" cy="50%" r="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="15%" stopColor="#E0D5FF" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#A855F7" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.4" />
              </radialGradient>
              <radialGradient id="mgPurple" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="mgCyan" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ledGreen" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#86EFAC" stopOpacity="1" />
                <stop offset="50%" stopColor="#22C55E" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
              </radialGradient>
              <filter id="g5">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="sg5f">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="ug5">
                <feGaussianBlur stdDeviation="10" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="ledGlow">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Particle field de fundo */}
            <g opacity={0.7}>
              <circle cx={60} cy={50} r={0.8} fill="white" />
              <circle cx={700} cy={80} r={1} fill="white" />
              <circle cx={160} cy={160} r={0.5} fill="#A855F7" />
              <circle cx={680} cy={260} r={0.7} fill="white" />
              <circle cx={50} cy={380} r={0.6} fill="#06B6D4" />
              <circle cx={720} cy={440} r={0.9} fill="white" />
              <circle cx={280} cy={40} r={0.5} fill="white" />
              <circle cx={500} cy={560} r={0.7} fill="#A855F7" />
              <circle cx={40} cy={260} r={0.6} fill="white" />
              <circle cx={730} cy={180} r={0.5} fill="white" />
              <circle cx={120} cy={520} r={0.7} fill="#06B6D4" />
              <circle cx={650} cy={60} r={0.5} fill="white" />
              <circle cx={340} cy={60} r={0.4} fill="white" />
              <circle cx={400} cy={580} r={0.6} fill="white" />
              <circle cx={30} cy={110} r={0.5} fill="#A855F7" />
              <circle cx={690} cy={560} r={0.7} fill="white" />
              <circle cx={180} cy={460} r={0.5} fill="white" />
              <circle cx={560} cy={160} r={0.6} fill="#06B6D4" />
              <circle cx={240} cy={560} r={0.5} fill="white" />
              <circle cx={520} cy={340} r={0.4} fill="white" />
            </g>

            {/* Aureola e orbitas */}
            <circle cx={420} cy={310} r={300} fill="url(#cg5)" opacity={0.9} />
            <circle
              cx={420}
              cy={310}
              r={270}
              fill="none"
              stroke="rgba(168, 85, 247, 0.10)"
              strokeWidth={0.5}
              strokeDasharray="3 6"
            />
            <circle
              cx={420}
              cy={310}
              r={220}
              fill="none"
              stroke="rgba(6, 182, 212, 0.08)"
              strokeWidth={0.5}
              strokeDasharray="2 4"
            />
            <circle
              cx={420}
              cy={310}
              r={170}
              fill="none"
              stroke="rgba(168, 85, 247, 0.06)"
              strokeWidth={0.5}
            />

            {/* Energy streams - aparecem em sequencia */}
            {streams.map((d, i) => (
              <EnergyStream key={i} d={d} delay={1200 + i * 60} />
            ))}

            {/* Icosaedro + Nucleo (animado e rotacionado) */}
            <Icosahedron />

            {/* Capsulas de modulos */}
            {modules.map((m, i) => (
              <ModuleCapsule key={i} {...m} />
            ))}
          </svg>

          {/* Frase aspiracional inferior direita */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="absolute bottom-10 right-12 text-right z-[5] max-w-[480px]"
          >
            <div className="text-white text-[38px] font-light leading-[1.05] tracking-tight">
              Controle{" "}
              <span
                className="font-medium text-violet-400"
                style={{ textShadow: "0 0 24px rgba(168, 85, 247, 0.5)" }}
              >
                Absoluto.
              </span>
            </div>
            <div className="text-white text-[38px] font-light leading-[1.05] tracking-tight">
              Resultados{" "}
              <span
                className="font-medium text-cyan-400 italic"
                style={{ textShadow: "0 0 24px rgba(6, 182, 212, 0.5)" }}
              >
                Preditivos.
              </span>
            </div>
            <div className="text-slate-500 text-[10px] tracking-[0.3em] mt-3.5">
              REAL-TIME PERFORMANCE MONITORING
            </div>
          </motion.div>
        </section>
      </div>

      {/* ====================================== */}
      {/* MOBILE: lado direito como header       */}
      {/* ====================================== */}
      <div className="md:hidden flex flex-col h-full overflow-y-auto">

        {/* Hero compacto no topo */}
        <div
          className="relative h-[260px] overflow-hidden flex-shrink-0"
          style={{
            background:
              "radial-gradient(ellipse at center, #2D1B4E 0%, #1A0B2E 40%, #0B0E14 80%)",
          }}
        >
          <div className="absolute top-3.5 left-4 right-4 flex justify-between items-center z-10">
            <span
              className="text-[14px] font-medium tracking-wide"
              style={{
                background: "linear-gradient(135deg, #FFFFFF 0%, #C084FC 60%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              aceex v2
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-violet-400 text-[10px] font-medium">98.7%</span>
              <span className="text-slate-500 text-[7px] tracking-[0.15em]">PREDICTIVE AI</span>
            </div>
          </div>

          <svg
            width="100%"
            height="100%"
            viewBox="0 0 340 260"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0"
          >
            <use href="#g5" />
            <defs>
              <radialGradient id="cgM" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="egM" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A855F7" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
              <radialGradient id="ledGreenM" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#86EFAC" stopOpacity="1" />
                <stop offset="50%" stopColor="#22C55E" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
              </radialGradient>
              <filter id="gM">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx={170} cy={135} r={100} fill="url(#cgM)" />
            <circle
              cx={170}
              cy={135}
              r={110}
              fill="none"
              stroke="rgba(168, 85, 247, 0.15)"
              strokeWidth={0.5}
              strokeDasharray="3 5"
            />

            {/* Icosaedro mobile (compacto) */}
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "170px 135px" }}
            >
              <g transform="translate(170 135)" filter="url(#gM)" opacity={0.85}>
                <line x1={0} y1={-55} x2={48} y2={28} stroke="url(#egM)" strokeWidth={0.9} />
                <line x1={0} y1={-55} x2={-48} y2={28} stroke="url(#egM)" strokeWidth={0.9} />
                <line x1={48} y1={28} x2={-48} y2={28} stroke="url(#egM)" strokeWidth={0.9} />
                <line x1={0} y1={-55} x2={0} y2={55} stroke="url(#egM)" strokeWidth={0.5} />
                <line x1={48} y1={28} x2={0} y2={55} stroke="url(#egM)" strokeWidth={0.5} />
                <line x1={-48} y1={28} x2={0} y2={55} stroke="url(#egM)" strokeWidth={0.5} />
                <circle cx={0} cy={-55} r={2.5} fill="#FFFFFF" />
                <circle cx={48} cy={28} r={2.5} fill="#A855F7" />
                <circle cx={-48} cy={28} r={2.5} fill="#A855F7" />
                <circle cx={0} cy={55} r={2.5} fill="#06B6D4" />
              </g>
            </motion.g>

            {/* Nucleo central mobile */}
            <motion.circle
              cx={170}
              cy={135}
              r={12}
              fill="#FFFFFF"
              filter="url(#gM)"
              animate={{ scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "170px 135px" }}
            />

            {/* 4 modulos compactos */}
            {[
              { x: 55, y: 95, label: "ERP", c: "#06B6D4" },
              { x: 285, y: 95, label: "KAN", c: "#A855F7" },
              { x: 55, y: 180, label: "CRM", c: "#A855F7" },
              { x: 285, y: 180, label: "BI", c: "#06B6D4" },
            ].map((m, i) => (
              <g key={i}>
                <circle cx={m.x} cy={m.y} r={14} fill="rgba(15, 23, 42, 0.7)" stroke={m.c} strokeWidth={0.8} />
                <circle cx={m.x - 9} cy={m.y} r={2} fill="url(#ledGreenM)">
                  <animate attributeName="opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <text x={m.x + 2} y={m.y + 3} textAnchor="middle" fill="#FFFFFF" fontSize={7} fontWeight={500}>
                  {m.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Conteudo abaixo */}
        <div className="flex-1 px-7 py-6 flex flex-col">
          <h1 className="text-2xl font-medium tracking-tighter leading-none mb-1">ACEEX V2</h1>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-0.5">
            Integrated multi-channel project management.
          </p>
          <p className="text-slate-500 text-[10px] leading-relaxed mb-5">
            AI-powered delivery, predictive control.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email-mob" className="text-[10px] text-slate-400 uppercase tracking-[0.15em] mb-1.5 block">
                User
              </Label>
              <Input
                id="email-mob"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@aceex.com"
                className="bg-[#161B22]/60 border-white/10 h-11 text-sm focus-visible:ring-violet-500"
                autoComplete="email"
              />
            </div>

            <div>
              <Label htmlFor="password-mob" className="text-[10px] text-slate-400 uppercase tracking-[0.15em] mb-1.5 block">
                Password
              </Label>
              <Input
                id="password-mob"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#161B22]/60 border-white/10 h-11 text-sm focus-visible:ring-violet-500"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-md p-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium tracking-[0.2em] text-xs uppercase"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start"}
            </Button>

            <div className="text-center">
              <Link to="/reset-password" className="text-cyan-400 text-[11px]">
                Recover access
              </Link>
            </div>
          </form>

          <div className="mt-auto pt-4 text-center">
            <span className="text-slate-600 text-[8px] tracking-[0.25em]">
              PREDICTIVE TECHNOLOGY · INTEGRATED GOVERNANCE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
