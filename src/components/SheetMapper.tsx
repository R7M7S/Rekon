import { type Grid, type SheetMapping, missingRequired, remapSheet } from '../lib/detect';
import { text } from '../lib/normalize';
import { SECTIONS, SECTION_BY_ID, type SectionId } from '../lib/schema';

interface Props {
  grids: Record<string, Grid>;
  mappings: SheetMapping[];
  onChange: (m: SheetMapping[]) => void;
}

const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export function SheetMapper({ grids, mappings, onChange }: Props) {
  const update = (i: number, m: SheetMapping) => onChange(mappings.map((x, j) => (j === i ? m : x)));

  return (
    <div className="stack">
      <p className="hint">
        Each sheet was matched to a GSTR-1 section from its name and column headers. Check the matches below — change the section,
        the header row, or any column if Glowsis named it differently.
      </p>
      {mappings.map((m, i) => {
        const grid = grids[m.sheet] ?? [];
        const headers = grid[m.headerRow] ?? [];
        const missing = missingRequired(m);
        const dataRows = grid.slice(m.headerRow + 1).filter((r) => r?.some((c) => text(c))).length;
        const width = Math.max(headers.length, ...grid.slice(0, 30).map((r) => r?.length ?? 0));
        return (
          <section key={m.sheet} className={`card sheet ${!m.section ? 'muted' : missing.length ? 'warnline' : ''}`}>
            <div className="sheet-head">
              <h3>{m.sheet}</h3>
              <span className="meta">{dataRows} data rows</span>
              <select value={m.section ?? ''} onChange={(e) => update(i, remapSheet(m, grid, (e.target.value || null) as SectionId | null))}>
                <option value="">— Ignore this sheet —</option>
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <label className="inline">
                Header row
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, grid.length)}
                  value={m.headerRow + 1}
                  onChange={(e) => update(i, remapSheet(m, grid, m.section, Math.max(0, Number(e.target.value) - 1)))}
                />
              </label>
            </div>
            {missing.length > 0 && <p className="err">Missing required columns: {missing.join(', ')}</p>}
            {m.section && (
              <div className="fields">
                {SECTION_BY_ID[m.section].fields.map((f) => {
                  const col = m.columns[f.key];
                  const sample = col !== undefined ? grid.slice(m.headerRow + 1).find((r) => text(r?.[col]))?.[col] : undefined;
                  return (
                    <label key={f.key} className={f.required && col === undefined ? 'missing' : ''}>
                      <span>
                        {f.label}
                        {f.required && ' *'}
                      </span>
                      <select
                        value={col ?? ''}
                        onChange={(e) => {
                          const columns = { ...m.columns };
                          if (e.target.value === '') delete columns[f.key];
                          else columns[f.key] = Number(e.target.value);
                          update(i, { ...m, columns });
                        }}
                      >
                        <option value="">(not in file)</option>
                        {Array.from({ length: width }, (_, c) => (
                          <option key={c} value={c}>
                            {colName(c)}: {text(headers[c]) || '(blank)'}
                          </option>
                        ))}
                      </select>
                      {sample !== undefined && <small>e.g. {text(sample)}</small>}
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
