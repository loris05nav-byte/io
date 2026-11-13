/**
 * Parcours communs à plusieurs écrans : créer, ouvrir et importer un document.
 */
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback } from 'react';

import { KIND_ROUTE } from '../components/docVisuals';
import { useFeedback } from '../components/ui/Feedback';
import { ConversionSource, IMPORT_MIME_TYPES, importFile, isImportable } from '../services/converter/converter';
import { readPickedFile } from '../services/converter/exporter';
import { htmlToText } from '../services/converter/markup';
import { parseSheet, sheetPreview } from '../services/spreadsheet/sheetModel';
import type { Template } from '../services/templates';
import { useDocuments } from '../store/DocumentsProvider';
import type { DocKind, DocMeta } from '../types';

/** Extrait affiché dans les listes pour un contenu donné. */
export function previewOf(kind: DocKind, content: string): string {
  return kind === 'sheet' ? sheetPreview(parseSheet(content)) : htmlToText(content).replace(/\s+/g, ' ').slice(0, 160);
}

/** Ouvre le sélecteur de fichiers et convertit le fichier choisi. Renvoie `null` si annulé. */
export async function pickImportSource(): Promise<ConversionSource | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: IMPORT_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (!isImportable(asset.name)) throw new Error('Format non pris en charge. Choisissez un fichier TXT, MD, HTML ou CSV.');
  if ((asset.size ?? 0) > 5 * 1024 * 1024) throw new Error('Fichier trop volumineux (5 Mo maximum).');
  const text = await readPickedFile(asset.uri);
  return importFile(asset.name, text);
}

export function useDocumentFlows() {
  const navigation = useNavigation();
  const { createDoc } = useDocuments();
  const { toast } = useFeedback();

  const openDoc = useCallback(
    (doc: Pick<DocMeta, 'id' | 'kind'>) => navigation.navigate(KIND_ROUTE[doc.kind], { docId: doc.id }),
    [navigation],
  );

  const createAndOpen = useCallback(
    async (kind: DocKind, options?: { title?: string; content?: string; preview?: string }) => {
      try {
        const meta = await createDoc(kind, options);
        openDoc(meta);
        return meta;
      } catch {
        toast('Impossible de créer le document.');
        return null;
      }
    },
    [createDoc, openDoc, toast],
  );

  const createFromTemplate = useCallback(
    (template: Template) => {
      const { content, preview } = template.build();
      return createAndOpen(template.kind, { title: template.title, content, preview });
    },
    [createAndOpen],
  );

  const importAndOpen = useCallback(async () => {
    try {
      const source = await pickImportSource();
      if (!source) return null;
      return await createAndOpen(source.kind, { title: source.title, content: source.content, preview: previewOf(source.kind, source.content) });
    } catch (error) {
      toast(error instanceof Error ? error.message : "L'import a échoué.");
      return null;
    }
  }, [createAndOpen, toast]);

  return { openDoc, createAndOpen, createFromTemplate, importAndOpen };
}
