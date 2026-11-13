import React from 'react';
import { Text, TextProps } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { typography, TypographyVariant } from '../../theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  /** Texte secondaire (couleur atténuée). */
  muted?: boolean;
  center?: boolean;
}

/** Texte thémé selon l'échelle typographique de l'application. */
export function Txt({ variant = 'body', color, muted, center, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[typography[variant], { color: color ?? (muted ? colors.onSurfaceVariant : colors.onSurface) }, center && { textAlign: 'center' }, style]}
    />
  );
}
