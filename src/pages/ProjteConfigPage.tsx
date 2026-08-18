import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Building2, LogOut, Image as ImageIcon, Server, KeyRound, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Provisório (Etapa 3): painel de controle interno da PROJTE, decoplado do produto Aceex.
// Lê/escreve no schema `projte_config` (dentro do projeto Aceex Production por enquanto —
// ver docs/etapa3-config-projte.md). Acesso gated por projte_config.usuarios_autorizados,
// checado no AuthContext (isProjteAuthorized), não pelo app_role do produto.

interface Cliente {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  logo_url: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  email_suporte: string | null;
  telefone_suporte: string | null;
  responsavel_nome: string | null;
  responsavel_cargo: string | null;
  responsavel_email: string | null;
  responsavel_telefone: string | null;
  plano_contratado: string | null;
  data_inicio_contrato: string | null;
  observacoes_comerciais: string | null;
  status: "prospect" | "ativo" | "suspenso" | "cancelado";
}

interface Ambiente {
  id: string;
  cliente_id: string;
  tipo: "qa" | "producao";
  supabase_project_ref: string | null;
  supabase_project_url: string | null;
  frontend_url: string | null;
  status: "nao_provisionado" | "provisionando" | "ativo" | "erro" | "pausado";
  template_release_id: string | null;
  notas: string | null;
}

interface AmbienteSecret {
  id: string;
  ambiente_id: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
}

interface TemplateRelease {
  id: string;
  versao: string;
}

const SECRET_TIPOS = ["service_role_key", "anon_key", "db_password", "management_token", "monitor_credentials", "outro"];

const emptyForm = {
  nome_fantasia: "",
  razao_social: "",
  cnpj: "",
  logo_url: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_complemento: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_uf: "",
  endereco_cep: "",
  email_suporte: "",
  telefone_suporte: "",
  responsavel_nome: "",
  responsavel_cargo: "",
  responsavel_email: "",
  responsavel_telefone: "",
  plano_contratado: "",
  data_inicio_contrato: "",
  observacoes_comerciais: "",
  status: "prospect" as Cliente["status"],
};

