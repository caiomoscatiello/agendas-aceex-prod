-- Etapa 3 (Config PROJTE) — tabela que guarda as migrations do template
-- PROJTE como dados (uma linha por arquivo), fonte de verdade lida em runtime
-- pela edge function projte-provision-ambiente (botao "Criar Ambiente").
--
-- Por que uma tabela e nao migrations embutidas como string no codigo da
-- function: carregar as 59 migrations do produto como literal TypeScript
-- demonstrou ser fragil demais de manter (arquivos grandes, alto risco de
-- erro de transcricao manual). A tabela pode ser atualizada via SQL direto
-- quando uma nova template_release for publicada, sem redeploy de codigo.
--
-- Aplicado em producao via MCP apply_migration/execute_sql em 2026-08-04;
-- este arquivo registra a mesma estrutura e conteudo no historico do
-- repositorio (idempotente -- "create table if not exists" + inserts com
-- "on conflict do nothing" seguro de reaplicar em qualquer clone).

create table if not exists projte_config.template_migrations (
  id uuid primary key default gen_random_uuid(),
  template_release_id uuid references projte_config.template_releases(id) on delete set null,
  seq integer not null,
  name text not null,
  sql text not null,
  created_at timestamptz not null default now(),
  unique (template_release_id, seq)
);

alter table projte_config.template_migrations enable row level security;

drop policy if exists "Autorizados leem template_migrations" on projte_config.template_migrations;
create policy "Autorizados leem template_migrations"
  on projte_config.template_migrations for select
  to authenticated
  using (projte_config.is_authorized());

grant select on projte_config.template_migrations to authenticated;
grant all on projte_config.template_migrations to service_role;

-- As 59 migrations do produto, na ordem de aplicacao original. Vinculadas a
-- release mais recente registrada em template_releases no momento em que
-- este arquivo foi gerado (v1.0.0). Se reaplicado num clone que ja tenha
-- outra versao como "mais recente", ajuste o subselect abaixo.

do $seed$
begin
  if exists (select 1 from projte_config.template_migrations) then
    raise notice 'projte_config.template_migrations ja populada -- pulando seed inicial das 59 migrations.';
    return;
  end if;

insert into projte_config.template_migrations (seq, name, sql) values (1, '20260220163313_0ca904ae-3257-4c63-8abf-4d9dcbfad5dd.sql', $pj6b9ce49c4b$
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tabela user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function para checar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tabela agendas
CREATE TABLE public.agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usuario TEXT NOT NULL,
  email TEXT NOT NULL,
  cliente TEXT NOT NULL,
  data DATE NOT NULL,
  atividade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;

-- Tabela apontamentos
CREATE TABLE public.apontamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  endereco TEXT,
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY;

-- Tabela requisicoes_agenda
CREATE TABLE public.requisicoes_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  cliente TEXT NOT NULL,
  total_horas NUMERIC NOT NULL,
  coordenador TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.requisicoes_agenda ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at no profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- profiles: users see own, admin sees all
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- user_roles: only admin can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- agendas: users see own, admin sees all and manages
CREATE POLICY "Users can view own agendas" ON public.agendas
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert agendas" ON public.agendas
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete agendas" ON public.agendas
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- apontamentos: users manage own, admin sees all
CREATE POLICY "Users can view own apontamentos" ON public.apontamentos
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own apontamentos" ON public.apontamentos
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own apontamentos" ON public.apontamentos
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- requisicoes_agenda: users manage own, admin sees all
CREATE POLICY "Users can view own requisicoes" ON public.requisicoes_agenda
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own requisicoes" ON public.requisicoes_agenda
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
$pj6b9ce49c4b$);

insert into projte_config.template_migrations (seq, name, sql) values (2, '20260220165343_fa4e561b-31f6-404f-9593-71d4c361b7b3.sql', $pj2ccb0f3d98$
-- Drop all existing restrictive policies and recreate as permissive

-- agendas
DROP POLICY IF EXISTS "Admin can delete agendas" ON public.agendas;
DROP POLICY IF EXISTS "Admin can insert agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can view own agendas" ON public.agendas;

CREATE POLICY "Admin can delete agendas" ON public.agendas FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert agendas" ON public.agendas FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own agendas" ON public.agendas FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- apontamentos
DROP POLICY IF EXISTS "Users can delete own apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "Users can insert own apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "Users can view own apontamentos" ON public.apontamentos;

CREATE POLICY "Users can delete own apontamentos" ON public.apontamentos FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own apontamentos" ON public.apontamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own apontamentos" ON public.apontamentos FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- requisicoes_agenda
DROP POLICY IF EXISTS "Users can insert own requisicoes" ON public.requisicoes_agenda;
DROP POLICY IF EXISTS "Users can view own requisicoes" ON public.requisicoes_agenda;

CREATE POLICY "Users can insert own requisicoes" ON public.requisicoes_agenda FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own requisicoes" ON public.requisicoes_agenda FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));
$pj2ccb0f3d98$);

insert into projte_config.template_migrations (seq, name, sql) values (3, '20260220172720_d9d31636-aee5-4a2b-aee9-07357c7850f8.sql', $pja8eac87779$
-- Add status column to agendas
ALTER TABLE public.agendas ADD COLUMN status text NOT NULL DEFAULT 'confirmada';

-- Create solicitacoes_cancelamento table
CREATE TABLE public.solicitacoes_cancelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solicitacoes_cancelamento ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert own solicitacoes"
ON public.solicitacoes_cancelamento
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own solicitacoes"
ON public.solicitacoes_cancelamento
FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update solicitacoes"
ON public.solicitacoes_cancelamento
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete solicitacoes"
ON public.solicitacoes_cancelamento
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to update agendas status
CREATE POLICY "Admin can update agendas"
ON public.agendas
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
$pja8eac87779$);

