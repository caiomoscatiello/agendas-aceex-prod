-- Correcao de arquitetura (2026-08-24, mesma tarde do commit anterior sobre
-- Vercel): o Caio corrigiu que cada AMBIENTE tem sua PROPRIA conta Vercel
-- (do cliente, nao da PROJTE) -- "o cliente tem seu vercel...cada cliente
-- tera seu vercel com qa e prod". A automacao (projte-publish-frontend)
-- agora usa um Personal Access Token POR AMBIENTE (Vault), no mesmo padrao
-- ja usado pro management_token do Supabase, em vez de um secret global.
--
-- Esta migration so adiciona 'vercel_token' na lista de tipos aceitos pela
-- tabela ambiente_secrets (mesma tabela/mesmo fluxo de Segredos que ja
-- existe na tela, via projte-manage-secret).

alter table projte_config.ambiente_secrets drop constraint ambiente_secrets_tipo_check;
alter table projte_config.ambiente_secrets add constraint ambiente_secrets_tipo_check
  check (tipo = any (array['service_role_key'::text, 'anon_key'::text, 'db_password'::text, 'management_token'::text, 'monitor_credentials'::text, 'suite_fixture_credentials'::text, 'vercel_token'::text, 'outro'::text]));
