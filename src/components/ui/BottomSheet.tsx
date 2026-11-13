import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { Txt } from './Txt';

interface Props {
  visible: boolean;
  onClose(): void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Désactive le défilement interne (contenu court ou liste gérée par l'appelant). */
  scrollable?: boolean;
}

/** Feuille modale inférieure Material 3. */
export function BottomSheet({ visible, onClose, title, subtitle, children, scrollable = true }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.4, 0] });
  const Body = scrollable ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityLabel="Fermer" />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceLow, paddingBottom: insets.bottom + 12, maxHeight: height * 0.82, transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          {title ? (
            <View style={styles.header}>
              <Txt variant="titleLarge">{title}</Txt>
              {subtitle ? (
                <Txt variant="bodySmall" muted numberOfLines={2}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
          ) : null}
          <Body {...(scrollable ? { keyboardShouldPersistTaps: 'handled' as const, showsVerticalScrollIndicator: false } : {})}>{children}</Body>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, width: '100%', maxWidth: 640, alignSelf: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { paddingHorizontal: 24, paddingBottom: 10, gap: 2 },
});
