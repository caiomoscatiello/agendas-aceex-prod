// qa/tests/AG_agendas.spec.ts
// BL-020 QA Skill Runner -- Grupo AG: Agendas
// Skills: AG001, AG003, AG004, AG005
// v13: AG003 -- o polling da v12 (abaixo) usava `order(timestamp desc).limit(10)`
//      SEM nenhum filtro de codigo/conteudo -- rodando a suite inteira
//      (chromium+mobile-chrome no mesmo comando, mais lenta e com mais
//      atividade no Supabase, que e o de PRODUCAO "Aceex Production"), outras
//      chamadas (create/incluir de AG004/AG005/IN001/IN002, ou atividade real
//      do sistema) empurraram o log desta agenda pra fora do "top 10" antes do
//      teste achar -- falha por busca fraca, nao por o log nao existir.
//      Corrigido pra filtrar por codigo=0004, por tempo (so a partir de um
//      marcador ANTES do cancelamento) e por conteudo (item do payload com a
//      mesma data exclusiva da agenda) -- deterministico e imune a ruido.
// v12: AG003 -- a checagem de integration_logs (action=excluir) era um tiro
//      unico logo apos o toast de sucesso. handleAceitar em
//      AdminSolicitacoesCancelamento.tsx dispara o sync do Protheus como
//      fire-and-forget (sem await) ANTES de mostrar o toast, entao o log podia
//      nao ter sido gravado ainda no exato instante da checagem. Trocado por
//      polling de ate 20s (mesmo raciocinio do waitForSupabaseRecord usado no
//      resto do arquivo).
// v11: a v10 (so esperar o card, sem clicar) NAO resolveu -- AG003/AG004
//      continuaram falhando com "element(s) not found" em btn-registrar-
//      apontamento/btn-solicitar-cancelamento mesmo com agenda-confirmada ja
//      visivel. Causa raiz real (ver garantirAgendaSelecionada em helpers.ts):
//      o auto-select do app roda so 1x quando o dia muda e nao depende de
//      `agendas` no useEffect -- se o fetch de agendas ainda nao tiver
//      chegado nesse instante exato, a auto-selecao e perdida pra sempre
//      naquele dia, mesmo que o card apareca segundos depois. Trocado o
//      padrao "esperar card (sem clicar)" por garantirAgendaSelecionada(),
//      que so clica no card se o painel de acoes ainda nao estiver ativo.
// v10: AG004/AG005 clicavam no card agenda-confirmada DEPOIS do auto-select
//      ja ter marcado a agenda como selecionada (efeito em ConsultorDashboardV2
//      -- selectedAgendas.length===1 -> handleSelectAgenda). O onClick desse
//      card faz TOGGLE (ConsultorDashboardV2.tsx linha 1549:
//      onClick={() => isSel ? handleDeselectAgenda() : handleSelectAgenda(ag)}).
//      Como a agenda ja estava selecionada (isSel=true) quando o teste clicava,
//      esse clique DESMARCAVA a agenda -- selectedAgenda virava null e todo o
//      bloco de botoes (Apontamento/Cancelamento) parava de renderizar, dando
//      "element(s) not found" em btn-registrar-apontamento. Corrigido: so
//      esperamos o card ficar visivel (sincroniza o render), sem clicar nele.
//      Tambem adicionada a mesma espera (sem clique) em AG003, como ponto de
//      sincronizacao antes de checar btn-solicitar-cancelamento.
// v9: AG004/AG005 usavam data FUTURA (hoje+11/+12) pra fixture de apontamento.
//     Causa raiz real (confirmada lendo ConsultorDashboardV2.tsx linha 749/1673):
//     btn-registrar-apontamento tem disabled={isApontamentoDone || isDateFuture
//     || isProjetoNaoLiberado} -- isDateFuture = isAfter(data selecionada, hoje
//     0h). Ou seja, o app corretamente IMPEDE apontar horas numa agenda cuja
//     data ainda nao chegou (faz sentido: nao se aponta trabalho que ainda nao
//     foi feito). O botao nunca ia habilitar com uma data futura, nao importa
//     quanto tempo o teste esperasse -- nao era timing, era o teste pedindo pro
//     app fazer algo que a regra de negocio corretamente bloqueia. Corrigido:
//     AG004 agora usa hoje (dataFutura(0)) e AG005 usa ontem (dataFutura(-1)) --
//     nao ha "min" no input-data-agenda, entao o fluxo de requisitar/aprovar
//     aceita essas datas normalmente. teardown.ts atualizado para limpar 0/-1.
// v8: AG003/AG004/AG005 agora criam e aprovam sua PROPRIA agenda confirmada
//     (via criarEAprovarAgenda, datas exclusivas 10/11/12) em vez de buscar
//     "qualquer agenda confirmada" do consultor no banco. Motivo: AG_agendas.spec.ts
//     e IN_integracoes.spec.ts rodam em paralelo (2 workers) -- com uma unica
//     agenda compartilhada (a de AG001), AG003 (que cancela/deleta a agenda que
//     pega) podia consumir a mesma linha que AG004/AG005 ainda precisavam usar,
//     ou colidir com IN003 (que faz a mesma busca). Cada teste ter sua propria
//     agenda numa data exclusiva elimina essa disputa de vez.
// v7: AG003/AG004/AG005 buscavam "qualquer" agenda com status=confirmada sem
//     filtrar por usuario -- a tabela `agendas` acumula linhas confirmada de
//     usuarios reais de producao (nunca limpas pelo teardown), entao o teste
//     podia pegar por engano uma agenda que nao pertence ao consultor de
//     teste logado, e nenhum testid do dono aparecia na tela.
// v6: removido o afterAll(teardownTestData) local -- rodava em paralelo com o
//     mesmo afterAll de IN_integracoes.spec.ts (2 workers) e um arquivo
//     apagava, no meio do teste, as agendas que o outro ainda estava usando
//     (mesma faixa fixa de datas hoje+7/8/9/14/21 nos dois arquivos). A
//     limpeza agora roda uma unica vez no final da suite inteira, via
//     globalTeardown (ver qa/teardown.ts e playwright.config.ts).
// v5: select-atividade fica desabilitado ate um Projeto ser selecionado no
//     modal "Requisitar Agenda" -- helper selecionarProjetoEAtividade cobre
//     os dois passos (Projeto -> aguarda habilitar -> Atividade).
// Encoding: UTF-8 sem BOM