insert into projte_config.template_migrations (seq, name, sql) values (4, '20260220173419_dc57d835-2aae-44f3-b89f-5d4a68c68221.sql', $pj6b12d9bf60$
CREATE POLICY "Users can update own agenda status"
ON public.agendas
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
$pj6b12d9bf60$);

insert into projte_config.template_migrations (seq, name, sql) values (5, '20260220174236_1c093735-3d63-4a08-b0cd-ab3ee990e13c.sql', $pj0fbb78604c$
-- Create despesas table
CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data_lancamento date NOT NULL,
  hora_lancamento time NOT NULL,
  local_lancamento text,
  data_despesa date NOT NULL,
  cliente text NOT NULL,
  valor numeric NOT NULL,
  descricao text NOT NULL,
  foto_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own despesas"
ON public.despesas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own despesas"
ON public.despesas FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own despesas"
ON public.despesas FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for expense photos
INSERT INTO storage.buckets (id, name, public) VALUES ('despesas-fotos', 'despesas-fotos', true);

CREATE POLICY "Users can upload expense photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'despesas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view expense photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'despesas-fotos');

CREATE POLICY "Users can delete own expense photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'despesas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
$pj0fbb78604c$);

insert into projte_config.template_migrations (seq, name, sql) values (6, '20260220222222_e48e1fad-0e46-4677-b930-51f5a4b48146.sql', $pj30849b4c19$
-- Projects main table
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente text NOT NULL,
  site_cliente text,
  endereco_cliente text,
  contato_cliente text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage projetos" ON public.projetos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view projetos" ON public.projetos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Project expense types with max values
CREATE TABLE public.projeto_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tipo_despesa text NOT NULL,
  valor_maximo numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.projeto_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage projeto_despesas" ON public.projeto_despesas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view projeto_despesas" ON public.projeto_despesas FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Project activities
CREATE TABLE public.projeto_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  descricao text NOT NULL,
  horas numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.projeto_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage projeto_atividades" ON public.projeto_atividades FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view projeto_atividades" ON public.projeto_atividades FOR SELECT
  USING (auth.uid() IS NOT NULL);
$pj30849b4c19$);

insert into projte_config.template_migrations (seq, name, sql) values (7, '20260224140922_804717bf-7da7-4f78-8fa2-b860c30acf53.sql', $pj0737518282$
-- Add new enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
$pj0737518282$);

insert into projte_config.template_migrations (seq, name, sql) values (8, '20260224142210_ea212462-1d70-42f2-92d3-b00fd2cf8771.sql', $pjad9a26e436$
-- Add coordenador_id to projetos
ALTER TABLE public.projetos ADD COLUMN coordenador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Split contato_cliente into nome and telefone
ALTER TABLE public.projetos ADD COLUMN contato_nome text;
ALTER TABLE public.projetos ADD COLUMN contato_telefone text;

-- Migrate existing contato_cliente data to contato_nome (best effort)
UPDATE public.projetos SET contato_nome = contato_cliente WHERE contato_cliente IS NOT NULL;

-- Drop old column
ALTER TABLE public.projetos DROP COLUMN contato_cliente;
$pjad9a26e436$);

insert into projte_config.template_migrations (seq, name, sql) values (9, '20260224143609_06e28378-f073-42a2-a1df-527f08956f0e.sql', $pjfde7adadd2$
-- Allow coordenadores to manage projetos
CREATE POLICY "Coordenador can manage projetos"
ON public.projetos FOR ALL
USING (has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));

-- Allow coordenadores to manage projeto_despesas
CREATE POLICY "Coordenador can manage projeto_despesas"
ON public.projeto_despesas FOR ALL
USING (has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));

-- Allow coordenadores to manage projeto_atividades
CREATE POLICY "Coordenador can manage projeto_atividades"
ON public.projeto_atividades FOR ALL
USING (has_role(auth.uid(), 'coordenador'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));
$pjfde7adadd2$);

insert into projte_config.template_migrations (seq, name, sql) values (10, '20260224143726_9c5ec556-2d98-44e0-8d94-2fe926bdbe34.sql', $pjf81e0b66ca$
ALTER TABLE public.projetos ADD COLUMN horas_contratadas numeric NOT NULL DEFAULT 0;
$pjf81e0b66ca$);

insert into projte_config.template_migrations (seq, name, sql) values (11, '20260224151331_ae062d0e-2830-47ae-86c8-eee3ae4b9adf.sql', $pj0f6a64eb43$ALTER PUBLICATION supabase_realtime ADD TABLE public.agendas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.apontamentos;$pj0f6a64eb43$);

insert into projte_config.template_migrations (seq, name, sql) values (12, '20260224153413_3915c881-45c1-4beb-ba16-cd54dc9c607f.sql', $pj508708817e$
-- Update profiles SELECT policy to allow coordenadores to see non-admin profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id AND ur.role = 'admin'
    )
  )
);

-- Update user_roles SELECT policy to allow coordenadores to see non-admin roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND role != 'admin'
  )
);
$pj508708817e$);

insert into projte_config.template_migrations (seq, name, sql) values (13, '20260224153823_24824d90-8dde-44b8-82ff-7ebe0d1d9f1f.sql', $pjc0033d130a$
-- Fix profiles SELECT policy to use has_role (SECURITY DEFINER) instead of direct subquery
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND NOT has_role(user_id, 'admin')
  )
);
$pjc0033d130a$);

insert into projte_config.template_migrations (seq, name, sql) values (14, '20260224154357_5bbf577b-5791-4967-9d37-f1729f2eba5d.sql', $pje4e59ccea5$
-- Allow coordenadores to view all agendas (not just their own)
DROP POLICY IF EXISTS "Users can view own agendas" ON public.agendas;

CREATE POLICY "Users can view own agendas"
ON public.agendas
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);
$pje4e59ccea5$);

