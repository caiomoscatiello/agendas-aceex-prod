
-- Allow coordenadores to insert agendas
DROP POLICY IF EXISTS "Admin can insert agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can insert agendas"
ON public.agendas
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);

-- Allow coordenadores to update agendas
DROP POLICY IF EXISTS "Admin can update agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can update agendas"
ON public.agendas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);

-- Allow coordenadores to delete agendas
DROP POLICY IF EXISTS "Admin can delete agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can delete agendas"
ON public.agendas
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);
