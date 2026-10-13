import type { Grid, SheetMapping } from '../lib/detect';
import { text } from '../lib/normalize';
import { SECTION_BY_ID } from '../lib/schema';

/** Says plainly what was found in the uploaded file, so a load is never silent. */
export function LoadSummary({ name, grids, mappings, onOpenSheets }: {
  name: string;
  grids: Record<string, Grid>;
  mappings: SheetMapping[];
  onOpenSheets: () => void;
}) {
  const rowsOf = (m: SheetMapping) =>
    (grids[m.sheet] ?? []).slice(m.headerRow + 1).filter((r) => r?.some((c) => text(c))).length;
  const found = mappings.filter((m) => m.section);
  const missed = mappings.filter((m) => !m.section);
  const totalRows = mappings.reduce((s, m) => s + (grids[m.sheet] ?? []).filter((r) => r?.some((c) => text(c))).length, 0);

  return (
    <div className={`load-summary ${found.length ? '' : 'bad'}`} role="status">
      <p>
        <strong>Loaded {name}</strong>: {mappings.length} sheet{mappings.length === 1 ? '' : 's'}, {totalRows.toLocaleString()} non-empty rows.{' '}
        {found.length ? `${found.length} recognised as GST return data.` : 'No sheet was recognised as GST return data.'}
      </p>
      {totalRows === 0 && <p>The file looks empty. Check that you exported the report with data, then choose it again.</p>}
      <ul>
        {found.map((m) => (
          <li key={m.sheet}>
            <span className="mono">{m.sheet}</span> → {SECTION_BY_ID[m.section!].title} · {rowsOf(m)} rows
          </li>
        ))}
        {missed.map((m) => (
          <li key={m.sheet} className="muted-item">
            <span className="mono">{m.sheet}</span> → not recognised (ignored)
          </li>
        ))}
      </ul>
      {missed.length > 0 && (
        <p>
          Sheets that weren't recognised are ignored. If one of them holds return data,{' '}
          <button className="link" onClick={onOpenSheets}>open the Sheets tab</button> and choose its section and columns.
        </p>
      )}
    </div>
  );
}
