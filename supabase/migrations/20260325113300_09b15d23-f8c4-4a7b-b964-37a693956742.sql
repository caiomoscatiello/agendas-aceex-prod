
CREATE TABLE public.tipos_documento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,
  descricao   TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  modelo_url  TEXT,
  modelo_nome TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tipos_documento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tipos_documento" ON public.tipos_documento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordenador can manage tipos_documento" ON public.tipos_documento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "Authenticated users can view tipos_documento" ON public.tipos_documento
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS doc_exigido        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_documento_id  UUID REFERENCES public.tipos_documento(id),
  ADD COLUMN IF NOT EXISTS doc_satisfeito     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS doc_satisfeito_em  TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-modelo', 'documentos-modelo', true);

CREATE POLICY "Authenticated users can upload documentos-modelo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-modelo');

CREATE POLICY "Authenticated users can update documentos-modelo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-modelo');

CREATE POLICY "Authenticated users can delete documentos-modelo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-modelo');

CREATE POLICY "Public can view documentos-modelo"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'documentos-modelo');