const statusLabel: Record<Cliente["status"], string> = {
  prospect: "Prospect",
  ativo: "Ativo",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

const statusColor: Record<Cliente["status"], string> = {
  prospect: "bg-blue-100 text-blue-800",
  ativo: "bg-emerald-100 text-emerald-800",
  suspenso: "bg-amber-100 text-amber-800",
  cancelado: "bg-red-100 text-red-800",
};

const projteConfig = () => (supabase as any).schema("projte_config");

export default function ProjteConfigPage() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [ambienteSecrets, setAmbienteSecrets] = useState<Record<string, AmbienteSecret[]>>({});
  const [templateReleases, setTemplateReleases] = useState<TemplateRelease[]>([]);
  const [loadingAmbientes, setLoadingAmbientes] = useState(false);
  const [savingAmbiente, setSavingAmbiente] = useState<string | null>(null);
  const [savingSecret, setSavingSecret] = useState<string | null>(null);
  const [secretForms, setSecretForms] = useState<Record<string, { tipo: string; valor: string; descricao: string }>>({});
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{ label: string; relatorio: any } | null>(null);
  const [runningCamada3, setRunningCamada3] = useState<string | null>(null);
  const [runningCamada4, setRunningCamada4] = useState<string | null>(null);

  useEffect(() => {
    loadClientes();
    loadTemplateReleases();
  }, []);

  const loadTemplateReleases = async () => {
    const { data } = await projteConfig()
      .from("template_releases")
      .select("id, versao")
      .order("publicado_em", { ascending: false });
    setTemplateReleases((data as TemplateRelease[]) ?? []);
  };

  const loadAmbientes = async (clienteId: string) => {
    setLoadingAmbientes(true);
    const { data: ambData } = await projteConfig()
      .from("ambientes")
      .select("*")
      .eq("cliente_id", clienteId);
    const amb = (ambData as Ambiente[]) ?? [];
    setAmbientes(amb);

    if (amb.length > 0) {
      const { data: secData } = await projteConfig()
        .from("ambiente_secrets")
        .select("id, ambiente_id, tipo, descricao, created_at")
        .in("ambiente_id", amb.map((a) => a.id));
      const grouped: Record<string, AmbienteSecret[]> = {};
      ((secData as AmbienteSecret[]) ?? []).forEach((s) => {
        grouped[s.ambiente_id] = [...(grouped[s.ambiente_id] || []), s];
      });
      setAmbienteSecrets(grouped);
    } else {
      setAmbienteSecrets({});
    }
    setLoadingAmbientes(false);
  };

  const ensureAmbiente = async (clienteId: string, tipo: "qa" | "producao") => {
    setSavingAmbiente(tipo);
    const { data, error } = await projteConfig()
      .from("ambientes")
      .insert({ cliente_id: clienteId, tipo, status: "nao_provisionado" })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar ambiente", description: error.message, variant: "destructive" });
    } else {
      setAmbientes((prev) => [...prev, data as Ambiente]);
    }
    setSavingAmbiente(null);
  };

  const updateAmbienteLocal = (id: string, patch: Partial<Ambiente>) => {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const saveAmbiente = async (amb: Ambiente) => {
    setSavingAmbiente(amb.tipo);
    const { error } = await projteConfig()
      .from("ambientes")
      .update({
        supabase_project_ref: amb.supabase_project_ref || null,
        supabase_project_url: amb.supabase_project_url || null,
        frontend_url: amb.frontend_url || null,
        status: amb.status,
        template_release_id: amb.template_release_id || null,
        notas: amb.notas || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", amb.id);
    if (error) {
      toast({ title: "Erro ao salvar ambiente", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Ambiente ${amb.tipo === "qa" ? "QA" : "Produção"} salvo` });
    }
    setSavingAmbiente(null);
  };

  const getSecretForm = (ambienteId: string) =>
    secretForms[ambienteId] || { tipo: "service_role_key", valor: "", descricao: "" };

  const updateSecretForm = (ambienteId: string, patch: Partial<{ tipo: string; valor: string; descricao: string }>) => {
    setSecretForms((prev) => ({ ...prev, [ambienteId]: { ...getSecretForm(ambienteId), ...patch } }));
  };

  const handleSaveSecret = async (ambienteId: string) => {
    const form = getSecretForm(ambienteId);
    if (!form.valor.trim()) {
      toast({ title: "Informe o valor do segredo", variant: "destructive" });
      return;
    }
    setSavingSecret(ambienteId);
    try {
      const { data, error } = await supabase.functions.invoke("projte-manage-secret", {
        body: { ambiente_id: ambienteId, tipo: form.tipo, valor: form.valor, descricao: form.descricao },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: "Segredo salvo no Vault" });
      setSecretForms((prev) => ({ ...prev, [ambienteId]: { tipo: "service_role_key", valor: "", descricao: "" } }));

      const { data: secData } = await projteConfig()
        .from("ambiente_secrets")
        .select("id, ambiente_id, tipo, descricao, created_at")
        .eq("ambiente_id", ambienteId);
      setAmbienteSecrets((prev) => ({ ...prev, [ambienteId]: (secData as AmbienteSecret[]) ?? [] }));
    } catch (err: any) {
      toast({ title: "Erro ao salvar segredo", description: err.message, variant: "destructive" });
    }
    setSavingSecret(null);
  };

  const handleRemoveSecret = async (ambienteId: string, tipo: string) => {
    if (!confirm("Remover esse segredo do Vault? Essa ação não pode ser desfeita.")) return;
    try {
      const { data, error } = await supabase.functions.invoke("projte-manage-secret", {
        body: { action: "remove", ambiente_id: ambienteId, tipo },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setAmbienteSecrets((prev) => ({
        ...prev,
        [ambienteId]: (prev[ambienteId] || []).filter((s) => s.tipo !== tipo),
      }));
      toast({ title: "Segredo removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover segredo", description: err.message, variant: "destructive" });
    }
  };

  const handleProvisionAmbiente = async (amb: Ambiente) => {
    if (!amb.supabase_project_ref?.trim() || !amb.supabase_project_url?.trim()) {
      toast({ title: "Preencha e salve o project ref e a URL antes de criar o ambiente", variant: "destructive" });
      return;
    }
    const secrets = ambienteSecrets[amb.id] || [];
    if (!secrets.some((s) => s.tipo === "management_token")) {
      toast({ title: "Registre o management_token nos Segredos antes de criar o ambiente", variant: "destructive" });
      return;
    }
    const label = amb.tipo === "qa" ? "QA" : "Produção";
    if (
      !confirm(
        `Isso vai espelhar o schema do template PROJTE (sem dados) no projeto Supabase "${amb.supabase_project_ref}" (${label}). Pode levar alguns minutos. Continuar?`
      )
    ) {
      return;
    }

    setProvisioning(amb.id);
    updateAmbienteLocal(amb.id, { status: "provisionando" });
    try {
      const { data, error } = await supabase.functions.invoke("projte-provision-ambiente", {
        body: { ambiente_id: amb.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: `Ambiente ${label} provisionado`,
        description: `${(data as any)?.migrations_applied ?? 0} migrations aplicadas.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao criar ambiente", description: err.message, variant: "destructive" });
    }
    await loadAmbientes(amb.cliente_id);
    setProvisioning(null);
  };

  const handleCheckAmbiente = async (amb: Ambiente) => {
    if (!amb.supabase_project_ref?.trim()) {
      toast({ title: "Preencha e salve o project ref antes de verificar", variant: "destructive" });
      return;
    }
    const secrets = ambienteSecrets[amb.id] || [];
    if (!secrets.some((s) => s.tipo === "management_token")) {
      toast({ title: "Registre o management_token nos Segredos antes de verificar", variant: "destructive" });
      return;
    }
    const label = amb.tipo === "qa" ? "QA" : "Produção";
    setChecking(amb.id);
    try {
      const { data, error } = await supabase.functions.invoke("projte-check-ambiente", {
        body: { ambiente_id: amb.id },
      });
      if (error) throw error;
      setCheckResult({ label, relatorio: (data as any)?.relatorio ?? data });
    } catch (err: any) {
      toast({ title: "Erro ao verificar ambiente", description: err.message, variant: "destructive" });
    }
    setChecking(null);
  };

  const handleVerificarCamada3 = async (amb: Ambiente) => {
    if (!amb.frontend_url?.trim()) {
      toast({
        title: "Preencha o Frontend URL do ambiente",
        description: "Sem uma URL de frontend publicada, não há o que o Playwright abrir.",
        variant: "destructive",
      });
      return;
    }
    setRunningCamada3(amb.id);
    try {
      const { data, error } = await supabase.functions.invoke("projte-verificar-camada3", {
        body: { ambiente_id: amb.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const runUrl = (data as any)?.run_url as string | null;
      toast({
        title: "Verificação de camada 3 disparada",
        description: runUrl
          ? "Abrindo o acompanhamento no GitHub Actions em outra aba."
          : "Rodando no GitHub Actions (não consegui obter o link direto — confira na aba Actions do repositório).",
      });
      if (runUrl) window.open(runUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao disparar verificação de camada 3", description: err.message, variant: "destructive" });
    }
    setRunningCamada3(null);
  };

  const handleRodarSuiteCompleta = async (amb: Ambiente) => {
    if (!amb.frontend_url?.trim()) {
      toast({
        title: "Preencha o Frontend URL do ambiente",
        description: "Sem uma URL de frontend publicada, não há o que a suite abrir.",
        variant: "destructive",
      });
      return;
    }
    if (amb.status !== "ativo") {
      toast({
        title: "Ambiente não está ativo",
        description: "Rode 'Criar Ambiente' com sucesso antes de rodar a suite completa.",
        variant: "destructive",
      });
      return;
    }
    setRunningCamada4(amb.id);
    try {
      const { data, error } = await supabase.functions.invoke("projte-rodar-suite-completa", {
        body: { ambiente_id: amb.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const runUrl = (data as any)?.run_url as string | null;
      toast({
        title: "Suite completa (camada 4) disparada",
        description: runUrl
          ? "Deploy das functions + suite BL-020 completa (exceto IN002) rodando. Abrindo o acompanhamento no GitHub Actions."
          : "Rodando no GitHub Actions (não consegui obter o link direto — confira na aba Actions do repositório).",
      });
      if (runUrl) window.open(runUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao disparar suite completa", description: err.message, variant: "destructive" });
    }
    setRunningCamada4(null);
  };

  const loadClientes = async () => {
    setLoading(true);
    const { data, error } = await projteConfig()
      .from("clientes")
      .select("*")
      .order("nome_fantasia");
    if (error) {
      toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
    } else {
      setClientes((data as Cliente[]) ?? []);
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setAmbientes([]);
    setAmbienteSecrets({});
    setDialogOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    loadAmbientes(c.id);
    setForm({
      nome_fantasia: c.nome_fantasia || "",
      razao_social: c.razao_social || "",
      cnpj: c.cnpj || "",
      logo_url: c.logo_url || "",
      endereco_logradouro: c.endereco_logradouro || "",
      endereco_numero: c.endereco_numero || "",
      endereco_complemento: c.endereco_complemento || "",
      endereco_bairro: c.endereco_bairro || "",
      endereco_cidade: c.endereco_cidade || "",
      endereco_uf: c.endereco_uf || "",
      endereco_cep: c.endereco_cep || "",
      email_suporte: c.email_suporte || "",
      telefone_suporte: c.telefone_suporte || "",
      responsavel_nome: c.responsavel_nome || "",
      responsavel_cargo: c.responsavel_cargo || "",
      responsavel_email: c.responsavel_email || "",
      responsavel_telefone: c.responsavel_telefone || "",
      plano_contratado: c.plano_contratado || "",
      data_inicio_contrato: c.data_inicio_contrato || "",
      observacoes_comerciais: c.observacoes_comerciais || "",
      status: c.status || "prospect",
    });
    setDialogOpen(true);
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("clientes-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("clientes-assets").getPublicUrl(path);
      setForm((prev) => ({ ...prev, logo_url: data.publicUrl }));
      toast({ title: "Logo enviada" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar logo", description: err.message, variant: "destructive" });
    }
    setUploadingLogo(false);
  };

  const handleSave = async () => {
    if (!form.nome_fantasia.trim()) {
      toast({ title: "Nome fantasia é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const record: any = {
        ...form,
        razao_social: form.razao_social || null,
        cnpj: form.cnpj || null,
        logo_url: form.logo_url || null,
        endereco_logradouro: form.endereco_logradouro || null,
        endereco_numero: form.endereco_numero || null,
        endereco_complemento: form.endereco_complemento || null,
        endereco_bairro: form.endereco_bairro || null,
        endereco_cidade: form.endereco_cidade || null,
        endereco_uf: form.endereco_uf || null,
        endereco_cep: form.endereco_cep || null,
        email_suporte: form.email_suporte || null,
        telefone_suporte: form.telefone_suporte || null,
        responsavel_nome: form.responsavel_nome || null,
        responsavel_cargo: form.responsavel_cargo || null,
        responsavel_email: form.responsavel_email || null,
        responsavel_telefone: form.responsavel_telefone || null,
        plano_contratado: form.plano_contratado || null,
        data_inicio_contrato: form.data_inicio_contrato || null,
        observacoes_comerciais: form.observacoes_comerciais || null,
      };

      if (editing) {
        const { error } = await projteConfig().from("clientes").update(record).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado" });
      } else {
        const { error } = await projteConfig().from("clientes").insert(record);
        if (error) throw error;
        toast({ title: "Cliente criado" });
      }
      setDialogOpen(false);
      await loadClientes();
    } catch (err: any) {
      toast({ title: "Erro ao salvar cliente", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (c: Cliente) => {
    if (!confirm(`Excluir o cliente "${c.nome_fantasia}"? Isso também remove os ambientes vinculados a ele.`)) return;
    const { error } = await projteConfig().from("clientes").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setClientes((prev) => prev.filter((x) => x.id !== c.id));
    toast({ title: "Cliente removido" });
  };

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Config PROJTE</span>
            <Badge variant="outline" className="text-[10px]">provisório</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastro dos clientes da PROJTE. A partir daqui, futuramente, cada cliente terá seu próprio ambiente provisionado (QA + Produção).
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : clientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum cliente cadastrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt={c.nome_fantasia} className="h-6 w-6 rounded object-contain bg-muted" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                        {c.nome_fantasia}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.cnpj || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.responsavel_nome || "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusColor[c.status]}>{statusLabel[c.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>Cadastro completo do cliente da PROJTE.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="identificacao">Identificação</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
              <TabsTrigger value="ambientes">Ambientes</TabsTrigger>
            </TabsList>

            <TabsContent value="identificacao" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Fantasia *</Label>
                  <Input value={form.nome_fantasia} onChange={(e) => setForm((p) => ({ ...p, nome_fantasia: e.target.value }))} placeholder="Ex: Aceex" />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input value={form.razao_social} onChange={(e) => setForm((p) => ({ ...p, razao_social: e.target.value }))} placeholder="Ex: Aceex Consultoria Ltda" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-2">
                    {form.logo_url && <img src={form.logo_url} alt="logo" className="h-8 w-8 rounded object-contain bg-muted" />}
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={uploadingLogo}
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    />
                    {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Logradouro</Label>
                  <Input value={form.endereco_logradouro} onChange={(e) => setForm((p) => ({ ...p, endereco_logradouro: e.target.value }))} placeholder="Rua, Av..." />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={form.endereco_numero} onChange={(e) => setForm((p) => ({ ...p, endereco_numero: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={form.endereco_complemento} onChange={(e) => setForm((p) => ({ ...p, endereco_complemento: e.target.value }))} placeholder="Sala, andar..." />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.endereco_bairro} onChange={(e) => setForm((p) => ({ ...p, endereco_bairro: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Cidade</Label>
                  <Input value={form.endereco_cidade} onChange={(e) => setForm((p) => ({ ...p, endereco_cidade: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.endereco_uf} maxLength={2} onChange={(e) => setForm((p) => ({ ...p, endereco_uf: e.target.value.toUpperCase() }))} placeholder="SP" />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.endereco_cep} onChange={(e) => setForm((p) => ({ ...p, endereco_cep: e.target.value }))} placeholder="00000-000" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email de suporte</Label>
                  <Input type="email" value={form.email_suporte} onChange={(e) => setForm((p) => ({ ...p, email_suporte: e.target.value }))} placeholder="suporte@cliente.com" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone de suporte</Label>
                  <Input value={form.telefone_suporte} onChange={(e) => setForm((p) => ({ ...p, telefone_suporte: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Responsável pelo contrato</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={form.responsavel_nome} onChange={(e) => setForm((p) => ({ ...p, responsavel_nome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input value={form.responsavel_cargo} onChange={(e) => setForm((p) => ({ ...p, responsavel_cargo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.responsavel_email} onChange={(e) => setForm((p) => ({ ...p, responsavel_email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.responsavel_telefone} onChange={(e) => setForm((p) => ({ ...p, responsavel_telefone: e.target.value }))} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comercial" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as Cliente["status"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano contratado</Label>
                  <Input value={form.plano_contratado} onChange={(e) => setForm((p) => ({ ...p, plano_contratado: e.target.value }))} placeholder="Ex: Essencial, Pro..." />
                </div>
              </div>
              <div className="space-y-2 sm:w-1/2">
                <Label>Início do contrato</Label>
                <Input type="date" value={form.data_inicio_contrato} onChange={(e) => setForm((p) => ({ ...p, data_inicio_contrato: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Observações comerciais</Label>
                <Textarea rows={4} value={form.observacoes_comerciais} onChange={(e) => setForm((p) => ({ ...p, observacoes_comerciais: e.target.value }))} placeholder="Negociação, condições especiais, histórico..." />
              </div>
            </TabsContent>

            <TabsContent value="ambientes" className="space-y-4 pt-4">
              {!editing ? (
                <p className="text-sm text-muted-foreground">Salve o cadastro do cliente primeiro para gerenciar os ambientes dele.</p>
              ) : loadingAmbientes ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                (["qa", "producao"] as const).map((tipo) => {
                  const amb = ambientes.find((a) => a.tipo === tipo);
                  const label = tipo === "qa" ? "QA" : "Produção";

                  if (!amb) {
                    return (
                      <Card key={tipo}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Ambiente de {label} ainda não registrado</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => ensureAmbiente(editing.id, tipo)}
                            disabled={savingAmbiente === tipo}
                          >
                            {savingAmbiente === tipo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Registrar {label}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }

                  const secrets = ambienteSecrets[amb.id] || [];
                  const secretForm = getSecretForm(amb.id);

                  return (
                    <Card key={tipo}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Server className="h-4 w-4" /> {label}
                            <Badge variant="outline" className="text-[10px] font-normal">{amb.status}</Badge>
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => handleCheckAmbiente(amb)}
                              disabled={checking === amb.id}
                            >
                              {checking === amb.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Server className="h-4 w-4" />
                              )}
                              {checking === amb.id ? "Verificando..." : "Verificar Ambiente"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => handleVerificarCamada3(amb)}
                              disabled={runningCamada3 === amb.id || !amb.frontend_url?.trim()}
                              title={!amb.frontend_url?.trim() ? "Preencha o Frontend URL primeiro" : undefined}
                            >
                              {runningCamada3 === amb.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Server className="h-4 w-4" />
                              )}
                              {runningCamada3 === amb.id ? "Disparando..." : "Verificar Login (camada 3)"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => handleRodarSuiteCompleta(amb)}
                              disabled={runningCamada4 === amb.id || !amb.frontend_url?.trim() || amb.status !== "ativo"}
                              title={!amb.frontend_url?.trim() ? "Preencha o Frontend URL primeiro" : undefined}
                            >
                              {runningCamada4 === amb.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Server className="h-4 w-4" />
                              )}
                              {runningCamada4 === amb.id ? "Disparando..." : "Rodar Suite Completa (camada 4)"}
                            </Button>
                            <Button
                              size="sm"
                              variant={amb.status === "ativo" ? "outline" : "default"}
                              className="gap-2"
                              onClick={() => handleProvisionAmbiente(amb)}
                              disabled={provisioning === amb.id}
                            >
                              {provisioning === amb.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Rocket className="h-4 w-4" />
                              )}
                              {provisioning === amb.id
                                ? "Provisionando..."
                                : amb.status === "ativo"
                                  ? "Recriar Ambiente"
                                  : "Criar Ambiente"}
                            </Button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Espelha o schema do template PROJTE (sem dados) no projeto Supabase acima, usando o
                          management_token registrado nos Segredos.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Project ref</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              value={amb.supabase_project_ref || ""}
                              onChange={(e) => updateAmbienteLocal(amb.id, { supabase_project_ref: e.target.value })}
                              placeholder="abcdxyz"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Project URL</Label>
                            <Input
                              className="h-8 text-xs font-mono"
                              value={amb.supabase_project_url || ""}
                              onChange={(e) => updateAmbienteLocal(amb.id, { supabase_project_url: e.target.value })}
                              placeholder="https://abcdxyz.supabase.co"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Frontend URL (opcional)</Label>
                          <Input
                            className="h-8 text-xs font-mono"
                            value={amb.frontend_url || ""}
                            onChange={(e) => updateAmbienteLocal(amb.id, { frontend_url: e.target.value })}
                            placeholder="https://app-do-cliente.vercel.app (preencha quando existir um frontend publicado)"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Usado pela verificação de camada 3 (login real via Playwright). Sem essa URL, a
                            verificação só confere o backend (Supabase).
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={amb.status} onValueChange={(v) => updateAmbienteLocal(amb.id, { status: v as Ambiente["status"] })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nao_provisionado">Não provisionado</SelectItem>
                                <SelectItem value="provisionando">Provisionando</SelectItem>
                                <SelectItem value="ativo">Ativo</SelectItem>
                                <SelectItem value="erro">Erro</SelectItem>
                                <SelectItem value="pausado">Pausado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Release do template</Label>
                            <Select
                              value={amb.template_release_id || "none"}
                              onValueChange={(v) => updateAmbienteLocal(amb.id, { template_release_id: v === "none" ? null : v })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                {templateReleases.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.versao}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notas</Label>
                          <Textarea
                            rows={2}
                            className="text-xs"
                            value={amb.notas || ""}
                            onChange={(e) => updateAmbienteLocal(amb.id, { notas: e.target.value })}
                          />
                        </div>
                        <Button size="sm" onClick={() => saveAmbiente(amb)} disabled={savingAmbiente === tipo}>
                          {savingAmbiente === tipo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Salvar ambiente
                        </Button>

                        <div className="border-t pt-3 space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                            <KeyRound className="h-3 w-3" /> Segredos (Supabase Vault)
                          </p>
                          {secrets.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum segredo registrado.</p>
                          ) : (
                            <div className="space-y-1">
                              {secrets.map((s) => (
                                <div key={s.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1.5">
                                  <span className="font-mono">{s.tipo}{s.descricao ? ` — ${s.descricao}` : ""}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveSecret(amb.id, s.tipo)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            <Select value={secretForm.tipo} onValueChange={(v) => updateSecretForm(amb.id, { tipo: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SECRET_TIPOS.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 text-xs sm:col-span-2"
                              type="password"
                              placeholder="Valor do segredo"
                              value={secretForm.valor}
                              onChange={(e) => updateSecretForm(amb.id, { valor: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Input
                              className="h-8 text-xs flex-1"
                              placeholder="Descrição (opcional)"
                              value={secretForm.descricao}
                              onChange={(e) => updateSecretForm(amb.id, { descricao: e.target.value })}
                            />
                            <Button size="sm" className="h-8" onClick={() => handleSaveSecret(amb.id)} disabled={savingSecret === amb.id}>
                              {savingSecret === amb.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            O valor nunca é reexibido depois de salvo — só o tipo e a descrição ficam visíveis aqui.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkResult} onOpenChange={(open) => !open && setCheckResult(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verificação do ambiente {checkResult?.label}</DialogTitle>
            <DialogDescription>
              Projeto Supabase, saúde dos serviços e schema do template — sem checar frontend/app do cliente
              (fora do escopo do "Criar Ambiente").
            </DialogDescription>
          </DialogHeader>
          {checkResult && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">Projeto Supabase</p>
                {checkResult.relatorio?.projeto?.erro ? (
                  <p className="text-destructive text-xs">{checkResult.relatorio.projeto.erro}</p>
                ) : (
                  <Badge variant="outline">{checkResult.relatorio?.projeto?.status ?? "desconhecido"}</Badge>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Serviços</p>
                {checkResult.relatorio?.servicos?.erro ? (
                  <p className="text-destructive text-xs">{checkResult.relatorio.servicos.erro}</p>
                ) : Array.isArray(checkResult.relatorio?.servicos?.dados) ? (
                  <div className="flex flex-wrap gap-2">
                    {checkResult.relatorio.servicos.dados.map((s: any) => (
                      <Badge key={s.name} variant={s.healthy ? "outline" : "destructive"} className="text-[10px]">
                        {s.name}: {s.healthy ? "ok" : s.status ?? "erro"}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem dados.</p>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Schema (tabelas-chave e cron jobs)</p>
                {checkResult.relatorio?.schema?.erro ? (
                  <p className="text-destructive text-xs">{checkResult.relatorio.schema.erro}</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    <p>
                      Total de tabelas em <code>public</code>:{" "}
                      {checkResult.relatorio?.schema?.diagnostico?.total_tabelas_public ?? "?"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(checkResult.relatorio?.schema?.diagnostico?.tabelas_chave ?? {}).map(
                        ([nome, existe]: [string, any]) => (
                          <Badge key={nome} variant={existe ? "outline" : "destructive"} className="text-[10px]">
                            {nome}
                          </Badge>
                        )
                      )}
                    </div>
                    <p>
                      RLS em <code>projetos</code>:{" "}
                      {checkResult.relatorio?.schema?.diagnostico?.rls_projetos ? "ativo" : "inativo"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(checkResult.relatorio?.schema?.diagnostico?.cron_jobs ?? []).map((j: any) => (
                        <Badge key={j.jobname} variant={j.active ? "outline" : "destructive"} className="text-[10px]">
                          {j.jobname} ({j.schedule})
                        </Badge>
                      ))}
                      {(checkResult.relatorio?.schema?.diagnostico?.cron_jobs ?? []).length === 0 && (
                        <span className="text-muted-foreground">Nenhum cron job encontrado.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Frontend/app do cliente</p>
                <p className="text-xs text-muted-foreground">{checkResult.relatorio?.frontend_app?.nota}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
