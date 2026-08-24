-- Bug real encontrado em 2026-08-24: comparando todas as tabelas de
-- public na producao (projeto PROJTE/Aceex, ofolgjtqgmudfeoppwtb) contra o
-- que esta registrado em projte_config.template_migrations, faltavam 19
-- tabelas inteiras -- nunca tiveram uma migration no repositorio (foram
-- criadas fora de qualquer arquivo .sql, mesmo padrao ja visto antes com
-- projeto_alertas, ver 20260804220100_seed_projeto_alertas_into_template_migrations.sql).
-- Isso significa que TODO ambiente de cliente provisionado via "Criar
-- Ambiente" ficava sem: backlog (kanban completo), diario do projeto +
-- mencoes, SLA (config global/projeto + resultados), o sistema BL-020 de
-- QA (qa_skills/qa_agents/qa_runs/qa_run_steps/qa_feedback), pendencias,
-- config de alertas, disponibilidade do consultor e feriados nacionais.
-- Descoberto ao investigar por que o teardown da suite completa (camada 4)
-- reclamava de "Could not find the table 'public.projeto_diario'" etc. no
-- ambiente QA existente.
--
-- DDL abaixo reconstruido via introspecao do schema real de producao
-- (pg_attribute/pg_constraint/pg_policies/pg_trigger/pg_indexes -- colunas,
-- tipos, defaults, PK/FK/UNIQUE/CHECK, RLS+policies, triggers e as funcoes
-- que eles chamam, indices extras). Usa IF NOT EXISTS / CREATE OR REPLACE
-- onde a sintaxe permite, e policies sao criadas dentro de blocos com
-- exception duplicate_object, pra ser inofensivo se a producao (onde tudo
-- isso ja existe) ou um retry parcial reaplicar o texto.
--
-- Nao inclui dados (qa_skills tem 28 linhas em producao, por exemplo) --
-- "Criar Ambiente" sempre foi so espelho de schema, sem dados (ver texto
-- do proprio dialogo de confirmacao no ProjteConfigPage.tsx).
--
-- Ordem de aplicacao (seq 61-80) respeita as dependencias de FK entre as
-- tabelas novas: colunas antes de backlog, backlog antes de
-- comentarios/historico/participantes, diario antes de mencoes, skills
-- antes de runs, runs antes de run_steps/feedback. As funcoes (helpers de
-- RLS + funcoes de trigger) vao antes de tudo (seq 61), ja que varias
-- policies/triggers das tabelas dependem delas.

do $seed_missing_tables$
declare
  v_release_id uuid;
  v_seq integer;
begin
  select id into v_release_id
  from projte_config.template_releases
  where versao = 'v1.0.0'
  limit 1;

  if v_release_id is null then
    raise notice 'release v1.0.0 nao encontrada -- pulando seed das 19 tabelas faltantes.';
    return;
  end if;

  -- ===================================================================
  -- seq 61: funcoes usadas pelas policies/triggers das tabelas abaixo
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id
      and name = '20260824160000_create_backlog_diario_qa_sla_functions.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      61,
      '20260824160000_create_backlog_diario_qa_sla_functions.sql',
      $fn$-- Funcoes de trigger (updated_at/atualizado_em automatico) e um helper de
-- RLS (tem_acesso_via_backlog_item), usados pelas tabelas de backlog,
-- diario, QA (BL-020) e SLA registradas nas migrations seguintes.
-- has_role() e tem_acesso_projeto() ja existem desde a migration seq=1
-- (20260220163313_...sql) -- nao precisam ser recriadas aqui.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $f1$
begin
  new.updated_at = now();
  return new;
end;
$f1$;

create or replace function public.set_sla_updated_at()
returns trigger
language plpgsql
as $f2$
begin
  new.updated_at = now();
  return new;
end;
$f2$;

create or replace function public.set_projeto_diario_updated_at()
returns trigger
language plpgsql
as $f3$
begin
  new.updated_at = now();
  return new;
