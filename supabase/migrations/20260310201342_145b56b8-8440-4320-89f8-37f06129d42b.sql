
CREATE TABLE public.email_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  copia text[] NOT NULL DEFAULT '{}',
  corpo_email text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage email_workflows"
ON public.email_workflows
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view email_workflows"
ON public.email_workflows
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_email_workflows_updated_at
  BEFORE UPDATE ON public.email_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
