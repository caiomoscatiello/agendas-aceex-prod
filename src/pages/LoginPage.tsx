import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ============================================================
 * ACEEX V2 - LoginPage
 * Predictive Operations Core - Login com Neural Brain 3D
 * ============================================================
 * Versao: V2 (Three.js / React Three Fiber)
 * Stack: React + R3F + framer-motion + Tailwind
 * Encoding: UTF-8 sem BOM
 * ============================================================ */

// ============================================================
// SECAO 1 - CEREBRO NEURAL 3D
// ============================================================

function generateNeuralNodes(count: number, radius: number) {
  const nodes: { position: [number, number, number]; layer: "core" | "mid" | "edge" }[] = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const r = radius * (0.45 + Math.random() * 0.55);
    const x = r * Math.cos(theta) * Math.sin(phi);
    const y = r * Math.sin(theta) * Math.sin(phi);
    const z = r * Math.cos(phi);
    let layer: "core" | "mid" | "edge" = "edge";
    if (r < radius * 0.55) layer = "core";
    else if (r < radius * 0.8) layer = "mid";
    nodes.push({ position: [x, y, z], layer });
  }
  return nodes;
}

function generateSynapses(nodes: ReturnType<typeof generateNeuralNodes>) {
  const synapses: { from: number; to: number }[] = [];
  const maxDist = 1.4;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < maxDist) synapses.push({ from: i, to: j });
    }
  }
  return synapses;
}

function NeuralCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.6) * 0.08;
    if (meshRef.current) meshRef.current.scale.setScalar(pulse);
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color="#A855F7" transparent opacity={0.08} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color="#C084FC" transparent opacity={0.18} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.95} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

function NeuralNetwork() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const nodes = useMemo(() => generateNeuralNodes(60, 1.8), []);
  const synapses = useMemo(() => generateSynapses(nodes), [nodes]);

  const synapseGeometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    synapses.forEach((s) => {
      const a = nodes[s.from].position;
      const b = nodes[s.to].position;
      positions.push(...a, ...b);
      const c = new THREE.Color("#A855F7");
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [nodes, synapses]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.15;
      groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.25;
      groupRef.current.rotation.z = Math.sin(t * 0.05) * 0.1;
      groupRef.current.rotation.y += mouseRef.current.x * 0.15;
      groupRef.current.rotation.x += mouseRef.current.y * 0.1;
    }
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 0.6;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <group ref={groupRef}>
      <NeuralCore />
      {nodes.map((node, i) => {
        const colors = { core: "#FFFFFF", mid: "#C084FC", edge: "#06B6D4" };
        const sizes = { core: 0.05, mid: 0.04, edge: 0.045 };
        return (
          <mesh key={i} position={node.position}>
            <sphereGeometry args={[sizes[node.layer], 12, 12]} />
            <meshBasicMaterial color={colors[node.layer]} transparent opacity={0.9} />
          </mesh>
        );
      })}
      <lineSegments geometry={synapseGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

function NeuralBrainCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.5} />
      <NeuralNetwork />
    </Canvas>
  );
}

// ============================================================
// SECAO 2 - CONTADOR ANIMADO
// ============================================================

function CountUp({
  to,
  duration = 800,
  decimals = 0,
  delay = 0,
}: {
  to: number;
  duration?: number;
  decimals?: number;
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

  return <span>{value.toFixed(decimals)}</span>;
}

// ============================================================
// SECAO 3 - SVG OVERLAY (streams + modulos)
// ============================================================

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
  const stroke = accent === "purple" ? "rgba(168, 85, 247, 0.6)" : "rgba(6, 182, 212, 0.6)";
  const glow = accent === "purple" ? "url(#mgPurple)" : "url(#mgCyan)";

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: "easeOut" }}
    >
      <circle cx={x} cy={y} r={38} fill={glow} />
      <rect x={x - 40} y={y - 17} width={80} height={34} rx={17} fill="rgba(15, 23, 42, 0.8)" stroke={stroke} strokeWidth={1} />
      <rect x={x - 40} y={y - 17} width={80} height={34} rx={17} fill="none" stroke="url(#synapseGrad)" strokeWidth={0.5} opacity={0.5} />
      <circle cx={x - 27} cy={y} r={4} fill="url(#ledLive)" filter="url(#bloom)">
        <animate attributeName="r" values="4;5;4" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={x - 27} cy={y} r={1.8} fill="#86EFAC" />
      <text
        x={x + 6}
        y={y + 4.5}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={label.length > 4 ? 10 : 11}
        fontFamily="Inter, sans-serif"
        fontWeight={500}
        letterSpacing={label.length > 4 ? "0.05em" : "0.08em"}
      >
        {label}
      </text>
    </motion.g>
  );
}