end;
$f3$;

create or replace function public.qa_set_atualizado_em()
returns trigger
language plpgsql
as $f4$
begin
  new.atualizado_em = now();
  return new;
end;
$f4$;

create or replace function public.update_backlog_updated_at()
returns trigger
language plpgsql
as $f5$
begin new.updated_at = now(); return new; end;
$f5$;

create or replace function public.gerar_codigo_backlog()
returns trigger
language plpgsql
as $f6$
declare
  prefixo text;
  seq integer;
begin
  select upper(regexp_replace(
    substring(regexp_replace(nome_cliente, '[^A-Za-z]', '', 'g'), 1, 3),
    '\s+', '', 'g'
  ))
  into prefixo
  from projetos where id = new.projeto_id;

  if prefixo is null or prefixo = '' then
    prefixo := 'BKL';
  end if;

  select coalesce(max(cast(split_part(codigo, '-', 2) as integer)), 0) + 1
  into seq
  from projeto_backlog
  where projeto_id = new.projeto_id
    and codigo ~ '^[A-Z]+-[0-9]+$';

  new.codigo := prefixo || '-' || lpad(seq::text, 3, '0');
  return new;
end;
$f6$;

-- tem_acesso_via_backlog_item depende da tabela projeto_backlog existir --
-- a migration seq=66 (create_projeto_backlog) roda antes desta ser
-- efetivamente exercitada (RLS so e avaliada em runtime, nao na criacao da
-- funcao), mas ela e criada aqui pra ficar junto das outras funcoes.
create or replace function public.tem_acesso_via_backlog_item(_item_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $f7$
  select tem_acesso_projeto(
    (select projeto_id from projeto_backlog where id = _item_id)
  )
$f7$;$fn$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 62: feriados_nacionais
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160100_create_feriados_nacionais.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      62, '20260824160100_create_feriados_nacionais.sql',
      $tbl$create table if not exists public.feriados_nacionais (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  nome text not null,
  tipo text not null default 'nacional' check (tipo in ('nacional','estadual','municipal','empresa'))
);
comment on table public.feriados_nacionais is 'BL-PORTFOLIO: Calendario de feriados para calculo de dias uteis';
alter table public.feriados_nacionais enable row level security;

do $p$ begin
  create policy feriados_admin_write on public.feriados_nacionais for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy feriados_read_all on public.feriados_nacionais for select to public
    using (auth.uid() is not null);
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 63: consultor_disponibilidade
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160200_create_consultor_disponibilidade.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      63, '20260824160200_create_consultor_disponibilidade.sql',
      $tbl$create table if not exists public.consultor_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ano integer not null check (ano >= 2024 and ano <= 2099),
  mes integer not null check (mes >= 1 and mes <= 12),
  percentual numeric not null default 100 check (percentual >= 0 and percentual <= 100),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ano, mes)
);
comment on table public.consultor_disponibilidade is 'BL-PORTFOLIO: Disponibilidade percentual do consultor por mes/ano';
alter table public.consultor_disponibilidade enable row level security;

create or replace trigger trg_consultor_disponibilidade_updated_at
  before update on public.consultor_disponibilidade
  for each row execute function set_updated_at();

do $p$ begin
  create policy disp_admin_full on public.consultor_disponibilidade for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy disp_coord_full on public.consultor_disponibilidade for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'coordenador'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy disp_consultor_read_own on public.consultor_disponibilidade for select to public
    using (user_id = auth.uid());
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 64: pendencias
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160300_create_pendencias.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      64, '20260824160300_create_pendencias.sql',
      $tbl$create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  titulo text not null check (char_length(trim(both from titulo)) > 0),
  descricao text,
  tipo text not null default 'pendencia' check (tipo in ('documentacao','ocorrencia','change_request','pendencia')),
  atribuido_para uuid not null,
  atribuido_tipo text not null default 'coordenador' check (atribuido_tipo in ('coordenador','consultor','cliente')),
  data_abertura date not null default current_date,
  data_prevista date,
  data_conclusao date,
  status_sla text not null default 'no_prazo' check (status_sla in ('no_prazo','em_risco','vencido','concluido')),
  origem text not null default 'manual' check (origem in ('manual','sistema')),
  criado_por uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pendencias enable row level security;
