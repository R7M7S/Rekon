import type { Grid, SheetMapping } from './detect';
import { EXEMP_DESCRIPTIONS } from './gstData';
import { type HsnMaster, type HsnResolution, isServiceCode, planHsnFixes } from './hsn';
import {
  type Cell,
  applicablePct,
  b2bInvoiceType,
  cleanDescription,
  cleanGstin,
  docNature,
  exempDescription,
  exportType,
  formatDate,
  isBlank,
  isValidDocNumber,
  isValidGstin,
  noteType,
  num,
  parseDate,
  parseRate,
  posLabel,
  round2,
  squash,
  stateCode,
  text,
  toNumber,
  uqcCode,
  uqcLabel,
  urType,
  yesNo,
} from './normalize';
import { OUTPUT_SHEETS, type SectionId } from './schema';

export interface Settings {
  /** Supplier GSTIN — needed to tell inter-state from intra-state supplies. */
  gstin: string;
  /** Return period as YYYY-MM, or '' to skip the date check. */
  period: string;
  /** 4 when aggregate turnover is up to ₹5 Cr, 6 above that. */
  minHsnDigits: 4 | 6;
  /** B2C invoices above this value that are inter-state go to B2CL. */
  b2clLimit: number;
  /** Tab for an HSN sheet that is not split into B2B/B2C. */
  hsnDefaultTab: 'hsn_b2b' | 'hsn_b2c';
  /** Merge B2CL rows that don't qualify (intra-state / small) into B2CS. */
  moveSmallB2cl: boolean;
  /** Report 0% lines of B2B/B2CL/B2CS as nil-rated supplies in Table 8 instead. */
  zeroRateToNil: boolean;
  /** Where to report the ERP nil sheet's total that is not covered by 0% invoice lines. */
  nilSheetDiff: 'ignore' | NilType;
}

/** Table 8 rows, in EXEMP_DESCRIPTIONS order, with their GSTR-1 JSON codes. */
export const NIL_TYPES = ['INTRB2B', 'INTRAB2B', 'INTRB2C', 'INTRAB2C'] as const;
export type NilType = (typeof NIL_TYPES)[number];

export const DEFAULT_SETTINGS: Settings = {
  gstin: '',
  period: '',
  minHsnDigits: 4,
  b2clLimit: 100000,
  hsnDefaultTab: 'hsn_b2b',
  moveSmallB2cl: true,
  zeroRateToNil: true,
  nilSheetDiff: 'ignore',
};

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  section: string;
  ref: string;
  message: string;
}

export interface Change {
  section: string;
  ref: string;
  field: string;
  from: string;
  to: string;
  reason: string;
}

export interface ReconLine {
  label: string;
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
}

export interface Result {
  /** output sheet key -> rows in OUTPUT_SHEETS header order */
  sheets: Record<string, (string | number)[][]>;
  issues: Issue[];
  changes: Change[];
  hsn: HsnResolution[];
  recon: ReconLine[];
  sourceRows: Record<string, number>;
}

interface Rec {
  ref: string;
  v: Record<string, Cell>;
}

type Out = Record<string, string | number>;

const TOTAL_ROW = /^(grand\s*)?(sub\s*)?totals?\b|^summary|^last\s*row\b/i;

/** Pulls mapped records out of every sheet, grouped by section. */
export function extractRecords(grids: Record<string, Grid>, mappings: SheetMapping[]) {
  const bySection: Partial<Record<SectionId, Rec[]>> = {};
  for (const m of mappings) {
    if (!m.section) continue;
    const grid = grids[m.sheet] ?? [];
    const list = (bySection[m.section] ??= []);
    for (let r = m.headerRow + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const v: Record<string, Cell> = {};
      let filled = 0;
      for (const [key, col] of Object.entries(m.columns)) {
        v[key] = row[col];
        if (!isBlank(row[col])) filled++;
      }
      if (!filled) continue;
      const first = row.find((c) => !isBlank(c));
      if (typeof first === 'string' && TOTAL_ROW.test(first.trim())) continue;
      list.push({ ref: `${m.sheet}!R${r + 1}`, v });
    }
  }
  return bySection;
}

class Ctx {
  issues: Issue[] = [];
  changes: Change[] = [];
  supplierState: string | null;
  constructor(public settings: Settings) {
    const g = cleanGstin(settings.gstin);
    this.supplierState = isValidGstin(g) ? g.slice(0, 2) : null;
  }
  issue(severity: Severity, section: string, ref: string, message: string) {
    this.issues.push({ severity, section, ref, message });
  }
  change(section: string, ref: string, field: string, from: Cell, to: Cell, reason: string) {
    this.changes.push({ section, ref, field, from: text(from), to: text(to), reason });
  }

  gstin(sec: string, r: Rec): string {
    const g = cleanGstin(r.v.gstin);
    if (!g) this.issue('error', sec, r.ref, 'Recipient GSTIN is missing (should this be a B2C supply?)');
    else if (!isValidGstin(g)) this.issue('error', sec, r.ref, `Recipient GSTIN "${g}" is invalid (format or check digit)`);
    if (g && g !== text(r.v.gstin)) this.change(sec, r.ref, 'GSTIN', r.v.gstin, g, 'Removed spaces / converted to upper case');
    return g;
  }

