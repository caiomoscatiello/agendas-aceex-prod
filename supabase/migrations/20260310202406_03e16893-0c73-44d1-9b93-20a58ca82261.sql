
UPDATE public.email_workflows SET corpo_email = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#333">Ordem de Serviço</h2>
  <p><strong>Cliente:</strong> {{cliente}}</p>
  <p><strong>Data:</strong> {{data}}</p>
  <p><strong>Modalidade:</strong> {{modalidade}}</p>
  
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd">Atividade</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd">Horas</th>
      </tr>
    </thead>
    <tbody>
      {{atividades}}
      {{deslocamento}}
      <tr style="font-weight:bold;background:#f9f9f9">
        <td style="padding:8px">Total</td>
        <td style="padding:8px;text-align:right">{{total_horas}}h</td>
      </tr>
    </tbody>
  </table>
  
  {{descricao}}
</div>' WHERE codigo = 'send-os-email';

UPDATE public.email_workflows SET corpo_email = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <p>Olá <strong>{{nome_consultor}}</strong>,</p>
  <p>Notamos que os seguintes apontamentos estão em atraso. Favor realizar o devido apontamento do atendimento ou solicite o cancelamento da agenda.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Data</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Cliente</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Atividade</th>
      </tr>
    </thead>
    <tbody>{{agendas_rows}}</tbody>
  </table>
  <p>Dentro de <strong>{{dias_limite}} dias</strong>, o apontamento será automaticamente excluído por falta.</p>
  <br/>
  <p>Obrigado,</p>
  <p><strong>Coordenação de Projetos Aceex</strong></p>
</div>' WHERE codigo = 'check-overdue-agendas';

UPDATE public.email_workflows SET corpo_email = 'O template de fechamento de despesas é gerado automaticamente pelo sistema com layout editorial completo, incluindo:

• Cabeçalho com mês/ano de referência
• Dados do destinatário, cópia e assunto
• Introdução com nome do usuário e data de fechamento
• Tabela detalhada de despesas agrupadas por cliente (data, descrição, valor)
• Subtotais por cliente e total geral
• Lista de anexos ZIP com comprovantes

As variáveis são preenchidas automaticamente: {{nome_usuario}}, {{mes}}, {{ano}}, {{despesas}}, {{total_geral}}' WHERE codigo = 'monthly-expenses-scheduler';

UPDATE public.email_workflows SET corpo_email = 'Este workflow é utilizado para envio de e-mails genéricos do sistema.

O corpo do e-mail é definido diretamente na chamada da função, através do campo "body" no payload da requisição.

Variáveis disponíveis: {{to}}, {{subject}}, {{body}}' WHERE codigo = 'send-email';
