import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme as NavigationTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';

import { ConverterScreen } from '../screens/ConverterScreen';
import { FilesScreen } from '../screens/FilesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SheetEditorScreen } from '../screens/SheetEditorScreen';
import { WordEditorScreen } from '../screens/WordEditorScreen';
import { useTheme } from '../theme/ThemeProvider';
import { TabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabsNavigator() {
  return (
    <Tabs.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tabs.Screen name="Files" component={FilesScreen} options={{ title: 'Fichiers' }} />
      <Tabs.Screen name="Convert" component={ConverterScreen} options={{ title: 'Convertir' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { dark, colors } = useTheme();

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.onSurface,
        border: colors.outlineVariant,
        notification: colors.error,
      },
    };
  }, [dark, colors]);

  return (
    <NavigationContainer theme={navigationTheme} documentTitle={{ formatter: (options) => (options?.title ? `${options.title} · Folio Office` : 'Folio Office') }}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="Tabs" component={TabsNavigator} />
        <Stack.Screen name="WordEditor" component={WordEditorScreen} options={{ title: 'Document' }} />
        <Stack.Screen name="SheetEditor" component={SheetEditorScreen} options={{ title: 'Feuille de calcul' }} />
        <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scanner', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Réglages' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
