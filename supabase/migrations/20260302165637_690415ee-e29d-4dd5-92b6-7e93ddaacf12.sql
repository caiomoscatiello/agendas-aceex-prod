
-- Create integration_logs table
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  codigo text,
  payload jsonb,
  status text NOT NULL DEFAULT 'error',
  message text,
  http_status integer
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage integration_logs"
ON public.integration_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed protheus_api_key into app_settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES ('protheus_api_key', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;
