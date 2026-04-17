
-- Create table for multiple Protheus integrations
CREATE TABLE public.protheus_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  direcao text NOT NULL DEFAULT 'Recebe' CHECK (direcao IN ('Envia e Recebe', 'Envia', 'Recebe')),
  api_key text NOT NULL DEFAULT gen_random_uuid()::text,
  ativo boolean NOT NULL DEFAULT true,
  webhook_path text NOT NULL DEFAULT '',
  payload_exemplo jsonb,
  guia_integracao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protheus_integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage protheus_integracoes"
ON public.protheus_integracoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_protheus_integracoes_updated_at
BEFORE UPDATE ON public.protheus_integracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with current integration migrated as 0001
INSERT INTO public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
VALUES (
  '0001',
  'Integ. User',
  'Recebe',
  'protheus-users',
  '{"codigo": "{{SZ3->Z3_CODUSR}}", "nome": "{{SZ3->Z3_NOME}}", "email": "{{SZ3->Z3_EMAIL}}", "cargo": "{{SZ3->Z3_CARGO}}"}'::jsonb,
  E'Trigger: Execute this POST every time a new record is inserted in SZ3 table.\n\nValores válidos para "cargo":\n  "C" = Coordenador\n  "A" ou "T" = Consultor'
);
