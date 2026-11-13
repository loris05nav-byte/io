import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';

type Variant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Couleur d'accent (remplace la couleur primaire). */
  accent?: { main: string; onMain: string; container: string; onContainer: string };
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function Button({ label, onPress, variant = 'filled', icon, loading, disabled, accent, style, compact }: Props) {
  const { colors } = useTheme();
  const main = accent?.main ?? colors.primary;
  const onMain = accent?.onMain ?? colors.onPrimary;
  const container = accent?.container ?? colors.secondaryContainer;
  const onContainer = accent?.onContainer ?? colors.onSecondaryContainer;

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    filled: { bg: main, fg: onMain },
    tonal: { bg: container, fg: onContainer },
    outlined: { bg: 'transparent', fg: main, border: colors.outline },
    text: { bg: 'transparent', fg: main },
    danger: { bg: colors.error, fg: colors.onError },
  };
  const { bg, fg, border } = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: 'rgba(127,127,127,0.25)' }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: bg, borderColor: border ?? 'transparent', borderWidth: border ? 1 : 0, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Txt variant="label" color={fg} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  compact: { minHeight: 36, paddingHorizontal: 14 },
});
