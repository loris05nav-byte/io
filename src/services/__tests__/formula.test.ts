import { adjustFormula, cellKey, colToLetters, computeSheet, ERR, lettersToCol, parseKey, parseLiteral } from '../spreadsheet/formula';

function evalCells(cells: Record<string, string>) {
  return computeSheet((k) => cells[k], Object.keys(cells));
}

describe('références', () => {
  it('convertit colonnes et lettres', () => {
    expect(colToLetters(0)).toBe('A');
    expect(colToLetters(25)).toBe('Z');
    expect(colToLetters(26)).toBe('AA');
    expect(colToLetters(701)).toBe('ZZ');
    expect(lettersToCol('AA')).toBe(26);
    expect(cellKey(9, 2)).toBe('C10');
    expect(parseKey('$C$10')).toEqual({ row: 9, col: 2 });
  });
});

describe('saisie littérale', () => {
  it('reconnaît les nombres français', () => {
    expect(parseLiteral('12,5')).toBe(12.5);
    expect(parseLiteral('1 234,5')).toBe(1234.5);
    expect(parseLiteral('-3.25')).toBe(-3.25);
    expect(parseLiteral('50%')).toBe(0.5);
    expect(parseLiteral('12 €')).toBe(12);
    expect(parseLiteral('abc')).toBe('abc');
    expect(parseLiteral('')).toBeNull();
    expect(parseLiteral("'=A1")).toBe('=A1');
    expect(parseLiteral('vrai')).toBe(true);
  });
});

describe('formules', () => {
  it('calcule SOMME et MOYENNE (FR et EN)', () => {
    const v = evalCells({ A1: '10', A2: '20', A3: '30,5', A4: 'texte', B1: '=SOMME(A1:A4)', B2: '=MOYENNE(A1:A3)', B3: '=sum(a1;a2)', B4: '=AVERAGE(A1,A2)' });
    expect(v.B1).toBe(60.5);
    expect(v.B2).toBeCloseTo(20.1666666, 5);
    expect(v.B3).toBe(30);
    expect(v.B4).toBe(15);
  });

  it('respecte les priorités des opérateurs', () => {
    const v = evalCells({ A1: '=1+2*3', A2: '=(1+2)*3', A3: '=2^3^2', A4: '=-2^2', A5: '=10/4', A6: '=50%*200', A7: '=0.1+0.2', A8: '="a"&"b"&1' });
    expect(v.A1).toBe(7);
    expect(v.A2).toBe(9);
    expect(v.A3).toBe(64);
    expect(v.A4).toBe(4);
    expect(v.A5).toBe(2.5);
    expect(v.A6).toBe(100);
    expect(v.A7).toBe(0.3);
    expect(v.A8).toBe('ab1');
  });

  it('gère les fonctions usuelles', () => {
    const v = evalCells({
      A1: '4', A2: '9', A3: '1',
      B1: '=MIN(A1:A3)', B2: '=MAX(A1:A3)', B3: '=NB(A1:A3;"x")', B4: '=SI(A1>A3;"oui";"non")',
      B5: '=ARRONDI(2,675*1;2)', B6: '=RACINE(A2)', B7: '=MEDIANE(A1:A3)', B8: '=NBVAL(A1:A4)', B9: '=ARRONDI(3.14159;2)',
      C1: '=ET(A1>1;A2>1)', C2: '=OU(A1>100;FAUX)', C3: '=MOD(10;3)', C4: '=PRODUIT(A1:A3)', C5: '=ABS(-5)',
    });
    expect(v.B1).toBe(1);
    expect(v.B2).toBe(9);
    expect(v.B3).toBe(3);
    expect(v.B4).toBe('oui');
    expect(v.B6).toBe(3);
    expect(v.B7).toBe(4);
    expect(v.B8).toBe(3);
    expect(v.B9).toBe(3.14);
    expect(v.C1).toBe(true);
    expect(v.C2).toBe(false);
    expect(v.C3).toBe(1);
    expect(v.C4).toBe(36);
    expect(v.C5).toBe(5);
  });

  it('propage les dépendances en chaîne', () => {
    const v = evalCells({ A1: '2', A2: '=A1*2', A3: '=A2+A1', A4: '=SOMME(A1:A3)' });
    expect(v.A3).toBe(6);
    expect(v.A4).toBe(12);
  });

  it('signale les erreurs', () => {
    const v = evalCells({ A1: '=1/0', A2: '=A2+1', A3: '=INCONNU(1)', A4: '=1+', A5: '="a"*2', A6: '=A1+1', A7: '=B1', B1: '=A7', A8: '=MOYENNE(C1:C3)' });
    expect(v.A1).toBe(ERR.DIV0);
    expect(v.A2).toBe(ERR.CYCLE);
    expect(v.A3).toBe(ERR.NAME);
    expect(v.A4).toBe(ERR.SYNTAX);
    expect(v.A5).toBe(ERR.VALUE);
    expect(v.A6).toBe(ERR.DIV0);
    expect(v.A7).toBe(ERR.CYCLE);
    expect(v.A8).toBe(ERR.DIV0);
  });

  it('traite les cellules vides comme zéro', () => {
    const v = evalCells({ A1: '=B1+5', A2: '=SOMME(B1:B9)' });
    expect(v.A1).toBe(5);
    expect(v.A2).toBe(0);
  });
});

describe('réécriture des références', () => {
  it('décale lors d’une insertion de ligne', () => {
    expect(adjustFormula('=SOMME(A1:A5)+B7', { axis: 'row', index: 2, delta: 1 })).toBe('=SOMME(A1:A6)+B8');
  });
  it('décale lors d’une insertion de colonne', () => {
    expect(adjustFormula('=A1+$C$3', { axis: 'col', index: 1, delta: 1 })).toBe('=A1+$D$3');
  });
  it('invalide les références supprimées', () => {
    expect(adjustFormula('=A1+A2+A3', { axis: 'row', index: 1, delta: -1 })).toBe('=A1+#REF!+A2');
  });
  it('ignore les chaînes et les noms de fonctions', () => {
    expect(adjustFormula('="A1"&A1', { axis: 'row', index: 0, delta: 1 })).toBe('="A1"&A2');
  });
});
