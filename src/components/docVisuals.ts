import type { IconName } from './ui/Icon';
import type { ModuleKey } from '../theme/tokens';
import type { DocKind } from '../types';

export const KIND_MODULE: Record<DocKind, ModuleKey> = { text: 'word', sheet: 'sheet' };

export const KIND_ICON: Record<DocKind, IconName> = { text: 'file-document-outline', sheet: 'table' };

export const KIND_LABEL: Record<DocKind, string> = { text: 'Document', sheet: 'Feuille de calcul' };

export const KIND_ROUTE: Record<DocKind, 'WordEditor' | 'SheetEditor'> = { text: 'WordEditor', sheet: 'SheetEditor' };
