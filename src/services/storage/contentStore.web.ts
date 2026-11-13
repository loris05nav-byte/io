/**
 * Variante web (aperçu dans le navigateur) : le contenu est conservé dans AsyncStorage (localStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'folio:content:';

export async function readContent(id: string): Promise<string | null> {
  return AsyncStorage.getItem(PREFIX + id);
}

export async function writeContent(id: string, data: string): Promise<void> {
  await AsyncStorage.setItem(PREFIX + id, data);
}

export async function removeContent(id: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + id);
}

export async function clearAllContent(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
}
