// qa/teardown.ts
// BL-020 QA Skill Runner -- Script de teardown automatico
// Uso: npx tsx qa/teardown.ts  (standalone)
//      ou como globalTeardown do Playwright (ver playwright.config.ts)
// Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou environment
//
// v6: adicionada exclusao do board Monday descartavel provisionado pelo
//     novo qa/globalSetup.ts (ver esse arquivo e a acao "delete", nova,
//     em supabase/functions/monday-sync-project/index.ts v9). Antes o board
//     do fixture QA-COORD-TEST era criado uma vez e ficava permanente nos
//     quadros reais da empresa no Monday.com -- agora cada execucao da
//     suite cria o seu proprio board (globalSetup) e este teardown o
//     exclui ao final, best-effort (nao falha a suite se o Monday estiver
//     fora do ar -- so registra aviso).
// v5: uma execucao real ficou ~5min "presa" entre o delete de
//     solicitacoes_cancelamento e o de requisicoes_agenda. Diagnostico via
//     Supabase MCP (pg_stat_activity, pg_locks, logs de API, EXPLAIN ANALYZE
//     do delete): nenhuma query lenta, nenhum lock, nenhuma conexao presa --
//     o DELETE em requisicoes_agenda roda em 1.3ms no Postgres e os logs de
//     API mostram todos os 9 DELETEs retornando 204. Ou seja, o atraso foi
//     inteiramente client-side/rede entre uma chamada e a proxima (fetch
//     preso sem timeout), nao um bug de logica ou do banco. Como nao da pra
//     diagnosticar a causa exata da rede a distancia, a mitigacao aplicada e
//     um timeout de seguranca em toda chamada supabase-js (15s): se a rede
//     travar de novo, a chamada falha rapido e visivel em vez de pendurar o
//     processo por minutos em silencio.
// v4: AG004/AG005 pararam de usar hoje+11/hoje+12 -- passaram a usar hoje (0)
//     e ontem (-1), porque btn-registrar-apontamento fica disabled para datas
//     futuras (isDateFuture em ConsultorDashboardV2.tsx). datasDeTesteUsadas()
//     atualizada para limpar essas duas datas em vez das antigas.
// v3: corrigido nome da tabela de backlog (era "backlog_itens", que nao
//     existe -- o correto e "projeto_backlog", quebrando o teardown com
//     "Could not find the table 'public.backlog_itens' in the schema cache").
// v2: exportado como funcao (export default) para poder ser reaproveitado
//     pelo globalTeardown do Playwright, em vez de duplicar essa logica em
//     um arquivo separado (global-teardown.ts). O disparo automatico no
//     final do arquivo so roda quando o script e executado diretamente
//     (node/tsx qa/teardown.ts), nao quando e importado como modulo.
//     Tambem adicionadas as datas +8 e +9 (usadas por IN001/IN002) e a
//     limpeza de requisicoes_agenda do projeto fixo QA-COORD-TEST -- antes
//     nenhuma das duas era limpa por este script.

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// NOVO (v5) -- fetch com timeout de seguranca. Sem isso, um travamento de
// rede no meio de uma chamada supabase-js fica pendurado indefinidamente
// (foi o que aconteceu: ~5min presos entre dois deletes, sem nenhuma query
// lenta ou lock do lado do banco). Com isso, a chamada aborta em 15s e o
// erro aparece no console em vez de o processo travar em silencio.
function fetchComTimeout(timeoutMs = 15_000) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

// Nome do projeto fixo de QA (ver qa/tests/helpers.ts -- QA_PROJETO_NOME).
// Criado manualmente no banco com coordenador_id = tst.coord@projte.com,
// para contornar a RLS que so mostra requisicoes ao coordenador REAL do
// projeto. Nao e apagado aqui -- so as requisicoes/agendas geradas nele.
const QA_PROJETO_NOME = 'QA-COORD-TEST';

// Prefixo padrao de todos os dados de teste
const TEST_PREFIX = '[TEST]';

// Datas usadas pelos agentes de teste
// (-1 = AG005 (ontem), 0 = AG004 (hoje) -- apontamento exige data hoje/passada,
//  ver isDateFuture em ConsultorDashboardV2.tsx; 7 = AG001, 8 = IN001,
//  9 = IN002, 10 = AG003, 13 = IN003 -- cada teste que precisa de uma agenda
//  confirmada cria a propria, numa data exclusiva, pra nao disputar com os
//  outros. 14 e 21 = reservado para skills futuras)
function datasDeTesteUsadas(): string[] {
  const hoje = new Date();
  return [-1, 0, 7, 8, 9, 10, 13, 14, 21].map(d => {
    const dt = new Date(hoje);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().split('T')[0];
  });
}