insert into projte_config.template_migrations (seq, name, sql) values (15, '20260224154431_e9d34d53-e3b0-4336-83c3-b959567c91e0.sql', $pj41d727222a$
-- Allow coordenadores to view all apontamentos
DROP POLICY IF EXISTS "Users can view own apontamentos" ON public.apontamentos;

CREATE POLICY "Users can view own apontamentos"
ON public.apontamentos
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);
$pj41d727222a$);

insert into projte_config.template_migrations (seq, name, sql) values (16, '20260224154951_adc6f961-5454-4cc6-8b90-87cb461d541c.sql', $pje4c63534fc$
-- Allow coordenadores to insert agendas
DROP POLICY IF EXISTS "Admin can insert agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can insert agendas"
ON public.agendas
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);

-- Allow coordenadores to update agendas
DROP POLICY IF EXISTS "Admin can update agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can update agendas"
ON public.agendas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);

-- Allow coordenadores to delete agendas
DROP POLICY IF EXISTS "Admin can delete agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can delete agendas"
ON public.agendas
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'coordenador')
);
$pje4c63534fc$);

insert into projte_config.template_migrations (seq, name, sql) values (17, '20260224155348_3e95a026-6377-4edb-8c14-572b62edaa43.sql', $pj5a3c1295f6$
-- Update agendas SELECT: coordenadores only see agendas from their projects
DROP POLICY IF EXISTS "Users can view own agendas" ON public.agendas;

CREATE POLICY "Users can view own agendas"
ON public.agendas
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update agendas INSERT: coordenadores only for their projects
DROP POLICY IF EXISTS "Admin and coordenador can insert agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can insert agendas"
ON public.agendas
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update agendas UPDATE: coordenadores only for their projects
DROP POLICY IF EXISTS "Admin and coordenador can update agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can update own agenda status" ON public.agendas;

CREATE POLICY "Admin and coordenador can update agendas"
ON public.agendas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR auth.uid() = user_id
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update agendas DELETE: coordenadores only for their projects
DROP POLICY IF EXISTS "Admin and coordenador can delete agendas" ON public.agendas;

CREATE POLICY "Admin and coordenador can delete agendas"
ON public.agendas
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = agendas.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);

-- Update apontamentos SELECT: coordenadores only see from their projects
DROP POLICY IF EXISTS "Users can view own apontamentos" ON public.apontamentos;

CREATE POLICY "Users can view own apontamentos"
ON public.apontamentos
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.nome_cliente = apontamentos.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);
$pj5a3c1295f6$);

insert into projte_config.template_migrations (seq, name, sql) values (18, '20260224162427_b9c0809e-3dad-4e11-8c1b-30db7e3f99ff.sql', $pj699f63a89d$
-- Add status and rejection reason to requisicoes_agenda
ALTER TABLE public.requisicoes_agenda 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

-- Drop old SELECT policy and recreate to include coordinators
DROP POLICY IF EXISTS "Users can view own requisicoes" ON public.requisicoes_agenda;
CREATE POLICY "Users can view requisicoes"
  ON public.requisicoes_agenda FOR SELECT
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
      SELECT 1 FROM projetos p WHERE p.nome_cliente = requisicoes_agenda.cliente AND p.coordenador_id = auth.uid()
    ))
  );

-- Allow coordinators to update requisicoes for their projects
CREATE POLICY "Coordenador can update requisicoes"
  ON public.requisicoes_agenda FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
      SELECT 1 FROM projetos p WHERE p.nome_cliente = requisicoes_agenda.cliente AND p.coordenador_id = auth.uid()
    ))
  );
$pj699f63a89d$);

insert into projte_config.template_migrations (seq, name, sql) values (19, '20260226131223_b046d124-a065-47b7-b935-fe8fe0d7b03a.sql', $pj6f5a3d9935$
-- Nova tabela para armazenar apontamentos por atividade (novo fluxo)
CREATE TABLE public.apontamento_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id UUID NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  cliente TEXT NOT NULL,
  atividade_codigo TEXT NOT NULL,
  atividade_descricao TEXT NOT NULL,
  horas NUMERIC NOT NULL DEFAULT 0,
  modalidade TEXT NOT NULL DEFAULT 'Remoto',
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apontamento_atividades ENABLE ROW LEVEL SECURITY;

-- Users can insert their own records
CREATE POLICY "Users can insert own apontamento_atividades"
ON public.apontamento_atividades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view own, admin all, coordenador their projects
CREATE POLICY "Users can view apontamento_atividades"
ON public.apontamento_atividades
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
    SELECT 1 FROM projetos p WHERE p.nome_cliente = apontamento_atividades.cliente AND p.coordenador_id = auth.uid()
  ))
);

-- Admin and coordenador can update
CREATE POLICY "Admin and coordenador can update apontamento_atividades"
ON public.apontamento_atividades
FOR UPDATE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
    SELECT 1 FROM projetos p WHERE p.nome_cliente = apontamento_atividades.cliente AND p.coordenador_id = auth.uid()
  ))
);

-- Admin and coordenador can delete
CREATE POLICY "Admin and coordenador can delete apontamento_atividades"
ON public.apontamento_atividades
FOR DELETE
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND EXISTS (
    SELECT 1 FROM projetos p WHERE p.nome_cliente = apontamento_atividades.cliente AND p.coordenador_id = auth.uid()
  ))
);
$pj6f5a3d9935$);

