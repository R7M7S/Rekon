import { type Cell, squash } from './normalize';
import { SECTIONS, SECTION_BY_ID, type SectionDef, type SectionId } from './schema';

export type Grid = Cell[][];

export interface SheetMapping {
  sheet: string;
  /** null = ignore this sheet. */
  section: SectionId | null;
  headerRow: number; // 0-based
  /** field key -> column index */
  columns: Record<string, number>;
  confidence: number;
}

/** Score how well a header cell matches a field: 0 = no match. */
function matchScore(header: string, aliases: string[]): number {
  if (!header) return 0;
  const exact = aliases.indexOf(header);
  if (exact >= 0) return 100 - exact;
  let best = 0;
  aliases.forEach((a, i) => {
    if (a.length >= 4 && header.includes(a)) best = Math.max(best, 50 - i + a.length);
  });
  return best;
}

/** Greedy one-to-one assignment of columns to fields, best scores first. */
export function mapColumns(headers: Cell[], section: SectionDef): Record<string, number> {
  const hs = headers.map((h) => squash(h));
  const pairs: { key: string; col: number; score: number }[] = [];
  for (const fd of section.fields) {
    hs.forEach((h, col) => {
      const score = matchScore(h, fd.aliases);
      if (score) pairs.push({ key: fd.key, col, score });
    });
  }
  pairs.sort((a, b) => b.score - a.score);
  const out: Record<string, number> = {};
  const used = new Set<number>();
  for (const p of pairs) {
    if (p.key in out || used.has(p.col)) continue;
    out[p.key] = p.col;
    used.add(p.col);
  }
  return out;
}

function mappingQuality(columns: Record<string, number>, section: SectionDef) {
  const req = section.fields.filter((f) => f.required);
  const hitReq = req.filter((f) => f.key in columns).length;
  return (hitReq / Math.max(req.length, 1)) * 0.7 + (Object.keys(columns).length / section.fields.length) * 0.3;
}

/** Row with the most cells that look like known headers (searches the first 20 rows). */
export function findHeaderRow(grid: Grid): number {
  const known = new Set(SECTIONS.flatMap((s) => s.fields.flatMap((f) => f.aliases)));
  let best = 0;
  let bestScore = -1;
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    const row = grid[r] ?? [];
    let score = 0;
    for (const c of row) {
      const q = squash(c);
      if (!q) continue;
      if (known.has(q)) score += 2;
      else if ([...known].some((a) => a.length >= 5 && q.includes(a))) score += 1;
    }
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/** Sheets Glowsis exports that are not GSTR-1 data (GSTR-3B summary). */
const IGNORE_SHEETS = /\b(gst\s*r\s*-?\s*3b?|gstr\s*-?\s*3b?|3b)\b/i;

function sectionFromName(sheet: string): SectionId | null {
  const q = squash(sheet);
  const tokens = sheet.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Longest pattern wins, so "b2cl" beats "b2c" and "hsnb2b" beats "b2b".
  let hit: { id: SectionId; len: number } | null = null;
  for (const s of SECTIONS) {
    for (const p of s.sheetNames) {
      // Short patterns like "at" or "exp" must not match inside unrelated words.
      const match = q === p || (p.length >= 4 ? q.includes(p) : p.length === 3 && (q.startsWith(p) || tokens.includes(p)));
      if (match && (!hit || p.length > hit.len)) hit = { id: s.id, len: p.length };
    }
  }
  return hit?.id ?? null;
}

export function detectSheet(sheet: string, grid: Grid): SheetMapping {
  if (IGNORE_SHEETS.test(sheet)) return { sheet, section: null, headerRow: 0, columns: {}, confidence: 0 };
  const headerRow = findHeaderRow(grid);
  const headers = grid[headerRow] ?? [];
  const byName = sectionFromName(sheet);

  let best: { id: SectionId; cols: Record<string, number>; q: number } | null = null;
  for (const s of SECTIONS) {
    const cols = mapColumns(headers, s);
    let q = mappingQuality(cols, s);
    if (s.id === byName) q += 0.5;
    if (!best || q > best.q) best = { id: s.id, cols, q };
  }
  if (!best || best.q < 0.45 || !Object.keys(best.cols).length) {
    return { sheet, section: null, headerRow, columns: {}, confidence: best?.q ?? 0 };
  }
  return { sheet, section: best.id, headerRow, columns: best.cols, confidence: Math.min(1, best.q) };
}

/** Re-map columns after the user changes a sheet's section or header row. */
export function remapSheet(m: SheetMapping, grid: Grid, section: SectionId | null, headerRow = m.headerRow): SheetMapping {
  if (!section) return { ...m, section: null, headerRow, columns: {} };
  const def = SECTION_BY_ID[section];
  const columns = mapColumns(grid[headerRow] ?? [], def);
  return { ...m, section, headerRow, columns, confidence: mappingQuality(columns, def) };
}

export function missingRequired(m: SheetMapping): string[] {
  if (!m.section) return [];
  return SECTION_BY_ID[m.section].fields.filter((f) => f.required && !(f.key in m.columns)).map((f) => f.label);
}
