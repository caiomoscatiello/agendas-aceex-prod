import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Save, X, Edit, Trash2, FileText, Loader2, Upload,
  MoreVertical, Power, PowerOff,
} from "lucide-react";

interface TipoDocumento {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  modelo_url: string | null;
  modelo_nome: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminTiposDocumento() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modeloUrlAtual, setModeloUrlAtual] = useState<string | null>(null);
  const [modeloNomeAtual, setModeloNomeAtual] = useState<string | null>(null);
  const [removerModelo, setRemoverModelo] = useState(false);

  useEffect(() => {
    loadTipos();
  }, []);

  const loadTipos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_documento")
      .select("*")
      .order("codigo");
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setTipos((data as TipoDocumento[]) || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setCodigo("");
    setDescricao("");
    setAtivo(true);
    setArquivo(null);
    setModeloUrlAtual(null);
    setModeloNomeAtual(null);
    setRemoverModelo(false);
    setEditingId(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openEdit = (t: TipoDocumento) => {
    setCodigo(t.codigo);
    setDescricao(t.descricao);
    setAtivo(t.ativo);
    setModeloUrlAtual(t.modelo_url);
    setModeloNomeAtual(t.modelo_nome);
    setArquivo(null);
    setRemoverModelo(false);
    setEditingId(t.id);
    setShowForm(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const extractStoragePath = (url: string): string | null => {
    const marker = "/object/public/documentos-modelo/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.substring(idx + marker.length));
  };

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .toLowerCase();
  };

  const uploadModelo = async (cod: string): Promise<{ url: string; nome: string } | null> => {
    if (!arquivo) return null;
    const sanitizedName = sanitizeFileName(arquivo.name);
    const sanitizedCodigo = sanitizeFileName(cod);
    const path = `modelos/${sanitizedCodigo}_${Date.now()}_${sanitizedName}`;
    const { error } = await supabase.storage
      .from("documentos-modelo")
      .upload(path, arquivo, { upsert: true });
    if (error) throw new Error(`Upload falhou: ${error.message}`);
    const { data: urlData } = supabase.storage
      .from("documentos-modelo")
      .getPublicUrl(path);
    return { url: urlData.publicUrl, nome: arquivo.name };
  };

  const deleteStorageFile = async (url: string) => {
    const path = extractStoragePath(url);
    if (path) {
      await supabase.storage.from("documentos-modelo").remove([path]);
    }
  };

  const handleSave = async () => {
    if (!codigo.trim() || !descricao.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha código e descrição.", variant: "destructive" });
      return;
    }
    if (codigo.trim().length > 20) {
      toast({ title: "Código muito longo", description: "Máximo 20 caracteres.", variant: "destructive" });
      return;
    }
    if (descricao.trim().length > 100) {
      toast({ title: "Descrição muito longa", description: "Máximo 100 caracteres.", variant: "destructive" });
      return;
    }
    if (arquivo && arquivo.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let modelo_url: string | null = modeloUrlAtual;
      let modelo_nome: string | null = modeloNomeAtual;

      // Handle file removal
      if (removerModelo && modeloUrlAtual) {
        await deleteStorageFile(modeloUrlAtual);
        modelo_url = null;
        modelo_nome = null;
      }

      // Handle new file upload
      if (arquivo) {
        // Delete old file if replacing
        if (modeloUrlAtual) {
          await deleteStorageFile(modeloUrlAtual);
        }
        const result = await uploadModelo(codigo.trim().toUpperCase());
        if (result) {
          modelo_url = result.url;
          modelo_nome = result.nome;
        }
      }

      const record = {
        codigo: codigo.trim().toUpperCase(),
        descricao: descricao.trim(),
        ativo,
        modelo_url,
        modelo_nome,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("tipos_documento")
          .update(record)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Atualizado", description: "Tipo de documento atualizado." });
      } else {
        const { error } = await supabase
          .from("tipos_documento")
          .insert(record);
        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("unique")) {
            throw new Error("Código já existe.");
          }
          throw error;
        }
        toast({ title: "Cadastrado", description: "Tipo de documento criado." });
      }

      resetForm();
      loadTipos();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (t: TipoDocumento) => {
    if (!confirm(`Excluir tipo "${t.codigo} - ${t.descricao}"?`)) return;

    setDeletingId(t.id);
    try {
      // Check if in use
      const { count } = await supabase
        .from("cronograma_itens")
        .select("id", { count: "exact", head: true })
        .eq("tipo_documento_id", t.id)
        .eq("doc_exigido", true);

      if (count && count > 0) {
        toast({
          title: "Exclusão bloqueada",
          description: `Tipo em uso em ${count} item(ns) de cronograma.`,
          variant: "destructive",
        });
        setDeletingId(null);
        return;
      }

      // Delete storage file if exists
      if (t.modelo_url) {
        await deleteStorageFile(t.modelo_url);
      }

      const { error } = await supabase
        .from("tipos_documento")
        .delete()
        .eq("id", t.id);
      if (error) throw error;

      toast({ title: "Excluído", description: "Tipo de documento removido." });
      loadTipos();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
    setDeletingId(null);
  };

  const handleToggleAtivo = async (t: TipoDocumento) => {
    setTogglingId(t.id);
    try {
      const { error } = await supabase
        .from("tipos_documento")
        .update({ ativo: !t.ativo, updated_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
      toast({
        title: t.ativo ? "Desativado" : "Ativado",
        description: `Tipo "${t.codigo}" ${t.ativo ? "desativado" : "ativado"}.`,
      });
      loadTipos();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setTogglingId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      toast({ title: "Tipo inválido", description: "Apenas PDF, DOC ou DOCX.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setArquivo(file);
    setRemoverModelo(false);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Tipos de Documento</h3>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingId ? "Editar Tipo de Documento" : "Novo Tipo de Documento"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="td-codigo">Código *</Label>
                <Input
                  id="td-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ex: ATA, TERMO"
                  maxLength={20}
                  className="h-10 uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="td-descricao">Descrição *</Label>
                <Input
                  id="td-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Ata de Reunião"
                  maxLength={100}
                  className="h-10"
                />
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label htmlFor="td-modelo">Documento modelo (opcional)</Label>
              <div className="flex flex-col gap-2">
                {modeloNomeAtual && !removerModelo && !arquivo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{modeloNomeAtual}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        setRemoverModelo(true);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {arquivo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="truncate">{arquivo.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        setArquivo(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <Input
                  ref={fileInputRef}
                  id="td-modelo"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="h-10 cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">PDF, DOC ou DOCX — máx. 10MB</p>
              </div>
            </div>

            {/* Ativo toggle */}
            <div className="flex items-center gap-3">
              <Switch id="td-ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="td-ativo">Ativo</Label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tipos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum tipo de documento cadastrado.
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[70px] text-center">Modelo</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipos.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.codigo}</TableCell>
                      <TableCell className="text-sm">{t.descricao}</TableCell>
                      <TableCell className="text-center">
                        {t.modelo_url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(t.modelo_url!, "_blank")}
                            title={t.modelo_nome || "Abrir modelo"}
                          >
                            <FileText className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.ativo ? "default" : "secondary"} className={t.ativo ? "bg-green-600 hover:bg-green-700" : ""}>
                          {t.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Desktop actions */}
                        <div className="hidden sm:flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={togglingId === t.id}
                            onClick={() => handleToggleAtivo(t)}
                          >
                            {togglingId === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : t.ativo ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingId === t.id}
                            onClick={() => handleDelete(t)}
                          >
                            {deletingId === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>

                        {/* Mobile dropdown */}
                        <div className="flex sm:hidden justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEdit(t)} className="gap-2">
                                <Edit className="h-3.5 w-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleAtivo(t)}
                                disabled={togglingId === t.id}
                                className="gap-2"
                              >
                                {t.ativo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                {t.ativo ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(t)}
                                disabled={deletingId === t.id}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    </div>
  );
}
