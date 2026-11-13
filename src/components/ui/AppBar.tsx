import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { IconButton } from './IconButton';
import { Txt } from './Txt';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Rend le titre cliquable (renommer un document, par exemple). */
  onTitlePress?: () => void;
  actions?: React.ReactNode;
  /** Pastille colorée devant le titre. */
  leading?: React.ReactNode;
  background?: string;
}

/** Barre d'application supérieure compacte. */
export function AppBar({ title, subtitle, onBack, onTitlePress, actions, leading, background }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: background ?? colors.surface, paddingTop: insets.top }}>
      <View style={styles.bar}>
        {onBack ? <IconButton icon="arrow-left" label="Retour" onPress={onBack} color={colors.onSurface} /> : <View style={{ width: 12 }} />}
        {leading}
        <Pressable
          style={styles.titleWrap}
          disabled={!onTitlePress}
          onPress={onTitlePress}
          accessibilityRole={onTitlePress ? 'button' : 'header'}
          accessibilityLabel={onTitlePress ? `${title}, renommer` : title}
        >
          <Txt variant="title" numberOfLines={1}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="labelSmall" muted numberOfLines={1} style={{ fontWeight: '500' }}>
              {subtitle}
            </Txt>
          ) : null}
        </Pressable>
        <View style={styles.actions}>{actions}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 4 },
  titleWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 6, minHeight: 44 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
