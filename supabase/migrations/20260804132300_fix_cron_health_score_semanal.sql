-- Mesmo padrao de bug corrigido em 20260804124759_fix_cron_check_alertas.sql:
-- o job 'health-score-semanal' tem a URL do Aceex hardcoded direto no
-- comando do cron (https://ofolgjtqgmudfeoppwtb.supabase.co/functions/v1/
-- health-score-calculator). Confirmado via `select * from cron.job`
-- (jobid=1, schedule '59 23 * * 0'). Corrigido pra usar
-- app_settings.supabase_functions_url (ja existe, inserido pela migration
-- anterior), tornando o job reproduzivel em qualquer clone.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio (idempotente --
-- pode ser reaplicado com seguranca em qualquer clone).

select cron.unschedule('health-score-semanal')
where exists (
  select 1 from cron.job where jobname = 'health-score-semanal'
);

do $$
declare
  v_functions_url text;
begin
  select value into v_functions_url from app_settings where key = 'supabase_functions_url';

  if v_functions_url is null or v_functions_url = '' then
    raise exception 'app_settings.supabase_functions_url nao configurado -- nao e possivel criar o cron job de health-score-semanal';
  end if;

  perform cron.schedule(
    'health-score-semanal',
    '59 23 * * 0',
    format(
      $sql$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json'), body := '{}'::jsonb)$sql$,
      v_functions_url || '/health-score-calculator'
    )
  );
end $$;
