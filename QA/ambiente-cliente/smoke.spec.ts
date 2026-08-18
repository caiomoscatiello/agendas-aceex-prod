// qa/ambiente-cliente/smoke.spec.ts
//
// Camada 3 da verificação de ambiente ("Verificar Ambiente" no painel
// Config PROJTE): login real via Playwright contra o frontend de um cliente
// específico, usando o usuário sintético de monitoramento criado pelo botão
// "Criar Ambiente" (ver supabase/functions/projte-provision-ambiente,
// bloco "monitor_user"). Roda via GitHub Actions
// (.github/workflows/verificar-ambiente-cliente.yml), disparado a partir da
// tela — não roda localmente por padrão, precisa de
// QA_BASE_URL/MONITOR_EMAIL/MONITOR_PASSWORD no ambiente (ver
// qa/playwright.ambiente-cliente.config.ts).
//
// Escopo mínimo de propósito: só confirma que o LOGIN funciona de ponta a
// ponta (frontend fala com o Supabase certo, credenciais batem, app não
// quebra depois do login). Não assume nenhuma role específica — o usuário
// de monitoramento não tem nenhuma linha em user_roles — por isso usa o
// mesmo sinal estável que o resto da suite BL-020 usa pra "login
// concluído": data-testid=btn-logout, presente tanto no layout mobile
// quanto desktop do ConsultorDashboardV2 (ver qa/tests/Helpers.ts,
// loginConsultor).

import { test, expect } from '@playwright/test';

test('Camada 3 - login do usuário de monitoramento', async ({ page }) => {
  const email = process.env.MONITOR_EMAIL;
  const password = process.env.MONITOR_PASSWORD;

  if (!email || !password) {
    throw new Error('MONITOR_EMAIL/MONITOR_PASSWORD não configurados no ambiente do workflow.');
  }

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]:visible', email);
  await page.fill('input[type="password"]:visible', password);
  await page.click('button[type="submit"]:visible');
  await page.waitForLoadState('networkidle');

  // Mesmo sinal estável usado no resto da suite BL-020 pra "login
  // concluído", independente de role (existe nos layouts mobile e
  // desktop — ver comentário v9 em qa/tests/Helpers.ts).
  await expect(page.locator('[data-testid=btn-logout]')).toBeVisible({ timeout: 25_000 });

  if (consoleErrors.length > 0) {
    console.warn(
      `[camada 3] ${consoleErrors.length} erro(s) de console detectado(s) apos login:`,
      consoleErrors.slice(0, 5)
    );
  }
});
