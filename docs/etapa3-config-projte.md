# Etapa 3 (plano) — Config PROJTE (control-plane separado)

Documento de planejamento, sem código. Ambiente totalmente apartado de qualquer instância de
cliente (Aceex incluída) — aqui a PROJTE cadastra clientes e provisiona o ambiente de cada um.

Decisões já fechadas com o Caio:
- Projeto Supabase próprio, separado de qualquer cliente.
- 4 usuários no início (Caio + 3 colaboradores), sem sistema de papéis/permissões ainda — todo
  mundo com acesso igual por enquanto.
- O botão de provisionar deve fazer automação completa desde a primeira versão (criar projeto,
  aplicar migrations, subir functions) — não uma versão manual/checklist primeiro.
- **Zero compartilhamento entre clientes.** Nenhum secret, conta de terceiro (Resend, etc.) ou
  configuração é compartilhada — cada ambiente é 100% independente. Se 3 clientes usam Resend,
  são 3 contas Resend distintas, cada uma configurada só no ambiente daquele cliente.
- Precisa de **controle de versionamento** entre o template e cada ambiente já provisionado,
  pra detectar quando um cliente ficou pra trás em relação a uma melhoria já disponível.

---

## 1. Componentes

- **Banco/projeto Supabase novo** — só pro control-plane. Nome sugerido: `projte-config`.
- **App novo** (React/Vite, mesma stack já usada) — painel interno, não é o produto que os
  clientes usam. Sugestão de nome: "Painel PROJTE" ou "Config PROJTE".
- **Auth**: Supabase Auth do próprio projeto novo, 4 contas, todas com o mesmo nível de acesso.

## 2. Schema proposto

### `clientes`
Cadastro completo de cada cliente da PROJTE (Aceex é a primeira linha).

- Identificação: `nome_fantasia`, `razao_social`, `cnpj`, `logo_url`
- Endereço (estruturado): `endereco_logradouro`, `endereco_numero`, `endereco_complemento`,
  `endereco_bairro`, `endereco_cidade`, `endereco_uf`, `endereco_cep`
- Contato: `email_suporte`, `telefone_suporte`, `responsavel_nome`, `responsavel_cargo`,
  `responsavel_email`, `responsavel_telefone`
- Comercial: `plano_contratado`, `data_inicio_contrato`, `observacoes_comerciais`, `status`
  (`prospect` / `ativo` / `suspenso` / `cancelado`)
- `created_at`, `updated_at`

### `ambientes`
Um cliente pode ter mais de um ambiente (ex.: produção + homologação, no futuro). Por enquanto,
1:1 com `clientes`. Nenhum campo aqui é compartilhado entre linhas — cada ambiente guarda só os
próprios dados/secrets, sem referência cruzada a outro cliente.

- `cliente_id` (FK)
- `supabase_project_ref`, `supabase_project_url`
- `status` (`provisionando` / `ativo` / `erro` / `pausado`)
- `template_release_id` (FK pra `template_releases`, ver abaixo) — qual versão do template está
  rodando **de fato** nesse ambiente agora
- `provisionado_em`, `atualizado_em`
- `notas`

### `template_releases` (novo — controle de versionamento)

Cada linha é uma versão publicada do template (o pacote de migrations + edge functions da
Etapa 1.4, versionado por tag no repositório, ex.: `v1.0.0`, `v1.1.0`).

- `versao` (ex.: `v1.1.0`, semver)
- `git_tag` / `git_commit` — referência exata no repositório-template
- `changelog` (texto — "o que mudou nessa versão")
- `migrations_incluidas` (lista/contagem — quantas migrations novas desde a versão anterior)
- `functions_alteradas` (lista de quais edge functions mudaram nessa versão)
- `publicado_em`

**Como resolve o problema que você descreveu**: toda vez que uma melhoria for empacotada como
nova `template_release`, o painel compara `ambientes.template_release_id` (o que cada cliente
está rodando) contra a release mais recente. Quem estiver atrás aparece destacado — "Aceex está
em v1.0.0, última é v1.1.0, 3 migrations e 1 function pendentes". Sem isso, a divergência só
seria descoberta quando desse problema.

