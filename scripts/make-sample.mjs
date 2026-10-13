// Writes the sample exports in samples/ for trying the app.
import { writeFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { glowsisSheets, sampleSheets } from './sample-data.mjs';

for (const [file, sheets] of [['glowsis-sample.xlsx', glowsisSheets], ['generic-sample.xlsx', sampleSheets]]) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  writeFileSync(new URL(`../samples/${file}`, import.meta.url), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`wrote samples/${file}`);
}
