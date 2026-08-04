// qa/tests/IN_integracoes.spec.ts
// BL-020 QA Skill Runner -- Grupo IN: Integracoes (smoke tests)
// Skills: IN001, IN002, IN003
// v12: IN003 -- rodando a suite INTEIRA (chromium+mobile-chrome no mesmo
//      comando), o log [create] da propria fixture voltou a vazar por cima do
//      timestampInicio (4 logs em vez de 3), mesmo com o wait de v10/v11.
//      Causa: esse Supabase e o de PRODUCAO ("Aceex Production") -- depender
//      so de uma janela de tempo pra separar "log de setup" de "log de
//      cancelamento" e fragil (outra atividade no projeto pode gerar linhas a
//      qualquer momento). Fix definitivo: filtrar direto pela ACAO esperada
//      (cancel/excluir), ignorando create/incluir/update onde quer que
//      apareçam -- ver bloco 'relevantes'. Removida a dependencia de
//      aguardarSyncMondayFixture (nao e mais necessaria pra corretude, so
//      adicionava ate 20s de espera desnecessaria).
// v11: IN003 -- diagnostico final (nao era race, era expectativa errada). Lendo
//      integration_logs linha a linha (Supabase MCP) numa execucao que falhou
//      com "3 logs, esperado 2": os 3 logs eram MONDAY-AGENDA-SYNC[cancel],
//      "0004"[MOCK recebeu] (mock-protheus/index.ts) e "0004"[enviado]
//      (protheus-agenda-sync/index.ts) -- 2 servicos distintos logando o MESMO
//      evento de exclusao em pontos diferentes da integracao, por design, nao
//      um loop. Corrigido o cap de <=2 para ==3 (exatamente o que uma exclusao
//      correta gera) e o count passou a ser filtrado pelos codigos relevantes
//      (MONDAY-AGENDA-SYNC/0003/0004) em vez de qualquer log "success" do
//      sistema inteiro no periodo.
// v10: IN003 -- agora que o QA-COORD-TEST tem um board Monday real (antes so
//      falhava rapido por "sem board"), o sync monday-agenda-sync ficou mais
//      lento (2 round-trips reais a API do Monday por chamada). Isso expos
//      uma race: o log de CRIACAO da fixture podia terminar de gravar DEPOIS
//      do timestampInicio ser marcado, contando como um log "novo" espurio
//      no anti-loop (3 logs em vez de 2). Corrigido chamando
//      aguardarSyncMondayFixture(agenda.id) logo apos criarEAprovarAgenda,
//      ANTES de marcar timestampInicio (ver helpers.ts v8).
// v9: a v8 (so esperar o card, sem clicar) NAO resolveu -- IN003 continuou
//     falhando com "element(s) not found" em btn-solicitar-cancelamento mesmo
//     com agenda-confirmada ja visivel. Causa raiz real e o mesmo fix aplicado
//     em AG_agendas.spec.ts v11: troca por garantirAgendaSelecionada() (ver
//     helpers.ts), que so clica no card se o painel de acoes ainda nao
//     estiver ativo -- cobre a race do auto-select do app que roda 1x so e
//     nao depende de `agendas` no useEffect.
// v8: IN003 -- adicionada espera pelo card agenda-confirmada (sem clicar)
//     antes de checar btn-solicitar-cancelamento, como ponto de sincronizacao
//     com o auto-select do app. Mesmo ajuste feito em AG_agendas.spec.ts v10
//     (ver esse arquivo para o detalhe do bug de toggle que isso evita em
//     AG004/AG005 -- aqui em IN003 nao havia clique extra, so a sincronizacao
//     foi adicionada por seguranca).
// v7: IN003 agora cria e aprova a PROPRIA agenda confirmada (via
//     criarEAprovarAgenda, data exclusiva 13) em vez de buscar "qualquer
//     agenda confirmada" do consultor no banco -- eliminava a disputa com
//     AG003/AG004/AG005, que fazem o mesmo em datas diferentes (mesmo fix
//     de AG_agendas.spec.ts v8). O timestampInicio do anti-loop tambem foi
//     movido pra DEPOIS da criacao/aprovacao da fixture, senao os logs de
//     sync gerados na propria criacao contavam como "logs novos" no teste.
// v6: IN003 buscava "qualquer" agenda com status=confirmada sem filtrar por
//     usuario -- podia pegar uma agenda confirmada de outro usuario
//     (producao) nunca limpa pelo teardown.
// v5: removido o afterAll(teardownTestData) local -- rodava em paralelo com o
//     mesmo afterAll de AG_agendas.spec.ts (2 workers), apagando agendas que
//     o outro arquivo ainda estava usando. Limpeza agora e feita uma unica
//     vez ao final da suite via globalTeardown (qa/teardown.ts).
// v4: select-atividade fica desabilitado ate um Projeto ser selecionado --
//     troca do clique inline por selecionarProjetoEAtividade (mesmo fix de
//     AG_agendas.spec.ts AG001).
// Encoding: UTF-8 sem BOM

