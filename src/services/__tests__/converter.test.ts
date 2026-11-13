import { convert, importFile } from '../converter/converter';
import { detectSeparator, parseCsv, toCsv } from '../converter/csv';
import { htmlToMarkdown, htmlToText, markdownToHtml, sanitizeHtml, textToHtml } from '../converter/markup';

const DOC = '<h1>Titre</h1><p>Bonjour <b>le monde</b> &amp; <i>vous</i>.</p><ul><li>Un</li><li>Deux</li></ul><ol><li>A</li><li>B</li></ol>';

describe('balisage', () => {
  it('convertit le HTML en texte', () => {
    expect(htmlToText(DOC)).toBe('Titre\n\nBonjour le monde & vous.\n\n• Un\n• Deux\n\n1. A\n2. B');
  });
  it('convertit le HTML en Markdown', () => {
    expect(htmlToMarkdown(DOC)).toBe('# Titre\n\nBonjour **le monde** & *vous*.\n\n- Un\n- Deux\n\n1. A\n2. B');
  });
  it('convertit les tableaux en Markdown', () => {
    expect(htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>')).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });
  it('convertit le Markdown en HTML', () => {
    expect(markdownToHtml('# Titre\n\nUn **gras** et *italique*.\n\n- a\n- b\n\n| X | Y |\n|---|---|\n| 1 | 2 |')).toBe(
      '<h1>Titre</h1><p>Un <b>gras</b> et <i>italique</i>.</p><ul><li>a</li><li>b</li></ul><table><thead><tr><th>X</th><th>Y</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    );
  });
  it('échappe le texte brut', () => {
    expect(textToHtml('a < b\n\nc')).toBe('<p>a &lt; b</p><p><br></p><p>c</p>');
  });
  it('neutralise le HTML importé', () => {
    const html = sanitizeHtml('<html><head><title>x</title><script>alert(1)</script></head><body><p onclick="x()">ok</p><a href="javascript:alert(1)">l</a><script>bad()</script></body></html>');
    expect(html).toBe('<p>ok</p><a href="#">l</a>');
  });
});

describe('CSV', () => {
  it('lit les champs entre guillemets', () => {
    expect(parseCsv('a;b;c\r\n"x;1";"dit ""oui""";\n3;4;5')).toEqual([['a', 'b', 'c'], ['x;1', 'dit "oui"', ''], ['3', '4', '5']]);
  });
  it('détecte le séparateur', () => {
    expect(detectSeparator('a,b,c\n1,2,3')).toBe(',');
    expect(detectSeparator('a;b\n1;2')).toBe(';');
    expect(detectSeparator('a\tb')).toBe('\t');
  });
  it('écrit en échappant', () => {
    expect(toCsv([['a,b', 'c"d'], ['1', '2']], ',')).toBe('"a,b","c""d"\r\n1,2');
  });
});

describe('convertisseur', () => {
  const sheet = JSON.stringify({ rows: 10, cols: 5, cells: { A1: { v: 'Article' }, B1: { v: 'Prix', s: { bold: true } }, A2: { v: 'Stylo' }, B2: { v: '1,5' }, A3: { v: 'Total' }, B3: { v: '=SOMME(B2:B2)*2', s: { format: 'currency' } } } });

  it('exporte une feuille en CSV', () => {
    expect(convert({ title: 'Achats', kind: 'sheet', content: sheet }, 'csv', { csvSeparator: ';' }).data).toBe('Article;Prix\r\nStylo;1,5\r\nTotal;3');
    expect(convert({ title: 'Achats', kind: 'sheet', content: sheet }, 'csv', { csvSeparator: ',' }).data).toBe('Article,Prix\r\nStylo,1.5\r\nTotal,3');
  });
  it('exporte une feuille en texte, Markdown et HTML', () => {
    expect(convert({ title: 'Achats', kind: 'sheet', content: sheet }, 'txt').data).toBe('Article\tPrix\nStylo\t1,5\nTotal\t3,00 €');
    expect(convert({ title: 'Achats', kind: 'sheet', content: sheet }, 'md').data).toContain('| Total | 3,00 € |');
    const html = convert({ title: 'Achats', kind: 'sheet', content: sheet }, 'html');
    expect(html.fileName).toBe('Achats.html');
    expect(html.data).toContain('<td style="font-weight:700">Prix</td>');
    expect(html.data).toContain('<td style="text-align:right">3,00 €</td>');
  });
  it('exporte un document texte', () => {
    expect(convert({ title: 'Note: test?', kind: 'text', content: DOC }, 'txt').fileName).toBe('Note test.txt');
    expect(convert({ title: 'Note', kind: 'text', content: DOC }, 'pdf').data).toContain('<h1>Titre</h1>');
    expect(convert({ title: 'Note', kind: 'text', content: '<table><tr><td>a</td><td>b;c</td></tr></table>' }, 'csv').data).toBe('a;"b;c"');
  });
  it('importe des fichiers', () => {
    const csv = importFile('données.csv', 'Nom,Âge\nLéa,30\n=1+1,x');
    expect(csv.kind).toBe('sheet');
    const parsed = JSON.parse(csv.content);
    expect(parsed.cells.B2.v).toBe('30');
    expect(parsed.cells.A3.v).toBe("'=1+1");
    expect(importFile('note.txt', 'a\nb')).toEqual({ title: 'note', kind: 'text', content: '<p>a</p><p>b</p>' });
    expect(importFile('page.html', '<body><h1>x</h1></body>').content).toBe('<h1>x</h1>');
    expect(importFile('lisez.md', '# T').content).toBe('<h1>T</h1>');
  });
});
