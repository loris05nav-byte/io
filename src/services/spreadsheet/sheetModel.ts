/**
 * Opérations immuables sur une feuille de calcul : saisie, styles, lignes/colonnes, affichage.
 */
import type { Cell, CellFormat, CellStyle, SheetContent } from '../../types';
import {
  adjustFormula,
  cellKey,
  CellValue,
  computeSheet,
  formatNumber,
  isErrorCode,
  isFormula,
  parseKey,
  parseLiteral,
  StructuralChange,
} from './formula';

export const DEFAULT_ROWS = 60;
export const DEFAULT_COLS = 12;
export const MAX_ROWS = 500;
export const MAX_COLS = 52;
export const DEFAULT_COL_WIDTH = 96;
export const MIN_COL_WIDTH = 56;
export const MAX_COL_WIDTH = 280;

export interface Selection {
  /** Cellule active (ancre). */
  row: number;
  col: number;
  /** Coin opposé de la plage sélectionnée. */
  endRow: number;
  endCol: number;
}

export interface Bounds {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export function createSheet(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SheetContent {
  return { rows, cols, cells: {} };
}

export function parseSheet(json: string | null): SheetContent {
  if (!json) return createSheet();
  try {
    const data = JSON.parse(json) as Partial<SheetContent>;
    return {
      rows: Math.max(1, Math.min(MAX_ROWS, data.rows ?? DEFAULT_ROWS)),
      cols: Math.max(1, Math.min(MAX_COLS, data.cols ?? DEFAULT_COLS)),
      cells: data.cells ?? {},
      colWidths: data.colWidths,
    };
  } catch {
    return createSheet();
  }
}

export const selectionBounds = (s: Selection): Bounds => ({
  r1: Math.min(s.row, s.endRow),
  r2: Math.max(s.row, s.endRow),
  c1: Math.min(s.col, s.endCol),
  c2: Math.max(s.col, s.endCol),
});

export const isMultiSelection = (s: Selection) => s.row !== s.endRow || s.col !== s.endCol;

export function colWidth(sheet: SheetContent, col: number): number {
  return sheet.colWidths?.[col] ?? DEFAULT_COL_WIDTH;
}

/** Décalages cumulés des colonnes : offsets[c] = position x de la colonne c ; dernier élément = largeur totale. */
export function colOffsets(sheet: SheetContent): number[] {
  const offsets = [0];
  for (let c = 0; c < sheet.cols; c++) offsets.push(offsets[c] + colWidth(sheet, c));
  return offsets;
}

function cleanCell(cell: Cell): Cell | null {
  const style = cell.s ? Object.fromEntries(Object.entries(cell.s).filter(([, v]) => v !== undefined && v !== false)) : {};
  const hasStyle = Object.keys(style).length > 0;
  if (cell.v === '' && !hasStyle) return null;
  return hasStyle ? { v: cell.v, s: style as CellStyle } : { v: cell.v };
}

export function setCellValue(sheet: SheetContent, row: number, col: number, value: string): SheetContent {
  const key = cellKey(row, col);
  const prev = sheet.cells[key];
  if ((prev?.v ?? '') === value) return sheet;
  const cells = { ...sheet.cells };
  const next = cleanCell({ v: value, s: prev?.s });
  if (next) cells[key] = next;
  else delete cells[key];
  return { ...sheet, cells };
}

/** Applique un style partiel à toutes les cellules d'une plage. */
export function applyStyle(sheet: SheetContent, bounds: Bounds, patch: Partial<CellStyle>): SheetContent {
  const cells = { ...sheet.cells };
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const key = cellKey(r, c);
      const prev = cells[key];
      const next = cleanCell({ v: prev?.v ?? '', s: { ...prev?.s, ...patch } });
      if (next) cells[key] = next;
      else delete cells[key];
    }
  }
  return { ...sheet, cells };
}

export function clearRange(sheet: SheetContent, bounds: Bounds): SheetContent {
  const cells = { ...sheet.cells };
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const key = cellKey(r, c);
      const prev = cells[key];
      if (!prev) continue;
      const next = cleanCell({ v: '', s: prev.s });
      if (next) cells[key] = next;
      else delete cells[key];
    }
  }
  return { ...sheet, cells };
}

function restructure(sheet: SheetContent, change: StructuralChange): SheetContent {
  const cells: Record<string, Cell> = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const pos = parseKey(key);
    if (!pos) continue;
    let { row, col } = pos;
    const at = change.axis === 'row' ? row : col;
    if (change.delta === -1 && at === change.index) continue;
    if (at >= change.index) {
      if (change.axis === 'row') row += change.delta;
      else col += change.delta;
    }
    cells[cellKey(row, col)] = isFormula(cell.v) ? { ...cell, v: adjustFormula(cell.v, change) } : cell;
  }

  let colWidths = sheet.colWidths;
  if (change.axis === 'col' && colWidths) {
    colWidths = {};
    for (const [k, w] of Object.entries(sheet.colWidths!)) {
      const c = Number(k);
      if (change.delta === -1 && c === change.index) continue;
      colWidths[c >= change.index ? c + change.delta : c] = w;
    }
  }

  return {
    rows: change.axis === 'row' ? Math.max(1, Math.min(MAX_ROWS, sheet.rows + change.delta)) : sheet.rows,
    cols: change.axis === 'col' ? Math.max(1, Math.min(MAX_COLS, sheet.cols + change.delta)) : sheet.cols,
    cells,
    colWidths,
  };
}