export default async function teardown() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.error('[TEARDOWN] ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao definidos');
    process.exitCode = 1;
    return;
  }

  // Usa service_role para bypass de RLS -- NUNCA expor no frontend
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
    global: { fetch: fetchComTimeout(15_000) },
  });

  console.log('[TEARDOWN] Iniciando limpeza de dados [TEST]...');
  const errors: string[] = [];
  const datasQA = datasDeTesteUsadas();

  // 1. Mencoes do diario (filhos de projeto_diario — cascade do DELETE abaixo)
  // Nao precisa deletar separado se CASCADE estiver configurado

  // 2. Entradas do diario [TEST]
  const { error: e1, count: c1 } = await supabase
    .from('projeto_diario')
    .delete({ count: 'exact' })
    .like('texto', `${TEST_PREFIX}%`);
  if (e1) errors.push(`projeto_diario: ${e1.message}`);
  else console.log(`  [OK] projeto_diario: ${c1 ?? 0} registros deletados`);

  // 3. Solicitacoes de cancelamento [TEST]
  const { error: e2, count: c2 } = await supabase
    .from('solicitacoes_cancelamento')
    .delete({ count: 'exact' })
    .like('justificativa', `${TEST_PREFIX}%`);
  if (e2) errors.push(`solicitacoes_cancelamento: ${e2.message}`);
  else console.log(`  [OK] solicitacoes_cancelamento: ${c2 ?? 0} registros deletados`);

  // 4. Requisicoes de agenda geradas no projeto fixo de QA (AG001/IN001/IN002
  //    inserem em requisicoes_agenda antes da agenda ser confirmada)
  const { error: e3b, count: c3b } = await supabase
    .from('requisicoes_agenda')
    .delete({ count: 'exact' })
    .eq('cliente', QA_PROJETO_NOME);
  if (e3b) errors.push(`requisicoes_agenda (${QA_PROJETO_NOME}): ${e3b.message}`);
  else console.log(`  [OK] requisicoes_agenda (${QA_PROJETO_NOME}): ${c3b ?? 0} registros deletados`);

  // 5. Agendas [TEST] (por data futura de teste)
  const { error: e3, count: c3 } = await supabase
    .from('agendas')
    .delete({ count: 'exact' })
    .in('data', datasQA);
  if (e3) errors.push(`agendas (por data): ${e3.message}`);
  else console.log(`  [OK] agendas (datas QA): ${c3 ?? 0} registros deletados`);

  // 6. Backlog itens [TEST] -- tabela real e "projeto_backlog", nao
  //    "backlog_itens" (essa nao existe no schema; o teardown quebrava aqui
  //    com "Could not find the table 'public.backlog_itens'").
  const { error: e4, count: c4 } = await supabase
    .from('projeto_backlog')
    .delete({ count: 'exact' })
    .like('titulo', `${TEST_PREFIX}%`);
  if (e4) errors.push(`projeto_backlog: ${e4.message}`);
  else console.log(`  [OK] projeto_backlog: ${c4 ?? 0} registros deletados`);

  // 7. Atividades [TEST]
  const { error: e5, count: c5 } = await supabase
    .from('projeto_atividades')
    .delete({ count: 'exact' })
    .like('descricao', `${TEST_PREFIX}%`);
  if (e5) errors.push(`projeto_atividades: ${e5.message}`);
  else console.log(`  [OK] projeto_atividades: ${c5 ?? 0} registros deletados`);

  // 8. Projetos [TEST] (ultimo — filhos sao deletados por CASCADE)
  //    Nao afeta o QA-COORD-TEST, que nao usa o prefixo [TEST] de proposito
  //    (e um fixture fixo, nao um dado descartavel por execucao).
  const { error: e6, count: c6 } = await supabase
    .from('projetos')
    .delete({ count: 'exact' })
    .like('nome_cliente', `${TEST_PREFIX}%`);
  if (e6) errors.push(`projetos: ${e6.message}`);
  else console.log(`  [OK] projetos: ${c6 ?? 0} registros deletados`);

  // 9. qa_runs antigos (> 30 dias)
  const limite30d = new Date();
  limite30d.setDate(limite30d.getDate() - 30);
  const { error: e7, count: c7 } = await supabase
    .from('qa_runs')
    .delete({ count: 'exact' })
    .lt('iniciado_em', limite30d.toISOString());
  if (e7) errors.push(`qa_runs antigos: ${e7.message}`);
  else console.log(`  [OK] qa_runs antigos: ${c7 ?? 0} registros deletados`);

  // 10. Board Monday descartavel (ver qa/globalSetup.ts) -- best-effort,
  //     nao entra na lista de `errors` que faz a suite retornar exitCode 1,
  //     porque um board de teste sobrando no Monday nao invalida o resultado
  //     dos testes em si (so seria um retrabalho manual de limpeza).
  try {
    const { data: projetoQA } = await supabase
      .from('projetos')
      .select('id, monday_board_id')
      .eq('codigo_cliente', 'QACOORD')
      .maybeSingle();

    if (projetoQA?.monday_board_id) {
      const { error: delMondayErr } = await supabase.functions.invoke('monday-sync-project', {
        body: { action: 'delete', projeto_id: projetoQA.id, board_id: projetoQA.monday_board_id },
      });
      if (delMondayErr) {
        console.warn(`  [AVISO] Falha ao excluir board Monday descartavel ${projetoQA.monday_board_id}: ${delMondayErr.message}`);
      } else {
        console.log(`  [OK] Board Monday descartavel ${projetoQA.monday_board_id} excluido`);
      }
    } else {
      console.log('  [OK] Nenhum board Monday descartavel pendente de exclusao');
    }
  } catch (e) {
    console.warn('  [AVISO] Falha ao excluir board Monday descartavel (nao critico):', (e as Error).message);
  }

  console.log('');
  if (errors.length > 0) {
    console.error('[TEARDOWN] ERROS encontrados:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exitCode = 1;
  } else {
    console.log('[TEARDOWN] Concluido com sucesso. Banco limpo.');
  }
}

// So dispara automaticamente quando o arquivo e executado diretamente
// (ex: npx tsx qa/teardown.ts). Quando importado pelo globalTeardown do
// Playwright, quem chama teardown() e o proprio Playwright.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  teardown().catch(err => {
    console.error('[TEARDOWN] Falha inesperada:', err);
    process.exit(1);
  });
}