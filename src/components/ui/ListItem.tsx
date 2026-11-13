import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';

interface Props {
  icon?: IconName;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

/** Ligne de liste / entrée de menu. */
export function ListItem({ icon, iconColor, iconBackground, title, subtitle, onPress, trailing, destructive, selected, disabled }: Props) {
  const { colors } = useTheme();
  const fg = destructive ? colors.error : colors.onSurface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      android_ripple={{ color: colors.outlineVariant }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceHigh : 'transparent', opacity: disabled ? 0.4 : 1 }]}
    >
      {icon ? (
        <View style={[styles.icon, iconBackground ? { backgroundColor: iconBackground, borderRadius: 12 } : null]}>
          <Icon name={icon} size={22} color={iconColor ?? (destructive ? colors.error : colors.onSurfaceVariant)} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Txt variant="body" color={fg} numberOfLines={1} style={{ fontWeight: selected ? '700' : '500' }}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="bodySmall" muted numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? (selected ? <Icon name="check" size={20} color={colors.primary} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, paddingHorizontal: 24, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
});
