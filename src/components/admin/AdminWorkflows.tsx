import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Pencil, Mail, RefreshCw, Eye, Code } from "lucide-react";

interface Workflow {
  id: string;
  codigo: string;
  descricao: string;
  copia: string[];
  corpo_email: string;
  ativo: boolean;
  updated_at: string;
}

export default function AdminWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [copiaInput, setCopiaInput] = useState("");
  const [corpoEmail, setCorpoEmail] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWorkflows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_workflows")
      .select("*")
      .order("codigo");
    if (error) {
      toast({ title: "Erro ao carregar workflows", description: error.message, variant: "destructive" });
    } else {
      setWorkflows((data as unknown as Workflow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const openEdit = (wf: Workflow) => {
    setEditing(wf);
    setCopiaInput(wf.copia.join(", "));
    setCorpoEmail(wf.corpo_email);
    setAtivo(wf.ativo);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const copiaArray = copiaInput
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("email_workflows")
      .update({
        copia: copiaArray as any,
        corpo_email: corpoEmail,
        ativo,
      })
      .eq("id", editing.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workflow atualizado com sucesso" });
      setEditing(null);
      loadWorkflows();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Workflows de E-mail</h2>
        <Button variant="outline" size="sm" onClick={loadWorkflows} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : workflows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum workflow cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {workflows.map((wf) => (
            <Card key={wf.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{wf.descricao}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={wf.ativo ? "default" : "secondary"}>
                      {wf.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(wf)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm text-muted-foreground">
                <p><strong>Código:</strong> {wf.codigo}</p>
                {wf.copia.length > 0 && (
                  <p><strong>Cópia (CC):</strong> {wf.copia.join(", ")}</p>
                )}
                <p className="line-clamp-2"><strong>Corpo:</strong> {wf.corpo_email || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Workflow: {editing?.descricao}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input value={editing?.codigo || ""} disabled />
            </div>
            <div>
              <Label>Cópia (CC)</Label>
              <Input
                placeholder="email1@exemplo.com, email2@exemplo.com"
                value={copiaInput}
                onChange={(e) => setCopiaInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Separe múltiplos e-mails por vírgula</p>
            </div>
            <div>
              <Label className="mb-2 block">Corpo do E-mail</Label>
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="editor" className="gap-1">
                    <Code className="h-3.5 w-3.5" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    Visualizar
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <Textarea
                    rows={14}
                    className="font-mono text-xs"
                    value={corpoEmail}
                    onChange={(e) => setCorpoEmail(e.target.value)}
                    placeholder="Texto ou template HTML do corpo do e-mail"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="rounded-md border bg-white p-4 min-h-[280px] max-h-[400px] overflow-auto">
                    {corpoEmail ? (
                      <iframe
                        srcDoc={corpoEmail}
                        title="Preview do e-mail"
                        className="w-full min-h-[260px] border-0"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Nenhum conteúdo para visualizar.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
