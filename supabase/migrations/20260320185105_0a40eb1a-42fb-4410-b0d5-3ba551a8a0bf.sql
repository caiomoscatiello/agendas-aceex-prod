CREATE TABLE IF NOT EXISTS public.projeto_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  versao text NOT NULL DEFAULT 'v1',
  descricao text,
  snapshot jsonb NOT NULL,
  salvo_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam baselines"
  ON public.projeto_baseline FOR ALL
  USING (auth.uid() IS NOT NULL);