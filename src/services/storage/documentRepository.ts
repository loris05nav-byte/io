/**
 * Référentiel des documents : index des métadonnées (AsyncStorage) + contenu (contentStore).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DocKind, DocMeta, Settings } from '../../types';
import { createId } from '../../utils/format';
import { clearAllContent, readContent, removeContent, writeContent } from './contentStore';

const INDEX_KEY = 'folio:index:v1';
const SETTINGS_KEY = 'folio:settings:v1';

export const DEFAULT_SETTINGS: Settings = { themeMode: 'system', ocrLanguage: 'fra+eng', csvSeparator: ';' };

export async function loadIndex(): Promise<DocMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as DocMeta[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveIndex(docs: DocMeta[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(docs));
}

export function newMeta(kind: DocKind, title: string, content: string, preview: string): DocMeta {
  const now = Date.now();
  return { id: createId(), title, kind, createdAt: now, updatedAt: now, openedAt: now, favorite: false, preview, size: content.length };
}

export const loadContent = readContent;
export const saveContent = writeContent;
export const deleteContent = removeContent;

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Supprime tous les documents (les réglages sont conservés). */
export async function wipeDocuments(): Promise<void> {
  await clearAllContent();
  await AsyncStorage.removeItem(INDEX_KEY);
}
