// playwright.config.ts
// BL-020 QA Skill Runner -- Configuracao Playwright
// v4: adicionado globalSetup apontando para qa/globalSetup.ts, que provisiona
//     um board Monday DESCARTAVEL para o fixture QA-COORD-TEST no inicio de
//     cada execucao (o board antigo, fixo, ficava permanente nos quadros
//     reais da empresa no Monday.com). O globalTeardown (qa/teardown.ts,
//     v6) exclui esse mesmo board ao final. Ver acao "delete", nova, em
//     supabase/functions/monday-sync-project/index.ts (v9).
// v3: workers de 2 para 1 (mesmo fora de CI). Evidencia: rodando com
//     --workers=1 numa comparacao direta, o numero de falhas caiu (8 -> 7,
//     incluindo IN001 voltando a passar) E o tempo total da suite caiu (9.5min
//     -> 5.8min) -- ou seja, 2 workers nesta maquina nao ganha tempo nenhum,
//     so gera contencao (cada teste hoje abre varios browser contexts via
//     criarEAprovarAgenda; com 2 workers rodando isso em paralelo, o dev
//     server local e o proprio Chromium ficam sobrecarregados e login comeca
//     a estourar timeout). 1 worker ainda nao elimina 100% (mobile-chrome no
//     fim do suite as vezes falha por degradacao ao longo do tempo, nao por
//     concorrencia), mas remove a maior fonte de falhas.
// v2: adicionado globalTeardown apontando para o script ja existente qa/teardown.ts
//     (agora exportado como funcao default -- ver esse arquivo). Antes,
//     AG_agendas.spec.ts e IN_integracoes.spec.ts tinham cada um seu proprio
//     afterAll(teardownTestData), que rodava em paralelo (2 workers) e causava uma
//     race: o arquivo que terminasse primeiro apagava agendas que o outro ainda
//     estava usando (mesma faixa fixa de datas hoje+7/8/9/14/21 nos dois). Agora a
//     limpeza roda uma unica vez, depois que a suite inteira termina.

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:8080';

// v5: quando QA_BASE_URL aponta pra um host remoto (ambiente real de
// cliente -- camada 4, ver .github/workflows/rodar-suite-completa.yml),
// NAO faz sentido tentar subir "npm run dev" local -- nao existe servidor
// nenhum pra subir, e o Playwright ia travar minutos esperando o healthcheck
// de um webServer que nunca vai responder. So sobe o dev server quando
// BASE_URL continua sendo localhost/127.0.0.1 (uso local/dev, comportamento
// de sempre, inalterado).
const isRemoteBaseUrl = /^https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(BASE_URL);

export default defineConfig({

  testDir: './qa/tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // ver nota v3 no topo -- 2 workers gerava mais falhas E era mais lento nesta maquina

  globalSetup:    './qa/globalSetup.ts',
  globalTeardown: './qa/teardown.ts',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'qa/reports', open: 'never' }],
    ['json', { outputFile: 'qa/reports/results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'on-first-retry',
    headless: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1280, height: 800 },
    actionTimeout:     10_000,
    navigationTimeout: 30_000,
  },

  // Propagar TODAS as variaveis para workers
  env: {
    // URL -- suporta ambos os formatos
    SUPABASE_URL:              process.env.SUPABASE_URL              || '',
    VITE_SUPABASE_URL:         process.env.VITE_SUPABASE_URL         || process.env.SUPABASE_URL || '',
    // Service role -- suporta ambos os formatos
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
    // Credenciais QA
    QA_CONSULTOR_EMAIL:        process.env.QA_CONSULTOR_EMAIL        || '',
    QA_CONSULTOR_PASSWORD:     process.env.QA_CONSULTOR_PASSWORD     || '',
    QA_COORDENADOR_EMAIL:      process.env.QA_COORDENADOR_EMAIL      || '',
    QA_COORDENADOR_PASSWORD:   process.env.QA_COORDENADOR_PASSWORD   || '',
    QA_ADMIN_EMAIL:            process.env.QA_ADMIN_EMAIL            || '',
    QA_ADMIN_PASSWORD:         process.env.QA_ADMIN_PASSWORD         || '',
  },

  outputDir: 'qa/artifacts',

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['iPhone 14'] }, testMatch: '**/UI_regressao.spec.ts' },
  ],

  webServer: isRemoteBaseUrl
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});