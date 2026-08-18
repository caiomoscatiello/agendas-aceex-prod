-- Registra 20260804220000_create_projeto_alertas.sql dentro de
-- projte_config.template_migrations (fonte de dados lida em runtime pela
-- edge function projte-provision-ambiente), na posicao seq=55, logo antes
-- de fix_rls_projeto_alertas (que depende dessa tabela existir). As
-- migrations que ja estavam em seq>=55 pra release v1.0.0 sao deslocadas
-- +1 pra abrir espaco.
--
-- Aplicado em producao via MCP execute_sql em 2026-08-04 (a tabela
-- template_migrations em si so existe no projeto PROJTE/Aceex de controle,
-- nao nos clones de cliente -- ver migration
-- 20260804210000_create_template_migrations.sql). Este arquivo registra a
-- mesma alteracao no historico do repositorio. Guardado por "not exists"
-- pra ser seguro de reaplicar.

do $seed_alertas_fix$
declare
  v_release_id uuid;
begin
  select id into v_release_id
  from projte_config.template_releases
  where versao = 'v1.0.0'
  limit 1;

  if v_release_id is null then
    raise notice 'release v1.0.0 nao encontrada -- pulando seed de projeto_alertas em template_migrations.';
    return;
  end if;

  if exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id
      and name = '20260804220000_create_projeto_alertas.sql'
  ) then
    raise notice 'migration create_projeto_alertas ja registrada em template_migrations -- pulando.';
    return;
  end if;

  update projte_config.template_migrations
  set seq = seq + 1000
  where template_release_id = v_release_id
    and seq >= 55;

  update projte_config.template_migrations
  set seq = seq - 999
  where template_release_id = v_release_id
    and seq >= 1055;

  insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
    55,
    '20260804220000_create_projeto_alertas.sql',
    $pjcreateprojetoalertas$-- projeto_alertas nunca teve uma migration de criacao no repositorio -- foi
-- criada fora de qualquer arquivo .sql (provavelmente editor visual do
-- Lovable), o que so foi descoberto quando o provisionamento de um ambiente
-- QA novo falhou na migration fix_rls_projeto_alertas com "relation
-- projeto_alertas does not exist". DDL abaixo reconstruido via introspecao
-- do schema real de producao (colunas, tipos, defaults, PK, FK). Usa
-- IF NOT EXISTS para ser inofensivo em producao (onde a tabela ja existe) e
-- efetivo em clones novos.

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

alter table public.projeto_alertas enable row level security;$pjcreateprojetoalertas$,
    v_release_id
  );
end
$seed_alertas_fix$;
