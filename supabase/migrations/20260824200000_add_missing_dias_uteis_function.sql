-- Bug real encontrado em 2026-08-24 clicando "Recriar Ambiente" no QA depois
-- do fix anterior (20260824190000, seq=81 -- 7 colunas + 2 views): a propria
-- migration 81 falhou (1/1 pendente) com "function dias_uteis(integer,
-- integer) does not exist" na criacao da view vw_capacidade_consultor.
--
-- Causa raiz do erro de diagnostico: a auditoria anterior usou ILIKE
-- ('%dias_uteis%') pra checar se a function ja tinha migration -- e o
-- ILIKE/LIKE do Postgres trata "_" como WILDCARD de 1 caractere (nao como
-- caractere literal), entao "%dias_uteis%" tambem bate em "dias uteis" (com
-- ESPACO no lugar do underscore). Essa string aparece no comment da tabela
-- feriados_nacionais (seq=62): "Calendario de feriados para calculo de dias
-- uteis" -- um falso-positivo que fez a auditoria concluir (errado) que a
-- function ja estava coberta. Reauditei TODAS as functions usando strpos()
-- (substring literal, sem wildcard) contra a lista real de functions de
-- producao (pg_proc) -- achei mais esse gap real (dias_uteis) e um segundo
-- nome (rls_auto_enable) que NAO precisa de migration: e o event trigger
-- "ensure_rls" que o proprio Supabase instala automaticamente em todo
-- projeto novo (dono "postgres", exige superuser pra criar -- nao e objeto
-- do produto).
--
-- dias_uteis so depende de feriados_nacionais (seq=62, mesma migration) --
-- por isso vai direto anexada ali (mesmo padrao ja usado com
-- tem_acesso_via_backlog_item em 20260824170000: function SQL-language,
-- validada contra o catalogo na CRIACAO, entao so pode vir depois da tabela
-- que ela consulta existir).

update projte_config.template_migrations
set sql = sql || E'\n\n-- dias_uteis nunca teve migration no repositorio original (mesmo padrao\n-- dos outros bugs de hoje) -- so depende de feriados_nacionais, criada\n-- acima nesta mesma migration.\ncreate or replace function public.dias_uteis(p_ano integer, p_mes integer)\nreturns integer\nlanguage sql\nstable\nas $f9$\n  SELECT COUNT(*)::integer\n  FROM generate_series(\n    make_date(p_ano, p_mes, 1),\n    (make_date(p_ano, p_mes, 1) + interval ''1 month'' - interval ''1 day'')::date,\n    ''1 day''::interval\n  ) AS d\n  WHERE\n    EXTRACT(dow FROM d) NOT IN (0, 6)\n    AND d::date NOT IN (\n      SELECT data FROM feriados_nacionais\n      WHERE tipo IN (''nacional'')\n    );\n$f9$;'
where name = '20260824160100_create_feriados_nacionais.sql'
  and sql not ilike '%create or replace function public.dias_uteis%';