import { test, expect } from '@playwright/test';
import {
  login,
  dataFutura,
  supabaseAdmin,
  selecionarDiaCalendario,
  selecionarProjetoEAtividade,
  criarEAprovarAgenda,
  garantirAgendaSelecionada,
  QA_PROJETO_NOME,
} from './helpers';

// Helper: conta logs de integracao apos um timestamp
async function contarLogsApos(timestampInicio: Date, filtroStatus = 'success') {
  const db = supabaseAdmin();
  const { count } = await db
    .from('integration_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', filtroStatus)
    .gt('timestamp', timestampInicio.toISOString());
  return count ?? 0;
}

// Helper: aguarda novo log aparecer (polling 2s)
async function aguardarNovoLog(
  timestampInicio: Date,
  filtroStatus = 'success',
  timeoutMs = 30_000
): Promise<boolean> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const count = await contarLogsApos(timestampInicio, filtroStatus);
    if (count > 0) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

// ?? IN001 -- Sync agenda -> Protheus ???????????????????????????????????????????
test('IN001 - Sync agenda aprovada para Protheus', async ({ browser }) => {
  const DATA_TESTE      = dataFutura(8); // dia diferente dos outros testes
  const timestampInicio = new Date();

  const ctxC = await browser.newContext();
  const ctxK = await browser.newContext();
  const pageC = await ctxC.newPage();
  const pageK = await ctxK.newPage();

  try {
    // Consultor solicita agenda
    await login(pageC, 'consultor');
    await pageC.waitForSelector('[data-testid=btn-requisitar-agenda]', { timeout: 10_000 });
    await pageC.click('[data-testid=btn-requisitar-agenda]');
    await pageC.fill('[data-testid=input-data-agenda]', DATA_TESTE);

    // Projeto precisa ser escolhido antes -- select-atividade fica disabled
    // ate reqCliente ser preenchido (ver AG_agendas.spec.ts AG001).
    await selecionarProjetoEAtividade(pageC);

    // btn-confirmar-requisicao fica disabled ate reqHoras ser preenchido
    // (ver AG_agendas.spec.ts AG001).
    await pageC.fill('[data-testid=input-horas-requisicao]', '4');

    await pageC.click('[data-testid=btn-confirmar-requisicao]');
    await pageC.locator('li[role=status]').waitFor({ timeout: 10_000 });

    // Coordenador aprova (AdminPendentes.tsx: btn-aprovar-solicitacao abre
    // dialog, precisa selecionar atividade e confirmar)
    await login(pageK, 'coordenador');
    await pageK.click('[data-testid=nav-agendas]');
    await pageK.waitForSelector('[data-testid=flyout-agendas]');
    await pageK.locator('[data-testid=flyout-agendas] [data-testid=flyout-item]')
      .filter({ hasText: /Solicita/i })
      .click();
    await pageK.waitForSelector('[data-testid=btn-aprovar-solicitacao]', { timeout: 15_000 });
    await pageK.locator('[data-testid=btn-aprovar-solicitacao]').first().click();
    await pageK.waitForSelector('[data-testid=select-atividade-aprovacao]', { timeout: 10_000 });
    await pageK.click('[data-testid=select-atividade-aprovacao]');
    await pageK.getByRole('option').first().click();
    await pageK.click('[data-testid=btn-confirmar-aceitar-atividade]');
    await pageK.locator('li[role=status]').waitFor({ timeout: 10_000 });

    // Verificar log de sync Protheus em ate 30s
    const logEncontrado = await aguardarNovoLog(timestampInicio, 'success', 30_000);
    expect(logEncontrado, 'Nenhum log de sync Protheus encontrado apos aprovacao da agenda').toBe(true);

    // Verificar conteudo do log
    const db = supabaseAdmin();
    const { data: logs } = await db
      .from('integration_logs')
      .select('id, status, payload, timestamp')
      .eq('status', 'success')
      .gt('timestamp', timestampInicio.toISOString())
      .order('timestamp', { ascending: false })
      .limit(5);

    expect(logs && logs.length > 0, 'Log de sucesso nao encontrado no banco').toBe(true);

    // Verificar payload contem action=incluir ou estrutura de agenda
    const logComPayload = logs?.find((l: any) =>
      l.payload?.action === 'incluir' ||
      l.payload?.agendas ||
      l.payload?.items
    );
    expect(logComPayload, 'Log nao contem payload de inclusao de agenda').toBeTruthy();

  } finally {
    await ctxC.close();
    await ctxK.close();
  }
});

