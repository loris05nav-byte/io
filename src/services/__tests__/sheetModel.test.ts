import {
  applyStyle,
  computeValues,
  createSheet,
  deleteCol,
  deleteRow,
  detectAutoRange,
  displayText,
  formatValue,
  insertCol,
  insertRow,
  selectionStats,
  setCellValue,
} from '../spreadsheet/sheetModel';

function build(values: Record<string, string>) {
  const sheet = createSheet(20, 6);
  for (const [k, v] of Object.entries(values)) sheet.cells[k] = { v };
  return sheet;
}

describe('modèle de feuille', () => {
  it('écrit et efface des cellules', () => {
    let sheet = createSheet();
    sheet = setCellValue(sheet, 0, 0, '12');
    expect(sheet.cells.A1).toEqual({ v: '12' });
    sheet = setCellValue(sheet, 0, 0, '');
    expect(sheet.cells.A1).toBeUndefined();
  });

  it('insère une ligne et adapte les formules', () => {
    const sheet = insertRow(build({ A1: '1', A2: '2', A3: '=SOMME(A1:A2)' }), 1);
    expect(sheet.cells.A2).toBeUndefined();
    expect(sheet.cells.A3.v).toBe('2');
    expect(sheet.cells.A4.v).toBe('=SOMME(A1:A3)');
    expect(sheet.rows).toBe(21);
    expect(computeValues(sheet).A4).toBe(3);
  });

  it('supprime une ligne', () => {
    const sheet = deleteRow(build({ A1: '1', A2: '2', A3: '3', B1: '=A3' }), 1);
    expect(sheet.cells.A2.v).toBe('3');
    expect(sheet.cells.B1.v).toBe('=A2');
  });

  it('insère et supprime une colonne', () => {
    let sheet = insertCol(build({ A1: '1', B1: '2', C1: '=A1+B1' }), 1);
    expect(sheet.cells.C1.v).toBe('2');
    expect(sheet.cells.D1.v).toBe('=A1+C1');
    sheet = deleteCol(sheet, 1);
    expect(sheet.cells.C1.v).toBe('=A1+B1');
    expect(computeValues(sheet).C1).toBe(3);
  });

  it('applique des styles sur une plage', () => {
    let sheet = build({ A1: 'x' });
    sheet = applyStyle(sheet, { r1: 0, c1: 0, r2: 0, c2: 1 }, { bold: true });
    expect(sheet.cells.A1.s?.bold).toBe(true);
    expect(sheet.cells.B1).toEqual({ v: '', s: { bold: true } });
    sheet = applyStyle(sheet, { r1: 0, c1: 0, r2: 0, c2: 1 }, { bold: false });
    expect(sheet.cells.B1).toBeUndefined();
    expect(sheet.cells.A1).toEqual({ v: 'x' });
  });

  it('formate les valeurs', () => {
    expect(formatValue(1234.5, 'number')).toBe('1 234,50');
    expect(formatValue(0.25, 'percent')).toBe('25 %');
    expect(formatValue(0.125, 'percent')).toBe('12,50 %');
    expect(formatValue(-1999.9, 'currency')).toBe('-1 999,90 €');
    expect(formatValue(3.5)).toBe('3,5');
    expect(formatValue(true)).toBe('VRAI');
    const sheet = build({ A1: '=1/3' });
    expect(displayText(sheet, computeValues(sheet), 'A1')).toBe('0,333333333333');
  });

  it('calcule les statistiques de sélection et la plage automatique', () => {
    const sheet = build({ A1: '10', A2: '20', A3: 'x', B2: '5' });
    const values = computeValues(sheet);
    expect(selectionStats(values, { r1: 0, c1: 0, r2: 2, c2: 1 })).toEqual({ count: 3, sum: 35, average: 35 / 3 > 11.66 ? parseFloat((35 / 3).toPrecision(14)) : 0, min: 5, max: 20 });
    expect(detectAutoRange(sheet, values, 2, 0)).toBe('A1:A2');
    expect(detectAutoRange(sheet, values, 1, 2)).toBe('A2:B2');
    expect(detectAutoRange(sheet, values, 5, 5)).toBeNull();
  });
});