insert into projte_config.template_migrations (seq, name, sql) values (20, '20260226172957_c97da9d4-dbd7-4c2f-a4a4-db85d56758cd.sql', $pj786d4fe9cc$ALTER TABLE public.projetos ADD COLUMN deslocamento smallint NOT NULL DEFAULT 0 CHECK (deslocamento >= 0 AND deslocamento <= 9);$pj786d4fe9cc$);

insert into projte_config.template_migrations (seq, name, sql) values (21, '20260226173403_ff091fb6-5387-4681-9e1a-83dca9a02195.sql', $pj972bcfbfaf$ALTER TABLE public.projetos ADD COLUMN email_contato text;$pj972bcfbfaf$);

insert into projte_config.template_migrations (seq, name, sql) values (22, '20260227151656_c864b7a9-6009-48e9-8d53-fe5c415547f0.sql', $pj3434c5557a$
-- Table for SMTP email settings (one row, admin-only)
CREATE TABLE public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL DEFAULT '',
  sender_email text NOT NULL DEFAULT '',
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_security text NOT NULL DEFAULT 'STARTTLS',
  smtp_user text NOT NULL DEFAULT '',
  smtp_password text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage email_settings"
  ON public.email_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
$pj3434c5557a$);

insert into projte_config.template_migrations (seq, name, sql) values (23, '20260228181115_3f9e7322-1ef9-4c4e-add2-e8e4aa51350f.sql', $pjcd4c52a325$
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage app_settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view app_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default values
INSERT INTO public.app_settings (key, value) VALUES
  ('despesas_email_responsavel', ''),
  ('despesas_data_fechamento', '25'),
  ('regras_data_limite_apontamento', '5');
$pjcd4c52a325$);

insert into projte_config.template_migrations (seq, name, sql) values (24, '20260228182432_bb09e327-a3db-425c-a379-33afa840dbba.sql', $pj9b724a2588$
-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
$pj9b724a2588$);

insert into projte_config.template_migrations (seq, name, sql) values (25, '20260302155039_d19cb5b8-6087-4d26-b418-9a85654dfa5e.sql', $pjb3f877f512$
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin can manage email_settings" ON public.email_settings;

-- Recreate as PERMISSIVE
CREATE POLICY "Admin can manage email_settings"
ON public.email_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
$pjb3f877f512$);

insert into projte_config.template_migrations (seq, name, sql) values (26, '20260302160553_95ab81b4-e44b-48fe-8b3a-bde6d12f6b69.sql', $pj47717693cd$
ALTER TABLE public.profiles ADD COLUMN codigo text DEFAULT '';
$pj47717693cd$);

