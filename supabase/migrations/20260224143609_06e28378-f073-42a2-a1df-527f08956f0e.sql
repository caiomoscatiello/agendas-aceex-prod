
-- Allow coordenadores to manage projetos
CREATE POLICY "Coordenador can manage projetos"
ON public.projetos FOR ALL
USING (has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));

-- Allow coordenadores to manage projeto_despesas
CREATE POLICY "Coordenador can manage projeto_despesas"
ON public.projeto_despesas FOR ALL
USING (has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));

-- Allow coordenadores to manage projeto_atividades
CREATE POLICY "Coordenador can manage projeto_atividades"
ON public.projeto_atividades FOR ALL
USING (has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));
