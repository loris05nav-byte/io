/**
 * Variante web (aperçu dans le navigateur) : téléchargement du fichier, impression via une fenêtre dédiée.
 */
import type { ConversionResult } from './converter';

export const canSaveToDevice = false;

export async function printHtml(html: string): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) throw new Error("Impossible d'ouvrir la fenêtre d'impression.");
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export async function shareResult(result: ConversionResult): Promise<void> {
  if (result.format === 'pdf') {
    await printHtml(result.data);
    return;
  }
  const blob = new Blob([result.data], { type: `${result.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveResultToDevice(result: ConversionResult): Promise<boolean> {
  await shareResult(result);
  return true;
}

export async function readPickedFile(uri: string): Promise<string> {
  const response = await fetch(uri);
  return response.text();
}
