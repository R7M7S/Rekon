import {
  B2B_INVOICE_TYPES,
  DOC_NATURES,
  EXEMP_DESCRIPTIONS,
  STATES,
  STATE_ALIASES,
  UQC,
  UQC_ALIASES,
  VALID_RATES,
} from './gstData';

export type Cell = string | number | boolean | Date | null | undefined;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isBlank = (v: Cell) => v === null || v === undefined || String(v).trim() === '';

export const text = (v: Cell) => (isBlank(v) ? '' : String(v).trim().replace(/\s+/g, ' '));

/** Lower-case alphanumerics only; used for fuzzy header and value matching. */
export const squash = (v: Cell) => text(v).toLowerCase().replace(/[^a-z0-9]/g, '');

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Parses "1,23,456.78", "(500)", "₹ 1,000", "-12.5 Dr" etc. Returns null when not numeric. */
export function toNumber(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (isBlank(v) || typeof v === 'boolean' || v instanceof Date) return null;
  let s = String(v).trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/\bcr\b/i.test(s)) neg = !neg;
  s = s.replace(/(rs\.?|inr|₹|dr|cr|,|\s)/gi, '');
  if (s.endsWith('%')) s = s.slice(0, -1);
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export const num = (v: Cell) => round2(toNumber(v) ?? 0);

/** Excel serial (1900 date system) -> UTC date. */
function fromSerial(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
}

/** Parses Indian-style dates (day first). Returns a UTC date or null. */
export function parseDate(v: Cell): Date | null {
  if (isBlank(v)) return null;
  if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === 'number') return v > 20000 && v < 80000 ? fromSerial(v) : null;
  const s = String(v).trim();
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);
  if (m) return mk(year(m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[-/. ]?([a-z]{3,9})[-/., ]*(\d{2,4})$/i);
  if (m) {
    const mon = MONTHS.findIndex((x) => x.toLowerCase() === m![2].slice(0, 3).toLowerCase());
    if (mon >= 0) return mk(year(m[3]), mon + 1, +m[1]);
  }
  return null;
}

const year = (y: string) => (y.length === 2 ? 2000 + +y : +y);

function mk(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCDate() === d ? dt : null;
}

/** GSTR-1 offline tool date format: dd-mmm-yyyy */
export function formatDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Returns the 2-digit state code for "32", "32-Kerala", "Kerala", "KL", ... */
export function stateCode(v: Cell): string | null {
  if (isBlank(v)) return null;
  const s = text(v);
  const m = s.match(/^(\d{1,2})\b/);
  if (m) {
    const code = m[1].padStart(2, '0');
    if (code === '25') return '26';
    return STATES[code] ? code : null;
  }
  const q = squash(s.replace(/&/g, 'and'));
  for (const [code, name] of Object.entries(STATES)) {
    if (squash(name.replace(/&/g, 'and')) === q) return code;
  }
  return STATE_ALIASES[q] ?? null;
}

export const posLabel = (code: string) => `${code}-${STATES[code]}`;

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Validates GSTIN structure and its mod-36 check digit. */
export function isValidGstin(g: string): boolean {
  if (!/^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$/.test(g)) return false;
  if (!STATES[g.slice(0, 2)] && !['99', '25'].includes(g.slice(0, 2))) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14];
}

export const cleanGstin = (v: Cell) => text(v).toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Accepts 18, "18%", 0.18 (fraction), "IGST 18". Returns the GST slab or null. */
export function parseRate(v: Cell): number | null {
  let n = toNumber(typeof v === 'string' ? v.replace(/[a-z ]/gi, '') : v);
  if (n === null) return null;
  if (n > 0 && n < 1 && !VALID_RATES.includes(n)) n = round2(n * 100);
  n = round2(n);
  return VALID_RATES.includes(n) ? n : null;
}

/** Returns a UQC code ("KGS") or null when unknown. */
export function uqcCode(v: Cell): string | null {
  if (isBlank(v)) return null;
  const s = text(v).toUpperCase();
  const head = s.split(/[-\s]/)[0].replace(/[^A-Z]/g, '');
  if (head in UQC) return head;
  const q = s.replace(/[^A-Z]/g, '');
  if (q in UQC) return q;
  if (UQC_ALIASES[q]) return UQC_ALIASES[q];
  if (UQC_ALIASES[head]) return UQC_ALIASES[head];
  for (const [code, name] of Object.entries(UQC)) if (name && name.replace(/[^A-Z]/g, '') === q) return code;
  return null;
}

