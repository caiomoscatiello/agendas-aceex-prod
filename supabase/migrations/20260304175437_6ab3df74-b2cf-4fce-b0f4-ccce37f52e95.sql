
CREATE TABLE public.cronograma_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade_id UUID NOT NULL REFERENCES public.projeto_atividades(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  horas_reservadas NUMERIC NOT NULL DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage cronograma_itens"
  ON public.cronograma_itens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordenador can manage cronograma_itens"
  ON public.cronograma_itens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "Users can view cronograma_itens"
  ON public.cronograma_itens FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