  docNo(sec: string, r: Rec, key: string, label: string): string {
    const raw = r.v[key];
    const s = typeof raw === 'number' ? String(raw) : text(raw).replace(/\s+/g, '');
    if (!s) this.issue('error', sec, r.ref, `${label} is missing`);
    else if (!isValidDocNumber(s)) {
      this.issue('error', sec, r.ref, `${label} "${s}" must be max 16 characters using only letters, digits, "/" and "-"`);
    }
    return s;
  }

  date(sec: string, r: Rec, key: string, label: string, checkPeriod = true): string {
    const raw = r.v[key];
    const d = parseDate(raw);
    if (!d) {
      this.issue('error', sec, r.ref, isBlank(raw) ? `${label} is missing` : `${label} "${text(raw)}" is not a valid date`);
      return text(raw);
    }
    const p = this.settings.period;
    if (checkPeriod && p) {
      const [y, m] = p.split('-').map(Number);
      const end = Date.UTC(y, m, 0);
      if (d.getTime() > end) this.issue('error', sec, r.ref, `${label} ${formatDate(d)} is after the return period`);
      else if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1) {
        this.issue('warning', sec, r.ref, `${label} ${formatDate(d)} is outside the return period ${p}`);
      }
    }
    return formatDate(d);
  }

  pos(sec: string, r: Rec, fallbackGstin = '', required = true): string {
    let code = stateCode(r.v.pos);
    if (!code && fallbackGstin && isValidGstin(fallbackGstin)) {
      code = fallbackGstin.slice(0, 2);
      this.change(sec, r.ref, 'Place Of Supply', r.v.pos, posLabel(code), 'Derived from recipient GSTIN');
      return posLabel(code);
    }
    if (!code) {
      if (required) {
        this.issue('error', sec, r.ref, isBlank(r.v.pos) ? 'Place of supply is missing' : `Place of supply "${text(r.v.pos)}" not recognised`);
      }
      return '';
    }
    const label = posLabel(code);
    if (text(r.v.pos) !== label) this.change(sec, r.ref, 'Place Of Supply', r.v.pos, label, 'Converted to "code-State" format');
    return label;
  }

  rate(sec: string, r: Rec): number | null {
    const rt = parseRate(r.v.rate);
    if (rt === null) {
      this.issue('error', sec, r.ref, isBlank(r.v.rate) ? 'GST rate is missing' : `GST rate "${text(r.v.rate)}" is not a valid GST slab`);
    } else if (typeof r.v.rate !== 'number' || r.v.rate !== rt) {
      if (text(r.v.rate) !== String(rt)) this.change(sec, r.ref, 'Rate', r.v.rate, rt, 'Normalised GST rate');
    }
    return rt;
  }

  /** Credit/debit note amounts are reported as positive values. */
  amount(sec: string, r: Rec, key: string, label: string, positive = false): number {
    const raw = r.v[key];
    if (!isBlank(raw) && toNumber(raw) === null) this.issue('error', sec, r.ref, `${label} "${text(raw)}" is not a number`);
    let n = num(raw);
    if (positive && n < 0) {
      this.change(sec, r.ref, label, n, -n, 'Notes are reported as positive amounts');
      n = -n;
    } else if (!positive && n < 0) {
      this.issue('warning', sec, r.ref, `${label} is negative (${n}); returns should be amended via CDN instead`);
    }
    return n;
  }

  ecom(sec: string, r: Rec): string {
    const g = cleanGstin(r.v.ecom);
    if (g && !isValidGstin(g)) this.issue('error', sec, r.ref, `E-commerce GSTIN "${g}" is invalid`);
    return g;
  }
}

/** Sums numeric fields of rows sharing a key; keeps the first row's text fields. */
function aggregate(rows: { key: string; out: Out; refs: string[] }[], sumKeys: string[]) {
  const map = new Map<string, { out: Out; refs: string[] }>();
  for (const r of rows) {
    const cur = map.get(r.key);
    if (!cur) {
      map.set(r.key, { out: { ...r.out }, refs: [...r.refs] });
      continue;
    }
    for (const k of sumKeys) cur.out[k] = round2(Number(cur.out[k] || 0) + Number(r.out[k] || 0));
    cur.refs.push(...r.refs);
  }
  return [...map.values()];
}

const pick = (o: Out, keys: string[]) => keys.map((k) => o[k] ?? '');

/** Invoice value fallback: taxable value plus tax at the given rate plus cess. */
const grossOf = (txval: number, rate: number, cess: number) => round2(txval * (1 + rate / 100) + cess);

