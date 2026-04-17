export const WORD_HTML_FORBIDDEN_PATTERNS: RegExp[] = [
  /xmlns:(?:v|o|w|m)\s*=\s*['"][^'"]*['"]/gi,
  /<meta[^>]+name\s*=\s*['"](?:ProgId|Generator|Originator)['"][^>]*>/gi,
  /Word\.Document/gi,
  /<!--\s*\[if\s+gte\s+mso\s+\d+\][\s\S]*?<!\[endif\]\s*-->/gi,
  /mso-[a-z-]+\s*:[^;"}]+;?/gi,
  /<\/?(?:o|w|m|v):[a-z0-9_-]+[^>]*>/gi,
];

export function sanitizeToPureHtml5(inputHtml: string): string {
  let html = (inputHtml ?? "").replace(/^\uFEFF/, "").trimStart();

  for (const pattern of WORD_HTML_FORBIDDEN_PATTERNS) {
    html = html.replace(pattern, "");
  }

  if (!/^<!DOCTYPE html>/i.test(html)) {
    html = `<!DOCTYPE html>\n${html}`;
  }

  return html;
}

export function assertPureHtml5(html: string): void {
  for (const pattern of WORD_HTML_FORBIDDEN_PATTERNS) {
    if (pattern.test(html)) {
      throw new Error("HTML de e-mail inválido: detectado artefato de Word/Office no conteúdo.");
    }
    pattern.lastIndex = 0;
  }

  if (!/^<!DOCTYPE html>/i.test(html.trimStart())) {
    throw new Error("HTML de e-mail inválido: saída deve iniciar com <!DOCTYPE html>.");
  }
}