### `provisionamento_logs`
Cada etapa da automação grava um log — criar projeto, aplicar migration N, deployar function X,
etc. Essencial pra depurar quando uma automação falha no meio (e ela vai falhar, em algum
momento — criar projeto + rodar dezenas de migrations + subir dezenas de functions é uma
sequência longa). O mesmo log serve tanto pra **provisionar um ambiente novo** quanto pra
**atualizar um ambiente existente** pra uma release mais nova (ver seção 5).

- `ambiente_id` (FK)
- `tipo` (`provisionamento` / `atualizacao`)
- `etapa`, `status` (`ok`/`erro`), `mensagem`, `timestamp`

### Storage
Bucket `clientes-assets` pros logos de cada cliente cadastrado (mesmo padrão já usado no projeto
Aceex pra fotos de despesas).

## 3. O que a automação de provisionamento (ambiente novo) precisa fazer

1. Criar projeto Supabase novo via Management API (token de organização — ver seção 8).
2. Aguardar o projeto ficar pronto (provisionamento do Supabase leva alguns minutos).
3. Aplicar, em sequência, todas as migrations da `template_release` mais recente.
4. Deployar todas as edge functions dessa release.
5. Deixar os secrets de terceiros (Resend, SharePoint, Monday, Autentique) **em branco** —
   ninguém compartilha nada, então isso é preenchido depois, pelo próprio cliente, na tela de
   configurações dele (já existe: `EmailSettingsPage.tsx`).
6. Popular `app_settings` do projeto novo com os valores corretos (`app_url`,
   `supabase_functions_url`).
7. Gravar `supabase_project_ref`/`url`, `template_release_id` (a versão aplicada) e status
   `ativo` na tabela `ambientes`.
8. Mostrar a URL final pro usuário.

**Isso não é instantâneo.** O botão precisa ser assíncrono — dispara o processo, mostra
progresso em tempo real (lendo de `provisionamento_logs`), não trava a tela esperando.

## 4. Dependência crítica: Etapa 1.4 primeiro

Automatizar "aplicar o template num projeto novo" só funciona se o template for, de fato, um
pacote limpo, testado **e versionado** (é o que alimenta `template_releases`). Antes de
automatizar:

- Confirmar que a sequência de migrations roda do zero, sem erro, num projeto Supabase vazio
  (validação real, não suposição).
- Ter a lista de edge functions + secrets necessários documentada.
- Ter o runbook de onboarding pronto.
- Definir o esquema de versionamento do template (tags git, ex. `v1.0.0`) — isso vira a primeira
  linha de `template_releases`.

## 5. Atualizar um ambiente existente (não é só criar novo)

Diferente de "provisionar", aqui o ambiente já existe e está rodando uma release antiga.
A automação precisa:

1. Comparar `ambientes.template_release_id` atual com a release-alvo.
2. Aplicar só as migrations **novas** desde a release atual (não reaplicar tudo).
3. Redeployar só as edge functions que mudaram.
4. Atualizar `ambientes.template_release_id` e `atualizado_em`.

Isso é mais delicado que provisionar do zero: o ambiente já tem dados reais de produção do
cliente, então qualquer migration precisa ser escrita pensando em "rodar sobre uma base já
populada", não sobre um banco vazio (mesma disciplina que já seguimos nas migrations do Aceex
até aqui). Vale ter um ambiente de homologação por cliente antes de aplicar em produção — decisão
a amadurecer quando chegarmos nessa parte.

## 6. Custo (decisão de negócio, não técnica, mas relevante)

Cada projeto Supabase novo criado tem custo recorrente. Provisionar um ambiente por cliente
significa esse custo crescer linearmente com o número de clientes — vale ter isso mapeado antes
de precificar o serviço.

## 7. Ordem sugerida de construção

