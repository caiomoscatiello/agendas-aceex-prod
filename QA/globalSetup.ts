// qa/globalSetup.ts
// BL-020 QA Skill Runner -- Provisionamento de board Monday descartavel
//
// v1: ate aqui, o board Monday do projeto fixture QA-COORD-TEST
//     (monday_board_id) era criado UMA VEZ manualmente e reaproveitado
//     por todas as execucoes da suite -- um board de teste ficando
//     permanente nos quadros reais da empresa no Monday.com. Este
//     globalSetup cria um board NOVO e descartavel no INICIO de cada
//     execucao completa (npx playwright test), e o qa/teardown.ts
//     (globalTeardown) exclui esse mesmo board ao final -- ver handleDelete
//     em supabase/functions/monday-sync-project/index.ts (acao "delete",
//     nova, v9 da function).
//
//     Fonte analisado antes desta mudanca: monday-agenda-sync/index.ts
//     (getAgendaInfo) mostra que, com QA01 (a unica atividade do fixture)
//     sem nenhum cronograma_itens, todo sync de agenda do QA-COORD-TEST
//     ja cai no caminho "skipped" ANTES de sequer checar o board --
//     ou seja, criar/excluir o board a cada execucao NAO muda o
//     comportamento dos specs (IN002 so verifica projetos.monday_board_id/
//     monday_status, nao um subitem real), e elimina a poluicao do board
//     fixo no workspace real.
//
// Requer: SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY --
// playwright.config.ts ja roda dotenv.config() antes de registrar este
// globalSetup, entao process.env ja esta populado quando esta funcao roda.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Mesmo padrao de fetch-com-timeout usado em helpers.ts/teardown.ts -- evita
// que uma instabilidade de rede prenda o globalSetup (e a suite inteira)
// em silencio por minutos.
function fetchComTimeout(timeoutMs = 15_000) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

const QA_CODIGO_CLIENTE = 'QACOORD'; // codigo_cliente do projeto fixture QA-COORD-TEST

export default async function globalSetup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.warn('[globalSetup] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nao definidos -- pulando provisionamento de board Monday descartavel.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
    global: { fetch: fetchComTimeout(15_000) },
  });

  const { data: projeto, error: projErr } = await supabase
    .from('projetos')
    .select('id, nome_cliente, codigo_cliente, monday_board_id')
    .eq('codigo_cliente', QA_CODIGO_CLIENTE)
    .maybeSingle();

  if (projErr || !projeto) {
    console.warn(`[globalSetup] Projeto fixture QA-COORD-TEST (codigo_cliente=${QA_CODIGO_CLIENTE}) nao encontrado -- pulando provisionamento de board Monday. ${projErr?.message ?? ''}`);
    return;
  }

  // Board orfao de uma execucao anterior que travou/caiu antes do
  // globalTeardown rodar -- exclui antes de criar um novo, pra nao acumular
  // boards de teste no workspace real.
  if (projeto.monday_board_id) {
    console.log(`[globalSetup] Board Monday orfao encontrado (${projeto.monday_board_id}) -- excluindo antes de provisionar um novo.`);
    const { error: delErr } = await supabase.functions.invoke('monday-sync-project', {
      body: { action: 'delete', projeto_id: projeto.id, board_id: projeto.monday_board_id },
    });
    if (delErr) console.warn('[globalSetup] Falha ao excluir board orfao (nao critico, segue provisionando):', delErr.message);
  }

  const { data: atividades, error: atvErr } = await supabase
    .from('projeto_atividades')
    .select('id, codigo, descricao')
    .eq('projeto_id', projeto.id);

  if (atvErr) {
    console.warn('[globalSetup] Falha ao buscar atividades do fixture -- suite vai rodar sem board Monday real:', atvErr.message);
    return;
  }

  const { data: result, error: fnErr } = await supabase.functions.invoke('monday-sync-project', {
    body: {
      action: 'create',
      projeto_id: projeto.id,
      nome_cliente: projeto.nome_cliente,
      codigo_cliente: projeto.codigo_cliente,
      atividades: (atividades || []).map((a: any) => ({ ...a, cronograma_itens: [] })),
    },
  });

  if (fnErr || !result?.success) {
    console.warn('[globalSetup] Falha ao provisionar board Monday descartavel -- suite vai rodar sem board real (specs que checam monday_board_id/monday_status podem falhar):', fnErr?.message || result?.error);
    return;
  }

  console.log(`[globalSetup] Board Monday descartavel criado: ${result.board_id} (sera excluido ao final pelo globalTeardown/qa/teardown.ts).`);
}