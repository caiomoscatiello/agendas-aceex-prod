import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Cpu, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import aceexLogo from "@/assets/aceex_logo.jpg";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0B0E14] overflow-hidden font-sans">
      
      {/* LADO ESQUERDO: PAINEL DE LOGIN */}
      <motion.div 
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-full md:w-[400px] h-full bg-[#0B0E14] border-r border-white/5 flex flex-col justify-center px-10 z-20 shadow-2xl"
      >
        <div className="mb-10">
          <img src={aceexLogo} alt="ACEEX" className="h-10 mb-6 grayscale brightness-200" />
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tighter uppercase">ACEEX</h2>
            <span className="px-2 py-0.5 bg-violet-600 text-[10px] text-white font-bold rounded">V2</span>
          </div>
          <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest">Sistemas Preditivos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Identificação</Label>
            <Input 
              type="email" 
              placeholder="usuario@aceex.com"
              className="bg-[#161B22] border-white/10 text-white h-12 focus:ring-violet-500" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Chave de Acesso</Label>
            <Input 
              type="password" 
              placeholder="••••••••"
              className="bg-[#161B22] border-white/10 text-white h-12 focus:ring-violet-500" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 bg-red-400/10 p-3 rounded border border-red-400/20">
              {error}
            </motion.p>
          )}

          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 h-12 font-bold transition-all" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "INICIAR SESSÃO"}
          </Button>
        </form>

        <div className="mt-auto py-8 text-[10px] text-slate-600 uppercase tracking-[0.3em] text-center border-t border-white/5">
          ACEEX Group &copy; 2024
        </div>
      </motion.div>

      {/* LADO DIREITO: NÚCLEO PREDITIVO (CSS ANIMATION) */}
      <div className="hidden md:flex flex-1 bg-[#090B10] relative items-center justify-center overflow-hidden">
        
        {/* Grid de fundo */}
        <div className="absolute inset-0 opacity-10" 
             style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', size: '40px 40px', backgroundSize: '40px 40px' }} />

        {/* Núcleo Visual Central */}
        <div className="relative flex items-center justify-center">
          {/* Anéis Orbitais */}
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute w-[400px] h-[400px] border border-violet-500/20 rounded-full border-dashed" 
          />
          <motion.div 
            animate={{ rotate: -360 }} 
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute w-[300px] h-[300px] border border-cyan-500/10 rounded-full" 
          />
          
          {/* O "Cérebro" da IA */}
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="relative z-10 w-48 h-48 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-3xl rotate-45 flex items-center justify-center shadow-[0_0_100px_rgba(139,92,246,0.3)]"
          >
            <div className="rotate-[-45deg] text-white flex flex-col items-center">
              <Cpu size={48} strokeWidth={1} className="mb-2" />
              <div className="text-[10px] tracking-[0.4em] font-bold opacity-80 uppercase">Core V2</div>
            </div>
          </motion.div>

          {/* Partículas flutuantes com labels de dados */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[
              { icon: <Activity size={12} />, label: "Real-time Sync", pos: "top-[-120px] left-[-150px]" },
              { icon: <ShieldCheck size={12} />, label: "Secure Layer", pos: "bottom-[-100px] right-[-140px]" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, delay: i, repeat: Infinity }}
                className={`absolute ${item.pos} bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-lg flex items-center gap-3`}
              >
                <div className="text-violet-400">{item.icon}</div>
                <div className="text-[10px] text-slate-300 font-medium uppercase tracking-widest">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Rodapé do mockup */}
        <div className="absolute bottom-20 right-20 text-right">
          <h1 className="text-white text-5xl font-light tracking-tighter leading-none">
            Controle <span className="font-bold text-violet-500">Absoluto.</span><br/>
            Resultados <span className="font-bold text-cyan-400 italic">Preditivos.</span>
          </h1>
          <p className="text-slate-500 mt-4 text-xs tracking-widest uppercase">Performance Monitorada em Tempo Real</p>
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