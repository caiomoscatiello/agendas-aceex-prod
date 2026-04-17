import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Loader2, Eye, Ban, Trash2, KeyRound, Users, ShieldOff, Pencil, Search } from "lucide-react";

type Profile = {
  user_id: string;
  name: string;
  email: string;
  codigo: string;
  contato: string;
  created_at: string;
};

type UserWithRole = Profile & { role: string };

const ROLE_LABELS: Record<string, string> = {
  consultor: "Consultor",
  coordenador: "Coordenador",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  consultor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  coordenador: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  admin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

export default function AdminCadastroUsuarios() {
  const { role: callerRole } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // New user form
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [codigo, setCodigo] = useState("");
  const [contato, setContato] = useState("");
  const [contatoError, setContatoError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("consultor");
  const [creating, setCreating] = useState(false);

  // View user dialog
  const [viewUser, setViewUser] = useState<UserWithRole | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit user dialog
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [editContato, setEditContato] = useState("");
  const [editContatoError, setEditContatoError] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const isCallerAdmin = callerRole === "admin";

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email, codigo, contato, created_at")
      .order("name");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
    const merged: UserWithRole[] = (profiles || []).map((p) => ({
      ...p,
      role: roleMap.get(p.user_id) || "consultor",
    }));
    setUsers(merged);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const checkEmailExists = async (emailToCheck: string) => {
    if (!emailToCheck || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToCheck)) {
      setEmailError(null);
      return;
    }
    setCheckingEmail(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", emailToCheck)
      .maybeSingle();
    if (data) {
      setEmailError("Este email já está cadastrado no sistema.");
    } else {
      setEmailError(null);
    }
    setCheckingEmail(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    setCreating(true);
    if (contatoError) return;
    const res = await supabase.functions.invoke("create-user", {
      body: { name, codigo, contato: contato.replace(/\D/g, ""), email, password, role: selectedRole },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Usuário ${name} criado como ${ROLE_LABELS[selectedRole]}!` });
      setName(""); setCodigo(""); setContato(""); setContatoError(null); setEmail(""); setPassword(""); setSelectedRole("consultor"); setEmailError(null);
      setNewOpen(false);
      loadUsers();
    }
    setCreating(false);
  };

  const handleAction = async (action: "ban" | "unban" | "delete", userId: string, label: string) => {
    setActionLoading(userId);
    const res = await supabase.functions.invoke("manage-user", {
      body: { action, user_id: userId },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: res.data?.message || label });
      if (action === "delete") {
        setUsers((prev) => prev.filter((p) => p.user_id !== userId));
      }
    }
    setActionLoading(null);
  };

  const handleResetPassword = async (targetEmail?: string) => {
    const emailToReset = targetEmail || viewUser?.email;
    if (!emailToReset) return;
    setResetLoading(true);

    // Get app URL from settings for correct redirect
    let appUrl = window.location.origin;
    const { data: appUrlSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_url")
      .maybeSingle();
    if (appUrlSetting?.value) {
      appUrl = appUrlSetting.value.replace(/\/$/, "");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
      redirectTo: `${appUrl}/reset-password`,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Email de recuperação enviado para ${emailToReset}!` });
    }
    setResetLoading(false);
  };

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const validatePhone = (value: string): string | null => {
    if (!value) return null;
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11) return "O telefone deve ter 11 dígitos.";
    if (digits[2] !== "9") return "O terceiro dígito deve ser 9 (celular).";
    return null;
  };

  const handleContatoChange = (value: string, setter: (v: string) => void, errorSetter: (v: string | null) => void) => {
    const formatted = formatPhone(value);
    setter(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 11 || digits.length === 0) {
      errorSetter(validatePhone(formatted));
    } else {
      errorSetter(null);
    }
  };

  const openEdit = (u: UserWithRole) => {
    setEditUser(u);
    setEditName(u.name);
    setEditCodigo(u.codigo || "");
    setEditContato(u.contato ? formatPhone(u.contato) : "");
    setEditContatoError(null);
    setEditRole(u.role);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    if (editContatoError) return;
    const editContatoDigits = editContato.replace(/\D/g, "");
    const currentContatoDigits = (editUser.contato || "").replace(/\D/g, "");
    const res = await supabase.functions.invoke("update-user", {
      body: {
        user_id: editUser.user_id,
        new_name: editName !== editUser.name ? editName : undefined,
        new_codigo: editCodigo !== (editUser.codigo || "") ? editCodigo : undefined,
        new_contato: editContatoDigits !== currentContatoDigits ? editContatoDigits : undefined,
        new_role: editRole !== editUser.role ? editRole : undefined,
      },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Usuário atualizado!" });
      setEditUser(null);
      loadUsers();
    }
    setEditLoading(false);
  };

  // Permission helpers
  const canEditUser = (u: UserWithRole) => {
    if (isCallerAdmin) return true;
    // Coordenador cannot edit admin users
    return u.role !== "admin";
  };

  const canCreateAdmin = isCallerAdmin;

  // Available roles for create/edit based on caller
  const availableRolesForCreate = canCreateAdmin
    ? ["consultor", "coordenador", "admin"]
    : ["consultor", "coordenador"];

  const availableRolesForEdit = (targetRole: string) => {
    if (isCallerAdmin) return ["consultor", "coordenador", "admin"];
    // Coordenador cannot assign admin
    if (targetRole === "admin") return [targetRole]; // shouldn't reach here
    return ["consultor", "coordenador"];
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Usuários
        </CardTitle>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código do usuário" />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  onBlur={(e) => checkEmailExists(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  className={emailError ? "border-destructive" : ""}
                />
                {checkingEmail && <p className="text-xs text-muted-foreground">Verificando...</p>}
                {emailError && <p className="text-xs text-destructive font-medium">{emailError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input
                  value={contato}
                  onChange={(e) => handleContatoChange(e.target.value, setContato, setContatoError)}
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                  className={contatoError ? "border-destructive" : ""}
                />
                {contatoError && <p className="text-xs text-destructive font-medium">{contatoError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRolesForCreate.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedRole === "consultor" && "Acesso ao calendário e apontamentos."}
                  {selectedRole === "coordenador" && "Acesso de consultor + painel administrativo."}
                  {selectedRole === "admin" && "Acesso apenas ao painel administrativo."}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={creating || !!emailError || !!contatoError || checkingEmail}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (() => {
          const filtered = users.filter((u) => {
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
          });
          return filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {users.length === 0 ? "Nenhum usuário cadastrado." : "Nenhum usuário encontrado para a pesquisa."}
            </p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const editable = canEditUser(u);
                return (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.codigo || "—"}</TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    
                    <TableCell>
                      <Badge variant="secondary" className={ROLE_COLORS[u.role] || ""}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setViewUser(u)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {editable && (
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Resetar Senha"
                            disabled={resetLoading}
                            onClick={() => handleResetPassword(u.email)}
                          >
                            {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 text-primary" />}
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Bloquear"
                            disabled={actionLoading === u.user_id}
                            onClick={() => handleAction("ban", u.user_id, "Usuário bloqueado.")}
                          >
                            {actionLoading === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4 text-amber-600" />}
                          </Button>
                        )}
                        {editable && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Excluir">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente excluir o usuário <strong>{u.name}</strong> ({u.email})? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleAction("delete", u.user_id, "Usuário excluído.")}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          );
        })()}

        {/* View User Dialog */}
        <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Usuário</DialogTitle>
            </DialogHeader>
            {viewUser && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Código</Label>
                    <p className="font-medium">{viewUser.codigo || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <p className="font-medium">{viewUser.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium">{viewUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Contato</Label>
                    <p className="font-medium">{viewUser.contato ? formatPhone(viewUser.contato) : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Badge variant="secondary" className={ROLE_COLORS[viewUser.role] || ""}>
                      {ROLE_LABELS[viewUser.role] || viewUser.role}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cadastrado em</Label>
                    <p className="font-medium">{new Date(viewUser.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Recuperação de Senha
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => handleResetPassword()} disabled={resetLoading}>
                    {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Email de Recuperação"}
                  </Button>
                </div>

                {canEditUser(viewUser) && (
                  <div className="border-t pt-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => { handleAction("ban", viewUser.user_id, "Bloqueado."); setViewUser(null); }}
                    >
                      <Ban className="h-4 w-4" /> Bloquear
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => { handleAction("unban", viewUser.user_id, "Desbloqueado."); setViewUser(null); }}
                    >
                      <ShieldOff className="h-4 w-4" /> Desbloquear
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            {editUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} placeholder="Código do usuário" />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contato</Label>
                  <Input
                    value={editContato}
                    onChange={(e) => handleContatoChange(e.target.value, setEditContato, setEditContatoError)}
                    placeholder="(XX) XXXXX-XXXX"
                    maxLength={15}
                    className={editContatoError ? "border-destructive" : ""}
                  />
                  {editContatoError && <p className="text-xs text-destructive font-medium">{editContatoError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editUser.email} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Usuário</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRolesForEdit(editUser.role).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editRole === "consultor" && "Acesso ao calendário e apontamentos."}
                    {editRole === "coordenador" && "Acesso de consultor + painel administrativo."}
                    {editRole === "admin" && "Acesso apenas ao painel administrativo."}
                  </p>
                </div>
                <Button className="w-full" onClick={handleEdit} disabled={editLoading || !!editContatoError}>
                  {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Alterações"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
