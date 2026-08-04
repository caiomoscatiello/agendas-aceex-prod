# Etapa 1.4 — Empacotar o template (schema + functions) de forma reproduzível

Pré-requisito da Etapa 3 (seção 4 de `etapa3-config-projte.md`): antes de automatizar
"provisionar ambiente novo", o template precisa ser um pacote conhecido, documentado e
versionado. Este documento é o inventário real desse pacote, levantado por leitura de fonte e
consulta direta ao projeto Aceex Production (não suposição).

## 1. Migrations

63 arquivos em `supabase/migrations/`, nomeados por timestamp (`YYYYMMDDHHMMSS_*.sql`), aplicados
em ordem cronológica pelo nome do arquivo — é o comportamento padrão do Supabase CLI
(`supabase db push` / `supabase migration up`), nenhuma dependência circular conhecida.

Extensões Postgres exigidas (usadas por migrations de cron): `pg_cron`, `pg_net`.

**Gap conhecido, não resolvido nesta etapa**: não validamos de fato a sequência completa rodando
do zero num projeto Supabase vazio — isso exigiria um projeto novo, e a decisão em aberto (ver
`etapa3-config-projte.md`) foi não criar um projeto extra por ora (custo). Essa validação real
fica pendente até existir um projeto sobressalente pra testar (o próprio Caio mencionou criar uma
conta nova futuramente "pra simularmos um clone" — esse é o momento de rodar esse teste).

## 2. Edge Functions — inventário completo

29 functions em `supabase/functions/` (fora as de control-plane PROJTE, que não fazem parte do
template do produto: `bootstrap-projte-user`, `debug-projte-auth`).

| Function | verify_jwt | Chamada por cron? | Secret(s) exigido(s) |
|---|---|---|---|
| create-user | false | não | — |
| manage-user | false | não | — |
| update-user | true (padrão) | não | — |
| send-os-email | false | não | `RESEND_API_KEY` (+ domínio de envio verificado na conta Resend) |
| send-email | true (padrão) | não | usa `email_settings` (SMTP, dado de banco, não secret) |
| check-alertas | false | sim (`check-alertas-diario`, `0 11 * * *`) | usa `email_settings` |
| check-overdue-agendas | false | não (disparo manual) | — |
| agendas-maintenance | false | não (disparo manual) | — |
| monthly-expenses-scheduler | false | não (botão "Executar Agora" na tela de config) | — |
| health-score-calculator | false* | sim (`health-score-semanal`, `59 23 * * 0`) | — |
| sla-evaluator | false* | sim (`sla-evaluator-diario`, `0 11 * * *`) | — |
| autentique-send | false | não | usa `app_settings.autentique_api_key` (dado de banco) |
| sharepoint-upload | false | não | usa `app_settings.sharepoint_*` (dado de banco) |
| monday-sync-project | false | não | usa `app_settings.monday_*` (dado de banco) |
| monday-agenda-sync | false | não | usa `app_settings.monday_*` (dado de banco) |
| monday-reset-board | false | não | usa `app_settings.monday_*` (dado de banco) |
| monday-webhook-receiver | false* | não (recebe webhook externo) | `MONDAY_SIGNING_SECRET` |
| monday-test-connection | true (padrão) | não | — |
| protheus-users | false | não | — |
| protheus-projects | true (padrão) | não | — |
| protheus-agenda-sync | true (padrão) | não | — |
| protheus-agenda-receive | true (padrão) | não | — |
| protheus-receber-agenda | true (padrão) | não | `PROTHEUS_API_KEY` |
| mock-protheus | false* | não (endpoint de simulação p/ QA) | — |
| diario-entry | true (padrão) | não | — |
| project-coordinator | true (padrão) | não | — |
| process-agenda-request | true (padrão) | não | — |

`*` = **drift encontrado e corrigido nesta etapa**: `health-score-calculator`, `sla-evaluator`,
`monday-webhook-receiver` e `mock-protheus` estavam com `verify_jwt=false` em produção mas
**ausentes de `supabase/config.toml`** — se o template fosse clonado a partir do repositório tal
como estava, essas 4 functions subiriam com `verify_jwt=true` (padrão do CLI) e quebrariam:
`health-score-calculator`/`sla-evaluator` são chamadas por cron sem header de autenticação (exato
mesmo tipo de bug já corrigido nesta sessão pro `sla-evaluator`), `monday-webhook-receiver` recebe
webhook do Monday.com sem JWT do Supabase. Corrigido: as 4 agora declaradas em `config.toml`.

