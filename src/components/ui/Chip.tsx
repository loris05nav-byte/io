import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
}

/** Puce de filtre Material 3. */
export function Chip({ label, selected, onPress, icon, disabled }: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.onSecondaryContainer : colors.onSurfaceVariant;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.outlineVariant }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.secondaryContainer : 'transparent',
          borderColor: selected ? colors.secondaryContainer : colors.outlineVariant,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {selected ? <Icon name="check" size={16} color={fg} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Txt variant="label" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
});
