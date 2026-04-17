import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, FileSpreadsheet, ClipboardList, CalendarDays, LayoutDashboard, Settings, FileText, Workflow, BarChart2 } from "lucide-react";
import AdminCadastros from "@/components/admin/AdminCadastros";
import AdminAgendas from "@/components/admin/AdminAgendas";
import AdminRelatorio from "@/components/admin/AdminRelatorio";
import AdminDashboardView from "@/components/admin/AdminDashboardView";
import AdminIntegrationLogs from "@/components/admin/AdminIntegrationLogs";
import AdminWorkflows from "@/components/admin/AdminWorkflows";
import AdminStatusReport from "@/components/admin/AdminStatusReport";
import aceexLogo from "@/assets/aceex_logo.jpg";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const { signOut, role } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <img src={aceexLogo} alt="Grupo ACEEX" className="h-8 object-contain" />
          <div className="flex items-center gap-1">
            {role === "admin" && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings/email")} className="gap-2 text-muted-foreground">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-2 py-3 sm:p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Painel Administrativo</p>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="flex gap-1 w-full">
            <TabsTrigger value="dashboard" title="Dashboard" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden md:block text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="cadastros" title="Cadastros" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden md:block text-xs">Cadastros</span>
            </TabsTrigger>
            <TabsTrigger value="agendas" title="Agendas" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden md:block text-xs">Agendas</span>
            </TabsTrigger>
            <TabsTrigger value="relatorio" title="Relatório" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden md:block text-xs">Relatório</span>
            </TabsTrigger>
            <TabsTrigger value="workflows" title="Workflows" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <Workflow className="h-4 w-4" />
              <span className="hidden md:block text-xs">Workflows</span>
            </TabsTrigger>
            <TabsTrigger value="statusreport" title="Status Report" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <BarChart2 className="h-4 w-4" />
              <span className="hidden md:block text-xs">Status Report</span>
            </TabsTrigger>
            <TabsTrigger value="logs" title="Logs" className="flex flex-col items-center gap-1 min-w-[56px] px-2 py-2">
              <FileText className="h-4 w-4" />
              <span className="hidden md:block text-xs">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboardView />
          </TabsContent>
          <TabsContent value="cadastros">
            <AdminCadastros />
          </TabsContent>
          <TabsContent value="agendas">
            <AdminAgendas />
          </TabsContent>
          <TabsContent value="relatorio">
            <AdminRelatorio />
          </TabsContent>
          <TabsContent value="workflows">
            <AdminWorkflows />
          </TabsContent>
          <TabsContent value="statusreport">
            <AdminStatusReport />
          </TabsContent>
          <TabsContent value="logs">
            <AdminIntegrationLogs />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
