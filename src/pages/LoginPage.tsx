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
 * PROJTE - LoginPage V10
 * ============================================================
 * V10:
 *  - Logo horizontal: chevron 40px + wordmark 38px na mesma linha
 *  - Linha separadora lime sob o wordmark (nao standalone)
 *  - Espacamentos compactos: py-8, mb-7, mb-5, mb-6
 *  - overflow-y auto no painel esquerdo — formulario sempre visivel
 * ============================================================ */

// ============================================================
// SECAO 1 - CEREBRO NEURAL 3D (vivo)
// ============================================================

interface NeuralNode {
  position: [number, number, number];
  layer: "core" | "mid" | "edge";
  pulseOffset: number;
  pulseSpeed: number;
  isElite: boolean;
}

function generateNeuralNodes(count: number, radius: number): NeuralNode[] {
  const nodes: NeuralNode[] = [];
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

    nodes.push({
      position: [x, y, z],
      layer,
      pulseOffset: Math.random() * Math.PI * 2,
      pulseSpeed: 0.5 + Math.random() * 1.2,
      isElite: layer === "core" && Math.random() > 0.5,
    });
  }
  return nodes;
}

interface Synapse {
  from: number;
  to: number;
  baseOpacity: number;
  pulseOffset: number;
}

function generateSynapses(nodes: NeuralNode[]): Synapse[] {
  const synapses: Synapse[] = [];
  const maxDist = 1.4;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < maxDist) {
        synapses.push({
          from: i,
          to: j,
          baseOpacity: 0.25 + Math.random() * 0.25,
          pulseOffset: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  return synapses;
}

// ----- NUCLEO CENTRAL com pulse rings raros -----
function NeuralCore({ pulseRingTriggerRef }: { pulseRingTriggerRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const lastRingTime = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.6) * 0.12;
    if (meshRef.current) meshRef.current.scale.setScalar(pulse);

    // Pulse rings raros (a cada ~15s)
    if (t - lastRingTime.current > 15) {
      lastRingTime.current = t;
      pulseRingTriggerRef.current = t;
    }

    const ringAge = t - pulseRingTriggerRef.current;
    if (ring1Ref.current && ring2Ref.current && ringAge < 3) {
      // Anel 1: expande de 0.3 ate 3.0 em 2.5s
      const scale1 = 0.3 + ringAge * 1.1;
      const opacity1 = Math.max(0, 0.6 - ringAge / 2.5);
      ring1Ref.current.scale.setScalar(scale1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity1;

      // Anel 2: delay de 0.5s
      const age2 = ringAge - 0.5;
      if (age2 > 0) {
        const scale2 = 0.3 + age2 * 1.1;
        const opacity2 = Math.max(0, 0.4 - age2 / 2.5);
        ring2Ref.current.scale.setScalar(scale2);
        (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity2;
      }
    } else if (ring1Ref.current && ring2Ref.current) {
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  });

  return (
    <group>
      {/* Halo externo */}
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#39FF87" transparent opacity={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshBasicMaterial color="#39FF87" transparent opacity={0.12} />
      </mesh>
      {/* Nucleo brilhante (pulsa) */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.95} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Pulse rings (anéis de energia raros, ~15s) — depthWrite false evita artefato escuro */}
      <mesh ref={ring1Ref}>
        <ringGeometry args={[0.55, 0.6, 64]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ring2Ref}>
        <ringGeometry args={[0.45, 0.5, 64]} />
        <meshBasicMaterial color="#39FF87" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ----- NEURONIO INDIVIDUAL com pulse proprio -----
function NeuralNodeMesh({ node }: { node: NeuralNode }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Cores: alternancia roxo / ciano / branco - mais ciano
  const baseColors = {
    core: "#FFFFFF",
    mid: node.pulseOffset > Math.PI ? "#39FF87" : "#7BFFB0",
    edge: node.pulseOffset > Math.PI * 1.3 ? "#39FF87" : "#7BFFB0",
  };
  const sizes = { core: 0.055, mid: 0.04, edge: 0.045 };

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = state.clock.elapsedTime;

    // Pulse individual: cada neuronio tem fase + velocidade proprias
    const phase = t * node.pulseSpeed + node.pulseOffset;
    const breath = 0.5 + 0.5 * Math.sin(phase);

    // Elite neuronios: brilho extra ocasional (flash branco)
    let flash = 0;
    if (node.isElite) {
      const flashCycle = (t * 0.3 + node.pulseOffset) % (Math.PI * 2);
      if (flashCycle > 4 && flashCycle < 4.4) {
        flash = 1 - Math.abs(flashCycle - 4.2) / 0.2;
      }
    }

    // Escala leve
    const scale = 1 + breath * 0.3 + flash * 0.6;
    meshRef.current.scale.setScalar(scale);

    // Opacity oscila
    materialRef.current.opacity = 0.6 + breath * 0.35 + flash * 0.4;

    // Cor: vai pra branco no flash
    if (flash > 0.2) {
      materialRef.current.color.set("#FFFFFF");
    } else {
      materialRef.current.color.set(baseColors[node.layer]);
    }
  });

  return (
    <mesh ref={meshRef} position={node.position}>
      <sphereGeometry args={[sizes[node.layer], 12, 12]} />
      <meshBasicMaterial ref={materialRef} color={baseColors[node.layer]} transparent opacity={0.8} />
    </mesh>
  );
}

// ----- SINAPSES com particulas viajando -----
function SynapseLines({ nodes, synapses }: { nodes: NeuralNode[]; synapses: Synapse[] }) {
  const linesRef = useRef<THREE.LineSegments>(null);

  const { geometry, colorAttribute } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    synapses.forEach((s) => {
      const a = nodes[s.from].position;
      const b = nodes[s.to].position;
      positions.push(...a, ...b);
      colors.push(0.22, 1.0, 0.53, 0.22, 1.0, 0.53);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const colorAttr = new THREE.Float32BufferAttribute(colors, 3);
    geo.setAttribute("color", colorAttr);
    return { geometry: geo, colorAttribute: colorAttr };
  }, [nodes, synapses]);

  useFrame((state) => {
    if (!linesRef.current) return;
    const t = state.clock.elapsedTime;
    const colors = colorAttribute.array as Float32Array;

    // Pulsa cor das sinapses individualmente
    synapses.forEach((s, i) => {
      const phase = t * 0.8 + s.pulseOffset;
      const intensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase));

      // Mistura roxo (default) com ciano em sinapses especificas
      const isLight = i % 3 === 0;
      const r = isLight ? 0.48 * intensity : 0.22 * intensity;
      const g = isLight ? 1.0 * intensity : 1.0 * intensity;
      const b = isLight ? 0.66 * intensity : 0.53 * intensity;

      colors[i * 6 + 0] = r;
      colors[i * 6 + 1] = g;
      colors[i * 6 + 2] = b;
      colors[i * 6 + 3] = r;
      colors[i * 6 + 4] = g;
      colors[i * 6 + 5] = b;
    });
    colorAttribute.needsUpdate = true;
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.5} />
    </lineSegments>
  );
}