import { test, expect } from '@playwright/test';
import {
  login,
  dataFutura,
  TEST_PREFIX,
  supabaseAdmin,
  waitForSupabaseRecord,
  selecionarDiaCalendario,
  selecionarProjetoEAtividade,
  criarEAprovarAgenda,
  garantirAgendaSelecionada,
  QA_PROJETO_NOME,
} from './helpers';

// ?? AG001 -- Solicitar e aprovar agenda ????????????????????????????????????????
test('AG001 - Solicitar e aprovar agenda (dupla)', async ({ browser }) => {
  const DATA_TESTE = dataFutura(7);

  const ctxConsultor   = await browser.newContext();
  const ctxCoordenador = await browser.newContext();
  const pageC          = await ctxConsultor.newPage();
  const pageK          = await ctxCoordenador.newPage();

  try {
    // Step 1-4: Consultor solicita agenda
    await login(pageC, 'consultor');
    await pageC.waitForSelector('[data-testid=btn-requisitar-agenda]', { timeout: 10_000 });
    await pageC.click('[data-testid=btn-requisitar-agenda]');

    await pageC.waitForSelector('[data-testid=input-data-agenda]');
    await pageC.fill('[data-testid=input-data-agenda]', DATA_TESTE);

    // Projeto precisa ser escolhido antes -- select-atividade fica disabled
    // ate reqCliente ser preenchido (e ate o fetch de atividades terminar).
    await selecionarProjetoEAtividade(pageC);

    // btn-confirmar-requisicao fica disabled ate reqHoras ser preenchido
    // (disabled={!reqData || !reqCliente || !reqHoras}) -- selecionar
    // Projeto+Atividade nao basta.
    await pageC.fill('[data-testid=input-horas-requisicao]', '4');

    await pageC.click('[data-testid=btn-confirmar-requisicao]');

    // Aguardar toast de confirmacao
    await expect(pageC.locator('[data-testid=toast]').or(
      pageC.locator('li[role=status]')
    )).toBeVisible({ timeout: 10_000 });

    // Step 5-7: Coordenador aprova
    await login(pageK, 'coordenador');

    // Abrir flyout Agendas e clicar em Solicitacoes
    await pageK.click('[data-testid=nav-agendas]');
    await pageK.waitForSelector('[data-testid=flyout-agendas]');
    await pageK.locator('[data-testid=flyout-agendas] [data-testid=flyout-item]')
      .filter({ hasText: /Solicita/i })
      .click();

    // Aguardar solicitacao aparecer (AdminPendentes.tsx)
    await pageK.waitForSelector('[data-testid=solicitacao-row]', { timeout: 15_000 });

    // btn-aprovar-solicitacao so ABRE o dialog "Aceitar Requisicao" -- a
    // atividade pode vir pre-selecionada se o codigo bater exatamente com o
    // que o consultor escolheu, mas selecionamos explicitamente pra nao
    // depender desse auto-match.
    await pageK.locator('[data-testid=btn-aprovar-solicitacao]').first().click();
    await pageK.waitForSelector('[data-testid=select-atividade-aprovacao]', { timeout: 10_000 });
    await pageK.click('[data-testid=select-atividade-aprovacao]');
    await pageK.getByRole('option').first().click();
    await pageK.click('[data-testid=btn-confirmar-aceitar-atividade]');

    await expect(pageK.locator('[data-testid=toast]').or(
      pageK.locator('li[role=status]')
    )).toBeVisible({ timeout: 10_000 });

    // Step 8-9: Verificar no banco
    const encontrada = await waitForSupabaseRecord('agendas', {
      data: DATA_TESTE,
      status: 'confirmada',
    }, 15_000);
    expect(encontrada, `Agenda com data ${DATA_TESTE} nao encontrada com status=confirmada`).toBe(true);

    // Step 8: Consultor ve agenda confirmada no calendario
    await pageC.reload();
    await pageC.waitForLoadState('networkidle');
    await selecionarDiaCalendario(pageC, DATA_TESTE);
    await expect(pageC.locator('[data-testid=agenda-confirmada]').first()).toBeVisible({ timeout: 10_000 });

  } finally {
    await ctxConsultor.close();
    await ctxCoordenador.close();
  }
});