function invoiceRows(ctx: Ctx, sec: string, recs: Rec[], b2b: boolean) {
  const rows: { key: string; out: Out; refs: string[] }[] = [];
  for (const r of recs) {
    const gstin = b2b ? ctx.gstin(sec, r) : '';
    const inum = ctx.docNo(sec, r, 'inum', 'Invoice number');
    const idt = ctx.date(sec, r, 'idt', 'Invoice date');
    const pos = ctx.pos(sec, r, gstin);
    const rate = ctx.rate(sec, r);
    const txval = ctx.amount(sec, r, 'txval', 'Taxable value');
    const cess = ctx.amount(sec, r, 'cess', 'Cess amount');
    const out: Out = { gstin, name: text(r.v.name), inum, idt, pos, apct: applicablePct(r.v.apct), rate: rate ?? '', txval, cess, ecom: ctx.ecom(sec, r) };
    out.val = ctx.amount(sec, r, 'val', 'Invoice value');
    if (b2b) {
      out.rchrg = yesNo(r.v.rchrg);
      const t = b2bInvoiceType(r.v.invtyp);
      if (!t) ctx.issue('warning', sec, r.ref, `Invoice type "${text(r.v.invtyp)}" not recognised; using Regular B2B`);
      out.invtyp = t ?? 'Regular B2B';
      if (out.invtyp !== text(r.v.invtyp) && !isBlank(r.v.invtyp)) ctx.change(sec, r.ref, 'Invoice Type', r.v.invtyp, out.invtyp, 'Mapped to offline tool value');
    }
    rows.push({ key: [gstin, inum, out.apct, rate].join('|'), out, refs: [r.ref] });
  }
  return rows;
}

/**
 * Works out each invoice's value from its rows. ERPs either repeat the invoice
 * value on every row, or (Glowsis) give each line's own value. If the largest
 * row value covers the invoice's taxable value plus tax, it is the repeated
 * invoice value; otherwise the row values are line values and are added up.
 */
function invoiceValues(ctx: Ctx, sec: string, rows: { out: Out; refs: string[] }[]) {
  const byInv = new Map<string, { out: Out; refs: string[] }[]>();
  for (const r of rows) {
    const k = `${r.out.gstin}|${r.out.inum}`;
    byInv.set(k, [...(byInv.get(k) ?? []), r]);
  }
  const values = new Map<string, number>();
  let summed = 0;
  for (const [k, list] of byInv) {
    const vals = list.map((l) => Number(l.out.val) || 0);
    const gross = list.reduce((s, l) => s + grossOf(Number(l.out.txval), Number(l.out.rate) || 0, Number(l.out.cess)), 0);
    const max = Math.max(...vals);
    if (!max) {
      values.set(k, round2(gross));
      ctx.change(sec, list[0].refs[0], 'Invoice Value', '', round2(gross), 'Invoice value missing; computed from taxable value + tax');
    } else if (list.length > 1 && max < gross - 1) {
      values.set(k, round2(vals.reduce((a, b) => a + b, 0)));
      summed++;
    } else {
      values.set(k, max);
      if (new Set(vals).size > 1) {
        ctx.issue('warning', sec, list.map((l) => l.refs[0]).join(', '), `Invoice ${list[0].out.inum} has different invoice values on its rows; using ${max}`);
      }
    }
  }
  if (summed) ctx.issue('info', sec, '', `${summed} invoice(s) list a value per line; invoice value = sum of its lines`);
  return values;
}

/** One row per invoice+rate; invoice value must be the same on all rows of an invoice. */
function finishInvoices(ctx: Ctx, sec: string, rows: { key: string; out: Out; refs: string[] }[], b2b: boolean) {
  const invVal = invoiceValues(ctx, sec, rows);
  const merged = aggregate(rows, ['txval', 'cess']);
  if (merged.length < rows.length) {
    ctx.issue('info', sec, '', `${rows.length} line items combined into ${merged.length} invoice/rate rows`);
  }
  const byInv = new Map<string, { out: Out; refs: string[] }[]>();
  for (const m of merged) {
    const k = `${m.out.gstin}|${m.out.inum}`;
    byInv.set(k, [...(byInv.get(k) ?? []), m]);
  }
  const numbers = new Map<string, string>();
  for (const [k, list] of byInv) {
    const first = list[0].out;
    const val = invVal.get(k) ?? 0;
    const taxable = list.reduce((s, l) => s + Number(l.out.txval), 0);
    if (taxable > val + 1) ctx.issue('warning', sec, list[0].refs[0], `Invoice ${first.inum}: taxable value ${round2(taxable)} exceeds invoice value ${val}`);
    for (const l of list) {
      l.out.val = val;
      for (const f of ['idt', 'pos'] as const) {
        if (l.out[f] !== first[f]) ctx.issue('error', sec, l.refs[0], `Invoice ${first.inum} has inconsistent ${f === 'idt' ? 'date' : 'place of supply'} across rows`);
      }
    }
    const prev = numbers.get(String(first.inum));
    if (prev !== undefined && b2b) ctx.issue('error', sec, list[0].refs[0], `Invoice number ${first.inum} is used for more than one recipient`);
    numbers.set(String(first.inum), k);
  }
  return merged;
}

