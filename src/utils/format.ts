const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Date relative courte : « À l'instant », « Il y a 5 min », « Hier », « 12 mars ». */
export function formatRelativeDate(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "À l'instant";
  if (diff < hour) return `Il y a ${Math.floor(diff / minute)} min`;
  if (diff < day) return `Il y a ${Math.floor(diff / hour)} h`;
  if (diff < 2 * day) return 'Hier';
  if (diff < 7 * day) return `Il y a ${Math.floor(diff / day)} j`;
  const d = new Date(timestamp);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

/** « mardi 10 novembre » */
export function formatLongDate(date: Date = new Date()): string {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
}

/** « 10/11/2026 » */
export function formatShortDate(date: Date = new Date()): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0).replace('.', ',')} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

/** Nom de fichier sûr, sans caractères interdits. */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'document';
}

export function createId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
