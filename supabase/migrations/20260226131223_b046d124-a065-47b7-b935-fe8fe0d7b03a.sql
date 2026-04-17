
-- Nova tabela para armazenar apontamentos por atividade (novo fluxo)
CREATE TABLE public.apontamento_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id UUID NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  cliente TEXT NOT NULL,
  atividade_codigo TEXT NOT NULL,
  atividade_descricao TEXT NOT NULL,
  horas NUMERIC NOT NULL DEFAULT 0,
  modalidade TEXT NOT NULL DEFAULT 'Remoto',
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apontamento_atividades ENABLE ROW LEVEL SECURITY;

-- Users can insert their own records
CREATE POLICY "Users can insert own apontamento_atividades"
ON public.apontamento_atividades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view own, admin all, coordenador their projects
CREATE POLICY "Users can view apontamento_atividades"
ON public.apontamento_atividades
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
    SELECT 1 FROM projetos p WHERE p.nome_cliente = apontamento_atividades.cliente AND p.coordenador_id = auth.uid()
  ))
);

-- Admin and coordenador can update
CREATE POLICY "Admin and coordenador can update apontamento_atividades"
ON public.apontamento_atividades
FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
    SELECT 1 FROM projetos p WHERE p.nome_cliente = apontamento_atividades.cliente AND p.coordenador_id = auth.uid()
  ))
);

-- Admin and coordenador can delete
CREATE POLICY "Admin and coordenador can delete apontamento_atividades"
ON public.apontamento_atividades
FOR DELETE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
    SELECT 1 FROM projetos p WHERE p.nome_cliente = apontamento_atividades.cliente AND p.coordenador_id = auth.uid()
  ))
);
