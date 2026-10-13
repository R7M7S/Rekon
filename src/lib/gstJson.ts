// Builds the GSTR-1 JSON that the GST portal accepts under
// Returns → GSTR-1 → Prepare Offline → Upload, from the reshaped return.
// Field names follow the JSON produced by the GSTN offline tool.

import { DOC_NATURES, EXEMP_DESCRIPTIONS } from './gstData';
import { cleanGstin, isValidGstin, round2 } from './normalize';
import { NIL_TYPES, type Result, type Settings } from './transform';

/** Version string the offline tool writes into its JSON. Update if the portal asks for a newer one. */
export const JSON_VERSION = 'GST3.2.4';

type Row = (string | number)[];
type Json = Record<string, unknown>;

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** "05-Sep-2026" → "05-09-2026" (portal JSON date format). */
const jsonDate = (s: string | number) => {
  const m = String(s).match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  return m ? `${m[1]}-${MONTHS[m[2]]}-${m[3]}` : String(s);
};

const posCode = (pos: string | number) => String(pos).slice(0, 2);
const n = (v: string | number) => round2(Number(v) || 0);

/** Tax split for an item: IGST when inter-state, else CGST + SGST halves. */
function taxes(txval: number, rt: number, igst: boolean) {
  const tax = (txval * rt) / 100;
  return igst ? { iamt: round2(tax) } : { camt: round2(tax / 2), samt: round2(tax / 2) };
}

const diff = (apct: string | number) => (Number(apct) === 65 ? { diff_percent: 0.65 } : {});
const etin = (g: string | number) => (g ? { etin: String(g) } : {});
const itemNum = (rt: number) => Math.round(rt * 100) + 1;

const INV_TYP: Record<string, string> = {
  'Regular B2B': 'R',
  'SEZ supplies with payment': 'SEWP',
  'SEZ supplies without payment': 'SEWOP',
  'Deemed Exp': 'DE',
  'Intra-State supplies attracting IGST': 'R',
};

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
}

export interface JsonResult {
  json: Json | null;
  /** Reasons the JSON cannot be produced. */
  blockers: string[];
}

