CREATE POLICY "Admin and coordenador can delete requisicoes"
ON public.requisicoes_agenda
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'coordenador'::app_role)
    AND EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.nome_cliente = requisicoes_agenda.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);