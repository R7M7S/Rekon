import { describe, expect, it } from 'vitest';
import { detectSheet, type Grid } from '../src/lib/detect';
import { buildGstr1Json } from '../src/lib/gstJson';
import { HsnMaster } from '../src/lib/hsn';
import { buildReturn, DEFAULT_SETTINGS } from '../src/lib/transform';
import { SUPPLIER_GSTIN, glowsisSheets } from '../scripts/sample-data.mjs';

const grids = glowsisSheets as unknown as Record<string, Grid>;
const mappings = Object.entries(grids).map(([n, g]) => detectSheet(n, g));
const settings = { ...DEFAULT_SETTINGS, gstin: SUPPLIER_GSTIN, period: '2026-08' };
const res = buildReturn(grids, mappings, settings, HsnMaster.bundled());

describe('Glowsis GSTR1 export layout', () => {
  it('recognises the Glowsis sheets and ignores the 3B summary and empty sheets', () => {
    expect(Object.fromEntries(mappings.map((m) => [m.sheet, m.section]))).toEqual({
      'Sales B2B': 'b2b',
      'Sales B2C': 'b2cs',
      'Credit Note B2B': null,
      'HSN B2B': 'hsn_b2b',
      'HSN B2C': 'hsn_b2c',
      'GST DOC': 'docs',
      'GST R3': null,
      'GST Nill': 'nil_total',
    });
  });

  it('adds up per-line values into the invoice value and moves 0% lines to Table 8', () => {
    expect(res.sheets.b2b.map((r) => [r[2], r[4], r[10], r[11]])).toEqual([
      ['2026-27/1001', 900, 5, 200],
      ['2026-27/1001', 900, 18, 500],
      ['2026-27/1002', 1180, 18, 1000],
    ]);
    expect(res.sheets.b2cs.map((r) => r[3])).toEqual([5, 18]);
    expect(res.sheets.exemp).toEqual([
      ['Inter-State supplies to registered persons', 0, 0, 0],
      ['Intra-State supplies to registered persons', 100, 0, 0],
      ['Inter-State supplies to unregistered persons', 0, 0, 0],
      ['Intra-State supplies to unregistered persons', 5000, 0, 0],
    ]);
    const nil = res.recon.find((r) => r.label.startsWith('ERP nil sheet'))!;
    expect(nil.left).toBe(nil.right);
  });

  it('fills blank and invalid HSNs from same-rate HSNs', () => {
    const by = Object.fromEntries(res.hsn.map((h) => [`${h.raw}|${h.rate}`, h.code]));
    expect(by['|0']).toBe('49011010');
    expect(by['|5']).toBe('7323');
    expect(by['39269090|18']).toBe('4820');
    expect(by['96190009|18']).toBe('4820');
    expect(res.hsn.some((h) => h.method === 'unresolved')).toBe(false);
  });

  it('skips empty document rows and the "Last row" marker', () => {
    expect(res.sheets.docs).toEqual([
      ['Invoices for outward supply', '2026-27/1001', '2026-27/1002', 2, 0],
      ['Invoices for outward supply', '2026-27/5001-0', '2026-27/5450-0', 450, 2],
    ]);
    expect(res.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('builds the GSTR-1 JSON', () => {
    const { json, blockers } = buildGstr1Json(res, settings);
    expect(blockers).toEqual([]);
    const j = json as any;
    expect(j.gstin).toBe(SUPPLIER_GSTIN);
    expect(j.fp).toBe('082026');
    const kl = j.b2b.find((c: any) => c.ctin === '32AAFCS3456N1Z3');
    expect(kl.inv[0]).toMatchObject({ inum: '2026-27/1001', idt: '03-08-2026', val: 900, pos: '32', rchrg: 'N', inv_typ: 'R' });
    expect(kl.inv[0].itms).toEqual([
      { num: 501, itm_det: { txval: 200, rt: 5, camt: 5, samt: 5, csamt: 0 } },
      { num: 1801, itm_det: { txval: 500, rt: 18, camt: 45, samt: 45, csamt: 0 } },
    ]);
    const tn = j.b2b.find((c: any) => c.ctin === '33AACCT5678L1ZV');
    expect(tn.inv[0].itms[0].itm_det).toEqual({ txval: 1000, rt: 18, iamt: 180, csamt: 0 });
    expect(j.b2cs).toContainEqual({ sply_ty: 'INTRA', rt: 18, typ: 'OE', pos: '32', txval: 10000, camt: 900, samt: 900, csamt: 0 });
    expect(j.nil.inv).toEqual([
      { sply_ty: 'INTRAB2B', nil_amt: 100, expt_amt: 0, ngsup_amt: 0 },
      { sply_ty: 'INTRAB2C', nil_amt: 5000, expt_amt: 0, ngsup_amt: 0 },
    ]);
    expect(j.hsn.hsn_b2b[0]).toMatchObject({ num: 1, hsn_sc: expect.any(String), uqc: expect.stringMatching(/^[A-Z]{2,3}$/) });
    expect(j.hsn.hsn_b2c.map((h: any) => h.hsn_sc)).not.toContain('96190009');
    expect(j.doc_issue.doc_det).toEqual([
      {
        doc_num: 1,
        doc_typ: 'Invoices for outward supply',
        docs: [
          { num: 1, from: '2026-27/1001', to: '2026-27/1002', totnum: 2, cancel: 0, net_issue: 2 },
          { num: 2, from: '2026-27/5001-0', to: '2026-27/5450-0', totnum: 450, cancel: 2, net_issue: 448 },
        ],
      },
    ]);
  });

  it('refuses to build JSON without GSTIN and period', () => {
    expect(buildGstr1Json(res, { ...settings, gstin: '', period: '' }).blockers).toHaveLength(2);
  });
});
