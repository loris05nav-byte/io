export type DocKind = 'text' | 'sheet';

/** Métadonnées d'un document, conservées dans l'index. */
export interface DocMeta {
  id: string;
  title: string;
  kind: DocKind;
  createdAt: number;
  updatedAt: number;
  /** Dernière ouverture, sert au tri des « récents ». */
  openedAt: number;
  favorite: boolean;
  /** Extrait textuel affiché dans les listes. */
  preview: string;
  /** Taille approximative du contenu, en octets. */
  size: number;
}

export type CellAlign = 'left' | 'center' | 'right';
export type CellFormat = 'general' | 'number' | 'percent' | 'currency';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: CellAlign;
  color?: string;
  bg?: string;
  format?: CellFormat;
}

export interface Cell {
  /** Saisie brute : texte, nombre ou formule commençant par « = ». */
  v: string;
  s?: CellStyle;
}

export interface SheetContent {
  rows: number;
  cols: number;
  /** Cellules indexées par référence A1. */
  cells: Record<string, Cell>;
  /** Largeurs de colonnes personnalisées (index de colonne → pixels). */
  colWidths?: Record<number, number>;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type OcrLanguage = 'fra+eng' | 'fra' | 'eng';
export type CsvSeparator = ';' | ',';

export interface Settings {
  themeMode: ThemeMode;
  ocrLanguage: OcrLanguage;
  csvSeparator: CsvSeparator;
}
