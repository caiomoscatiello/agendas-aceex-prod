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
import { UserPlus, Loader2, Eye, Ban, Trash2, KeyRound, Users, ShieldOff, Pencil, Search, CalendarDays, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Profile = {
  user_id: string;
  name: string;
  email: string;
  codigo: string;
  contato: string;
  created_at: string;
  especialidade: string | null;
  horas_dia: number;
};

type Disponibilidade = {
  user_id: string;
  ano: number;
  mes: number;
  percentual: number;
  observacao: string | null;
};

const ESPECIALIDADE_LABELS: Record<string, string> = {
  funcional:     "Funcional",
  desenvolvedor: "Desenvolvedor",
  qa:            "QA",
  techlead:      "Tech Lead",
};

const ESPECIALIDADE_COLORS: Record<string, string> = {
  funcional:     "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  desenvolvedor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  qa:            "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  techlead:      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
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
  const [editEspecialidade, setEditEspecialidade] = useState<string>("");
  const [editHorasDia, setEditHorasDia] = useState<number>(8);
  const [editLoading, setEditLoading] = useState(false);

  // Disponibilidade mensal
  const [dispAno, setDispAno] = useState<number>(new Date().getFullYear());
  const [dispMes, setDispMes] = useState<number>(new Date().getMonth() + 1);
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidade[]>([]);
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [savingDisp, setSavingDisp] = useState<string | null>(null);
  // grid local: key = "user_id-ano-mes" => percentual editado
  const [dispEdits, setDispEdits] = useState<Record<string, string>>({});

  const isCallerAdmin = callerRole === "admin";

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email, codigo, contato, created_at, especialidade, horas_dia")
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

  const loadDisponibilidades = useCallback(async (ano: number, mes: number) => {
    setLoadingDisp(true);
    const { data } = await supabase
      .from("consultor_disponibilidade")
      .select("user_id, ano, mes, percentual, observacao")
      .eq("ano", ano)
      .eq("mes", mes);
    setDisponibilidades(data || []);
    // Inicializa edits com valores existentes
    const edits: Record<string, string> = {};
    (data || []).forEach((d) => {
      edits[`${d.user_id}-${ano}-${mes}`] = String(d.percentual);
    });
    setDispEdits(edits);
    setLoadingDisp(false);
  }, []);

  useEffect(() => {
    loadDisponibilidades(dispAno, dispMes);
  }, [dispAno, dispMes, loadDisponibilidades]);

  const getDispKey = (userId: string) => `${userId}-${dispAno}-${dispMes}`;

  const getDispValue = (userId: string): string => {
    const key = getDispKey(userId);
    if (key in dispEdits) return dispEdits[key];
    const existing = disponibilidades.find(
      (d) => d.user_id === userId && d.ano === dispAno && d.mes === dispMes
    );
    return existing ? String(existing.percentual) : "100";
  };

  const handleDispChange = (userId: string, val: string) => {
    setDispEdits((prev) => ({ ...prev, [getDispKey(userId)]: val }));
  };

  const saveDisponibilidade = async (userId: string) => {
    const key = getDispKey(userId);
    const raw = dispEdits[key] ?? getDispValue(userId);
    const pct = parseFloat(raw);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast({ title: "Valor inválido", description: "Percentual deve ser entre 0 e 100.", variant: "destructive" });
      return;
    }
    setSavingDisp(userId);
    const { error } = await supabase
      .from("consultor_disponibilidade")
      .upsert(
        { user_id: userId, ano: dispAno, mes: dispMes, percentual: pct },
        { onConflict: "user_id,ano,mes" }
      );
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo", description: `Disponibilidade atualizada para ${pct}%.` });
      await loadDisponibilidades(dispAno, dispMes);
    }
    setSavingDisp(null);
  };

  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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
    setEditEspecialidade(u.especialidade || "");
    setEditHorasDia(u.horas_dia ?? 8);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    if (editContatoError) { setEditLoading(false); return; }
    const editContatoDigits = editContato.replace(/\D/g, "");
    const currentContatoDigits = (editUser.contato || "").replace(/\D/g, "");

    // Atualiza role/nome/codigo/contato via Edge Function
    const res = await supabase.functions.invoke("update-user", {
      body: {
        user_id: editUser.user_id,
        new_name: editName !== editUser.name ? editName : undefined,
        new_codigo: editCodigo !== (editUser.codigo || "") ? editCodigo : undefined,
        new_contato: editContatoDigits !== currentContatoDigits ? editContatoDigits : undefined,
        new_role: editRole !== editUser.role ? editRole : undefined,
      },
    });

    // Atualiza especialidade e horas_dia diretamente em profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        especialidade: editEspecialidade || null,
        horas_dia: editHorasDia,
      })
      .eq("user_id", editUser.user_id);

    if (res.error || res.data?.error || profileError) {
      toast({
        title: "Erro",
        description: res.data?.error || res.error?.message || profileError?.message,
        variant: "destructive",
      });
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
        <Tabs defaultValue="usuarios">
          <TabsList className="mb-4">
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="disponibilidade" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Disponibilidade Mensal
            </TabsTrigger>
          </TabsList>

          {/* ── ABA USUÁRIOS ── */}
          <TabsContent value="usuarios">
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
                <TableHead>Especialidade</TableHead>
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
                      {u.especialidade ? (
                        <Badge variant="secondary" className={ESPECIALIDADE_COLORS[u.especialidade] || ""}>
                          {ESPECIALIDADE_LABELS[u.especialidade] || u.especialidade}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
          </TabsContent>

          {/* ── ABA DISPONIBILIDADE ── */}
          <TabsContent value="disponibilidade">
            <div className="space-y-4">
              {/* Navegação mês/ano */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (dispMes === 1) { setDispMes(12); setDispAno(dispAno - 1); }
                      else setDispMes(dispMes - 1);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold text-sm min-w-[120px] text-center">
                    {MESES[dispMes - 1]} / {dispAno}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (dispMes === 12) { setDispMes(1); setDispAno(dispAno + 1); }
                      else setDispMes(dispMes + 1);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Defina o % de disponibilidade de cada consultor no mês. Capacidade = % × dias úteis × 8h.
                </p>
              </div>

              {/* Grid de disponibilidade */}
              {loadingDisp ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Horas/dia</TableHead>
                      <TableHead className="w-[180px]">
                        Disponibilidade % — {MESES[dispMes - 1]}/{dispAno}
                      </TableHead>
                      <TableHead className="text-right">Capacidade (h)</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter((u) => u.role === "consultor" || u.role === "coordenador")
                      .map((u) => {
                        const pctStr = getDispValue(u.user_id);
                        const pct = parseFloat(pctStr) || 0;
                        // Dias úteis estimados — calculado client-side (sem feriados, aproximação)
                        // O valor real vem da view SQL no Supabase
                        const diasUteisMes = (() => {
                          const d = new Date(dispAno, dispMes - 1, 1);
                          let count = 0;
                          while (d.getMonth() === dispMes - 1) {
                            const dow = d.getDay();
                            if (dow !== 0 && dow !== 6) count++;
                            d.setDate(d.getDate() + 1);
                          }
                          return count;
                        })();
                        const capacidade = ((u.horas_dia ?? 8) * diasUteisMes * pct / 100).toFixed(1);
                        const barWidth = Math.min(pct, 100);
                        const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
                        const isSaving = savingDisp === u.user_id;
                        return (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-medium">{u.name || u.email}</TableCell>
                            <TableCell>
                              {u.especialidade ? (
                                <Badge variant="secondary" className={ESPECIALIDADE_COLORS[u.especialidade] || ""}>
                                  {ESPECIALIDADE_LABELS[u.especialidade] || u.especialidade}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Não definida</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{u.horas_dia ?? 8}h</TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={10}
                                    value={pctStr}
                                    onChange={(e) => handleDispChange(u.user_id, e.target.value)}
                                    onBlur={() => saveDisponibilidade(u.user_id)}
                                    className="h-8 w-20 text-center text-sm"
                                  />
                                  <span className="text-sm text-muted-foreground">%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${barColor}`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm">
                              {capacidade}h
                              <span className="block text-xs text-muted-foreground font-normal">
                                ~{diasUteisMes} dias úteis
                              </span>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isSaving}
                                    onClick={() => saveDisponibilidade(u.user_id)}
                                  >
                                    {isSaving
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Save className="h-4 w-4 text-primary" />
                                    }
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Salvar disponibilidade</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {users.filter((u) => u.role === "consultor" || u.role === "coordenador").length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                          Nenhum consultor ou coordenador cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              <p className="text-xs text-muted-foreground border-t pt-3">
                💡 A disponibilidade é salva automaticamente ao sair do campo ou ao clicar em salvar.
                O cálculo de dias úteis exibido é estimado (sem feriados). O valor exato com feriados nacionais
                é calculado pelo banco de dados na view <code className="font-mono">vw_ocupacao_consultor</code>.
              </p>
            </div>
          </TabsContent>

        </Tabs>

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
                <div className="space-y-2">
                  <Label>Especialidade Técnica</Label>
                  <Select value={editEspecialidade} onValueChange={setEditEspecialidade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sem especialidade —</SelectItem>
                      {Object.entries(ESPECIALIDADE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Usado no cálculo de ocupação mensal do portfólio.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Horas por dia útil</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={editHorasDia}
                    onChange={(e) => setEditHorasDia(parseFloat(e.target.value) || 8)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Padrão: 8h (CLT). Meio período: 4h.
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
