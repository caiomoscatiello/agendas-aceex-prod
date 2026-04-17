
-- Add status and rejection reason to requisicoes_agenda
ALTER TABLE public.requisicoes_agenda 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

-- Drop old SELECT policy and recreate to include coordinators
DROP POLICY IF EXISTS "Users can view own requisicoes" ON public.requisicoes_agenda;
CREATE POLICY "Users can view requisicoes"
  ON public.requisicoes_agenda FOR SELECT
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
      SELECT 1 FROM projetos p WHERE p.nome_cliente = requisicoes_agenda.cliente AND p.coordenador_id = auth.uid()
    ))
  );

-- Allow coordinators to update requisicoes for their projects
CREATE POLICY "Coordenador can update requisicoes"
  ON public.requisicoes_agenda FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
      SELECT 1 FROM projetos p WHERE p.nome_cliente = requisicoes_agenda.cliente AND p.coordenador_id = auth.uid()
    ))
  );
