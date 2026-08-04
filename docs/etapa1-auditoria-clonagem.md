# Etapa 1 — Auditoria: tornar o ambiente Aceex clonável

Objetivo: o Aceex deixa de ser "o produto" e passa a ser o **piloto/template** do Projte SaaS
(um cliente entre outros, isolado por instância própria por cliente). Este documento lista,
com evidência real (grep + leitura de fonte, não suposição), tudo que hoje amarra o código
especificamente ao Aceex e precisa ser generalizado antes de clonar para o Cliente B.

Levantamento feito em: front-end (`src/`) + edge functions (`supabase/functions/`) +
migrations (`supabase/migrations/`) do repositório real, via busca por "aceex" (case-insensitive),
pelo project ref (`ofolgjtqgmudfeoppwtb`) e por domínios `lovable.app` hardcoded.

---

## 1. Hardcodes de infraestrutura (bugs reais de clonagem — prioridade alta)

Estes não são só "branding" — se clonados sem correção, quebram funcionalmente para o Cliente B
(apontam pro ambiente do Aceex em vez do ambiente do cliente).

| Arquivo | Linha | Problema |
|---|---|---|
| `supabase/functions/monday-sync-project/index.ts` | 152 | Calcula `webhookUrl` dinamicamente (`${SUPABASE_URL}/...`) mas a mutation real usa a URL do Aceex hardcoded (`https://ofolgjtqgmudfeoppwtb.supabase.co/...`). Webhook do board do Cliente B apontaria pro projeto do Aceex. |
| `supabase/functions/check-alertas/index.ts` | 398 | Link do botão no email diário de alertas hardcoded pra `https://preview--agendas-aceex.lovable.app/admin`. Emails de alerta do Cliente B levariam o usuário pro painel do Aceex. |
| `supabase/functions/protheus-users/index.ts` | 212 | Fallback hardcoded `appUrl = "https://agendas-aceex.lovable.app"` quando `app_settings.app_url` não está configurado (esse setting já existe e é o caminho correto — ver migration `20260303231509`). O fallback deveria falhar alto ou ficar vazio, nunca apontar pro Aceex. |
| `supabase/migrations/20260416_cron_check_alertas.sql` | 15 | Job de `pg_cron` chama `net.http_post` com a URL do Aceex hardcoded (`https://ofolgjtqgmudfeoppwtb.supabase.co/functions/v1/check-alertas`). Isso é o jeito padrão do Supabase gerar esse tipo de migration (captura a URL literal no momento da criação) — não é só um bug de código, é algo que **todo clone precisa regenerar manualmente** (não dá pra só re-rodar a migration tal como está). Vira item obrigatório no runbook de onboarding (Etapa 1.4). |
| `supabase/config.toml` | 1 | `project_id = "ofolgjtqgmudfeoppwtb"`. Normal/esperado — cada clone gera o seu próprio ao rodar `supabase link`. Não é bug, só não pode ir junto se o template for copiado por cópia de arquivo em vez de `supabase link`. |

## 2. Branding "Aceex" hardcoded (visível a usuário/cliente — prioridade média)

Nada disso quebra funcionalmente, mas todo cliente novo veria a marca "Aceex" em vez da dele.

