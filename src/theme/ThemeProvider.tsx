import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '../store/SettingsProvider';
import { darkPalette, lightPalette, Palette } from './tokens';

export interface Theme {
  dark: boolean;
  colors: Palette;
}

const ThemeContext = createContext<Theme>({ dark: false, colors: lightPalette });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { settings } = useSettings();
  const dark = settings.themeMode === 'system' ? system === 'dark' : settings.themeMode === 'dark';
  const theme = useMemo<Theme>(() => ({ dark, colors: dark ? darkPalette : lightPalette }), [dark]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
