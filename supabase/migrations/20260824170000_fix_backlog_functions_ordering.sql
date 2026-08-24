-- Bug real encontrado em 2026-08-24 testando "Recriar Ambiente" no QA depois
-- do seed anterior (20260824160000_seed_missing_tables_into_template_migrations.sql):
-- migration 1/20 (create_backlog_diario_qa_sla_functions.sql) falhou com
-- "relation \"projeto_backlog\" does not exist" ao criar a function
-- tem_acesso_via_backlog_item.
--
-- Causa: diferente de funcoes plpgsql (corpo so e parseado/validado contra
-- o catalogo na PRIMEIRA EXECUCAO), uma function `language sql` tem o corpo
-- validado contra os objetos existentes JA NA CRIACAO -- o planner tenta
-- resolver a query interna assim que a function e criada. A migration de
-- funcoes (seq=61) roda ANTES da migration que cria projeto_backlog
-- (seq=67), entao tem_acesso_via_backlog_item falhava sempre num ambiente
-- novo (na producao, onde investiguei e validei o texto originalmente, a
-- tabela ja existia de antes -- por isso o erro so apareceu ao rodar de
-- verdade contra um ambiente vazio).
--
-- Corrigido tirando tem_acesso_via_backlog_item da migration de funcoes
-- (seq=61) e movendo pra dentro da migration que cria projeto_backlog
-- (seq=67), logo depois da tabela existir. Nao mexe no numero de
-- migrations nem na ordem (seq) -- so no CONTEUDO de duas delas, via
-- UPDATE (idempotente -- rodar de novo so reescreve o mesmo texto).

update projte_config.template_migrations
set sql = replace(
  sql,
  E'\n\n-- tem_acesso_via_backlog_item depende da tabela projeto_backlog existir --\n-- a migration seq=66 (create_projeto_backlog) roda antes desta ser\n-- efetivamente exercitada (RLS so e avaliada em runtime, nao na criacao da\n-- funcao), mas ela e criada aqui pra ficar junto das outras funcoes.\ncreate or replace function public.tem_acesso_via_backlog_item(_item_id uuid)\nreturns boolean\nlanguage sql\nstable security definer\nset search_path to ''public''\nas $f7$\n  select tem_acesso_projeto(\n    (select projeto_id from projeto_backlog where id = _item_id)\n  )\n$f7$;',
  ''
)
where name = '20260824160000_create_backlog_diario_qa_sla_functions.sql';

update projte_config.template_migrations
set sql = replace(
  sql,
  'alter table public.projeto_backlog enable row level security;',
  E'alter table public.projeto_backlog enable row level security;\n\n-- Movida pra ca (de create_backlog_diario_qa_sla_functions.sql) em\n-- 2026-08-24: e uma function `language sql`, validada contra o catalogo\n-- na criacao (nao so no primeiro uso como plpgsql) -- so pode ser criada\n-- depois que projeto_backlog existe.\ncreate or replace function public.tem_acesso_via_backlog_item(_item_id uuid)\nreturns boolean\nlanguage sql\nstable security definer\nset search_path to ''public''\nas $f7$\n  select tem_acesso_projeto(\n    (select projeto_id from projeto_backlog where id = _item_id)\n  )\n$f7$;'
)
where name = '20260824160600_create_projeto_backlog.sql';