// ?? AG003 -- Cancelar agenda confirmada ????????????????????????????????????????
test('AG003 - Cancelar agenda confirmada (dupla)', async ({ browser }) => {
  const db         = supabaseAdmin();
  const DATA_TESTE = dataFutura(10); // data exclusiva -- nao reaproveita a de AG001/IN001/IN002

  // Cria e aprova a PROPRIA agenda confirmada desse teste, para nao disputar
  // com AG004/AG005/IN003 (que fazem o mesmo em datas diferentes).
  await criarEAprovarAgenda(browser, DATA_TESTE);

  const { data: agendaRows } = await db
    .from('agendas')
    .select('id, data, cliente')
    .eq('data', DATA_TESTE)
    .eq('status', 'confirmada')
    .limit(1);

  if (!agendaRows || agendaRows.length === 0) {
    throw new Error(`Agenda de fixture para ${DATA_TESTE} nao foi encontrada apos criarEAprovarAgenda`);
  }
  const agenda = agendaRows[0];

  // v12: marcador de tempo capturado ANTES do fluxo de cancelamento comecar --
  // usado la embaixo (Step 8) pra escopar a busca do log de exclusao so ao
  // que acontece DAQUI pra frente, em vez de vasculhar todo o historico.
  const antesCancelamento = new Date();

  const ctxConsultor   = await browser.newContext();
  const ctxCoordenador = await browser.newContext();
  const pageC          = await ctxConsultor.newPage();
  const pageK          = await ctxCoordenador.newPage();

  try {
    // Step 2-4: Consultor solicita cancelamento
    await login(pageC, 'consultor');
    await pageC.waitForLoadState('networkidle');

    // btn-solicitar-cancelamento so aparece com selectedAgenda setado --
    // precisa selecionar o dia no calendario primeiro (efeito de auto-select
    // dispara ao definir selectedDate quando ha exatamente 1 agenda no dia).
    await selecionarDiaCalendario(pageC, agenda.data);

    // Garante a selecao (auto-select pode falhar por race -- ver v11/helpers.ts).
    await garantirAgendaSelecionada(pageC, QA_PROJETO_NOME);

    const btnCancelar = pageC.locator('[data-testid=btn-solicitar-cancelamento]').first();
    await expect(btnCancelar).toBeVisible({ timeout: 15_000 });
    await btnCancelar.click();

    await pageC.fill('[data-testid=input-justificativa]', `${TEST_PREFIX} Cancelamento automatizado QA`);
    await pageC.click('[data-testid=btn-confirmar-cancelamento]');
    await expect(pageC.locator('li[role=status]')).toBeVisible({ timeout: 10_000 });

    // Step 5-6: Coordenador aceita cancelamento (AdminSolicitacoesCancelamento.tsx --
    // botao Aceitar aqui e um clique direto, sem dialog intermediario)
    await login(pageK, 'coordenador');
    await pageK.click('[data-testid=nav-agendas]');
    await pageK.waitForSelector('[data-testid=flyout-agendas]');
    await pageK.locator('[data-testid=flyout-agendas] [data-testid=flyout-item]')
      .filter({ hasText: /Cancelamento/i })
      .click();

    await pageK.waitForSelector('[data-testid=btn-aceitar-cancelamento]', { timeout: 10_000 });
    await pageK.locator('[data-testid=btn-aceitar-cancelamento]').first().click();
    await expect(pageK.locator('li[role=status]')).toBeVisible({ timeout: 10_000 });

    // Step 7: Verificar agenda deletada do banco
    const { count } = await db
      .from('agendas')
      .select('id', { count: 'exact', head: true })
      .eq('id', agenda.id);
    expect(count, 'Agenda deveria ter sido deletada do banco').toBe(0);

    // Step 8: Verificar integration_logs com action=excluir -- com POLLING.
    // handleAceitar (AdminSolicitacoesCancelamento.tsx) dispara o sync do
    // Protheus como fire-and-forget (supabase.functions.invoke(...).catch(...),
    // sem await) ANTES de mostrar o toast -- ou seja, o toast pode aparecer
    // bem antes do log realmente ser gravado. Uma checagem unica logo apos o
    // toast e uma race; precisa dar tempo (mesmo padrao de waitForSupabaseRecord
    // usado no resto do arquivo, mas aqui precisamos inspecionar o payload).
    //
    // v12: a query antiga (`order(timestamp desc).limit(10)`, sem nenhum
    // filtro de codigo/tempo/conteudo) e fragil neste projeto Supabase, que e
    // o de PRODUCAO ("Aceex Production") -- rodando a suite inteira
    // (chromium+mobile-chrome), outras chamadas (create/incluir de
    // AG004/AG005/IN001/IN002, ou ate atividade real do sistema) podem gerar
    // 10+ linhas novas em integration_logs antes do log desta agenda ser
    // escrito, empurrando ele pra fora do "top 10" e fazendo o teste falhar
    // por nao achar algo que na verdade foi gravado (so nao estava nas ultimas
    // 10 linhas globais). Fix: filtrar por codigo=0004, por tempo (so a partir
    // de antesCancelamento, nao o historico todo) e por conteudo (o item do
    // payload bate com a data exclusiva desta agenda) -- deterministico
    // independente de quanto ruido exista no sistema.
    let logExcluir: any = null;
    const inicioLogExcluir = Date.now();
    while (Date.now() - inicioLogExcluir < 20_000 && !logExcluir) {
      const { data: logs } = await db
        .from('integration_logs')
        .select('id, status, payload')
        .eq('status', 'success')
        .eq('codigo', '0004')
        .gt('timestamp', antesCancelamento.toISOString());

      logExcluir = logs?.find((l: any) =>
        l.payload?.action === 'excluir' &&
        Array.isArray(l.payload?.items) &&
        l.payload.items.some((it: any) => it.data === agenda.data)
      );
      if (!logExcluir) await new Promise(r => setTimeout(r, 2000));
    }
    expect(logExcluir, 'Log de sync Protheus action=excluir (desta agenda) nao encontrado em 20s').toBeTruthy();

  } finally {
    await ctxConsultor.close();
    await ctxCoordenador.close();
  }
});

