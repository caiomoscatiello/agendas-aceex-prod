# Etapa 2 (plano, revisado) — PROJTE como produto, Aceex como cliente

**Correção de entendimento importante**: PROJTE é a empresa/produto (a operação do Caio).
Aceex é cliente da PROJTE — não o contrário do que a v1 deste documento assumia. O sistema em
si (marca, produto) se chama PROJTE. Aceex é só mais um registro de cliente que usa uma
instância do PROJTE pra gerenciar os clientes finais dela (WDM, LEA, etc.).

Decisões fechadas nesta rodada:

- **Sem cor dinâmica por cliente hoje.** Um padrão visual único (PROJTE) pra todo mundo.
  Customização de documentos (cores, logo do cliente nos documentos) vira **serviço pago**
  no futuro — não é uma opção de self-service agora.
- **Substituir "Aceex"/"ACEEX" por "PROJTE" em todos os 14 pontos** já mapeados na Etapa 1 —
  é o padrão do sistema, não configuração por tenant.
- **Endereço estruturado** (campos separados), não texto livre — só é relevante pro cadastro
  de clientes do control-plane (ver Etapa 3), não pro produto em si.
- **O cadastro de clientes (nome, CNPJ, logo, endereço, contatos, dados de negociação) não mora
  dentro do produto.** Mora num ambiente separado — ver Etapa 3. Dentro do produto (o app que
  Aceex e futuros clientes usam), a marca é só "PROJTE", fixa, sem tela de configuração de
  identidade.

---

## 1. Ação imediata — trocar Aceex por PROJTE nos 14 pontos

Isso é só substituição de texto/logo, sem schema novo, sem tela nova (já que não é mais
configurável por tenant, é o padrão fixo do produto). Lista confirmada por leitura de fonte na
Etapa 1:

| Arquivo | Hoje | Depois |
|---|---|---|
| `src/pages/EmailSettingsPage.tsx` | logo `aceex_logo.jpg`, assunto "Teste... - Aceex", placeholder "Suporte Aceex" | logo PROJTE, "Teste... - PROJTE", "Suporte PROJTE" |
| `src/pages/ConsultorDashboard.tsx` | logo + `<div class="brand">ACEEX</div>` + "Gerado pelo Sistema ACEEX" | logo PROJTE + "PROJTE" + "Gerado pelo Sistema PROJTE" |
| `src/components/admin/AdminDashboardView.tsx` | logo Aceex | logo PROJTE |
| `src/components/admin/AdminStatusReport.tsx` | logo + "Grupo Aceex · Consultoria & Implantação" | logo PROJTE + texto a definir (ver pergunta abaixo) |
| `src/components/admin/AtividadesCsvWizard.tsx` | comentário de template CSV com "Aceex" | "PROJTE" |
| `src/components/admin/AdminProjetos.tsx` | comentário de template CSV com "Aceex" | "PROJTE" |
| `src/components/consultor/ui/BacklogBoard.tsx` | `wb.creator = "Aceex"` | `wb.creator = "PROJTE"` |
| `supabase/functions/check-alertas/index.ts` | "ACEEX" no header/assunto/rodapé do email | "PROJTE" |
| `supabase/functions/check-overdue-agendas/index.ts` | assinatura "Coordenação de Projetos Aceex" | a definir (ver pergunta abaixo) |
| `supabase/functions/protheus-users/index.ts` | assunto "Novo usuario Aceex" | "Novo usuario PROJTE" |
| `supabase/functions/send-os-email/index.ts` | remetente `"OS Aceex <onboarding@resend.dev>"` | `"OS PROJTE <...>"` (domínio de envio do Resend é conversa à parte — sandbox só manda pro dono da conta até verificar domínio) |
| `src/components/admin/AdminManutencaoAgendas.tsx` | variável/comentário interno | "PROJTE", por consistência |
| `supabase/functions/monday-sync-project/index.ts`, `mock-protheus/index.ts` | "aceex" só em comentário | "PROJTE" ou remover a referência |

**Duas perguntas antes de eu rodar essa troca:**

1. **`AdminStatusReport.tsx`** hoje diz "Grupo Aceex · Consultoria & Implantação" — esse é um
   relatório de status que vai pro **cliente final** (WDM/LEA), então essa frase provavelmente
   deveria continuar identificando quem presta o serviço de consultoria pra eles, que é a
   **Aceex** (o cliente da PROJTE), não a PROJTE. Ou seja, esse ponto pode ser exceção — não
   trocar por PROJTE, e sim deixar como identificação de quem entrega o serviço (hoje Aceex,
   amanhã outro cliente da PROJTE usando o mesmo relatório). Confirma?
2. **Logo**: preciso do arquivo da logo PROJTE (formato/arquivo) pra substituir
   `src/assets/aceex_logo.jpg`. Sem isso trocado, ou removo a imagem (fica só texto "PROJTE")
   até você mandar o arquivo, ou mantenho o arquivo do Aceex por enquanto só nesse ponto
   visual. Qual prefere?

## Status — executado em 2026-08-04

Respostas do Caio: (1) trocar tudo por PROJTE, sem exceção — inclusive `AdminStatusReport.tsx` e
`check-overdue-agendas`; (2) logo enviada (guia de identidade visual PROJTE) — símbolo (triplo
chevron + terminus lima) e wordmark extraídos e recriados como `src/assets/projte_logo.svg`,
substituindo `aceex_logo.jpg` nos 4 pontos que usavam logo. Paleta oficial: navy `#0B1628`, lima
`#39FF87` (`#1DB85A` em fundo claro, usado no SVG por contraste).

Todos os 14 pontos trocados (12 arquivos de texto/branding + 4 usos de logo, alguns arquivos
tinham mais de um ponto). Os 5 edge functions alteradas (`check-alertas`, `check-overdue-agendas`,
`protheus-users`, `send-os-email`, `mock-protheus`) foram redeployadas em produção. 3 comentários
técnicos que descrevem hardcodes históricos específicos do Aceex (`check-alertas`,
`monday-sync-project`, `protheus-users`) foram mantidos como estão — não são branding, são
documentação precisa de bugs já corrigidos nesta mesma sessão.

`aceex_logo.jpg` ficou órfão (sem nenhuma referência restante no código) — não foi removido do
repositório, fica a critério do Caio excluir depois.

## 2. Onde ficam os dados de identidade da Aceex (CNPJ, endereço, contato, negociação)

Esses dados **não vão para dentro do produto**. Vivem no control-plane separado (Etapa 3,
`docs/etapa3-config-projte.md`), que é onde a PROJTE gerencia o cadastro de cada cliente dela.
O produto (o que Aceex usa no dia a dia) não precisa saber o próprio CNPJ — quem precisa saber
isso é a PROJTE, sobre a Aceex.
