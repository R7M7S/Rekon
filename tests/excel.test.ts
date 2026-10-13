import { describe, expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { trimRange } from '../src/lib/excel';

describe('trimRange', () => {
  it('shrinks a used range that runs to the last Excel row', () => {
    const ws = XLSX.utils.aoa_to_sheet([['HSN', 'Rate'], [8471, 18], [null, '']]);
    ws['!ref'] = 'A1:Z1048576';
    trimRange(ws);
    expect(ws['!ref']).toBe('A1:B2');
    expect(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true })).toEqual([['HSN', 'Rate'], [8471, 18]]);
  });
});