1. Gerar o token de Management API (seção 8) — pré-requisito de tudo que envolve automação.
2. Projeto Supabase `projte-config` + schema completo (`clientes`, `ambientes`,
   `template_releases`, `provisionamento_logs`) + app básico com CRUD de clientes (sem
   automação ainda). Cadastra a Aceex como primeiro registro.
3. Etapa 1.4: empacotar, versionar (primeira `template_release`) e validar o template.
4. Automação de provisionamento (ambiente novo), usando a release validada.
5. Automação de atualização (ambiente existente → release nova), com o cuidado da seção 5.
6. Teste ponta a ponta: provisionar um ambiente de teste de verdade, confirmar que sobe
   funcional (QA suite do BL-020 rodando contra ele seria uma boa validação).

## 8. Como gerar o token de Management API

Isso só você consegue fazer (exige login na sua conta/organização Supabase — eu não tenho como
gerar isso por você):

1. Entrar em [supabase.com/dashboard](https://supabase.com/dashboard) logado na conta da
   organização da PROJTE.
2. Ir em **Account → Access Tokens** (configuração da conta, não de um projeto específico).
3. Gerar um novo **Personal Access Token**, com um nome identificável (ex.:
   `projte-config-provisionamento`).
4. Guardar esse token com o mesmo cuidado de uma senha — ele vai ser configurado como **secret**
   dentro do projeto `projte-config` (nunca em código, nunca em migration, nunca em texto
   simples em lugar nenhum do repositório).
5. Esse token dá acesso de criar/gerenciar projetos na sua organização inteira — é o tipo de
   credencial que, se vazar, é sério. Vale considerar gerar um token dedicado só pra essa
   automação (não reaproveitar um token pessoal que você já usa pra outra coisa), pra poder
   revogar sem afetar mais nada se precisar.

## 9. Perguntas em aberto

- Nenhuma bloqueando o início do passo 2 (schema + CRUD de clientes). O token (passo 1) é o
  único pré-requisito real antes de qualquer automação de fato.

## 10. Status — executado em 2026-08-04

- Schema `projte_config` criado e exposto via PostgREST dentro do Aceex Production (provisório).
- Tela `/projte-config`: CRUD completo de `clientes` + aba **Ambientes** por cliente (QA/Produção)
  com `supabase_project_ref`/`url`, `status`, `template_release_id`, `notas`.
- **Segredos por ambiente**: nova tabela `projte_config.ambiente_secrets` guarda só a *referência*
  (UUID) do segredo real, nunca o valor. O valor fica no **Supabase Vault**
  (`vault.secrets`, extensão já ativa nesse projeto). Como o role `authenticated` não tem
  permissão de chamar `vault.create_secret`/`update_secret` (confirmado via
  `has_function_privilege`), criei 3 funções `security definer` em `projte_config`
  (`vault_create_secret`, `vault_update_secret`, `vault_delete_secret`) que só `service_role`
  pode executar, e uma edge function nova, `projte-manage-secret`, que: (1) confirma que quem
  chamou está em `usuarios_autorizados`, (2) usa essas funções via service role pra
  criar/rotacionar/remover o segredo, (3) nunca devolve o valor de volta — só o UUID.
  Testado ponta a ponta (criar + remover) antes de entrar na tela.
- Cliente de teste "Aceex Consultoria" segue como registro de teste (decisão do Caio: não vira
  o registro real da Aceex por enquanto).
- **Ainda não conectado**: os projetos Supabase QA/Produção de um cliente real precisam estar
  numa conta Supabase separada (decisão de isolamento já fechada). Minha conexão MCP atual só
  enxerga a organização de sempre (ProjTE/Aceex Production, hinode-pmo-dashboard, Accex Project)
  — para uma conta genuinamente separada, não tenho visibilidade automática; os dados (ref, URL)
  precisam ser informados manualmente na tela, e as chaves coladas direto no formulário de
  segredos (nunca em chat).

## 11. Botão "Criar Ambiente" — status executado em 2026-08-04

Pedido do Caio: *"criar o botão criar ambiente, pra fazer o espelho do Projte pro cliente, sem
levar nenhum dado, apenas os esquemas... prontos pra rodar."* Implementado como v1 = schema-only
(sem dados, sem subir edge functions, sem configurar secrets de terceiros — isso fica pra uma
fase futura).

- **`projte_config.template_migrations`** (nova tabela): uma linha por migration do produto
  (`seq`, `name`, `sql`), vinculada a uma `template_release_id`. É a fonte de verdade das 59
  migrations que compõem o template v1.0.0 — não ficam embutidas no código da edge function
  (uma tentativa inicial de embutir como bundle `.ts` gerado por script se mostrou frágil demais
  pra 59 arquivos/~60KB de SQL; a tabela resolve isso de forma muito mais robusta e também fica
  fácil de atualizar via SQL quando uma nova release for publicada).
- **59 de 65 migrations do repositório foram selecionadas** para o template — excluídas: 4
  específicas do control-plane `projte_config` (schema, grants, `ambiente_secrets`, vault
  wrappers), `20260416_cron_check_alertas.sql` (sintaxe inválida, substituída por
  `20260804124759_fix_cron_check_alertas.sql`) e `20260303231509_...sql` (semeava
  `app_settings.app_url` com a URL do Aceex — erraria o onboarding de um cliente novo).
- **Hazard de URL hardcoded resolvido via placeholder**: as duas migrations que criam os cron
  jobs (`fix_cron_check_alertas`, `fix_cron_health_score_semanal`) tinham a URL do projeto Aceex
  escrita direto no SQL. Nas linhas salvas em `template_migrations`, esse trecho foi trocado pelo
  token `{{PROJTE_FUNCTIONS_URL}}`, que a edge function substitui pela URL real do ambiente-alvo
  antes de rodar cada migration.
- **Duas migrations corrompidas (CP1252 em vez de UTF-8) foram corrigidas** antes de entrarem no
  template: `20260416_fix_rls_projeto_alertas.sql` (recuperação completa) e
  `20260428_bl007_health_score.sql` (caracteres acentuados recuperados; 5 linhas decorativas com
  perda irrecuperável de caracteres — "??" — foram limpas para divisores ASCII simples, mesmo
  tratamento já usado antes em `health-score-calculator/index.ts`).
- **Edge function `projte-provision-ambiente`** (nova, `verify_jwt=true`): mesma checagem de
  `usuarios_autorizados` do resto do painel. Recebe `ambiente_id`, busca o `management_token`
  desse ambiente no Vault (via `vault_reveal_secret`, 4ª função-ponte criada agora), carrega as
  migrations da release mais recente e roda cada uma, em sequência, contra a **Supabase
  Management API do projeto do cliente** (`POST /v1/projects/{ref}/database/query`, autenticado
  com o `management_token` do próprio cliente — não com as credenciais MCP desta sessão, que não
  enxergam contas Supabase separadas). Cada migration é logada em `provisionamento_logs`; falha
  numa migration para o processo e marca `ambientes.status = 'erro'`. Sucesso total marca
  `status = 'ativo'`, `template_release_id` e `provisionado_em`.
- **Rodam uma migration por vez, não numa transação única**: uma das migrations do produto faz
  `ALTER TYPE ... ADD VALUE`, que o Postgres não permite usar na mesma transação em que foi
  criado — agrupar tudo numa transação gigante quebraria nesse ponto. Rodar migration por
  migration replica o comportamento real do Supabase CLI.
- **Botão "Criar Ambiente"** adicionado na aba Ambientes de cada cliente (`ProjteConfigPage.tsx`),
  ao lado do status do ambiente. Bloqueado até o `project_ref`/`url` estarem salvos e o
  `management_token` estar registrado nos Segredos; pede confirmação antes de rodar (efeito
  irreversível — 59 migrations reais no projeto do cliente).
- **Não testado ainda contra um projeto real** — a tabela/função foram validadas estruturalmente
  (contagem, ordem de `seq`, ausência de hardcode residual do Aceex, ausência de artefatos de
  corrupção), mas o primeiro clique real do botão ainda não aconteceu. Recomendação: testar
  primeiro contra o ambiente QA de um cliente antes de Produção.
