import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Settings, Ban, Clock, ClipboardCheck, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminCarregarAgendas from "./AdminCarregarAgendas";
import AdminManutencaoAgendas from "./AdminManutencaoAgendas";
import AdminSolicitacoesCancelamento from "./AdminSolicitacoesCancelamento";
import AdminPendentes from "./AdminPendentes";
import AdminAprovarOS from "./AdminAprovarOS";
import AdminAgendasPendentes from "./AdminAgendasPendentes";

const tabOptions = [
  { value: "solicitacoes", label: "Solicitações", icon: Clock },
  { value: "pendentes", label: "Pendentes", icon: AlertTriangle },
  { value: "aprovar", label: "Aprovar OS", icon: ClipboardCheck },
  { value: "carregar", label: "Incluir", icon: PlusCircle },
  { value: "manutencao", label: "Manutenção", icon: Settings },
  { value: "cancelamentos", label: "Cancelamentos", icon: Ban },
];

export default function AdminAgendas() {
  const [activeTab, setActiveTab] = useState("solicitacoes");
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isMobile ? (
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tabOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <TabsList className="grid w-full grid-cols-6">
            {tabOptions.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="gap-2 text-xs sm:text-sm">
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <TabsContent value="solicitacoes"><AdminPendentes /></TabsContent>
        <TabsContent value="pendentes"><AdminAgendasPendentes /></TabsContent>
        <TabsContent value="aprovar"><AdminAprovarOS /></TabsContent>
        <TabsContent value="carregar"><AdminCarregarAgendas /></TabsContent>
        <TabsContent value="manutencao"><AdminManutencaoAgendas /></TabsContent>
        <TabsContent value="cancelamentos"><AdminSolicitacoesCancelamento /></TabsContent>
      </Tabs>
    </div>
  );
}
