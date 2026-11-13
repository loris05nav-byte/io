/**
 * Moteur de formules du tableur.
 *
 * - Références A1 et plages A1:B3 (les « $ » sont acceptés).
 * - Opérateurs + - * / ^ & %, comparaisons = <> < > <= >=.
 * - Fonctions en français et en anglais (SOMME/SUM, MOYENNE/AVERAGE…).
 * - Séparateur d'arguments « ; » ou « , » ; décimales avec « . » dans les formules.
 */

export type CellValue = number | string | boolean | null;

export class FormulaError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export const ERR = {
  DIV0: '#DIV/0!',
  NAME: '#NOM?',
  REF: '#REF!',
  VALUE: '#VALEUR!',
  CYCLE: '#CYCLE!',
  SYNTAX: '#ERREUR!',
  NUM: '#NOMBRE!',
} as const;

/* ------------------------------------------------------------------ */
/* Références                                                          */
/* ------------------------------------------------------------------ */

export function colToLetters(col: number): string {
  let n = col;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function cellKey(row: number, col: number): string {
  return `${colToLetters(col)}${row + 1}`;
}

export function parseKey(key: string): { row: number; col: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(key);
  if (!m) return null;
  return { col: lettersToCol(m[1]), row: parseInt(m[2], 10) - 1 };
}

export function rangeKey(r1: number, c1: number, r2: number, c2: number): string {
  const a = cellKey(Math.min(r1, r2), Math.min(c1, c2));
  const b = cellKey(Math.max(r1, r2), Math.max(c1, c2));
  return a === b ? a : `${a}:${b}`;
}

/* ------------------------------------------------------------------ */
/* Analyse lexicale                                                    */
/* ------------------------------------------------------------------ */

type TokenType = 'num' | 'str' | 'ref' | 'name' | 'op' | 'lparen' | 'rparen' | 'sep' | 'colon';

interface Token {
  type: TokenType;
  text: string;
  start: number;
  end: number;
}

const REF_RE = /^\$?[A-Za-z]{1,3}\$?\d{1,7}/;
const NAME_RE = /^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*/;
const NUM_RE = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === ' ') {
      i++;
      continue;
    }
    const rest = src.slice(i);
    if (ch === '"') {
      let j = i + 1;
      let text = '';
      for (;;) {
        if (j >= src.length) throw new FormulaError(ERR.SYNTAX);
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            text += '"';
            j += 2;
            continue;
          }
          break;
        }
        text += src[j++];
      }
      tokens.push({ type: 'str', text, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    const num = NUM_RE.exec(rest);
    if (num) {
      tokens.push({ type: 'num', text: num[0], start: i, end: i + num[0].length });
      i += num[0].length;
      continue;
    }
    const ref = REF_RE.exec(rest);
    if (ref) {
      const after = rest[ref[0].length];
      // « LOG10( » est une fonction, pas une référence ; « A1B » n'est pas une référence.
      const isRef = after === undefined || !/[A-Za-zÀ-ÿ0-9_.(]/.test(after);
      if (isRef) {
        tokens.push({ type: 'ref', text: ref[0], start: i, end: i + ref[0].length });
        i += ref[0].length;
        continue;
      }
    }
    const name = NAME_RE.exec(rest);
    if (name) {
      tokens.push({ type: 'name', text: name[0], start: i, end: i + name[0].length });
      i += name[0].length;
      continue;
    }
    const two = rest.slice(0, 2);
    if (two === '<>' || two === '<=' || two === '>=') {
      tokens.push({ type: 'op', text: two, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%'.includes(ch)) tokens.push({ type: 'op', text: ch, start: i, end: i + 1 });
    else if (ch === '(') tokens.push({ type: 'lparen', text: ch, start: i, end: i + 1 });
    else if (ch === ')') tokens.push({ type: 'rparen', text: ch, start: i, end: i + 1 });
    else if (ch === ';' || ch === ',') tokens.push({ type: 'sep', text: ch, start: i, end: i + 1 });
    else if (ch === ':') tokens.push({ type: 'colon', text: ch, start: i, end: i + 1 });
    else throw new FormulaError(ERR.SYNTAX);
    i++;
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Analyse syntaxique                                                  */
/* ------------------------------------------------------------------ */

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'ref'; key: string }
  | { t: 'range'; from: string; to: string }
  | { t: 'unary'; op: string; arg: Node }
  | { t: 'percent'; arg: Node }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'call'; name: string; args: Node[] };

const normalizeRef = (text: string) => text.replace(/\$/g, '').toUpperCase();

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.comparison();
    if (this.pos < this.tokens.length) throw new FormulaError(ERR.SYNTAX);
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(...ops: string[]): boolean {
    const t = this.peek();
    return !!t && t.type === 'op' && ops.includes(t.text);
  }

  private comparison(): Node {
    let left = this.concat();
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = this.tokens[this.pos++].text;
      left = { t: 'bin', op, l: left, r: this.concat() };
    }
    return left;
  }

  private concat(): Node {
    let left = this.additive();
    while (this.isOp('&')) {
      this.pos++;
      left = { t: 'bin', op: '&', l: left, r: this.additive() };
    }
    return left;
  }

  private additive(): Node {
    let left = this.term();
    while (this.isOp('+', '-')) {
      const op = this.tokens[this.pos++].text;
      left = { t: 'bin', op, l: left, r: this.term() };
    }
    return left;
  }

  private term(): Node {
    let left = this.power();
    while (this.isOp('*', '/')) {
      const op = this.tokens[this.pos++].text;
      left = { t: 'bin', op, l: left, r: this.power() };
    }
    return left;
  }

  private power(): Node {
    let left = this.unary();
    while (this.isOp('^')) {
      this.pos++;
      left = { t: 'bin', op: '^', l: left, r: this.unary() };
    }
    return left;
  }

  private unary(): Node {
    if (this.isOp('-', '+')) {
      const op = this.tokens[this.pos++].text;
      return { t: 'unary', op, arg: this.unary() };
    }
    let node = this.primary();
    while (this.isOp('%')) {
      this.pos++;
      node = { t: 'percent', arg: node };
    }
    return node;
  }

  private primary(): Node {
    const tok = this.tokens[this.pos++];
    if (!tok) throw new FormulaError(ERR.SYNTAX);
    switch (tok.type) {
      case 'num':
        return { t: 'num', v: parseFloat(tok.text) };
      case 'str':
        return { t: 'str', v: tok.text };
      case 'ref': {
        const from = normalizeRef(tok.text);
        if (this.peek()?.type === 'colon') {
          this.pos++;
          const end = this.tokens[this.pos++];
          if (!end || end.type !== 'ref') throw new FormulaError(ERR.SYNTAX);
          return { t: 'range', from, to: normalizeRef(end.text) };
        }
        return { t: 'ref', key: from };
      }
      case 'name': {
        const name = tok.text.toUpperCase();
        if (this.peek()?.type === 'lparen') {
          this.pos++;
          const args: Node[] = [];
          if (this.peek()?.type === 'rparen') {
            this.pos++;
            return { t: 'call', name, args };
          }
          for (;;) {
            args.push(this.comparison());
            const next = this.tokens[this.pos++];
            if (!next) throw new FormulaError(ERR.SYNTAX);
            if (next.type === 'rparen') break;
            if (next.type !== 'sep') throw new FormulaError(ERR.SYNTAX);
          }
          return { t: 'call', name, args };
        }
        if (name === 'VRAI' || name === 'TRUE') return { t: 'bool', v: true };
        if (name === 'FAUX' || name === 'FALSE') return { t: 'bool', v: false };
        throw new FormulaError(ERR.NAME);
      }
      case 'lparen': {
        const node = this.comparison();
        const close = this.tokens[this.pos++];
        if (!close || close.type !== 'rparen') throw new FormulaError(ERR.SYNTAX);
        return node;
      }
      default:
        throw new FormulaError(ERR.SYNTAX);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Valeurs                                                             */
/* ------------------------------------------------------------------ */

/** Interprète une saisie brute non-formule : nombre (virgule ou point), pourcentage, booléen ou texte. */
export function parseLiteral(raw: string): CellValue {
  const text = raw.trim();
  if (text === '') return null;
  // Apostrophe initiale : force le texte (« '=A1 » s'affiche « =A1 »), comme dans Excel.
  if (text.startsWith("'")) return text.slice(1);
  const upper = text.toUpperCase();
  if (upper === 'VRAI' || upper === 'TRUE') return true;
  if (upper === 'FAUX' || upper === 'FALSE') return false;
  const compact = text.replace(/[\s  ]/g, '');
  const m = /^([+-]?)(\d+(?:[.,]\d*)?|[.,]\d+)(%|€)?$/.exec(compact);
  if (m) {
    const n = parseFloat(`${m[1]}${m[2].replace(',', '.')}`);
    if (!Number.isNaN(n)) return m[3] === '%' ? n / 100 : n;
  }
  return text;
}

function toNumber(v: CellValue): number {
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const parsed = parseLiteral(v);
  if (typeof parsed === 'number') return parsed;
  throw new FormulaError(ERR.VALUE);
}

function toText(v: CellValue): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return formatNumber(v);
  return v;
}

function toBool(v: CellValue): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null) return false;
  const u = v.toUpperCase();
  if (u === 'VRAI' || u === 'TRUE') return true;
  if (u === 'FAUX' || u === 'FALSE') return false;
  throw new FormulaError(ERR.VALUE);
}

/** Supprime le bruit binaire des flottants (0,1 + 0,2 → 0,3). */
function clean(n: number): number {
  if (!Number.isFinite(n)) throw new FormulaError(ERR.NUM);
  return parseFloat(n.toPrecision(14));
}

/** Nombre au format français, sans séparateur de milliers (format « général »). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return ERR.NUM;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(4).replace('.', ',');
  return String(parseFloat(n.toPrecision(12))).replace('.', ',');
}

/* ------------------------------------------------------------------ */
/* Évaluation                                                          */
/* ------------------------------------------------------------------ */

type Arg = CellValue | CellValue[];

interface EvalContext {
  value(key: string): CellValue;
}

function expandRange(from: string, to: string): string[] {
  const a = parseKey(from);
  const b = parseKey(to);
  if (!a || !b) throw new FormulaError(ERR.REF);
  const keys: string[] = [];
  const r1 = Math.min(a.row, b.row);
  const r2 = Math.max(a.row, b.row);
  const c1 = Math.min(a.col, b.col);
  const c2 = Math.max(a.col, b.col);
  if ((r2 - r1 + 1) * (c2 - c1 + 1) > 200_000) throw new FormulaError(ERR.REF);
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) keys.push(cellKey(r, c));
  return keys;
}

/** Nombres d'une liste d'arguments : dans une plage, textes et vides sont ignorés (comme Excel). */
function numbersOf(args: Arg[]): number[] {
  const out: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const v of arg) if (typeof v === 'number') out.push(v);
    } else if (arg !== null) {
      out.push(toNumber(arg));
    }
  }
  return out;
}

