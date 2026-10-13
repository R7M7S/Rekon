import { useMemo, useState } from 'react';
import { type Grid, type SheetMapping, detectSheet } from './lib/detect';
import { buildAuditWorkbook, buildReturnWorkbook, download, readHsnMasterFile, readWorkbook } from './lib/excel';
import { HsnMaster } from './lib/hsn';
import { load, loadRaw, remove, save } from './lib/storage';
import { DEFAULT_SETTINGS, type Settings, buildReturn } from './lib/transform';
import { SettingsPanel } from './components/SettingsPanel';
import { SheetMapper } from './components/SheetMapper';
import { HsnReview } from './components/HsnReview';
import { IssuesPanel } from './components/IssuesPanel';
import { OutputPreview } from './components/OutputPreview';

type Tab = 'sheets' | 'hsn' | 'issues' | 'output';

const MASTER_KEY = 'rekon.hsnMaster';

function initialMaster() {
  const custom = loadRaw(MASTER_KEY);
  if (custom) {
    const [source, ...codes] = custom.split('\n');
    return new HsnMaster(codes, source);
  }
  return HsnMaster.bundled();
}

export default function App() {
  const [settings, setSettingsState] = useState<Settings>(() => load('rekon.settings', DEFAULT_SETTINGS));
  const [master, setMaster] = useState(initialMaster);
  const [file, setFile] = useState<{ name: string; grids: Record<string, Grid> } | null>(null);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('sheets');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    save('rekon.settings', s);
  };

  const result = useMemo(
    () => (file ? buildReturn(file.grids, mappings, settings, master, overrides) : null),
    [file, mappings, settings, master, overrides],
  );

  async function onFile(f: File) {
    setBusy(true);
    setError('');
    try {
      const { names, grids } = readWorkbook(await f.arrayBuffer());
      setFile({ name: f.name, grids });
      setMappings(names.map((n) => detectSheet(n, grids[n])));
      setOverrides({});
      setTab('sheets');
    } catch (e) {
      setError(`Could not read "${f.name}": ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onMasterFile(f: File) {
    try {
      const codes = readHsnMasterFile(await f.arrayBuffer());
      if (codes.length < 1000) throw new Error(`only ${codes.length} codes found — is this the HSN master?`);
      const m = new HsnMaster(codes, `${f.name} (uploaded ${new Date().toLocaleDateString()})`);
      save(MASTER_KEY, [m.source, ...m.codes].join('\n'));
      setMaster(m);
    } catch (e) {
      setError(`HSN master not loaded: ${(e as Error).message}`);
    }
  }

  function resetMaster() {
    remove(MASTER_KEY);
    setMaster(HsnMaster.bundled());
  }

  const counts = result
    ? {
        errors: result.issues.filter((i) => i.severity === 'error').length,
        warnings: result.issues.filter((i) => i.severity === 'warning').length,
        hsnFixed: result.hsn.filter((h) => h.method !== 'valid' && h.method !== 'unresolved').length,
        hsnOpen: result.hsn.filter((h) => h.method === 'unresolved').length,
      }
    : null;

  const baseName = (file?.name ?? 'gstr1').replace(/\.[^.]+$/, '');
  const periodTag = settings.period ? `_${settings.period.replace('-', '')}` : '';

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Rekon</h1>
          <p className="sub">Glowsis ERP export → GSTR-1 offline tool workbook. Files are processed in your browser and never uploaded.</p>
        </div>
      </header>

      <SettingsPanel
        settings={settings}
        onChange={setSettings}
        master={master}
        onMasterFile={onMasterFile}
        onResetMaster={resetMaster}
      />

      <section className="card upload">
        <label className={`drop ${busy ? 'busy' : ''}`}>
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onFile(f);
            }}
          />
          <strong>{file ? file.name : 'Choose the Glowsis GST export (.xlsx / .xls)'}</strong>
          <span>{file ? `${mappings.length} sheets · click to load another file` : 'All 8 sheets are read and recognised automatically'}</span>
        </label>
        {error && <p className="err">{error}</p>}
      </section>

      {result && counts && (
        <>
          <nav className="tabs">
            <button className={tab === 'sheets' ? 'on' : ''} onClick={() => setTab('sheets')}>
              1. Sheets <span className="pill">{mappings.filter((m) => m.section).length}/{mappings.length}</span>
            </button>
            <button className={tab === 'hsn' ? 'on' : ''} onClick={() => setTab('hsn')}>
              2. HSN check
              {counts.hsnOpen > 0 ? <span className="pill bad">{counts.hsnOpen} open</span> : <span className="pill ok">{counts.hsnFixed} fixed</span>}
            </button>
            <button className={tab === 'issues' ? 'on' : ''} onClick={() => setTab('issues')}>
              3. Validation
              {counts.errors > 0 ? <span className="pill bad">{counts.errors}</span> : <span className="pill ok">✓</span>}
              {counts.warnings > 0 && <span className="pill warn">{counts.warnings}</span>}
            </button>
            <button className={tab === 'output' ? 'on' : ''} onClick={() => setTab('output')}>
              4. Preview &amp; download
            </button>
          </nav>

          {tab === 'sheets' && file && <SheetMapper grids={file.grids} mappings={mappings} onChange={setMappings} />}
          {tab === 'hsn' && (
            <HsnReview
              hsn={result.hsn}
              master={master}
              minDigits={settings.minHsnDigits}
              overrides={overrides}
              onOverride={(key, code) => setOverrides((o) => {
                const next = { ...o };
                if (code) next[key] = code;
                else delete next[key];
                return next;
              })}
            />
          )}
          {tab === 'issues' && <IssuesPanel result={result} />}
          {tab === 'output' && (
            <OutputPreview
              result={result}
              errors={counts.errors}
              onDownloadReturn={() => download(buildReturnWorkbook(result), `${baseName}${periodTag}_GSTR1.xlsx`)}
              onDownloadAudit={() => download(buildAuditWorkbook(result), `${baseName}${periodTag}_GSTR1_audit.xlsx`)}
            />
          )}
        </>
      )}

      <footer className="foot">
        Output follows the GSTR-1 offline tool Excel template (sheet names and column headers). Import it in the offline tool,
        validate, and generate the JSON for upload. Always review the audit report before filing.
      </footer>
    </div>
  );
}
