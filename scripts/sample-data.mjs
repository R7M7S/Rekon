// A messy, Glowsis-style GST export used by the tests and samples/glowsis-sample.xlsx.
// Supplier: 32AABCR1234K1ZQ (Kerala). Period: 2026-09.
export const SUPPLIER_GSTIN = '32AABCR1234K1ZQ';

export const sampleSheets = {
  B2B: [
    ['GST Sales Register - B2B'],
    [],
    ['Customer GSTIN', 'Party Name', 'Bill No', 'Bill Date', 'Bill Amount', 'State', 'RCM', 'Item HSN', 'GST %', 'Taxable Amt', 'Cess'],
    ['33aacct5678l1zv', 'Tamil Traders', 'GL/26/001', '05/09/2026', 11800, 'Tamil Nadu', 'No', '84713010', '18%', 6000, 0],
    ['33AACCT5678L1ZV', 'Tamil Traders', 'GL/26/001', '05/09/2026', 11800, 'Tamil Nadu', 'No', '84713010', '18%', 4000, 0],
    ['29AADCB9012M1ZF', 'Bangalore Bits', 'GL/26/002', 46284, 5600, '', 'N', '30049099', 12, 5000, 0],
    ['Grand Total', '', '', '', 17400, '', '', '', '', 15000, 0],
  ],
  B2CL: [
    ['Invoice No', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Rate', 'Taxable Value', 'Cess Amount'],
    ['GL/26/010', '10-Sep-2026', 236000, '27-Maharashtra', 18, 200000, 0],
    ['GL/26/011', '11-Sep-2026', 59000, 'Karnataka', 18, 50000, 0],
    ['GL/26/012', '12-Sep-2026', 177000, 'Kerala', 18, 150000, 0],
  ],
  B2CS: [
    ['Type', 'Place Of Supply', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'],
    ['OE', '32-Kerala', 18, 1000, 0, ''],
    ['OE', 'Kerala', 18, 2000, 0, ''],
    ['OE', '32-Kerala', 5, 500, 0, ''],
  ],
  CDNR: [
    ['GSTIN of Recipient', 'Receiver Name', 'Note No', 'Note Date', 'Note Type', 'Place Of Supply', 'Note Value', 'Rate', 'Taxable Value'],
    ['33AACCT5678L1ZV', 'Tamil Traders', 'CN/26/001', '20/09/2026', 'Credit Note', '33', -1180, 18, -1000],
  ],
  CDNUR: [
    ['UR Type', 'Note Number', 'Note Date', 'Note Type', 'Place Of Supply', 'Note Value', 'Rate', 'Taxable Value'],
    ['B2CL', 'CN/26/002', '21/09/2026', 'C', '27-Maharashtra', 11800, 18, 10000],
  ],
  EXP: [
    ['Export Type', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Port Code', 'Shipping Bill Number', 'Shipping Bill Date', 'Rate', 'Taxable Value'],
    ['WOPAY', 'EX/26/001', '15/09/2026', 100000, 'INCOK1', '1234567', '16/09/2026', 0, 100000],
  ],
  HSN: [
    ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount', 'Rate'],
    [84713010, 'Laptops.', 'Nos', 10, 11800, 10000, 1800, 0, 0, 0, 18],
    [30049099, 'Medicines', 'Box', 50, 5600, 5000, 600, 0, 0, 0, 12],
    [84719999, 'Laptop parts', 'Pcs', 5, 236000, 200000, 36000, 0, 0, 0, 18],
    ['123', 'Misc goods', 'Kg', 2, 59000, 50000, 9000, 0, 0, 0, 18],
    [7019000, 'Potatoes', 'KGS', 100, 103000, 103000, 0, 0, 0, 0, 0],
    [39231090, 'Plastic boxes', 'Nos', 30, 180500, 153500, 0, 13815, 13815, 0, 18],
    [4019999, 'Dairy item', 'Kg', 1, 525, 500, 0, 12.5, 12.5, 0, 5],
    [998314, 'IT consulting', 'Nos', 1, 0, 0, 0, 0, 0, 0, 18],
  ],
  DOCS: [
    ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
    ['Sales Invoice', 'GL/26/001', 'GL/26/012', '', 1],
    ['Credit Note', 'CN/26/001', 'CN/26/002', 2, 0],
  ],
};
