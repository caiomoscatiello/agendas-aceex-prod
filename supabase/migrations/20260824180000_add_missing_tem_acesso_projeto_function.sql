-- Bug real encontrado em 2026-08-24, segunda falha ao testar "Recriar
-- Ambiente" no QA (depois de corrigir a ordem de tem_acesso_via_backlog_item
-- em 20260824170000): migration 6/20 (create_projeto_backlog_colunas.sql)
-- falhou com "function tem_acesso_projeto(uuid) does not exist" ao criar a
-- policy colunas_select.
--
-- Causa: assumi errado que tem_acesso_projeto() ja existia desde a
-- migration seq=1 (mesma familia de has_role/is_authorized) so por ter
-- aparecido numa busca ILIKE com OR mal-feita -- na verdade ela nunca foi
-- criada em NENHUMA das 60 migrations originais do template, so existe em
-- producao (criada fora de migration, mesmo padrao dos outros bugs deste
-- dia). Usei ela nas policies de projeto_backlog_colunas e projeto_backlog
-- (seq 66/67) sem garantir que existia.
--
-- Diferente de tem_acesso_via_backlog_item (que dependia de uma tabela NOVA
-- e por isso precisou ficar depois dela), tem_acesso_projeto so depende de
-- has_role() (existe desde seq=1), projetos e agendas (ambas ja existiam
-- no template original) -- pode ir junto das outras funcoes, na migration
-- de seq=61, sem reordenar nada.

update projte_config.template_migrations
set sql = sql || E'\n\n-- tem_acesso_projeto nunca teve migration no repositorio original (foi\n-- criada fora de qualquer arquivo .sql, mesmo padrao dos outros bugs deste\n-- dia) -- so depende de has_role/projetos/agendas, que ja existem desde a\n-- migration seq=1, entao pode ser criada aqui junto com as outras funcoes.\ncreate or replace function public.tem_acesso_projeto(_projeto_id uuid)\nreturns boolean\nlanguage sql\nstable security definer\nset search_path to ''public''\nas $f8$\n  select (\n    has_role(auth.uid(), ''admin''::app_role)\n    or exists (\n      select 1 from projetos\n      where id = _projeto_id\n        and coordenador_id = auth.uid()\n    )\n    or exists (\n      select 1 from agendas a\n      join projetos p on p.nome_cliente = a.cliente\n      where p.id = _projeto_id\n        and a.user_id = auth.uid()\n    )\n  )\n$f8$;'
where name = '20260824160000_create_backlog_diario_qa_sla_functions.sql'
  and sql not ilike '%create or replace function public.tem_acesso_projeto%';
