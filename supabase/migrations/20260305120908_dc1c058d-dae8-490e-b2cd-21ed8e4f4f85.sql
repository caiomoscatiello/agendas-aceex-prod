
ALTER TABLE public.despesas 
  ADD COLUMN IF NOT EXISTS envio_financeiro text,
  ADD COLUMN IF NOT EXISTS data_envio_fin date;
