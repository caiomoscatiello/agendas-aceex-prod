-- Camada 4 (suite BL-020 completa contra ambiente de cliente): novo tipo de
-- segredo, uma UNICA linha JSON com as credenciais dos 3 usuarios fixture
-- (consultor/coordenador/admin) + os ids do projeto/atividade fixture
-- semeados no banco do cliente -- em vez de 3 linhas separadas, seguindo o
-- mesmo formato ja usado por 'monitor_credentials' (ver migration
-- 20260804231000_add_monitor_credentials_secret_type.sql).
alter table projte_config.ambiente_secrets drop constraint if exists ambiente_secrets_tipo_check;
alter table projte_config.ambiente_secrets
  add constraint ambiente_secrets_tipo_check
  check (tipo = any (array[
    'service_role_key', 'anon_key', 'db_password', 'management_token',
    'monitor_credentials', 'suite_fixture_credentials', 'outro'
  ]));