function EnergyStream({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.85 }}
      transition={{ delay: delay / 1000, duration: 0.7 }}
    >
      <path d={d} stroke="url(#streamGrad)" strokeWidth={1.5} fill="none" filter="url(#bloom)" />
      <path d={d} stroke="#FFFFFF" strokeWidth={0.4} fill="none" opacity={0.7} />
    </motion.g>
  );
}

// ============================================================
// SECAO 4 - LOGIN PAGE PRINCIPAL
// ============================================================

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

  const modules = [
    { x: 160, y: 290, label: "ERP", accent: "cyan" as const, delay: 1400 },
    { x: 160, y: 380, label: "CRM", accent: "purple" as const, delay: 1480 },
    { x: 190, y: 470, label: "FIN", accent: "purple" as const, delay: 1560 },
    { x: 685, y: 215, label: "KANBAN", accent: "purple" as const, delay: 1640 },
    { x: 700, y: 290, label: "BI", accent: "cyan" as const, delay: 1720 },
    { x: 685, y: 420, label: "PMO", accent: "cyan" as const, delay: 1800 },
  ];

  const streams = [
    "M 420 290 Q 360 290 280 290 Q 220 290 175 290",
    "M 420 290 Q 360 330 290 360 Q 230 385 175 380",
    "M 420 290 Q 380 380 320 440 Q 260 480 205 470",
    "M 420 290 Q 500 270 580 240 Q 640 220 665 215",
    "M 420 290 Q 500 290 590 290 Q 650 290 680 290",
    "M 420 290 Q 500 340 570 380 Q 630 410 665 420",
  ];

  return (
    <div className="fixed inset-0 bg-[#0B0E14] text-white overflow-hidden font-sans">

      {/* DESKTOP */}
      <div className="hidden md:grid md:grid-cols-[33%_67%] h-full">

        {/* PAINEL ESQUERDO */}
        <aside className="bg-[#0B0E14] border-r border-white/5 flex flex-col px-9 py-11 relative z-10 min-w-0">

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <span
              className="text-[20px]"
              style={{
                background: "linear-gradient(135deg, #FFFFFF 0%, #C084FC 60%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: 200,
                letterSpacing: "0.18em",
              }}
            >
              aceex&nbsp;&nbsp;v2
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="flex items-center gap-2 mb-6"
          >
            <div
              className="w-[5px] h-[5px] bg-green-500 rounded-full"
              style={{ boxShadow: "0 0 10px rgba(34, 197, 94, 0.9), 0 0 20px rgba(34, 197, 94, 0.4)" }}
            />
            <span
              className="text-green-500 text-[9px] font-mono font-medium"
              style={{ letterSpacing: "0.3em" }}
            >
              SYSTEM ONLINE
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-9"
          >
            <p className="text-slate-400 text-[13px] leading-relaxed font-light mb-1.5">
              Integrated multi-channel project management platform.
            </p>
            <p
              className="text-slate-500 text-[11px] leading-relaxed font-mono"
              style={{ letterSpacing: "0.02em" }}
            >
              // AI-powered delivery, predictive control
            </p>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="bg-[#161B22]/50 border border-white/[0.06] rounded-2xl p-7"
          >
            <div className="mb-5">
              <Label
                htmlFor="email"
                className="text-[10px] text-slate-400 uppercase mb-2 block font-medium font-mono"
                style={{ letterSpacing: "0.25em" }}
              >
                User
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@aceex.com"
                className="bg-[#0B0E14]/60 border-white/10 h-12 text-sm focus-visible:ring-violet-500 focus-visible:border-violet-500/50 font-mono"
                autoComplete="email"
              />
            </div>

            <div className="mb-6">
              <Label
                htmlFor="password"
                className="text-[10px] text-slate-400 uppercase mb-2 block font-medium font-mono"
                style={{ letterSpacing: "0.25em" }}
              >
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
              className="w-full h-12 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-mono uppercase shadow-[0_0_28px_rgba(124,58,237,0.35)]"
              style={{ letterSpacing: "0.4em", fontWeight: 500 }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start"}
            </Button>

            <div className="text-center mt-4">
              <Link
                to="/reset-password"
                className="text-cyan-400 text-[11px] hover:text-cyan-300 transition-colors font-light"
              >
                Recover access
              </Link>
            </div>
          </motion.form>

          <div className="mt-auto pt-6 text-center">
            <span
              className="text-slate-600 text-[9px] font-mono"
              style={{ letterSpacing: "0.35em", lineHeight: 2 }}
            >
              PREDICTIVE TECHNOLOGY
              <br />
              INTEGRATED GOVERNANCE
            </span>
          </div>
        </aside>

        {/* PAINEL DIREITO */}
        <section
          className="relative overflow-hidden min-w-0"
          style={{
            background: "radial-gradient(ellipse at 55% 50%, #2D1B4E 0%, #1A0B2E 35%, #0B0E14 70%, #050608 100%)",
          }}
        >
          {/* Canvas 3D - centro do painel direito */}
          <div
            className="absolute"
            style={{ top: 0, left: "20%", width: "60%", height: "100%", pointerEvents: "none" }}
          >
            <NeuralBrainCanvas />
          </div>

          {/* Hero superior esquerdo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="absolute top-9 left-11 z-[5]"
          >
            <div
              className="text-white text-[20px] tracking-tight"
              style={{ fontWeight: 200, letterSpacing: "-0.02em" }}
            >
              Predictive Operations Core
            </div>
            <div
              className="text-slate-400 text-[11px] mt-1.5 font-light"
              style={{ letterSpacing: "0.04em" }}
            >
              Integrated multi-channel project intelligence
            </div>
          </motion.div>

          {/* Metricas */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="absolute top-[100px] left-11 z-[5] bg-slate-900/40 border-l-2 border-violet-500/50 px-[18px] py-[14px] rounded-r-[10px] backdrop-blur-md min-w-[320px]"
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="text-slate-500 text-[8px] font-mono" style={{ letterSpacing: "0.3em" }}>
                    DELIVERY ON-TIME
                  </div>
                  <div className="text-slate-600 text-[7px] font-mono mt-0.5" style={{ letterSpacing: "0.15em" }}>
                    last 90 days
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-cyan-400 text-[18px]"
                    style={{ fontWeight: 300, letterSpacing: "-0.03em", textShadow: "0 0 14px rgba(6, 182, 212, 0.6)" }}
                  >
                    <CountUp to={94.2} decimals={1} delay={250} />
                    <span className="text-[11px] opacity-70">%</span>
                  </span>
                  <span className="text-green-500 text-[9px] font-mono">↗ +2.4</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-violet-500/20 to-transparent" />

              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="text-slate-500 text-[8px] font-mono" style={{ letterSpacing: "0.3em" }}>
                    PREDICTIVE ACCURACY
                  </div>
                  <div className="text-slate-600 text-[7px] font-mono mt-0.5" style={{ letterSpacing: "0.15em" }}>
                    AI core model
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-violet-400 text-[18px]"
                    style={{ fontWeight: 300, letterSpacing: "-0.03em", textShadow: "0 0 14px rgba(168, 85, 247, 0.6)" }}
                  >
                    <CountUp to={98.7} decimals={1} delay={330} />
                    <span className="text-[11px] opacity-70">%</span>
                  </span>
                  <span className="text-green-500 text-[9px] font-mono">↗ +0.3</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-violet-500/20 to-transparent" />

              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="text-slate-500 text-[8px] font-mono" style={{ letterSpacing: "0.3em" }}>
                    ACTIVE INTEGRATIONS
                  </div>
                  <div className="text-slate-600 text-[7px] font-mono mt-0.5" style={{ letterSpacing: "0.15em" }}>
                    real-time sync
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-cyan-400 text-[18px]"
                    style={{ fontWeight: 300, letterSpacing: "-0.03em", textShadow: "0 0 14px rgba(6, 182, 212, 0.6)" }}
                  >
                    <CountUp to={12} decimals={0} delay={410} />
                    <span className="text-[11px] opacity-70">/12</span>
                  </span>
                  <span className="text-green-500 text-[9px] font-mono">● live</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SVG overlay */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 760 620"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              <linearGradient id="synapseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E0D5FF" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#A855F7" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.7" />
              </linearGradient>
              <radialGradient id="streamGrad" cx="0%" cy="50%" r="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="20%" stopColor="#E0D5FF" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#A855F7" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.4" />
              </radialGradient>
              <radialGradient id="mgPurple" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="mgCyan" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ledLive" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#86EFAC" stopOpacity="1" />
                <stop offset="60%" stopColor="#22C55E" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
              </radialGradient>
              <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g opacity={0.75}>
              <circle cx={60} cy={50} r={0.9} fill="white" />
              <circle cx={700} cy={80} r={1.1} fill="white" />
              <circle cx={160} cy={160} r={0.6} fill="#A855F7" />
              <circle cx={680} cy={260} r={0.8} fill="white" />
              <circle cx={50} cy={380} r={0.7} fill="#06B6D4" />
              <circle cx={720} cy={440} r={1} fill="white" />
              <circle cx={280} cy={40} r={0.5} fill="white" />
              <circle cx={500} cy={540} r={0.8} fill="#A855F7" />
              <circle cx={40} cy={260} r={0.7} fill="white" />
              <circle cx={730} cy={180} r={0.6} fill="white" />
              <circle cx={120} cy={500} r={0.8} fill="#06B6D4" />
              <circle cx={650} cy={60} r={0.6} fill="white" />
              <circle cx={340} cy={60} r={0.5} fill="white" />
              <circle cx={400} cy={540} r={0.7} fill="white" />
              <circle cx={30} cy={110} r={0.6} fill="#A855F7" />
              <circle cx={690} cy={540} r={0.8} fill="white" />
              <circle cx={180} cy={440} r={0.6} fill="white" />
              <circle cx={560} cy={160} r={0.7} fill="#06B6D4" />
              <circle cx={240} cy={540} r={0.6} fill="white" />
              <circle cx={520} cy={340} r={0.5} fill="white" />
            </g>

            <circle cx={420} cy={290} r={220} fill="none" stroke="rgba(168, 85, 247, 0.08)" strokeWidth={0.5} strokeDasharray="2 8" />
            <circle cx={420} cy={290} r={180} fill="none" stroke="rgba(6, 182, 212, 0.06)" strokeWidth={0.5} strokeDasharray="2 4" />

            {streams.map((d, i) => (
              <EnergyStream key={i} d={d} delay={1200 + i * 60} />
            ))}

            <g filter="url(#bloom)">
              <circle r={2} fill="#FFFFFF">
                <animateMotion dur="2.8s" repeatCount="indefinite" path="M 420 290 Q 360 290 280 290 Q 220 290 175 290" />
              </circle>
              <circle r={2} fill="#FFFFFF">
                <animateMotion dur="3.1s" repeatCount="indefinite" path="M 420 290 Q 360 330 290 360 Q 230 385 175 380" />
              </circle>
              <circle r={2} fill="#FFFFFF">
                <animateMotion dur="2.5s" repeatCount="indefinite" path="M 420 290 Q 380 380 320 440 Q 260 480 205 470" />
              </circle>
              <circle r={2} fill="#FFFFFF">
                <animateMotion dur="2.9s" repeatCount="indefinite" path="M 420 290 Q 500 270 580 240 Q 640 220 665 215" />
              </circle>
              <circle r={2} fill="#FFFFFF">
                <animateMotion dur="2.6s" repeatCount="indefinite" path="M 420 290 Q 500 290 590 290 Q 650 290 680 290" />
              </circle>
              <circle r={2} fill="#FFFFFF">
                <animateMotion dur="3.2s" repeatCount="indefinite" path="M 420 290 Q 500 340 570 380 Q 630 410 665 420" />
              </circle>
            </g>

            <text
              x={420}
              y={195}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={6}
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="0.4em"
              opacity={0.5}
            >
              A C E E X · A I · C O R T E X
            </text>
            <text
              x={420}
              y={395}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={5}
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="0.3em"
              opacity={0.4}
            >
              v2.0 // PREDICTIVE ENGINE
            </text>

            {modules.map((m, i) => (
              <ModuleCapsule key={i} {...m} />
            ))}
          </svg>

          {/* Frase aspiracional */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="absolute right-12 z-[5] max-w-[460px] text-right"
            style={{ bottom: "140px" }}
          >
            <div
              className="text-white text-[40px] leading-[1.05] tracking-tight"
              style={{ fontWeight: 200, letterSpacing: "-0.04em" }}
            >
              Controle{" "}
              <span
                className="text-violet-400"
                style={{ fontWeight: 400, textShadow: "0 0 24px rgba(168, 85, 247, 0.5)" }}
              >
                Absoluto.
              </span>
            </div>
            <div
              className="text-white text-[40px] leading-[1.05] tracking-tight"
              style={{ fontWeight: 200, letterSpacing: "-0.04em" }}
            >
              Resultados{" "}
              <span
                className="text-cyan-400 italic"
                style={{ fontWeight: 400, textShadow: "0 0 24px rgba(6, 182, 212, 0.5)" }}
              >
                Preditivos.
              </span>
            </div>
          </motion.div>

          {/* CORTEX // ACTIVE - centralizado inferior */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute left-1/2 -translate-x-1/2 z-[5]"
            style={{ bottom: "70px" }}
          >
            <div className="flex items-center gap-2.5 px-[18px] py-2 bg-slate-900/60 border border-violet-500/30 rounded-[20px] backdrop-blur-md">
              <div
                className="w-1.5 h-1.5 bg-violet-500 rounded-full"
                style={{ boxShadow: "0 0 10px rgba(168, 85, 247, 0.9), 0 0 20px rgba(168, 85, 247, 0.5)" }}
              />
              <span
                className="text-violet-300 text-[9px] font-mono font-medium"
                style={{ letterSpacing: "0.4em" }}
              >
                CORTEX // ACTIVE
              </span>
              <div className="w-px h-2.5 bg-violet-500/30 mx-1" />
              <span
                className="text-slate-500 text-[9px] font-mono"
                style={{ letterSpacing: "0.3em" }}
              >
                NEURAL PROCESSING: 98.7%
              </span>
            </div>
          </motion.div>

          {/* Rodape tecnico */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.5 }}
            className="absolute left-1/2 -translate-x-1/2 z-[5]"
            style={{ bottom: "24px" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-1 h-1 bg-green-500 rounded-full"
                style={{ boxShadow: "0 0 8px rgba(34, 197, 94, 0.8)" }}
              />
              <span
                className="text-slate-500 text-[9px] font-mono"
                style={{ letterSpacing: "0.4em" }}
              >
                REAL-TIME PERFORMANCE MONITORING
              </span>
            </div>
          </motion.div>
        </section>
      </div>

      {/* MOBILE */}
      <div className="md:hidden flex flex-col h-full overflow-y-auto">

        <div
          className="relative h-[280px] overflow-hidden flex-shrink-0"
          style={{
            background: "radial-gradient(ellipse at center, #2D1B4E 0%, #1A0B2E 40%, #0B0E14 80%)",
          }}
        >
          <div className="absolute inset-0">
            <NeuralBrainCanvas />
          </div>

          <div className="absolute top-3.5 left-4 right-4 flex justify-between items-center z-10">
            <span
              className="text-[14px]"
              style={{
                background: "linear-gradient(135deg, #FFFFFF 0%, #C084FC 60%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: 200,
                letterSpacing: "0.15em",
              }}
            >
              aceex&nbsp;&nbsp;v2
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 bg-green-500 rounded-full"
                style={{ boxShadow: "0 0 6px rgba(34, 197, 94, 0.8)" }}
              />
              <span
                className="text-green-500 text-[8px] font-mono"
                style={{ letterSpacing: "0.2em" }}
              >
                ONLINE
              </span>
            </div>
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-violet-500/30 rounded-full backdrop-blur-md">
              <div
                className="w-1 h-1 bg-violet-500 rounded-full"
                style={{ boxShadow: "0 0 6px rgba(168, 85, 247, 0.8)" }}
              />
              <span
                className="text-violet-300 text-[7px] font-mono font-medium"
                style={{ letterSpacing: "0.3em" }}
              >
                CORTEX // ACTIVE
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-7 py-6 flex flex-col">
          <p className="text-slate-400 text-[12px] leading-relaxed font-light mb-1">
            Integrated multi-channel project management.
          </p>
          <p
            className="text-slate-500 text-[10px] leading-relaxed font-mono mb-5"
            style={{ letterSpacing: "0.02em" }}
          >
            // AI-powered delivery, predictive control
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label
                htmlFor="email-mob"
                className="text-[10px] text-slate-400 uppercase mb-1.5 block font-mono font-medium"
                style={{ letterSpacing: "0.25em" }}
              >
                User
              </Label>
              <Input
                id="email-mob"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@aceex.com"
                className="bg-[#161B22]/60 border-white/10 h-11 text-sm focus-visible:ring-violet-500 font-mono"
                autoComplete="email"
              />
            </div>

            <div>
              <Label
                htmlFor="password-mob"
                className="text-[10px] text-slate-400 uppercase mb-1.5 block font-mono font-medium"
                style={{ letterSpacing: "0.25em" }}
              >
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
              className="w-full h-11 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-mono uppercase"
              style={{ letterSpacing: "0.3em", fontWeight: 500 }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start"}
            </Button>

            <div className="text-center">
              <Link to="/reset-password" className="text-cyan-400 text-[11px] font-light">
                Recover access
              </Link>
            </div>
          </form>

          <div className="mt-auto pt-4 text-center">
            <span
              className="text-slate-600 text-[8px] font-mono"
              style={{ letterSpacing: "0.25em" }}
            >
              PREDICTIVE TECHNOLOGY · INTEGRATED GOVERNANCE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
