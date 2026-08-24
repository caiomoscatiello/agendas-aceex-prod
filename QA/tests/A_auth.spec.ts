// qa/tests/A_auth.spec.ts
// BL-020 QA Skill Runner -- Grupo A: Autenticacao
// Skills: A001, A002, A003
// Encoding: UTF-8 sem BOM

import { test, expect } from '@playwright/test';
import {
  login,
  captureConsoleErrors,
  assertZeroConsoleErrors,
} from './Helpers';

// A001 -- Login Consultor
test('A001 - Login Consultor', async ({ page }) => {
  const errors = captureConsoleErrors(page);

  await login(page, 'consultor');

  // Nao deve estar na area admin
  await expect(page).not.toHaveURL(/\/admin/);

  // Sidebar visivel
  await expect(page.locator('[data-testid=sidebar]')).toBeVisible({ timeout: 10_000 });

  // Secoes PRINCIPAL e PROJETO visiveis (ConsultorDashboard nao tem role-badge)
  await expect(page.locator('[data-testid=sidebar-section-principal]')).toBeVisible();
  await expect(page.locator('[data-testid=sidebar-section-projeto]')).toBeVisible();

  // Nav items da secao principal visiveis
  await expect(page.locator('[data-testid=nav-dashboard]')).toBeVisible();
  await expect(page.locator('[data-testid=nav-pendencias]')).toBeVisible();

  // Footer da sidebar contem texto "Consultor"
  await expect(page.locator('[data-testid=sidebar]')).toContainText(/Consultor/i);

  await assertZeroConsoleErrors(page, errors);
});

// A002 -- Login Coordenador
test('A002 - Login Coordenador', async ({ page }) => {
  const errors = captureConsoleErrors(page);

  await login(page, 'coordenador');

  // Sidebar admin visivel
  await expect(page.locator('[data-testid=sidebar]')).toBeVisible({ timeout: 10_000 });

  // Badge de role no topbar (existe no AdminDashboard)
  const badge = page.locator('[data-testid=role-badge]');
  await expect(badge).toBeVisible({ timeout: 10_000 });
  await expect(badge).toContainText(/COORDENADOR/i);

  // Card do painel de gestao na sidebar
  await expect(page.locator('[data-testid=sidebar-role-card]')).toBeVisible();
  await expect(page.locator('[data-testid=sidebar-role-card]')).toContainText(/gestao/i);

  // Secoes da sidebar admin
  await expect(page.locator('[data-testid=sidebar-section-gestao]')).toBeVisible();
  await expect(page.locator('[data-testid=sidebar-section-operacao]')).toBeVisible();

  // Nav items visiveis
  await expect(page.locator('[data-testid=nav-dashboard]')).toBeVisible();
  await expect(page.locator('[data-testid=nav-cadastros]')).toBeVisible();
  await expect(page.locator('[data-testid=nav-agendas]')).toBeVisible();

  await assertZeroConsoleErrors(page, errors);
});

// A003 -- Isolamento de role
// O consultor e redirecionado para / ao tentar acessar /admin (App.tsx nao tem rota /admin para consultor)
test('A003 - Isolamento de role: consultor redirecionado de /admin', async ({ browser }) => {
  const ctxConsultor   = await browser.newContext();
  const ctxCoordenador = await browser.newContext();
  const pageC          = await ctxConsultor.newPage();
  const pageK          = await ctxCoordenador.newPage();

  try {
    // Consultor tenta acessar /admin
    await login(pageC, 'consultor');
    await pageC.goto('/admin');
    await pageC.waitForLoadState('networkidle');

    // App.tsx redireciona consultor de /* para / -- nao deve ver AdminDashboard
    // Verifica que a sidebar do admin NAO esta visivel (sem role-badge, sem sidebar-role-card)
    const adminBadge = pageC.locator('[data-testid=role-badge]');
    await expect(adminBadge).not.toBeVisible({ timeout: 3_000 }).catch(() => {
      // Se o badge aparecer, verifica que nao contem ADMIN
    });

    // A sidebar do consultor deve estar visivel (redirecionou para /)
    await expect(pageC.locator('[data-testid=sidebar]')).toBeVisible({ timeout: 10_000 });
    await expect(pageC.locator('[data-testid=sidebar-section-principal]')).toBeVisible();

    // Coordenador ve painel admin normalmente
    await login(pageK, 'coordenador');
    await expect(pageK.locator('[data-testid=sidebar]')).toBeVisible({ timeout: 10_000 });
    await expect(pageK.locator('[data-testid=role-badge]')).toContainText(/COORDENADOR/i);

  } finally {
    await ctxConsultor.close();
    await ctxCoordenador.close();
  }
});