insert into projte_config.template_migrations (seq, name, sql) values (27, '20260302165637_690415ee-e29d-4dd5-92b6-7e93ddaacf12.sql', $pjc63c9009f0$
-- Create integration_logs table
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  codigo text,
  payload jsonb,
  status text NOT NULL DEFAULT 'error',
  message text,
  http_status integer
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage integration_logs"
ON public.integration_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed protheus_api_key into app_settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES ('protheus_api_key', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;
$pjc63c9009f0$);

insert into projte_config.template_migrations (seq, name, sql) values (28, '20260302170533_4d4381c9-7c1e-40cd-81ea-dc6a97105170.sql', $pj74e3eed090$
-- Create table for multiple Protheus integrations
CREATE TABLE public.protheus_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  direcao text NOT NULL DEFAULT 'Recebe' CHECK (direcao IN ('Envia e Recebe', 'Envia', 'Recebe')),
  api_key text NOT NULL DEFAULT gen_random_uuid()::text,
  ativo boolean NOT NULL DEFAULT true,
  webhook_path text NOT NULL DEFAULT '',
  payload_exemplo jsonb,
  guia_integracao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protheus_integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage protheus_integracoes"
ON public.protheus_integracoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_protheus_integracoes_updated_at
BEFORE UPDATE ON public.protheus_integracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with current integration migrated as 0001
INSERT INTO public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
VALUES (
  '0001',
  'Integ. User',
  'Recebe',
  'protheus-users',
  '{"codigo": "{{SZ3->Z3_CODUSR}}", "nome": "{{SZ3->Z3_NOME}}", "email": "{{SZ3->Z3_EMAIL}}", "cargo": "{{SZ3->Z3_CARGO}}"}'::jsonb,
  E'Trigger: Execute this POST every time a new record is inserted in SZ3 table.\n\nValores válidos para "cargo":\n  "C" = Coordenador\n  "A" ou "T" = Consultor'
);
$pj74e3eed090$);

insert into projte_config.template_migrations (seq, name, sql) values (29, '20260304175437_6ab3df74-b2cf-4fce-b0f4-ccce37f52e95.sql', $pj25866295c0$
CREATE TABLE public.cronograma_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade_id UUID NOT NULL REFERENCES public.projeto_atividades(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  horas_reservadas NUMERIC NOT NULL DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage cronograma_itens"
  ON public.cronograma_itens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordenador can manage cronograma_itens"
  ON public.cronograma_itens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "Users can view cronograma_itens"
  ON public.cronograma_itens FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
$pj25866295c0$);

insert into projte_config.template_migrations (seq, name, sql) values (30, '20260305120908_dc1c058d-dae8-490e-b2cd-21ed8e4f4f85.sql', $pja609ec233a$
ALTER TABLE public.despesas 
  ADD COLUMN IF NOT EXISTS envio_financeiro text,
  ADD COLUMN IF NOT EXISTS data_envio_fin date;
$pja609ec233a$);

insert into projte_config.template_migrations (seq, name, sql) values (31, '20260305121022_94fb0c1f-7f49-423d-9c14-c826be895986.sql', $pja244d45311$
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
$pja244d45311$);

insert into projte_config.template_migrations (seq, name, sql) values (32, '20260305181810_5b39d5a8-e91a-4d6f-b389-affdab438059.sql', $pj6f5f587b5d$ALTER TABLE public.profiles ADD COLUMN contato text DEFAULT '' NULL;$pj6f5f587b5d$);

insert into projte_config.template_migrations (seq, name, sql) values (33, '20260306110933_d064caa9-2de2-4c2a-9e76-19aab83c74f0.sql', $pjb34c7d4135$ALTER TABLE public.projetos ADD COLUMN codigo_cliente text NOT NULL DEFAULT '';$pjb34c7d4135$);

insert into projte_config.template_migrations (seq, name, sql) values (34, '20260306112033_a1e9e95f-8d49-4a2d-a1fd-46c1880a5ada.sql', $pj682707cca8$ALTER TABLE public.projetos ADD COLUMN status text NOT NULL DEFAULT 'Em planejamento';$pj682707cca8$);

insert into projte_config.template_migrations (seq, name, sql) values (35, '20260310201342_145b56b8-8440-4320-89f8-37f06129d42b.sql', $pj13d92d06aa$
CREATE TABLE public.email_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  copia text[] NOT NULL DEFAULT '{}',
  corpo_email text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage email_workflows"
ON public.email_workflows
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view email_workflows"
ON public.email_workflows
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_email_workflows_updated_at
  BEFORE UPDATE ON public.email_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
$pj13d92d06aa$);

insert into projte_config.template_migrations (seq, name, sql) values (36, '20260310202406_03e16893-0c73-44d1-9b93-20a58ca82261.sql', $pj562bf98fc2$
UPDATE public.email_workflows SET corpo_email = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#333">Ordem de Serviço</h2>
  <p><strong>Cliente:</strong> {{cliente}}</p>
  <p><strong>Data:</strong> {{data}}</p>
  <p><strong>Modalidade:</strong> {{modalidade}}</p>
  
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd">Atividade</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd">Horas</th>
      </tr>
    </thead>
    <tbody>
      {{atividades}}
      {{deslocamento}}
      <tr style="font-weight:bold;background:#f9f9f9">
        <td style="padding:8px">Total</td>
        <td style="padding:8px;text-align:right">{{total_horas}}h</td>
      </tr>
    </tbody>
  </table>
  
  {{descricao}}
</div>' WHERE codigo = 'send-os-email';

UPDATE public.email_workflows SET corpo_email = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <p>Olá <strong>{{nome_consultor}}</strong>,</p>
  <p>Notamos que os seguintes apontamentos estão em atraso. Favor realizar o devido apontamento do atendimento ou solicite o cancelamento da agenda.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Data</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Cliente</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Atividade</th>
      </tr>
    </thead>
    <tbody>{{agendas_rows}}</tbody>
  </table>
  <p>Dentro de <strong>{{dias_limite}} dias</strong>, o apontamento será automaticamente excluído por falta.</p>
  <br/>
  <p>Obrigado,</p>
  <p><strong>Coordenação de Projetos Aceex</strong></p>
</div>' WHERE codigo = 'check-overdue-agendas';

UPDATE public.email_workflows SET corpo_email = 'O template de fechamento de despesas é gerado automaticamente pelo sistema com layout editorial completo, incluindo:

• Cabeçalho com mês/ano de referência
• Dados do destinatário, cópia e assunto
• Introdução com nome do usuário e data de fechamento
• Tabela detalhada de despesas agrupadas por cliente (data, descrição, valor)
• Subtotais por cliente e total geral
• Lista de anexos ZIP com comprovantes

As variáveis são preenchidas automaticamente: {{nome_usuario}}, {{mes}}, {{ano}}, {{despesas}}, {{total_geral}}' WHERE codigo = 'monthly-expenses-scheduler';

UPDATE public.email_workflows SET corpo_email = 'Este workflow é utilizado para envio de e-mails genéricos do sistema.

O corpo do e-mail é definido diretamente na chamada da função, através do campo "body" no payload da requisição.

Variáveis disponíveis: {{to}}, {{subject}}, {{body}}' WHERE codigo = 'send-email';
$pj562bf98fc2$);

insert into projte_config.template_migrations (seq, name, sql) values (37, '20260311133035_8bbc226a-ca9a-468e-bb4d-2b5e4fc65140.sql', $pj808fc5182b$ALTER TABLE public.requisicoes_agenda ADD COLUMN atividade text;$pj808fc5182b$);

insert into projte_config.template_migrations (seq, name, sql) values (38, '20260311221705_c608c48c-e7bd-4d2b-ad4b-e3cf3ddeda6b.sql', $pj5aad21c586$ALTER TABLE public.agendas ADD COLUMN flag_integracao text NOT NULL DEFAULT 'APP';$pj5aad21c586$);

insert into projte_config.template_migrations (seq, name, sql) values (39, '20260312173213_c8ef17fc-3545-44ea-962d-82f94bef54e2.sql', $pj31375d0463$ALTER TABLE public.protheus_integracoes ADD COLUMN endpoint text NOT NULL DEFAULT '';$pj31375d0463$);

insert into projte_config.template_migrations (seq, name, sql) values (40, '20260312175344_0a3c194a-1ee7-41c7-8db0-cb341d9eac0c.sql', $pj1fa64ede3f$ALTER TABLE public.integration_logs ADD COLUMN response jsonb DEFAULT NULL;$pj1fa64ede3f$);

insert into projte_config.template_migrations (seq, name, sql) values (41, '20260313115811_93981553-21fc-4c4e-9016-570210e6c37a.sql', $pjda6fff3f14$ALTER TABLE public.agendas ALTER COLUMN flag_integracao SET DEFAULT 'LOVABLE';

-- Update existing APP records to LOVABLE
UPDATE public.agendas SET flag_integracao = 'LOVABLE' WHERE flag_integracao = 'APP';$pjda6fff3f14$);

insert into projte_config.template_migrations (seq, name, sql) values (42, '20260313130208_21d096ae-0903-49b1-b308-785ac13d15f1.sql', $pjb445e0ff57$ALTER TABLE public.agendas ADD COLUMN item_cronograma text NULL DEFAULT NULL;$pjb445e0ff57$);

insert into projte_config.template_migrations (seq, name, sql) values (43, '20260313141422_c3167420-9b33-4c91-ba31-0f89d182a8d4.sql', $pj9bb19b1188$ALTER TABLE public.requisicoes_agenda ADD COLUMN modalidade text NOT NULL DEFAULT 'Remoto';$pj9bb19b1188$);

insert into projte_config.template_migrations (seq, name, sql) values (44, '20260313200134_49f288d0-5bb9-4d51-850f-abcb81a790e0.sql', $pjd0c6e4a093$ALTER TABLE public.agendas ADD COLUMN codigo_consultor text DEFAULT NULL;
ALTER TABLE public.agendas ADD COLUMN codigo_cliente text DEFAULT NULL;
ALTER TABLE public.agendas ADD COLUMN codigo_atividade text DEFAULT NULL;$pjd0c6e4a093$);

insert into projte_config.template_migrations (seq, name, sql) values (45, '20260313204442_e6f2d3a6-20b8-4b41-aa65-980859a266be.sql', $pj953ed50d2b$CREATE POLICY "Admin and coordenador can delete requisicoes"
ON public.requisicoes_agenda
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'coordenador'::app_role)
    AND EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.nome_cliente = requisicoes_agenda.cliente
      AND p.coordenador_id = auth.uid()
    )
  )
);$pj953ed50d2b$);