function noteRows(ctx: Ctx, sec: 'cdnr' | 'cdnur', recs: Rec[]) {
  const rows: { key: string; out: Out; refs: string[] }[] = [];
  for (const r of recs) {
    const gstin = sec === 'cdnr' ? ctx.gstin(sec, r) : '';
    const out: Out = { gstin, name: text(r.v.name) };
    out.nt_num = ctx.docNo(sec, r, 'nt_num', 'Note number');
    out.nt_dt = ctx.date(sec, r, 'nt_dt', 'Note date');
    const t = noteType(r.v.ntty);
    if (!t) ctx.issue('error', sec, r.ref, isBlank(r.v.ntty) ? 'Note type (C/D) is missing' : `Note type "${text(r.v.ntty)}" must be C or D`);
    out.ntty = t ?? text(r.v.ntty);
    out.rate = ctx.rate(sec, r) ?? '';
    out.apct = applicablePct(r.v.apct);
    out.nt_val = ctx.amount(sec, r, 'nt_val', 'Note value', true);
    out.txval = ctx.amount(sec, r, 'txval', 'Taxable value', true);
    out.cess = ctx.amount(sec, r, 'cess', 'Cess amount', true);
    if (sec === 'cdnr') {
      out.pos = ctx.pos(sec, r, gstin);
      out.rchrg = yesNo(r.v.rchrg);
      out.nt_sply = b2bInvoiceType(r.v.nt_sply) ?? 'Regular B2B';
    } else {
      const pos = stateCode(r.v.pos);
      let ut = urType(r.v.ur_type);
      if (!ut) {
        ut = !pos || pos === '96' ? (out.rate ? 'EXPWP' : 'EXPWOP') : 'B2CL';
        ctx.change(sec, r.ref, 'UR Type', r.v.ur_type, ut, 'UR type missing; inferred from place of supply / rate');
      }
      out.ur_type = ut;
      out.pos = ut === 'B2CL' ? ctx.pos(sec, r) : '';
    }
    rows.push({ key: [gstin, out.nt_num, out.apct, out.rate].join('|'), out, refs: [r.ref] });
  }
  const merged = aggregate(rows, ['txval', 'cess']);
  const byNote = new Map<string, number>();
  for (const m of merged) {
    const k = `${m.out.gstin}|${m.out.nt_num}`;
    byNote.set(k, Math.max(byNote.get(k) ?? 0, Number(m.out.nt_val)));
  }
  for (const m of merged) m.out.nt_val = byNote.get(`${m.out.gstin}|${m.out.nt_num}`) ?? m.out.nt_val;
  return merged;
}

function b2csRow(ctx: Ctx, sec: string, r: Rec) {
  const ecom = ctx.ecom(sec, r);
  const out: Out = {
    type: ecom ? 'E' : 'OE',
    pos: ctx.pos(sec, r),
    apct: applicablePct(r.v.apct),
    rate: ctx.rate(sec, r) ?? '',
    txval: ctx.amount(sec, r, 'txval', 'Taxable value'),
    cess: ctx.amount(sec, r, 'cess', 'Cess amount'),
    ecom,
  };
  return { key: [out.type, out.pos, out.apct, out.rate, ecom].join('|'), out, refs: [r.ref] };
}

interface HsnLine {
  ref: string;
  tab: 'hsn_b2b' | 'hsn_b2c';
  raw: string;
  desc: string;
  uqc: string;
  qty: number;
  val: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  cess: number;
  rate: number;
}

function hsnLines(ctx: Ctx, bySection: Partial<Record<SectionId, Rec[]>>): HsnLine[] {
  const lines: HsnLine[] = [];
  const unknownUnits = new Map<string, number>();
  for (const sid of ['hsn', 'hsn_b2b', 'hsn_b2c'] as const) {
    for (const r of bySection[sid] ?? []) {
      const sec = 'hsn';
      let tab: HsnLine['tab'] = sid === 'hsn' ? ctx.settings.hsnDefaultTab : sid;
      if (sid === 'hsn' && !isBlank(r.v.kind)) {
        const k = squash(r.v.kind);
        if (k.includes('b2c') || k.includes('unreg') || k.includes('consumer')) tab = 'hsn_b2c';
        else if (k.includes('b2b') || k.includes('reg')) tab = 'hsn_b2b';
      }
      const rate = ctx.rate(sec, r);
      const raw = typeof r.v.hsn === 'number' ? String(r.v.hsn) : text(r.v.hsn);
      // Negative rows (sales returns) are normal here; they net off when rows are merged.
      if (!isBlank(r.v.txval) && toNumber(r.v.txval) === null) ctx.issue('error', sec, r.ref, `Taxable value "${text(r.v.txval)}" is not a number`);
      const txval = num(r.v.txval);
      const iamt = num(r.v.iamt);
      const camt = num(r.v.camt);
      const samt = num(r.v.samt);
      const cess = num(r.v.cess);
      let val = num(r.v.val);
      if (isBlank(r.v.val)) {
        val = round2(txval + iamt + camt + samt + cess);
        ctx.change(sec, r.ref, 'Total Value', '', val, 'Computed as taxable value + taxes');
      }
      if (rate !== null) {
        const expected = (txval * rate) / 100;
        const tax = iamt + camt + samt;
        if ((iamt || camt || samt) && Math.abs(tax - expected) > Math.max(1, expected * 0.01)) {
          ctx.issue('warning', sec, r.ref, `HSN ${raw}: tax ${round2(tax)} does not match ${rate}% of taxable value ${txval} (expected ${round2(expected)})`);
        }
        if (camt && Math.abs(camt - samt) > 1) ctx.issue('warning', sec, r.ref, `HSN ${raw}: CGST (${camt}) and SGST (${samt}) differ`);
      }
      const uq = uqcCode(r.v.uqc);
      if (!uq) unknownUnits.set(text(r.v.uqc), (unknownUnits.get(text(r.v.uqc)) ?? 0) + 1);
      lines.push({
        ref: r.ref, tab, raw, desc: text(r.v.desc), uqc: uq ?? 'OTH', qty: num(r.v.qty), val, txval, iamt, camt, samt, cess,
        rate: rate ?? NaN,
      });
    }
  }
  for (const [unit, n] of unknownUnits) {
    ctx.issue('warning', 'hsn', '', unit
      ? `${n} HSN row(s) have unit "${unit}", which is not a GST unit (UQC); reported as OTH-OTHERS`
      : `${n} HSN row(s) have no unit (UQC); reported as OTH-OTHERS. Set units in Glowsis to report them properly`);
  }
  return lines;
}

