import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from './src/components/ui/Feedback';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DocumentsProvider } from './src/store/DocumentsProvider';
import { SettingsProvider, useSettings } from './src/store/SettingsProvider';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Shell() {
  const { dark, colors } = useTheme();
  const { ready } = useSettings();

  // Aligne le fond de la fenêtre native sur le thème (évite un flash blanc en mode sombre).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedbackProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <RootNavigator />
    </FeedbackProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <DocumentsProvider>
            <Shell />
          </DocumentsProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
