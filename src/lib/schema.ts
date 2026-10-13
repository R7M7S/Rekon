// Section definitions: which columns each GSTR-1 section needs, the header text the
// GSTR-1 offline tool expects, and the header aliases used to recognise ERP columns.

export type SectionId =
  | 'b2b'
  | 'b2cl'
  | 'b2cs'
  | 'cdnr'
  | 'cdnur'
  | 'exp'
  | 'at'
  | 'atadj'
  | 'exemp'
  | 'hsn'
  | 'hsn_b2b'
  | 'hsn_b2c'
  | 'docs'
  | 'nil_total';

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export interface SectionDef {
  id: SectionId;
  title: string;
  /** Sheet name patterns (squashed) that identify this section. */
  sheetNames: string[];
  fields: FieldDef[];
}

const f = (key: string, label: string, aliases: string[], required = false): FieldDef => ({
  key,
  label,
  aliases,
  required,
});

const GSTIN = f('gstin', 'GSTIN/UIN of Recipient', ['gstinuinofrecipient', 'gstin', 'gstno', 'customergstin', 'partygstin', 'recipientgstin', 'buyergstin', 'ctin', 'gstinuin', 'gstnumber'], true);
const NAME = f('name', 'Receiver Name', ['receivername', 'customername', 'partyname', 'name', 'recipientname', 'buyername', 'ledgername', 'tradename', 'customer', 'party']);
const INUM = f('inum', 'Invoice Number', ['invoicenumber', 'invoiceno', 'invno', 'billno', 'billnumber', 'voucherno', 'vouchernumber', 'docno', 'documentnumber', 'documentno', 'inum'], true);
const IDT = f('idt', 'Invoice date', ['invoicedate', 'invdate', 'billdate', 'voucherdate', 'docdate', 'documentdate', 'date', 'idt'], true);
const IVAL = f('val', 'Invoice Value', ['invoicevalue', 'invvalue', 'billvalue', 'billamount', 'invoiceamount', 'grandtotal', 'nettotal', 'totalinvoicevalue', 'val'], true);
const POS = f('pos', 'Place Of Supply', ['placeofsupply', 'pos', 'supplystate', 'state', 'statecode', 'statename', 'customerstate', 'destinationstate'], true);
const RCHRG = f('rchrg', 'Reverse Charge', ['reversecharge', 'rcm', 'rchrg', 'reversechargeyn']);
const APCT = f('apct', 'Applicable % of Tax Rate', ['applicableoftaxrate', 'applicabletaxrate', 'applicable', 'differentialrate', 'diffpercent']);
const INVTYP = f('invtyp', 'Invoice Type', ['invoicetype', 'invtype', 'invtyp', 'supplytype', 'type']);
const ECOM = f('ecom', 'E-Commerce GSTIN', ['ecommercegstin', 'ecomgstin', 'etin', 'ecommerceoperatorgstin', 'operatorgstin']);
const RATE = f('rate', 'Rate', ['rate', 'gstrate', 'taxrate', 'rt', 'gst', 'igstrate', 'ratepercent', 'gstpercent', 'taxpercent', 'gst%'], true);
const TXVAL = f('txval', 'Taxable Value', ['taxablevalue', 'taxableamount', 'taxableamt', 'assessablevalue', 'txval', 'taxable', 'basicamount', 'netamount', 'amount', 'value'], true);
const CESS = f('cess', 'Cess Amount', ['cessamount', 'cess', 'csamt', 'cessamt', 'compensationcess']);
const IAMT = f('iamt', 'Integrated Tax Amount', ['integratedtaxamount', 'igstamount', 'igst', 'iamt', 'igstamt', 'integratedtax']);
const CAMT = f('camt', 'Central Tax Amount', ['centraltaxamount', 'cgstamount', 'cgst', 'camt', 'cgstamt', 'centraltax']);
const SAMT = f('samt', 'State/UT Tax Amount', ['stateuttaxamount', 'sgstamount', 'sgst', 'samt', 'sgstamt', 'utgst', 'sgstutgst', 'statetax', 'sgstutgstamount']);

const NOTE_FIELDS = [
  f('nt_num', 'Note Number', ['notenumber', 'noteno', 'creditnoteno', 'debitnoteno', 'cdnno', 'notenum', 'vouchernumber', 'voucherno', 'documentnumber', 'docno'], true),
  f('nt_dt', 'Note Date', ['notedate', 'creditnotedate', 'debitnotedate', 'cdndate', 'voucherdate', 'documentdate', 'docdate', 'date'], true),
  f('ntty', 'Note Type', ['notetype', 'documenttype', 'doctype', 'ntty', 'creditdebit', 'type', 'cd'], true),
];