Também documentado em `config.toml`: `project_id` é o ref do Aceex Production — ao clonar, deve
ser trocado pro ref do projeto do cliente novo antes de `supabase link`/`deploy`.

## 3. Secrets a configurar por ambiente novo (função → segredo)

Automáticos (o próprio Supabase injeta, não precisa configurar):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Manuais, um valor **por cliente**, nunca compartilhado (decisão já fechada — ver
`etapa3-config-projte.md`):
- `RESEND_API_KEY` — conta Resend própria do cliente, com domínio de envio verificado.
- `MONDAY_SIGNING_SECRET` — só se o cliente usar integração Monday.
- `PROTHEUS_API_KEY` — só se o cliente usar `protheus-receber-agenda`.

## 4. Dados de configuração (banco, não secret) a preencher pós-provisionamento

Ficam em branco na criação do ambiente, preenchidos pelo próprio cliente depois via UI
(`EmailSettingsPage.tsx`) ou pela PROJTE no onboarding:
- `email_settings` (SMTP: host, porta, usuário, senha, remetente)
- `app_settings`: `app_url`, `supabase_functions_url` (crítico — os 3 cron jobs dependem disso,
  ver seção 5), `monday_*`, `sharepoint_*`, `autentique_api_key`, `despesas_*`, `regras_*`
- `protheus_integracoes` (uma linha por integração Protheus configurada)

## 5. Cron jobs (pg_cron) — todos parametrizados, nenhum hardcode restante

| Job | Schedule | Function | Fonte da URL |
|---|---|---|---|
| check-alertas-diario | `0 11 * * *` | check-alertas | `app_settings.supabase_functions_url` |
| health-score-semanal | `59 23 * * 0` | health-score-calculator | `app_settings.supabase_functions_url` |
| sla-evaluator-diario | `0 11 * * *` | sla-evaluator | `app_settings.supabase_functions_url` |

Confirmado via `select * from cron.job` no Aceex Production (2026-08-04) — só esses 3 jobs
existem; as demais functions com uso periódico (`check-overdue-agendas`,
`monthly-expenses-scheduler`, `agendas-maintenance`) são disparo manual hoje, não cron.

**Importante pro onboarding de cliente novo**: as migrations desses 3 crons fazem
`insert ... on conflict do nothing` com o valor de `supabase_functions_url` **do Aceex** como
seed default. Isso significa que, se aplicadas na ordem original num projeto novo, o cron do
cliente novo aponta pro Aceex até alguém corrigir manualmente. Onboarding precisa, **antes** de
rodar essas migrations (ou logo em seguida): `update app_settings set value = '<url do projeto
do cliente>' where key = 'supabase_functions_url';`

## 6. Storage buckets do produto

`despesas-fotos` (fotos de comprovantes de despesa), `documentos-modelo` (modelos de documento).
Ambos públicos, criados via migration. (`clientes-assets` é exclusivo do control-plane PROJTE,
não faz parte do template do produto.)

## 7. Branding pendente (Etapa 2, não bloqueia esta etapa)

Lista completa em `docs/etapa2-configurador-empresa-cliente.md` — 14 pontos de "Aceex" hardcoded
em texto/logo que precisam virar dado configurável por cliente antes do template ser 100%
neutro. Não bloqueia o empacotamento técnico (schema/functions), mas bloqueia a experiência do
Cliente B ver a marca dele em vez da Aceex.

## 8. Versionamento

Esta auditoria + as correções de `config.toml` compõem a primeira release candidata do template:
**v1.0.0**. Registrar em `projte_config.template_releases` (schema criado na Etapa 3) apontando
pro commit deste repositório em que este documento foi commitado.

## Status

- [x] Inventariar migrations (contagem, extensões, ordem)
- [x] Inventariar edge functions (verify_jwt, secrets, uso por cron)
- [x] Corrigir drift de `verify_jwt` em `config.toml` (4 functions)
- [x] Documentar secrets/dados de configuração por ambiente novo
- [x] Confirmar cron jobs reais via `cron.job` (3, todos parametrizados)
- [ ] Validar aplicação das migrations do zero num projeto Supabase vazio (bloqueado — sem
      projeto sobressalente disponível agora)
- [ ] Resolver branding (Etapa 2) antes de considerar o template 100% neutro
- [ ] Registrar `v1.0.0` em `projte_config.template_releases`
