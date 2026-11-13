import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { swatches } from '../theme/tokens';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Txt';

interface Props {
  selected?: string;
  onSelect(color: string | null): void;
  /** Libellé de l'option « aucune couleur » (ex. « Automatique », « Aucun remplissage »). */
  noneLabel: string;
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160;
};

/** Grille de pastilles de couleur. */
export function ColorPalette({ selected, onSelect, noneLabel }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onSelect(null)}
        accessibilityRole="button"
        accessibilityLabel={noneLabel}
        style={[styles.none, { borderColor: colors.outlineVariant }]}
        android_ripple={{ color: colors.outlineVariant }}
      >
        <Icon name="water-off-outline" size={18} color={colors.onSurfaceVariant} />
        <Txt variant="label">{noneLabel}</Txt>
      </Pressable>
      <View style={styles.grid}>
        {swatches.map((color) => {
          const active = selected?.toLowerCase() === color.toLowerCase();
          return (
            <Pressable
              key={color}
              onPress={() => onSelect(color)}
              accessibilityRole="button"
              accessibilityLabel={`Couleur ${color}`}
              accessibilityState={{ selected: active }}
              style={[styles.swatch, { backgroundColor: color, borderColor: active ? colors.primary : colors.outlineVariant, borderWidth: active ? 3 : 1 }]}
            >
              {active ? <Icon name="check" size={18} color={isLight(color) ? '#000' : '#fff'} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingBottom: 12, gap: 14 },
  none: { height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  swatch: { width: '17%', aspectRatio: 1.25, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
