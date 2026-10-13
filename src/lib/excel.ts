import * as XLSX from '@e965/xlsx';
import type { Grid } from './detect';
import { OUTPUT_SHEETS } from './schema';
import type { Result } from './transform';

/**
 * ERP exports often declare a used range far beyond the data (e.g. A1:Z1048576
 * because whole columns are formatted). Reading that range builds a million
 * empty rows and freezes the browser, so shrink it to the cells that hold values.
 */
export function trimRange(ws: XLSX.WorkSheet) {
  let maxR = -1;
  let maxC = -1;
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue;
    const cell = ws[addr] as XLSX.CellObject;
    if (cell.v === undefined || cell.v === null || cell.v === '') continue;
    const { r, c } = XLSX.utils.decode_cell(addr);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  ws['!ref'] = maxR < 0 ? 'A1:A1' : XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}

/** Reads every sheet as a raw grid (numbers stay numbers; dates stay Excel serials). */
export function readWorkbook(data: ArrayBuffer): { names: string[]; grids: Record<string, Grid> } {
  const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
  const grids: Record<string, Grid> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    trimRange(ws);
    grids[name] = XLSX.utils.sheet_to_json<Grid[number]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  }
  return { names: wb.SheetNames.filter((n) => grids[n]), grids };
}

/** Reads the GST portal HSN master (HSN_SAC.xlsx) or any sheet/CSV whose first column holds codes. */
export function readHsnMasterFile(data: ArrayBuffer): string[] {
  const wb = XLSX.read(data, { type: 'array', raw: false });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false });
    for (const row of rows) {
      let c = String(row?.[0] ?? '').replace(/\D/g, '');
      if (c.length % 2 === 1) c = '0' + c;
      if (c.length >= 2 && c.length <= 8) out.push(c);
    }
  }
  return out;
}

const SHEET_ORDER = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp', 'at', 'atadj', 'exemp', 'hsn_b2b', 'hsn_b2c', 'docs'];

/**
 * GSTR-1 offline tool layout: rows 1-3 hold the section summary, row 4 the column
 * headers and data starts on row 5.
 */
export function buildReturnWorkbook(result: Result, includeEmpty = false): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const key of SHEET_ORDER) {
    const def = OUTPUT_SHEETS[key];
    const rows = result.sheets[key] ?? [];
    if (!rows.length && !includeEmpty) continue;
    const aoa: (string | number)[][] = [[def.title], ['No. of rows', rows.length], [], def.headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = def.headers.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, def.name);
  }
  if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']]), 'empty');
  return wb;
}

/** Audit workbook: what changed, why, and what still needs attention. */
export function buildAuditWorkbook(result: Result): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const summary: (string | number)[][] = [['Section', 'Source rows', 'Output rows']];
  for (const key of SHEET_ORDER) {
    const src = key.startsWith('hsn') ? (result.sourceRows[key] ?? 0) + (key === 'hsn_b2b' ? result.sourceRows.hsn ?? 0 : 0) : result.sourceRows[key] ?? 0;
    summary.push([OUTPUT_SHEETS[key].name, src, result.sheets[key]?.length ?? 0]);
  }
  summary.push([], ['Reconciliation', 'Left', 'Right', 'Difference']);
  for (const r of result.recon) summary.push([`${r.label} (${r.leftLabel} / ${r.rightLabel})`, r.left, r.right, Math.round((r.left - r.right) * 100) / 100]);
  summary.push([], ['Errors', result.issues.filter((i) => i.severity === 'error').length], ['Warnings', result.issues.filter((i) => i.severity === 'warning').length], ['Changes made', result.changes.length]);
  add(wb, 'Summary', summary);

  add(wb, 'HSN Fixes', [
    ['Original HSN', 'Rate', 'Rows', 'Taxable Value', 'Description', 'Problem', 'Reported As', 'Method', 'Other same-rate HSNs'],
    ...result.hsn
      .filter((h) => h.method !== 'valid')
      .map((h) => [h.raw, h.rate, h.rows, Math.round(h.txval * 100) / 100, h.description, h.reason, h.code || '(unresolved)', h.method, h.candidates.slice(1, 6).join(', ')]),
  ]);
  add(wb, 'Changes', [['Section', 'Source', 'Field', 'From', 'To', 'Reason'], ...result.changes.map((c) => [c.section, c.ref, c.field, c.from, c.to, c.reason])]);
  add(wb, 'Issues', [['Severity', 'Section', 'Source', 'Message'], ...result.issues.map((i) => [i.severity, i.section, i.ref, i.message])]);
  return wb;
}

function add(wb: XLSX.WorkBook, name: string, aoa: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (aoa[0] ?? []).map((_, i) => ({ wch: i === aoa[0].length - 1 ? 60 : 18 }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

interface DownloadsApi {
  save(req: { filename: string; data: ArrayBuffer }): Promise<{ status: string }>;
}
type ClaudeWindow = { claude?: { use(name: string): Promise<unknown> } };

/**
 * Saves a workbook. Inside the claude.ai artifact viewer, browser downloads are
 * blocked, so the viewer's `downloads` capability is used; elsewhere (the
 * standalone HTML file, dev server) a normal browser download is started.
 * Resolves with a short status message for the UI.
 */
export async function download(wb: XLSX.WorkBook, filename: string): Promise<string> {
  const host = (window as unknown as ClaudeWindow).claude;
  if (host?.use) {
    const api = (await host.use('downloads').catch(() => null)) as DownloadsApi | null;
    if (!api) return 'Saving files is not available in this view. Open the standalone HTML file instead.';
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
    try {
      await api.save({ filename, data });
      return `Saved ${filename}`;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'declined') return 'Save cancelled.';
      if (code === 'rate_limited') return 'A save prompt is already open. Finish it, then try again.';
      return `Could not save ${filename} (${code ?? 'unavailable'}).`;
    }
  }
  XLSX.writeFile(wb, filename, { compression: true });
  return `Downloaded ${filename}`;
}
