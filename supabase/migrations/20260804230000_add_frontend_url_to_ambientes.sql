-- Camada 3 da verificacao de ambiente ("esta no ar de verdade, com um
-- usuario de verdade clicando"): precisa saber ONDE o frontend do cliente
-- esta publicado. Hoje isso nao existe em lugar nenhum -- o botao "Criar
-- Ambiente" so espelha o schema no Supabase, nao publica frontend (ver
-- docs/etapa3-config-projte.md secao 3, "fase futura"). Esse campo fica
-- vazio ate existir automacao de deploy de frontend; por enquanto e
-- preenchido manualmente quando/se um frontend for publicado pra esse
-- cliente.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio (idempotente).

alter table projte_config.ambientes
  add column if not exists frontend_url text;
