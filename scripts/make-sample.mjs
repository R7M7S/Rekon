// Writes samples/glowsis-sample.xlsx for trying the app.
import { writeFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { sampleSheets } from './sample-data.mjs';

const wb = XLSX.utils.book_new();
for (const [name, aoa] of Object.entries(sampleSheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
writeFileSync(new URL('../samples/glowsis-sample.xlsx', import.meta.url), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log('wrote samples/glowsis-sample.xlsx');
