import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
}

/** Boutons segmentés Material 3 (choix exclusif). */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: colors.outline }]} accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const selected = option.value === value;
        const fg = selected ? colors.onSecondaryContainer : colors.onSurface;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: colors.outlineVariant }}
            style={[
              styles.item,
              { backgroundColor: selected ? colors.secondaryContainer : 'transparent', borderLeftColor: colors.outline, borderLeftWidth: index === 0 ? 0 : 1 },
            ]}
          >
            {(selected || option.icon) && <Icon name={selected ? 'check' : option.icon!} size={16} color={fg} />}
            <Txt variant="label" color={fg} numberOfLines={1}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, overflow: 'hidden' },
  item: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
});
