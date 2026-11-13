import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteContent,
  loadContent,
  loadIndex,
  newMeta,
  saveContent,
  saveIndex,
  wipeDocuments,
} from '../services/storage/documentRepository';
import type { DocKind, DocMeta } from '../types';

interface CreateOptions {
  title?: string;
  content?: string;
  preview?: string;
}

interface DocumentsContextValue {
  docs: DocMeta[];
  ready: boolean;
  getDoc(id: string): DocMeta | undefined;
  createDoc(kind: DocKind, options?: CreateOptions): Promise<DocMeta>;
  readContent(id: string): Promise<string | null>;
  /** Enregistre le contenu et met à jour l'aperçu, la taille et la date de modification. */
  writeContent(id: string, content: string, preview: string): Promise<void>;
  renameDoc(id: string, title: string): void;
  toggleFavorite(id: string): void;
  markOpened(id: string): void;
  duplicateDoc(id: string): Promise<DocMeta | null>;
  deleteDoc(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

const DEFAULT_TITLES: Record<DocKind, string> = { text: 'Document', sheet: 'Feuille de calcul' };

/** Premier titre libre : « Document », « Document 2 », « Document 3 »… */
function uniqueTitle(base: string, docs: DocMeta[]): string {
  const taken = new Set(docs.map((d) => d.title.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [ready, setReady] = useState(false);
  const docsRef = useRef<DocMeta[]>([]);

  const commit = useCallback((updater: (prev: DocMeta[]) => DocMeta[]) => {
    const next = updater(docsRef.current);
    docsRef.current = next;
    setDocs(next);
    saveIndex(next).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    loadIndex().then((loaded) => {
      if (!alive) return;
      docsRef.current = loaded;
      setDocs(loaded);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<DocMeta>) => commit((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d))),
    [commit],
  );

  const value = useMemo<DocumentsContextValue>(
    () => ({
      docs,
      ready,
      getDoc: (id) => docsRef.current.find((d) => d.id === id),
      async createDoc(kind, options = {}) {
        const content = options.content ?? '';
        const title = uniqueTitle(options.title?.trim() || DEFAULT_TITLES[kind], docsRef.current);
        const meta = newMeta(kind, title, content, options.preview ?? '');
        await saveContent(meta.id, content);
        commit((prev) => [meta, ...prev]);
        return meta;
      },
      readContent: (id) => loadContent(id),
      async writeContent(id, content, preview) {
        await saveContent(id, content);
        patch(id, { preview, size: content.length, updatedAt: Date.now() });
      },
      renameDoc(id, title) {
        const clean = title.trim();
        if (clean) patch(id, { title: clean, updatedAt: Date.now() });
      },
      toggleFavorite(id) {
        const doc = docsRef.current.find((d) => d.id === id);
        if (doc) patch(id, { favorite: !doc.favorite });
      },
      markOpened(id) {
        patch(id, { openedAt: Date.now() });
      },
      async duplicateDoc(id) {
        const source = docsRef.current.find((d) => d.id === id);
        if (!source) return null;
        const content = (await loadContent(id)) ?? '';
        const meta = newMeta(source.kind, uniqueTitle(`${source.title} (copie)`, docsRef.current), content, source.preview);
        await saveContent(meta.id, content);
        commit((prev) => [meta, ...prev]);
        return meta;
      },
      async deleteDoc(id) {
        commit((prev) => prev.filter((d) => d.id !== id));
        await deleteContent(id).catch(() => undefined);
      },
      async deleteAll() {
        docsRef.current = [];
        setDocs([]);
        await wipeDocuments();
      },
    }),
    [docs, ready, commit, patch],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments doit être utilisé dans DocumentsProvider');
  return ctx;
}
