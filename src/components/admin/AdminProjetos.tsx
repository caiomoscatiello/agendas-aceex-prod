import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FolderPlus, Plus, Trash2, Save, Loader2, Edit, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminCronogramaItens, { CronogramaItem } from "./AdminCronogramaItens";

type Projeto = {
  id: string;
  nome_cliente: string;
  site_cliente: string | null;
  endereco_cliente: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  coordenador_id: string | null;
  horas_contratadas: number;
  deslocamento: number;
  email_contato: string | null;
  codigo_cliente: string;
  status: string;
};

type Coordenador = {
  user_id: string;
  name: string;
};

type ProjetoDespesa = {
  id: string;
  projeto_id: string;
  tipo_despesa: string;
  valor_maximo: number;
};

type ProjetoAtividade = {
  id: string;
  projeto_id: string;
  codigo: string;
  descricao: string;
  horas: number;
};

type UserOption = {
  user_id: string;
  name: string;
};

export default function AdminProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [coordenadores, setCoordenadores] = useState<Coordenador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [detailProjeto, setDetailProjeto] = useState<Projeto | null>(null);

  // Form fields
  const [nomeCliente, setNomeCliente] = useState("");
  const [siteCliente, setSiteCliente] = useState("");
  const [enderecoCliente, setEnderecoCliente] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [selectedCoordenador, setSelectedCoordenador] = useState<string>("");
  const [horasContratadas, setHorasContratadas] = useState("");
  const [deslocamento, setDeslocamento] = useState("0");
  const [emailContato, setEmailContato] = useState("");
  const [codigoCliente, setCodigoCliente] = useState("");
  const [statusProjeto, setStatusProjeto] = useState("Em planejamento");

  // Despesas do projeto
  const [despesas, setDespesas] = useState<ProjetoDespesa[]>([]);
  const [newDespTipo, setNewDespTipo] = useState("");
  const [newDespValor, setNewDespValor] = useState("");

  // Atividades do projeto
  const [atividades, setAtividades] = useState<ProjetoAtividade[]>([]);
  const [newAtivCodigo, setNewAtivCodigo] = useState("");
  const [newAtivDescricao, setNewAtivDescricao] = useState("");
  const [newAtivHoras, setNewAtivHoras] = useState("");

  // Cronograma itens per atividade (keyed by atividade id)
  const [cronogramaMap, setCronogramaMap] = useState<Record<string, CronogramaItem[]>>({});
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProjetos();
    loadCoordenadores();
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    const { data } = await supabase.from("profiles").select("user_id, name").order("name");
    setAllUsers(data || []);
  };

  const loadProjetos = async () => {
    setLoading(true);
    const { data } = await supabase.from("projetos").select("*").order("created_at", { ascending: false });
    setProjetos(data || []);
    setLoading(false);
  };

  const loadCoordenadores = async () => {
    // Fetch users with 'coordenador' role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coordenador");
    
    if (!roles || roles.length === 0) return;

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", userIds);
    
    setCoordenadores(profiles || []);
  };

  const loadCronogramaForAtividades = async (atividadeIds: string[]) => {
    if (atividadeIds.length === 0) { setCronogramaMap({}); return; }
    const { data } = await supabase.from("cronograma_itens").select("*").in("atividade_id", atividadeIds);
    const map: Record<string, CronogramaItem[]> = {};
    (data || []).forEach((item: any) => {
      if (!map[item.atividade_id]) map[item.atividade_id] = [];
      map[item.atividade_id].push(item);
    });
    setCronogramaMap(map);
  };

  const loadProjetoDetails = async (projeto: Projeto) => {
    setDetailProjeto(projeto);
    const [despRes, ativRes] = await Promise.all([
      supabase.from("projeto_despesas").select("*").eq("projeto_id", projeto.id),
      supabase.from("projeto_atividades").select("*").eq("projeto_id", projeto.id),
    ]);
    setDespesas(despRes.data || []);
    const ativs = ativRes.data || [];
    setAtividades(ativs);
    await loadCronogramaForAtividades(ativs.map(a => a.id));
  };

  const openNew = () => {
    setEditingProjeto(null);
    setNomeCliente("");
    setSiteCliente("");
    setEnderecoCliente("");
    setContatoNome("");
    setContatoTelefone("");
    setSelectedCoordenador("");
    setHorasContratadas("");
    setDeslocamento("0");
    setEmailContato("");
    setCodigoCliente("");
    setStatusProjeto("Em planejamento");
    setDespesas([]);
    setAtividades([]);
    setCronogramaMap({});
    setDialogOpen(true);
  };

  const openEdit = async (projeto: Projeto) => {
    setEditingProjeto(projeto);
    setNomeCliente(projeto.nome_cliente);
    setSiteCliente(projeto.site_cliente || "");
    setEnderecoCliente(projeto.endereco_cliente || "");
    setContatoNome(projeto.contato_nome || "");
    setContatoTelefone(projeto.contato_telefone || "");
    setSelectedCoordenador(projeto.coordenador_id || "");
    setHorasContratadas(String(projeto.horas_contratadas || ""));
    setDeslocamento(String(projeto.deslocamento ?? 0));
    setEmailContato(projeto.email_contato || "");
    setCodigoCliente(projeto.codigo_cliente || "");
    
    const [despRes, ativRes] = await Promise.all([
      supabase.from("projeto_despesas").select("*").eq("projeto_id", projeto.id),
      supabase.from("projeto_atividades").select("*").eq("projeto_id", projeto.id),
    ]);
    setDespesas(despRes.data || []);
    const ativs = ativRes.data || [];
    setAtividades(ativs);
    await loadCronogramaForAtividades(ativs.map(a => a.id));
    setDialogOpen(true);
  };

  const addDespesaLocal = () => {
    if (!newDespTipo || !newDespValor) return;
    setDespesas((prev) => [
      ...prev,
      { id: `temp_${Date.now()}`, projeto_id: "", tipo_despesa: newDespTipo, valor_maximo: parseFloat(newDespValor) },
    ]);
    setNewDespTipo("");
    setNewDespValor("");
  };

  const removeDespesaLocal = (idx: number) => {
    setDespesas((prev) => prev.filter((_, i) => i !== idx));
  };

  const addAtividadeLocal = () => {
    if (!newAtivCodigo || !newAtivDescricao || !newAtivHoras) return;
    const novaHora = parseFloat(newAtivHoras);
    const totalAtual = atividades.reduce((sum, a) => sum + a.horas, 0);
    const limite = parseFloat(horasContratadas) || 0;
    if (limite > 0 && totalAtual + novaHora > limite) {
      toast({ title: "Erro", description: `Total de horas das atividades (${totalAtual + novaHora}h) excede as horas contratadas (${limite}h).`, variant: "destructive" });
      return;
    }
    setAtividades((prev) => [
      ...prev,
      { id: `temp_${Date.now()}`, projeto_id: "", codigo: newAtivCodigo, descricao: newAtivDescricao, horas: novaHora },
    ]);
    setNewAtivCodigo("");
    setNewAtivDescricao("");
    setNewAtivHoras("");
  };

  const removeAtividadeLocal = (idx: number) => {
    setAtividades((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!nomeCliente.trim()) {
      toast({ title: "Erro", description: "Nome do cliente é obrigatório.", variant: "destructive" });
      return;
    }

    if (!codigoCliente.trim() || codigoCliente.trim().length !== 6 || !/^[A-Za-z0-9]{6}$/.test(codigoCliente.trim())) {
      toast({ title: "Erro", description: "Código do cliente deve ter exatamente 6 caracteres alfanuméricos.", variant: "destructive" });
      return;
    }
    
    // Validate phone format (DDD + 9 digits)
    if (contatoTelefone) {
      const rawPhone = contatoTelefone.replace(/\D/g, "");
      if (rawPhone.length !== 11 || rawPhone[2] !== "9") {
        toast({ title: "Erro", description: "Telefone inválido. Use o formato (DDD) 9XXXX-XXXX.", variant: "destructive" });
        return;
      }
    }

    if (!selectedCoordenador) {
      toast({ title: "Erro", description: "Selecione um coordenador.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const hcValue = parseFloat(horasContratadas) || 0;
    const totalHorasAtividades = atividades.reduce((sum, a) => sum + a.horas, 0);
    if (hcValue > 0 && totalHorasAtividades !== hcValue) {
      toast({ title: "Erro", description: `Total de horas das atividades (${totalHorasAtividades}h) deve ser igual às horas contratadas (${hcValue}h).`, variant: "destructive" });
      setSaving(false);
      return;
    }

    const projectData = {
      nome_cliente: nomeCliente,
      site_cliente: siteCliente || null,
      endereco_cliente: enderecoCliente || null,
      contato_nome: contatoNome || null,
      contato_telefone: contatoTelefone || null,
      coordenador_id: selectedCoordenador || null,
      horas_contratadas: hcValue,
      deslocamento: parseInt(deslocamento) || 0,
      email_contato: emailContato || null,
      codigo_cliente: codigoCliente.trim().toUpperCase(),
      status: statusProjeto,
    };

    let projetoId: string;

    if (editingProjeto) {
      const { error } = await supabase
        .from("projetos")
        .update(projectData)
        .eq("id", editingProjeto.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      projetoId = editingProjeto.id;

      // Delete existing and re-insert details
      await supabase.from("projeto_despesas").delete().eq("projeto_id", projetoId);
      await supabase.from("projeto_atividades").delete().eq("projeto_id", projetoId);
    } else {
      const { data, error } = await supabase
        .from("projetos")
        .insert(projectData)
        .select("id")
        .single();
      if (error || !data) {
        toast({ title: "Erro", description: error?.message || "Erro ao criar projeto", variant: "destructive" });
        setSaving(false);
        return;
      }
      projetoId = data.id;
    }

    // Insert despesas
    if (despesas.length > 0) {
      const { error } = await supabase.from("projeto_despesas").insert(
        despesas.map((d) => ({ projeto_id: projetoId, tipo_despesa: d.tipo_despesa, valor_maximo: d.valor_maximo }))
      );
      if (error) toast({ title: "Aviso", description: `Erro ao salvar despesas: ${error.message}` });
    }

    // Insert atividades and cronograma items
    if (atividades.length > 0) {
      // We need to map old temp IDs to new IDs for cronograma items
      const oldIds = atividades.map(a => a.id);
      const { data: insertedAtivs, error } = await supabase.from("projeto_atividades").insert(
        atividades.map((a) => ({ projeto_id: projetoId, codigo: a.codigo, descricao: a.descricao, horas: a.horas }))
      ).select("id");
      if (error) {
        toast({ title: "Aviso", description: `Erro ao salvar atividades: ${error.message}` });
      } else if (insertedAtivs) {
        // Map old atividade IDs to new ones and insert cronograma items
        const allCronogramaInserts: any[] = [];
        oldIds.forEach((oldId, index) => {
          const newAtivId = insertedAtivs[index]?.id;
          const itens = cronogramaMap[oldId] || [];
          if (newAtivId && itens.length > 0) {
            itens.forEach(item => {
              allCronogramaInserts.push({
                atividade_id: newAtivId,
                codigo: item.codigo,
                descricao: item.descricao,
                horas_reservadas: item.horas_reservadas,
                user_id: item.user_id,
              });
            });
          }
        });
        if (allCronogramaInserts.length > 0) {
          const { error: cronError } = await supabase.from("cronograma_itens").insert(allCronogramaInserts);
          if (cronError) toast({ title: "Aviso", description: `Erro ao salvar cronograma: ${cronError.message}` });
        }
      }
    }

    toast({ title: "Sucesso", description: editingProjeto ? "Projeto atualizado!" : "Projeto cadastrado!" });
    setDialogOpen(false);
    setSaving(false);
    loadProjetos();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("projetos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Projeto removido" });
      loadProjetos();
      if (detailProjeto?.id === id) setDetailProjeto(null);
    }
  };

  const getCoordenadorName = (id: string | null) => {
    if (!id) return "—";
    const coord = coordenadores.find(c => c.user_id === id);
    return coord ? coord.name : "Desconhecido";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Projetos
            </CardTitle>
            <Button size="sm" className="gap-1" onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : projetos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum projeto cadastrado.</p>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Status</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Coordenador</TableHead>
                    <TableHead className="hidden sm:table-cell">Contato</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projetos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-block h-4 w-4 rounded-full",
                            p.status === "Liberado" ? "bg-emerald-500" :
                            p.status === "Encerrado" ? "bg-red-500" :
                            "bg-yellow-500"
                          )}
                          title={p.status || "Em planejamento"}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.nome_cliente}</TableCell>
                      <TableCell className="text-sm">{getCoordenadorName(p.coordenador_id)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {p.contato_nome ? `${p.contato_nome} (${p.contato_telefone})` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => loadProjetoDetails(p)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail view */}
      {detailProjeto && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{detailProjeto.nome_cliente}</CardTitle>
            <div className="text-xs text-muted-foreground space-y-1">
              {detailProjeto.codigo_cliente && <p>Código: {detailProjeto.codigo_cliente}</p>}
              {detailProjeto.endereco_cliente && <p>Endereço: {detailProjeto.endereco_cliente}</p>}
              {detailProjeto.contato_nome && <p>Contato: {detailProjeto.contato_nome} - {detailProjeto.contato_telefone}</p>}
              {detailProjeto.site_cliente && <p>Site: {detailProjeto.site_cliente}</p>}
              <p>Coordenador: {getCoordenadorName(detailProjeto.coordenador_id)}</p>
              <p className="flex items-center gap-1.5">
                Status:
                <span className={cn(
                  "inline-block h-3 w-3 rounded-full",
                  detailProjeto.status === "Liberado" ? "bg-emerald-500" :
                  detailProjeto.status === "Encerrado" ? "bg-red-500" : "bg-yellow-500"
                )} />
                {detailProjeto.status || "Em planejamento"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Despesas do Projeto</p>
              {despesas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma despesa cadastrada.</p>
              ) : (
                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Valor Máximo</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {despesas.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.tipo_despesa}</TableCell>
                          <TableCell>R$ {d.valor_maximo.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Atividades do Projeto</p>
              {atividades.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {atividades.map((a) => (
                    <div key={a.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium">{a.codigo}</span>
                        <span className="text-sm flex-1">{a.descricao}</span>
                        <span className="text-sm text-muted-foreground">{a.horas}h</span>
                      </div>
                      {(cronogramaMap[a.id] || []).length > 0 && (
                        <div className="ml-4">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Itens Cronograma</p>
                          <div className="rounded border overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Código</TableHead>
                                  <TableHead className="text-xs">Descrição</TableHead>
                                  <TableHead className="text-xs">Horas</TableHead>
                                  <TableHead className="text-xs">Responsável</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(cronogramaMap[a.id] || []).map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="text-xs font-mono">{item.codigo}</TableCell>
                                    <TableCell className="text-xs">{item.descricao}</TableCell>
                                    <TableCell className="text-xs">{item.horas_reservadas}h</TableCell>
                                    <TableCell className="text-xs">{allUsers.find(u => u.user_id === item.user_id)?.name || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProjeto ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Header - Client Info */}
            <div className="space-y-3 border-b pb-4">
              <p className="text-sm font-semibold text-muted-foreground">Dados do Cliente</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código do Cliente *</Label>
                  <Input 
                    value={codigoCliente} 
                    onChange={(e) => setCodigoCliente(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase())} 
                    placeholder="ABC123" 
                    maxLength={6}
                  />
                  <p className="text-[10px] text-muted-foreground">6 caracteres alfanuméricos</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do Cliente *</Label>
                  <Input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Coordenador Responsável *</Label>
                  <Select value={selectedCoordenador} onValueChange={setSelectedCoordenador}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coordenadores.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do Contato</Label>
                  <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone do Contato</Label>
                  <Input 
                    value={contatoTelefone} 
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let formatted = "";
                      if (raw.length > 0) formatted = `(${raw.slice(0, 2)}`;
                      if (raw.length >= 3) formatted += `) ${raw.slice(2, 7)}`;
                      if (raw.length >= 8) formatted += `-${raw.slice(7)}`;
                      setContatoTelefone(raw.length === 0 ? "" : formatted);
                    }}
                    placeholder="(11) 99999-9999" 
                    type="tel"
                    maxLength={15}
                  />
                  <p className="text-[10px] text-muted-foreground">Formato: (DDD) 9XXXX-XXXX</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Endereço</Label>
                  <Input value={enderecoCliente} onChange={(e) => setEnderecoCliente(e.target.value)} placeholder="Endereço completo" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Site</Label>
                  <Input value={siteCliente} onChange={(e) => setSiteCliente(e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Email do Contato</Label>
                  <Input type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@empresa.com" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Horas Contratadas *</Label>
                  <Input type="number" min="0" value={horasContratadas} onChange={(e) => setHorasContratadas(e.target.value)} placeholder="Ex: 100" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deslocamento</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    max="9" 
                    value={deslocamento} 
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                      setDeslocamento(v);
                    }} 
                    placeholder="0-9" 
                    maxLength={1}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status do Projeto *</Label>
                  <Select value={statusProjeto} onValueChange={setStatusProjeto}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Em planejamento">🟡 Em planejamento</SelectItem>
                      <SelectItem value="Liberado">🟢 Liberado</SelectItem>
                      <SelectItem value="Encerrado">🔴 Encerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Despesas */}
            <div className="space-y-3 border-b pb-4">
              <p className="text-sm font-semibold text-muted-foreground">Despesas do Projeto</p>
              {despesas.length > 0 && (
                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de Despesa</TableHead>
                        <TableHead>Valor Máximo (R$)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despesas.map((d, i) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.tipo_despesa}</TableCell>
                          <TableCell>R$ {d.valor_maximo.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeDespesaLocal(i)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Input value={newDespTipo} onChange={(e) => setNewDespTipo(e.target.value)} placeholder="Ex: Alimentação" />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Valor Máx.</Label>
                  <Input type="number" step="0.01" value={newDespValor} onChange={(e) => setNewDespValor(e.target.value)} placeholder="0.00" />
                </div>
                <Button variant="outline" size="icon" onClick={addDespesaLocal}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Atividades */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Atividades do Projeto</p>
                {parseFloat(horasContratadas) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Horas: {atividades.reduce((s, a) => s + a.horas, 0)}h / {horasContratadas}h
                  </p>
                )}
              </div>
              {atividades.length > 0 && (
                <div className="space-y-1">
                  {atividades.map((a, i) => (
                    <div key={a.id} className="rounded-lg border p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{a.codigo}</span>
                        <span className="text-xs flex-1">{a.descricao}</span>
                        <span className="text-xs text-muted-foreground">{a.horas}h</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAtividadeLocal(i)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <AdminCronogramaItens
                        atividadeId={a.id}
                        atividadeCodigo={a.codigo}
                        atividadeHoras={a.horas}
                        itens={cronogramaMap[a.id] || []}
                        usuarios={allUsers}
                        onUpdate={(atividadeId, itens) => {
                          setCronogramaMap(prev => ({ ...prev, [atividadeId]: itens }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Código</Label>
                  <Input value={newAtivCodigo} onChange={(e) => setNewAtivCodigo(e.target.value)} placeholder="A01" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={newAtivDescricao} onChange={(e) => setNewAtivDescricao(e.target.value)} placeholder="Descrição da atividade" />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Horas</Label>
                  <Input type="number" value={newAtivHoras} onChange={(e) => setNewAtivHoras(e.target.value)} placeholder="0" />
                </div>
                <Button variant="outline" size="icon" onClick={addAtividadeLocal}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingProjeto ? "Salvar Alterações" : "Cadastrar Projeto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
