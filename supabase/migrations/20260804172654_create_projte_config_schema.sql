-- Etapa 3 (provisorio): base de controle da PROJTE dentro do projeto Aceex Production,
-- em schema separado, isolado por RLS, ate existir uma conta Supabase dedicada da PROJTE
-- (ver docs/etapa3-config-projte.md). As pessoas com acesso aqui sao a equipe da PROJTE,
-- decoplado de proposito do app_role usado pelo produto Aceex (coordenador/consultor/admin).

create schema if not exists projte_config;

-- Quem pode acessar esse schema.
create table projte_config.usuarios_autorizados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table projte_config.clientes (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  cnpj text,
  logo_url text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  endereco_cep text,
  email_suporte text,
  telefone_suporte text,
  responsavel_nome text,
  responsavel_cargo text,
  responsavel_email text,
  responsavel_telefone text,
  plano_contratado text,
  data_inicio_contrato date,
  observacoes_comerciais text,
  status text not null default 'prospect' check (status in ('prospect','ativo','suspenso','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projte_config.template_releases (
  id uuid primary key default gen_random_uuid(),
  versao text not null unique,
  git_tag text,
  git_commit text,
  changelog text,
  publicado_em timestamptz not null default now()
);

create table projte_config.ambientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references projte_config.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('qa','producao')),
  supabase_project_ref text,
  supabase_project_url text,
  status text not null default 'nao_provisionado' check (status in ('nao_provisionado','provisionando','ativo','erro','pausado')),
  template_release_id uuid references projte_config.template_releases(id),
  provisionado_em timestamptz,
  atualizado_em timestamptz,
  notas text,
  unique (cliente_id, tipo)
);

create table projte_config.provisionamento_logs (
  id uuid primary key default gen_random_uuid(),
  ambiente_id uuid not null references projte_config.ambientes(id) on delete cascade,
  tipo text not null check (tipo in ('provisionamento','atualizacao')),
  etapa text not null,
  status text not null check (status in ('ok','erro')),
  mensagem text,
  "timestamp" timestamptz not null default now()
);

alter table projte_config.clientes enable row level security;
alter table projte_config.ambientes enable row level security;
alter table projte_config.template_releases enable row level security;
alter table projte_config.provisionamento_logs enable row level security;
alter table projte_config.usuarios_autorizados enable row level security;

create or replace function projte_config.is_authorized()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from projte_config.usuarios_autorizados where user_id = auth.uid()
  );
$$;

create policy "Autorizados podem tudo em clientes" on projte_config.clientes
  for all to authenticated using (projte_config.is_authorized()) with check (projte_config.is_authorized());

create policy "Autorizados podem tudo em ambientes" on projte_config.ambientes
  for all to authenticated using (projte_config.is_authorized()) with check (projte_config.is_authorized());

create policy "Autorizados podem tudo em template_releases" on projte_config.template_releases
  for all to authenticated using (projte_config.is_authorized()) with check (projte_config.is_authorized());

create policy "Autorizados podem tudo em provisionamento_logs" on projte_config.provisionamento_logs
  for all to authenticated using (projte_config.is_authorized()) with check (projte_config.is_authorized());

create policy "Autorizados veem a propria lista" on projte_config.usuarios_autorizados
  for select to authenticated using (projte_config.is_authorized());

-- Bucket de logos dos clientes cadastrados na PROJTE (nao confundir com assets do Aceex).
insert into storage.buckets (id, name, public)
values ('clientes-assets', 'clientes-assets', true)
on conflict (id) do nothing;

create policy "Autorizados podem gerenciar clientes-assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'clientes-assets' and projte_config.is_authorized())
  with check (bucket_id = 'clientes-assets' and projte_config.is_authorized());

create policy "Qualquer um pode ver clientes-assets" on storage.objects
  for select using (bucket_id = 'clientes-assets');