| Arquivo | O quê |
|---|---|
| `src/pages/EmailSettingsPage.tsx` | Logo (`aceex_logo.jpg`) no header da tela; assunto de teste "Teste de Configuração SMTP - Aceex"; placeholder "Ex: Suporte Aceex". |
| `src/pages/ConsultorDashboard.tsx` | Logo no header; template HTML de exportação (recibo/relatório) com `<div class="brand">ACEEX</div>` e rodapé "Gerado pelo Sistema ACEEX". |
| `src/components/admin/AdminDashboardView.tsx` | Logo no header. |
| `src/components/admin/AdminStatusReport.tsx` | Logo + "Grupo Aceex · Consultoria & Implantação" / "Grupo Aceex — Documento confidencial." — **este é um relatório de status que vai pro cliente final**, prioridade real. |
| `src/components/admin/AtividadesCsvWizard.tsx` | Comentário no template CSV: "# TEMPLATE ... - Aceex". |
| `src/components/admin/AdminProjetos.tsx` | Comentário no template CSV de importação: "... - Aceex". |
| `src/components/consultor/ui/BacklogBoard.tsx` | Export Excel: `wb.creator = "Aceex"`. |
| `supabase/functions/check-alertas/index.ts` | Template do email diário: "ACEEX" no header, assunto `⚠️ ACEEX — N alertas...`, rodapé "ACEEX · Resumo automático diário". |
| `supabase/functions/check-overdue-agendas/index.ts` | Assinatura do email: "Coordenação de Projetos Aceex" (também existe uma cópia desse template salva em `app_settings` via migration `20260310202406` — ver nota abaixo). |
| `supabase/functions/protheus-users/index.ts` | Assunto do email de boas-vindas: "Novo usuario Aceex". |
| `supabase/functions/send-os-email/index.ts` | Remetente: `"OS Aceex <onboarding@resend.dev>"`. |

**Nota:** o template de email de `check-overdue-agendas` já vive parcialmente como **dado** em
`app_settings` (migration `20260310202406`), não só como código. Isso é bom — significa que a
branding desse template específico já pode virar configurável por tenant sem mexer em código,
uma vez que exista o conceito de tenant. Vale usar esse como modelo para os outros templates.

## 3. Bug real encontrado, sem relação com o SaaS (reportar/corrigir já)

`supabase/functions/send-os-email/index.ts`, linha ~136: `const TEST_MODE = true;` hardcoded.
**Todo email de Ordem de Serviço enviado hoje em produção vai para `delivered@resend.dev`,
não para o coordenador/contato real do projeto.** Parece ter sido deixado ligado de um teste.

## 4. Já bem parametrizado (nenhuma ação necessária agora)

Confirmado por leitura de fonte — já usam `app_settings`/env vars corretamente, sem hardcode:
`autentique-send`, `sharepoint-upload`, `monday-webhook-receiver`, `monday-reset-board`,
`monday-test-connection`, `send-email`, `src/integrations/supabase/client.ts` (já 100% via
`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`).

## 5. Auditoria concluída (functions restantes)

Lidas linha a linha / grepadas por URL hardcoded (`ofolgjtqgmudfeoppwtb`, `lovable.app`, `aceex`,
`localhost`, `*.supabase.co`) e por qualquer `https?://` fora de imports/APIs de terceiros:
`manage-user`, `create-user`, `update-user`, `agendas-maintenance`, `monthly-expenses-scheduler`,
`protheus-agenda-receive`, `protheus-receber-agenda`, `protheus-projects`,
`health-score-calculator`, `diario-entry`, `sla-evaluator`, `autentique-send`, `mock-protheus`.
**Nenhum hardcode de infraestrutura Aceex encontrado nelas** — as únicas URLs fixas são endpoints
de APIs de terceiros genéricas (Monday, Microsoft Graph, Autentique, Resend, deno.land/esm.sh),
que são as mesmas para qualquer cliente que use esses serviços.

**Achado à parte, corrigido**: `sla-evaluator/index.ts` tinha só um comentário de cabeçalho
descrevendo como agendar via `cron.schedule('sla-evaluator-diario', ...)` com a URL do Aceex
hardcoded e a service role key embutida em texto — esse job nunca existiu de fato em produção
(confirmado via `select * from cron.job` antes da correção). Corrigido: função redeployada com
`verify_jwt=false` (mesmo padrão de `check-alertas`/`health-score-calculator`, elimina a
necessidade de guardar a service role key em texto no cron), e job criado via migration
`fix_cron_sla_evaluator` lendo `app_settings.supabase_functions_url` (jobid 5, `0 11 * * *`).
Testado manualmente via `net.http_post` — respondeu 200 e já processou dados reais de produção
(6 avaliados, 6 vencidos na primeira execução, já que nunca tinha rodado antes).

