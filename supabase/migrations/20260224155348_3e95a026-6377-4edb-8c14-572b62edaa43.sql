
-- Update agendas SELECT: coordenadores only see agendas from their projects
DROP POLICY IF EXISTS "Users can view own agendas" ON public.agendas;

CREATE POLICY "Users can view own agendas"
ON public.agendas
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update agendas INSERT: coordenadores only for their projects
DROP POLICY IF EXISTS "Admin and coordenador can insert agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can insert agendas"
ON public.agendas
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update agendas UPDATE: coordenadores only for their projects
DROP POLICY IF EXISTS "Admin and coordenador can update agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can update own agenda status" ON public.agendas;

CREATE POLICY "Admin and coordenador can update agendas"
ON public.agendas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR auth.uid() = user_id
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update agendas DELETE: coordenadores only for their projects
DROP POLICY IF EXISTS "Admin and coordenador can delete agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can delete agendas"
ON public.agendas
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update apontamentos SELECT: coordenadores only see from their projects
DROP POLICY IF EXISTS "Users can view own apontamentos" ON public.apontamentos;

CREATE POLICY "Users can view own apontamentos"
ON public.apontamentos
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = apontamentos.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);
