import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, Send, Settings, Receipt, ShieldCheck, Copy, RefreshCw, Link2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { sendEmail } from "@/services/emailService";
import aceexLogo from "@/assets/aceex_logo.jpg";

interface Integracao {
  id: string;
  codigo: string;
  descricao: string;
  direcao: string;
  api_key: string;
  ativo: boolean;
  webhook_path: string;
  endpoint: string;
  payload_exemplo: any;
  guia_integracao: string | null;
}

export default function EmailSettingsPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [savingAppSettings, setSavingAppSettings] = useState(false);
  const [runningExpenses, setRunningExpenses] = useState(false);

  // Monday integration
  const [showMondayKey, setShowMondayKey] = useState(false);
  const [testingMonday, setTestingMonday] = useState(false);
  const [mondayConectado, setMondayConectado] = useState(false);

  // SharePoint integration
  const [showSharePointSecret, setShowSharePointSecret] = useState(false);
  const [testingSharePoint, setTestingSharePoint] = useState(false);
  const [sharePointConectado, setSharePointConectado] = useState(false);
  // Autentique integration
  const [showAutentiqueKey, setShowAutentiqueKey] = useState(false);
  const [testingAutentique, setTestingAutentique] = useState(false);
  const [autentiqueConectado, setAutentiqueConectado] = useState(false);

  // Integrations
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loadingInteg, setLoadingInteg] = useState(true);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [integDialog, setIntegDialog] = useState(false);
  const [editingInteg, setEditingInteg] = useState<Integracao | null>(null);
  const [savingInteg, setSavingInteg] = useState(false);
  const [integForm, setIntegForm] = useState({ codigo: "", descricao: "", direcao: "Recebe", webhook_path: "", endpoint: "", payload_exemplo: "", guia_integracao: "" });

  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_security: "STARTTLS",
    smtp_user: "",
    smtp_password: "",
  });

  const [appSettings, setAppSettings] = useState({
    despesas_email_responsavel: "",
    despesas_data_fechamento: "25",
    regras_data_limite_apontamento: "5",
    monday_ativo: "false",
    monday_api_key: "",
    monday_workspace_id: "",
    sharepoint_ativo: "false",
    sharepoint_tenant_id: "",
    sharepoint_client_id: "",
    sharepoint_client_secret: "",
    sharepoint_site_url: "",
    autentique_api_key: "",
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    loadSettings();
    loadAppSettings();
    loadIntegracoes();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data && !error) {
      setSettingsId(data.id);
      setForm({
        sender_name: data.sender_name || "",
        sender_email: data.sender_email || "",
        smtp_host: data.smtp_host || "",
        smtp_port: data.smtp_port || 587,
        smtp_security: data.smtp_security || "STARTTLS",
        smtp_user: data.smtp_user || "",
        smtp_password: data.smtp_password || "",
      });
      setIsConfigured(!!(data.smtp_host && data.smtp_user && data.smtp_password));
    }
    setLoading(false);
  };

  const loadAppSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["despesas_email_responsavel", "despesas_data_fechamento", "regras_data_limite_apontamento", "monday_ativo", "monday_api_key", "monday_workspace_id", "sharepoint_ativo", "sharepoint_tenant_id", "sharepoint_client_id", "sharepoint_client_secret", "sharepoint_site_url", "autentique_api_key"]);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r) => { map[r.key] = r.value; });
      setAppSettings((prev) => ({ ...prev, ...map }));
    }
  };

  const loadIntegracoes = async () => {
    setLoadingInteg(true);
    const { data } = await supabase.from("protheus_integracoes").select("*").order("codigo");
    if (data) setIntegracoes(data as any);
    setLoadingInteg(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const handleRegenerateKey = async (integ: Integracao) => {
    const newKey = crypto.randomUUID();
    await supabase.from("protheus_integracoes").update({ api_key: newKey } as any).eq("id", integ.id);
    setIntegracoes((prev) => prev.map((i) => (i.id === integ.id ? { ...i, api_key: newKey } : i)));
    toast({ title: "API Key regenerada!" });
  };

  const handleToggleAtivo = async (integ: Integracao) => {
    await supabase.from("protheus_integracoes").update({ ativo: !integ.ativo } as any).eq("id", integ.id);
    setIntegracoes((prev) => prev.map((i) => (i.id === integ.id ? { ...i, ativo: !i.ativo } : i)));
    toast({ title: integ.ativo ? "Integração desativada" : "Integração ativada" });
  };

  const handleDeleteInteg = async (integ: Integracao) => {
    if (!confirm(`Deseja excluir a integração ${integ.codigo} - ${integ.descricao}?`)) return;
    await supabase.from("protheus_integracoes").delete().eq("id", integ.id);
    setIntegracoes((prev) => prev.filter((i) => i.id !== integ.id));
    toast({ title: "Integração removida" });
  };

  const openNewInteg = () => {
    setEditingInteg(null);
    setIntegForm({ codigo: "", descricao: "", direcao: "Recebe", webhook_path: "", endpoint: "", payload_exemplo: "", guia_integracao: "" });
    setIntegDialog(true);
  };

  const openEditInteg = (integ: Integracao) => {
    setEditingInteg(integ);
    setIntegForm({
      codigo: integ.codigo,
      descricao: integ.descricao,
      direcao: integ.direcao,
      webhook_path: integ.webhook_path || "",
      endpoint: integ.endpoint || "",
      payload_exemplo: integ.payload_exemplo ? JSON.stringify(integ.payload_exemplo, null, 2) : "",
      guia_integracao: integ.guia_integracao || "",
    });
    setIntegDialog(true);
  };

  const handleSaveInteg = async () => {
    if (!integForm.codigo || !integForm.descricao) {
      toast({ title: "Código e descrição são obrigatórios", variant: "destructive" });
      return;
    }
    setSavingInteg(true);
    try {
      let payloadJson = null;
      if (integForm.payload_exemplo.trim()) {
        try {
          payloadJson = JSON.parse(integForm.payload_exemplo);
        } catch {
          toast({ title: "JSON do payload inválido", variant: "destructive" });
          setSavingInteg(false);
          return;
        }
      }

      const record: any = {
        codigo: integForm.codigo,
        descricao: integForm.descricao,
        direcao: integForm.direcao,
        webhook_path: integForm.webhook_path,
        endpoint: integForm.endpoint || "",
        payload_exemplo: payloadJson,
        guia_integracao: integForm.guia_integracao || null,
      };

      if (editingInteg) {
        const { error } = await supabase.from("protheus_integracoes").update(record).eq("id", editingInteg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("protheus_integracoes").insert(record);
        if (error) throw error;
      }

      await loadIntegracoes();
      setIntegDialog(false);
      toast({ title: editingInteg ? "Integração atualizada!" : "Integração criada!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingInteg(false);
  };

  const handleSaveAppSettings = async () => {
    setSavingAppSettings(true);
    try {
      for (const [key, value] of Object.entries(appSettings)) {
        await supabase.from("app_settings").update({ value }).eq("key", key);
      }
      toast({ title: "Configurações salvas com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    }
    setSavingAppSettings(false);
  };

  const handleRunExpenses = async () => {
    setRunningExpenses(true);
    try {
      const { data, error } = await supabase.functions.invoke("monthly-expenses-scheduler", { body: { force: true } });
      if (error) throw error;
      const result = data as { success: boolean; logs?: any[]; message?: string; error?: string };
      if (result.success) {
        const logCount = result.logs?.length ?? 0;
        const successCount = result.logs?.filter((l: any) => l.status === "sucesso").length ?? 0;
        toast({
          title: "Rotina executada com sucesso!",
          description: logCount > 0
            ? `${successCount} de ${logCount} usuário(s) processado(s).`
            : "Rotina manual executada. Nenhuma despesa elegível encontrada para envio.",
        });
      } else {
        toast({ title: "Erro na rotina", description: result.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao executar rotina", description: err.message, variant: "destructive" });
    }
    setRunningExpenses(false);
  };

  const handleTestMonday = async () => {
    const apiKey = appSettings.monday_api_key?.trim();
    const workspaceId = appSettings.monday_workspace_id?.trim();
    if (!apiKey || !workspaceId) {
      toast({ title: "Preencha API Key e Workspace ID antes de testar", variant: "destructive" });
      return;
    }
    setTestingMonday(true);
    try {
      const { data, error } = await supabase.functions.invoke("monday-test-connection");
      if (error) throw error;
      if (data?.success) {
        setMondayConectado(true);
        toast({ title: "Conexão Monday OK", description: `Workspace: ${data.workspace_name}` });
      } else {
        setMondayConectado(false);
        toast({ title: "Conexão falhou", description: data?.error || "Verifique a API Key e o Workspace ID.", variant: "destructive" });
      }
    } catch (err: any) {
      setMondayConectado(false);
      toast({ title: "Erro ao testar conexão Monday", description: err.message, variant: "destructive" });
    }
    setTestingMonday(false);
  };

  const handleTestSharePoint = async () => {
    const tenantId = appSettings.sharepoint_tenant_id?.trim();
    const clientId = appSettings.sharepoint_client_id?.trim();
    const clientSecret = appSettings.sharepoint_client_secret?.trim();
    const siteUrl = appSettings.sharepoint_site_url?.trim();
    if (!tenantId || !clientId || !clientSecret || !siteUrl) {
      toast({ title: "Preencha todos os campos antes de testar", variant: "destructive" });
      return;
    }
    setTestingSharePoint(true);
    try {
      const { data, error } = await supabase.functions.invoke("sharepoint-upload", {
        body: JSON.stringify({ action: "test" }),
      });
      if (error) throw error;
      if (data?.success) {
        setSharePointConectado(true);
        toast({ title: "Conexão SharePoint OK", description: `Site: ${siteUrl}` });
      } else {
        setSharePointConectado(false);
        toast({ title: "Conexão falhou", description: data?.error || "Verifique as credenciais.", variant: "destructive" });
      }
    } catch (err: any) {
      setSharePointConectado(false);
      toast({ title: "Erro ao testar SharePoint", description: err.message, variant: "destructive" });
    }
    setTestingSharePoint(false);
  };

  const handleTestAutentique = async () => {
    const apiKey = appSettings.autentique_api_key?.trim();
    if (!apiKey) {
      toast({ title: "Preencha a chave de API antes de testar", variant: "destructive" });
      return;
    }
    setTestingAutentique(true);
    try {
      const res = await fetch("https://api.autentique.com.br/2/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query: "{ me { name email } }" }),
      });
      const data = await res.json();
      if (data?.data?.me?.email) {
        setAutentiqueConectado(true);
        toast({ title: "Conexão Autentique OK", description: `Usuário: ${data.data.me.name} (${data.data.me.email})` });
      } else {
        setAutentiqueConectado(false);
        toast({ title: "Conexão falhou", description: "Verifique a chave de API.", variant: "destructive" });
      }
    } catch (err: any) {
      setAutentiqueConectado(false);
      toast({ title: "Erro ao testar Autentique", description: err.message, variant: "destructive" });
    }
    setTestingAutentique(false);
  };

  const handleSave = async () => {
    if (!form.smtp_host || !form.smtp_user || !form.smtp_password || !form.sender_email) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (settingsId) {
        const { error } = await supabase.from("email_settings").update(form).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("email_settings").insert(form).select().single();
        if (error) throw error;
        setSettingsId(data.id);
      }
      setIsConfigured(true);
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!isConfigured) {
      toast({ title: "Salve as configurações primeiro", variant: "destructive" });
      return;
    }
    setTesting(true);
    const result = await sendEmail({
      to: form.sender_email,
      subject: "Teste de Configuração SMTP - Aceex",
      body: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
        <h2 style="color:#333">✅ Teste de Email</h2>
        <p>As configurações SMTP estão funcionando corretamente!</p>
        <p style="color:#888;font-size:12px">Enviado em ${new Date().toLocaleString("pt-BR")}</p>
      </div>`,
    });
    if (result.success) {
      toast({ title: "Email de teste enviado!", description: `Verifique ${form.sender_email}` });
    } else {
      toast({ title: "Erro no teste", description: result.error, variant: "destructive" });
    }
    setTesting(false);
  };

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildWebhookUrl = (path: string) => path ? `${supabaseUrl}/functions/v1/${path}` : "";

  const buildGuide = (integ: Integracao) => {
    const url = buildWebhookUrl(integ.webhook_path);
    const payload = integ.payload_exemplo ? JSON.stringify(integ.payload_exemplo, null, 2) : "{}";
    return `Endpoint: POST ${url}

Headers:
  Content-Type: application/json
  x-api-key: <api_key>

Body:
${payload}

${integ.guia_integracao || ""}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <img src={aceexLogo} alt="Grupo ACEEX" className="h-8 object-contain" />
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Email, integrações e regras gerais</p>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> SMTP Configurado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> SMTP Não configurado
              </span>
            )}
          </div>
        </div>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remetente</CardTitle>
            <CardDescription>Informações que aparecerão como remetente nos emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sender_name">Nome do remetente</Label>
                <Input id="sender_name" placeholder="Ex: Suporte Aceex" value={form.sender_name} onChange={(e) => updateField("sender_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender_email">Email remetente *</Label>
                <Input id="sender_email" type="email" placeholder="contato@empresa.com" value={form.sender_email} onChange={(e) => updateField("sender_email", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Servidor SMTP</CardTitle>
            <CardDescription>Configurações de conexão com o servidor de email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">Servidor SMTP *</Label>
                <Input id="smtp_host" placeholder="smtp.gmail.com" value={form.smtp_host} onChange={(e) => updateField("smtp_host", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">Porta *</Label>
                  <Input id="smtp_port" type="number" value={form.smtp_port} onChange={(e) => updateField("smtp_port", parseInt(e.target.value) || 587)} />
                </div>
                <div className="space-y-2">
                  <Label>Segurança</Label>
                  <Select value={form.smtp_security} onValueChange={(v) => updateField("smtp_security", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                      <SelectItem value="SSL/TLS">SSL/TLS</SelectItem>
                      <SelectItem value="Nenhuma">Nenhuma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_user">Usuário SMTP *</Label>
                <Input id="smtp_user" placeholder="seu@email.com" value={form.smtp_user} onChange={(e) => updateField("smtp_user", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_password">Senha SMTP *</Label>
                <div className="relative">
                  <Input
                    id="smtp_password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.smtp_password}
                    onChange={(e) => updateField("smtp_password", e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Configurações SMTP
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !isConfigured}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
        </div>

        {/* Integrações Protheus */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Integrações Protheus
                </CardTitle>
                <CardDescription>Cadastre e gerencie as APIs de integração com o Protheus</CardDescription>
              </div>
              <Button size="sm" onClick={openNewInteg}>
                <Plus className="h-4 w-4 mr-1" /> Nova
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingInteg ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : integracoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma integração cadastrada</p>
            ) : (
              <div className="space-y-4">
                {integracoes.map((integ) => (
                  <div key={integ.id} className={`border rounded-lg p-4 space-y-3 ${!integ.ativo ? "opacity-60" : ""}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{integ.codigo}</span>
                        <span className="text-sm">{integ.descricao}</span>
                        <Badge variant={integ.direcao === "Recebe" ? "default" : integ.direcao === "Envia" ? "secondary" : "outline"}>
                          {integ.direcao}
                        </Badge>
                        {!integ.ativo && <Badge variant="destructive">Inativa</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleAtivo(integ)} title={integ.ativo ? "Desativar" : "Ativar"}>
                          {integ.ativo ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditInteg(integ)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteInteg(integ)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {integ.webhook_path && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                        <div className="flex gap-2">
                          <Input value={buildWebhookUrl(integ.webhook_path)} readOnly className="font-mono text-xs h-8" />
                          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(buildWebhookUrl(integ.webhook_path), "URL")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {integ.direcao === "Envia" && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Endpoint Protheus</Label>
                        <div className="flex gap-2">
                          <Input
                            value={integ.endpoint || ""}
                            placeholder="https://protheus.exemplo.com/api/..."
                            className="font-mono text-xs h-8"
                            onChange={async (e) => {
                              const newEndpoint = e.target.value;
                              setIntegracoes((prev) => prev.map((i) => (i.id === integ.id ? { ...i, endpoint: newEndpoint } : i)));
                            }}
                            onBlur={async (e) => {
                              await supabase.from("protheus_integracoes").update({ endpoint: e.target.value } as any).eq("id", integ.id);
                              toast({ title: "Endpoint salvo!" });
                            }}
                          />
                          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(integ.endpoint || "", "Endpoint")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input value={integ.api_key} readOnly type={showApiKeys[integ.id] ? "text" : "password"} className="font-mono text-xs h-8 pr-10" />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-8" onClick={() => setShowApiKeys((prev) => ({ ...prev, [integ.id]: !prev[integ.id] }))}>
                            {showApiKeys[integ.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(integ.api_key, "API Key")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRegenerateKey(integ)}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <Accordion type="single" collapsible>
                      <AccordionItem value="guide" className="border-0">
                        <AccordionTrigger className="text-xs py-1">Guia de Integração</AccordionTrigger>
                        <AccordionContent>
                          <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                            {buildGuide(integ)}
                          </pre>
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => copyToClipboard(buildGuide(integ), "Guia")}>
                            <Copy className="h-3 w-3 mr-1" /> Copiar guia
                          </Button>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Despesas Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Despesas
            </CardTitle>
            <CardDescription>Configurações pertinentes à rotina de despesas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="despesas_email">Email responsável</Label>
                <Input id="despesas_email" type="email" placeholder="financeiro@empresa.com" value={appSettings.despesas_email_responsavel} onChange={(e) => setAppSettings((prev) => ({ ...prev, despesas_email_responsavel: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="despesas_fechamento">Data de fechamento (dia do mês)</Label>
                <Input id="despesas_fechamento" type="number" min={1} max={28} placeholder="25" value={appSettings.despesas_data_fechamento} onChange={(e) => { const v = Math.min(28, Math.max(1, parseInt(e.target.value) || 1)); setAppSettings((prev) => ({ ...prev, despesas_data_fechamento: String(v) })); }} />
                <p className="text-xs text-muted-foreground">Valor entre 01 e 28</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Envio de Despesas</p>
                  <p className="text-xs text-muted-foreground">Executa manualmente a rotina de fechamento mensal</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRunExpenses} disabled={runningExpenses}>
                  {runningExpenses ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {runningExpenses ? "Executando..." : "Executar Agora"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regras Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Regras
            </CardTitle>
            <CardDescription>Regras gerais da aplicação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="sm:w-1/2">
              <div className="space-y-2">
                <Label htmlFor="regras_limite">Data limite de apontamento (dias)</Label>
                <Input id="regras_limite" type="number" min={1} max={99} placeholder="5" value={appSettings.regras_data_limite_apontamento} onChange={(e) => { const v = Math.min(99, Math.max(1, parseInt(e.target.value) || 1)); setAppSettings((prev) => ({ ...prev, regras_data_limite_apontamento: String(v) })); }} />
                <p className="text-xs text-muted-foreground">Número de dias (2 dígitos)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integração Monday */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Integ. Monday
              {appSettings.monday_ativo === "true" ? (
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Ativo</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
              )}
            </CardTitle>
            <CardDescription>Integração com o Monday.com para sincronização de projetos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle de ativação */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Integração Monday</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, projetos criados ou editados são automaticamente sincronizados com o Monday.com
                </p>
              </div>
              <div className="flex items-center gap-2">
                {appSettings.monday_ativo === "true" ? (
                  <ToggleRight className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  checked={appSettings.monday_ativo === "true"}
                  onCheckedChange={(checked) =>
                    setAppSettings((prev) => ({ ...prev, monday_ativo: checked ? "true" : "false" }))
                  }
                />
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>API Key (Personal Token)</Label>
              <div className="relative">
                <Input
                  type={showMondayKey ? "text" : "password"}
                  placeholder="Insira o Personal Token do Monday"
                  value={appSettings.monday_api_key}
                  onChange={(e) => setAppSettings((prev) => ({ ...prev, monday_api_key: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowMondayKey(!showMondayKey)}
                >
                  {showMondayKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Obter em: monday.com → avatar → Developers → My Access Tokens
              </p>
            </div>

            {/* Workspace ID */}
            <div className="space-y-2">
              <Label>Workspace ID</Label>
              <Input
                type="text"
                placeholder="Ex: 1234567890"
                value={appSettings.monday_workspace_id}
                onChange={(e) => setAppSettings((prev) => ({ ...prev, monday_workspace_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                ID numérico do workspace. Visível na URL: monday.com/workspaces/&#123;ID&#125;
              </p>
            </div>

            {/* Status e teste */}
            <div className="flex items-center justify-between">
              <div>
                {mondayConectado ? (
                  <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Não testado</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestMonday}
                disabled={testingMonday}
              >
                {testingMonday ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Testar conexão
              </Button>
            </div>

            {/* Botão salvar */}
            <Button onClick={handleSaveAppSettings} disabled={savingAppSettings} className="w-full">
              {savingAppSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar configurações Monday
            </Button>
          </CardContent>
        </Card>

        {/* Integração SharePoint */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Integ. SharePoint
              {appSettings.sharepoint_ativo === "true" ? (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ativo</span>
              ) : (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>
              )}
            </CardTitle>
            <CardDescription>Integração com o SharePoint para armazenamento de documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Integração SharePoint</Label>
                <p className="text-xs text-muted-foreground">Quando ativo, documentos são enviados automaticamente ao SharePoint</p>
              </div>
              {appSettings.sharepoint_ativo === "true" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <Switch
                checked={appSettings.sharepoint_ativo === "true"}
                onCheckedChange={(checked) =>
                  setAppSettings((prev) => ({ ...prev, sharepoint_ativo: checked ? "true" : "false" }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tenant ID</Label>
              <Input
                placeholder="Ex: 80886ff3-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={appSettings.sharepoint_tenant_id}
                onChange={(e) => setAppSettings((prev) => ({ ...prev, sharepoint_tenant_id: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client ID</Label>
              <Input
                placeholder="Ex: df100512-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={appSettings.sharepoint_client_id}
                onChange={(e) => setAppSettings((prev) => ({ ...prev, sharepoint_client_id: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Client Secret</Label>
              <div className="relative">
                <Input
                  type={showSharePointSecret ? "text" : "password"}
                  placeholder="Client Secret do app Azure AD"
                  value={appSettings.sharepoint_client_secret}
                  onChange={(e) => setAppSettings((prev) => ({ ...prev, sharepoint_client_secret: e.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSharePointSecret(!showSharePointSecret)}
                >
                  {showSharePointSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Site URL</Label>
              <Input
                placeholder="Ex: https://empresa.sharepoint.com/sites/projetos"
                value={appSettings.sharepoint_site_url}
                onChange={(e) => setAppSettings((prev) => ({ ...prev, sharepoint_site_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">URL do site SharePoint onde os documentos serão armazenados</p>
            </div>
            <div className="flex items-center gap-2">
              {sharePointConectado ? (
                <span className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Conectado
                </span>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleTestSharePoint} disabled={testingSharePoint}>
                {testingSharePoint ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Testar conexão
              </Button>
            </div>
            <Button onClick={handleSaveAppSettings} disabled={savingAppSettings} className="w-full">
              {savingAppSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar configurações SharePoint
            </Button>
          </CardContent>
        </Card>

        {/* Integração Autentique */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Integ. Autentique
              {appSettings.autentique_api_key ? (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Configurado</span>
              ) : (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Não configurado</span>
              )}
            </CardTitle>
            <CardDescription>Integração com o Autentique para assinaturas eletrônicas de documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Chave de API</Label>
              <div className="relative">
                <Input
                  type={showAutentiqueKey ? "text" : "password"}
                  placeholder="Chave de API do Autentique"
                  value={appSettings.autentique_api_key}
                  onChange={(e) => setAppSettings((prev) => ({ ...prev, autentique_api_key: e.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowAutentiqueKey(!showAutentiqueKey)}
                >
                  {showAutentiqueKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Obter em: painel.autentique.com.br → Perfil → Chaves de API</p>
            </div>
            <div className="flex items-center gap-2">
              {autentiqueConectado ? (
                <span className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Conectado
                </span>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleTestAutentique} disabled={testingAutentique}>
                {testingAutentique ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Testar conexão
              </Button>
            </div>
            <Button onClick={handleSaveAppSettings} disabled={savingAppSettings} className="w-full">
              {savingAppSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar configurações Autentique
            </Button>
          </CardContent>
        </Card>

        <Button onClick={handleSaveAppSettings} disabled={savingAppSettings} className="w-full">
          {savingAppSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar Configurações Gerais
        </Button>
      </main>

      {/* Dialog para criar/editar integração */}
      <Dialog open={integDialog} onOpenChange={setIntegDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInteg ? "Editar Integração" : "Nova Integração"}</DialogTitle>
            <DialogDescription>Preencha os dados da integração com o Protheus</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input placeholder="0002" value={integForm.codigo} onChange={(e) => setIntegForm((p) => ({ ...p, codigo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Direcionamento *</Label>
                <Select value={integForm.direcao} onValueChange={(v) => {
                  const updates: any = { direcao: v };
                  if (v === "Envia") updates.webhook_path = "";
                  if (v === "Recebe") updates.endpoint = "";
                  setIntegForm((p) => ({ ...p, ...updates }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recebe">Recebe</SelectItem>
                    <SelectItem value="Envia">Envia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input placeholder="Integ. User" value={integForm.descricao} onChange={(e) => setIntegForm((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            {integForm.direcao === "Recebe" && (
            <div className="space-y-2">
              <Label>Webhook Path (nome da função)</Label>
              <Input placeholder="protheus-users" value={integForm.webhook_path} onChange={(e) => setIntegForm((p) => ({ ...p, webhook_path: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Nome da edge function que será chamada</p>
            </div>
            )}
            {integForm.direcao === "Envia" && (
              <div className="space-y-2">
                <Label>Endpoint Protheus</Label>
                <Input placeholder="https://protheus.exemplo.com/api/agendas" value={integForm.endpoint} onChange={(e) => setIntegForm((p) => ({ ...p, endpoint: e.target.value }))} />
                <p className="text-xs text-muted-foreground">URL do endpoint externo para envio de dados</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Payload Exemplo (JSON)</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                placeholder='{"campo": "valor"}'
                value={integForm.payload_exemplo}
                onChange={(e) => setIntegForm((p) => ({ ...p, payload_exemplo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Guia / Observações</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px]"
                placeholder="Instruções adicionais para o desenvolvedor"
                value={integForm.guia_integracao}
                onChange={(e) => setIntegForm((p) => ({ ...p, guia_integracao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntegDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveInteg} disabled={savingInteg}>
              {savingInteg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
