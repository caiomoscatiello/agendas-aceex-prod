-- Bug real encontrado em 2026-08-24: as Edge Functions projte-check-ambiente
-- (etapa 4 "Verificar Ambiente"), projte-verificar-camada3 (etapa 6 "Login
-- camada 3") e projte-rodar-suite-completa (etapa 7 "Suite Completa camada
-- 4") sempre gravam tipo='verificacao' em provisionamento_logs -- mas o
-- CHECK original (20260804172654_create_projte_config_schema.sql) só
-- permitia 'provisionamento'/'atualizacao'. Toda gravação dessas 3 etapas
-- vinha falhando (violação de constraint) desde que essas functions foram
-- escritas, e o erro nunca aparecia porque nenhum dos call sites checava
-- o retorno do .insert(). Resultado visível pro usuário: os chips 4/6/7 do
-- sequenciador (Config PROJTE > Ambientes) nunca tinham histórico
-- persistido -- pareciam "esquecer" toda vez que a tela recarregava, mesmo
-- quando a ação (dispatch do GitHub Actions, checagem do ambiente) tinha
-- funcionado de verdade.

alter table projte_config.provisionamento_logs
  drop constraint provisionamento_logs_tipo_check;

alter table projte_config.provisionamento_logs
  add constraint provisionamento_logs_tipo_check
  check (tipo in ('provisionamento', 'atualizacao', 'verificacao'));
