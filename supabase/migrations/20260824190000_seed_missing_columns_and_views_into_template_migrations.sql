-- Bug real encontrado em 2026-08-24 rodando a Suite Completa (camada 4) pela
-- primeira vez contra um ambiente QA totalmente re-provisionado do zero
-- (blxfeaioadnzeaqncecf, depois dos fixes de 20260824160000/170000/180000):
-- quase todos os testes (A001, A002, AG001, AG003, AG004, AG005, IN001,
-- IN003, UI004 x2) falharam. A causa raiz NAO era mais nas 19 tabelas novas
-- (essas ja aplicaram limpo) -- era o MESMO padrao de bug em nivel de
-- COLUNA: colunas adicionadas a tabelas do template ORIGINAL fora de
-- qualquer migration (mesmo jeito que as 19 tabelas e os 3 helpers de
-- function foram descobertos), causando erro 400 do PostgREST
-- ("column does not exist") em queries reais do app (ex: GET /projetos
-- selecionando sharepoint_pasta_url), capturado pelo teste UI004 e
-- derrubando o carregamento normal do dashboard (cascata pra quase todos os
-- outros testes que dependem do app carregar).
--
-- Auditoria completa: comparei TODAS as colunas de TODAS as tabelas do
-- schema public (exceto as 19 tabelas novas, ja auditadas em
-- 20260824160000) contra o texto de todas as 60 migrations originais.
-- Achado: 7 colunas em 4 tabelas, e 2 VIEWS inteiras nunca foram
-- registradas em nenhuma migration:
--   apontamento_atividades.percentual_feeling
--   cronograma_itens.autentique_status
--   profiles.especialidade
--   profiles.horas_dia
--   projetos.autentique_folder_id
--   projetos.autentique_folder_url
--   projetos.sharepoint_pasta_url
--   view vw_capacidade_consultor (depende de profiles.especialidade/horas_dia,
--     consultor_disponibilidade -- tabela nova seq=63 -- e dias_uteis() --
--     function nova seq=62)
--   view vw_ocupacao_consultor (depende de vw_capacidade_consultor e
--     apontamento_atividades)
--
-- Registrada como seq=81 (depois das 20 migrations novas de
-- 20260824160000) -- nessa posicao todas as dependencias das views ja
-- existem (dias_uteis em seq=62, consultor_disponibilidade em seq=63,
-- profiles/projetos/apontamento_atividades/cronograma_itens/user_roles nas
-- migrations originais 1-60). DDL/coluna reconstruido via introspecao direta
-- do schema real de producao (information_schema.columns e pg_views).
-- Idempotente (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE VIEW).

do $seed_missing_columns_views$
declare
  v_release_id uuid;
begin
  select id into v_release_id
  from projte_config.template_releases
  where versao = 'v1.0.0'
  limit 1;

  if v_release_id is null then
    raise notice 'release v1.0.0 nao encontrada -- pulando seed de colunas/views.';
    return;
  end if;

  if exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id
      and name = '20260824190000_add_missing_columns_and_views.sql'
  ) then
    raise notice 'migration add_missing_columns_and_views ja registrada -- pulando.';
    return;
  end if;

  insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
    81,
    '20260824190000_add_missing_columns_and_views.sql',
    $addmissing$-- 7 colunas e 2 views que nunca tiveram migration no repositorio original
-- (criadas fora de qualquer arquivo .sql, mesmo padrao das 19 tabelas
-- registradas em 20260824160000) -- reconstruido via introspecao do schema
-- real de producao. Nessa posicao (seq=81) ja existem: dias_uteis()
-- (seq=62), consultor_disponibilidade (seq=63) e todas as tabelas/colunas
-- originais (profiles, projetos, apontamento_atividades, cronograma_itens,
-- user_roles -- migrations 1-60).

alter table public.profiles add column if not exists especialidade text;
alter table public.profiles add column if not exists horas_dia numeric not null default 8;

alter table public.projetos add column if not exists autentique_folder_id text;
alter table public.projetos add column if not exists autentique_folder_url text;
alter table public.projetos add column if not exists sharepoint_pasta_url text;

alter table public.apontamento_atividades add column if not exists percentual_feeling integer;

alter table public.cronograma_itens add column if not exists autentique_status text;

create or replace view public.vw_capacidade_consultor as
 SELECT p.user_id,
    p.name,
    p.email,
    p.especialidade,
    p.horas_dia,
    ur.role,
    cd.ano,
    cd.mes,
    cd.percentual AS disponibilidade_pct,
    dias_uteis(cd.ano, cd.mes) AS dias_uteis,
    round((((p.horas_dia * (dias_uteis(cd.ano, cd.mes))::numeric) * cd.percentual) / 100.0), 1) AS capacidade_horas,
    cd.observacao
   FROM ((profiles p
     JOIN user_roles ur ON ((ur.user_id = p.user_id)))
     JOIN consultor_disponibilidade cd ON ((cd.user_id = p.user_id)))
  WHERE (ur.role = ANY (ARRAY['consultor'::app_role, 'coordenador'::app_role]));

create or replace view public.vw_ocupacao_consultor as
 SELECT vc.user_id,
    vc.name,
    vc.email,
    vc.especialidade,
    vc.horas_dia,
    vc.role,
    vc.ano,
    vc.mes,
    vc.disponibilidade_pct,
    vc.dias_uteis,
    vc.capacidade_horas,
    vc.observacao,
    COALESCE(sum(aa.horas), (0)::numeric) AS horas_apontadas,
    round(((COALESCE(sum(aa.horas), (0)::numeric) / NULLIF(vc.capacidade_horas, (0)::numeric)) * (100)::numeric), 1) AS pct_ocupacao
   FROM (vw_capacidade_consultor vc
     LEFT JOIN apontamento_atividades aa ON (((aa.user_id = vc.user_id) AND ((EXTRACT(year FROM aa.data))::integer = vc.ano) AND ((EXTRACT(month FROM aa.data))::integer = vc.mes))))
  GROUP BY vc.user_id, vc.name, vc.email, vc.especialidade, vc.horas_dia, vc.role, vc.ano, vc.mes, vc.disponibilidade_pct, vc.dias_uteis, vc.capacidade_horas, vc.observacao;$addmissing$,
    v_release_id
  );
end
$seed_missing_columns_views$;
