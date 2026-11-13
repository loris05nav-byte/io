/**
 * Passage du texte reconnu par le scanner vers l'éditeur de texte qui l'a demandé.
 */
const pending = new Map<string, string>();

export function setPendingInsert(docId: string, text: string): void {
  pending.set(docId, text);
}

/** Récupère (et retire) le texte en attente pour un document. */
export function takePendingInsert(docId: string): string | null {
  const text = pending.get(docId) ?? null;
  pending.delete(docId);
  return text;
}