insert into projte_config.template_migrations (seq, name, sql) values (46, '20260317122507_4e614880-fb09-42c1-bee3-375b88e25fa1.sql', $pjdc6ea725db$ALTER TABLE requisicoes_agenda
  ADD COLUMN IF NOT EXISTS descricao_atividade text,
  ADD COLUMN IF NOT EXISTS justificativa text;$pjdc6ea725db$);

insert into projte_config.template_migrations (seq, name, sql) values (47, '20260319151225_044f41a0-d954-4b11-b9ce-5ff8b0c525eb.sql', $pjb2abc1272b$
-- 1. Adicionar datas em projeto_atividades
ALTER TABLE projeto_atividades
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date;

-- 2. Adicionar datas em cronograma_itens
ALTER TABLE cronograma_itens
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date;

-- 3. Criar tabela projeto_stakeholders
CREATE TABLE IF NOT EXISTS projeto_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  nome text NOT NULL,
  cargo text,
  departamento text,
  empresa text,
  nivel_hierarquico text,
  tipo text NOT NULL DEFAULT 'Externo',
  email text,
  telefone text,
  tipo_influencia text NOT NULL DEFAULT 'Neutro',
  interesses text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projeto_stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam stakeholders"
  ON projeto_stakeholders FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 4. Criar tabela projeto_riscos
CREATE TABLE IF NOT EXISTS projeto_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  responsavel_id uuid REFERENCES projeto_stakeholders(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  probabilidade text NOT NULL DEFAULT 'Média',
  impacto text NOT NULL DEFAULT 'Médio',
  status text NOT NULL DEFAULT 'Identificado',
  acao_mitigadora text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projeto_riscos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam riscos"
  ON projeto_riscos FOR ALL
  USING (auth.uid() IS NOT NULL);
$pjb2abc1272b$);

insert into projte_config.template_migrations (seq, name, sql) values (48, '20260320022656_01b02692-9721-4c76-b31d-5f25f223a842.sql', $pj855b28aec9$ALTER TABLE public.projeto_stakeholders
  ADD COLUMN IF NOT EXISTS profile_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;$pj855b28aec9$);

insert into projte_config.template_migrations (seq, name, sql) values (49, '20260320185105_0a40eb1a-42fb-4410-b0d5-3ba551a8a0bf.sql', $pj8230e483e3$CREATE TABLE IF NOT EXISTS public.projeto_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  versao text NOT NULL DEFAULT 'v1',
  descricao text,
  snapshot jsonb NOT NULL,
  salvo_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam baselines"
  ON public.projeto_baseline FOR ALL
  USING (auth.uid() IS NOT NULL);$pj8230e483e3$);

insert into projte_config.template_migrations (seq, name, sql) values (50, '20260324142020_65429b2b-f47f-4dfa-9484-0a74b622e106.sql', $pjdeaa88d8e1$
ALTER TABLE projetos
  ADD COLUMN IF NOT EXISTS monday_board_id   TEXT,
  ADD COLUMN IF NOT EXISTS monday_board_url  TEXT,
  ADD COLUMN IF NOT EXISTS monday_status     TEXT DEFAULT 'nao_criado';

ALTER TABLE projeto_atividades
  ADD COLUMN IF NOT EXISTS monday_group_id   TEXT;

ALTER TABLE agendas
  ADD COLUMN IF NOT EXISTS monday_item_id         TEXT,
  ADD COLUMN IF NOT EXISTS doc_referencia         TEXT,
  ADD COLUMN IF NOT EXISTS doc_status             TEXT DEFAULT 'nao_exigido',
  ADD COLUMN IF NOT EXISTS autentique_envelope_id TEXT;
$pjdeaa88d8e1$);

insert into projte_config.template_migrations (seq, name, sql) values (51, '20260325113300_09b15d23-f8c4-4a7b-b964-37a693956742.sql', $pjcee4dc6ef0$
CREATE TABLE public.tipos_documento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,
  descricao   TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  modelo_url  TEXT,
  modelo_nome TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tipos_documento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tipos_documento" ON public.tipos_documento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordenador can manage tipos_documento" ON public.tipos_documento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "Authenticated users can view tipos_documento" ON public.tipos_documento
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS doc_exigido        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_documento_id  UUID REFERENCES public.tipos_documento(id),
  ADD COLUMN IF NOT EXISTS doc_satisfeito     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS doc_satisfeito_em  TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-modelo', 'documentos-modelo', true);

CREATE POLICY "Authenticated users can upload documentos-modelo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-modelo');

CREATE POLICY "Authenticated users can update documentos-modelo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-modelo');

CREATE POLICY "Authenticated users can delete documentos-modelo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-modelo');

CREATE POLICY "Public can view documentos-modelo"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'documentos-modelo');
$pjcee4dc6ef0$);

