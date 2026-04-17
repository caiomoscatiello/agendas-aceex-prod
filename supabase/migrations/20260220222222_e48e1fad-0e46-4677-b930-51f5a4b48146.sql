
-- Projects main table
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente text NOT NULL,
  site_cliente text,
  endereco_cliente text,
  contato_cliente text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage projetos" ON public.projetos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view projetos" ON public.projetos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Project expense types with max values
CREATE TABLE public.projeto_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tipo_despesa text NOT NULL,
  valor_maximo numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.projeto_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage projeto_despesas" ON public.projeto_despesas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view projeto_despesas" ON public.projeto_despesas FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Project activities
CREATE TABLE public.projeto_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  descricao text NOT NULL,
  horas numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.projeto_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage projeto_atividades" ON public.projeto_atividades FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view projeto_atividades" ON public.projeto_atividades FOR SELECT
  USING (auth.uid() IS NOT NULL);
