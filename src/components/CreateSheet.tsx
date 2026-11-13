import { useNavigation } from '@react-navigation/native';
import React from 'react';

import { useDocumentFlows } from '../hooks/useDocumentFlows';
import { useTheme } from '../theme/ThemeProvider';
import { BottomSheet } from './ui/BottomSheet';
import { ListItem } from './ui/ListItem';

interface Props {
  visible: boolean;
  onClose(): void;
}

/** Feuille « Nouveau » : création rapide par catégorie. */
export function CreateSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { createAndOpen, importAndOpen } = useDocumentFlows();
  const m = colors.modules;

  const item = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouveau">
      <ListItem
        icon="file-document-outline"
        iconColor={m.word.onContainer}
        iconBackground={m.word.container}
        title="Document"
        subtitle="Traitement de texte"
        onPress={item(() => createAndOpen('text'))}
      />
      <ListItem
        icon="table"
        iconColor={m.sheet.onContainer}
        iconBackground={m.sheet.container}
        title="Feuille de calcul"
        subtitle="Tableur avec formules"
        onPress={item(() => createAndOpen('sheet'))}
      />
      <ListItem
        icon="line-scan"
        iconColor={m.scan.onContainer}
        iconBackground={m.scan.container}
        title="Scanner un document"
        subtitle="Photo → texte modifiable (OCR)"
        onPress={item(() => navigation.navigate('Scanner'))}
      />
      <ListItem
        icon="file-import-outline"
        iconColor={m.convert.onContainer}
        iconBackground={m.convert.container}
        title="Importer un fichier"
        subtitle="TXT, Markdown, HTML ou CSV"
        onPress={item(() => importAndOpen())}
      />
    </BottomSheet>
  );
}
