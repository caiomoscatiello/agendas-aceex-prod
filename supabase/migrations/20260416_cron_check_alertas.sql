@"
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('check-alertas-diario')
where exists (
  select 1 from cron.job where jobname = 'check-alertas-diario'
);

select cron.schedule(
  'check-alertas-diario',
  '0 11 * * *',
  `$`$
  select net.http_post(
    url := 'https://ofolgjtqgmudfeoppwtb.supabase.co/functions/v1/check-alertas',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  `$`$
);
"@ | Set-Content supabase/migrations/20260416_cron_check_alertas.sql