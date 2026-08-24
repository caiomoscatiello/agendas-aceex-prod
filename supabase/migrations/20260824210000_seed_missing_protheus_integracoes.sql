-- Bug real encontrado em 2026-08-24 apos a analise detalhada dos logs de
-- falha de AG003, AG005, IN001 e IN003 (todos os testes que dependem de
-- sync com Protheus) na Suite Completa contra o ambiente QA. Todos falhavam
-- porque NENHUM log de sync com status "success" era gerado.
--
-- Causa raiz: a migration original que cria protheus_integracoes (seq=28,
-- 20260302170533) so semeia o codigo '0001' (Integ. User). Os codigos
-- '0002' a '0006' -- que hoje existem em producao, incluindo os dois usados
-- pelo sync de agenda (protheus-agenda-sync/index.ts: codigo 0003=incluir,
-- 0004=excluir) -- nunca tiveram migration nenhuma: foram inseridos direto
-- em producao fora de qualquer arquivo .sql (mesmo padrao de TODOS os
-- outros gaps encontrados hoje). Sem eles, protheus-agenda-sync sempre cai
-- no caminho ".eq('ativo', true).single()" retornando null -> loga só um
-- "info" (integração não ativa), nunca "success" -- exatamente o que os 4
-- testes reportaram.
--
-- endpoint e api_key ficam EM BRANCO/gerados frescos aqui (mesmo criterio
-- ja usado pro codigo 0001 original e documentado em
-- docs/etapa3-config-projte.md: "zero compartilhamento entre clientes...
-- cada ambiente é 100% independente" -- endpoint é preenchido depois pelo
-- proprio cliente, na tela de Integrações). NÃO uso o endpoint de mock do
-- projeto master aqui (seria vazamento entre ambientes, mesmo erro já
-- documentado com {{PROJTE_FUNCTIONS_URL}} nos cron jobs). A ativação do
-- endpoint de MOCK especifico do ambiente-alvo, só para a suite de QA, é
-- feita à parte, na semeadura de fixture de
-- projte-rodar-suite-completa/index.ts (que já roda por ambiente e conhece
-- a URL certa do projeto-alvo) -- ver commit irmão desta migration.

do $seed_protheus_integracoes$
declare
  v_release_id uuid;
begin
  select id into v_release_id
  from projte_config.template_releases
  where versao = 'v1.0.0'
  limit 1;

  if v_release_id is null then
    raise notice 'release v1.0.0 nao encontrada -- pulando seed de protheus_integracoes.';
    return;
  end if;

  if exists (
    select 1 from projte_config.template_migrations
    where template_release_id = v_release_id
      and name = '20260824210000_seed_missing_protheus_integracoes.sql'
  ) then
    raise notice 'migration seed_missing_protheus_integracoes ja registrada -- pulando.';
    return;
  end if;

  insert into projte_config.template_migrations (seq, name, sql, template_release_id) values (
    82,
    '20260824210000_seed_missing_protheus_integracoes.sql',
    $seedprotheus$-- codigos 0002-0006 de protheus_integracoes nunca tiveram migration (so o
-- 0001 original tinha, em 20260302170533) -- mesmo padrao dos outros gaps
-- de hoje. endpoint fica em branco (cada cliente preenche o dele na tela
-- de Integrações); api_key usa o default da tabela (gen_random_uuid(),
-- fresco por ambiente, nunca compartilhado).

insert into public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
select '0002', 'Recebimento de Projeto', 'Recebe', 'protheus-projects',
  '{"projeto": {"site": "https://exemplo.com", "contato": "(11) 99999-9999", "endereco": "Rua Exemplo, 123", "total_horas": 100, "deslocamento": 2, "nome_cliente": "Cliente Exemplo", "nome_contato": "João Silva", "email_contato": "contato@exemplo.com", "codigo_cliente": "ABC123", "coordenador_cliente": "Nome do Coordenador"}, "despesas": [{"tipo_despesa": "Alimentação", "valor_maximo": 50}], "atividades": [{"horas": 40, "codigo": "A01", "descricao": "Atividade 1", "itens_cronograma": [{"horas": 20, "codigo": "C01", "descricao": "Item 1"}]}]}'::jsonb,
  'Recebe cadastro completo de projeto via Protheus, incluindo despesas e atividades com itens de cronograma.'
where not exists (select 1 from public.protheus_integracoes where codigo = '0002');

insert into public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
select '0003', 'Inclusão de Agenda', 'Envia', '',
  '{"data": "2026-03-11", "projeto": "PRJ001", "codigo_cliente": "CLI001", "codigo_atividade": "ATV001", "codigo_consultor": "C001"}'::jsonb,
  'Gatilho: toda inclusão de agenda aprovada (inclusão direta pelo coordenador, upload CSV, ou solicitação aprovada pelo coordenador). Payload: Data, Projeto, Código do Consultor, Código do Cliente, Código da Atividade. Flag Integração: se origem for PROTHEUS, não dispara envio (evita loop).'
where not exists (select 1 from public.protheus_integracoes where codigo = '0003');

insert into public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
select '0004', 'Exclusão de Agenda', 'Envia', '',
  '{"items": [{"data": "2026-03-11", "projeto": "PRJ001", "codigo_cliente": "CLI001", "codigo_atividade": "ATV001", "codigo_consultor": "C001"}], "action": "excluir"}'::jsonb,
  'Gatilho: toda exclusão de agenda confirmada. Payload: Data, Projeto, Código do Consultor, Código do Cliente, Código da Atividade. Flag Integração: se origem for PROTHEUS, não bloqueia envio (exclusões sempre propagam).'
where not exists (select 1 from public.protheus_integracoes where codigo = '0004');

insert into public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
select '0005', 'Recebimento de Agenda (Inclusão)', 'Recebe', 'protheus-receber-agenda',
  '{"items": [{"data": "2026-03-11", "email": "user@example.com", "projeto": "000449", "codigo_cliente": "000449", "codigo_atividade": "ATV001", "codigo_consultor": "C001"}], "action": "incluir"}'::jsonb,
  'Recebe inclusões de agenda vindas do Protheus. Action: incluir. Flag de loop: origem PROTHEUS impede reenvio.'
where not exists (select 1 from public.protheus_integracoes where codigo = '0005');

insert into public.protheus_integracoes (codigo, descricao, direcao, webhook_path, payload_exemplo, guia_integracao)
select '0006', 'Recebimento de Agenda (Exclusão)', 'Recebe', 'protheus-receber-agenda',
  '{"items": [{"data": "2026-03-11", "email": "user@example.com", "projeto": "000449", "codigo_cliente": "000449", "codigo_atividade": "ATV001", "codigo_consultor": "C001"}], "action": "excluir"}'::jsonb,
  'Recebe exclusões de agenda vindas do Protheus. Action: excluir. Flag de loop: origem PROTHEUS impede reenvio.'
where not exists (select 1 from public.protheus_integracoes where codigo = '0006');$seedprotheus$,
    v_release_id
  );
end
$seed_protheus_integracoes$;