const flatten = (args: Arg[]): CellValue[] => args.flatMap((a) => (Array.isArray(a) ? a : [a]));

function scalar(arg: Arg | undefined): CellValue {
  if (arg === undefined) throw new FormulaError(ERR.VALUE);
  if (Array.isArray(arg)) {
    if (arg.length === 1) return arg[0];
    throw new FormulaError(ERR.VALUE);
  }
  return arg;
}

function arity(args: Arg[], min: number, max: number = min): void {
  if (args.length < min || args.length > max) throw new FormulaError(ERR.VALUE);
}

type Fn = (args: Arg[]) => CellValue;

const sum = (args: Arg[]) => clean(numbersOf(args).reduce((a, b) => a + b, 0));

const average: Fn = (args) => {
  const nums = numbersOf(args);
  if (nums.length === 0) throw new FormulaError(ERR.DIV0);
  return clean(nums.reduce((a, b) => a + b, 0) / nums.length);
};

const FUNCTIONS: Record<string, Fn> = {
  SOMME: sum,
  SUM: sum,
  MOYENNE: average,
  AVERAGE: average,
  MIN: (args) => {
    const nums = numbersOf(args);
    return nums.length ? Math.min(...nums) : 0;
  },
  MAX: (args) => {
    const nums = numbersOf(args);
    return nums.length ? Math.max(...nums) : 0;
  },
  NB: (args) => countNumbers(args),
  COUNT: (args) => countNumbers(args),
  NBVAL: (args) => flatten(args).filter((v) => v !== null && v !== '').length,
  COUNTA: (args) => flatten(args).filter((v) => v !== null && v !== '').length,
  PRODUIT: (args) => clean(numbersOf(args).reduce((a, b) => a * b, 1)),
  PRODUCT: (args) => clean(numbersOf(args).reduce((a, b) => a * b, 1)),
  MEDIANE: (args) => median(numbersOf(args)),
  MEDIAN: (args) => median(numbersOf(args)),
  ABS: (args) => (arity(args, 1), Math.abs(toNumber(scalar(args[0])))),
  RACINE: (args) => sqrt(args),
  SQRT: (args) => sqrt(args),
  ARRONDI: (args) => round(args),
  ROUND: (args) => round(args),
  ENT: (args) => (arity(args, 1), Math.floor(toNumber(scalar(args[0])))),
  INT: (args) => (arity(args, 1), Math.floor(toNumber(scalar(args[0])))),
  MOD: (args) => {
    arity(args, 2);
    const d = toNumber(scalar(args[1]));
    if (d === 0) throw new FormulaError(ERR.DIV0);
    const n = toNumber(scalar(args[0]));
    return clean(n - d * Math.floor(n / d));
  },
  PUISSANCE: (args) => (arity(args, 2), clean(Math.pow(toNumber(scalar(args[0])), toNumber(scalar(args[1]))))),
  POWER: (args) => (arity(args, 2), clean(Math.pow(toNumber(scalar(args[0])), toNumber(scalar(args[1]))))),
  ET: (args) => flatten(args).filter((v) => v !== null).every(toBool),
  AND: (args) => flatten(args).filter((v) => v !== null).every(toBool),
  OU: (args) => flatten(args).filter((v) => v !== null).some(toBool),
  OR: (args) => flatten(args).filter((v) => v !== null).some(toBool),
  NON: (args) => (arity(args, 1), !toBool(scalar(args[0]))),
  NOT: (args) => (arity(args, 1), !toBool(scalar(args[0]))),
  CONCAT: (args) => flatten(args).map(toText).join(''),
  CONCATENER: (args) => flatten(args).map(toText).join(''),
  CONCATENATE: (args) => flatten(args).map(toText).join(''),
  NBCAR: (args) => (arity(args, 1), toText(scalar(args[0])).length),
  LEN: (args) => (arity(args, 1), toText(scalar(args[0])).length),
  MAJUSCULE: (args) => (arity(args, 1), toText(scalar(args[0])).toUpperCase()),
  UPPER: (args) => (arity(args, 1), toText(scalar(args[0])).toUpperCase()),
  MINUSCULE: (args) => (arity(args, 1), toText(scalar(args[0])).toLowerCase()),
  LOWER: (args) => (arity(args, 1), toText(scalar(args[0])).toLowerCase()),
  AUJOURDHUI: (args) => (arity(args, 0), today()),
  TODAY: (args) => (arity(args, 0), today()),
  PI: (args) => (arity(args, 0), Math.PI),
};

