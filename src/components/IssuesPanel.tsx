import { useState } from 'react';
import { round2 } from '../lib/normalize';
import type { Result, Severity } from '../lib/transform';

const inr = (n: number) => round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export function IssuesPanel({ result }: { result: Result }) {
  const [view, setView] = useState<Severity | 'changes'>('error');
  const by = (s: Severity) => result.issues.filter((i) => i.severity === s);

  return (
    <div className="stack">
      <section className="card">
        <h3>Reconciliation</h3>
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th className="num">Left</th>
              <th className="num">Right</th>
              <th className="num">Difference</th>
            </tr>
          </thead>
          <tbody>
            {result.recon.map((r) => {
              const diff = round2(r.left - r.right);
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{r.leftLabel}: {inr(r.left)}</td>
                  <td className="num">{r.rightLabel}: {inr(r.right)}</td>
                  <td className={`num ${Math.abs(diff) > 1 ? 'bad' : 'ok'}`}>{inr(diff)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint small">
          The first line must be zero (no value lost while fixing HSNs). Differences in the other lines usually come from
          nil-rated/exempt supplies, advances or rounding in the ERP — review them before filing.
        </p>
      </section>

      <nav className="subtabs">
        {(['error', 'warning', 'info'] as Severity[]).map((s) => (
          <button key={s} className={view === s ? 'on' : ''} onClick={() => setView(s)}>
            {s === 'error' ? 'Errors' : s === 'warning' ? 'Warnings' : 'Info'} ({by(s).length})
          </button>
        ))}
        <button className={view === 'changes' ? 'on' : ''} onClick={() => setView('changes')}>
          Changes made ({result.changes.length})
        </button>
      </nav>

      <section className="card table-wrap">
        {view === 'changes' ? (
          <table>
            <thead>
              <tr><th>Section</th><th>Source</th><th>Field</th><th>From</th><th>To</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {result.changes.map((c, i) => (
                <tr key={i}>
                  <td>{c.section}</td><td className="small mono">{c.ref}</td><td>{c.field}</td>
                  <td className="mono">{c.from}</td><td className="mono">{c.to}</td><td className="small">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : by(view).length === 0 ? (
          <p>Nothing here.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Section</th><th>Source</th><th>Message</th></tr>
            </thead>
            <tbody>
              {by(view).map((i, k) => (
                <tr key={k}>
                  <td>{i.section}</td><td className="small mono">{i.ref}</td><td>{i.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
