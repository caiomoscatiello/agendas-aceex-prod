import { sanitizeToPureHtml5 } from "./emailHtmlSanitizer.ts";

// =============================================================================
// buildExpenseEmailHtml.ts
// Outlook-compatible HTML email for monthly expense closing.
// Uses TABLE layout + inline styles only (no flexbox/grid/CSS vars).
// =============================================================================

export interface Despesa {
  data: string;
  cliente: string;
  descricao: string;
  valor: number;
}

export interface EmailPayload {
  nomeUsuario: string;
  emailResponsavel: string;
  emailUsuario: string;
  dataFechamento: string;
  despesas: Despesa[];
}

const MESES_PT: Record<number, string> = {
  0:'Janeiro',1:'Fevereiro',2:'Março',3:'Abril',
  4:'Maio',5:'Junho',6:'Julho',7:'Agosto',
  8:'Setembro',9:'Outubro',10:'Novembro',11:'Dezembro',
};
const MESES_ABREV: Record<number, string> = {
  0:'Jan',1:'Fev',2:'Mar',3:'Abr',
  4:'Mai',5:'Jun',6:'Jul',7:'Ago',
  8:'Set',9:'Out',10:'Nov',11:'Dez',
};

function parseDate(iso: string): Date { return new Date(iso); }

function formatDateBR(iso: string): string {
  const d = parseDate(iso);
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function formatMesAno(iso: string) {
  const d = parseDate(iso);
  return { mes: MESES_PT[d.getUTCMonth()], mesAbrev: MESES_ABREV[d.getUTCMonth()], ano: d.getUTCFullYear() };
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,'_').toLowerCase();
}

const PROJECT_COLORS = ['#16213e','#0f3460','#533483','#1a6b45','#7d3c00'];

interface ClienteGroup { cliente:string; despesas:Despesa[]; total:number; color:string; }

function groupByCliente(despesas: Despesa[]): ClienteGroup[] {
  const map = new Map<string, Despesa[]>();
  const sorted = [...despesas].sort((a,b) => parseDate(a.data).getTime()-parseDate(b.data).getTime());
  for (const d of sorted) {
    if (!map.has(d.cliente)) map.set(d.cliente,[]);
    map.get(d.cliente)!.push(d);
  }
  let idx = 0;
  const groups: ClienteGroup[] = [];
  for (const [cliente, items] of map.entries()) {
    groups.push({ cliente, despesas: items, total: items.reduce((s,d)=>s+d.valor,0), color: PROJECT_COLORS[idx++ % PROJECT_COLORS.length] });
  }
  return groups;
}

export function buildZipFileName(cliente: string, nomeUsuario: string, dataFechamento: string): string {
  const { mesAbrev, ano } = formatMesAno(dataFechamento);
  return `${slugify(cliente)}_${slugify(nomeUsuario)}_${mesAbrev}${ano}.zip`;
}

// ---------------------------------------------------------------------------
// Inline style constants
// ---------------------------------------------------------------------------
const C = {
  ink: '#1a1a2e',
  paper: '#f7f5f0',
  rule: '#d6d0c4',
  accent: '#c0392b',
  accentLight: '#fdf0ee',
  muted: '#6b6560',
  metaBg: '#f0ede6',
  subtotalBg: '#edeae2',
  footerBg: '#f5f3ed',
  totalHighlight: '#f0e68c',
  bgOuter: '#e8e5de',
  darkBlock: '#1a1a2e',
};

const FONT_SERIF = "'DM Serif Display', Georgia, serif";
const FONT_SANS = "'DM Sans', Arial, sans-serif";
const FONT_MONO = "'DM Mono', 'Courier New', monospace";

// ---------------------------------------------------------------------------
// Section renderers (all table-based, inline styles)
// ---------------------------------------------------------------------------

function renderTopBar(): string {
  return `<tr><td style="height:5px;background:${C.accent};font-size:1px;line-height:1px;" bgcolor="${C.accent}">&nbsp;</td></tr>`;
}

function renderHeader(mes: string, ano: number): string {
  return `<tr><td style="padding:32px 48px 24px 48px;border-bottom:1px solid ${C.rule};">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:top;">
  <div style="font-family:${FONT_SERIF};font-size:22px;letter-spacing:-0.5px;color:${C.ink};">Fechamento de Despesas</div>
  <div style="font-family:${FONT_SANS};font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-top:2px;">Gest&atilde;o de Projetos &amp; Consultoria</div>
</td>
<td style="vertical-align:top;text-align:right;">
  <div style="font-family:${FONT_SERIF};font-size:28px;color:${C.accent};line-height:1;">${mes}</div>
  <div style="font-family:${FONT_SANS};font-size:12px;color:${C.muted};letter-spacing:1px;margin-top:2px;">${ano}</div>
</td>
</tr></table>
</td></tr>`;
}

function renderMetaRow(label: string, value: string): string {
  return `<tr><td style="padding:3px 0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="68" style="font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${C.muted};vertical-align:top;padding-top:1px;">${label}</td>
<td style="font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${C.ink};">${value}</td>
</tr></table>
</td></tr>`;
}

