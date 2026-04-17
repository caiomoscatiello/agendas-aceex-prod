
-- Create despesas table
CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data_lancamento date NOT NULL,
  hora_lancamento time NOT NULL,
  local_lancamento text,
  data_despesa date NOT NULL,
  cliente text NOT NULL,
  valor numeric NOT NULL,
  descricao text NOT NULL,
  foto_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own despesas"
ON public.despesas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own despesas"
ON public.despesas FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own despesas"
ON public.despesas FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for expense photos
INSERT INTO storage.buckets (id, name, public) VALUES ('despesas-fotos', 'despesas-fotos', true);

CREATE POLICY "Users can upload expense photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'despesas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view expense photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'despesas-fotos');

CREATE POLICY "Users can delete own expense photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'despesas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
