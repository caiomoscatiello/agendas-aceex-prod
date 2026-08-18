// qa/playwright.ambiente-cliente.config.ts
//
// Config SEPARADA do playwright.config.ts da raiz (suite BL-020). Usada só
// pelo smoke test de camada 3 da verificação de ambiente ("Verificar
// Ambiente" no painel Config PROJTE), disparado via GitHub Actions
// (.github/workflows/verificar-ambiente-cliente.yml).
//
// Por que não reaproveitar o playwright.config.ts da raiz: aquele tem
// globalSetup/globalTeardown que provisionam e depois excluem um board
// Monday do fixture fixo QA-COORD-TEST, e um webServer que sobe `npm run
// dev` local — nada disso se aplica aqui, onde o alvo é o Supabase/frontend
// JÁ DEPLOYADO de um cliente qualquer, identificado em runtime pela URL que
// vem do ambiente (QA_BASE_URL).

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.QA_BASE_URL || '';

export default defineConfig({
  testDir: './ambiente-cliente',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 1,

  reporter: [
    ['list'],
    ['json', { outputFile: 'qa/reports/ambiente-cliente-results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    headless: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  outputDir: 'qa/artifacts-ambiente-cliente',

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
