import React, { useRef } from 'react';
import { Pressable, ScrollView, ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import type { ModuleColors } from '../theme/tokens';
import { Icon, IconName } from './ui/Icon';
import { Txt } from './ui/Txt';

export type RibbonItem =
  | {
      type: 'button';
      key: string;
      icon: IconName;
      label: string;
      onPress(): void;
      active?: boolean;
      disabled?: boolean;
      /** Trait coloré sous l'icône (couleur de texte, de surlignage…). */
      swatch?: string | null;
    }
  | {
      /** Bouton large avec libellé et chevron (menu déroulant). */
      type: 'dropdown';
      key: string;
      text: string;
      label: string;
      onPress(): void;
      icon?: IconName;
      width?: number;
      /** Masque le chevron : bouton texte simple (ex. « SOMME »). */
      plain?: boolean;
    }
  | { type: 'divider'; key: string };

export interface RibbonTab {
  key: string;
  label: string;
  items: RibbonItem[];
}

interface Props {
  tabs: RibbonTab[];
  activeTab: string;
  onTabChange(key: string): void;
  accent: ModuleColors;
  /** Ajoute la marge de sécurité inférieure (barre de gestes). */
  safeBottom?: boolean;
}

/**
 * Ruban d'outils façon suite bureautique mobile : onglets + rangée d'outils défilante.
 */
export function Ribbon({ tabs, activeTab, onTabChange, accent, safeBottom = true }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const current = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceLow, borderTopColor: colors.outlineVariant, paddingBottom: safeBottom ? insets.bottom : 0 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} keyboardShouldPersistTaps="always">
        {tabs.map((tab) => {
          const selected = tab.key === current.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              onPress={() => {
                onTabChange(tab.key);
                scroll.current?.scrollTo({ x: 0, animated: false });
              }}
              style={[styles.tab, selected && { backgroundColor: accent.container }]}
            >
              <Txt variant="label" color={selected ? accent.onContainer : colors.onSurfaceVariant}>
                {tab.label}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools} keyboardShouldPersistTaps="always">
        {current.items.map((item) => {
          if (item.type === 'divider') return <View key={item.key} style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />;
          if (item.type === 'dropdown') {
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={item.onPress}
                android_ripple={{ color: colors.outlineVariant }}
                style={[styles.dropdown, { backgroundColor: colors.surfaceHigh, width: item.width }]}
              >
                {item.icon ? <Icon name={item.icon} size={18} color={colors.onSurfaceVariant} /> : null}
                <Txt variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {item.text}
                </Txt>
                {item.plain ? <View style={{ width: 6 }} /> : <Icon name="menu-down" size={18} color={colors.onSurfaceVariant} />}
              </Pressable>
            );
          }
          const tint = item.active ? accent.onContainer : colors.onSurface;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: !!item.active, disabled: !!item.disabled }}
              disabled={item.disabled}
              onPress={item.onPress}
              android_ripple={{ color: colors.outlineVariant, borderless: true, radius: 22 }}
              style={[styles.tool, item.active && { backgroundColor: accent.container }, item.disabled && { opacity: 0.35 }]}
            >
              <Icon name={item.icon} size={22} color={tint} />
              {item.swatch !== undefined ? (
                <View style={[styles.swatch, { backgroundColor: item.swatch ?? 'transparent', borderColor: colors.outline, borderWidth: item.swatch ? 0 : 1 }]} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: 10, paddingTop: 8, gap: 4 },
  tab: { paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tools: { paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', gap: 2 },
  tool: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swatch: { position: 'absolute', bottom: 6, width: 20, height: 4, borderRadius: 2 },
  dropdown: { height: 38, borderRadius: 10, paddingLeft: 12, paddingRight: 6, marginHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  divider: { width: 1, height: 24, marginHorizontal: 6 },
});
