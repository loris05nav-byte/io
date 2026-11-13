import React, { useCallback, useState } from 'react';

import { useDocumentFlows } from '../hooks/useDocumentFlows';
import { useDocuments } from '../store/DocumentsProvider';
import type { DocMeta } from '../types';
import { KIND_LABEL } from './docVisuals';
import { ExportSheet } from './ExportSheet';
import { BottomSheet } from './ui/BottomSheet';
import { useFeedback } from './ui/Feedback';
import { ListItem } from './ui/ListItem';

/**
 * Menu d'actions d'un document (ouvrir, renommer, favori, dupliquer, exporter, supprimer).
 * Renvoie `showActions(doc)` et l'élément à insérer dans l'écran.
 */
export function useDocActions() {
  const { renameDoc, toggleFavorite, duplicateDoc, deleteDoc, readContent, getDoc } = useDocuments();
  const { confirm, prompt, toast } = useFeedback();
  const { openDoc } = useDocumentFlows();
  const [target, setTarget] = useState<DocMeta | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const showActions = useCallback((doc: DocMeta) => {
    setTarget(doc);
    setMenuOpen(true);
  }, []);

  const close = () => setMenuOpen(false);
  const doc = target ? (getDoc(target.id) ?? target) : null;

  const rename = async () => {
    if (!doc) return;
    close();
    const title = await prompt({ title: 'Renommer', initialValue: doc.title, placeholder: 'Nom du document', confirmLabel: 'Renommer' });
    if (title?.trim()) renameDoc(doc.id, title);
  };

  const remove = async () => {
    if (!doc) return;
    close();
    const ok = await confirm({
      title: 'Supprimer ce document ?',
      message: `« ${doc.title} » sera définitivement supprimé de cet appareil.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (ok) {
      await deleteDoc(doc.id);
      toast('Document supprimé');
    }
  };

  const element = (
    <>
      <BottomSheet visible={menuOpen && !!doc} onClose={close} title={doc?.title} subtitle={doc ? KIND_LABEL[doc.kind] : undefined}>
        {doc ? (
          <>
            <ListItem
              icon="open-in-new"
              title="Ouvrir"
              onPress={() => {
                close();
                openDoc(doc);
              }}
            />
            <ListItem icon="pencil-outline" title="Renommer" onPress={rename} />
            <ListItem
              icon={doc.favorite ? 'star-off-outline' : 'star-outline'}
              title={doc.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onPress={() => {
                toggleFavorite(doc.id);
                close();
              }}
            />
            <ListItem
              icon="content-copy"
              title="Dupliquer"
              onPress={async () => {
                close();
                if (await duplicateDoc(doc.id)) toast('Copie créée');
              }}
            />
            <ListItem
              icon="export-variant"
              title="Exporter / convertir"
              subtitle="PDF, HTML, TXT, CSV, Markdown"
              onPress={() => {
                close();
                setExportOpen(true);
              }}
            />
            <ListItem icon="trash-can-outline" title="Supprimer" destructive onPress={remove} />
          </>
        ) : null}
      </BottomSheet>
      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title={doc?.title}
        getSource={async () => {
          if (!doc) return null;
          return { title: doc.title, kind: doc.kind, content: (await readContent(doc.id)) ?? '' };
        }}
      />
    </>
  );

  return { showActions, element };
}
