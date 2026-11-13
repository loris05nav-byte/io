import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName } from './Icon';

interface Props {
  icon: IconName;
  onPress?: () => void;
  onLongPress?: () => void;
  label: string;
  size?: number;
  color?: string;
  /** Fond tonal (bouton « rempli »). */
  background?: string;
  active?: boolean;
  activeColor?: string;
  activeBackground?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Diamètre de la zone tactile (48 dp par défaut). */
  box?: number;
}

export function IconButton({
  icon,
  onPress,
  onLongPress,
  label,
  size = 22,
  color,
  background,
  active,
  activeColor,
  activeBackground,
  disabled,
  style,
  box = 44,
}: Props) {
  const { colors } = useTheme();
  const tint = active ? (activeColor ?? colors.onSecondaryContainer) : (color ?? colors.onSurfaceVariant);
  const bg = active ? (activeBackground ?? colors.secondaryContainer) : background;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      android_ripple={{ color: colors.outlineVariant, borderless: true, radius: box / 2 }}
      style={({ pressed }) => [
        styles.base,
        { width: box, height: box, borderRadius: box / 2, backgroundColor: bg, opacity: disabled ? 0.38 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
