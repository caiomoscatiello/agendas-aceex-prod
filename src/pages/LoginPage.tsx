import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Cpu, Activity, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import aceexLogo from "@/assets/aceex_logo.jpg";

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
    <div className="flex h-screen w-full bg-[#0B0E14] overflow-hidden font-sans text-white">
      
      {/* LADO ESQUERDO: PAINEL DE LOGIN (Fiel ao mockup) */}
      <div className="w-full md:w-[400px] h-full bg-[#0B0E14] border-r border-white/5 flex flex-col justify-center px-10 z-20">
        <div className="mb-12">
          <img src={aceexLogo} alt="ACEEX" className="h-8 mb-8 grayscale brightness-200 opacity-80" />
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tighter uppercase">ACEEX</h2>
            <span className="px-1.5 py-0.5 bg-violet-600 text-[10px] font-bold rounded">V2</span>
          </div>
          <p className="text-slate-500 text-[10px] mt-1 uppercase tracking-[0.3em]">Sistemas Preditivos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Identificação</Label>
            <Input 
              type="email" 
              className="bg-[#161B22]/50 border-white/10 h-12 text-sm focus:ring-violet-500" 
              placeholder="usuario@aceex.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Chave de Acesso</Label>
            <Input 
              type="password" 
              className="bg-[#161B22]/50 border-white/10 h-12 text-sm focus:ring-violet-500" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{error}</p>}
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 h-12 font-bold uppercase tracking-widest text-xs" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Iniciar Sessão"}
          </Button>
        </form>

        <div className="mt-auto py-8 text-[9px] text-slate-700 uppercase tracking-[0.4em] text-center border-t border-white/5">
          ACEEX Group &copy; 2026
        </div>
      </div>

      {/* LADO DIREITO: CORE V2 (Visual do Mockup) */}
      <div className="hidden md:flex flex-1 bg-[#090B10] relative items-center justify-center overflow-hidden">
        
        {/* Background Grid Dots */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '30px 30px' }} />

        {/* Sistema Orbital */}
        <div className="relative flex items-center justify-center">
          
          {/* Anéis (SVG para precisão total) */}
          <svg className="absolute w-[600px] h-[600px] opacity-20">
            <circle cx="300" cy="300" r="280" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="4 8" className="animate-[spin_60s_linear_infinite]" />
            <circle cx="300" cy="300" r="200" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2 4" className="animate-[spin_40s_linear_infinite_reverse]" />
          </svg>

          {/* O NÚCLEO CORE V2 (O quadrado do mockup) */}
          <motion.div 
            animate={{ scale: [1, 1.02, 1], rotate: [0, 1, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
            className="relative z-10 w-56 h-56 bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-400 rounded-[40px] flex items-center justify-center shadow-[0_0_80px_rgba(139,92,246,0.3)]"
          >
            <div className="flex flex-col items-center text-white">
              <Cpu size={64} strokeWidth={1} className="mb-4 opacity-90" />
              <div className="text-[12px] tracking-[0.5em] font-black uppercase">Core V2</div>
            </div>
            
            {/* Brilho interno dinâmico */}
            <div className="absolute inset-0 rounded-[40px] bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
          </motion.div>

          {/* Badges Flutuantes (Labels do Mockup) */}
          <motion.div 
            animate={{ y: [0, -15, 0] }} transition={{ duration: 4, repeat: Infinity }}
            className="absolute -top-32 -left-20 bg-[#161B22]/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-lg flex items-center gap-3 shadow-xl"
          >
            <Activity size={14} className="text-violet-400" />
            <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Real-Time Sync</span>
          </motion.div>

          <motion.div 
            animate={{ y: [0, 15, 0] }} transition={{ duration: 5, delay: 1, repeat: Infinity }}
            className="absolute -bottom-24 -right-10 bg-[#161B22]/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-lg flex items-center gap-3 shadow-xl"
          >
            <ShieldCheck size={14} className="text-cyan-400" />
            <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Secure Layer</span>
          </motion.div>
        </div>

        {/* Texto Aspiracional Inferior (Mockup) */}
        <div className="absolute bottom-20 right-20 text-right pointer-events-none">
          <h1 className="text-white text-6xl font-light tracking-tighter leading-[0.9]">
            Controle <span className="font-bold text-violet-500">Absoluto.</span><br/>
            Resultados <span className="font-bold text-cyan-400 italic">Preditivos.</span>
          </h1>
          <p className="text-slate-600 mt-6 text-[10px] tracking-[0.4em] uppercase font-bold">Performance Monitorada em Tempo Real</p>
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