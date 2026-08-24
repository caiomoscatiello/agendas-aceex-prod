-- Pedido do Caio (2026-08-24): o painel Config PROJTE deve automatizar TAMBÉM
-- a publicação do frontend (Vercel), não só o schema (Supabase) -- "nosso
-- configurador do projte deve ser o painel que fara tudo isso... um
-- configurador/instalador de vdd". Ate aqui, o passo 5 (Publicar Frontend)
-- era 100% manual (colar a URL depois de publicar via dashboard da Vercel).
--
-- Esta coluna guarda o ID do projeto Vercel criado automaticamente pela nova
-- edge function projte-publish-frontend, pra reexecuções (reclicar o botão)
-- atualizarem o MESMO projeto em vez de criar um novo a cada vez. Fica em
-- projte_config.ambientes (schema de controle da PROJTE) -- não é dado do
-- cliente, não entra no template_migrations.

alter table projte_config.ambientes add column if not exists vercel_project_id text;
comment on column projte_config.ambientes.vercel_project_id is 'ID do projeto Vercel criado automaticamente por projte-publish-frontend (passo 5 do sequenciador). Null ate a primeira publicacao automatica rodar.';
