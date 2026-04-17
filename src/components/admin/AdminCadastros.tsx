import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderPlus, UserPlus, FileText } from "lucide-react";
import AdminProjetos from "./AdminProjetos";
import AdminCadastroUsuarios from "./AdminCadastroUsuarios";
import AdminTiposDocumento from "./AdminTiposDocumento";

export default function AdminCadastros() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="projetos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projetos" className="gap-2 text-xs sm:text-sm">
            <FolderPlus className="h-4 w-4" />
            Projetos
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 text-xs sm:text-sm">
            <UserPlus className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="projetos">
          <AdminProjetos />
        </TabsContent>
        <TabsContent value="usuarios">
          <AdminCadastroUsuarios />
        </TabsContent>
        <TabsContent value="documentos">
          <AdminTiposDocumento />
        </TabsContent>
      </Tabs>
    </div>
  );
}
