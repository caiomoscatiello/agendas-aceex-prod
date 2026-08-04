-- Corrige supabase/migrations/20260416_cron_check_alertas.sql, que nao era
-- SQL valido (sobrou o comando PowerShell heredoc usado pra gerar o arquivo,
-- salvo por engano no lugar do SQL resultante -- comecava com `@"` e
-- terminava com `"@ | Set-Content ...`). Confirmado via `select * from
-- cron.job` que o job 'check-alertas-diario' nunca existiu de fato -- o
-- e-mail diario de alertas nunca rodou automaticamente em producao.
--
-- Alem de corrigir a sintaxe, remove o hardcode do dominio do Aceex: em vez
-- de escrever a URL do projeto Supabase direto no comando do cron job, essa
-- URL agora vem de app_settings.supabase_functions_url. Isso permite que a
-- MESMA migration seja reaplicada em qualquer clone -- so precisa que o
-- onboarding do cliente novo configure essa chave antes de rodar as
-- migrations (ver docs/etapa1-auditoria-clonagem.md).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Valor default aponta pro projeto ATUAL (Aceex). Cada clone deve atualizar
-- essa linha pro seu proprio projeto Supabase durante o onboarding.
insert into app_settings (key, value)
values ('supabase_functions_url', 'https://ofolgjtqgmudfeoppwtb.supabase.co/functions/v1')
on conflict (key) do nothing;

select cron.unschedule('check-alertas-diario')
where exists (
  select 1 from cron.job where jobname = 'check-alertas-diario'
);

do $$
declare
  v_functions_url text;
begin
  select value into v_functions_url from app_settings where key = 'supabase_functions_url';

  if v_functions_url is null or v_functions_url = '' then
    raise exception 'app_settings.supabase_functions_url nao configurado -- nao e possivel criar o cron job de check-alertas';
  end if;

  perform cron.schedule(
    'check-alertas-diario',
    '0 11 * * *',
    format(
      $sql$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json'), body := '{}'::jsonb)$sql$,
      v_functions_url || '/check-alertas'
    )
  );
end $$;
