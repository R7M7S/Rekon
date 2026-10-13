// Builds src/data/hsn-master.txt — the bundled list of valid HSN/SAC codes.
//
// Usage:
//   node scripts/build-hsn-master.mjs <HSN_SAC.xlsx>          (official GST portal master)
//   node scripts/build-hsn-master.mjs <hsn_codes.json> <sac_codes.json>
//
// The official master can be downloaded from the GST portal:
//   https://tutorial.gst.gov.in/downloads/HSN_SAC.xlsx
// Output: one code per line, sorted, digits only (goods padded to 8 digits).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as XLSX from '@e965/xlsx';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data/hsn-master.txt');
const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: build-hsn-master.mjs <HSN_SAC.xlsx | hsn.json [sac.json]>');
  process.exit(1);
}

const codes = new Set();
const add = (raw) => {
  let c = String(raw ?? '').replace(/\D/g, '');
  if (!c) return;
  // Excel strips leading zeros from chapters 01-09.
  if (c.length === 7 || c.length === 5 || c.length === 3) c = '0' + c;
  if (c.length >= 2 && c.length <= 8) codes.add(c);
};

for (const file of args) {
  if (/\.json$/i.test(file)) {
    for (const r of JSON.parse(readFileSync(file, 'utf8'))) add(r.code ?? r.hsn ?? r.HSN_CD ?? r.SAC_CD);
  } else {
    const wb = XLSX.read(readFileSync(file));
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false });
      for (const row of rows) add(row[0]);
    }
  }
}

const sorted = [...codes].sort();
writeFileSync(out, sorted.join('\n') + '\n');
console.log(`wrote ${sorted.length} codes to ${path.relative(process.cwd(), out)}`);
