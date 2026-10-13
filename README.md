# Rekon — Glowsis ERP → GSTR-1 converter

A browser app that takes the GST Excel export from **Glowsis ERP** (8 sheets) and reshapes it into a
workbook you can import into the **GSTR-1 offline tool**. It fixes invalid HSN codes along the way.

Everything runs in the browser. Your GST data is never uploaded anywhere.

## What it does

1. **Reads every sheet** of the export and works out which GSTR-1 section each one is
   (B2B, B2CL, B2CS, CDNR, CDNUR, EXP, HSN, DOCS, plus nil/exempt and advances if present). It uses
   the sheet names and the column headers. It also finds the header row when there are title rows above it.
   You can change any section or column match on the **Sheets** tab.
2. **Checks every HSN** against the GST HSN/SAC master:
   - only digits, 4/6/8 long, and at least 4 digits (turnover up to ₹5 Cr) or 6 digits (above ₹5 Cr);
   - must exist in the master. A leading zero that Excel dropped is put back (`7019000` → `07019000`).
3. **Moves each invalid HSN to a valid HSN with the same GST rate** that is already in the return:
   - the closest code wins (longest shared prefix, e.g. `84719999` → `84713010`). If no code is close,
     the same-rate HSN with the highest taxable value is used;
   - goods are never moved into service (SAC `99…`) codes, and rows are never moved across rates;
   - if no valid HSN has that rate, the code is cut back to its valid heading (8 → 6 → 4 digits);
   - quantity, values and taxes are added to the target row, so **totals per rate stay the same**.
     The Validation tab checks this;
   - you can choose any other valid HSN by hand on the **HSN check** tab.
4. **Reshapes the data for the return**:
   - dates → `dd-mmm-yyyy`; place of supply → `32-Kerala`. Names, codes and abbreviations are all
     recognised, and a missing POS is taken from the recipient GSTIN;
   - GSTINs are upper-cased and their check digit is verified. Rates are normalised (`18%`, `0.18` → `18`).
     Units are mapped to UQC (`Kg` → `KGS-KILOGRAMS`), and services get UQC `NA` with quantity `0`;
   - B2B/B2CL/EXP line items are combined into one row per invoice and rate. B2CS is summed by type,
     POS and rate;
   - B2CL invoices that are intra-state or under the limit (₹1,00,000 by default) are moved into B2CS;
   - credit/debit note amounts are made positive. Document totals are calculated from the serial range.
     Total/summary rows are skipped. HSN descriptions are stripped of characters the offline tool rejects.
5. **Validates and reconciles.** It lists errors (things the offline tool will reject) and warnings, and
   logs every change it made with the source row (e.g. `B2B!R14`). It also compares invoice totals
   with the HSN summary.
6. **Glowsis specifics** (from a real `GSTR1` export):
   - **Sheets:** `Sales B2B`, `Sales B2C`, `HSN B2B`, `HSN B2C` and `GST DOC` are recognised. `GST R3` (the 3B summary)
     is ignored, and `GST Nill` is used only to check Table 8.
   - **Invoice values:** Glowsis gives each line's value in `InvoiceValue`, so a line-level invoice's value is the
     sum of its lines.
   - **0% lines:** 0% lines are reported as nil-rated supplies in Table 8 instead of B2B/B2CS. You can turn this off
     in Settings. If `GST Nill` is larger than the 0% lines, Settings lets you choose which Table 8 row gets the
     difference.
   - **Units and marker rows:** HSN rows without a unit are reported as `OTH-OTHERS` with one summary warning.
     Empty document rows and `Last row` markers are skipped.
7. **Downloads**:
   - `GSTR1_<GSTIN>_<MMYYYY>.json`: upload it at GST portal → Returns → GSTR-1 → Prepare Offline → Upload. It needs
     your GSTIN and the return period in Settings. If the portal asks for a newer schema version, change
     `JSON_VERSION` in `src/lib/gstJson.ts`;
   - `…_GSTR1.xlsx`: sheet names and column headers follow the offline tool template (`b2b,sez,de`,
     `b2cl`, `b2cs`, `cdnr`, `cdnur`, `exp`, `exemp`, `hsn(b2b)`, `hsn(b2c)`, `docs`). Headers are on
     row 4 and data starts on row 5;
   - `…_GSTR1_audit.xlsx`: summary, HSN fixes, every change, and every issue.

## Using it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html: one self-contained file
```

`dist/index.html` works offline. Copy it to any PC and double-click it; no server or internet is needed.

Workflow: enter your GSTIN, return period and turnover band → choose the Glowsis export → check the
**Sheets** and **HSN check** tabs → clear any **Validation** errors → download → in the offline tool,
use *Import Files → Import Excel*, validate, and generate the JSON for upload.

Try it with `samples/glowsis-sample.xlsx`, which has the Glowsis layout with invented figures (supplier GSTIN
`32AABCR1234K1ZQ`, period 2026-08). `samples/generic-sample.xlsx` uses differently named columns.

## HSN master

The app ships with a list of about 13,000 HSN/SAC codes (`src/data/hsn-master.txt`). For the most accurate
check, download the official master from the GST portal
(<https://tutorial.gst.gov.in/downloads/HSN_SAC.xlsx>) and load it with **Load official HSN_SAC.xlsx**
in the app. The browser remembers it. To replace the bundled list permanently:

```bash
node scripts/build-hsn-master.mjs path/to/HSN_SAC.xlsx
```

## Development

```bash
npm test           # unit + end-to-end conversion tests
npm run typecheck
node scripts/make-sample.mjs   # regenerate samples/glowsis-sample.xlsx
```

| Path | Purpose |
| --- | --- |
| `src/lib/schema.ts` | GSTR-1 sections, offline-tool headers, and header aliases for column recognition. Add Glowsis column names here if any are not recognised. |
| `src/lib/detect.ts` | Header-row, sheet-type and column detection |
| `src/lib/hsn.ts` | HSN master, validation and the same-rate remapping logic |
| `src/lib/transform.ts` | Section-by-section reshaping, validation and reconciliation |
| `src/lib/normalize.ts` | Dates, numbers, POS, GSTIN, rates, UQC, etc. |
| `src/lib/excel.ts` | Reading the export, writing the return and audit workbooks |