// ----- PARTICULAS viajando pelas sinapses (data flow) -----
function TravelingParticles({ nodes, synapses }: { nodes: NeuralNode[]; synapses: Synapse[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const particleCount = 6;

  // Estado de cada particula
  const particles = useRef(
    Array.from({ length: particleCount }, () => ({
      synapseIndex: Math.floor(Math.random() * synapses.length),
      progress: Math.random(),
      speed: 0.5 + Math.random() * 0.4,
      reverse: Math.random() > 0.5,
    }))
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    particles.current.forEach((p, idx) => {
      p.progress += delta * p.speed;
      if (p.progress >= 1) {
        // Particula chegou ao destino: pega outra sinapse aleatoria
        p.progress = 0;
        p.synapseIndex = Math.floor(Math.random() * synapses.length);
        p.reverse = Math.random() > 0.5;
        p.speed = 0.5 + Math.random() * 0.4;
      }

      const synapse = synapses[p.synapseIndex];
      const a = nodes[synapse.from].position;
      const b = nodes[synapse.to].position;
      const t = p.reverse ? 1 - p.progress : p.progress;

      const mesh = groupRef.current!.children[idx] as THREE.Mesh;
      mesh.position.x = a[0] + (b[0] - a[0]) * t;
      mesh.position.y = a[1] + (b[1] - a[1]) * t;
      mesh.position.z = a[2] + (b[2] - a[2]) * t;

      // Fade nas extremidades
      const fade = Math.sin(p.progress * Math.PI);
      (mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: particleCount }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ----- NEURAL NETWORK PRINCIPAL -----
function NeuralNetwork() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0, currentX: 0, currentY: 0 });
  const pulseRingTriggerRef = useRef(-100); // Comeca sem pulse

  const nodes = useMemo(() => generateNeuralNodes(60, 1.8), []);
  const synapses = useMemo(() => generateSynapses(nodes), [nodes]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current) return;

    // Rotacao 3D continua
    groupRef.current.rotation.y = t * 0.13;
    groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.22;
    groupRef.current.rotation.z = Math.sin(t * 0.05) * 0.08;

    // Mouse parallax com inercia (lerp)
    mouseRef.current.currentX += (mouseRef.current.x - mouseRef.current.currentX) * 0.05;
    mouseRef.current.currentY += (mouseRef.current.y - mouseRef.current.currentY) * 0.05;
    groupRef.current.rotation.y += mouseRef.current.currentX * 0.2;
    groupRef.current.rotation.x += mouseRef.current.currentY * 0.15;
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 0.7;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 0.7;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <group ref={groupRef} scale={0.95}>
      <NeuralCore pulseRingTriggerRef={pulseRingTriggerRef} />
      {nodes.map((node, i) => (
        <NeuralNodeMesh key={i} node={node} />
      ))}
      <SynapseLines nodes={nodes} synapses={synapses} />
      <TravelingParticles nodes={nodes} synapses={synapses} />
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
// SECAO 3 - MODULES INLINE (com pulse de cor instigando click)
// ============================================================

const FEATURES = [
  { id: "erp", label: "ERP", accent: "cyan" as const, hint: "Integração nativa Protheus/TOTVS" },
  { id: "crm", label: "CRM", accent: "cyan" as const, hint: "Pipeline e gestão de relacionamento" },
  { id: "fin", label: "FIN", accent: "cyan" as const, hint: "Gestão financeira e despesas" },
  { id: "kanban", label: "KANBAN", accent: "cyan" as const, hint: "Projetos visuais e Monday.com" },
  { id: "bi", label: "BI", accent: "cyan" as const, hint: "Analytics e dashboards executivos" },
  { id: "pmo", label: "PMO", accent: "cyan" as const, hint: "Governança e SLA management" },
];

function ModulesInline({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.6 }}
      className="absolute z-[15]"
      style={{ bottom: "32px", left: "36px" }}
    >
      <div className="flex items-center gap-2 mb-3.5">
        <div className="w-4 h-px bg-gradient-to-r from-[#39FF87] to-transparent" />
        <span
          className="text-[9px] font-mono" style={{ color: "#39FF87" }}
          style={{ letterSpacing: "0.4em", fontWeight: 600 }}
        >
          PLATFORM MODULES
        </span>
      </div>

      <div className="flex items-center gap-0">
        {FEATURES.map((f, i) => {
          const ledBase = "#39FF87";
          const ledFlash = "#7BFFB0";
          const accentColor = "#39FF87";

          return (
            <div key={f.id} className="flex items-center">
              <Link
                to={`/features#${f.id}`}
                className="group relative px-3 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {/* LED MAIS ATIVO: scale + cor + glow pulsando */}
                  <motion.div
                    animate={{
                      scale: [1, 1.5, 1],
                      backgroundColor: [ledBase, ledFlash, ledBase],
                      boxShadow: [
                        `0 0 6px ${ledBase}, 0 0 12px ${ledBase}80`,
                        `0 0 14px ${ledFlash}, 0 0 24px ${ledFlash}80`,
                        `0 0 6px ${ledBase}, 0 0 12px ${ledBase}80`,
                      ],
                    }}
                    transition={{
                      duration: 1.5 + i * 0.3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-[6px] h-[6px] rounded-full"
                  />
                  <span
                    className="text-slate-300 text-[11px] font-mono transition-colors duration-200 group-hover:text-white"
                    style={{ letterSpacing: "0.15em", fontWeight: 500 }}
                  >
                    {f.label}
                  </span>
                  <span
                    className="text-[10px] transition-all duration-200 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
                    style={{ color: accentColor }}
                  >
                    →
                  </span>
                </div>

                <div
                  className="absolute bottom-1 left-3 right-3 h-px origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                  style={{
                    background: `linear-gradient(to right, ${accentColor}, transparent)`,
                  }}
                />

                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none whitespace-nowrap">
                  <div className="bg-slate-900/95 border border-[#39FF87]/25 rounded-lg px-3 py-2 backdrop-blur-md shadow-[0_4px_16px_rgba(57,255,135,0.12)]">
                    <div
                      className="text-slate-200 text-[10px]"
                      style={{ fontWeight: 400, letterSpacing: "0.02em" }}
                    >
                      {f.hint}
                    </div>
                  </div>
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -translate-y-1 border-r border-b border-[#39FF87]/25"
                    style={{ backgroundColor: "rgb(15 23 42 / 0.95)" }}
                  />
                </div>
              </Link>

              {i < FEATURES.length - 1 && (
                <span className="text-slate-700 text-[10px] select-none">·</span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
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

  return (
    <div className="fixed inset-0 bg-[#0B0E14] text-white overflow-hidden font-sans">

      {/* DESKTOP */}
      <div className="hidden md:grid md:grid-cols-[33%_67%] h-full">

        {/* PAINEL ESQUERDO */}
        <aside className="bg-[#0B0E14] border-r border-white/5 flex flex-col px-9 py-8 relative z-10 min-w-0 overflow-y-auto">

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7"
          >
            {/* Logo horizontal: chevron >>> + wordmark na mesma linha */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="40" height="40" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg"
                style={{ filter: "drop-shadow(0 0 10px rgba(57,255,135,0.45))", flexShrink: 0 }}>
                <path d="M14 20 L28 44 L14 68" stroke="rgba(255,255,255,0.2)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M28 20 L42 44 L28 68" stroke="rgba(255,255,255,0.6)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M42 20 L56 44 L42 68" stroke="#39FF87" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="56" cy="44" r="7" fill="rgba(57,255,135,0.18)"/>
                <circle cx="56" cy="44" r="4.5" fill="#39FF87"/>
              </svg>
              <div>
                <div style={{
                  fontSize: "38px",
                  color: "#ffffff",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}>
                  projt<span style={{
                    color: "#39FF87",
                    textShadow: "0 0 24px rgba(57,255,135,0.7), 0 0 48px rgba(57,255,135,0.25)",
                  }}>e</span>
                </div>
                {/* Linha separadora lime sob o nome */}
                <div style={{
                  marginTop: "6px",
                  width: "36px",
                  height: "2px",
                  background: "linear-gradient(90deg, #39FF87, transparent)",
                  borderRadius: "2px",
                }} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center gap-2.5 mb-5"
          >
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                boxShadow: [
                  "0 0 10px rgba(34, 197, 94, 0.9), 0 0 20px rgba(34, 197, 94, 0.4)",
                  "0 0 20px rgba(34, 197, 94, 1), 0 0 36px rgba(34, 197, 94, 0.7)",
                  "0 0 10px rgba(34, 197, 94, 0.9), 0 0 20px rgba(34, 197, 94, 0.4)",
                ],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="w-[6px] h-[6px] bg-green-500 rounded-full"
            />
            <motion.span
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="text-green-500 text-[9px] font-mono"
              style={{ letterSpacing: "0.35em", fontWeight: 600 }}
            >
              SYSTEM ONLINE
            </motion.span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-6"
          >
            <p className="text-slate-300 text-[14px] leading-relaxed mb-2" style={{ fontWeight: 300 }}>
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
            transition={{ delay: 0.4, duration: 0.5 }}
            className="bg-[#161B22]/50 border border-white/[0.06] rounded-2xl p-7"
          >
            <div className="mb-5">
              <Label
                htmlFor="email"
                className="text-[10px] text-slate-400 uppercase mb-2 block font-mono"
                style={{ letterSpacing: "0.25em", fontWeight: 500 }}
              >
                User
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@projte.io"
                className="bg-[#0B0E14]/60 border-white/10 h-12 text-sm focus-visible:ring-[#39FF87] focus-visible:border-[#39FF87]/50 font-mono"
                autoComplete="email"
              />
            </div>

            <div className="mb-6">
              <Label
                htmlFor="password"
                className="text-[10px] text-slate-400 uppercase mb-2 block font-mono"
                style={{ letterSpacing: "0.25em", fontWeight: 500 }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#0B0E14]/60 border-white/10 h-12 text-sm focus-visible:ring-[#39FF87] focus-visible:border-[#39FF87]/50"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-md p-2 mb-4">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "48px",
                background: loading ? "rgba(57,255,135,0.5)" : "#39FF87",
                color: "#0B1628",
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.4em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 0 28px rgba(57,255,135,0.35), 0 0 60px rgba(57,255,135,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#0B1628" }} /> : "Start"}
            </button>

            <div className="text-center mt-4">
              <Link
                to="/reset-password"
                style={{ color: "#39FF87", fontWeight: 300, fontSize: "11px" }}
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
            background: "radial-gradient(ellipse at 60% 50%, #0f2245 0%, #0a1628 45%, #0B1628 75%, #060912 100%)",
          }}
        >
          {/* Canvas 3D - deslocado para metade direita */}
          <div
            className="absolute"
            style={{ top: 0, left: "30%", width: "70%", height: "100%", pointerEvents: "none" }}
          >
            <NeuralBrainCanvas />
          </div>

          {/* Particles de fundo estaticas */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 760 620"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 2 }}
          >
            <defs>
              {/* Linha conectiva sutil cerebro -> Total Command (V6) */}
              <linearGradient id="connectorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#39FF87" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#39FF87" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#39FF87" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            <g opacity={0.65}>
              <circle cx={60} cy={50} r={0.9} fill="white" />
              <circle cx={700} cy={80} r={1.1} fill="white" />
              <circle cx={160} cy={160} r={0.6} fill="#39FF87" />
              <circle cx={680} cy={260} r={0.8} fill="white" />
              <circle cx={50} cy={380} r={0.7} fill="#39FF87" />
              <circle cx={720} cy={440} r={1} fill="white" />
              <circle cx={280} cy={40} r={0.5} fill="white" />
              <circle cx={500} cy={540} r={0.8} fill="#39FF87" />
              <circle cx={40} cy={500} r={0.7} fill="white" />
              <circle cx={730} cy={180} r={0.6} fill="white" />
              <circle cx={650} cy={60} r={0.6} fill="white" />
              <circle cx={340} cy={60} r={0.5} fill="white" />
              <circle cx={400} cy={540} r={0.7} fill="white" />
              <circle cx={30} cy={110} r={0.6} fill="#39FF87" />
              <circle cx={690} cy={540} r={0.8} fill="white" />
              <circle cx={180} cy={520} r={0.6} fill="white" />
              <circle cx={560} cy={160} r={0.7} fill="#39FF87" />
              <circle cx={240} cy={540} r={0.6} fill="white" />
            </g>

            {/* LINHA CONECTIVA cerebro -> Total Command
                Comeca proximo do cerebro e termina apontando pra frase
                Stroke-dasharray + animate para "desenhar" no load */}
            <motion.path
              d="M 540 360 Q 600 440 660 500"
              stroke="url(#connectorGrad)"
              strokeWidth="0.8"
              fill="none"
              strokeDasharray="3 6"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ delay: 2.0, duration: 1.0, ease: "easeOut" }}
            />
            {/* Pontinho na ponta da linha (perto da frase) */}
            <motion.circle
              cx={660}
              cy={500}
              r={1.8}
              fill="#39FF87"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.7, 1, 0.7] }}
              transition={{ delay: 2.8, duration: 2 }}
              style={{ filter: "drop-shadow(0 0 4px #39FF87)" }}
            />
          </svg>

          {/* === ZONA 1: TOPO ESQUERDO === */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute top-9 left-9 z-[15]"
            style={{ maxWidth: "calc(100% - 80px)" }}
          >
            <div
              className="text-white"
              style={{
                fontSize: "clamp(22px, 1.8vw, 28px)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              Predictive Operations Core
            </div>
            <div
              className="text-slate-400 mt-2 font-mono"
              style={{
                fontSize: "clamp(10px, 0.8vw, 12px)",
                letterSpacing: "0.08em",
                fontWeight: 400,
              }}
            >
              Integrated multi-channel project intelligence
            </div>
          </motion.div>

          {/* KPIs COMPACTOS */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            className="absolute z-[15] border-l-2 border-[#39FF87]/60 px-5 py-3.5 rounded-r-[10px] backdrop-blur-md"
            style={{
              top: "110px",
              left: "36px",
              minWidth: "320px",
              maxWidth: "360px",
              background: "rgba(10, 18, 35, 0.92)",
              boxShadow: "-2px 0 24px rgba(57, 255, 135, 0.18), inset 0 0 40px rgba(57,255,135,0.03)",
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="text-slate-300 text-[8.5px] font-mono" style={{ letterSpacing: "0.3em", fontWeight: 600 }}>
                    DELIVERY ON-TIME
                  </div>
                  <div className="text-slate-600 text-[7px] font-mono mt-0.5" style={{ letterSpacing: "0.15em" }}>
                    last 90 days
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      color: "#39FF87",
                      fontSize: "24px",
                      fontWeight: 500,
                      letterSpacing: "-0.03em",
                      textShadow: "0 0 24px rgba(57, 255, 135, 0.8), 0 0 48px rgba(57,255,135,0.3)",
                    }}
                  >
                    <CountUp to={94.2} decimals={1} delay={1100} />
                    <span className="text-[12px] opacity-70">%</span>
                  </span>
                  <span className="text-green-500 text-[9px] font-mono">↗ +2.4</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-[#39FF87]/25 to-transparent" />

              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="text-slate-300 text-[8.5px] font-mono" style={{ letterSpacing: "0.3em", fontWeight: 600 }}>
                    PREDICTIVE ACCURACY
                  </div>
                  <div className="text-slate-600 text-[7px] font-mono mt-0.5" style={{ letterSpacing: "0.15em" }}>
                    AI core model
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      color: "#39FF87",
                      fontSize: "24px",
                      fontWeight: 500,
                      letterSpacing: "-0.03em",
                      textShadow: "0 0 24px rgba(57, 255, 135, 0.8), 0 0 48px rgba(57,255,135,0.3)",
                    }}
                  >
                    <CountUp to={98.7} decimals={1} delay={1200} />
                    <span className="text-[12px] opacity-70">%</span>
                  </span>
                  <span className="text-green-500 text-[9px] font-mono">↗ +0.3</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-[#39FF87]/25 to-transparent" />

              <div className="flex justify-between items-center gap-4">
                <div>
                  <div className="text-slate-300 text-[8.5px] font-mono" style={{ letterSpacing: "0.3em", fontWeight: 600 }}>
                    ACTIVE INTEGRATIONS
                  </div>
                  <div className="text-slate-600 text-[7px] font-mono mt-0.5" style={{ letterSpacing: "0.15em" }}>
                    real-time sync
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      color: "#39FF87",
                      fontSize: "24px",
                      fontWeight: 500,
                      letterSpacing: "-0.03em",
                      textShadow: "0 0 24px rgba(57, 255, 135, 0.8), 0 0 48px rgba(57,255,135,0.3)",
                    }}
                  >
                    <CountUp to={12} decimals={0} delay={1300} />
                    <span className="text-[12px] opacity-70">/12</span>
                  </span>
                  <span className="text-green-500 text-[9px] font-mono">● live</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* MODULES INLINE */}
          <ModulesInline delay={1800} />

          {/* TOTAL COMMAND - entrada tardia (2.2s) com linha conectiva */}
          <motion.div
            initial={{ opacity: 0, y: 20, x: 10 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ delay: 2.2, duration: 0.8, ease: "easeOut" }}
            className="absolute z-[15] text-right"
            style={{
              bottom: "32px",
              right: "clamp(36px, 3.5vw, 56px)",
              maxWidth: "min(460px, 45vw)",
            }}
          >
            <div
              className="text-white"
              style={{
                fontSize: "clamp(30px, 3.2vw, 44px)",
                fontWeight: 300,
                letterSpacing: "-0.035em",
                lineHeight: 1.08,
              }}
            >
              Total{" "}
              <span
                style={{
                  fontWeight: 500,
                  color: "#39FF87",
                  textShadow: "0 0 28px rgba(57, 255, 135, 0.5)",
                }}
              >
                Command.
              </span>
            </div>
            <div
              className="text-white"
              style={{
                fontSize: "clamp(30px, 3.2vw, 44px)",
                fontWeight: 300,
                letterSpacing: "-0.035em",
                lineHeight: 1.08,
              }}
            >
              Predictive{" "}
              <span
                className="italic"
                style={{
                  fontWeight: 500,
                  color: "#39FF87",
                  textShadow: "0 0 28px rgba(57, 255, 135, 0.5)",
                }}
              >
                Outcomes.
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
            background: "radial-gradient(ellipse at center, #0f2245 0%, #0a1628 40%, #0B1628 80%)",
          }}
        >
          <div className="absolute inset-0">
            <NeuralBrainCanvas />
          </div>

          <div className="absolute top-3.5 left-4 right-4 flex justify-between items-center z-10">
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 24 L30 44 L18 64" stroke="rgba(255,255,255,0.3)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M30 24 L42 44 L30 64" stroke="rgba(255,255,255,0.7)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M42 24 L54 44 L42 64" stroke="#39FF87" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="54" cy="44" r="6" fill="#39FF87"/>
              </svg>
              <span
                style={{
                  fontSize: "18px",
                  color: "#ffffff",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                projt<span style={{ color: "#39FF87" }}>e</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="w-1.5 h-1.5 bg-green-500 rounded-full"
                style={{ boxShadow: "0 0 6px rgba(34, 197, 94, 0.8)" }}
              />
              <span
                className="text-green-500 text-[8px] font-mono"
                style={{ letterSpacing: "0.2em", fontWeight: 600 }}
              >
                ONLINE
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-7 py-6 flex flex-col">
          <p className="text-slate-300 text-[13px] leading-relaxed mb-1" style={{ fontWeight: 300 }}>
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
                className="text-[10px] text-slate-400 uppercase mb-1.5 block font-mono"
                style={{ letterSpacing: "0.25em", fontWeight: 500 }}
              >
                User
              </Label>
              <Input
                id="email-mob"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@projte.io"
                className="bg-[#161B22]/60 border-white/10 h-11 text-sm focus-visible:ring-[#39FF87] font-mono"
                autoComplete="email"
              />
            </div>

            <div>
              <Label
                htmlFor="password-mob"
                className="text-[10px] text-slate-400 uppercase mb-1.5 block font-mono"
                style={{ letterSpacing: "0.25em", fontWeight: 500 }}
              >
                Password
              </Label>
              <Input
                id="password-mob"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#161B22]/60 border-white/10 h-11 text-sm focus-visible:ring-[#39FF87]"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-md p-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "44px",
                background: loading ? "rgba(57,255,135,0.5)" : "#39FF87",
                color: "#0B1628",
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 0 20px rgba(57,255,135,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#0B1628" }} /> : "Start"}
            </button>

            <div className="text-center">
              <Link to="/reset-password" className="text-[11px]" style={{ color: "#39FF87", fontWeight: 300 }}>
                Recover access
              </Link>
            </div>
          </form>

          <div className="mt-6 mb-2">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-3 h-px bg-gradient-to-r from-[#39FF87] to-transparent" />
              <span className="text-[8px] font-mono" style={{ color: "#39FF87", letterSpacing: "0.3em", fontWeight: 600 }}>
                PLATFORM MODULES
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {FEATURES.map((f, i) => {
                const ledColor = "#39FF87";
                return (
                  <Link
                    key={f.id}
                    to={`/features#${f.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.5 + i * 0.3, repeat: Infinity }}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: ledColor, boxShadow: `0 0 4px ${ledColor}` }}
                    />
                    <span
                      className="text-slate-300 text-[10px] font-mono"
                      style={{ letterSpacing: "0.12em", fontWeight: 500 }}
                    >
                      {f.label}
                    </span>
                    {i < FEATURES.length - 1 && <span className="text-slate-700 text-[9px] ml-1">·</span>}
                  </Link>
                );
              })}
            </div>
          </div>

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
