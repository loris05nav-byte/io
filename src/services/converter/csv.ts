/**
 * Lecture et écriture CSV (RFC 4180, séparateur configurable).
 */

/** Devine le séparateur d'un CSV à partir de sa première ligne (hors guillemets). */
export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0, '|': 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  let best = ',';
  let max = 0;
  for (const sep of [';', ',', '\t', '|']) {
    if (counts[sep] > max) {
      max = counts[sep];
      best = sep;
    }
  }
  return best;
}

export function parseCsv(input: string, separator: string = detectSeparator(input)): string[][] {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: string[][], separator: string = ','): string {
  const escape = (value: string) =>
    value.includes('"') || value.includes(separator) || /[\r\n]/.test(value) || /^\s|\s$/.test(value)
      ? `"${value.replace(/"/g, '""')}"`
      : value;
  return rows.map((row) => row.map(escape).join(separator)).join('\r\n');
}
