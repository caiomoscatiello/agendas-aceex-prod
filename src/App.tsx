import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import ConsultorDashboardV2 from "./pages/ConsultorDashboardV2";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import EmailSettingsPage from "./pages/EmailSettingsPage";
import ProjteConfigPage from "./pages/ProjteConfigPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading, isPasswordRecovery, isProjteAuthorized } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="*" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Config PROJTE (control-plane provisório): rota decoplada do app_role do produto
  // Aceex, gated só por projte_config.usuarios_autorizados. Disponível pra qualquer
  // usuário autorizado, seja qual for o role dele no produto (ou nenhum).
  const projteRoute = isProjteAuthorized ? (
    <Route path="/projte-config" element={<ProjteConfigPage />} />
  ) : (
    <Route path="/projte-config" element={<Navigate to="/" replace />} />
  );

  if (role === "admin") {
    return (
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/settings/email" element={<EmailSettingsPage />} />
        {projteRoute}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (role === "coordenador") {
    return (
      <Routes>
        <Route path="/" element={<ConsultorDashboardV2 />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/settings/email" element={<EmailSettingsPage />} />
        {projteRoute}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // consultor (default)
  return (
    <Routes>
      <Route path="/" element={<ConsultorDashboardV2 />} />
      {projteRoute}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
