
-- Add coordenador_id to projetos
ALTER TABLE public.projetos ADD COLUMN coordenador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Split contato_cliente into nome and telefone
ALTER TABLE public.projetos ADD COLUMN contato_nome text;
ALTER TABLE public.projetos ADD COLUMN contato_telefone text;

-- Migrate existing contato_cliente data to contato_nome (best effort)
UPDATE public.projetos SET contato_nome = contato_cliente WHERE contato_cliente IS NOT NULL;

-- Drop old column
ALTER TABLE public.projetos DROP COLUMN contato_cliente;