/** NB/COUNT : compte les nombres ; les arguments non numériques sont ignorés au lieu de produire une erreur. */
function countNumbers(args: Arg[]): number {
  let count = 0;
  for (const v of flatten(args)) {
    if (typeof v === 'number') count++;
  }
  return count;
}

function median(nums: number[]): number {
  if (nums.length === 0) throw new FormulaError(ERR.NUM);
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : clean((sorted[mid - 1] + sorted[mid]) / 2);
}

function sqrt(args: Arg[]): number {
  arity(args, 1);
  const n = toNumber(scalar(args[0]));
  if (n < 0) throw new FormulaError(ERR.NUM);
  return Math.sqrt(n);
}

function round(args: Arg[]): number {
  arity(args, 1, 2);
  const n = toNumber(scalar(args[0]));
  const digits = args.length > 1 ? Math.trunc(toNumber(scalar(args[1]))) : 0;
  const factor = Math.pow(10, digits);
  // Arrondi « commercial » (0,5 s'éloigne de zéro), corrigé du bruit flottant.
  return clean((Math.sign(n) * Math.round(clean(Math.abs(n) * factor))) / factor);
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Noms de fonctions reconnus (pour l'aide à la saisie). */
export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

function compare(op: string, a: CellValue, b: CellValue): boolean {
  let cmp: number;
  if (typeof a === 'string' || typeof b === 'string') {
    cmp = toText(a).toLowerCase().localeCompare(toText(b).toLowerCase());
  } else {
    cmp = toNumber(a) - toNumber(b);
  }
  switch (op) {
    case '=':
      return cmp === 0;
    case '<>':
      return cmp !== 0;
    case '<':
      return cmp < 0;
    case '>':
      return cmp > 0;
    case '<=':
      return cmp <= 0;
    default:
      return cmp >= 0;
  }
}

function evalNode(node: Node, ctx: EvalContext): CellValue {
  switch (node.t) {
    case 'num':
    case 'str':
    case 'bool':
      return node.v;
    case 'ref':
      return ctx.value(node.key);
    case 'range':
      throw new FormulaError(ERR.VALUE);
    case 'unary': {
      const n = toNumber(evalNode(node.arg, ctx));
      return node.op === '-' ? -n : n;
    }
    case 'percent':
      return clean(toNumber(evalNode(node.arg, ctx)) / 100);
    case 'bin': {
      const l = evalNode(node.l, ctx);
      const r = evalNode(node.r, ctx);
      switch (node.op) {
        case '+':
          return clean(toNumber(l) + toNumber(r));
        case '-':
          return clean(toNumber(l) - toNumber(r));
        case '*':
          return clean(toNumber(l) * toNumber(r));
        case '/': {
          const d = toNumber(r);
          if (d === 0) throw new FormulaError(ERR.DIV0);
          return clean(toNumber(l) / d);
        }
        case '^':
          return clean(Math.pow(toNumber(l), toNumber(r)));
        case '&':
          return toText(l) + toText(r);
        default:
          return compare(node.op, l, r);
      }
    }
    case 'call': {
      // SI/IF n'évalue que la branche retenue.
      if (node.name === 'SI' || node.name === 'IF') {
        if (node.args.length < 2 || node.args.length > 3) throw new FormulaError(ERR.VALUE);
        const cond = toBool(evalNode(node.args[0], ctx));
        if (cond) return evalNode(node.args[1], ctx);
        return node.args.length === 3 ? evalNode(node.args[2], ctx) : false;
      }
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new FormulaError(ERR.NAME);
      const args: Arg[] = node.args.map((arg) =>
        arg.t === 'range' ? expandRange(arg.from, arg.to).map((k) => ctx.value(k)) : evalNode(arg, ctx),
      );
      return fn(args);
    }
  }
}

const astCache = new Map<string, Node | FormulaError>();

function parseFormula(src: string): Node {
  let cached = astCache.get(src);
  if (cached === undefined) {
    try {
      cached = new Parser(tokenize(src)).parse();
    } catch (e) {
      cached = e instanceof FormulaError ? e : new FormulaError(ERR.SYNTAX);
    }
    if (astCache.size > 5000) astCache.clear();
    astCache.set(src, cached);
  }
  if (cached instanceof FormulaError) throw cached;
  return cached;
}

export const isFormula = (raw: string) => raw.startsWith('=') && raw.length > 1;

/**
 * Calcule toutes les cellules d'une feuille.
 * @returns valeur calculée par cellule ; une erreur est rendue sous forme de texte « #… ».
 */
export function computeSheet(getRaw: (key: string) => string | undefined, keys: Iterable<string>): Record<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();

  const ctx: EvalContext = {
    value(key) {
      if (cache.has(key)) {
        const v = cache.get(key)!;
        if (typeof v === 'string' && v.startsWith('#') && isErrorCode(v)) throw new FormulaError(v);
        return v;
      }
      const raw = getRaw(key) ?? '';
      if (!isFormula(raw)) {
        const v = parseLiteral(raw);
        cache.set(key, v);
        return v;
      }
      if (visiting.has(key)) throw new FormulaError(ERR.CYCLE);
      visiting.add(key);
      try {
        const v = evalNode(parseFormula(raw.slice(1)), ctx);
        cache.set(key, v);
        return v;
      } catch (e) {
        const code = e instanceof FormulaError ? e.code : ERR.SYNTAX;
        cache.set(key, code);
        throw new FormulaError(code);
      } finally {
        visiting.delete(key);
      }
    },
  };

  const out: Record<string, CellValue> = {};
  for (const key of keys) {
    try {
      out[key] = ctx.value(key);
    } catch (e) {
      out[key] = e instanceof FormulaError ? e.code : ERR.SYNTAX;
    }
  }
  return out;
}

const ERROR_CODES = new Set<string>(Object.values(ERR));
export const isErrorCode = (v: unknown): v is string => typeof v === 'string' && ERROR_CODES.has(v);

/* ------------------------------------------------------------------ */
/* Réécriture des références (insertion / suppression de lignes, colonnes) */
/* ------------------------------------------------------------------ */

export interface StructuralChange {
  axis: 'row' | 'col';
  /** Index (base 0) de la ligne/colonne insérée ou supprimée. */
  index: number;
  /** +1 pour une insertion, -1 pour une suppression. */
  delta: 1 | -1;
}

/** Adapte les références d'une formule après une insertion ou une suppression. */
export function adjustFormula(raw: string, change: StructuralChange): string {
  if (!isFormula(raw)) return raw;
  const body = raw.slice(1);
  let tokens: Token[];
  try {
    tokens = tokenize(body);
  } catch {
    return raw;
  }
  let out = '';
  let cursor = 0;
  for (const tok of tokens) {
    out += body.slice(cursor, tok.start);
    cursor = tok.end;
    if (tok.type !== 'ref') {
      out += body.slice(tok.start, tok.end);
      continue;
    }
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(tok.text)!;
    let col = lettersToCol(m[2]);
    let row = parseInt(m[4], 10) - 1;
    const pos = change.axis === 'row' ? row : col;
    let invalid = false;
    if (change.delta === 1) {
      if (pos >= change.index) change.axis === 'row' ? row++ : col++;
    } else if (pos === change.index) {
      invalid = true;
    } else if (pos > change.index) {
      change.axis === 'row' ? row-- : col--;
    }
    out += invalid ? ERR.REF : `${m[1]}${colToLetters(col)}${m[3]}${row + 1}`;
  }
  out += body.slice(cursor);
  return `=${out}`;
}
