
-- Allow coordenadores to view all agendas (not just their own)
DROP POLICY IF EXISTS "Users can view own agendas" ON public.agendas;

CREATE POLICY "Users can view own agendas"
ON public.agendas
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);
