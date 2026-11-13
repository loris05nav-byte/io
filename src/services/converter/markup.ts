/**
 * Conversions de balisage sans DOM (compatibles Hermes) : HTML ⇄ texte brut ⇄ Markdown.
 */

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  ugrave: 'ù',
  ocirc: 'ô',
  icirc: 'î',
  euro: '€',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  deg: '°',
  copy: '©',
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function stripNonContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, '');
}

/** Extrait le contenu de <body> d'un document HTML complet (ou renvoie le fragment tel quel). */
export function extractBody(html: string): string {
  const m = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html);
  return stripNonContent(m ? m[1] : html).trim();
}

/** Retire scripts, gestionnaires d'événements et URL javascript: d'un HTML importé. */
export function sanitizeHtml(html: string): string {
  return extractBody(html)
    .replace(/<(iframe|object|embed|link|meta|form|input|button)\b[^>]*>/gi, '')
    .replace(/<\/(iframe|object|embed|form|button)\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

const collapseBlankLines = (text: string) =>
  text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** HTML → texte brut lisible (paragraphes, listes à puces, tableaux tabulés). */
export function htmlToText(html: string): string {
  let listCounters: number[] = [];
  const text = stripNonContent(html)
    .replace(/\r?\n/g, ' ')
    .replace(/<(ol|ul)\b[^>]*>|<\/(ol|ul)\s*>|<li\b[^>]*>/gi, (tag) => {
      const lower = tag.toLowerCase();
      if (lower.startsWith('<ol')) {
        listCounters.push(1);
        return '\n';
      }
      if (lower.startsWith('<ul')) {
        listCounters.push(0);
        return '\n';
      }
      if (lower.startsWith('</')) {
        listCounters.pop();
        return '\n';
      }
      const depth = Math.max(0, listCounters.length - 1);
      const top = listCounters.length - 1;
      const marker = top >= 0 && listCounters[top] > 0 ? `${listCounters[top]++}. ` : '• ';
      return `\n${'  '.repeat(depth)}${marker}`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\b[^>]*>/gi, '\n――――――――――\n')
    .replace(/<\/(td|th)\s*>/gi, '\t')
    .replace(/<\/tr\s*>/gi, '\n')
    .replace(/<\/li\s*>/gi, '')
    .replace(/<\/(p|div|h[1-6]|blockquote|pre|table)\s*>/gi, '\n')
    .replace(/<(p|h[1-6]|blockquote|pre|table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  listCounters = [];
  return collapseBlankLines(
    decodeEntities(text)
      .replace(/\t+\n/g, '\n')
      .replace(/[  ]{2,}/g, ' ')
      .replace(/\n /g, '\n'),
  );
}

/** Texte brut → HTML (un paragraphe par ligne). */
export function textToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return lines.map((line) => (line.trim() === '' ? '<p><br></p>' : `<p>${escapeHtml(line)}</p>`)).join('');
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

function inlineToMarkdown(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '  \n')
      .replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_m, _t, inner: string) => (inner.trim() ? `**${inner.trim()}**` : ''))
      .replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_m, _t, inner: string) => (inner.trim() ? `*${inner.trim()}*` : ''))
      .replace(/<(s|strike|del)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_m, _t, inner: string) => (inner.trim() ? `~~${inner.trim()}~~` : ''))
      .replace(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, '[$2]($1)')
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ''),
  ).replace(/[  ]+/g, ' ');
}

function tableToMarkdown(table: string): string {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map((row) =>
    [...row[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map((cell) =>
      inlineToMarkdown(cell[2]).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim(),
    ),
  );
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  return [line(rows[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

/** HTML → Markdown (titres, gras/italique, listes, liens, tableaux, citations). */
export function htmlToMarkdown(html: string): string {
  const tables: string[] = [];
  let src = stripNonContent(html)
    .replace(/\r?\n/g, ' ')
    .replace(/<table\b[\s\S]*?<\/table\s*>/gi, (table) => {
      tables.push(tableToMarkdown(table));
      return `\n\n@@TABLE${tables.length - 1}@@\n\n`;
    });

  const stack: number[] = [];
  src = src.replace(/<(ol|ul)\b[^>]*>|<\/(ol|ul)\s*>|<li\b[^>]*>|<\/li\s*>/gi, (tag) => {
    const lower = tag.toLowerCase();
    if (lower.startsWith('<ol')) {
      stack.push(1);
      return '\n';
    }
    if (lower.startsWith('<ul')) {
      stack.push(0);
      return '\n';
    }
    if (lower.startsWith('</li')) return '';
    if (lower.startsWith('</')) {
      stack.pop();
      return '\n\n';
    }
    const top = stack.length - 1;
    const marker = top >= 0 && stack[top] > 0 ? `${stack[top]++}. ` : '- ';
    return `\n${'  '.repeat(Math.max(0, top))}${marker}`;
  });

  src = src
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_m, level: string, inner: string) => `\n\n${'#'.repeat(Number(level))} ${inlineToMarkdown(inner).trim()}\n\n`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote\s*>/gi, (_m, inner: string) => `\n\n> ${inlineToMarkdown(inner).trim()}\n\n`)
    .replace(/<hr\b[^>]*>/gi, '\n\n---\n\n')
    .replace(/<\/(p|div)\s*>/gi, '\n\n')
    .replace(/<(p|div)\b[^>]*>/gi, '\n\n');

  const text = inlineToMarkdown(src)
    .replace(/@@TABLE(\d+)@@/g, (_m, i: string) => tables[Number(i)])
    .replace(/\n /g, '\n');
  return collapseBlankLines(text);
}

function inlineFromMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_]+)__/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) =>
      /^(https?:|mailto:|#)/i.test(url) ? `<a href="${url}">${label}</a>` : label,
    );
}

/** Markdown → HTML (sous-ensemble courant : titres, listes, citations, tableaux, emphase). */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inlineFromMarkdown).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((item) => `<li>${inlineFromMarkdown(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (line.trim() === '') {
      flush();
    } else if (heading) {
      flush();
      out.push(`<h${heading[1].length}>${inlineFromMarkdown(heading[2].replace(/\s+#+\s*$/, ''))}</h${heading[1].length}>`);
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      out.push('<hr>');
    } else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flush();
      const split = (row: string) =>
        row
          .trim()
          .replace(/\\\|/g, '\u0001')
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => inlineFromMarkdown(c.trim().replace(/\u0001/g, '|')));
      const head = split(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(split(lines[i++]));
      i--;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body
          .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
    } else if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((bullet ?? ordered)![1]);
    } else if (/^>\s?/.test(line)) {
      flush();
      out.push(`<blockquote>${inlineFromMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flush();
  return out.join('');
}

/** Statistiques simples d'un texte. */
export function countWords(text: string): number {
  const m = text.trim().match(/[^\s]+/g);
  return m ? m.length : 0;
}