// ?? AG004 -- Apontamento de horas ??????????????????????????????????????????????
// Reescrito: o fluxo real de apontamento no ConsultorDashboardV2 e um modal
// unico (Registrar Apontamento -> Confirmar), gravando em apontamento_atividades
// e atualizando o status da agenda (apontamento_ok ou em_aprovacao, dependendo
// de checkAutoApprove). Nao ha registro de entrada/saida em tempo real -- o
// fluxo antigo com btn-registrar-entrada/btn-registrar-saida nao existe mais.
test('AG004 - Apontamento de horas', async ({ browser, page }) => {
  const db = supabaseAdmin();
  const HORAS_TESTE = 3;
  // hoje, NAO futuro -- btn-registrar-apontamento fica disabled quando
  // isDateFuture=true (ver v9 no topo do arquivo). Apontamento e retroativo
  // por natureza (voce aponta horas ja trabalhadas).
  const DATA_TESTE  = dataFutura(0);

  await criarEAprovarAgenda(browser, DATA_TESTE);

  const { data: agendaRows } = await db
    .from('agendas')
    .select('id, data, user_id')
    .eq('data', DATA_TESTE)
    .eq('status', 'confirmada')
    .limit(1);

  if (!agendaRows || agendaRows.length === 0) {
    throw new Error(`Agenda de fixture para ${DATA_TESTE} nao foi encontrada apos criarEAprovarAgenda`);
  }
  const agenda = agendaRows[0];

  await login(page, 'consultor');
  await page.waitForLoadState('networkidle');
  await selecionarDiaCalendario(page, agenda.data);

  // Garante a selecao (auto-select pode falhar por race -- ver v11/helpers.ts).
  await garantirAgendaSelecionada(page, QA_PROJETO_NOME);

  const btnApontamento = page.locator('[data-testid=btn-registrar-apontamento]');
  await expect(btnApontamento).toBeVisible({ timeout: 10_000 });
  await btnApontamento.click();

  // Selecionar atividade (Radix/shadcn Select -- clicar trigger + opcao)
  await page.click('[data-testid=select-atividade-apontamento]');
  await page.getByRole('option').first().click();

  await page.fill('[data-testid=input-horas-apontamento]', String(HORAS_TESTE));
  await page.fill('[data-testid=input-percentual-feeling]', '50');

  await page.click('[data-testid=btn-continuar-apontamento]');

  // Dialog "Confirmar Apontamento" (resumo)
  await page.click('[data-testid=btn-confirmar-apontamento]');
  await expect(page.locator('li[role=status]')).toBeVisible({ timeout: 10_000 });

  await page.waitForTimeout(1500);

  // Verificar no banco: status saiu de "confirmada"
  const { data: agAtualizada } = await db
    .from('agendas')
    .select('status')
    .eq('id', agenda.id)
    .single();

  expect(
    agAtualizada?.status,
    'Status da agenda deveria mudar para apontamento_ok ou em_aprovacao apos o apontamento'
  ).toMatch(/apontamento_ok|em_aprovacao/);

  // Verificar registro criado em apontamento_atividades com as horas informadas
  const { data: apontRows, count } = await db
    .from('apontamento_atividades' as any)
    .select('id, horas', { count: 'exact' })
    .eq('agenda_id', agenda.id);

  expect(count, 'Deveria existir ao menos 1 registro em apontamento_atividades').toBeGreaterThanOrEqual(1);
  expect(
    (apontRows || []).some((r: any) => Number(r.horas) === HORAS_TESTE),
    `Deveria haver um registro com horas=${HORAS_TESTE}`
  ).toBe(true);
});

