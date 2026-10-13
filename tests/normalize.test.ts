import { describe, expect, it } from 'vitest';
import {
  docNature, exempDescription, formatDate, isValidGstin, parseDate, parseRate, stateCode, toNumber, uqcCode,
} from '../src/lib/normalize';

describe('normalize', () => {
  it('parses Indian number formats', () => {
    expect(toNumber('1,23,456.78')).toBe(123456.78);
    expect(toNumber('(500)')).toBe(-500);
    expect(toNumber('₹ 1,000')).toBe(1000);
    expect(toNumber('abc')).toBeNull();
  });

  it('parses dates day-first and from Excel serials', () => {
    expect(formatDate(parseDate('05/10/2026')!)).toBe('05-Oct-2026');
    expect(formatDate(parseDate('2026-10-05')!)).toBe('05-Oct-2026');
    expect(formatDate(parseDate('5-Oct-26')!)).toBe('05-Oct-2026');
    expect(formatDate(parseDate(46300)!)).toBe('05-Oct-2026');
    expect(parseDate('31/02/2026')).toBeNull();
  });

  it('recognises place of supply in many forms', () => {
    expect(stateCode('32-Kerala')).toBe('32');
    expect(stateCode('Kerala')).toBe('32');
    expect(stateCode(32)).toBe('32');
    expect(stateCode('KL')).toBe('32');
    expect(stateCode('Tamil Nadu')).toBe('33');
    expect(stateCode('Andaman and Nicobar Islands')).toBe('35');
    expect(stateCode('99')).toBeNull();
  });

  it('validates GSTIN check digit', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(isValidGstin('27AAPFU0939F1ZX')).toBe(false);
    expect(isValidGstin('27AAPFU0939F1Z')).toBe(false);
  });

  it('normalises rates and units', () => {
    expect(parseRate('18%')).toBe(18);
    expect(parseRate(0.18)).toBe(18);
    expect(parseRate('IGST 12')).toBe(12);
    expect(parseRate(17)).toBeNull();
    expect(uqcCode('Kg')).toBe('KGS');
    expect(uqcCode('NOS-NUMBERS')).toBe('NOS');
    expect(uqcCode('Pcs')).toBe('PCS');
    expect(uqcCode('Litre')).toBe('LTR');
    expect(uqcCode('weird')).toBeNull();
  });

  it('maps document and exempt descriptions', () => {
    expect(docNature('Sales Invoice')).toBe('Invoices for outward supply');
    expect(docNature('Credit Note')).toBe('Credit Note');
    expect(exempDescription('Intra State - Unregistered')).toBe('Intra-State supplies to unregistered persons');
    expect(exempDescription('Inter-State supplies to registered persons')).toBe('Inter-State supplies to registered persons');
  });
});
