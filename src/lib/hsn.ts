import masterText from '../data/hsn-master.txt?raw';

/**
 * Set of valid HSN/SAC codes. A 2/4/6-digit code is valid when it is a
 * heading of some code in the master (e.g. "8471" when "84713010" exists).
 */
export class HsnMaster {
  readonly codes: Set<string>;
  private readonly prefixes = new Set<string>();

  constructor(codes: Iterable<string>, readonly source: string) {
    this.codes = new Set(codes);
    for (const c of this.codes) {
      for (const len of [2, 4, 6]) if (c.length > len) this.prefixes.add(c.slice(0, len));
    }
  }

  static parse(textList: string, source: string) {
    return new HsnMaster(textList.split(/\s+/).filter((c) => /^\d{2,8}$/.test(c)), source);
  }

  static bundled() {
    return HsnMaster.parse(masterText, 'Bundled CBIC HSN/SAC list');
  }

  get size() {
    return this.codes.size;
  }

  isKnown(code: string) {
    return this.codes.has(code) || this.prefixes.has(code);
  }
}

export const isServiceCode = (code: string) => code.startsWith('99');

export interface HsnCheck {
  ok: boolean;
  code: string;
  reason?: string;
}

/** Validates a raw HSN cell, repairing lost leading zeros (Excel drops them for chapters 01-09). */
export function checkHsn(raw: string, master: HsnMaster, minDigits: number): HsnCheck {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return { ok: false, code: '', reason: 'HSN missing' };
  if (String(raw).replace(/[\s.]/g, '') !== digits && /[a-z]/i.test(String(raw))) {
    return { ok: false, code: digits, reason: 'HSN contains letters' };
  }
  const tries = digits.length % 2 === 1 ? ['0' + digits, digits] : [digits];
  // When neither form is valid, report the problem with the code as written (the last try).
  let reason = '';
  for (const c of tries) {
    if (![4, 6, 8].includes(c.length)) reason = `HSN must be 4, 6 or 8 digits (has ${digits.length})`;
    else if (c.length < minDigits) reason = `HSN must have at least ${minDigits} digits for your turnover`;
    else if (!master.isKnown(c)) reason = 'HSN not found in GST HSN master';
    else return { ok: true, code: c };
  }
  return { ok: false, code: digits, reason };
}

export type FixMethod = 'valid' | 'normalized' | 'remapped' | 'truncated' | 'manual' | 'unresolved';

export interface HsnLineRef {
  hsn: string;
  rate: number;
  txval: number;
  description?: string;
}

export interface HsnResolution {
  key: string;
  raw: string;
  rate: number;
  rows: number;
  txval: number;
  description: string;
  method: FixMethod;
  code: string;
  reason: string;
  /** Valid codes already in the return with the same rate, best match first. */
  candidates: string[];
}

export const hsnKey = (raw: string, rate: number) => `${String(raw).trim()}|${rate}`;

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/**
 * Decides what every distinct (HSN, rate) pair should become:
 *  1. valid as-is, or valid after restoring a dropped leading zero;
 *  2. otherwise moved to a valid HSN already used in the return at the SAME GST rate
 *     (same goods/services class, longest shared prefix, then largest taxable value);
 *  3. otherwise truncated to its longest valid heading (e.g. 8 -> 6 -> 4 digits);
 *  4. otherwise left unresolved for the user to pick manually.
 * Manual overrides (validated) win over all of the above.
 */
export function planHsnFixes(
  lines: HsnLineRef[],
  master: HsnMaster,
  minDigits: number,
  overrides: Record<string, string> = {},
): HsnResolution[] {
  const groups = new Map<string, HsnResolution>();
  for (const l of lines) {
    const key = hsnKey(l.hsn, l.rate);
    let g = groups.get(key);
    if (!g) {
      const chk = checkHsn(l.hsn, master, minDigits);
      g = {
        key,
        raw: String(l.hsn).trim(),
        rate: l.rate,
        rows: 0,
        txval: 0,
        description: '',
        method: chk.ok ? (chk.code === String(l.hsn).trim() ? 'valid' : 'normalized') : 'unresolved',
        code: chk.ok ? chk.code : '',
        reason: chk.reason ?? '',
        candidates: [],
      };
      groups.set(key, g);
    }
    g.rows++;
    g.txval += l.txval;
    g.description ||= l.description ?? '';
  }

  // Taxable value per valid code, per rate — the pool invalid HSNs can move into.
  const pool = new Map<number, Map<string, number>>();
  for (const g of groups.values()) {
    if (!g.code) continue;
    const byCode = pool.get(g.rate) ?? new Map<string, number>();
    byCode.set(g.code, (byCode.get(g.code) ?? 0) + g.txval);
    pool.set(g.rate, byCode);
  }

  for (const g of groups.values()) {
    if (g.code) continue;
    const digits = g.raw.replace(/\D/g, '');
    const service = isServiceCode(digits);
    const ranked = [...(pool.get(g.rate) ?? new Map()).entries()]
      .filter(([code]) => isServiceCode(code) === service || !digits)
      .sort((a, b) => commonPrefix(b[0], digits) - commonPrefix(a[0], digits) || b[1] - a[1])
      .map(([code]) => code);
    g.candidates = ranked;
    if (ranked.length) {
      g.code = ranked[0];
      g.method = 'remapped';
      continue;
    }
    for (const len of [6, 4]) {
      const head = (digits.length % 2 ? '0' + digits : digits).slice(0, len);
      if (head.length === len && len >= minDigits && len < digits.length && master.isKnown(head)) {
        g.code = head;
        g.method = 'truncated';
        break;
      }
    }
  }

  for (const g of groups.values()) {
    const o = overrides[g.key];
    if (!o) continue;
    const chk = checkHsn(o, master, minDigits);
    if (chk.ok) {
      g.code = chk.code;
      g.method = 'manual';
    }
  }

  return [...groups.values()].sort((a, b) => a.raw.localeCompare(b.raw) || a.rate - b.rate);
}
