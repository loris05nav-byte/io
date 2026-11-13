import { Platform, ViewStyle } from 'react-native';

/** Ombre portée douce, équivalente aux niveaux d'élévation Material. */
export function elevation(level: 0 | 1 | 2 | 3 | 4, shadowColor = '#000'): ViewStyle {
  if (level === 0) return {};
  if (Platform.OS === 'android') return { elevation: level * 1.5, shadowColor };
  return {
    shadowColor,
    shadowOpacity: 0.06 + level * 0.025,
    shadowRadius: 3 + level * 3,
    shadowOffset: { width: 0, height: level },
  };
}
