import { describe, expect, it } from 'vitest';
import { detectSheet } from '../src/lib/detect';
import { HsnMaster } from '../src/lib/hsn';
import { buildReturn, DEFAULT_SETTINGS } from '../src/lib/transform';
import { SUPPLIER_GSTIN, sampleSheets } from '../scripts/sample-data.mjs';
import type { Grid } from '../src/lib/detect';

const grids = sampleSheets as unknown as Record<string, Grid>;
const master = HsnMaster.bundled();
const mappings = Object.entries(grids).map(([name, g]) => detectSheet(name, g));
const settings = { ...DEFAULT_SETTINGS, gstin: SUPPLIER_GSTIN, period: '2026-09' };

describe('detectSheet', () => {
  it('identifies every Glowsis sheet and its header row', () => {
    expect(mappings.map((m) => m.section)).toEqual(['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp', 'hsn', 'docs']);
    const b2b = mappings[0];
    expect(b2b.headerRow).toBe(2);
    expect(b2b.columns).toMatchObject({ gstin: 0, name: 1, inum: 2, idt: 3, val: 4, pos: 5, rchrg: 6, rate: 8, txval: 9, cess: 10 });
  });
});

describe('buildReturn', () => {
  const res = buildReturn(grids, mappings, settings, master);

  it('merges B2B line items per invoice and rate, cleaning GSTIN, dates and POS', () => {
    expect(res.sheets.b2b).toEqual([
      ['33AACCT5678L1ZV', 'Tamil Traders', 'GL/26/001', '05-Sep-2026', 11800, '33-Tamil Nadu', 'N', '', 'Regular B2B', '', 18, 10000, 0],
      ['29AADCB9012M1ZF', 'Bangalore Bits', 'GL/26/002', '19-Sep-2026', 5600, '29-Karnataka', 'N', '', 'Regular B2B', '', 12, 5000, 0],
    ]);
  });

  it('keeps only qualifying B2CL invoices and moves the rest into B2CS', () => {
    expect(res.sheets.b2cl.map((r) => r[0])).toEqual(['GL/26/010']);
    expect(res.sheets.b2cs).toEqual([
      ['OE', '32-Kerala', '', 18, 153000, 0, ''],
      ['OE', '32-Kerala', '', 5, 500, 0, ''],
      ['OE', '29-Karnataka', '', 18, 50000, 0, ''],
    ]);
  });

  it('reports credit notes as positive values', () => {
    expect(res.sheets.cdnr[0].slice(2, 12)).toEqual(['CN/26/001', '20-Sep-2026', 'C', '33-Tamil Nadu', 'N', 'Regular B2B', 1180, '', 18, 1000]);
  });

  it('fixes every invalid HSN using a valid HSN of the same rate', () => {
    const by = Object.fromEntries(res.hsn.map((h) => [h.raw, h]));
    expect(by['84719999']).toMatchObject({ method: 'remapped', code: '84713010' });
    expect(by['123']).toMatchObject({ method: 'remapped', code: '39231090' });
    expect(by['7019000']).toMatchObject({ method: 'normalized', code: '07019000' });
    expect(by['4019999'].method).toBe('truncated');
    const codes = res.sheets.hsn_b2b.map((r) => r[0]);
    expect(codes).not.toContain('84719999');
    expect(codes).not.toContain('123');
  });

  it('never loses value: HSN totals by rate are unchanged', () => {
    const src = grids.HSN.slice(1);
    for (const rate of [0, 5, 12, 18]) {
      const before = src.filter((r) => r[10] === rate).reduce((s, r) => s + Number(r[5]), 0);
      const after = res.sheets.hsn_b2b.filter((r) => r[10] === rate).reduce((s, r) => s + Number(r[5]), 0);
      expect(after).toBeCloseTo(before, 2);
    }
    expect(res.recon[0].left).toBe(res.recon[0].right);
  });

  it('reports services with UQC NA and cleans descriptions', () => {
    const svc = res.sheets.hsn_b2b.find((r) => r[0] === '998314')!;
    expect(svc[2]).toBe('NA');
    expect(svc[3]).toBe(0);
    const laptop = res.sheets.hsn_b2b.find((r) => r[0] === '84713010' && r[2] === 'NOS-NUMBERS')!;
    expect(laptop[1]).toBe('Laptops');
  });

  it('fills document totals and normalises nature of document', () => {
    expect(res.sheets.docs).toEqual([
      ['Invoices for outward supply', 'GL/26/001', 'GL/26/012', 12, 1],
      ['Credit Note', 'CN/26/001', 'CN/26/002', 2, 0],
    ]);
  });

  it('has no blocking errors on the sample', () => {
    expect(res.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('applies manual HSN overrides', () => {
    const r2 = buildReturn(grids, mappings, settings, master, { '123|18': '84713090' });
    expect(r2.hsn.find((h) => h.raw === '123')).toMatchObject({ method: 'manual', code: '84713090' });
  });
});
