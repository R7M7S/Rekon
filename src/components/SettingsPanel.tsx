import type { HsnMaster } from '../lib/hsn';
import { cleanGstin, isValidGstin, posLabel } from '../lib/normalize';
import { NIL_TYPES, type Settings } from '../lib/transform';
import { EXEMP_DESCRIPTIONS } from '../lib/gstData';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  master: HsnMaster;
  onMasterFile: (f: File) => void;
  onResetMaster: () => void;
}

export function SettingsPanel({ settings, onChange, master, onMasterFile, onResetMaster }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const g = cleanGstin(settings.gstin);
  const gstinOk = isValidGstin(g);
  const bundled = master.source.startsWith('Bundled');

  return (
    <section className="card settings">
      <div className="grid">
        <label>
          <span>Your GSTIN</span>
          <input
            value={settings.gstin}
            placeholder="32AAAAA0000A1Z5"
            maxLength={15}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
            className={settings.gstin && !gstinOk ? 'invalid' : ''}
          />
          <small>{gstinOk ? `Home state ${posLabel(g.slice(0, 2))}` : settings.gstin ? 'Invalid GSTIN' : 'Used for inter/intra-state checks'}</small>
        </label>
        <label>
          <span>Return period</span>
          <input type="month" value={settings.period} onChange={(e) => set('period', e.target.value)} />
          <small>Flags invoices dated outside the month</small>
        </label>
        <label>
          <span>Aggregate turnover (previous FY)</span>
          <select value={settings.minHsnDigits} onChange={(e) => set('minHsnDigits', Number(e.target.value) as 4 | 6)}>
            <option value={4}>Up to ₹5 crore — HSN min 4 digits</option>
            <option value={6}>Above ₹5 crore — HSN min 6 digits</option>
          </select>
        </label>
        <label>
          <span>B2C Large limit (₹)</span>
          <input type="number" min={0} step={1000} value={settings.b2clLimit} onChange={(e) => set('b2clLimit', Number(e.target.value) || 0)} />
          <small>Inter-state B2C invoices above this go to B2CL</small>
        </label>
        <label>
          <span>HSN sheet not split into B2B/B2C?</span>
          <select value={settings.hsnDefaultTab} onChange={(e) => set('hsnDefaultTab', e.target.value as Settings['hsnDefaultTab'])}>
            <option value="hsn_b2b">Report under HSN (B2B)</option>
            <option value="hsn_b2c">Report under HSN (B2C)</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.moveSmallB2cl} onChange={(e) => set('moveSmallB2cl', e.target.checked)} />
          <span>Move non-qualifying B2CL invoices (intra-state or under the limit) to B2CS</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.zeroRateToNil} onChange={(e) => set('zeroRateToNil', e.target.checked)} />
          <span>Report 0% invoice lines as nil-rated supplies in Table 8 (not in B2B / B2C)</span>
        </label>
        <label>
          <span>ERP nil sheet total not covered by 0% lines</span>
          <select value={settings.nilSheetDiff} onChange={(e) => set('nilSheetDiff', e.target.value as Settings['nilSheetDiff'])}>
            <option value="ignore">Leave out (warn only)</option>
            {NIL_TYPES.map((t, i) => (
              <option key={t} value={t}>Add to: {EXEMP_DESCRIPTIONS[i]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="master">
        <span>
          HSN master: <strong>{master.source}</strong> · {master.size.toLocaleString()} codes
        </span>
        <label className="link">
          <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onMasterFile(f);
          }} />
          Load official HSN_SAC.xlsx
        </label>
        {!bundled && (
          <button className="link" onClick={onResetMaster}>
            Use bundled list
          </button>
        )}
      </div>
    </section>
  );
}