export const uqcLabel = (code: string) => (UQC[code] ? `${code}-${UQC[code]}` : code);

export const yesNo = (v: Cell) => (/^(y|yes|true|1)$/i.test(text(v)) ? 'Y' : 'N');

/** Offline tool only accepts blank or 65 for "Applicable % of Tax Rate". */
export const applicablePct = (v: Cell) => (toNumber(v) === 65 ? 65 : '');

export function b2bInvoiceType(v: Cell): string | null {
  const q = squash(v);
  if (!q || q === 'r' || q.startsWith('regular') || q === 'b2b' || q === 'tax' || q === 'taxinvoice') return 'Regular B2B';
  if (q.includes('sez') || q.startsWith('sew')) {
    return q.includes('without') || q.includes('wop') ? 'SEZ supplies without payment' : 'SEZ supplies with payment';
  }
  if (q.includes('deemed') || q === 'de') return 'Deemed Exp';
  if (q.includes('intra') && q.includes('igst')) return 'Intra-State supplies attracting IGST';
  return B2B_INVOICE_TYPES.find((t) => squash(t) === q) ?? null;
}

export function noteType(v: Cell): 'C' | 'D' | null {
  const q = squash(v);
  if (q === 'c' || q.startsWith('credit') || q === 'cn') return 'C';
  if (q === 'd' || q.startsWith('debit') || q === 'dn') return 'D';
  return null;
}

export function exportType(v: Cell): 'WPAY' | 'WOPAY' | null {
  const q = squash(v);
  if (!q) return null;
  if (q.includes('wopay') || q.includes('without') || q === 'expwop' || q.includes('lut') || q.includes('bond')) return 'WOPAY';
  if (q.includes('wpay') || q.includes('with') || q === 'expwp') return 'WPAY';
  return null;
}

export function urType(v: Cell): 'B2CL' | 'EXPWP' | 'EXPWOP' | null {
  const q = squash(v);
  if (q === 'b2cl' || q.includes('b2c')) return 'B2CL';
  if (q === 'expwop' || q.includes('without') || q.includes('wop')) return 'EXPWOP';
  if (q === 'expwp' || q.includes('exp')) return 'EXPWP';
  return null;
}

export function docNature(v: Cell): string | null {
  const q = squash(v);
  if (!q) return null;
  const exact = DOC_NATURES.find((d) => squash(d) === q);
  if (exact) return exact;
  if (q.includes('challan')) {
    if (q.includes('job')) return DOC_NATURES[8];
    if (q.includes('approval')) return DOC_NATURES[9];
    if (q.includes('gas')) return DOC_NATURES[10];
    return DOC_NATURES[11];
  }
  if (q.includes('revised')) return DOC_NATURES[2];
  if (q.includes('debit')) return DOC_NATURES[3];
  if (q.includes('credit')) return DOC_NATURES[4];
  if (q.includes('receipt')) return DOC_NATURES[5];
  if (q.includes('refund')) return DOC_NATURES[7];
  if (q.includes('payment')) return DOC_NATURES[6];
  if (q.includes('inward') || q.includes('unregistered')) return DOC_NATURES[1];
  if (q.includes('invoice') || q.includes('outward') || q.includes('sales')) return DOC_NATURES[0];
  return null;
}

export function exempDescription(v: Cell): string | null {
  const q = squash(v);
  if (!q) return null;
  const inter = q.includes('inter');
  const intra = q.includes('intra');
  const unreg = q.includes('unreg') || q.includes('b2c') || q.includes('consumer');
  const reg = !unreg && (q.includes('reg') || q.includes('b2b'));
  if ((inter || intra) && (reg || unreg)) {
    return EXEMP_DESCRIPTIONS[(inter ? 0 : 1) + (unreg ? 2 : 0)];
  }
  return EXEMP_DESCRIPTIONS.find((d) => squash(d) === q) ?? null;
}

/** Offline tool rejects special characters (even full stops) in HSN descriptions. */
export const cleanDescription = (v: Cell) =>
  text(v).replace(/[^A-Za-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);

/** Document numbers: max 16 chars, alphanumerics plus "/" and "-". */
export const isValidDocNumber = (s: string) => /^[A-Za-z0-9/-]{1,16}$/.test(s) && !/^0+$/.test(s);