insert into projte_config.template_migrations (seq, name, sql) values (52, '20260328225834_f9c08637-3a6c-4d31-ae80-4b9ae93a02b9.sql', $pjc5df10eee4$ALTER TABLE cronograma_itens ADD COLUMN IF NOT EXISTS monday_item_id text NULL;$pjc5df10eee4$);

insert into projte_config.template_migrations (seq, name, sql) values (53, '20260401163831_e43e8003-0333-450a-9ba3-9c2a4e26831a.sql', $pjf7b1352114$
-- Permitir que coordenadores leiam todas as solicitações de cancelamento
CREATE POLICY "coordenadores_read_solicitacoes"
ON public.solicitacoes_cancelamento
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador'::app_role)
);
$pjf7b1352114$);

insert into projte_config.template_migrations (seq, name, sql) values (54, '20260411214532_1b40c5c5-5656-4aa6-8f82-8657dc621d4b.sql', $pjfbf505c114$ALTER TABLE public.agendas ADD COLUMN atividade_descricao text;$pjfbf505c114$);

insert into projte_config.template_migrations (seq, name, sql) values (55, '20260416_fix_rls_projeto_alertas.sql', $pjb3370b89d1$-- Remover policy existente
DROP POLICY IF EXISTS "Coordenador vê alertas dos seus projetos" ON projeto_alertas;

-- Recriar com hierarquia: admin vê tudo, coordenador vê só seus projetos
CREATE POLICY "Hierarquia projeto_alertas" ON projeto_alertas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    projeto_id IN (
      SELECT id FROM projetos
      WHERE coordenador_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    projeto_id IN (
      SELECT id FROM projetos
      WHERE coordenador_id = auth.uid()
    )
  );$pjb3370b89d1$);

insert into projte_config.template_migrations (seq, name, sql) values (56, '20260428_bl007_health_score.sql', $pjf98795c2e7$-- BL-007 — Health Score Analytics
-- P1: Tabelas projeto_health_config e projeto_health_historico

-- ─── TABELA DE CONFIGURAÇÃO ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_health_config (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id           uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,

  -- Pesos das dimensões (somam 100)
  peso_prazo           integer NOT NULL DEFAULT 25,
  peso_custo           integer NOT NULL DEFAULT 25,
  peso_feeling         integer NOT NULL DEFAULT 25,
  peso_alertas         integer NOT NULL DEFAULT 25,

  -- Thresholds IDP
  idp_verde            decimal(4,2) NOT NULL DEFAULT 1.00,
  idp_amarelo          decimal(4,2) NOT NULL DEFAULT 0.80,

  -- Thresholds IDC
  idc_verde            decimal(4,2) NOT NULL DEFAULT 1.00,
  idc_amarelo          decimal(4,2) NOT NULL DEFAULT 0.80,

  -- Thresholds Feeling
  feeling_verde        integer NOT NULL DEFAULT 70,
  feeling_amarelo      integer NOT NULL DEFAULT 50,

  -- Penalidades por alerta
  penalidade_critico   integer NOT NULL DEFAULT 20,
  penalidade_alto      integer NOT NULL DEFAULT 10,
  penalidade_moderado  integer NOT NULL DEFAULT 5,

  -- Thresholds score final
  score_verde          integer NOT NULL DEFAULT 75,
  score_amarelo        integer NOT NULL DEFAULT 50,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projeto_health_config_projeto_id_key UNIQUE (projeto_id),
  CONSTRAINT pesos_somam_100 CHECK (peso_prazo + peso_custo + peso_feeling + peso_alertas = 100),
  CONSTRAINT pesos_range CHECK (
    peso_prazo    BETWEEN 0 AND 50 AND
    peso_custo    BETWEEN 0 AND 50 AND
    peso_feeling  BETWEEN 0 AND 50 AND
    peso_alertas  BETWEEN 0 AND 50
  )
);

-- ─── TABELA DE HISTÓRICO ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_health_historico (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id           uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  data_calculo         date NOT NULL,

  -- Score final e por dimensão (0–100)
  score_total          integer NOT NULL DEFAULT 0,
  score_prazo          integer NOT NULL DEFAULT 0,
  score_custo          integer NOT NULL DEFAULT 0,
  score_feeling        integer NOT NULL DEFAULT 0,
  score_alertas        integer NOT NULL DEFAULT 0,

  -- Valores brutos no momento do cálculo
  idp_valor            decimal(5,2) NOT NULL DEFAULT 1.00,
  idc_valor            decimal(5,2) NOT NULL DEFAULT 1.00,
  feeling_medio        decimal(5,2),

  -- Contagem de alertas ativos no momento
  alertas_criticos     integer NOT NULL DEFAULT 0,
  alertas_altos        integer NOT NULL DEFAULT 0,
  alertas_moderados    integer NOT NULL DEFAULT 0,

  -- Semáforo calculado
  semaforo             varchar(10) NOT NULL DEFAULT 'verde'
                       CHECK (semaforo IN ('verde', 'amarelo', 'vermelho')),

  -- Snapshot dos pesos usados
  pesos_snapshot       jsonb NOT NULL DEFAULT '{}',

  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projeto_health_historico_projeto_data_key UNIQUE (projeto_id, data_calculo)
);

-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE projeto_health_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_health_historico ENABLE ROW LEVEL SECURITY;

-- Config: admin vê tudo, coordenador vê só seus projetos
CREATE POLICY "Hierarquia health_config" ON projeto_health_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR projeto_id IN (SELECT id FROM projetos WHERE coordenador_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR projeto_id IN (SELECT id FROM projetos WHERE coordenador_id = auth.uid())
  );

-- Histórico: mesma hierarquia, somente leitura para coordenador
CREATE POLICY "Hierarquia health_historico leitura" ON projeto_health_historico
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR projeto_id IN (SELECT id FROM projetos WHERE coordenador_id = auth.uid())
  );

