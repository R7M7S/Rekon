import { useState } from 'react';
import { OUTPUT_SHEETS } from '../lib/schema';
import type { Result } from '../lib/transform';

interface Props {
  result: Result;
  errors: number;
  onDownloadReturn: () => Promise<string>;
  onDownloadAudit: () => Promise<string>;
  onDownloadJson: () => Promise<string>;
  jsonBlockers: string[];
}

export function OutputPreview({ result, errors, onDownloadReturn, onDownloadAudit, onDownloadJson, jsonBlockers }: Props) {
  const keys = Object.keys(OUTPUT_SHEETS).filter((k) => result.sheets[k]?.length);
  const [sel, setSel] = useState(keys[0] ?? '');
  const [status, setStatus] = useState('');
  const run = async (fn: () => Promise<string>) => setStatus(await fn());
  const active = keys.includes(sel) ? sel : keys[0];
  const def = active ? OUTPUT_SHEETS[active] : null;
  const rows = active ? result.sheets[active] : [];

  return (
    <div className="stack">
      <section className="card actions">
        <div>
          <button className="primary" disabled={jsonBlockers.length > 0} onClick={() => run(onDownloadJson)}>
            Download JSON for GST portal
          </button>
          <button onClick={() => run(onDownloadReturn)}>Download offline-tool Excel</button>
          <button onClick={() => run(onDownloadAudit)}>Download audit report</button>
        </div>
        {jsonBlockers.length > 0 && <p className="err">To create the JSON: {jsonBlockers.join(' ')}</p>}
        <p className="hint small">
          Upload the JSON at GST portal → Returns → GSTR-1 → Prepare Offline → Upload. If the portal rejects it, import the
          offline-tool Excel into the GST Offline Tool and generate the JSON there.
        </p>
        {status && <p className="status" role="status">{status}</p>}
        {errors > 0 ? (
          <p className="err">
            {errors} error(s) remain — the offline tool will reject those rows. Fix them in Glowsis or in the Validation tab first.
          </p>
        ) : (
          <p className="ok">No blocking errors.</p>
        )}
      </section>

      <nav className="subtabs">
        {keys.map((k) => (
          <button key={k} className={k === active ? 'on' : ''} onClick={() => setSel(k)}>
            {OUTPUT_SHEETS[k].name} ({result.sheets[k].length})
          </button>
        ))}
      </nav>

      {def && (
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>{def.headers.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={typeof c === 'number' ? 'num' : ''}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 500 && <p className="hint small">Showing first 500 of {rows.length} rows; the download contains all.</p>}
        </section>
      )}
    </div>
  );
}
