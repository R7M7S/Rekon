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

// Same layout as a real Glowsis "GSTR1" export (sheet names, headers, line-level
// B2B rows, blank HSN/UQC cells, "Last row" markers) with invented figures.
// Supplier: 32AABCR1234K1ZQ (Kerala). Period: 2026-08.
const B2B_HEAD = ['GSTIN_UIN_of_Recipient', 'ReceiverName', 'InvoiceNumber', 'Invoicedate', 'InvoiceValue', 'PlaceOfSupply', 'Reverse_Charge', 'ApplicableTaxRate', 'Invoice_Type', 'E_Commerce_GSTIN', 'TaxRate', 'TaxableValue', 'CessAmount', 'GSTR1_B2B_Status', 'CGST', 'SGST', 'IGST'];
const HSN_HEAD = ['HSN', 'Description', 'UQC', 'Total_Quantity', 'Total_Value', 'Taxable_Value', 'Integrated_Tax_Amount', 'Central_Tax_Amount', 'State_UT_Tax_Amount', 'Cess_Amount', 'Tax_Rate'];
const R3_HEAD = ['Nature_of_Supplies', 'Total_Taxable_Value', 'Integrated_Tax', 'Central_Tax', 'State_UT_Tax'];

export const glowsisSheets = {
  'Sales B2B': [
    B2B_HEAD,
    ['32AAFCS3456N1Z3', 'SREE TRADERS', '2026-27/1001', '03-Aug-2026', 100, 'Kerala', 'N', '', 'Regular', '', 0, 100, 0, 'Not Found', 0, 0, 0],
    ['32AAFCS3456N1Z3', 'SREE TRADERS', '2026-27/1001', '03-Aug-2026', 210, 'Kerala', 'N', '', 'Regular', '', 5, 200, 0, 'Not Found', 5, 5, 0],
    ['32AAFCS3456N1Z3', 'SREE TRADERS', '2026-27/1001', '03-Aug-2026', 590, 'Kerala', 'N', '', 'Regular', '', 18, 500, 0, 'Not Found', 45, 45, 0],
    ['33AACCT5678L1ZV', 'CHENNAI STATIONERS', '2026-27/1002', '12-Aug-2026', 1180, 'Tamil Nadu', 'N', '', 'Regular', '', 18, 1000, 0, 'Not Found', 0, 0, 180],
  ],
  'Sales B2C': [
    ['Type', 'Place_Of_Supply', 'ApplicableTaxRate', 'Rate', 'Taxable_Value', 'Cess_Amount', 'CGST', 'SGST', 'IGST'],
    ['OE', '32-Kerala', '', 0, 5000, 0, 0, 0, 0],
    ['OE', '32-Kerala', '', 5, 2000, 0, 50, 50, 0],
    ['OE', '32-Kerala', '', 18, 10000, 0, 900, 900, 0],
  ],
  'Credit Note B2B': [[]],
  'HSN B2B': [
    HSN_HEAD,
    ['', '', '', 1, 100, 100, 0, 0, 0, 0, 0],
    ['48201010', '', 'NOS', 2, 210, 200, 0, 5, 5, 0, 5],
    ['4820', '', '', 5, 1180, 1000, 180, 0, 0, 0, 18],
    ['39269090', '', 'NOS', 1, 590, 500, 0, 45, 45, 0, 18],
  ],
  'HSN B2C': [
    HSN_HEAD,
    ['', '', '', 10, 1500, 1500, 0, 0, 0, 0, 0],
    ['49011010', '', 'NOS', 20, 3500, 3500, 0, 0, 0, 0, 0],
    ['', '', 'NOS', 3, 1050, 1000, 0, 25, 25, 0, 5],
    ['7323', '', '', 4, 1050, 1000, 0, 25, 25, 0, 5],
    ['4820', '', 'NOS', 30, 7080, 6000, 0, 540, 540, 0, 18],
    ['96190009', '', '', 10, 4720, 4000, 0, 360, 360, 0, 18],
  ],
  'GST DOC': [
    ['Nature_of_Document', 'Sr_No_From', 'Sr_No_To', 'Total_Number', 'Cancelled', 'Net_Issued'],
    ['Invoice for outward supply', '2026-27/1001', '2026-27/1002', 2, 0, 2],
    ['Invoice for outward supply (POS)', '2026-27/5001-0', '2026-27/5450-0', 450, 2, 448],
    ['Credit Note', null, null, 0, 0, 0],
    ['Debit Note', null, null, 0, 0, 0],
    ['', 'Last row', '', 0, 0, 0],
  ],
  'GST R3': [R3_HEAD, ['Taxable', 13700, 180, 1015, 1015], ['Nil', 5100, 0, 0, 0]],
  'GST Nill': [R3_HEAD, ['Nill', 5100, 0, 0, 0], ['last row', 0, 0, 0, 0]],
};