export function buildGstr1Json(result: Result, settings: Settings): JsonResult {
  const gstin = cleanGstin(settings.gstin);
  const blockers: string[] = [];
  if (!isValidGstin(gstin)) blockers.push('Enter your valid GSTIN in Settings.');
  if (!/^\d{4}-\d{2}$/.test(settings.period)) blockers.push('Choose the return period in Settings.');
  if (blockers.length) return { json: null, blockers };

  const home = gstin.slice(0, 2);
  const [y, mo] = settings.period.split('-');
  const S = result.sheets;
  const out: Json = { gstin, fp: `${mo}${y}`, version: JSON_VERSION, hash: 'hash' };

  // B2B: [gstin,name,inum,idt,val,pos,rchrg,apct,invtyp,ecom,rate,txval,cess]
  if (S.b2b.length) {
    out.b2b = [...groupBy(S.b2b, (r) => String(r[0])).entries()].map(([ctin, rows]) => ({
      ctin,
      inv: [...groupBy(rows, (r) => String(r[2])).values()].map((inv) => {
        const f = inv[0];
        const typ = INV_TYP[String(f[8])] ?? 'R';
        const igst = posCode(f[5]) !== home || typ !== 'R' || f[8] === 'Intra-State supplies attracting IGST';
        return {
          inum: String(f[2]), idt: jsonDate(f[3]), val: n(f[4]), pos: posCode(f[5]), rchrg: String(f[6] || 'N'),
          ...etin(f[9]), inv_typ: typ, ...diff(f[7]),
          itms: inv.map((r) => ({
            num: itemNum(n(r[10])),
            itm_det: { txval: n(r[11]), rt: n(r[10]), ...taxes(n(r[11]), n(r[10]), igst), csamt: n(r[12]) },
          })),
        };
      }),
    }));
  }

  // B2CL: [inum,idt,val,pos,apct,rate,txval,cess,ecom]
  if (S.b2cl.length) {
    out.b2cl = [...groupBy(S.b2cl, (r) => posCode(r[3])).entries()].map(([pos, rows]) => ({
      pos,
      inv: [...groupBy(rows, (r) => String(r[0])).values()].map((inv) => ({
        inum: String(inv[0][0]), idt: jsonDate(inv[0][1]), val: n(inv[0][2]), ...etin(inv[0][8]), ...diff(inv[0][4]),
        itms: inv.map((r) => ({ num: itemNum(n(r[5])), itm_det: { txval: n(r[6]), rt: n(r[5]), iamt: round2((n(r[6]) * n(r[5])) / 100), csamt: n(r[7]) } })),
      })),
    }));
  }

  // B2CS: [type,pos,apct,rate,txval,cess,ecom]
  if (S.b2cs.length) {
    out.b2cs = S.b2cs.map((r: Row) => {
      const inter = posCode(r[1]) !== home;
      return {
        sply_ty: inter ? 'INTER' : 'INTRA', rt: n(r[3]), typ: String(r[0]), ...etin(r[6]), pos: posCode(r[1]), ...diff(r[2]),
        txval: n(r[4]), ...taxes(n(r[4]), n(r[3]), inter), csamt: n(r[5]),
      };
    });
  }

  // CDNR: [gstin,name,nt_num,nt_dt,ntty,pos,rchrg,nt_sply,nt_val,apct,rate,txval,cess]
  if (S.cdnr.length) {
    out.cdnr = [...groupBy(S.cdnr, (r) => String(r[0])).entries()].map(([ctin, rows]) => ({
      ctin,
      nt: [...groupBy(rows, (r) => String(r[2])).values()].map((nt) => {
        const f = nt[0];
        const typ = INV_TYP[String(f[7])] ?? 'R';
        const igst = posCode(f[5]) !== home || typ !== 'R';
        return {
          ntty: String(f[4]), nt_num: String(f[2]), nt_dt: jsonDate(f[3]), val: n(f[8]), pos: posCode(f[5]), rchrg: String(f[6] || 'N'),
          inv_typ: typ, ...diff(f[9]),
          itms: nt.map((r) => ({ num: itemNum(n(r[10])), itm_det: { txval: n(r[11]), rt: n(r[10]), ...taxes(n(r[11]), n(r[10]), igst), csamt: n(r[12]) } })),
        };
      }),
    }));
  }

  // CDNUR: [ur_type,nt_num,nt_dt,ntty,pos,nt_val,apct,rate,txval,cess]
  if (S.cdnur.length) {
    out.cdnur = [...groupBy(S.cdnur, (r) => String(r[1])).values()].map((nt) => {
      const f = nt[0];
      return {
        typ: String(f[0]), ntty: String(f[3]), nt_num: String(f[1]), nt_dt: jsonDate(f[2]), val: n(f[5]),
        ...(f[0] === 'B2CL' ? { pos: posCode(f[4]) } : {}), ...diff(f[6]),
        itms: nt.map((r) => ({ num: itemNum(n(r[7])), itm_det: { txval: n(r[8]), rt: n(r[7]), iamt: round2((n(r[8]) * n(r[7])) / 100), csamt: n(r[9]) } })),
      };
    });
  }

  // EXP: [exp_typ,inum,idt,val,port,sb_num,sb_dt,rate,txval,cess]
  if (S.exp.length) {
    out.exp = [...groupBy(S.exp, (r) => String(r[0])).entries()].map(([exp_typ, rows]) => ({
      exp_typ,
      inv: [...groupBy(rows, (r) => String(r[1])).values()].map((inv) => {
        const f = inv[0];
        return {
          inum: String(f[1]), idt: jsonDate(f[2]), val: n(f[3]),
          ...(f[4] ? { sbpcode: String(f[4]) } : {}), ...(f[5] ? { sbnum: String(f[5]) } : {}), ...(f[6] ? { sbdt: jsonDate(f[6]) } : {}),
          itms: inv.map((r) => ({ txval: n(r[8]), rt: n(r[7]), iamt: exp_typ === 'WPAY' ? round2((n(r[8]) * n(r[7])) / 100) : 0, csamt: n(r[9]) })),
        };
      }),
    }));
  }

  // Advances: [pos,apct,rate,ad_amt,cess]
  for (const [key, src] of [['at', S.at], ['txpd', S.atadj]] as const) {
    if (!src.length) continue;
    out[key] = [...groupBy(src, (r) => posCode(r[0])).entries()].map(([pos, rows]) => {
      const inter = pos !== home;
      return {
        pos, sply_ty: inter ? 'INTER' : 'INTRA', ...diff(rows[0][1]),
        itms: rows.map((r) => ({ rt: n(r[2]), ad_amt: n(r[3]), ...taxes(n(r[3]), n(r[2]), inter), csamt: n(r[4]) })),
      };
    });
  }

  // Nil / exempt: [desc, nil, expt, ngsup]
  const nil = S.exemp
    .filter((r) => n(r[1]) || n(r[2]) || n(r[3]))
    .map((r) => ({ sply_ty: NIL_TYPES[EXEMP_DESCRIPTIONS.indexOf(String(r[0]))], nil_amt: n(r[1]), expt_amt: n(r[2]), ngsup_amt: n(r[3]) }));
  if (nil.length) out.nil = { inv: nil };

  // HSN: [hsn,desc,uqc,qty,val,txval,iamt,camt,samt,cess,rate]
  const hsnRows = (rows: Row[]) =>
    rows.map((r, i) => ({
      num: i + 1, hsn_sc: String(r[0]), desc: String(r[1] ?? ''), uqc: String(r[2]).split('-')[0] || 'NA', qty: round2(Number(r[3]) || 0),
      rt: n(r[10]), txval: n(r[5]), iamt: n(r[6]), camt: n(r[7]), samt: n(r[8]), csamt: n(r[9]),
    }));
  if (S.hsn_b2b.length || S.hsn_b2c.length) {
    out.hsn = { ...(S.hsn_b2b.length ? { hsn_b2b: hsnRows(S.hsn_b2b) } : {}), ...(S.hsn_b2c.length ? { hsn_b2c: hsnRows(S.hsn_b2c) } : {}) };
  }

  // Documents: [nature, from, to, total, cancelled]
  if (S.docs.length) {
    out.doc_issue = {
      doc_det: [...groupBy(S.docs, (r) => String(r[0])).entries()]
        .filter(([nature]) => DOC_NATURES.includes(nature))
        .map(([nature, rows]) => ({
          doc_num: DOC_NATURES.indexOf(nature) + 1,
          doc_typ: nature,
          docs: rows.map((r, i) => ({ num: i + 1, from: String(r[1]), to: String(r[2]), totnum: n(r[3]), cancel: n(r[4]), net_issue: n(r[3]) - n(r[4]) })),
        }))
        .sort((a, b) => a.doc_num - b.doc_num),
    };
  }

  return { json: out, blockers };
}