-- Histórico: apenas service_role escreve (via Edge Function)
CREATE POLICY "Service role escreve historico" ON projeto_health_historico
  FOR INSERT TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── TRIGGER: cria config com defaults ao criar projeto ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION criar_health_config_padrao()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO projeto_health_config (projeto_id)
  VALUES (NEW.id)
  ON CONFLICT (projeto_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_criar_health_config ON projetos;
CREATE TRIGGER trigger_criar_health_config
  AFTER INSERT ON projetos
  FOR EACH ROW
  EXECUTE FUNCTION criar_health_config_padrao();

-- ─── BACKFILL: criar config para projetos já existentes ────────────────────────────────────────────────────────────
INSERT INTO projeto_health_config (projeto_id)
SELECT id FROM projetos
ON CONFLICT (projeto_id) DO NOTHING;$pjf98795c2e7$);

insert into projte_config.template_migrations (seq, name, sql) values (57, '20260804124759_fix_cron_check_alertas.sql', $pj5286b8d431$-- Corrige supabase/migrations/20260416_cron_check_alertas.sql, que nao era
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
values ('supabase_functions_url', '{{PROJTE_FUNCTIONS_URL}}')
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
$pj5286b8d431$);

insert into projte_config.template_migrations (seq, name, sql) values (58, '20260804132300_fix_cron_health_score_semanal.sql', $pjd89160fa67$-- Mesmo padrao de bug corrigido em 20260804124759_fix_cron_check_alertas.sql:
-- o job 'health-score-semanal' tem a URL do Aceex hardcoded direto no
-- comando do cron ({{PROJTE_FUNCTIONS_URL}}/
-- health-score-calculator). Confirmado via `select * from cron.job`
-- (jobid=1, schedule '59 23 * * 0'). Corrigido pra usar
-- app_settings.supabase_functions_url (ja existe, inserido pela migration
-- anterior), tornando o job reproduzivel em qualquer clone.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio (idempotente --
-- pode ser reaplicado com seguranca em qualquer clone).

select cron.unschedule('health-score-semanal')
where exists (
  select 1 from cron.job where jobname = 'health-score-semanal'
);

do $$
declare
  v_functions_url text;
begin
  select value into v_functions_url from app_settings where key = 'supabase_functions_url';

  if v_functions_url is null or v_functions_url = '' then
    raise exception 'app_settings.supabase_functions_url nao configurado -- nao e possivel criar o cron job de health-score-semanal';
  end if;

  perform cron.schedule(
    'health-score-semanal',
    '59 23 * * 0',
    format(
      $sql$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json'), body := '{}'::jsonb)$sql$,
      v_functions_url || '/health-score-calculator'
    )
  );
end $$;
$pjd89160fa67$);

insert into projte_config.template_migrations (seq, name, sql) values (59, '20260804132400_fix_cron_sla_evaluator.sql', $pj427d427ff0$-- sla-evaluator (BL-013 P2) nunca teve um cron job real em producao. O
-- comentario de cabecalho do arquivo so documentava como criar um
-- manualmente via cron.schedule com a URL do Aceex hardcoded e um
-- Authorization Bearer com a service role key embutido no texto do job --
-- nunca foi de fato executado (confirmado via `select * from cron.job`).
--
-- Corrigido: sla-evaluator foi redeployado com verify_jwt=false (mesmo
-- padrao de check-alertas e health-score-semanal), entao o cron nao precisa
-- mais carregar a service role key em texto. A URL vem de
-- app_settings.supabase_functions_url (ja existe), tornando o job
-- reproduzivel em qualquer clone.
--
-- Aplicado em producao via MCP apply_migration em 2026-08-04; este arquivo
-- registra a mesma alteracao no historico do repositorio (idempotente --
-- pode ser reaplicado com seguranca em qualquer clone).

select cron.unschedule('sla-evaluator-diario')
where exists (
  select 1 from cron.job where jobname = 'sla-evaluator-diario'
);

do $$
declare
  v_functions_url text;
begin
  select value into v_functions_url from app_settings where key = 'supabase_functions_url';

  if v_functions_url is null or v_functions_url = '' then
    raise exception 'app_settings.supabase_functions_url nao configurado -- nao e possivel criar o cron job de sla-evaluator';
  end if;

  perform cron.schedule(
    'sla-evaluator-diario',
    '0 11 * * *',
    format(
      $sql$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json'), body := '{}'::jsonb)$sql$,
      v_functions_url || '/sla-evaluator'
    )
  );
end $$;
$pj427d427ff0$);

end
$seed$;

-- Vincula as 59 linhas (se acabaram de ser inseridas, ou se ja existiam sem
-- vinculo) a release v1.0.0, sem sobrescrever vinculos ja definidos.
update projte_config.template_migrations
set template_release_id = (select id from projte_config.template_releases where versao = 'v1.0.0' limit 1)
where template_release_id is null
  and (select id from projte_config.template_releases where versao = 'v1.0.0' limit 1) is not null;