**Achado à parte #2, corrigido**: `autentique-send/index.ts` e `health-score-calculator/index.ts`
tinham corrupção de caracteres acentuados (sequências `??`/`???` no lugar de "ã", "ç", "á", "í",
etc.), de uma gravação anterior com encoding errado. Em `autentique-send` isso atingia
**mensagens de erro reais mostradas ao usuário** (ex.: `"Documento n??o enviado ao SharePoint.
Fa??a o upload primeiro."`). Corrigido todo o arquivo (17 ocorrências) e removida também uma
referência a `aceexcombr.sharepoint.com` num comentário de exemplo (generalizada para
`<tenant>.sharepoint.com`). Em `health-score-calculator` a corrupção era só em comentários
decorativos de seção — corrigida também. Ambas redeployadas (autentique-send v10,
health-score-calculator v5), confirmado 0 ocorrências residuais de `??` via varredura completa
do diretório `supabase/functions` (a única outra fonte de `??` no código é o operador de
nullish-coalescing do JS/TS, que é legítimo).

Front-end: demais páginas/componentes fora dos que já apareceram na busca por "aceex" — a busca
cobre menções à palavra, mas não cobre 100% dos hardcodes de URL/domínio possíveis fora desse
padrão.

---

## Status

- [x] `monday-sync-project` — webhook agora usa a URL dinâmica (`webhookUrl`) em vez do domínio do Aceex hardcoded. Deployado (v10).
- [x] `check-alertas` — link "Abrir Dashboard" agora vem de `app_settings.app_url`; some do email se não configurado (sem apontar pro Aceex). Deployado (v5). Texto "ACEEX" do template mantido por ora (branding, seção 2).
- [x] `protheus-users` — removido o fallback hardcoded pro domínio do Aceex; sem `app_url` configurado, o e-mail sai sem o link em vez de apontar pro ambiente errado. Deployado (v5).
- [x] `supabase/migrations/20260416_cron_check_alertas.sql` — corrigido via nova migration `20260804124759_fix_cron_check_alertas.sql`, aplicada em produção. O job `check-alertas-diario` agora existe de verdade em `cron.job` (rodando às 11h UTC), lendo a URL de `app_settings.supabase_functions_url` em vez de hardcode -- clonável (só exige configurar essa chave no onboarding do cliente novo). Efeito colateral esperado: o e-mail diário de alertas, que nunca rodou de fato, passa a ser enviado a partir de agora.
- [x] `health-score-semanal` — mesmo padrão do `check-alertas`: URL do Aceex hardcoded no `command` do cron. Corrigido via migration `fix_cron_health_score_semanal`, aplicada em produção. Job recriado (jobid 4, mesmo schedule `59 23 * * 0`), agora lendo `app_settings.supabase_functions_url` em vez de hardcode. Verificado via `select * from cron.job`.
- [x] `send-os-email` — `TEST_MODE` removido (estava travado em `true`, redirecionando todo e-mail de OS pra sandbox do Resend). Deployado (v5). **Atenção**: requer domínio de envio verificado na conta Resend — sem isso, o Resend recusa envio pra qualquer destinatário que não seja o dono da conta, mesmo sem TEST_MODE. Verificar isso antes de considerar o e-mail de OS "funcionando" de fato.
- [x] `check-alertas` — `enviarEmailAlertas` chamava `send-os-email` (API Resend, exige `projeto_id`, payload com `html`) sem checar o erro do invoke; toda chamada falhava silenciosamente. Agora chama `send-email` (SMTP genérico via `email_settings`, mesmo caminho usado pela tela de configurações — funciona com Gmail, Office 365, etc.), payload corrigido (`body` em vez de `html`), e o erro do invoke agora é logado. Deployado (v6). Depende do mesmo requisito do item acima: `email_settings` precisa estar configurado (SMTP), senão a função só loga aviso e não envia.
- [ ] Genericizar branding (seção 2) — depende de existir um lugar de onde puxar o nome/logo do tenant
- [ ] Concluir auditoria dos itens da seção 5
- [ ] Rodar suite QA completa após cada lote de correções
