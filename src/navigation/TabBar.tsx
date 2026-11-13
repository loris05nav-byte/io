import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '../components/ui/Icon';
import { Txt } from '../components/ui/Txt';
import { useTheme } from '../theme/ThemeProvider';

interface Destination {
  key: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  /** Nom de l'onglet, ou `null` pour une action plein écran (scanner). */
  route: string | null;
}

const DESTINATIONS: Destination[] = [
  { key: 'home', label: 'Accueil', icon: 'home-variant-outline', activeIcon: 'home-variant', route: 'Home' },
  { key: 'files', label: 'Fichiers', icon: 'folder-outline', activeIcon: 'folder', route: 'Files' },
  { key: 'scan', label: 'Scanner', icon: 'line-scan', activeIcon: 'line-scan', route: null },
  { key: 'convert', label: 'Convertir', icon: 'swap-horizontal', activeIcon: 'swap-horizontal-bold', route: 'Convert' },
];

/** Barre de navigation inférieure Material 3. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;

  return (
    <View style={[styles.bar, { backgroundColor: colors.surfaceContainer, paddingBottom: insets.bottom, borderTopColor: colors.outlineVariant }]} accessibilityRole="tablist">
      {DESTINATIONS.map((destination) => {
        const selected = destination.route === current;
        const onPress = () => {
          if (destination.route === null) {
            navigation.getParent()?.navigate('Scanner');
            return;
          }
          const route = state.routes.find((r) => r.name === destination.route);
          if (!route) return;
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={destination.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={destination.label}
            accessibilityState={{ selected }}
            style={styles.item}
          >
            <View style={[styles.pill, selected && { backgroundColor: colors.secondaryContainer }]}>
              <Icon name={selected ? destination.activeIcon : destination.icon} size={24} color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} />
            </View>
            <Txt variant="labelSmall" color={selected ? colors.onSurface : colors.onSurfaceVariant} style={{ fontWeight: selected ? '700' : '500' }}>
              {destination.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 10, gap: 4 },
  pill: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
