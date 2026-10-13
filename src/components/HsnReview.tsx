import { useState } from 'react';
import { type HsnMaster, type HsnResolution, checkHsn } from '../lib/hsn';
import { round2 } from '../lib/normalize';

interface Props {
  hsn: HsnResolution[];
  master: HsnMaster;
  minDigits: number;
  overrides: Record<string, string>;
  onOverride: (key: string, code: string) => void;
}

const METHOD_LABEL: Record<string, string> = {
  valid: 'Valid',
  normalized: 'Cleaned',
  remapped: 'Moved (same rate)',
  truncated: 'Shortened',
  manual: 'Manual',
  unresolved: 'Needs choice',
};

const inr = (n: number) => round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export function HsnReview({ hsn, master, minDigits, overrides, onOverride }: Props) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? hsn : hsn.filter((h) => h.method !== 'valid' || overrides[h.key]);
  const invalid = hsn.filter((h) => h.method !== 'valid');

  return (
    <div className="stack">
      <section className="card">
        <p className="hint">
          Every HSN is checked against the GST HSN master ({master.size.toLocaleString()} codes, minimum {minDigits} digits).
          An invalid HSN is moved into a <strong>valid HSN already in this return with the same GST rate</strong> — the closest
          code (longest shared prefix) first, otherwise the one with the highest taxable value. Goods never move into service
          codes. Quantity, value and tax are added to the target row, so totals per rate never change. You can type any other
          valid HSN in the last column.
        </p>
        <div className="summary-row">
          <span><strong>{hsn.length}</strong> HSN/rate combinations</span>
          <span><strong>{hsn.length - invalid.length}</strong> valid</span>
          <span className="ok"><strong>{invalid.filter((h) => h.method !== 'unresolved').length}</strong> fixed</span>
          <span className={invalid.some((h) => h.method === 'unresolved') ? 'bad' : ''}>
            <strong>{invalid.filter((h) => h.method === 'unresolved').length}</strong> need your choice
          </span>
          <label className="check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show valid HSNs too
          </label>
        </div>
      </section>
      {rows.length === 0 ? (
        <section className="card"><p>All HSN codes are valid — nothing to fix.</p></section>
      ) : (
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>HSN in file</th>
                <th>Description</th>
                <th className="num">Rate</th>
                <th className="num">Rows</th>
                <th className="num">Taxable value</th>
                <th>Problem</th>
                <th>Reported as</th>
                <th>Change to</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.key} className={h.method === 'unresolved' ? 'row-bad' : ''}>
                  <td className="mono">{h.raw || '(blank)'}</td>
                  <td>{h.description}</td>
                  <td className="num">{h.rate}%</td>
                  <td className="num">{h.rows}</td>
                  <td className="num">{inr(h.txval)}</td>
                  <td className="small">{h.reason}</td>
                  <td>
                    <span className="mono">{h.code || '—'}</span> <span className={`badge m-${h.method}`}>{METHOD_LABEL[h.method]}</span>
                  </td>
                  <td>
                    <OverrideInput
                      res={h}
                      value={overrides[h.key] ?? ''}
                      master={master}
                      minDigits={minDigits}
                      onCommit={(code) => onOverride(h.key, code)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function OverrideInput({ res, value, master, minDigits, onCommit }: {
  res: HsnResolution;
  value: string;
  master: HsnMaster;
  minDigits: number;
  onCommit: (code: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const chk = draft ? checkHsn(draft, master, minDigits) : null;
  const listId = `cand-${res.key.replace(/\W/g, '_')}`;

  return (
    <div className="override">
      <input
        list={listId}
        value={draft}
        placeholder={res.candidates.length ? 'pick or type HSN' : 'type valid HSN'}
        className={chk && !chk.ok ? 'invalid' : ''}
        onChange={(e) => {
          const v = e.target.value.trim();
          setDraft(v);
          if (!v) onCommit('');
          else {
            const c = checkHsn(v, master, minDigits);
            if (c.ok) onCommit(c.code);
          }
        }}
      />
      <datalist id={listId}>
        {res.candidates.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {chk && !chk.ok && <small className="err">{chk.reason}</small>}
    </div>
  );
}
