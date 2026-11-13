/**
 * Convertisseur de fichiers : documents texte et feuilles de calcul → TXT, HTML, PDF, CSV, Markdown,
 * et import de fichiers externes vers les formats internes de l'application.
 */
import type { CsvSeparator, DocKind, SheetContent } from '../../types';
import { cellKey, colToLetters, CellValue } from '../spreadsheet/formula';
import {
  computeValues,
  createSheet,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  displayText,
  MAX_COLS,
  MAX_ROWS,
  parseSheet,
  usedBounds,
} from '../spreadsheet/sheetModel';
import { parseCsv, toCsv } from './csv';
import { decodeEntities, escapeHtml, htmlToMarkdown, htmlToText, markdownToHtml, sanitizeHtml, textToHtml } from './markup';
import { safeFileName } from '../../utils/format';

export type ExportFormat = 'pdf' | 'html' | 'txt' | 'csv' | 'md';

export interface FormatInfo {
  id: ExportFormat;
  label: string;
  ext: string;
  mime: string;
  icon: string;
  description: string;
}

export const FORMATS: Record<ExportFormat, FormatInfo> = {
  pdf: { id: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf', icon: 'file-pdf-box', description: 'Mise en page figée, idéal pour partager ou imprimer' },
  html: { id: 'html', label: 'HTML', ext: 'html', mime: 'text/html', icon: 'language-html5', description: 'Page web conservant la mise en forme' },
  txt: { id: 'txt', label: 'TXT', ext: 'txt', mime: 'text/plain', icon: 'file-document-outline', description: 'Texte brut, sans mise en forme' },
  csv: { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv', icon: 'file-delimited-outline', description: 'Données tabulaires pour Excel et autres tableurs' },
  md: { id: 'md', label: 'Markdown', ext: 'md', mime: 'text/markdown', icon: 'language-markdown-outline', description: 'Texte structuré léger' },
};

/** Formats proposés, du plus pertinent au moins pertinent, selon le type de document. */
export function formatsFor(kind: DocKind): ExportFormat[] {
  return kind === 'sheet' ? ['csv', 'pdf', 'html', 'txt', 'md'] : ['pdf', 'html', 'txt', 'md', 'csv'];
}

export interface ConversionSource {
  title: string;
  kind: DocKind;
  /** HTML pour un document texte, JSON `SheetContent` pour une feuille. */
  content: string;
}

export interface ConversionResult {
  format: ExportFormat;
  fileName: string;
  mime: string;
  /** Contenu textuel du fichier (ou, pour le PDF, le HTML prêt à imprimer). */
  data: string;
}

export interface ConvertOptions {
  csvSeparator?: CsvSeparator;
}

const DOCUMENT_CSS = `
  @page { margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12pt; line-height: 1.55; color: #1b1c22; margin: 0 auto; padding: 24px; max-width: 820px; word-wrap: break-word; }
  h1 { font-size: 24pt; line-height: 1.2; margin: 0.6em 0 0.4em; }
  h2 { font-size: 18pt; line-height: 1.25; margin: 0.8em 0 0.4em; }
  h3 { font-size: 14pt; margin: 0.9em 0 0.4em; }
  p { margin: 0 0 0.6em; }
  blockquote { margin: 0.8em 0; padding: 0.2em 1em; border-left: 3px solid #b9bdd0; color: #454751; }
  img { max-width: 100%; height: auto; }
  a { color: #2a63d6; }
  hr { border: none; border-top: 1px solid #c6c7d2; margin: 1.2em 0; }
  table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
  th, td { border: 1px solid #c6c7d2; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #eef0f8; font-weight: 600; }
  table.sheet { width: auto; font-size: 10.5pt; }
  table.sheet td { white-space: pre-wrap; min-width: 56px; }
  @media print { body { padding: 0; max-width: none; } }
`;

/** Document HTML autonome (export HTML, impression et rendu PDF). */
export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Feuilles de calcul                                                  */
/* ------------------------------------------------------------------ */

/** Matrice des textes affichés (valeurs calculées et formatées) de la zone utilisée. */
export function sheetToMatrix(sheet: SheetContent, values: Record<string, CellValue> = computeValues(sheet)): string[][] {
  const { rows, cols } = usedBounds(sheet);
  const matrix: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: string[] = [];
    for (let c = 0; c < cols; c++) line.push(displayText(sheet, values, cellKey(r, c)));
    matrix.push(line);
  }
  return matrix;
}

function sheetToCsv(sheet: SheetContent, separator: CsvSeparator): string {
  const values = computeValues(sheet);
  const { rows, cols } = usedBounds(sheet);
  const matrix: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: string[] = [];
    for (let c = 0; c < cols; c++) {
      const key = cellKey(r, c);
      const v = values[key];
      // Les nombres sont exportés bruts (sans séparateur de milliers ni symbole) pour rester exploitables.
      if (typeof v === 'number') line.push(separator === ';' ? String(v).replace('.', ',') : String(v));
      else line.push(displayText(sheet, values, key));
    }
    matrix.push(line);
  }
  return toCsv(matrix, separator);
}

