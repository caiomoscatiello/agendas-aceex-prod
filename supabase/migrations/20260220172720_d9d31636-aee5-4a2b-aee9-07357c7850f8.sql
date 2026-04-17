
-- Add status column to agendas
ALTER TABLE public.agendas ADD COLUMN status text NOT NULL DEFAULT 'confirmada';

-- Create solicitacoes_cancelamento table
CREATE TABLE public.solicitacoes_cancelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solicitacoes_cancelamento ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert own solicitacoes"
ON public.solicitacoes_cancelamento
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own solicitacoes"
ON public.solicitacoes_cancelamento
FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update solicitacoes"
ON public.solicitacoes_cancelamento
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete solicitacoes"
ON public.solicitacoes_cancelamento
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to update agendas status
CREATE POLICY "Admin can update agendas"
ON public.agendas
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
