-- Bug encontrado no primeiro teste real da etapa "usuario de monitoramento"
-- (parte da camada 3 de verificacao de ambiente): o codigo TS de
-- projte-provision-ambiente e projte-manage-secret foi atualizado pra
-- aceitar o tipo 'monitor_credentials', mas essa CHECK constraint (a fonte
-- de verdade real no banco) nao foi -- o insert em ambiente_secrets falhava
-- silenciosamente porque o codigo so checava o erro do vault_create_secret,
-- nao o erro do insert seguinte. O log de provisionamento dizia "ok" mas a
-- linha em ambiente_secrets nunca existia.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio.

alter table projte_config.ambiente_secrets drop constraint if exists ambiente_secrets_tipo_check;

alter table projte_config.ambiente_secrets
  add constraint ambiente_secrets_tipo_check
  check (tipo = any (array[
    'service_role_key', 'anon_key', 'db_password', 'management_token',
    'monitor_credentials', 'outro'
  ]));
