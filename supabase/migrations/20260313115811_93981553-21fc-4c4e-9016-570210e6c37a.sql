ALTER TABLE public.agendas ALTER COLUMN flag_integracao SET DEFAULT 'LOVABLE';

-- Update existing APP records to LOVABLE
UPDATE public.agendas SET flag_integracao = 'LOVABLE' WHERE flag_integracao = 'APP';