create index if not exists idx_pendencias_projeto on public.pendencias (projeto_id, status_sla);
create index if not exists idx_pendencias_atribuido on public.pendencias (atribuido_para, status_sla);
create index if not exists idx_pendencias_abertas on public.pendencias (data_abertura) where (data_conclusao is null);

create or replace trigger trg_pendencias_updated_at
  before update on public.pendencias
  for each row execute function set_sla_updated_at();

do $p$ begin
  create policy pendencias_admin_full on public.pendencias for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
    with check (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy pendencias_consultor_insert on public.pendencias for insert to public
    with check (criado_por = auth.uid());
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy pendencias_consultor_read on public.pendencias for select to public
    using (atribuido_para = auth.uid() or criado_por = auth.uid());
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy pendencias_coord_full on public.pendencias for all to public
    using (exists (select 1 from projetos where projetos.id = pendencias.projeto_id and projetos.coordenador_id = auth.uid()))
    with check (exists (select 1 from projetos where projetos.id = pendencias.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 65: projeto_alertas_config
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160400_create_projeto_alertas_config.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      65, '20260824160400_create_projeto_alertas_config.sql',
      $tbl$create table if not exists public.projeto_alertas_config (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id),
  alerta_feeling_ativo boolean default true,
  alerta_feeling_threshold integer default 20,
  alerta_apontamento_ativo boolean default true,
  alerta_apontamento_dias integer default 2,
  alerta_consumo_ativo boolean default true,
  alerta_consumo_threshold integer default 90,
  alerta_parada_ativo boolean default true,
  alerta_parada_dias integer default 7,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projeto_alertas_config enable row level security;

do $p$ begin
  create policy "Autenticados gerenciam alertas_config" on public.projeto_alertas_config for all to public
    using (auth.uid() is not null);
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 66: projeto_backlog_colunas
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160500_create_projeto_backlog_colunas.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      66, '20260824160500_create_projeto_backlog_colunas.sql',
      $tbl$create table if not exists public.projeto_backlog_colunas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  nome text not null,
  cor text not null default '#888780',
  ordem integer not null default 0,
  status_sistema character varying(20) check (status_sistema in ('aberto','em_andamento','em_revisao','concluido','cancelado')),
  wip_limite integer,
  created_at timestamptz not null default now(),
  unique (projeto_id, ordem) deferrable initially deferred
);
alter table public.projeto_backlog_colunas enable row level security;

do $p$ begin
  create policy colunas_select on public.projeto_backlog_colunas for select to authenticated
    using (tem_acesso_projeto(projeto_id));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy colunas_insert on public.projeto_backlog_colunas for insert to authenticated
    with check (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog_colunas.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy colunas_update on public.projeto_backlog_colunas for update to authenticated
    using (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog_colunas.projeto_id and projetos.coordenador_id = auth.uid()))
    with check (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog_colunas.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy colunas_delete on public.projeto_backlog_colunas for delete to authenticated
    using (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog_colunas.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 67: projeto_backlog
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160600_create_projeto_backlog.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      67, '20260824160600_create_projeto_backlog.sql',
      $tbl$create table if not exists public.projeto_backlog (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  coluna_id uuid not null references public.projeto_backlog_colunas(id),
  atividade_id uuid references public.projeto_atividades(id),
  cronograma_item_id uuid references public.cronograma_itens(id),
  pai_id uuid references public.projeto_backlog(id),
  titulo text not null,
  descricao_solicitante text,
  descricao_complementar text,
  descricao_solucao text,
  tipo character varying(20) not null default 'melhoria' check (tipo in ('melhoria','bug','duvida','configuracao','treinamento','outro')),
  prioridade character varying(10) not null default 'media' check (prioridade in ('critica','alta','media','baixa')),
  prioridade_reclassificada character varying(10) check (prioridade_reclassificada in ('critica','alta','media','baixa')),
  frente_modulo character varying(20) not null default 'outro' check (frente_modulo in ('fiscal','financeiro','estoque','compras','rh','contabil','outro')),
  estimativa_horas numeric(5,2),
  tempo_efetivo_horas numeric(5,2),
  criado_por uuid not null references auth.users(id),
  atribuido_para uuid references auth.users(id),
  data_prevista date,
  data_conclusao date,
  documento_url text,
  documento_nome text,
  visivel_cliente boolean not null default false,
  hierarquia_bloqueada boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data_conclusao_desejada date,
  unique (projeto_id, codigo)
);
alter table public.projeto_backlog enable row level security;

create or replace trigger trigger_gerar_codigo_backlog
  before insert on public.projeto_backlog
  for each row when (new.codigo is null or new.codigo = '')
  execute function gerar_codigo_backlog();

create or replace trigger trigger_backlog_updated_at
  before update on public.projeto_backlog
  for each row execute function update_backlog_updated_at();

do $p$ begin
  create policy backlog_select on public.projeto_backlog for select to authenticated
    using (tem_acesso_projeto(projeto_id));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy backlog_insert on public.projeto_backlog for insert to authenticated
    with check (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy backlog_update on public.projeto_backlog for update to authenticated
    using (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog.projeto_id and projetos.coordenador_id = auth.uid()))
    with check (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy backlog_delete on public.projeto_backlog for delete to authenticated
    using (has_role(auth.uid(), 'admin'::app_role) or exists (select 1 from projetos where projetos.id = projeto_backlog.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 68: projeto_backlog_comentarios
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160700_create_projeto_backlog_comentarios.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      68, '20260824160700_create_projeto_backlog_comentarios.sql',
      $tbl$create table if not exists public.projeto_backlog_comentarios (
  id uuid primary key default gen_random_uuid(),
  backlog_item_id uuid not null references public.projeto_backlog(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null,
  created_at timestamptz not null default now()
);
alter table public.projeto_backlog_comentarios enable row level security;

do $p$ begin
  create policy comentarios_select on public.projeto_backlog_comentarios for select to authenticated
    using (tem_acesso_via_backlog_item(backlog_item_id));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy comentarios_insert on public.projeto_backlog_comentarios for insert to authenticated
    with check (tem_acesso_via_backlog_item(backlog_item_id) and autor_id = auth.uid());
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy comentarios_update on public.projeto_backlog_comentarios for update to authenticated
    using (autor_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role))
    with check (autor_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy comentarios_delete on public.projeto_backlog_comentarios for delete to authenticated
    using (autor_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role) or tem_acesso_via_backlog_item(backlog_item_id));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 69: projeto_backlog_historico
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160800_create_projeto_backlog_historico.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      69, '20260824160800_create_projeto_backlog_historico.sql',
      $tbl$create table if not exists public.projeto_backlog_historico (
  id uuid primary key default gen_random_uuid(),
  backlog_item_id uuid not null references public.projeto_backlog(id) on delete cascade,
  de_coluna_id uuid references public.projeto_backlog_colunas(id),
  para_coluna_id uuid references public.projeto_backlog_colunas(id),
  movido_por uuid not null references auth.users(id),
  moved_at timestamptz not null default now(),
  tipo_evento character varying(30) not null default 'movimentacao' check (tipo_evento in ('criacao','movimentacao','movimentacao_bloco','edicao','comentario','atribuicao','cadeado_alterado')),
  detalhe jsonb,
  comentario text,
  evento_pai_id uuid references public.projeto_backlog_historico(id),
  data_prevista_fase date,
  atribuido_para_fase uuid references auth.users(id)
);
alter table public.projeto_backlog_historico enable row level security;

do $p$ begin
  create policy historico_select on public.projeto_backlog_historico for select to authenticated
    using (tem_acesso_via_backlog_item(backlog_item_id));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy historico_insert on public.projeto_backlog_historico for insert to authenticated
    with check (tem_acesso_via_backlog_item(backlog_item_id) and movido_por = auth.uid());
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy historico_delete on public.projeto_backlog_historico for delete to authenticated
    using (has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 70: projeto_backlog_participantes
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824160900_create_projeto_backlog_participantes.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      70, '20260824160900_create_projeto_backlog_participantes.sql',
      $tbl$create table if not exists public.projeto_backlog_participantes (
  id uuid primary key default gen_random_uuid(),
  backlog_item_id uuid not null references public.projeto_backlog(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  papel character varying(20) not null default 'observador' check (papel in ('observador','revisor','aprovador')),
  created_at timestamptz not null default now(),
  unique (backlog_item_id, user_id)
);
alter table public.projeto_backlog_participantes enable row level security;

do $p$ begin
  create policy participantes_select on public.projeto_backlog_participantes for select to authenticated
    using (tem_acesso_via_backlog_item(backlog_item_id));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy participantes_insert on public.projeto_backlog_participantes for insert to authenticated
    with check (has_role(auth.uid(), 'admin'::app_role) or exists (
      select 1 from projeto_backlog pb join projetos p on p.id = pb.projeto_id
      where pb.id = projeto_backlog_participantes.backlog_item_id and p.coordenador_id = auth.uid()
    ));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy participantes_update on public.projeto_backlog_participantes for update to authenticated
    using (has_role(auth.uid(), 'admin'::app_role) or exists (
      select 1 from projeto_backlog pb join projetos p on p.id = pb.projeto_id
      where pb.id = projeto_backlog_participantes.backlog_item_id and p.coordenador_id = auth.uid()
    ));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy participantes_delete on public.projeto_backlog_participantes for delete to authenticated
    using (has_role(auth.uid(), 'admin'::app_role) or exists (
      select 1 from projeto_backlog pb join projetos p on p.id = pb.projeto_id
      where pb.id = projeto_backlog_participantes.backlog_item_id and p.coordenador_id = auth.uid()
    ));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 71: projeto_diario
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161000_create_projeto_diario.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      71, '20260824161000_create_projeto_diario.sql',
      $tbl$create table if not exists public.projeto_diario (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  user_id uuid not null,
  data date not null default current_date,
  categoria text not null default 'geral' check (categoria in ('geral','decisao','ocorrencia','marco','alerta')),
  texto text not null check (char_length(trim(both from texto)) > 0),
  origem text not null default 'coordenador' check (origem in ('coordenador','consultor')),
  agenda_id uuid references public.agendas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  mencionados uuid[] not null default '{}',
  tem_mencao boolean not null default false,
  resposta_de uuid references public.projeto_diario(id) on delete set null,
  criticidade text check (criticidade in ('alta','media','baixa')),
  tags text[] not null default '{}'
);
alter table public.projeto_diario enable row level security;
create index if not exists idx_projeto_diario_projeto on public.projeto_diario (projeto_id, data desc);
create index if not exists idx_projeto_diario_agenda on public.projeto_diario (agenda_id) where (agenda_id is not null);
create index if not exists idx_projeto_diario_user on public.projeto_diario (user_id, data desc);
create index if not exists idx_diario_tem_mencao on public.projeto_diario (projeto_id, tem_mencao) where (tem_mencao = true);
create index if not exists idx_diario_criticidade on public.projeto_diario (projeto_id, criticidade) where (criticidade is not null);
create index if not exists idx_diario_tags on public.projeto_diario using gin (tags);

create or replace trigger trg_projeto_diario_updated_at
  before update on public.projeto_diario
  for each row execute function set_projeto_diario_updated_at();

do $p$ begin
  create policy diario_admin_full_access on public.projeto_diario for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
    with check (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy diario_consultor_insert on public.projeto_diario for insert to public
    with check (user_id = auth.uid() and exists (
      select 1 from agendas join projetos on projetos.nome_cliente = agendas.cliente
      where agendas.user_id = auth.uid() and projetos.id = projeto_diario.projeto_id
    ));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy diario_consultor_read on public.projeto_diario for select to public
    using (user_id = auth.uid() or auth.uid() = any (mencionados) or exists (
      select 1 from projetos where projetos.id = projeto_diario.projeto_id and projetos.coordenador_id = auth.uid()
    ));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy diario_coordenador_full_access on public.projeto_diario for all to public
    using (exists (select 1 from projetos where projetos.id = projeto_diario.projeto_id and projetos.coordenador_id = auth.uid()))
    with check (exists (select 1 from projetos where projetos.id = projeto_diario.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 72: projeto_diario_mencoes
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161100_create_projeto_diario_mencoes.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      72, '20260824161100_create_projeto_diario_mencoes.sql',
      $tbl$create table if not exists public.projeto_diario_mencoes (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.projeto_diario(id) on delete cascade,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  mencionado_id uuid not null references auth.users(id),
  autor_id uuid not null references auth.users(id),
  status text not null default 'pendente' check (status in ('pendente','ciente','resolvido')),
  ciente_em timestamptz,
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projeto_diario_mencoes enable row level security;
create index if not exists idx_diario_mencoes_mencionado_status on public.projeto_diario_mencoes (mencionado_id, status);
create index if not exists idx_diario_mencoes_projeto_status on public.projeto_diario_mencoes (projeto_id, status);

create or replace trigger trg_diario_mencoes_updated_at
  before update on public.projeto_diario_mencoes
  for each row execute function set_updated_at();

do $p$ begin
  create policy mencoes_admin_full on public.projeto_diario_mencoes for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy mencoes_consultor_select on public.projeto_diario_mencoes for select to public
    using (mencionado_id = auth.uid() or autor_id = auth.uid());
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy mencoes_consultor_update on public.projeto_diario_mencoes for update to public
    using (mencionado_id = auth.uid() or autor_id = auth.uid() or exists (
      select 1 from projetos where projetos.id = projeto_diario_mencoes.projeto_id and projetos.coordenador_id = auth.uid()
    ));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy mencoes_coordenador_full on public.projeto_diario_mencoes for all to public
    using (exists (select 1 from projetos where projetos.id = projeto_diario_mencoes.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 73: qa_skills
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161200_create_qa_skills.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      73, '20260824161200_create_qa_skills.sql',
      $tbl$create table if not exists public.qa_skills (
  id uuid primary key default gen_random_uuid(),
  grupo text not null,
  codigo text not null unique,
  nome text not null,
  descricao text not null,
  agentes text[] not null,
  tipo text not null check (tipo in ('solo','dupla','trio','integracao')),
  criticidade text not null check (criticidade in ('critico','alto','medio','baixo')),
  steps jsonb not null default '[]',
  teardown_steps jsonb not null default '[]',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.qa_skills is 'BL-020: Catalogo de skills de teste automatizado';
alter table public.qa_skills enable row level security;
create index if not exists idx_qa_skills_grupo on public.qa_skills (grupo);
create index if not exists idx_qa_skills_criticidade on public.qa_skills (criticidade);
create index if not exists idx_qa_skills_ativo on public.qa_skills (ativo);

create or replace trigger qa_skills_atualizado_em
  before update on public.qa_skills
  for each row execute function qa_set_atualizado_em();

do $p$ begin
  create policy qa_skills_select on public.qa_skills for select to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['admin'::app_role,'coordenador'::app_role])));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy qa_skills_insert_update_delete on public.qa_skills for all to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 74: qa_agents
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161300_create_qa_agents.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      74, '20260824161300_create_qa_agents.sql',
      $tbl$create table if not exists public.qa_agents (
  id uuid primary key default gen_random_uuid(),
  role text not null unique check (role in ('consultor','coordenador','admin')),
  nome text not null,
  email_teste text not null,
  ativo boolean not null default true,
  ultimo_run_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.qa_agents is 'BL-020: Agentes de teste com credenciais por role';
alter table public.qa_agents enable row level security;

create or replace trigger qa_agents_atualizado_em
  before update on public.qa_agents
  for each row execute function qa_set_atualizado_em();

do $p$ begin
  create policy qa_agents_admin_only on public.qa_agents for all to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 75: qa_runs
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161400_create_qa_runs.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      75, '20260824161400_create_qa_runs.sql',
      $tbl$create table if not exists public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.qa_skills(id) on delete cascade,
  skill_codigo text not null,
  iniciado_por uuid references auth.users(id),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  duracao_ms integer,
  status text not null default 'em_execucao' check (status in ('em_execucao','passou','falhou','timeout','cancelado')),
  ambiente text not null default 'localhost' check (ambiente in ('localhost','preview','production')),
  agentes_usados text[] not null default '{}',
  total_steps integer not null default 0,
  steps_ok integer not null default 0,
  steps_falha integer not null default 0,
  screenshot_url text,
  observacao text,
  ci_run boolean not null default false,
  ci_commit text
);
comment on table public.qa_runs is 'BL-020: Historico de todas as execucoes de skills';
alter table public.qa_runs enable row level security;
create index if not exists idx_qa_runs_skill_id on public.qa_runs (skill_id);
create index if not exists idx_qa_runs_status on public.qa_runs (status);
create index if not exists idx_qa_runs_iniciado_em on public.qa_runs (iniciado_em desc);

do $p$ begin
  create policy qa_runs_select on public.qa_runs for select to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['admin'::app_role,'coordenador'::app_role])));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy qa_runs_insert_update on public.qa_runs for all to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 76: qa_run_steps
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161500_create_qa_run_steps.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      76, '20260824161500_create_qa_run_steps.sql',
      $tbl$create table if not exists public.qa_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.qa_runs(id) on delete cascade,
  step_num integer not null,
  descricao text not null,
  acao text,
  valor_esperado text,
  valor_obtido text,
  status text not null default 'pendente' check (status in ('pendente','ok','falhou','timeout','pulado')),
  duracao_ms integer,
  screenshot_url text,
  erro_detalhe text,
  executado_em timestamptz
);
comment on table public.qa_run_steps is 'BL-020: Passo a passo detalhado de cada run';
alter table public.qa_run_steps enable row level security;
create index if not exists idx_qa_run_steps_run_id on public.qa_run_steps (run_id);

do $p$ begin
  create policy qa_run_steps_select on public.qa_run_steps for select to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['admin'::app_role,'coordenador'::app_role])));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy qa_run_steps_admin_write on public.qa_run_steps for all to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 77: qa_feedback
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161600_create_qa_feedback.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      77, '20260824161600_create_qa_feedback.sql',
      $tbl$create table if not exists public.qa_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.qa_runs(id) on delete cascade,
  skill_id uuid not null references public.qa_skills(id) on delete cascade,
  avaliado_por uuid references auth.users(id),
  resultado text not null check (resultado in ('bug_real','falso_positivo','infraestrutura')),
  observacao text,
  criado_em timestamptz not null default now()
);
comment on table public.qa_feedback is 'BL-020: Feedback loop -- base para ML calibrar peso das skills';
alter table public.qa_feedback enable row level security;
create index if not exists idx_qa_feedback_skill_id on public.qa_feedback (skill_id);

do $p$ begin
  create policy qa_feedback_select on public.qa_feedback for select to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['admin'::app_role,'coordenador'::app_role])));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy qa_feedback_admin_write on public.qa_feedback for all to authenticated
    using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 78: sla_config_global
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161700_create_sla_config_global.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      78, '20260824161700_create_sla_config_global.sql',
      $tbl$create table if not exists public.sla_config_global (
  id uuid primary key default gen_random_uuid(),
  dominio text not null unique check (dominio in ('apontamento','documentacao','ocorrencia','kanban_fase','pendencia','change_request','mencao')),
  dias_sla integer not null check (dias_sla > 0),
  dias_risco_antes integer not null default 0 check (dias_risco_antes >= 0),
  pct_risco integer not null default 80 check (pct_risco >= 1 and pct_risco <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sla_config_global enable row level security;

create or replace trigger trg_sla_config_global_updated_at
  before update on public.sla_config_global
  for each row execute function set_sla_updated_at();

do $p$ begin
  create policy sla_global_admin_write on public.sla_config_global for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
    with check (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy sla_global_read_all on public.sla_config_global for select to public
    using (auth.uid() is not null);
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 79: sla_config_projeto
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161800_create_sla_config_projeto.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      79, '20260824161800_create_sla_config_projeto.sql',
      $tbl$create table if not exists public.sla_config_projeto (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  dominio text not null check (dominio in ('apontamento','documentacao','ocorrencia','kanban_fase','pendencia','change_request')),
  dias_sla integer not null check (dias_sla > 0),
  dias_risco_antes integer not null default 0 check (dias_risco_antes >= 0),
  pct_risco integer not null default 80 check (pct_risco >= 1 and pct_risco <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (projeto_id, dominio)
);
alter table public.sla_config_projeto enable row level security;
create index if not exists idx_sla_config_projeto_projeto on public.sla_config_projeto (projeto_id);

create or replace trigger trg_sla_config_projeto_updated_at
  before update on public.sla_config_projeto
  for each row execute function set_sla_updated_at();

do $p$ begin
  create policy sla_projeto_admin_write on public.sla_config_projeto for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
    with check (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy sla_projeto_coord_write on public.sla_config_projeto for all to public
    using (exists (select 1 from projetos where projetos.id = sla_config_projeto.projeto_id and projetos.coordenador_id = auth.uid()))
    with check (exists (select 1 from projetos where projetos.id = sla_config_projeto.projeto_id and projetos.coordenador_id = auth.uid()));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy sla_projeto_read_all on public.sla_config_projeto for select to public
    using (auth.uid() is not null);
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

  -- ===================================================================
  -- seq 80: sla_resultados
  -- ===================================================================
  if not exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id and name = '20260824161900_create_sla_resultados.sql'
  ) then
    insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
      80, '20260824161900_create_sla_resultados.sql',
      $tbl$create table if not exists public.sla_resultados (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  dominio text not null,
  data_ref date not null default current_date,
  total integer not null default 0,
  no_prazo integer not null default 0,
  em_risco integer not null default 0,
  vencido integer not null default 0,
  taxa_cumprimento numeric(5,2),
  created_at timestamptz not null default now(),
  unique (projeto_id, dominio, data_ref)
);
alter table public.sla_resultados enable row level security;
create index if not exists idx_sla_resultados_projeto on public.sla_resultados (projeto_id, data_ref desc);

do $p$ begin
  create policy sla_resultados_coord_read on public.sla_resultados for select to public
    using (exists (select 1 from projetos where projetos.id = sla_resultados.projeto_id and projetos.coordenador_id = auth.uid()) or exists (
      select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role
    ));
exception when duplicate_object then null; end $p$;

do $p$ begin
  create policy sla_resultados_system_write on public.sla_resultados for all to public
    using (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role))
    with check (exists (select 1 from user_roles where user_roles.user_id = auth.uid() and user_roles.role = 'admin'::app_role));
exception when duplicate_object then null; end $p$;$tbl$,
      v_release_id
    );
  end if;

end
$seed_missing_tables$;
