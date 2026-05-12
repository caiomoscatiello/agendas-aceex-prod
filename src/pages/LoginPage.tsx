import { useState, useMemo, useRef, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import aceexLogo from "@/assets/aceex_logo.jpg";

// Three.js Imports
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial, Stars, OrbitControls } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";


// --- COMPONENTES 3D ---

function PredictiveCore() {
  const meshRef = useRef<any>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.15;
    meshRef.current.rotation.z = t * 0.1;
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshStandardMaterial 
          color="#8B5CF6" 
          wireframe 
          transparent 
          opacity={0.4} 
          emissive="#8B5CF6" 
          emissiveIntensity={1.5} 
        />
      </mesh>
      <Sphere args={[1, 64, 64]}>
        <MeshDistortMaterial 
          color="#22d3ee" 
          speed={3} 
          distort={0.4} 
          radius={1} 
          emissive="#22d3ee" 
          emissiveIntensity={0.5} 
        />
      </Sphere>
    </group>
  );
}

function DataParticles({ count = 150 }) {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 15;
      p[i * 3 + 1] = (Math.random() - 0.5) * 15;
      p[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return p;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length / 3}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#8B5CF6" transparent opacity={0.4} />
    </points>
  );
}

// --- PÁGINA DE LOGIN PRINCIPAL ---

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
      toast({ title: "Sucesso", description: "Email de recuperação enviado!" });
      setForgotMode(false);
    }
    setResetLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0F172A] overflow-hidden font-sans">
      
      {/* LADO ESQUERDO: LOGIN (33%) */}
      <motion.div 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full md:w-[33%] h-full bg-[#0B0E14] border-r border-white/10 flex flex-col justify-center px-10 z-20 shadow-2xl"
      >
        <div className="mb-10">
          <img src={aceexLogo} alt="ACEEX" className="h-12 mb-6 grayscale brightness-200" />
          <h2 className="text-3xl font-bold text-white tracking-tight">ACEEX <span className="text-violet-500">V2</span></h2>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            Plataforma robusta para gestão de projetos e indicadores inteligentes.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {forgotMode ? (
            <motion.form 
              key="forgot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleForgotPassword} 
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-xs uppercase tracking-widest text-slate-500">Email Corporativo</Label>
                <Input
                  id="reset-email"
                  type="email"
                  className="bg-[#161B22] border-white/5 text-white h-11 focus:border-violet-500 transition-all"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
              <Button type="submit" className="w-full h-12 bg-violet-600 hover:bg-violet-500 text-white font-bold" disabled={resetLoading}>
                {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recuperar Acesso"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-slate-500 hover:text-white" onClick={() => { setForgotMode(false); setError(""); }}>
                Voltar ao login
              </Button>
            </motion.form>
          ) : (
            <motion.form 
              key="login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSubmit} 
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-widest text-slate-500">Acesso</Label>
                <Input
                  id="email"
                  type="email"
                  className="bg-[#161B22] border-white/5 text-white h-11 focus:border-violet-500 transition-all"
                  placeholder="email@aceex.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-widest text-slate-500">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  className="bg-[#161B22] border-white/5 text-white h-11 focus:border-violet-500 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
              <Button type="submit" className="w-full h-12 bg-violet-600 hover:bg-violet-500 text-white font-bold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar no Dashboard"}
              </Button>
              <Button type="button" variant="link" className="w-full text-sm text-slate-500 hover:text-violet-400" onClick={() => { setForgotMode(true); setError(""); }}>
                Esqueci minhas credenciais
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-auto pt-10 border-t border-white/5 text-[10px] text-slate-600 uppercase tracking-[0.2em] text-center">
          Tecnologia Preditiva & Gestão Integrada
        </div>
      </motion.div>

      {/* LADO DIREITO: 3D (67%) */}
      <div className="hidden md:block w-[67%] h-full relative bg-black">
        <Suspense fallback={<div className="bg-[#0B0E14] w-full h-full" />}>
          <Canvas camera={{ position: [0, 0, 8] }} gl={{ antialias: true }}>
            <color attach="background" args={["#0B0E14"]} />
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 10, 10]} color="#8B5CF6" />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
              <PredictiveCore />
            </Float>
            <DataParticles />
            <OrbitControls enableZoom={false} />
          </Canvas>
        </Suspense>

        {/* Overlay de Texto */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-20 z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-right w-full"
          >
            <h3 className="text-white text-5xl font-light tracking-tighter leading-none opacity-80">
              Controle <span className="font-bold text-violet-500">Absoluto.</span><br/>
              Resultados <span className="font-bold text-cyan-400 italic">Preditivos.</span>
            </h3>
            <p className="text-slate-500 mt-6 text-sm max-w-sm ml-auto uppercase tracking-widest leading-relaxed">
              Integração completa com ERPs, CRMs e Automação via Inteligência Artificial.
            </p>
          </motion.div>
        </div>

        {/* Efeito Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none"></div>
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