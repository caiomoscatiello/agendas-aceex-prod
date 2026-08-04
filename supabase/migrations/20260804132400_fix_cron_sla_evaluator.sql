-- sla-evaluator (BL-013 P2) nunca teve um cron job real em producao. O
-- comentario de cabecalho do arquivo so documentava como criar um
-- manualmente via cron.schedule com a URL do Aceex hardcoded e um
-- Authorization Bearer com a service role key embutido no texto do job --
-- nunca foi de fato executado (confirmado via `select * from cron.job`).
--
-- Corrigido: sla-evaluator foi redeployado com verify_jwt=false (mesmo
-- padrao de check-alertas e health-score-semanal), entao o cron nao precisa
-- mais carregar a service role key em texto. A URL vem de
-- app_settings.supabase_functions_url (ja existe), tornando o job
-- reproduzivel em qualquer clone.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio (idempotente --
-- pode ser reaplicado com seguranca em qualquer clone).

select cron.unschedule('sla-evaluator-diario')
where exists (
  select 1 from cron.job where jobname = 'sla-evaluator-diario'
);

do $$
declare
  v_functions_url text;
begin
  select value into v_functions_url from app_settings where key = 'supabase_functions_url';

  if v_functions_url is null or v_functions_url = '' then
    raise exception 'app_settings.supabase_functions_url nao configurado -- nao e possivel criar o cron job de sla-evaluator';
  end if;

  perform cron.schedule(
    'sla-evaluator-diario',
    '0 11 * * *',
    format(
      $sql$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json'), body := '{}'::jsonb)$sql$,
      v_functions_url || '/sla-evaluator'
    )
  );
end $$;
