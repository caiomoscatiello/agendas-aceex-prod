import { useState, useRef, useMemo, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Cpu, Activity, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import aceexLogo from "@/assets/aceex_logo.jpg";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";

// 1. NÚCLEO 3D ESTABILIZADO (Sem materiais que causam erro 'S')
function PredictiveCore() {
  const groupRef = useRef<any>(null);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.15;
    groupRef.current.rotation.z = t * 0.1;
  });

  return (
    <group ref={groupRef}>
      {/* Icosaedro Externo (Wireframe do Mockup) */}
      <mesh>
        <icosahedronGeometry args={[2.5, 1]} />
        <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.2} />
      </mesh>
      
      {/* Núcleo de Energia Central (Cria o glow sem MeshDistortMaterial) */}
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial 
          color="#22d3ee" 
          emissive="#22d3ee" 
          emissiveIntensity={2} 
          transparent 
          opacity={0.8}
        />
      </mesh>
      
      <pointLight position={[5, 5, 5]} intensity={2} color="#8B5CF6" />
      <pointLight position={[-5, -5, -5]} intensity={2} color="#22d3ee" />
    </group>
  );
}

// 2. SISTEMA DE PARTÍCULAS PURO (Mais estável que o componente Stars)
function DataStream() {
  const points = useMemo(() => {
    const p = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      p[i * 3] = (Math.random() - 0.5) * 20;
      p[i * 3 + 1] = (Math.random() - 0.5) * 20;
      p[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return p;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length / 3} array={points} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#8B5CF6" transparent opacity={0.3} />
    </points>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0B0E14] overflow-hidden font-sans">
      
      {/* LADO ESQUERDO: BARRA DE LOGIN (Fiel ao Mockup) */}
      <div className="w-full md:w-[400px] h-full bg-[#0B0E14] border-r border-white/5 flex flex-col justify-center px-10 z-20 shadow-2xl">
        <div className="mb-12">
          <img src={aceexLogo} alt="ACEEX" className="h-10 mb-8 grayscale brightness-200" />
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tighter uppercase">ACEEX</h2>
            <span className="px-2 py-0.5 bg-violet-600 text-[10px] text-white font-bold rounded">V2</span>
          </div>
          <p className="text-slate-500 text-xs mt-2 uppercase tracking-[0.2em]">Sistemas Preditivos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Identificação</Label>
            <Input 
              type="email" 
              className="bg-[#161B22] border-white/5 text-white h-12 focus:ring-violet-500 transition-all" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Chave de Acesso</Label>
            <Input 
              type="password" 
              className="bg-[#161B22] border-white/5 text-white h-12 focus:ring-violet-500 transition-all" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded border border-red-400/20">{error}</p>}
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 h-12 font-bold shadow-lg shadow-violet-600/20" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "INICIAR SESSÃO NO DASHBOARD"}
          </Button>
        </form>

        <div className="mt-auto py-8 text-[10px] text-slate-700 uppercase tracking-[0.3em] text-center border-t border-white/5">
          ACEEX Group &copy; 2026
        </div>
      </div>

      {/* LADO DIREITO: CENA 3D (Fiel ao Mockup e Estável) */}
      <div className="hidden md:flex flex-1 bg-black relative items-center justify-center">
        
        {/* Background Grid Estático (Zero JS) */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="w-full h-full">
          <Suspense fallback={null}>
            <Canvas camera={{ position: [0, 0, 8] }} gl={{ antialias: true }}>
              <DataStream />
              <Float speed={2} rotationIntensity={1} floatIntensity={1}>
                <PredictiveCore />
              </Float>
            </Canvas>
          </Suspense>
        </div>

        {/* Floating Labels (Exatamente como no mockup) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[25%] left-[20%] bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg flex items-center gap-3">
            <Activity size={14} className="text-violet-400" />
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Real-Time Sync</span>
          </motion.div>

          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 5, delay: 1, repeat: Infinity }} className="absolute bottom-[30%] left-[25%] bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg flex items-center gap-3">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Secure Layer</span>
          </motion.div>
        </div>

        {/* Texto Overlay Inferior Direito */}
        <div className="absolute bottom-20 right-20 text-right pointer-events-none">
          <h1 className="text-white text-6xl font-light tracking-tighter leading-[0.9]">
            Controle <span className="font-bold text-violet-500">Absoluto.</span><br/>
            Resultados <span className="font-bold text-cyan-400 italic">Preditivos.</span>
          </h1>
          <p className="text-slate-500 mt-6 text-[10px] tracking-[0.4em] uppercase font-bold">Performance Monitorada em Tempo Real</p>
        </div>
      </div>
    </div>
  );
}
/*import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import aceexLogo from "@/assets/aceex_logo.jpg";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!profile) {
      setError("Email não encontrado no sistema.");
      setResetLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      toast({ title: "Sucesso", description: "Email de recuperação enviado! Verifique sua caixa de entrada." });
      setForgotMode(false);
    }
    setResetLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4">
            <img src={aceexLogo} alt="Grupo ACEEX" className="h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Agendas ACEEX
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle de ponto para consultores
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">Informe seu email cadastrado para receber o link de recuperação.</p>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={resetLoading}>
                {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Link de Recuperação"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setForgotMode(false); setError(""); }}>
                Voltar ao login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
              <Button type="button" variant="link" className="w-full text-sm" onClick={() => { setForgotMode(true); setError(""); }}>
                Esqueci minha senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
*/