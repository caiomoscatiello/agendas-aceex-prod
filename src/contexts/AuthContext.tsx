import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type UserRole = "admin" | "coordenador" | "consultor" | null;

type AuthContextType = {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isProjteAuthorized: boolean;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [isProjteAuthorized, setIsProjteAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  // Detect recovery from URL on initial load (before any event fires)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    return window.location.pathname === "/reset-password" &&
      !window.location.hash.includes("error_code");
  });

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    setRole((data?.role as UserRole) ?? null);
  };

  // Provisório (Etapa 3): checa se o usuário está autorizado no control-plane
  // da PROJTE (schema projte_config), decoplado do app_role do produto Aceex.
  //
  // O schema projte_config só existe (e só está exposto no PostgREST) dentro
  // do projeto Supabase MASTER da PROJTE (ofolgjtqgmudfeoppwtb) -- é onde o
  // schema foi criado, de forma provisória, dentro do próprio projeto Aceex
  // Production (ver docs/etapa3-config-projte.md secao 10). Todo AMBIENTE DE
  // CLIENTE (QA, producao de cliente) roda esse MESMO bundle de frontend mas
  // aponta pro Supabase daquele cliente, onde projte_config nao existe --
  // sem esse guard, essa chamada sempre respondia 406 (schema nao exposto)
  // em qualquer ambiente de cliente, contado como falha de HTTP/console pelos
  // testes de QA (UI004) e visivel a qualquer usuario real logado. Bug real
  // encontrado em 2026-08-24 rodando a Suite Completa contra o ambiente QA.
  const PROJTE_MASTER_PROJECT_REF = "ofolgjtqgmudfeoppwtb";
  const isProjteMasterProject =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.includes(PROJTE_MASTER_PROJECT_REF) ?? false;

  const fetchProjteAuthorization = async (userId: string) => {
    if (!isProjteMasterProject) {
      setIsProjteAuthorized(false);
      return;
    }
    const { data } = await (supabase as any)
      .schema("projte_config")
      .from("usuarios_autorizados")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    setIsProjteAuthorized(!!data);
  };

  const isAdmin = role === "admin";

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Trava o roteamento (loading=true) até role E autorização PROJTE
          // resolverem. Sem isso, o AppRoutes re-renderiza com isProjteAuthorized
          // ainda no valor padrão (false) e redireciona /projte-config pra "/"
          // antes da checagem real terminar, mesmo pro usuário autorizado.
          setLoading(true);
          setTimeout(() => {
            if (!isMounted) return;
            Promise.all([fetchRole(currentUser.id), fetchProjteAuthorization(currentUser.id)]).finally(() => {
              if (isMounted) setLoading(false);
            });
          }, 0);
        } else {
          setRole(null);
          setIsProjteAuthorized(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await Promise.all([fetchRole(currentUser.id), fetchProjteAuthorization(currentUser.id)]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setIsProjteAuthorized(false);
  };

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, isProjteAuthorized, loading, isPasswordRecovery, clearPasswordRecovery, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
