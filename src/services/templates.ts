/**
 * Modèles de documents proposés sur l'écran d'accueil.
 */
import type { IconName } from '../components/ui/Icon';
import type { Cell, DocKind, SheetContent } from '../types';
import { formatShortDate } from '../utils/format';
import { htmlToText } from './converter/markup';
import { sheetPreview } from './spreadsheet/sheetModel';

export interface Template {
  id: string;
  kind: DocKind;
  title: string;
  description: string;
  icon: IconName;
  build(): { content: string; preview: string };
}

function textTemplate(html: () => string) {
  return () => {
    const content = html();
    return { content, preview: htmlToText(content).replace(/\s+/g, ' ').slice(0, 160) };
  };
}

function sheetTemplate(rows: (string | [string, Cell['s']])[][], colWidths?: Record<number, number>) {
  return () => {
    const sheet: SheetContent = { rows: 60, cols: 12, cells: {}, colWidths };
    rows.forEach((row, r) =>
      row.forEach((value, c) => {
        const [v, s] = Array.isArray(value) ? value : [value, undefined];
        if (v !== '' || s) sheet.cells[`${String.fromCharCode(65 + c)}${r + 1}`] = s ? { v, s } : { v };
      }),
    );
    return { content: JSON.stringify(sheet), preview: sheetPreview(sheet) };
  };
}

const head = { bold: true, bg: '#DCE6FF' } as const;
const total = { bold: true, format: 'currency' } as const;
const money = { format: 'currency' } as const;

export const TEMPLATES: Template[] = [
  {
    id: 'letter',
    kind: 'text',
    title: 'Lettre',
    description: 'Courrier formel',
    icon: 'email-outline',
    build: textTemplate(
      () =>
        `<p>Prénom Nom<br>Adresse<br>Code postal Ville</p><p style="text-align:right">À Ville, le ${formatShortDate()}</p><p><b>Objet :</b> objet de votre courrier</p><p>Madame, Monsieur,</p><p>Rédigez ici le corps de votre lettre. Présentez le contexte, formulez votre demande, puis concluez.</p><p>Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.</p><p><br></p><p>Prénom Nom</p>`,
    ),
  },
  {
    id: 'cv',
    kind: 'text',
    title: 'CV',
    description: 'Curriculum vitæ',
    icon: 'account-box-outline',
    build: textTemplate(
      () =>
        `<h1>Prénom Nom</h1><p>Intitulé du poste · ville · téléphone · courriel</p><hr><h2>Profil</h2><p>Deux à trois phrases qui résument votre parcours et ce que vous recherchez.</p><h2>Expérience</h2><p><b>Poste occupé</b> — Entreprise <i>(2023 – aujourd’hui)</i></p><ul><li>Réalisation ou responsabilité principale</li><li>Résultat chiffré</li></ul><h2>Formation</h2><p><b>Diplôme</b> — Établissement <i>(année)</i></p><h2>Compétences</h2><ul><li>Compétence 1</li><li>Compétence 2</li><li>Langues</li></ul>`,
    ),
  },
  {
    id: 'minutes',
    kind: 'text',
    title: 'Compte rendu',
    description: 'Réunion et décisions',
    icon: 'account-group-outline',
    build: textTemplate(
      () =>
        `<h1>Compte rendu de réunion</h1><p><b>Date :</b> ${formatShortDate()}<br><b>Participants :</b> </p><h2>Ordre du jour</h2><ol><li>Premier point</li><li>Deuxième point</li></ol><h2>Décisions</h2><ul><li>Décision prise</li></ul><h2>Actions à mener</h2><table><tbody><tr><th>Action</th><th>Responsable</th><th>Échéance</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><p><br></p>`,
    ),
  },
  {
    id: 'budget',
    kind: 'sheet',
    title: 'Budget mensuel',
    description: 'Revenus et dépenses',
    icon: 'wallet-outline',
    build: sheetTemplate(
      [
        [['Budget mensuel', { bold: true }]],
        [],
        [['Revenus', head], ['Montant', { ...head, align: 'right' }]],
        ['Salaire', ['2200', money]],
        ['Autres revenus', ['150', money]],
        [['Total revenus', { bold: true }], ['=SOMME(B4:B5)', total]],
        [],
        [['Dépenses', head], ['Montant', { ...head, align: 'right' }]],
        ['Loyer', ['750', money]],
        ['Courses', ['320', money]],
        ['Transport', ['85', money]],
        ['Abonnements', ['45,5', money]],
        ['Loisirs', ['120', money]],
        [['Total dépenses', { bold: true }], ['=SOMME(B9:B13)', total]],
        [],
        [['Reste à vivre', { bold: true }], ['=B6-B14', { ...total, bg: '#D3F3E1' }]],
        ['Dépense moyenne', ['=MOYENNE(B9:B13)', money]],
      ],
      { 0: 150, 1: 110 },
    ),
  },
  {
    id: 'invoice',
    kind: 'sheet',
    title: 'Facture',
    description: 'Lignes, TVA et total',
    icon: 'receipt-text-outline',
    build: sheetTemplate(
      [
        [['Facture n° 001', { bold: true }], '', '', ['=AUJOURDHUI()', { align: 'right' }]],
        [],
        [['Désignation', head], ['Quantité', { ...head, align: 'right' }], ['Prix unitaire', { ...head, align: 'right' }], ['Total HT', { ...head, align: 'right' }]],
        ['Prestation de conseil', '2', ['450', money], ['=B4*C4', money]],
        ['Développement', '5', ['380', money], ['=B5*C5', money]],
        ['Maintenance', '1', ['120', money], ['=B6*C6', money]],
        [],
        ['', '', ['Total HT', { bold: true, align: 'right' }], ['=SOMME(D4:D6)', total]],
        ['', '', ['TVA', { align: 'right' }], ['20%', { format: 'percent' }]],
        ['', '', ['Montant TVA', { align: 'right' }], ['=D8*D9', money]],
        ['', '', ['Total TTC', { bold: true, align: 'right' }], ['=D8+D10', { ...total, bg: '#D3F3E1' }]],
      ],
      { 0: 170, 2: 116, 3: 116 },
    ),
  },
  {
    id: 'grades',
    kind: 'sheet',
    title: 'Relevé de notes',
    description: 'Moyennes automatiques',
    icon: 'school-outline',
    build: sheetTemplate(
      [
        [['Élève', head], ['Maths', { ...head, align: 'right' }], ['Français', { ...head, align: 'right' }], ['Histoire', { ...head, align: 'right' }], ['Moyenne', { ...head, align: 'right' }]],
        ['Camille', '14', '12,5', '16', ['=MOYENNE(B2:D2)', { format: 'number', bold: true }]],
        ['Noah', '11', '15', '13,5', ['=MOYENNE(B3:D3)', { format: 'number', bold: true }]],
        ['Inès', '17,5', '14', '15', ['=MOYENNE(B4:D4)', { format: 'number', bold: true }]],
        ['Lucas', '9', '11', '12', ['=MOYENNE(B5:D5)', { format: 'number', bold: true }]],
        [],
        [['Moyenne de classe', { bold: true }], ['=MOYENNE(B2:B5)', { format: 'number' }], ['=MOYENNE(C2:C5)', { format: 'number' }], ['=MOYENNE(D2:D5)', { format: 'number' }], ['=MOYENNE(E2:E5)', { format: 'number', bold: true }]],
        [['Meilleure note', { bold: true }], '=MAX(B2:B5)', '=MAX(C2:C5)', '=MAX(D2:D5)', ['=MAX(E2:E5)', { format: 'number' }]],
      ],
      { 0: 150 },
    ),
  },
];