function renderMeta(emailResponsavel: string, emailUsuario: string, mes: string, nomeUsuario: string, dataFormatada: string): string {
  return `<tr><td style="padding:20px 48px;background:${C.metaBg};border-bottom:1px solid ${C.rule};" bgcolor="${C.metaBg}">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
${renderMetaRow('Para', emailResponsavel)}
${renderMetaRow('C&oacute;pia', emailUsuario)}
${renderMetaRow('Assunto', `Despesas ${mes} &mdash; ${nomeUsuario}`)}
${renderMetaRow('Data', `${dataFormatada} &mdash; Fechamento mensal autom&aacute;tico`)}
</table>
</td></tr>`;
}

function renderIntro(nomeUsuario: string, mes: string, dataFormatada: string): string {
  return `<tr><td style="padding:0 0 40px 0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="3" style="background:${C.accent};" bgcolor="${C.accent}"></td>
<td style="padding:20px 24px;background:${C.accentLight};font-family:${FONT_SANS};font-size:15px;line-height:1.75;color:${C.ink};" bgcolor="${C.accentLight}">
Segue fechamento de despesas do usu&aacute;rio <strong>${nomeUsuario}</strong>
referente ao m&ecirc;s <strong>${mes}</strong> atrav&eacute;s de fechamento mensal
realizado na data <strong>${dataFormatada}</strong>.
</td>
</tr></table>
</td></tr>`;
}

function renderClienteSection(group: ClienteGroup): string {
  // Header row with dot + title + tag
  const headerHtml = `<tr><td style="padding:0 0 40px 0;">
<!-- Project header -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:2px solid ${C.rule};padding-bottom:12px;margin-bottom:16px;">
<tr><td style="padding-bottom:12px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="22" style="vertical-align:middle;">
  <div style="width:10px;height:10px;border-radius:50%;background:${group.color};">&nbsp;</div>
</td>
<td style="vertical-align:middle;font-family:${FONT_SERIF};font-size:18px;letter-spacing:-0.3px;color:${C.ink};">${group.cliente}</td>
<td style="vertical-align:middle;text-align:right;">
  <span style="font-family:${FONT_SANS};font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${group.color};padding:3px 10px;border:1px solid ${group.color};">${group.despesas.length} lan&ccedil;amento${group.despesas.length!==1?'s':''}</span>
</td>
</tr></table>
</td></tr></table>

<!-- Data table -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT_SANS};font-size:13px;">
<tr>
<td style="padding:10px 14px;background:${group.color};color:#ffffff;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;font-family:${FONT_SANS};" bgcolor="${group.color}">Data</td>
<td style="padding:10px 14px;background:${group.color};color:#ffffff;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;font-family:${FONT_SANS};" bgcolor="${group.color}">Cliente</td>
<td style="padding:10px 14px;background:${group.color};color:#ffffff;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;font-family:${FONT_SANS};" bgcolor="${group.color}">Despesa</td>
<td style="padding:10px 14px;background:${group.color};color:#ffffff;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;font-family:${FONT_SANS};text-align:right;" bgcolor="${group.color}">Valor</td>
</tr>
${group.despesas.map(d => `<tr style="border-bottom:1px solid ${C.rule};">
<td style="padding:9px 14px;font-family:${FONT_MONO};font-size:12px;color:${C.muted};border-bottom:1px solid ${C.rule};">${formatDateBR(d.data)}</td>
<td style="padding:9px 14px;color:${C.ink};font-family:${FONT_SANS};border-bottom:1px solid ${C.rule};">${d.cliente}</td>
<td style="padding:9px 14px;color:${C.ink};font-family:${FONT_SANS};border-bottom:1px solid ${C.rule};">${d.descricao}</td>
<td style="padding:9px 14px;text-align:right;font-family:${FONT_MONO};font-size:13px;color:${C.ink};border-bottom:1px solid ${C.rule};">${formatBRL(d.valor)}</td>
</tr>`).join('')}
<tr>
<td colspan="3" style="padding:11px 14px;background:${C.subtotalBg};border-top:2px solid ${C.rule};font-family:${FONT_SANS};font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:${C.muted};font-weight:600;" bgcolor="${C.subtotalBg}">Total &middot; ${group.cliente}</td>
<td style="padding:11px 14px;background:${C.subtotalBg};border-top:2px solid ${C.rule};text-align:right;font-family:${FONT_MONO};font-size:14px;font-weight:600;color:${C.ink};" bgcolor="${C.subtotalBg}">${formatBRL(group.total)}</td>
</tr>
</table>
</td></tr>`;
  return headerHtml;
}

