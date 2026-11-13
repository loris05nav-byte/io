/**
 * Reconnaissance de texte (OCR).
 *
 * Deux moteurs :
 *  - « natif » : Google ML Kit via expo-text-extractor, embarqué dans l'APK (rapide, hors-ligne) ;
 *  - « tesseract » : Tesseract.js exécuté dans une WebView (voir components/TesseractEngine),
 *    utilisé quand le module natif est absent (Expo Go, navigateur).
 */
import { Platform } from 'react-native';

interface NativeOcrModule {
  isSupported: boolean;
  extractTextFromImage(uri: string): Promise<string[]>;
}

let nativeModule: NativeOcrModule | null | undefined;

function getNativeModule(): NativeOcrModule | null {
  if (nativeModule !== undefined) return nativeModule;
  nativeModule = null;
  if (Platform.OS !== 'web') {
    try {
      // Chargement paresseux : le module natif n'existe pas dans Expo Go.
      const mod = require('expo-text-extractor') as NativeOcrModule;
      if (mod && mod.isSupported) nativeModule = mod;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
}

export type OcrEngine = 'native' | 'tesseract';

export function availableEngine(): OcrEngine {
  return getNativeModule() ? 'native' : 'tesseract';
}

/** Reconnaissance avec le moteur natif. Lève une erreur si le module n'est pas disponible. */
export async function recognizeNative(imageUri: string): Promise<string> {
  const mod = getNativeModule();
  if (!mod) throw new Error('Moteur OCR natif indisponible.');
  const blocks = await mod.extractTextFromImage(imageUri);
  return cleanOcrText(blocks.join('\n'));
}

/** Nettoie le texte reconnu : césures de fin de ligne, espaces superflus, lignes vides multiples. */
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/([A-Za-zÀ-ÿ])-\n([a-zà-ÿ])/g, "$1$2")
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Transforme le texte reconnu en HTML.
 * Les lignes coupées par la largeur de la page sont réunies en un paragraphe ; les lignes courtes
 * (titres, adresses, listes) et les fins de phrase conservent leur retour à la ligne.
 */
export function ocrTextToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim());
      const longest = Math.max(...lines.map((line) => line.length));
      let html = escape(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        const previous = lines[i - 1];
        const wrapped = previous.length >= longest * 0.6 && !/[.!?:;]$/.test(previous);
        html += (wrapped ? ' ' : '<br>') + escape(lines[i]);
      }
      return `<p>${html}</p>`;
    })
    .join('');
}
