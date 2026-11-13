import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { DocMeta } from '../types';
import { formatRelativeDate, formatSize } from '../utils/format';
import { KIND_ICON, KIND_LABEL, KIND_MODULE } from './docVisuals';
import { Icon } from './ui/Icon';
import { IconButton } from './ui/IconButton';
import { Txt } from './ui/Txt';

interface Props {
  doc: DocMeta;
  onPress(): void;
  onMore?(): void;
  /** Affiche l'extrait du contenu sous le titre. */
  showPreview?: boolean;
}

/** Ligne de document (listes « Récents » et « Fichiers »). */
export const DocumentRow = React.memo(function DocumentRow({ doc, onPress, onMore, showPreview }: Props) {
  const { colors } = useTheme();
  const accent = colors.modules[KIND_MODULE[doc.kind]];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`${doc.title}, ${KIND_LABEL[doc.kind]}`}
      android_ripple={{ color: colors.outlineVariant }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceContainer : colors.surfaceLowest, borderColor: colors.outlineVariant }]}
    >
      <View style={[styles.icon, { backgroundColor: accent.container }]}>
        <Icon name={KIND_ICON[doc.kind]} size={24} color={accent.onContainer} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Txt variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {doc.title}
          </Txt>
          {doc.favorite ? <Icon name="star" size={15} color="#E0A100" /> : null}
        </View>
        {showPreview && doc.preview ? (
          <Txt variant="bodySmall" muted numberOfLines={1}>
            {doc.preview}
          </Txt>
        ) : null}
        <Txt variant="labelSmall" muted style={{ fontWeight: '500' }} numberOfLines={1}>
          {KIND_LABEL[doc.kind]} · {formatRelativeDate(doc.updatedAt)} · {formatSize(doc.size)}
        </Txt>
      </View>
      {onMore ? <IconButton icon="dots-vertical" label={`Actions pour ${doc.title}`} onPress={onMore} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 14, paddingRight: 4, paddingVertical: 10, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
