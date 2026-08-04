// qa/tests/helpers.ts
// BL-020 QA Skill Runner -- Helpers compartilhados
// v9: loginConsultor/loginCoordenador trocaram a espera por [data-testid=sidebar]
//     por [data-testid=btn-logout] -- causa raiz de UI001/UI004 falhando de
//     forma intermitente (nao-deterministica) no project mobile-chrome. Ver
//     comentario completo dentro de loginConsultor(). Requer que
//     ConsultorDashboardV2.tsx tenha data-testid="btn-logout" no botao Sair
//     dos DOIS layouts (mobile e desktop).
// v8: NOVA funcao aguardarSyncMondayFixture() -- ver comentario na propria
//     funcao. Precisou depois que o QA-COORD-TEST ganhou um board Monday
//     real (antes so falhava rapido por "sem board"); agora cada sync fica
//     mais lento (2 round-trips reais a API do Monday), o que expos uma
//     race no IN003 (log de criacao da fixture contando como log "novo" do
//     passo de cancelamento).
// v7: criarEAprovarAgenda agora preenche input-horas-aprovacao com um valor
//     diferente do solicitado (4 -> 4.5) antes de confirmar. Causa raiz
//     (lida na edge function process-agenda-request via Supabase MCP): ha uma
//     regra de auto-aprovacao para requisicoes de data PASSADA sem nenhuma
//     alteracao do coordenador -- nesse caso a agenda e criada direto com
//     status="apontamento_ok", nunca passando por "confirmada". Isso fazia
//     AG005 (que usa "ontem" como data) falhar sempre no waitForSupabaseRecord
//     final, mesmo com a UI toda funcionando -- a agenda ERA criada, so nao
//     com o status que o teste esperava. Forcar uma mudanca nas horas
//     desativa esse auto-approve no servidor, mantendo o comportamento
//     "confirmada" esperado independente da data. Precisou adicionar
//     data-testid="input-horas-aprovacao" no campo "Total de Horas" do dialog
//     de aceite em AdminPendentes.tsx (nao tinha testid antes).
// v6: NOVA funcao garantirAgendaSelecionada() -- ver comentario na propria
//     funcao. Corrige "element(s) not found" em btn-registrar-apontamento/
//     btn-solicitar-cancelamento causado por uma race no auto-select do app
//     (useEffect com deps=[selectedDate], sem depender de `agendas`) que
//     acontecia mesmo com o card agenda-confirmada ja visivel em tela.
// v5: supabaseAdmin() agora usa um fetch com timeout de 15s. Motivo: uma
//     execucao real do teardown ficou ~5min pendurada entre duas chamadas
//     supabase-js, mas o Supabase (pg_stat_activity, pg_locks, logs de API,
//     EXPLAIN ANALYZE) nao mostrou nenhuma query lenta, lock ou conexao presa
//     -- o delete em si roda em 1ms. Ou seja, foi um travamento de rede do
//     lado do cliente, nao um bug de logica/banco. Sem timeout, isso trava o
//     processo em silencio por minutos; com timeout, a chamada falha rapido
//     e visivel (ver qa/teardown.ts v5 para o mesmo ajuste).
// v4: criarEAprovarAgenda -- timeout da checagem final (agenda confirmada no
//     banco) subiu de 15s para 30s. AG003/IN003 comecaram a falhar so nessa
//     checagem, com a MESMA logica que AG001 usa direto (nunca falhou) --
//     ou seja, nao e bug de logica, e o commit de status=confirmada demorando
//     mais que 15s pra refletir quando 2 workers rodam create+approve em
//     paralelo (AG003 e IN003 chamam essa funcao ao mesmo tempo, cada um em
//     seu worker, e IN002 ainda faz polling pesado em integration_logs no
//     outro worker na mesma janela).
// v3: login usa seletor :visible (a pagina de login tem 2 <input type="email">
//     no DOM -- um pro layout mobile, um pro desktop -- e so um fica visivel
//     por vez conforme o viewport; sem :visible o Playwright pode tentar
//     preencher o que esta oculto e estourar timeout no mobile-chrome).
// Encoding: UTF-8 sem BOM

