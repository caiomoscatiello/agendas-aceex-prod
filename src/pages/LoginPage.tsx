import { useState, useMemo, useRef, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import aceexLogo from "@/assets/aceex_logo.jpg";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";

function PredictiveCore() {
  const meshRef = useRef<any>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.z = t * 0.1;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2.2, 1]} />
      {/* Usando meshBasicMaterial para evitar cálculos de luz que causam erro 'S' no build */}
      <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.3} />
    </mesh>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0B0E14] overflow-hidden">
      {/* LADO ESQUERDO: LOGIN (33%) */}
      <div className="w-full md:w-[33%] h-full bg-[#0B0E14] border-r border-white/5 flex flex-col justify-center px-10 z-20">
        <img src={aceexLogo} alt="ACEEX" className="h-10 mb-8 w-fit grayscale brightness-200" />
        <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">ACEEX <span className="text-violet-500 text-sm">V2</span></h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-slate-500 tracking-widest">Acesso</Label>
            <Input type="email" className="bg-[#161B22] border-white/5 text-white" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-slate-500 tracking-widest">Senha</Label>
            <Input type="password" className="bg-[#161B22] border-white/5 text-white" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 h-11" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Acessar Dashboard"}
          </Button>
        </form>
      </div>

      {/* LADO DIREITO: 3D (67%) */}
      <div className="hidden md:block w-[67%] h-full relative bg-black">
        <Suspense fallback={<div className="bg-[#0B0E14] w-full h-full" />}>
          <Canvas camera={{ position: [0, 0, 8] }}>
            <Stars radius={50} count={2000} factor={4} fade speed={1} />
            <Float speed={2} rotationIntensity={1} floatIntensity={1}>
              <PredictiveCore />
            </Float>
          </Canvas>
        </Suspense>

        {/* Texto Overlay */}
        <div className="absolute inset-0 flex items-center justify-end p-20 pointer-events-none">
          <div className="text-right">
            <h1 className="text-white text-5xl font-light tracking-tighter leading-tight">
              Gestão <span className="font-bold text-violet-500">Inteligente.</span><br/>
              Visão <span className="font-bold text-cyan-400 italic">360°.</span>
            </h1>
          </div>
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