const METHOD_TEXT: Record<string, string> = {
  normalized: 'Restored leading zero / removed separators',
  remapped: 'Invalid HSN moved to a valid HSN with the same GST rate',
  truncated: 'Invalid HSN reduced to its valid heading',
  manual: 'HSN chosen manually',
};

export function buildReturn(
  grids: Record<string, Grid>,
  mappings: SheetMapping[],
  settings: Settings,
  master: HsnMaster,
  hsnOverrides: Record<string, string> = {},
): Result {
  const ctx = new Ctx(settings);
  const bySection = extractRecords(grids, mappings);
  const sheets: Result['sheets'] = {};
  const S = ctx.supplierState;
  if (!S) ctx.issue('warning', 'settings', '', 'Enter your GSTIN so intra/inter-state checks (B2CL, tax split) can run');

  // ---- B2B
  const b2b = finishInvoices(ctx, 'b2b', invoiceRows(ctx, 'b2b', bySection.b2b ?? [], true), true);
  // Nil-rated (0%) amounts moved to Table 8, by EXEMP_DESCRIPTIONS index.
  const nilMoved = [0, 0, 0, 0];
  let movedB2b = 0;
  let movedB2c = 0;
  const isIntra = (pos: string | number) => S === null || String(pos).slice(0, 2) === S;
  const toNil = (sec: string, m: { out: Out; refs: string[] }, registered: boolean, what: string) => {
    const idx = (isIntra(m.out.pos) ? 1 : 0) + (registered ? 0 : 2);
    nilMoved[idx] += Number(m.out.txval) || 0;
    ctx.change(sec, m.refs.join(', '), 'Section', `${what} @ 0%: ${m.out.txval}`, `Table 8 – ${EXEMP_DESCRIPTIONS[idx]}`, 'Nil-rated supplies are reported in Table 8, not with taxable invoices');
  };
  const zero = (m: { out: Out }) => settings.zeroRateToNil && m.out.rate === 0;
  const b2bKept = b2b.filter((m) => {
    if (!zero(m) || m.out.invtyp !== 'Regular B2B') return true;
    toNil('b2b', m, true, `Invoice ${m.out.inum}`);
    movedB2b += Number(m.out.txval) || 0;
    return false;
  });
  sheets.b2b = b2bKept.map((m) => pick(m.out, ['gstin', 'name', 'inum', 'idt', 'val', 'pos', 'rchrg', 'apct', 'invtyp', 'ecom', 'rate', 'txval', 'cess']));

  // ---- B2CL (non-qualifying invoices are moved to B2CS)
  const b2clAll = finishInvoices(ctx, 'b2cl', invoiceRows(ctx, 'b2cl', bySection.b2cl ?? [], false), false);
  const b2csRows = (bySection.b2cs ?? []).map((r) => b2csRow(ctx, 'b2cs', r));
  const b2cl: typeof b2clAll = [];
  for (const m of b2clAll) {
    const posCode = String(m.out.pos).slice(0, 2);
    const intra = S !== null && posCode === S;
    const small = Number(m.out.val) <= settings.b2clLimit;
    if (settings.moveSmallB2cl && (intra || small)) {
      const why = intra ? 'intra-state supply' : `invoice value ≤ ${settings.b2clLimit}`;
      ctx.change('b2cl', m.refs.join(', '), 'Section', `B2CL ${m.out.inum}`, 'B2CS', `Moved to B2CS: ${why}`);
      const out: Out = { type: m.out.ecom ? 'E' : 'OE', pos: m.out.pos, apct: m.out.apct, rate: m.out.rate, txval: m.out.txval, cess: m.out.cess, ecom: m.out.ecom };
      b2csRows.push({ key: [out.type, out.pos, out.apct, out.rate, out.ecom].join('|'), out, refs: m.refs });
    } else {
      if (intra) ctx.issue('error', 'b2cl', m.refs[0], `Invoice ${m.out.inum} is intra-state; B2CL is only for inter-state supplies`);
      if (small) ctx.issue('warning', 'b2cl', m.refs[0], `Invoice ${m.out.inum} value ${m.out.val} is not above the B2CL limit`);
      b2cl.push(m);
    }
  }
  const b2clKept = b2cl.filter((m) => {
    if (!zero(m)) return true;
    toNil('b2cl', m, false, `Invoice ${m.out.inum}`);
    movedB2c += Number(m.out.txval) || 0;
    return false;
  });
  sheets.b2cl = b2clKept.map((m) => pick(m.out, ['inum', 'idt', 'val', 'pos', 'apct', 'rate', 'txval', 'cess', 'ecom']));

  // ---- B2CS (aggregated by type, POS, rate)
  const b2cs = aggregate(b2csRows, ['txval', 'cess']);
  if (b2csRows.length > b2cs.length) ctx.issue('info', 'b2cs', '', `${b2csRows.length} B2C rows summarised into ${b2cs.length} POS/rate rows`);
  const b2csKept = b2cs.filter((m) => {
    if (!zero(m)) return true;
    toNil('b2cs', m, false, `B2C ${m.out.pos}`);
    movedB2c += Number(m.out.txval) || 0;
    return false;
  });
  sheets.b2cs = b2csKept.map((m) => pick(m.out, ['type', 'pos', 'apct', 'rate', 'txval', 'cess', 'ecom']));

  // ---- CDNR / CDNUR
  const cdnr = noteRows(ctx, 'cdnr', bySection.cdnr ?? []);
  sheets.cdnr = cdnr.map((m) => pick(m.out, ['gstin', 'name', 'nt_num', 'nt_dt', 'ntty', 'pos', 'rchrg', 'nt_sply', 'nt_val', 'apct', 'rate', 'txval', 'cess']));
  const cdnur = noteRows(ctx, 'cdnur', bySection.cdnur ?? []);
  sheets.cdnur = cdnur.map((m) => pick(m.out, ['ur_type', 'nt_num', 'nt_dt', 'ntty', 'pos', 'nt_val', 'apct', 'rate', 'txval', 'cess']));

  // ---- Exports
  const expRows = (bySection.exp ?? []).map((r) => {
    const sec = 'exp';
    const rate = ctx.rate(sec, r) ?? '';
    let typ = exportType(r.v.exp_typ);
    if (!typ) {
      typ = rate ? 'WPAY' : 'WOPAY';
      ctx.change(sec, r.ref, 'Export Type', r.v.exp_typ, typ, 'Export type inferred from rate');
    }
    const port = text(r.v.port).toUpperCase();
    if (port && !/^[A-Z0-9]{6}$/.test(port)) ctx.issue('warning', sec, r.ref, `Port code "${port}" should be 6 characters`);
    const out: Out = {
      exp_typ: typ,
      inum: ctx.docNo(sec, r, 'inum', 'Invoice number'),
      idt: ctx.date(sec, r, 'idt', 'Invoice date'),
      val: ctx.amount(sec, r, 'val', 'Invoice value'),
      port,
      sb_num: typeof r.v.sb_num === 'number' ? String(r.v.sb_num) : text(r.v.sb_num),
      sb_dt: isBlank(r.v.sb_dt) ? '' : ctx.date(sec, r, 'sb_dt', 'Shipping bill date', false),
      rate,
      txval: ctx.amount(sec, r, 'txval', 'Taxable value'),
      cess: ctx.amount(sec, r, 'cess', 'Cess amount'),
      gstin: '',
      pos: '',
    };
    return { key: [out.inum, out.rate].join('|'), out, refs: [r.ref] };
  });
  const exp = finishInvoices(ctx, 'exp', expRows, false);
  sheets.exp = exp.map((m) => pick(m.out, ['exp_typ', 'inum', 'idt', 'val', 'port', 'sb_num', 'sb_dt', 'rate', 'txval', 'cess']));

  // ---- Advances
  for (const sid of ['at', 'atadj'] as const) {
    const rows = (bySection[sid] ?? []).map((r) => {
      const out: Out = { pos: ctx.pos(sid, r), apct: applicablePct(r.v.apct), rate: ctx.rate(sid, r) ?? '', ad_amt: ctx.amount(sid, r, 'ad_amt', 'Advance amount'), cess: num(r.v.cess) };
      return { key: [out.pos, out.apct, out.rate].join('|'), out, refs: [r.ref] };
    });
    sheets[sid] = aggregate(rows, ['ad_amt', 'cess']).map((m) => pick(m.out, ['pos', 'apct', 'rate', 'ad_amt', 'cess']));
  }

  // ---- Nil / exempt / non-GST
  const exempTotals = new Map<string, number[]>();
  for (const r of bySection.exemp ?? []) {
    const d = exempDescription(r.v.desc);
    if (!d) {
      ctx.issue('error', 'exemp', r.ref, `Description "${text(r.v.desc)}" must be one of: ${EXEMP_DESCRIPTIONS.join('; ')}`);
      continue;
    }
    const t = exempTotals.get(d) ?? [0, 0, 0];
    exempTotals.set(d, [t[0] + num(r.v.nil), t[1] + num(r.v.expt), t[2] + num(r.v.ngsup)]);
  }
  EXEMP_DESCRIPTIONS.forEach((d, i) => {
    if (!nilMoved[i]) return;
    const t = exempTotals.get(d) ?? [0, 0, 0];
    exempTotals.set(d, [t[0] + nilMoved[i], t[1], t[2]]);
  });

  // ERP's own nil-rated total (Glowsis "GST Nill" sheet) — compared with Table 8.
  const nilRecs = bySection.nil_total ?? [];
  const nilErp = round2(nilRecs.reduce((s, r) => s + num(r.v.txval), 0));
  const table8 = () => round2([...exempTotals.values()].reduce((s, t) => s + t[0] + t[1] + t[2], 0));
  const table8Before = table8();
  if (nilRecs.length) {
    const diff = round2(nilErp - table8Before);
    if (Math.abs(diff) > 1) {
      if (settings.nilSheetDiff !== 'ignore' && diff > 0) {
        const d = EXEMP_DESCRIPTIONS[NIL_TYPES.indexOf(settings.nilSheetDiff)];
        const t = exempTotals.get(d) ?? [0, 0, 0];
        exempTotals.set(d, [t[0] + diff, t[1], t[2]]);
        ctx.change('exemp', nilRecs.map((r) => r.ref).join(', '), 'Nil Rated Supplies', '', diff, `Difference between the ERP nil sheet (${nilErp}) and 0% invoice lines, added to "${d}" as chosen in Settings`);
      } else {
        ctx.issue('warning', 'exemp', nilRecs[0].ref, `ERP nil sheet total ${nilErp} differs from Table 8 (${table8Before}) by ${diff}. If those are nil/exempt sales not listed in the B2B/B2C sheets, choose where to report them in Settings.`);
      }
    }
  }
  sheets.exemp = exempTotals.size ? EXEMP_DESCRIPTIONS.map((d) => [d, ...(exempTotals.get(d) ?? [0, 0, 0]).map(round2)]) : [];

  // ---- HSN summary, with invalid HSNs fixed
  const lines = hsnLines(ctx, bySection);
  const hsn = planHsnFixes(
    lines.filter((l) => !Number.isNaN(l.rate)).map((l) => ({ hsn: l.raw, rate: l.rate, txval: l.txval, description: l.desc })),
    master,
    settings.minHsnDigits,
    hsnOverrides,
  );
  const resByKey = new Map(hsn.map((h) => [h.key, h]));
  const descOf = new Map<string, string>();
  for (const l of lines) {
    const res = resByKey.get(`${l.raw}|${l.rate}`);
    if (res && (res.method === 'valid' || res.method === 'normalized') && l.desc && !descOf.has(res.code)) descOf.set(res.code, l.desc);
  }
  for (const h of hsn) {
    if (h.method === 'unresolved') {
      ctx.issue('error', 'hsn', '', `HSN "${h.raw}" at ${h.rate}% (${h.rows} rows, taxable ${round2(h.txval)}): ${h.reason}. No valid HSN with the same rate found — choose one manually.`);
    } else if (h.method !== 'valid') {
      ctx.change('hsn', `${h.rows} row(s)`, 'HSN', `${h.raw} @ ${h.rate}%`, h.code, `${METHOD_TEXT[h.method]}${h.reason ? ` (${h.reason})` : ''}`);
    }
  }
  const hsnOut: { key: string; out: Out; refs: string[] }[] = [];
  for (const l of lines) {
    if (Number.isNaN(l.rate)) continue;
    const res = resByKey.get(`${l.raw}|${l.rate}`);
    const code = res?.code || l.raw;
    let uqc = l.uqc;
    let qty = l.qty;
    if (isServiceCode(code) && (uqc !== 'NA' || qty)) {
      ctx.change('hsn', l.ref, 'UQC/Quantity', `${uqc} / ${qty}`, 'NA / 0', 'Services (SAC) are reported with UQC NA and zero quantity');
      uqc = 'NA';
      qty = 0;
    }
    const desc = cleanDescription(descOf.get(code) || l.desc);
    const out: Out = {
      hsn: code, desc, uqc: uqcLabel(uqc), qty, val: l.val, txval: l.txval, iamt: l.iamt, camt: l.camt, samt: l.samt, cess: l.cess, rate: l.rate,
    };
    hsnOut.push({ key: [l.tab, code, uqc, l.rate].join('|'), out: { ...out, tab: l.tab }, refs: [l.ref] });
  }
  const hsnMerged = aggregate(hsnOut, ['qty', 'val', 'txval', 'iamt', 'camt', 'samt', 'cess']);
  if (hsnOut.length > hsnMerged.length) ctx.issue('info', 'hsn', '', `${hsnOut.length} HSN rows merged into ${hsnMerged.length} rows (same HSN, unit and rate)`);
  for (const m of hsnMerged) {
    if (Number(m.out.txval) < 0) {
      ctx.issue('warning', 'hsn', m.refs.join(', '), `HSN ${m.out.hsn} at ${m.out.rate}% (${m.out.uqc}) is negative after netting returns (${m.out.txval}). The portal may reject negative HSN values; report those returns as credit notes or adjust them against another HSN row.`);
    }
  }
  for (const tab of ['hsn_b2b', 'hsn_b2c'] as const) {
    sheets[tab] = hsnMerged
      .filter((m) => m.out.tab === tab)
      .sort((a, b) => String(a.out.hsn).localeCompare(String(b.out.hsn)) || Number(a.out.rate) - Number(b.out.rate))
      .map((m) => pick(m.out, ['hsn', 'desc', 'uqc', 'qty', 'val', 'txval', 'iamt', 'camt', 'samt', 'cess', 'rate']));
  }
  if ((bySection.hsn ?? []).length && !(bySection.hsn ?? []).some((r) => !isBlank(r.v.kind))) {
    ctx.issue('warning', 'hsn', '', `HSN sheet is not split into B2B/B2C; all rows reported under ${OUTPUT_SHEETS[settings.hsnDefaultTab].name}. Change this in Settings if needed.`);
  }

  // ---- Documents issued
  // Glowsis lists every document type, including ones with no series this month.
  const docRecs = (bySection.docs ?? []).filter((r) => !(isBlank(r.v.from) && isBlank(r.v.to) && !num(r.v.totnum)));
  sheets.docs = docRecs.map((r) => {
    const sec = 'docs';
    const nature = docNature(r.v.doc_typ);
    if (!nature) ctx.issue('error', sec, r.ref, `Nature of document "${text(r.v.doc_typ)}" not recognised`);
    const from = typeof r.v.from === 'number' ? String(r.v.from) : text(r.v.from);
    const to = typeof r.v.to === 'number' ? String(r.v.to) : text(r.v.to);
    let total = num(r.v.totnum);
    const cancel = num(r.v.cancel);
    if (isBlank(r.v.totnum)) {
      const a = from.match(/^(.*?)(\d+)$/);
      const b = to.match(/^(.*?)(\d+)$/);
      if (a && b && a[1] === b[1]) {
        total = Number(b[2]) - Number(a[2]) + 1;
        ctx.change(sec, r.ref, 'Total Number', '', total, 'Computed from serial range');
      } else ctx.issue('error', sec, r.ref, 'Total number is missing');
    }
    if (cancel > total) ctx.issue('error', sec, r.ref, `Cancelled (${cancel}) exceeds total (${total})`);
    if (from.length > 16 || to.length > 16) ctx.issue('error', sec, r.ref, 'Serial numbers must be max 16 characters');
    return [nature ?? text(r.v.doc_typ), from, to, total, cancel];
  });

  // ---- Reconciliation
  const sum = (rows: (string | number)[][], col: number) => round2(rows.reduce((s, r) => s + (Number(r[col]) || 0), 0));
  const srcHsn = round2(lines.reduce((s, l) => s + l.txval, 0));
  const outHsnB2b = sum(sheets.hsn_b2b, 5);
  const outHsnB2c = sum(sheets.hsn_b2c, 5);
  // Include 0% lines moved to Table 8: they are still part of the HSN summary.
  const b2bTx = round2(sum(sheets.b2b, 11) + movedB2b);
  const b2cTx = round2(sum(sheets.b2cl, 6) + sum(sheets.b2cs, 4) + movedB2c);
  const expTx = sum(sheets.exp, 8);
  const cdn = (rows: (string | number)[][], typeCol: number, txCol: number) =>
    round2(rows.reduce((s, r) => s + (r[typeCol] === 'D' ? 1 : r[typeCol] === 'C' ? -1 : 0) * (Number(r[txCol]) || 0), 0));
  const cdnrNet = cdn(sheets.cdnr, 4, 11);
  const cdnurNet = cdn(sheets.cdnur, 3, 8);
  const recon: ReconLine[] = [
    { label: 'HSN taxable value: source vs output (must match)', leftLabel: 'Source', rightLabel: 'Output', left: srcHsn, right: round2(outHsnB2b + outHsnB2c) },
    { label: 'Invoices (B2B + B2C + Export) vs HSN', leftLabel: 'Invoices', rightLabel: 'HSN', left: round2(b2bTx + b2cTx + expTx), right: round2(outHsnB2b + outHsnB2c) },
    { label: 'Invoices net of credit/debit notes vs HSN', leftLabel: 'Invoices ± notes', rightLabel: 'HSN', left: round2(b2bTx + b2cTx + expTx + cdnrNet + cdnurNet), right: round2(outHsnB2b + outHsnB2c) },
  ];
  if (nilRecs.length) {
    recon.push({ label: 'ERP nil sheet vs Table 8 (nil + exempt + non-GST)', leftLabel: 'ERP', rightLabel: 'Table 8', left: nilErp, right: table8() });
  }
  if (sheets.hsn_b2b.length && sheets.hsn_b2c.length) {
    recon.push({ label: 'B2B invoices ± CDNR vs HSN (B2B)', leftLabel: 'B2B', rightLabel: 'HSN B2B', left: round2(b2bTx + cdnrNet), right: outHsnB2b });
    recon.push({ label: 'B2C + Export ± CDNUR vs HSN (B2C)', leftLabel: 'B2C', rightLabel: 'HSN B2C', left: round2(b2cTx + expTx + cdnurNet), right: outHsnB2c });
  }
  if (Math.abs(srcHsn - outHsnB2b - outHsnB2c) > 0.01) {
    ctx.issue('error', 'hsn', '', 'HSN totals changed during conversion — rows with an invalid rate were dropped; fix the rate in the source');
  }

  const sourceRows = Object.fromEntries(Object.entries(bySection).map(([k, v]) => [k, v?.length ?? 0]));
  return { sheets, issues: ctx.issues, changes: ctx.changes, hsn, recon, sourceRows };
}
