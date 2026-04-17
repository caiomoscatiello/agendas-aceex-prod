INSERT INTO public.app_settings (key, value)
VALUES ('app_url', 'https://agendas-aceex.lovable.app')
ON CONFLICT (key) DO NOTHING;