// ?? IN002 -- Sync agenda -> Monday ?????????????????????????????????????????????
test('IN002 - Sync agenda aprovada para Monday', async ({ browser }) => {
  const DATA_TESTE      = dataFutura(9);
  const timestampInicio = new Date();

  const ctxC = await browser.newContext();
  const ctxK = await browser.newContext();
  const pageC = await ctxC.newPage();
  const pageK = await ctxK.newPage();

  try {
    // Consultor solicita
    await login(pageC, 'consultor');
    await pageC.waitForSelector('[data-testid=btn-requisitar-agenda]', { timeout: 10_000 });
    await pageC.click('[data-testid=btn-requisitar-agenda]');
    await pageC.fill('[data-testid=input-data-agenda]', DATA_TESTE);

    await selecionarProjetoEAtividade(pageC);

    // btn-confirmar-requisicao fica disabled ate reqHoras ser preenchido
    // (ver AG_agendas.spec.ts AG001).
    await pageC.fill('[data-testid=input-horas-requisicao]', '4');

    await pageC.click('[data-testid=btn-confirmar-requisicao]');
    await pageC.locator('li[role=status]').waitFor({ timeout: 10_000 });

    // Coordenador aprova (mesmo fluxo de 2 passos do IN001)
    await login(pageK, 'coordenador');
    await pageK.click('[data-testid=nav-agendas]');
    await pageK.waitForSelector('[data-testid=flyout-agendas]');
    await pageK.locator('[data-testid=flyout-agendas] [data-testid=flyout-item]')
      .filter({ hasText: /Solicita/i })
      .click();
    await pageK.waitForSelector('[data-testid=btn-aprovar-solicitacao]', { timeout: 15_000 });
    await pageK.locator('[data-testid=btn-aprovar-solicitacao]').first().click();
    await pageK.waitForSelector('[data-testid=select-atividade-aprovacao]', { timeout: 10_000 });
    await pageK.click('[data-testid=select-atividade-aprovacao]');
    await pageK.getByRole('option').first().click();
    await pageK.click('[data-testid=btn-confirmar-aceitar-atividade]');
    await pageK.locator('li[role=status]').waitFor({ timeout: 10_000 });

    // Aguardar log Monday em ate 30s
    const db = supabaseAdmin();
    const inicio = Date.now();
    let logMonday = null;

    while (Date.now() - inicio < 30_000) {
      const { data: logs } = await db
        .from('integration_logs')
        .select('id, status, codigo, payload, timestamp')
        .gt('timestamp', timestampInicio.toISOString())
        .order('timestamp', { ascending: false })
        .limit(20);

      logMonday = logs?.find((l: any) =>
        String(l.codigo || '').toLowerCase().includes('monday') ||
        String(JSON.stringify(l.payload || '')).toLowerCase().includes('monday')
      );

      if (logMonday) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    expect(logMonday, 'Nenhum log de sync Monday encontrado em 30s apos aprovacao').toBeTruthy();
    expect(logMonday?.status, 'Status do sync Monday deve ser success').toBe('success');

  } finally {
    await ctxC.close();
    await ctxK.close();
  }
});

// ?? IN003 -- Anti-loop exclusao de agenda ??????????????????????????????????????
test('IN003 - Anti-loop: exclusao dispara sync uma unica vez', async ({ browser }) => {
  const db         = supabaseAdmin();
  const DATA_TESTE = dataFutura(13); // data exclusiva -- nao disputa com AG003/004/005

  // Cria e aprova a PROPRIA agenda confirmada desse teste.
  await criarEAprovarAgenda(browser, DATA_TESTE);

  const { data: agendaRows } = await db
    .from('agendas')
    .select('id, data, cliente, user_id')
    .eq('data', DATA_TESTE)
    .eq('status', 'confirmada')
    .limit(1);

  if (!agendaRows || agendaRows.length === 0) {
    throw new Error(`Agenda de fixture para ${DATA_TESTE} nao foi encontrada apos criarEAprovarAgenda`);
  }
  const agenda = agendaRows[0];

  // v12: a espera por aguardarSyncMondayFixture (v10/v11) NAO resolveu de vez --
  // rodando a suite INTEIRA (chromium + mobile-chrome juntos, mais lento e com
  // mais atividade no Supabase compartilhado), o log [create] da propria
  // fixture ainda vazou por cima do timestampInicio (confirmado via Supabase
  // MCP: create as 11:58:35.501, timestampInicio ficou ANTES disso, cancel as
  // 11:58:41.343 -- 2 logs MONDAY-AGENDA-SYNC contados em vez de 1). Depender
  // de um marcador de tempo pra excluir o log de setup e inerentemente fragil
  // nesse projeto Supabase (e o de PRODUCAO -- "Aceex Production" -- outros
  // fontes/uso real podem gerar linhas em integration_logs a qualquer momento).
  // Fix definitivo: nao depender mais de tempo pra distinguir setup de
  // cancelamento -- filtrar direto pela ACAO esperada (cancel/excluir),
  // ignorando create/incluir/update onde quer que apareçam. Ver filtro em
  // 'relevantes' abaixo.
  const timestampInicio = new Date();

  const ctxC = await browser.newContext();
  const ctxK = await browser.newContext();
  const pageC = await ctxC.newPage();
  const pageK = await ctxK.newPage();

  try {
    // Consultor solicita cancelamento
    await login(pageC, 'consultor');
    await pageC.waitForLoadState('networkidle');

    // btn-solicitar-cancelamento so aparece com selectedAgenda setado --
    // precisa selecionar o dia no calendario primeiro.
    await selecionarDiaCalendario(pageC, agenda.data);

    // Garante a selecao (auto-select pode falhar por race -- ver v9/helpers.ts).
    await garantirAgendaSelecionada(pageC, QA_PROJETO_NOME);

    const btnCancelar = pageC.locator('[data-testid=btn-solicitar-cancelamento]').first();
    await expect(btnCancelar).toBeVisible({ timeout: 15_000 });
    await btnCancelar.click();

    await pageC.fill('[data-testid=input-justificativa]', '[TEST] Cancelamento anti-loop QA');
    await pageC.click('[data-testid=btn-confirmar-cancelamento]');
    await pageC.locator('li[role=status]').waitFor({ timeout: 10_000 });

    // Coordenador aceita (AdminSolicitacoesCancelamento.tsx -- clique direto)
    await login(pageK, 'coordenador');
    await pageK.click('[data-testid=nav-agendas]');
    await pageK.waitForSelector('[data-testid=flyout-agendas]');
    await pageK.locator('[data-testid=flyout-agendas] [data-testid=flyout-item]')
      .filter({ hasText: /Cancelamento/i })
      .click();
    await pageK.waitForSelector('[data-testid=btn-aceitar-cancelamento]', { timeout: 10_000 });
    await pageK.locator('[data-testid=btn-aceitar-cancelamento]').first().click();
    await pageK.locator('li[role=status]').waitFor({ timeout: 10_000 });

    // Aguardar 35s para dar tempo de qualquer segundo sync (que nao deve ocorrer)
    await new Promise(r => setTimeout(r, 35_000));

    // v11: o cap antigo de "maximo 2" estava ERRADO, nao era race -- confirmado
    // via Supabase MCP lendo integration_logs linha a linha por timestamp.
    // Uma UNICA exclusao correta e sem loop gera SEMPRE 3 logs, nao 2:
    //   1) MONDAY-AGENDA-SYNC [cancel] (handleAceitar em AdminSolicitacoesCancelamento.tsx)
    //   2) "0004" [MOCK] Protheus simulado recebeu... (mock-protheus/index.ts,
    //      loga o RECEBIMENTO no lado que simula o Protheus)
    //   3) "0004" Exclusao de N agenda(s) enviada ao Protheus (protheus-agenda-sync/
    //      index.ts, loga o ENVIO no lado do Aceex, depois de receber a resposta do mock)
    // Ou seja, o mock do Protheus e o sync que o chama logam em pontos
    // diferentes do MESMO evento por design (rastreabilidade dos dois lados
    // da integracao) -- isso nunca foi um loop. O anti-loop real e: nenhum
    // desses 3 se repete.
    //
    // v12: restringir so por codigo + janela de tempo (timestampInicio) ainda
    // e fragil nesse projeto (Supabase de PRODUCAO -- "Aceex Production"):
    // qualquer log de create/incluir/update de OUTRO passo (a propria fixture
    // deste teste, ou ruido de outra atividade no projeto) pode cair dentro
    // da janela e ser contado por engano -- foi exatamente o que aconteceu
    // rodando a suite inteira (chromium+mobile-chrome): o log [create] da
    // fixture vazou por cima do timestampInicio e virou um 4o log falso.
    // Fix definitivo: filtrar pela ACAO em si (cancel/excluir), nao so pelo
    // codigo/janela -- um log de create/incluir/update nunca conta como parte
    // do anti-loop de exclusao, nao importa quando ele aparecer.
    const { data: logsDepois } = await db
      .from('integration_logs')
      .select('codigo, payload')
      .eq('status', 'success')
      .in('codigo', ['MONDAY-AGENDA-SYNC', '0003', '0004'])
      .gt('timestamp', timestampInicio.toISOString());

    const relevantes = (logsDepois ?? []).filter((l: any) => {
      const acao = l.payload?.action;
      return acao === 'cancel' || acao === 'excluir';
    });
    const novosLogs = relevantes.length;

    expect(
      novosLogs,
      `Anti-loop falhou: ${novosLogs} logs de cancelamento/exclusao gerados. ` +
      `Esperado: exatamente 3 (1 Monday [cancel] + 2 Protheus [mock recebeu + ` +
      `sync enviado] -- sem repeticao/loop). Codigos encontrados: ` +
      `${JSON.stringify(relevantes.map((l: any) => l.codigo))} ` +
      `(total bruto na janela, incl. create/incluir/update: ${(logsDepois ?? []).length})`
    ).toBe(3);

  } finally {
    await ctxC.close();
    await ctxK.close();
  }
});