import { Page, Browser, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Carregar .env da raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

// NOVO (v5) -- fetch com timeout de seguranca (ver nota no topo do arquivo).
function fetchComTimeout(timeoutMs = 15_000) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

// Supabase Admin (service_role)
export function supabaseAdmin() {
  // Suporta ambos os formatos de nome (com e sem VITE_)
  const url = process.env.SUPABASE_URL
           || process.env.VITE_SUPABASE_URL
           || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
           || '';

  if (!url || !key) {
    throw new Error(
      `Variaveis nao encontradas.\n` +
      `SUPABASE_URL=${url ? 'OK' : 'VAZIO'}\n` +
      `SUPABASE_SERVICE_ROLE_KEY=${key ? 'OK' : 'VAZIO'}`
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetchComTimeout(15_000) },
  });
}

// Credenciais dos agentes
export const AGENTS = {
  consultor: {
    email:    process.env.QA_CONSULTOR_EMAIL    || '',
    password: process.env.QA_CONSULTOR_PASSWORD || '',
  },
  coordenador: {
    email:    process.env.QA_COORDENADOR_EMAIL    || '',
    password: process.env.QA_COORDENADOR_PASSWORD || '',
  },
  admin: {
    email:    process.env.QA_ADMIN_EMAIL    || '',
    password: process.env.QA_ADMIN_PASSWORD || '',
  },
};

