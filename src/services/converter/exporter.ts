/**
 * Écriture, partage et enregistrement des fichiers exportés (Android / iOS).
 * (Variante web : voir exporter.web.ts.)
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { ConversionResult } from './converter';

function exportDir(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Matérialise le résultat d'une conversion dans le cache et renvoie le fichier. */
async function materialize(result: ConversionResult): Promise<File> {
  const target = new File(exportDir(), result.fileName);
  if (target.exists) target.delete();
  if (result.format === 'pdf') {
    const { uri } = await Print.printToFileAsync({ html: result.data });
    await new File(uri).move(target);
    return target;
  }
  target.create({ overwrite: true });
  await target.write(result.data);
  return target;
}

/** Ouvre la feuille de partage du système avec le fichier converti. */
export async function shareResult(result: ConversionResult): Promise<void> {
  const file = await materialize(result);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Le partage n'est pas disponible sur cet appareil.");
  await Sharing.shareAsync(file.uri, { mimeType: result.mime, dialogTitle: result.fileName });
}

/** Indique si l'enregistrement direct dans un dossier choisi par l'utilisateur est possible. */
export const canSaveToDevice = Platform.OS === 'android';

/**
 * Enregistre le fichier dans un dossier choisi par l'utilisateur (Android, Storage Access Framework).
 * @returns `false` si l'utilisateur a annulé.
 */
export async function saveResultToDevice(result: ConversionResult): Promise<boolean> {
  if (!canSaveToDevice) {
    await shareResult(result);
    return true;
  }
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  const source = await materialize(result);
  const target = directory.createFile(result.fileName, result.mime);
  await target.write(await source.bytes());
  return true;
}

/** Envoie le document à l'imprimante via le service d'impression du système. */
export async function printHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}

/** Lit le texte d'un fichier choisi par l'utilisateur. */
export async function readPickedFile(uri: string): Promise<string> {
  return new File(uri).text();
}
