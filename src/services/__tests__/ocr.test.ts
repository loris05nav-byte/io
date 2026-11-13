import { cleanOcrText, ocrTextToHtml } from '../ocr/ocrService';

describe('texte reconnu', () => {
  it('nettoie césures et espaces', () => {
    expect(cleanOcrText('Un  docu-\nment   scanné \n\n\n\nFin ')).toBe('Un document scanné\n\nFin');
  });
  it('réunit les lignes coupées et garde les lignes courtes', () => {
    expect(ocrTextToHtml('Titre\n\nLa séance est ouverte à 14 heures. Le budget de\nl’année est adopté.\n\nNom\nAdresse <1>')).toBe(
      '<p>Titre</p><p>La séance est ouverte à 14 heures. Le budget de l’année est adopté.</p><p>Nom<br>Adresse &lt;1&gt;</p>',
    );
  });
});