export const insertRow = (sheet: SheetContent, index: number) =>
  sheet.rows >= MAX_ROWS ? sheet : restructure(sheet, { axis: 'row', index, delta: 1 });

export const deleteRow = (sheet: SheetContent, index: number) =>
  sheet.rows <= 1 ? clearRange(sheet, { r1: index, r2: index, c1: 0, c2: sheet.cols - 1 }) : restructure(sheet, { axis: 'row', index, delta: -1 });

export const insertCol = (sheet: SheetContent, index: number) =>
  sheet.cols >= MAX_COLS ? sheet : restructure(sheet, { axis: 'col', index, delta: 1 });

export const deleteCol = (sheet: SheetContent, index: number) =>
  sheet.cols <= 1 ? clearRange(sheet, { r1: 0, r2: sheet.rows - 1, c1: index, c2: index }) : restructure(sheet, { axis: 'col', index, delta: -1 });

export function addRows(sheet: SheetContent, count: number): SheetContent {
  return { ...sheet, rows: Math.min(MAX_ROWS, sheet.rows + count) };
}

export function addCols(sheet: SheetContent, count: number): SheetContent {
  return { ...sheet, cols: Math.min(MAX_COLS, sheet.cols + count) };
}

export function setColWidth(sheet: SheetContent, col: number, width: number): SheetContent {
  const w = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(width)));
  return { ...sheet, colWidths: { ...sheet.colWidths, [col]: w } };
}

/** Valeurs calculées de toutes les cellules renseignées. */
export function computeValues(sheet: SheetContent): Record<string, CellValue> {
  return computeSheet((key) => sheet.cells[key]?.v, Object.keys(sheet.cells));
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function fixed(n: number, digits: number): string {
  const [int, dec] = Math.abs(n).toFixed(digits).split('.');
  return `${n < 0 ? '-' : ''}${groupThousands(int)}${dec ? `,${dec}` : ''}`;
}

/** Texte affiché dans la grille pour une valeur calculée. */
export function formatValue(value: CellValue, format: CellFormat = 'general'): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'VRAI' : 'FAUX';
  if (typeof value === 'string') return value;
  switch (format) {
    case 'number':
      return fixed(value, 2);
    case 'percent':
      return `${fixed(value * 100, Number.isInteger(parseFloat((value * 100).toPrecision(12))) ? 0 : 2)} %`;
    case 'currency':
      return `${fixed(value, 2)} €`;
    default:
      return formatNumber(value);
  }
}

export function displayText(sheet: SheetContent, values: Record<string, CellValue>, key: string): string {
  const cell = sheet.cells[key];
  if (!cell) return '';
  return formatValue(values[key] ?? null, cell.s?.format);
}

/** Dernière ligne et colonne contenant une valeur (pour l'export). */
export function usedBounds(sheet: SheetContent): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.v === '') continue;
    const pos = parseKey(key);
    if (!pos) continue;
    rows = Math.max(rows, pos.row + 1);
    cols = Math.max(cols, pos.col + 1);
  }
  return { rows, cols };
}

export interface SelectionStats {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

/** Statistiques des cellules numériques d'une plage (barre d'état). */
export function selectionStats(values: Record<string, CellValue>, bounds: Bounds): SelectionStats | null {
  const nums: number[] = [];
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const v = values[cellKey(r, c)];
      if (typeof v === 'number') nums.push(v);
    }
  }
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    count: nums.length,
    sum: parseFloat(sum.toPrecision(14)),
    average: parseFloat((sum / nums.length).toPrecision(14)),
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

/**
 * Plage de nombres contigus au-dessus (ou à gauche) d'une cellule : sert à la « somme automatique ».
 */
export function detectAutoRange(sheet: SheetContent, values: Record<string, CellValue>, row: number, col: number): string | null {
  const isNum = (r: number, c: number) => typeof values[cellKey(r, c)] === 'number';
  let r = row - 1;
  while (r >= 0 && isNum(r, col)) r--;
  if (row - 1 - r >= 1) return `${cellKey(r + 1, col)}:${cellKey(row - 1, col)}`;
  let c = col - 1;
  while (c >= 0 && isNum(row, c)) c--;
  if (col - 1 - c >= 1) return `${cellKey(row, c + 1)}:${cellKey(row, col - 1)}`;
  return null;
}

/** Aperçu textuel d'une feuille pour les listes de documents. */
export function sheetPreview(sheet: SheetContent): string {
  const values = computeValues(sheet);
  const parts: string[] = [];
  const { rows, cols } = usedBounds(sheet);
  for (let r = 0; r < rows && parts.length < 8; r++) {
    for (let c = 0; c < cols && parts.length < 8; c++) {
      const text = displayText(sheet, values, cellKey(r, c));
      if (text && !isErrorCode(text)) parts.push(text);
    }
  }
  return parts.join(' · ').slice(0, 140);
}

export { parseLiteral };