const HSN_FIELDS = [
  f('hsn', 'HSN', ['hsn', 'hsncode', 'hsnsac', 'hsnsaccode', 'hsnsc', 'sac', 'saccode', 'hsnno'], true),
  f('desc', 'Description', ['description', 'hsndescription', 'itemdescription', 'itemname', 'productname', 'desc', 'goodsdescription', 'particulars']),
  f('uqc', 'UQC', ['uqc', 'unit', 'uom', 'unitofmeasure', 'units', 'measure', 'unitname']),
  f('qty', 'Total Quantity', ['totalquantity', 'quantity', 'qty', 'totalqty']),
  f('val', 'Total Value', ['totalvalue', 'value', 'grossvalue', 'totalamount', 'invoicevalue', 'val']),
  TXVAL,
  IAMT,
  CAMT,
  SAMT,
  CESS,
  RATE,
  f('kind', 'B2B / B2C', ['b2bb2c', 'hsntype', 'supplycategory', 'customertype', 'recipienttype', 'registrationtype', 'category']),
];

export const SECTIONS: SectionDef[] = [
  {
    id: 'b2b',
    title: 'B2B, SEZ, DE invoices (4A, 4B, 6B, 6C)',
    sheetNames: ['b2bsezde', 'b2b'],
    fields: [GSTIN, NAME, INUM, IDT, IVAL, POS, RCHRG, APCT, INVTYP, ECOM, RATE, TXVAL, CESS],
  },
  {
    id: 'b2cl',
    title: 'B2C Large invoices (5)',
    sheetNames: ['b2cl', 'b2clarge'],
    fields: [INUM, IDT, IVAL, POS, APCT, RATE, TXVAL, CESS, ECOM],
  },
  {
    id: 'b2cs',
    title: 'B2C Small (7)',
    sheetNames: ['b2cs', 'b2csmall', 'b2c'],
    fields: [
      f('type', 'Type', ['type', 'oee', 'b2cstype']),
      POS,
      APCT,
      RATE,
      TXVAL,
      CESS,
      ECOM,
      { ...INUM, required: false },
    ],
  },
  {
    id: 'cdnr',
    title: 'Credit/Debit notes – registered (9B)',
    sheetNames: ['cdnr', 'cdnregistered', 'creditdebitnotesregistered', 'creditnoteb2b', 'debitnoteb2b', 'creditnote', 'debitnote'],
    fields: [
      GSTIN,
      NAME,
      ...NOTE_FIELDS,
      POS,
      RCHRG,
      f('nt_sply', 'Note Supply Type', ['notesupplytype', 'supplytype', 'invoicetype', 'notetype2']),
      f('nt_val', 'Note Value', ['notevalue', 'notevalueamount', 'notetotal', 'totalnotevalue', 'invoicevalue', 'value', 'val'], true),
      APCT,
      RATE,
      TXVAL,
      CESS,
    ],
  },
  {
    id: 'cdnur',
    title: 'Credit/Debit notes – unregistered (9B)',
    sheetNames: ['cdnur', 'cdnunregistered', 'creditdebitnotesunregistered', 'creditnoteb2c', 'debitnoteb2c'],
    fields: [
      f('ur_type', 'UR Type', ['urtype', 'typ', 'unregisteredtype', 'supplytype']),
      ...NOTE_FIELDS,
      { ...POS, required: false },
      f('nt_val', 'Note Value', ['notevalue', 'totalnotevalue', 'invoicevalue', 'value', 'val'], true),
      APCT,
      RATE,
      TXVAL,
      CESS,
    ],
  },
  {
    id: 'exp',
    title: 'Exports (6A)',
    sheetNames: ['exp', 'export', 'exports'],
    fields: [
      f('exp_typ', 'Export Type', ['exporttype', 'exptype', 'exptyp', 'type'], true),
      INUM,
      IDT,
      IVAL,
      f('port', 'Port Code', ['portcode', 'port', 'sbpcode']),
      f('sb_num', 'Shipping Bill Number', ['shippingbillnumber', 'shippingbillno', 'sbno', 'sbnum', 'billofexportno']),
      f('sb_dt', 'Shipping Bill Date', ['shippingbilldate', 'sbdate', 'sbdt', 'billofexportdate']),
      RATE,
      TXVAL,
      CESS,
    ],
  },
  {
    id: 'at',
    title: 'Tax liability – advances received (11A)',
    sheetNames: ['at', 'advancereceived', 'advances', 'advance'],
    fields: [POS, APCT, RATE, f('ad_amt', 'Gross Advance Received', ['grossadvancereceived', 'advancereceived', 'advanceamount', 'grossadvance', 'amount'], true), CESS],
  },
  {
    id: 'atadj',
    title: 'Adjustment of advances (11B)',
    sheetNames: ['atadj', 'advanceadjusted', 'advanceadjustment'],
    fields: [POS, APCT, RATE, f('ad_amt', 'Gross Advance Adjusted', ['grossadvanceadjusted', 'advanceadjusted', 'adjustedamount', 'grossadvance', 'amount'], true), CESS],
  },
  {
    id: 'exemp',
    title: 'Nil rated, exempted and non-GST (8)',
    sheetNames: ['exemp', 'exempt', 'nil', 'nilrated', 'nilexempt', 'nilratedexemptednongst'],
    fields: [
      f('desc', 'Description', ['description', 'supplytype', 'particulars', 'nature'], true),
      f('nil', 'Nil Rated Supplies', ['nilratedsupplies', 'nilrated', 'nil', 'nilamt']),
      f('expt', 'Exempted(other than nil rated/non GST supply)', ['exemptedotherthannilratednongstsupply', 'exempted', 'exempt', 'exemptedsupplies', 'exptamt']),
      f('ngsup', 'Non-GST Supplies', ['nongstsupplies', 'nongst', 'ngsupamt', 'nongstsupply']),
    ],
  },
  {
    id: 'nil_total',
    title: 'Nil-rated total from ERP (check only)',
    sheetNames: ['gstnill', 'gstnil', 'nill', 'niltotal'],
    fields: [
      f('desc', 'Nature of supplies', ['natureofsupplies', 'natureofsupply'], true),
      f('txval', 'Total taxable value', ['totaltaxablevalue', 'taxablevalue'], true),
    ],
  },
  { id: 'hsn', title: 'HSN summary (12) – not split', sheetNames: ['hsn', 'hsnsummary', 'hsnsac', 'hsnwise'], fields: HSN_FIELDS },
  { id: 'hsn_b2b', title: 'HSN summary (12) – B2B', sheetNames: ['hsnb2b'], fields: HSN_FIELDS },
  { id: 'hsn_b2c', title: 'HSN summary (12) – B2C', sheetNames: ['hsnb2c'], fields: HSN_FIELDS },
  {
    id: 'docs',
    title: 'Documents issued (13)',
    sheetNames: ['docs', 'doc', 'documents', 'documentsissued', 'docissue', 'documentissued'],
    fields: [
      f('doc_typ', 'Nature of Document', ['natureofdocument', 'documenttype', 'doctype', 'nature', 'document', 'vouchertype'], true),
      f('from', 'Sr. No. From', ['srnofrom', 'serialfrom', 'from', 'fromno', 'startno', 'fromserialno', 'srfrom'], true),
      f('to', 'Sr. No. To', ['srnoto', 'serialto', 'to', 'tono', 'endno', 'toserialno', 'srto'], true),
      f('totnum', 'Total Number', ['totalnumber', 'total', 'totalnos', 'totalissued', 'count', 'totnum']),
      f('cancel', 'Cancelled', ['cancelled', 'canceled', 'cancel', 'cancelledcount', 'noofcancelled']),
    ],
  },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, SectionDef>;

/** Output sheet names and headers exactly as the GSTR-1 offline tool template expects. */
export interface OutputSheet {
  name: string;
  title: string;
  headers: string[];
}

export const OUTPUT_SHEETS: Record<string, OutputSheet> = {
  b2b: {
    name: 'b2b,sez,de',
    title: 'Summary For B2B, SEZ, DE (4A, 4B, 6B, 6C)',
    headers: ['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount'],
  },
  b2cl: {
    name: 'b2cl',
    title: 'Summary For B2CL(5)',
    headers: ['Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'],
  },
  b2cs: {
    name: 'b2cs',
    title: 'Summary For B2CS(7)',
    headers: ['Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'],
  },
  cdnr: {
    name: 'cdnr',
    title: 'Summary For CDNR(9B)',
    headers: ['GSTIN/UIN of Recipient', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type', 'Place Of Supply', 'Reverse Charge', 'Note Supply Type', 'Note Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount'],
  },
  cdnur: {
    name: 'cdnur',
    title: 'Summary For CDNUR(9B)',
    headers: ['UR Type', 'Note Number', 'Note Date', 'Note Type', 'Place Of Supply', 'Note Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount'],
  },
  exp: {
    name: 'exp',
    title: 'Summary For EXP(6)',
    headers: ['Export Type', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Port Code', 'Shipping Bill Number', 'Shipping Bill Date', 'Rate', 'Taxable Value', 'Cess Amount'],
  },
  at: {
    name: 'at',
    title: 'Summary For Advance Received (11B)',
    headers: ['Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Gross Advance Received', 'Cess Amount'],
  },
  atadj: {
    name: 'atadj',
    title: 'Summary For Advance Adjusted (11B)',
    headers: ['Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Gross Advance Adjusted', 'Cess Amount'],
  },
  exemp: {
    name: 'exemp',
    title: 'Summary For Nil rated, exempted and non GST outward supplies (8)',
    headers: ['Description', 'Nil Rated Supplies', 'Exempted(other than nil rated/non GST supply)', 'Non-GST Supplies'],
  },
  hsn_b2b: {
    name: 'hsn(b2b)',
    title: 'Summary For HSN(12) - B2B',
    headers: ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount', 'Rate'],
  },
  hsn_b2c: {
    name: 'hsn(b2c)',
    title: 'Summary For HSN(12) - B2C',
    headers: ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount', 'Rate'],
  },
  docs: {
    name: 'docs',
    title: 'Summary of documents issued during the tax period (13)',
    headers: ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
  },
};
