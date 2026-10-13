import { useMemo, useState } from 'react';
import { type Grid, type SheetMapping, detectSheet } from './lib/detect';
import { buildAuditWorkbook, buildReturnWorkbook, download, downloadJson, readHsnMasterFile, readWorkbook } from './lib/excel';
import { buildGstr1Json } from './lib/gstJson';
import { HsnMaster } from './lib/hsn';
import { load, loadRaw, remove, save } from './lib/storage';
import { DEFAULT_SETTINGS, type Settings, buildReturn } from './lib/transform';
import { SettingsPanel } from './components/SettingsPanel';
import { SheetMapper } from './components/SheetMapper';
import { HsnReview } from './components/HsnReview';
import { IssuesPanel } from './components/IssuesPanel';
import { OutputPreview } from './components/OutputPreview';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadSummary } from './components/LoadSummary';
import { SUPPLIER_GSTIN, glowsisSheets } from '../scripts/sample-data.mjs';

const SAMPLE_NAME = 'glowsis-sample.xlsx';

function sampleFile() {
  const grids = glowsisSheets as unknown as Record<string, Grid>;
  return { name: SAMPLE_NAME, grids, sample: true };
}

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
  // Opens with the bundled sample so the page shows what it does; loading a real export replaces it.
  const [file, setFile] = useState<{ name: string; grids: Record<string, Grid>; sample?: boolean } | null>(sampleFile);
  const [mappings, setMappings] = useState<SheetMapping[]>(() =>
    Object.entries(sampleFile().grids).map(([n, g]) => detectSheet(n, g)),
  );
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('sheets');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    save('rekon.settings', s);
  };

  // The sample belongs to a made-up Kerala supplier; use its GSTIN unless the user entered their own.
  const effective = useMemo(
    () => (file?.sample && !settings.gstin ? { ...settings, gstin: SUPPLIER_GSTIN, period: settings.period || '2026-08' } : settings),
    [file, settings],
  );

  // A conversion bug on unexpected data must show a message, not blank the page.
  const { result, convertError } = useMemo(() => {
    if (!file) return { result: null, convertError: '' };
    try {
      return { result: buildReturn(file.grids, mappings, effective, master, overrides), convertError: '' };
    } catch (e) {
      console.error(e);
      return { result: null, convertError: (e as Error).message || String(e) };
    }
  }, [file, mappings, effective, master, overrides]);
  const [dragging, setDragging] = useState(false);

  function loadSample() {
    const f = sampleFile();
    setFile(f);
    setMappings(Object.entries(f.grids).map(([n, g]) => detectSheet(n, g)));
    setOverrides({});
    setTab('sheets');
  }

  async function onFile(f: File) {
    setBusy(true);
    setError('');
    try {
      const buf = await f.arrayBuffer();
      // Let the "Reading…" state paint before the synchronous parse blocks the page.
      await new Promise((r) => setTimeout(r, 30));
      const { names, grids } = readWorkbook(buf);
      if (!names.length) throw new Error('the file has no sheets');
      setFile({ name: f.name, grids });
      setMappings(names.map((n) => detectSheet(n, grids[n])));
      setOverrides({});
      setTab('sheets');
    } catch (e) {
      const msg = (e as Error).message || String(e);
      setError(
        /password|encrypt/i.test(msg)
          ? `"${f.name}" is password-protected. Save it from Excel without a password and try again.`
          : `Could not read "${f.name}": ${msg}. Open it in Excel, use Save As → Excel Workbook (.xlsx), and try again.`,
      );
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
  const periodTag = effective.period ? `_${effective.period.replace('-', '')}` : '';

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
        <label
          className={`drop ${busy ? 'busy' : ''} ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
        >
          <input
            id="export-file"
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onFile(f);
            }}
          />
          <strong>
            {busy ? 'Reading file…' : file && !file.sample ? file.name : 'Click to choose the Glowsis GST export, or drop it here'}
          </strong>
          <span>
            {file && !file.sample ? `${mappings.length} sheets · click to load another file` : 'Excel (.xlsx, .xls) or CSV · all sheets are recognised automatically'}
          </span>
        </label>
        {file?.sample ? (
          <p className="sample-note">
            <strong>Showing sample data.</strong> This is a made-up Glowsis export (supplier {SUPPLIER_GSTIN}, August 2026) so you
            can see every step. Choose your own export above to replace it.
          </p>
        ) : (
          file && (
            <>
              <LoadSummary name={file.name} grids={file.grids} mappings={mappings} onOpenSheets={() => setTab('sheets')} />
              <button className="link" onClick={loadSample}>Load the sample export</button>
            </>
          )
        )}
        {error && <p className="err" role="alert">{error}</p>}
        {convertError && (
          <p className="err" role="alert">
            The file was read, but converting it failed: {convertError}. Check the Sheets tab mapping, or send this message to
            whoever maintains the app.
          </p>
        )}
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

          <ErrorBoundary resetKey={`${tab}|${file?.name}`}>
          {tab === 'sheets' && file && <SheetMapper grids={file.grids} mappings={mappings} onChange={setMappings} />}
          {tab === 'hsn' && (
            <HsnReview
              hsn={result.hsn}
              master={master}
              minDigits={effective.minHsnDigits}
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
              jsonBlockers={buildGstr1Json(result, effective).blockers}
              onDownloadJson={async () => {
                const { json, blockers } = buildGstr1Json(result, effective);
                if (!json) return blockers.join(' ');
                return downloadJson(json, `GSTR1_${json.gstin}_${json.fp}.json`);
              }}
            />
          )}
          </ErrorBoundary>
        </>
      )}
      {file && !result && <SheetMapper grids={file.grids} mappings={mappings} onChange={setMappings} />}

      <footer className="foot">
        Output follows the GSTR-1 offline tool Excel template (sheet names and column headers). Import it in the offline tool,
        validate, and generate the JSON for upload. Always review the audit report before filing.
      </footer>
    </div>
  );
}
