import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import ConsultorDashboard from "./pages/ConsultorDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import EmailSettingsPage from "./pages/EmailSettingsPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If password recovery mode, always show the reset password page
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

  // admin: only admin panel
  // coordenador: consultor dashboard + admin panel
  // consultor: only consultor dashboard
  if (role === "admin") {
    return (
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/settings/email" element={<EmailSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (role === "coordenador") {
    return (
      <Routes>
        <Route path="/" element={<ConsultorDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/settings/email" element={<EmailSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // consultor (default)
  return (
    <Routes>
      <Route path="/" element={<ConsultorDashboard />} />
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
