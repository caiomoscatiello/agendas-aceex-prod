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
import { Loader2, Plus, Pencil, Trash2, Building2, LogOut, Image as ImageIcon } from "lucide-react";
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

  useEffect(() => {
    loadClientes();
  }, []);

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
    setDialogOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>Cadastro completo do cliente da PROJTE.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="identificacao">Identificação</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
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
    </div>
  );
}