// NOVO -- Resolve o user_id do consultor de teste (via profiles.email).
// Necessario porque `agendas` acumula linhas "confirmada" de usuarios reais
// de producao (ex: agendas antigas de Maio/2026 de outros consultores) que
// nunca sao limpas pelo teardown -- um `.eq('status','confirmada').limit(1)`
// sem filtrar por usuario pode pegar uma dessas linhas por engano, fazendo o
// teste tentar interagir com uma agenda que nao pertence ao consultor logado
// (e por isso os testids do dono nunca aparecem na tela).
let _consultorUserIdCache: string | null = null;
export async function getConsultorUserId(): Promise<string> {
  if (_consultorUserIdCache) return _consultorUserIdCache;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('profiles')
    .select('user_id')
    .eq('email', AGENTS.consultor.email)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Nao foi possivel resolver o user_id do consultor de teste (${AGENTS.consultor.email}): ${error?.message || 'nao encontrado'}`);
  }
  _consultorUserIdCache = data.user_id;
  return data.user_id;
}

// Login consultor
export async function loginConsultor(page: Page) {
  const { email, password } = AGENTS.consultor;
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]:visible', email);
  await page.fill('input[type="password"]:visible', password);
  await page.click('button[type="submit"]:visible');
  await page.waitForLoadState('networkidle');
  // v9: trocado [data-testid=sidebar] por [data-testid=btn-logout] -- ver
  // ConsultorDashboardV2.tsx linha ~935 (`if (isMobile) { ... }`): no
  // mobile-chrome (viewport < breakpoint de useIsMobile), o componente
  // renderiza um layout alternativo que NUNCA tem <aside data-testid="sidebar">
  // (esse elemento so existe no branch desktop). O que explicava o padrao de
  // falha intermitente (nao determinístico) em UI001/UI004 no mobile-chrome:
  // useIsMobile() so resolve corretamente depois do 1o efeito, entao o
  // primeiro render (antes do efeito) pinta o layout desktop com a sidebar
  // por um instante -- as vezes o Playwright pega esse instante (passa), as
  // vezes ja perdeu (trava 25s esperando algo que nao vai mais aparecer no
  // mobile). btn-logout existe, com o mesmo data-testid, nos dois layouts
  // (mobile linha ~952 e desktop linha ~1173 de ConsultorDashboardV2.tsx) --
  // e por isso um sinal de "login concluido" estavel em qualquer viewport.
  await page.waitForSelector('[data-testid=btn-logout]', { timeout: 25_000 });
}

// Login coordenador -- fluxo real: login -> ConsultorDashboard -> clica Admin
export async function loginCoordenador(page: Page) {
  const { email, password } = AGENTS.coordenador;
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]:visible', email);
  await page.fill('input[type="password"]:visible', password);
  await page.click('button[type="submit"]:visible');
  await page.waitForLoadState('networkidle');
  // v9 -- ver comentario em loginConsultor acima.
  await page.waitForSelector('[data-testid=btn-logout]', { timeout: 25_000 });
  await page.click('[data-testid=btn-admin-panel]');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid=role-badge]', { timeout: 15_000 });
}

// Login admin
export async function loginAdmin(page: Page) {
  const { email, password } = AGENTS.admin;
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]:visible', email);
  await page.fill('input[type="password"]:visible', password);
  await page.click('button[type="submit"]:visible');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid=sidebar]', { timeout: 25_000 });
}

// Login generico
export async function login(page: Page, role: keyof typeof AGENTS) {
  if (role === 'coordenador') await loginCoordenador(page);
  else if (role === 'admin')  await loginAdmin(page);
  else                        await loginConsultor(page);
}

// Data futura formatada YYYY-MM-DD
export function dataFutura(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

export const TEST_PREFIX = '[TEST]';

// Teardown: deleta registros [TEST] do banco
export async function teardownTestData() {
  const db    = supabaseAdmin();
  const datas = [7, 8, 9, 14, 21].map(d => dataFutura(d));

  await db.from('projeto_diario').delete().like('texto', `${TEST_PREFIX}%`);
  await db.from('solicitacoes_cancelamento').delete().like('justificativa', `${TEST_PREFIX}%`);
  await db.from('agendas').delete().in('data', datas);
  await db.from('backlog_itens').delete().like('titulo', `${TEST_PREFIX}%`);
  await db.from('projeto_atividades').delete().like('descricao', `${TEST_PREFIX}%`);
  await db.from('projetos').delete().like('nome_cliente', `${TEST_PREFIX}%`);
}

// Capturar erros de console
export function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// NOVO (v8) -- Aguarda o log de sync do Monday (monday-agenda-sync) referente
// a uma agenda especifica aparecer em integration_logs. Motivo: agora que o
// QA-COORD-TEST tem um board Monday real (ver monday-sync-project), cada
// chamada a monday-agenda-sync faz 2 round-trips reais a API do Monday
// (criar subitem + recalcular status do item pai) -- isso ficou bem mais
// lento do que quando so falhava rapido por "sem board". Testes que criam
// uma agenda via criarEAprovarAgenda e IMEDIATAMENTE fazem outra coisa com
// ela (ex: IN003 cancelando em seguida) podem capturar timestampInicio ANTES
// desse sync de criacao (fire-and-forget) terminar, fazendo o log dele ser
// contado por engano como um log "novo" do passo seguinte. Chamar isso logo
// apos criarEAprovarAgenda (antes de marcar timestampInicio) evita a
// contaminacao -- e best-effort, nao falha o teste se nao achar a tempo.
export async function aguardarSyncMondayFixture(agendaId: string, timeoutMs = 20_000): Promise<boolean> {
  const db = supabaseAdmin();
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const { data } = await db
      .from('integration_logs')
      .select('id')
      .eq('codigo', 'MONDAY-AGENDA-SYNC')
      .ilike('message', `%${agendaId}%`)
      .limit(1);
    if (data && data.length > 0) return true;
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

// NOVO -- Capturar respostas HTTP com erro (status >= 400), com a URL, pra
// facilitar diagnostico quando assertZeroConsoleErrors falhar por causa de
// "Failed to load resource" (mensagem generica que nao diz qual endpoint).
export function captureFailedRequests(page: Page): string[] {
  const failed: string[] = [];
  page.on('response', res => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return failed;
}

// Aguardar registro no Supabase (polling)
export async function waitForSupabaseRecord(
  table: string,
  filter: Record<string, string>,
  timeoutMs = 30_000
): Promise<boolean> {
  const db    = supabaseAdmin();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let query = db.from(table).select('id', { count: 'exact', head: true });
    for (const [col, val] of Object.entries(filter)) {
      query = (query as any).eq(col, val);
    }
    const { count } = await query;
    if (count && count > 0) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

// Verificar zero erros JS
export async function assertZeroConsoleErrors(page: Page, errors: string[]) {
  const filtered = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('ERR_BLOCKED_BY_CLIENT') &&
    !e.includes('net::ERR_ABORTED')
  );
  expect(filtered, `Console errors:\n${filtered.join('\n')}`).toHaveLength(0);
}

// NOVO -- Seleciona um dia no calendario do ConsultorDashboardV2, navegando
// de mes se necessario. Depende dos testids cal-mes-atual (com atributo
// data-mes-atual="yyyy-MM"), cal-mes-anterior, cal-mes-proximo e cal-day-${data}.
// Necessario porque selectedAgenda so fica disponivel apos selecionar o dia
// (efeito de auto-select em ConsultorDashboardV2.tsx depende de selectedDate).
export async function selecionarDiaCalendario(page: Page, dataISO: string) {
  const [anoAlvo, mesAlvo] = dataISO.split('-').map(Number); // mesAlvo: 1-12

  for (let tentativas = 0; tentativas < 12; tentativas++) {
    const mesAtualStr = await page.locator('[data-testid=cal-mes-atual]').getAttribute('data-mes-atual');
    if (!mesAtualStr) break;
    const [anoAtual, mesAtual] = mesAtualStr.split('-').map(Number);
    if (anoAtual === anoAlvo && mesAtual === mesAlvo) break;
    const alvoMaior = anoAlvo > anoAtual || (anoAlvo === anoAtual && mesAlvo > mesAtual);
    await page.click(alvoMaior ? '[data-testid=cal-mes-proximo]' : '[data-testid=cal-mes-anterior]');
    await page.waitForTimeout(150);
  }

  const diaEl = page.locator(`[data-testid=cal-day-${dataISO}]`);
  await expect(diaEl, `Dia ${dataISO} nao encontrado no calendario`).toBeVisible({ timeout: 10_000 });
  await diaEl.click();
}

// NOVO (v6) -- Garante que a agenda de teste fique selecionada antes de
// checar os botoes de acao (Apontamento/Cancelamento). Motivo: AG003, AG004
// e IN003 passaram a falhar com "element(s) not found" em btn-registrar-
// apontamento / btn-solicitar-cancelamento MESMO com o card agenda-confirmada
// ja visivel. Causa raiz: o auto-select do app (useEffect com
// deps=[selectedDate] em ConsultorDashboardV2.tsx, linha ~439) roda UMA UNICA
// VEZ quando o dia muda -- se o fetch de `agendas` ainda nao tiver terminado
// nesse exato instante (race entre a sessao de auth resolver e o fetch de
// agendas disparar), a auto-selecao e perdida pra sempre naquele dia, mesmo
// que o card apareca segundos depois quando o fetch finalmente chega. O
// mesmo efeito tambem so roda a logica de auto-select quando ha EXATAMENTE 1
// agenda confirmada no dia -- se por qualquer razao houver mais de uma,
// nenhuma e auto-selecionada. Em ambos os casos a solucao e a mesma: clicar
// explicitamente no card da NOSSA agenda (identificada pelo nome do cliente,
// pra nao confundir com outra agenda real que porventura exista no mesmo
// dia) -- mas SO se ela ainda nao estiver selecionada, porque o onClick do
// card faz TOGGLE (clicar de novo numa agenda ja selecionada chama
// handleDeselectAgenda e desmarca -- foi esse o bug que quebrou AG004/AG005
// antes desta funcao existir).
export async function garantirAgendaSelecionada(page: Page, clienteNome: string) {
  const card = page.locator('[data-testid=agenda-confirmada]').filter({ hasText: clienteNome }).first();
  await expect(card, `Agenda confirmada de "${clienteNome}" nao apareceu no dia selecionado`).toBeVisible({ timeout: 15_000 });

  const painelAtivo = page.locator('[data-testid=btn-registrar-apontamento], [data-testid=btn-solicitar-cancelamento]').first();
  const jaAtiva = await painelAtivo.isVisible().catch(() => false);
  if (!jaAtiva) {
    await card.click();
    await expect(painelAtivo, 'Painel de acoes nao apareceu apos clicar na agenda').toBeVisible({ timeout: 10_000 });
  }
}

// NOVO -- Fecha um dialog/modal aberto (Radix Dialog) via tecla Escape e
// aguarda o overlay sumir. Necessario entre navegacoes que abrem modais
// (Pendencias, Requisicoes, Meu Backlog no ConsultorDashboardV2).
export async function fecharModalAberto(page: Page) {
  const overlay = page.locator('[data-state=open].fixed.inset-0');
  if (await overlay.first().isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(overlay.first()).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
  }
}

// Projeto fixo de QA -- criado manualmente no banco (nao e limpo pelo
// teardownTestData) com coordenador_id = tst.coord@projte.com. Necessario
// porque a RLS de requisicoes_agenda so deixa o coordenador ver/aprovar uma
// requisicao se ele for o coordenador REAL do projeto (projetos.coordenador_id
// = auth.uid()). O unico projeto "Liberado" pre-existente (WDM) tem um
// coordenador de producao diferente do usuario de teste, entao a requisicao
// nunca aparecia em AdminPendentes para o coordenador de teste aprovar.
export const QA_PROJETO_NOME = 'QA-COORD-TEST';

// NOVO -- Seleciona um projeto e depois uma atividade no modal "Requisitar
// Agenda". O select-atividade fica desabilitado ate um projeto ser escolhido
// (reqCliente precisa estar preenchido) e ate o fetch de atividades terminar.
// Seleciona pelo NOME (nao .first()) porque pode haver mais de um projeto
// "Liberado" na base -- precisa ser sempre o QA_PROJETO_NOME, cujo coordenador
// e o usuario de teste.
export async function selecionarProjetoEAtividade(page: Page) {
  await page.click('[data-testid=select-projeto-requisicao]');
  await page.getByRole('option', { name: QA_PROJETO_NOME }).click();

  const selectAtividade = page.locator('[data-testid=select-atividade]');
  await expect(selectAtividade, 'select-atividade continua desabilitado apos escolher o projeto').toBeEnabled({ timeout: 10_000 });
  await selectAtividade.click();
  await page.getByRole('option').first().click();
}

// NOVO -- Cria e aprova uma agenda confirmada dedicada, numa data exclusiva,
// para o consultor de teste. Cada teste que precisa de uma agenda "confirmada"
// pra trabalhar em cima (AG003, AG004, AG005, IN003) deve chamar isso com a
// SUA PROPRIA data (nunca reaproveitar hoje+7/8/9, que sao de AG001/IN001/IN002).
//
// Motivo: antes, esses testes buscavam "qualquer agenda confirmada" do
// consultor no banco (.limit(1)). Como AG_agendas.spec.ts e IN_integracoes.spec.ts
// rodam em paralelo (2 workers), mais de um teste podia pegar a MESMA linha ao
// mesmo tempo -- e como AG003/IN003 cancelam (e removem) a agenda que pegam,
// eles literalmente destruiam a fixture que AG004/AG005 ainda precisavam usar.
// Cada teste ter sua propria agenda numa data exclusiva elimina essa disputa.
export async function criarEAprovarAgenda(browser: Browser, dataISO: string): Promise<void> {
  const ctxConsultor   = await browser.newContext();
  const ctxCoordenador = await browser.newContext();
  const pageC          = await ctxConsultor.newPage();
  const pageK          = await ctxCoordenador.newPage();

  try {
    // Consultor solicita
    await login(pageC, 'consultor');
    await pageC.waitForSelector('[data-testid=btn-requisitar-agenda]', { timeout: 10_000 });
    await pageC.click('[data-testid=btn-requisitar-agenda]');
    await pageC.waitForSelector('[data-testid=input-data-agenda]');
    await pageC.fill('[data-testid=input-data-agenda]', dataISO);
    await selecionarProjetoEAtividade(pageC);
    await pageC.fill('[data-testid=input-horas-requisicao]', '4');
    await pageC.click('[data-testid=btn-confirmar-requisicao]');
    await expect(pageC.locator('li[role=status]')).toBeVisible({ timeout: 10_000 });

    // Coordenador aprova (fluxo de 2 passos: abre dialog, escolhe atividade, confirma)
    await login(pageK, 'coordenador');
    await pageK.click('[data-testid=nav-agendas]');
    await pageK.waitForSelector('[data-testid=flyout-agendas]');
    await pageK.locator('[data-testid=flyout-agendas] [data-testid=flyout-item]')
      .filter({ hasText: /Solicita/i })
      .click();
    await pageK.waitForSelector('[data-testid=solicitacao-row]', { timeout: 15_000 });
    await pageK.locator('[data-testid=btn-aprovar-solicitacao]').first().click();
    await pageK.waitForSelector('[data-testid=select-atividade-aprovacao]', { timeout: 10_000 });
    await pageK.click('[data-testid=select-atividade-aprovacao]');
    await pageK.getByRole('option').first().click();

    // Forca um valor de horas DIFERENTE do solicitado (4 -> 4.5). Motivo:
    // a edge function process-agenda-request tem uma regra de negocio (linha
    // "isPastDate = requisicao.data < today") que faz AUTO-APROVACAO quando a
    // data e passada E nada foi alterado pelo coordenador (mesma atividade,
    // modalidade e horas do pedido) -- nesse caso ela grava a agenda direto
    // com status="apontamento_ok" (pulando "confirmada"), o que quebrava o
    // waitForSupabaseRecord abaixo (que so aceita status=confirmada) pra
    // qualquer chamada com data no passado (ex: AG005, que usa "ontem").
    // Mudar as horas aqui faz noChanges=false no servidor, desativando esse
    // auto-approve -- inofensivo para datas futuras/hoje (que ja nao entram
    // nessa regra de qualquer forma) e necessario para datas passadas.
    await pageK.fill('[data-testid=input-horas-aprovacao]', '4.5');

    await pageK.click('[data-testid=btn-confirmar-aceitar-atividade]');
    await expect(pageK.locator('li[role=status]')).toBeVisible({ timeout: 10_000 });

    // 30s (nao 15s) -- essa checagem roda depois que AG001/IN001 ja passaram
    // pelo mesmo fluxo com folga; quando AG003/IN003 chamam isso em paralelo
    // (2 workers, cada um fazendo seu proprio create+approve ao mesmo tempo,
    // com IN002 tambem fazendo polling pesado em integration_logs no outro
    // worker), o commit de status=confirmada no banco pode demorar mais que
    // 15s pra refletir sob essa carga concorrente. A logica em si e identica
    // a de AG001 (que nunca falhou com 15s rodando sozinho) -- e um problema
    // de tempo/contencao sob carga, nao de logica.
    const ok = await waitForSupabaseRecord('agendas', { data: dataISO, status: 'confirmada' }, 30_000);
    if (!ok) throw new Error(`criarEAprovarAgenda: agenda para ${dataISO} nao ficou confirmada a tempo`);
  } finally {
    await ctxConsultor.close();
    await ctxCoordenador.close();
  }
}