export function sheetToHtmlTable(sheet: SheetContent): string {
  const values = computeValues(sheet);
  const { rows, cols } = usedBounds(sheet);
  if (rows === 0) return '<p><i>Feuille vide</i></p>';
  let html = '<table class="sheet">';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const key = cellKey(r, c);
      const cell = sheet.cells[key];
      const style = cell?.s;
      const css: string[] = [];
      const align = style?.align ?? (typeof values[key] === 'number' ? 'right' : undefined);
      if (align) css.push(`text-align:${align}`);
      if (style?.bold) css.push('font-weight:700');
      if (style?.italic) css.push('font-style:italic');
      if (style?.underline) css.push('text-decoration:underline');
      if (style?.color) css.push(`color:${style.color}`);
      if (style?.bg) css.push(`background:${style.bg}`);
      html += `<td${css.length ? ` style="${css.join(';')}"` : ''}>${escapeHtml(displayText(sheet, values, key))}</td>`;
    }
    html += '</tr>';
  }
  return `${html}</table>`;
}

function matrixToMarkdown(matrix: string[][]): string {
  if (matrix.length === 0) return '';
  const width = Math.max(...matrix.map((r) => r.length));
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => esc(cells[i] ?? '')).join(' | ')} |`;
  return [line(matrix[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...matrix.slice(1).map(line)].join('\n');
}

/** Remplit une feuille à partir d'une matrice de textes. */
export function matrixToSheet(matrix: string[][]): SheetContent {
  const rows = Math.min(MAX_ROWS, matrix.length);
  const cols = Math.min(MAX_COLS, matrix.reduce((max, row) => Math.max(max, row.length), 0));
  const sheet = createSheet(Math.max(DEFAULT_ROWS, rows + 10), Math.max(DEFAULT_COLS, cols + 2));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < Math.min(cols, matrix[r].length); c++) {
      const v = matrix[r][c];
      // Une valeur importée commençant par « = » reste du texte : pas d'exécution de formule inattendue.
      if (v !== '') sheet.cells[cellKey(r, c)] = { v: v.startsWith('=') ? `'${v}` : v };
    }
  }
  return sheet;
}

/* ------------------------------------------------------------------ */
/* Documents texte                                                     */
/* ------------------------------------------------------------------ */

/** Document → lignes CSV : premier tableau du document s'il existe, sinon une ligne par paragraphe. */
function htmlToMatrix(html: string): string[][] {
  const table = /<table\b[\s\S]*?<\/table\s*>/i.exec(html);
  if (table) {
    return [...table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map((row) =>
      [...row[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map((cell) =>
        decodeEntities(cell[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim(),
      ),
    );
  }
  return htmlToText(html)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => [line]);
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function convert(source: ConversionSource, format: ExportFormat, options: ConvertOptions = {}): ConversionResult {
  const info = FORMATS[format];
  const separator = options.csvSeparator ?? ';';
  let data: string;

  if (source.kind === 'sheet') {
    const sheet = parseSheet(source.content);
    switch (format) {
      case 'csv':
        data = sheetToCsv(sheet, separator);
        break;
      case 'txt':
        data = sheetToMatrix(sheet).map((row) => row.join('\t')).join('\n');
        break;
      case 'md':
        data = `# ${source.title}\n\n${matrixToMarkdown(sheetToMatrix(sheet))}\n`;
        break;
      default:
        data = wrapHtmlDocument(source.title, `<h2>${escapeHtml(source.title)}</h2>${sheetToHtmlTable(sheet)}`);
    }
  } else {
    switch (format) {
      case 'txt':
        data = htmlToText(source.content);
        break;
      case 'md':
        data = `${htmlToMarkdown(source.content)}\n`;
        break;
      case 'csv':
        data = toCsv(htmlToMatrix(source.content), separator);
        break;
      default:
        data = wrapHtmlDocument(source.title, source.content);
    }
  }

  return { format, fileName: `${safeFileName(source.title)}.${info.ext}`, mime: info.mime, data };
}

export const IMPORT_EXTENSIONS = ['txt', 'md', 'markdown', 'html', 'htm', 'csv', 'tsv'] as const;

export const IMPORT_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
  'text/comma-separated-values',
  'text/tab-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
  'text/*',
];

/** Convertit un fichier externe (texte) en document de l'application. */
export function importFile(fileName: string, text: string): ConversionSource {
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  const title = (dot > 0 ? fileName.slice(0, dot) : fileName).trim() || 'Document importé';
  const clean = text.replace(/^﻿/, '');
  switch (ext) {
    case 'csv':
      return { title, kind: 'sheet', content: JSON.stringify(matrixToSheet(parseCsv(clean))) };
    case 'tsv':
      return { title, kind: 'sheet', content: JSON.stringify(matrixToSheet(parseCsv(clean, '\t'))) };
    case 'html':
    case 'htm':
      return { title, kind: 'text', content: sanitizeHtml(clean) };
    case 'md':
    case 'markdown':
      return { title, kind: 'text', content: markdownToHtml(clean) };
    default:
      return { title, kind: 'text', content: textToHtml(clean) };
  }
}

export function isImportable(fileName: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return (IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}

export { colToLetters };
