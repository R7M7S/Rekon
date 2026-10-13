import { describe, expect, it } from 'vitest';
import { HsnMaster, checkHsn, planHsnFixes } from '../src/lib/hsn';

const master = HsnMaster.bundled();

describe('HSN master', () => {
  it('loads the bundled list', () => {
    expect(master.size).toBeGreaterThan(10000);
    expect(master.isKnown('84713010')).toBe(true);
    expect(master.isKnown('8471')).toBe(true);
    expect(master.isKnown('847130')).toBe(true);
    expect(master.isKnown('84719999')).toBe(false);
  });

  it('checks digits, length and leading zeros', () => {
    expect(checkHsn('84713010', master, 4)).toEqual({ ok: true, code: '84713010' });
    expect(checkHsn('7019000', master, 4)).toEqual({ ok: true, code: '07019000' });
    expect(checkHsn('8471 30 10', master, 4).code).toBe('84713010');
    expect(checkHsn('8471', master, 6).ok).toBe(false);
    expect(checkHsn('12', master, 4).ok).toBe(false);
    expect(checkHsn('', master, 4).reason).toBe('HSN missing');
    expect(checkHsn('99999999', master, 4).ok).toBe(false);
  });
});

describe('planHsnFixes', () => {
  it('moves an invalid HSN to a valid HSN with the same rate', () => {
    const res = planHsnFixes(
      [
        { hsn: '84713010', rate: 18, txval: 1000 },
        { hsn: '39231090', rate: 18, txval: 5000 },
        { hsn: '30049099', rate: 12, txval: 9000 },
        { hsn: '84719999', rate: 18, txval: 200 },
      ],
      master,
      4,
    );
    const bad = res.find((r) => r.raw === '84719999')!;
    // Same rate (18) and closest prefix (8471...) wins over the bigger 3923 row.
    expect(bad.method).toBe('remapped');
    expect(bad.code).toBe('84713010');
    expect(bad.candidates).toEqual(['84713010', '39231090']);
  });

  it('prefers the largest same-rate HSN when no prefix matches', () => {
    const res = planHsnFixes(
      [
        { hsn: '84713010', rate: 18, txval: 1000 },
        { hsn: '39231090', rate: 18, txval: 5000 },
        { hsn: 'ABC', rate: 18, txval: 10 },
      ],
      master,
      4,
    );
    expect(res.find((r) => r.raw === 'ABC')!.code).toBe('39231090');
  });

  it('never moves goods into services or across rates', () => {
    const res = planHsnFixes(
      [
        { hsn: '998314', rate: 18, txval: 1000 },
        { hsn: '84719999', rate: 18, txval: 10 },
        { hsn: '30049099', rate: 5, txval: 10 },
      ],
      master,
      4,
    );
    const bad = res.find((r) => r.raw === '84719999')!;
    expect(bad.method).toBe('truncated');
    expect(bad.code).toBe('8471'); // 847199 is not a valid subheading
  });

  it('reports unresolved when nothing fits and applies manual overrides', () => {
    const lines = [{ hsn: '12', rate: 28, txval: 10 }];
    expect(planHsnFixes(lines, master, 4)[0].method).toBe('unresolved');
    const fixed = planHsnFixes(lines, master, 4, { '12|28': '87032291' });
    expect(fixed[0].method).toBe('manual');
    expect(fixed[0].code).toBe('87032291');
  });
});
