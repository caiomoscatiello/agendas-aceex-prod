-- projeto_alertas nunca teve uma migration de criacao no repositorio -- foi
-- criada fora de qualquer arquivo .sql (provavelmente editor visual do
-- Lovable), o que so foi descoberto quando o provisionamento de um ambiente
-- QA novo (via botao "Criar Ambiente") falhou na migration
-- fix_rls_projeto_alertas com "relation projeto_alertas does not exist".
-- DDL abaixo reconstruido via introspecao do schema real de producao
-- (colunas, tipos, defaults, PK, FK). Usa IF NOT EXISTS para ser inofensivo
-- em producao (onde a tabela ja existe) e efetivo em clones novos.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio (idempotente).

create table if not exists public.projeto_alertas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id),
  tipo varchar not null,
  severidade varchar not null,
  titulo varchar not null,
  detalhe text,
  referencia_id uuid,
  referencia_tipo varchar,
  status varchar default 'ativo',
  resolvido_por uuid,
  resolvido_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projeto_alertas enable row level security;
