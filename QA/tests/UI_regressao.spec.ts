// qa/tests/UI_regressao.spec.ts
// BL-020 QA Skill Runner -- Grupo UI: Regressao visual
// Skills: UI001, UI004
// v3: UI004 (consultor) agora tambem captura respostas HTTP >= 400 via
//     captureFailedRequests, para expor a URL exata do erro 400 encontrado
//     na ultima rodada (antes so aparecia como "Failed to load resource",
//     mensagem generica que nao aponta o endpoint).
// v2: UI004 (consultor) fecha o modal aberto antes de clicar no proximo item de
//     nav -- nav-pendencias/nav-requisicoes/nav-meu-backlog abrem Dialogs
//     (Radix) e nao paginas, entao o overlay ficava bloqueando o clique seguinte.
// Encoding: UTF-8 sem BOM

import { test, expect, Browser } from '@playwright/test';
import {
  login,
  captureConsoleErrors,
  assertZeroConsoleErrors,
  captureFailedRequests,
  fecharModalAberto,
} from './Helpers';

// ?? UI001 -- Flyout sidebar posicionamento ?????????????????????????????????????
test('UI001 - Flyout sidebar posicionado corretamente', async ({ page }) => {
  await login(page, 'coordenador');
  await page.waitForLoadState('networkidle');

  // --- Cadastros ---
  const navCadastros = page.locator('[data-testid=nav-cadastros]');
  await expect(navCadastros).toBeVisible({ timeout: 10_000 });

  // Capturar posicao do item antes de clicar
  const rectNav = await navCadastros.boundingBox();
  expect(rectNav, 'Item Cadastros nao encontrado na sidebar').toBeTruthy();

  await navCadastros.click();

  // Flyout deve aparecer
  const flyoutCad = page.locator('[data-testid=flyout-cadastros]');
  await expect(flyoutCad).toBeVisible({ timeout: 5_000 });

  // Flyout deve estar dentro do viewport (nao cortado)
  const rectFlyout = await flyoutCad.boundingBox();
  expect(rectFlyout, 'Flyout Cadastros nao encontrado').toBeTruthy();

  const viewport = page.viewportSize();
  if (rectFlyout && viewport) {
    expect(rectFlyout.x + rectFlyout.width).toBeLessThanOrEqual(viewport.width);
    expect(rectFlyout.y + rectFlyout.height).toBeLessThanOrEqual(viewport.height);
  }

  // Verificar 3 subitens: Projetos, Usuarios, Documentos
  const itensCad = flyoutCad.locator('[data-testid=flyout-item]');
  await expect(itensCad).toHaveCount(3);
  await expect(itensCad.nth(0)).toContainText(/Projetos/i);
  await expect(itensCad.nth(1)).toContainText(/Usuarios/i);
  await expect(itensCad.nth(2)).toContainText(/Documentos/i);

  // Fechar clicando fora
  await page.click('main');
  await expect(flyoutCad).not.toBeVisible({ timeout: 3_000 });

  // --- Agendas ---
  const navAgendas = page.locator('[data-testid=nav-agendas]');
  await expect(navAgendas).toBeVisible();
  await navAgendas.click();

  const flyoutAg = page.locator('[data-testid=flyout-agendas]');
  await expect(flyoutAg).toBeVisible({ timeout: 5_000 });

  // Verificar alinhamento vertical com o item clicado
  const rectNavAg    = await navAgendas.boundingBox();
  const rectFlyoutAg = await flyoutAg.boundingBox();

  if (rectNavAg && rectFlyoutAg) {
    // Flyout deve estar alinhado (top do flyout proximo ao top do item +/- 40px)
    const diff = Math.abs(rectFlyoutAg.y - rectNavAg.y);
    expect(diff, `Flyout Agendas desalinhado: diferenca de ${diff}px`).toBeLessThanOrEqual(40);
  }

  // Verificar 6 subitens de Agendas
  const itensAg = flyoutAg.locator('[data-testid=flyout-item]');
  await expect(itensAg).toHaveCount(6);
});

// ?? UI004 -- Console errors = zero em todo o sistema ???????????????????????????
test('UI004 - Zero erros JS no console (coordenador)', async ({ page }) => {
  const errors = captureConsoleErrors(page);

  await login(page, 'coordenador');
  await page.waitForLoadState('networkidle');

  // Dashboard
  await page.waitForTimeout(1000);
  await assertZeroConsoleErrors(page, errors);

  // Cadastros > Projetos
  await page.click('[data-testid=nav-cadastros]');
  await page.waitForSelector('[data-testid=flyout-cadastros]');
  await page.locator('[data-testid=flyout-item]').filter({ hasText: /Projetos/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Abrir primeiro projeto se existir
  const primeiroProjeto = page.locator('[data-testid=projeto-row]').first();
  if (await primeiroProjeto.isVisible()) {
    await primeiroProjeto.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navegar pelas tabs
    const tabs = ['tab-visao', 'tab-ativ', 'tab-back', 'tab-stake', 'tab-riscos', 'tab-base', 'tab-diario', 'tab-anal', 'tab-cfg'];
    for (const tab of tabs) {
      const tabEl = page.locator(`[data-testid=${tab}]`);
      if (await tabEl.isVisible()) {
        await tabEl.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // Agendas > Solicitacoes
  await page.click('[data-testid=nav-agendas]');
  await page.waitForSelector('[data-testid=flyout-agendas]');
  await page.locator('[data-testid=flyout-item]').filter({ hasText: /Solicita/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Relatorio
  await page.click('[data-testid=nav-relatorio]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Workflows
  await page.click('[data-testid=nav-workflows]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Logs
  await page.click('[data-testid=nav-logs]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Verificacao final -- zero erros em toda a navegacao
  await assertZeroConsoleErrors(page, errors);
});

test('UI004 - Zero erros JS no console (consultor)', async ({ page }) => {
  const errors        = captureConsoleErrors(page);
  const failedReqs     = captureFailedRequests(page);

  await login(page, 'consultor');
  await page.waitForLoadState('networkidle');

  // Dashboard do consultor
  await page.waitForTimeout(1000);

  // nav-pendencias, nav-requisicoes e nav-meu-backlog abrem Dialogs (Radix),
  // nao navegam para outra pagina -- e preciso fechar o modal antes de
  // clicar no proximo item, senao o overlay bloqueia o clique seguinte.
  const secoes = [
    '[data-testid=nav-pendencias]',
    '[data-testid=nav-requisicoes]',
    '[data-testid=nav-meu-backlog]',
  ];

  for (const seletor of secoes) {
    const el = page.locator(seletor);
    if (await el.isVisible()) {
      await el.click();
      await page.waitForTimeout(500);
      await fecharModalAberto(page);
      await page.waitForTimeout(300);
    }
  }

  // Se houver erro de console, exibir tambem as requisicoes HTTP >= 400
  // capturadas ate aqui -- normalmente e a causa raiz do "Failed to load
  // resource" que aparece no console.
  if (errors.length > 0 && failedReqs.length > 0) {
    console.error('Requisicoes HTTP com falha (>=400) durante o teste:\n' + failedReqs.join('\n'));
  }
  expect(failedReqs, `Requisicoes HTTP com falha (>=400):\n${failedReqs.join('\n')}`).toHaveLength(0);
  await assertZeroConsoleErrors(page, errors);
});