function renderProjectSummary(groups: ClienteGroup[]): string {
  const cells = groups.map(g => `<td style="padding:16px 20px;border:1px solid ${C.rule};background:#ffffff;vertical-align:top;font-family:${FONT_SANS};" bgcolor="#ffffff">
<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:4px;">
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color};vertical-align:middle;margin-right:6px;">&nbsp;</span>${g.cliente}
</div>
<div style="font-family:${FONT_MONO};font-size:18px;font-weight:500;color:${C.ink};">${formatBRL(g.total)}</div>
<div style="font-size:11px;color:${C.muted};margin-top:2px;">${g.despesas.length} despesa${g.despesas.length!==1?'s':''}</div>
</td>`).join('');

  return `<tr><td style="padding:20px 0 0 0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
</td></tr>`;
}

function renderTotalGeral(nomeUsuario: string, totalDespesas: number, groupCount: number, mes: string, ano: number, totalGeral: number, dataFormatada: string): string {
  return `<tr><td style="padding:44px 0 0 0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.darkBlock}">
<tr>
<td style="padding:28px 32px;background:${C.darkBlock};vertical-align:middle;" bgcolor="${C.darkBlock}">
  <div style="font-family:${FONT_SERIF};font-size:20px;font-style:italic;color:#ffffff;opacity:0.8;">Total Geral &mdash; ${nomeUsuario}</div>
  <div style="font-family:${FONT_SANS};font-size:12px;color:#ffffff;opacity:0.4;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">${totalDespesas} despesa${totalDespesas!==1?'s':''} &middot; ${groupCount} cliente${groupCount!==1?'s':''} &middot; ${mes} ${ano}</div>
</td>
<td style="padding:28px 32px;background:${C.darkBlock};text-align:right;vertical-align:middle;" bgcolor="${C.darkBlock}">
  <div style="font-family:${FONT_MONO};font-size:32px;font-weight:500;letter-spacing:-1px;color:${C.totalHighlight};">${formatBRL(totalGeral)}</div>
  <div style="font-family:${FONT_SANS};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;opacity:0.5;margin-top:3px;">Fechado em ${dataFormatada}</div>
</td>
</tr></table>
</td></tr>`;
}

function renderAnexos(groups: ClienteGroup[], nomeUsuario: string, dataFechamento: string): string {
  const pills = groups.map(g => `<span style="display:inline-block;background:${C.subtotalBg};border:1px solid ${C.rule};padding:3px 8px;font-family:${FONT_MONO};font-size:10px;margin:2px;color:${C.ink};">&#128451; ${buildZipFileName(g.cliente, nomeUsuario, dataFechamento)}</span>`).join(' ');

  return `<tr><td style="padding:12px 48px;border-top:1px solid ${C.rule};background:${C.footerBg};" bgcolor="${C.footerBg}">
<span style="font-family:${FONT_SANS};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-right:6px;">Anexos</span>
${pills}
</td></tr>`;
}

function renderFooter(dataFormatada: string, emailUsuario: string): string {
  return `<tr><td style="padding:18px 48px;border-top:1px solid ${C.rule};">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${FONT_SANS};font-size:11px;color:${C.muted};">Gerado automaticamente pelo sistema de fechamento mensal &middot; ${dataFormatada}</td>
<td style="font-family:${FONT_SANS};font-size:11px;color:${C.muted};text-align:right;">${emailUsuario}</td>
</tr></table>
</td></tr>`;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildExpenseEmailHtml(payload: EmailPayload): string {
  const { nomeUsuario, emailResponsavel, emailUsuario, dataFechamento, despesas } = payload;
  const { mes, ano } = formatMesAno(dataFechamento);
  const dataFormatada = formatDateBR(dataFechamento);
  const groups = groupByCliente(despesas);
  const totalGeral = groups.reduce((s,g)=>s+g.total,0);
  const totalDespesas = despesas.length;

  const rawHtml = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Despesas ${mes} &mdash; ${nomeUsuario}</title>
<!--[if mso]>
<style type="text/css">
table {border-collapse: collapse;}
td {font-family: Arial, sans-serif;}
</style>
<![endif]-->
<style type="text/css">
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
</style>
</head>
<body style="margin:0;padding:32px 16px;background:${C.bgOuter};font-family:${FONT_SANS};color:${C.ink};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" bgcolor="${C.bgOuter}">

<!--[if mso]>
<table role="presentation" width="620" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;margin:0 auto;">
<tr><td>

<!-- Envelope -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};border:1px solid ${C.rule};" bgcolor="${C.paper}">

${renderTopBar()}
${renderHeader(mes, ano)}
${renderMeta(emailResponsavel, emailUsuario, mes, nomeUsuario, dataFormatada)}

<!-- Body -->
<tr><td style="padding:40px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${renderIntro(nomeUsuario, mes, dataFormatada)}
${groups.map(renderClienteSection).join('')}
${renderProjectSummary(groups)}
${renderTotalGeral(nomeUsuario, totalDespesas, groups.length, mes, ano, totalGeral, dataFormatada)}
</table>
</td></tr>

${renderAnexos(groups, nomeUsuario, dataFechamento)}
${renderFooter(dataFormatada, emailUsuario)}

</table>
<!-- /Envelope -->

</td></tr>
</table>

<!--[if mso]>
</td></tr></table>
<![endif]-->

</body>
</html>`;

  return sanitizeToPureHtml5(rawHtml);
}
