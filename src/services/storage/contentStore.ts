/**
 * Stockage du contenu des documents : un fichier par document dans le dossier privé de l'application.
 * (Variante web : voir contentStore.web.ts.)
 */
import { Directory, File, Paths } from 'expo-file-system';

const docsDir = () => new Directory(Paths.document, 'documents');

function ensureDir(): Directory {
  const dir = docsDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

const fileFor = (id: string) => new File(docsDir(), `${id}.dat`);

export async function readContent(id: string): Promise<string | null> {
  const file = fileFor(id);
  if (!file.exists) return null;
  return file.text();
}

export async function writeContent(id: string, data: string): Promise<void> {
  ensureDir();
  const file = fileFor(id);
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  await file.write(data);
}

export async function removeContent(id: string): Promise<void> {
  const file = fileFor(id);
  if (file.exists) file.delete();
}

export async function clearAllContent(): Promise<void> {
  const dir = docsDir();
  if (dir.exists) dir.delete();
}
