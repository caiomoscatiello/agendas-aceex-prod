
-- Permitir que coordenadores leiam todas as solicitações de cancelamento
CREATE POLICY "coordenadores_read_solicitacoes"
ON public.solicitacoes_cancelamento
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador'::app_role)
);
