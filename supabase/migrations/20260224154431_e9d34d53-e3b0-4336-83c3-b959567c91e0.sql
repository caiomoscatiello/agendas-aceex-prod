
-- Allow coordenadores to view all apontamentos
DROP POLICY IF EXISTS "Users can view own apontamentos" ON public.apontamentos;

CREATE POLICY "Users can view own apontamentos"
ON public.apontamentos
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);
