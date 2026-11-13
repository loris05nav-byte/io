/**
 * Jetons de design (Material Design 3) : couleurs, espacements, rayons, typographie.
 */
export type ModuleKey = 'word' | 'sheet' | 'scan' | 'convert';

export interface ModuleColors {
  /** Couleur d'accent du module (icônes, sélection). */
  main: string;
  /** Texte/icône posé sur `main`. */
  onMain: string;
  /** Fond tonal doux. */
  container: string;
  /** Texte/icône posé sur `container`. */
  onContainer: string;
}

export interface Palette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  background: string;
  surface: string;
  surfaceLowest: string;
  surfaceLow: string;
  surfaceContainer: string;
  surfaceHigh: string;
  surfaceHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  inverseSurface: string;
  inverseOnSurface: string;
  scrim: string;
  shadow: string;
  modules: Record<ModuleKey, ModuleColors>;
}

export const lightPalette: Palette = {
  primary: '#3F51C7',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DEE1FF',
  onPrimaryContainer: '#00105C',
  secondaryContainer: '#E1E3F9',
  onSecondaryContainer: '#181B2C',
  background: '#F7F8FD',
  surface: '#F7F8FD',
  surfaceLowest: '#FFFFFF',
  surfaceLow: '#F1F2F9',
  surfaceContainer: '#EBEDF5',
  surfaceHigh: '#E5E7EF',
  surfaceHighest: '#DFE1EA',
  onSurface: '#191B21',
  onSurfaceVariant: '#454751',
  outline: '#767882',
  outlineVariant: '#C6C7D2',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  inverseSurface: '#2E3036',
  inverseOnSurface: '#F0F0F8',
  scrim: 'rgba(12, 14, 22, 0.45)',
  shadow: '#1B1F3B',
  modules: {
    word: { main: '#2A63D6', onMain: '#FFFFFF', container: '#DCE6FF', onContainer: '#0B2A66' },
    sheet: { main: '#16794C', onMain: '#FFFFFF', container: '#D3F3E1', onContainer: '#063D24' },
    scan: { main: '#B4530A', onMain: '#FFFFFF', container: '#FFE3CB', onContainer: '#4F2200' },
    convert: { main: '#7B3FC4', onMain: '#FFFFFF', container: '#EFDFFF', onContainer: '#33105E' },
  },
};

export const darkPalette: Palette = {
  primary: '#BAC3FF',
  onPrimary: '#0A1F87',
  primaryContainer: '#27389E',
  onPrimaryContainer: '#DEE1FF',
  secondaryContainer: '#3A3D52',
  onSecondaryContainer: '#E1E3F9',
  background: '#101217',
  surface: '#101217',
  surfaceLowest: '#0B0D12',
  surfaceLow: '#181A20',
  surfaceContainer: '#1C1E25',
  surfaceHigh: '#272930',
  surfaceHighest: '#32343B',
  onSurface: '#E3E3EB',
  onSurfaceVariant: '#C6C7D2',
  outline: '#90919C',
  outlineVariant: '#454751',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  inverseSurface: '#E3E3EB',
  inverseOnSurface: '#2E3036',
  scrim: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  modules: {
    word: { main: '#A6C2FF', onMain: '#07296B', container: '#17376F', onContainer: '#DCE6FF' },
    sheet: { main: '#7FD9A8', onMain: '#00391F', container: '#0D4A2E', onContainer: '#D3F3E1' },
    scan: { main: '#FFB784', onMain: '#4F2200', container: '#5E3210', onContainer: '#FFE3CB' },
    convert: { main: '#D7B5FF', onMain: '#3B1568', container: '#4A2378', onContainer: '#EFDFFF' },
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.4 },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.2 },
  titleLarge: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0.15 },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0.2 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelSmall: { fontSize: 11.5, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export type TypographyVariant = keyof typeof typography;

/** Palette de couleurs proposée dans les éditeurs (texte, surlignage, remplissage). */
export const swatches = [
  '#000000', '#434343', '#7A7A7A', '#B7B7B7', '#FFFFFF',
  '#C62828', '#E65100', '#F9A825', '#2E7D32', '#00838F',
  '#1565C0', '#283593', '#6A1B9A', '#AD1457', '#4E342E',
  '#FFCDD2', '#FFE0B2', '#FFF59D', '#C8E6C9', '#B2EBF2',
  '#BBDEFB', '#C5CAE9', '#E1BEE7', '#F8BBD0', '#D7CCC8',
];