// ?? AG005 -- % de conclusao (feeling) no apontamento ???????????????????????????
// Reescrito: nao existe mais btn-registrar-feeling/slider-feeling isolado.
// O % de conclusao ("feeling") e preenchido dentro do modal "Registrar
// Apontamento", por atividade. Fluxo real: selecionar dia -> abrir modal ->
// escolher atividade -> preencher horas + % conclusao -> Continuar -> Confirmar.
test('AG005 - Feeling de atividade com sync Protheus', async ({ browser, page }) => {
  const db = supabaseAdmin();
  // ontem, NAO futuro -- mesmo motivo de AG004 (v9). Usa uma data diferente
  // de AG004 (hoje) pra nao disputar a mesma agenda/dia.
  const DATA_TESTE = dataFutura(-1);

  await criarEAprovarAgenda(browser, DATA_TESTE);

  const { data: agendaRows } = await db
    .from('agendas')
    .select('id, data, user_id')
    .eq('data', DATA_TESTE)
    .eq('status', 'confirmada')
    .limit(1);

  if (!agendaRows || agendaRows.length === 0) {
    throw new Error(`Agenda de fixture para ${DATA_TESTE} nao foi encontrada apos criarEAprovarAgenda`);
  }
  const agenda = agendaRows[0];

  await login(page, 'consultor');
  await page.waitForLoadState('networkidle');
  await selecionarDiaCalendario(page, agenda.data);

  // Garante a selecao (auto-select pode falhar por race -- ver v11/helpers.ts).
  await garantirAgendaSelecionada(page, QA_PROJETO_NOME);

  const btnApontamento = page.locator('[data-testid=btn-registrar-apontamento]');
  await expect(btnApontamento).toBeVisible({ timeout: 10_000 });
  await btnApontamento.click();

  // Selecionar atividade (mesmo padrao Radix/shadcn do select-atividade)
  await page.click('[data-testid=select-atividade-apontamento]');
  await page.getByRole('option').first().click();

  await page.fill('[data-testid=input-horas-apontamento]', '2');
  await page.fill('[data-testid=input-percentual-feeling]', '75');

  await page.click('[data-testid=btn-continuar-apontamento]');

  // Dialog "Confirmar Apontamento" (resumo)
  await page.click('[data-testid=btn-confirmar-apontamento]');
  await expect(page.locator('li[role=status]')).toBeVisible({ timeout: 10_000 });

  // Verificar integration_logs: sync apos apontamento
  const logEncontrado = await waitForSupabaseRecord('integration_logs', {
    status: 'success',
  }, 30_000);
  expect(logEncontrado, 'Nenhum log de sync apos registrar apontamento/feeling').toBe(true);
});