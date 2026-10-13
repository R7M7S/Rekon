// Static GST reference data used by the GSTR-1 offline tool.

export const STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli & Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '96': 'Foreign Country',
  '97': 'Other Territory',
};

// Alternative spellings / abbreviations seen in ERP exports.
export const STATE_ALIASES: Record<string, string> = {
  jk: '01', jammuandkashmir: '01', jammukashmir: '01',
  hp: '02', pb: '03', ch: '04', uk: '05', ut: '05', uttaranchal: '05',
  hr: '06', dl: '07', newdelhi: '07', nctofdelhi: '07', rj: '08', up: '09',
  br: '10', sk: '11', ar: '12', nl: '13', mn: '14', mz: '15', tr: '16', ml: '17',
  as: '18', wb: '19', jh: '20', od: '21', or: '21', orissa: '21', cg: '22', ct: '22',
  mp: '23', gj: '24', dd: '26', dn: '26', damananddiu: '26', dadraandnagarhaveli: '26',
  dadranagarhaveli: '26', mh: '27', ka: '29', ga: '30', ld: '31', kl: '32', tn: '33',
  py: '34', pondicherry: '34', an: '35', andamanandnicobar: '35', andamanandnicobarislands: '35',
  ts: '36', tg: '36', ap: '37', la: '38', foreign: '96', othercountry: '96', export: '96',
  othterritory: '97', otherterritory: '97',
};

export const VALID_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];

export const UQC: Record<string, string> = {
  BAG: 'BAGS', BAL: 'BALE', BDL: 'BUNDLES', BKL: 'BUCKLES', BOU: 'BILLION OF UNITS',
  BOX: 'BOX', BTL: 'BOTTLES', BUN: 'BUNCHES', CAN: 'CANS', CBM: 'CUBIC METERS',
  CCM: 'CUBIC CENTIMETERS', CMS: 'CENTIMETERS', CTN: 'CARTONS', DOZ: 'DOZENS', DRM: 'DRUMS',
  GGK: 'GREAT GROSS', GMS: 'GRAMMES', GRS: 'GROSS', GYD: 'GROSS YARDS', KGS: 'KILOGRAMS',
  KLR: 'KILOLITRE', KME: 'KILOMETRE', LTR: 'LITRES', MLT: 'MILILITRE', MTR: 'METERS',
  MTS: 'METRIC TON', NOS: 'NUMBERS', OTH: 'OTHERS', PAC: 'PACKS', PCS: 'PIECES',
  PRS: 'PAIRS', QTL: 'QUINTAL', ROL: 'ROLLS', SET: 'SETS', SQF: 'SQUARE FEET',
  SQM: 'SQUARE METERS', SQY: 'SQUARE YARDS', TBS: 'TABLETS', TGM: 'TEN GROSS',
  THD: 'THOUSANDS', TON: 'TONNES', TUB: 'TUBES', UGS: 'US GALLONS', UNT: 'UNITS',
  YDS: 'YARDS', NA: '',
};

// Common ERP unit names -> UQC code.
export const UQC_ALIASES: Record<string, string> = {
  PC: 'PCS', PIECE: 'PCS', PIECES: 'PCS', PCE: 'PCS',
  NO: 'NOS', NUMBER: 'NOS', NUMBERS: 'NOS', NUM: 'NOS', EA: 'NOS', EACH: 'NOS', QTY: 'NOS',
  UNIT: 'UNT', UNITS: 'UNT', U: 'UNT',
  KG: 'KGS', KGM: 'KGS', KILO: 'KGS', KILOGRAM: 'KGS', KILOGRAMS: 'KGS', KILOS: 'KGS',
  G: 'GMS', GM: 'GMS', GRAM: 'GMS', GRAMS: 'GMS', GRM: 'GMS', GMS: 'GMS',
  L: 'LTR', LT: 'LTR', LTRS: 'LTR', LITRE: 'LTR', LITER: 'LTR', LITRES: 'LTR', LITERS: 'LTR',
  ML: 'MLT', MILLILITRE: 'MLT', MILLILITER: 'MLT',
  M: 'MTR', MET: 'MTR', METER: 'MTR', METRE: 'MTR', METERS: 'MTR', METRES: 'MTR', MTRS: 'MTR',
  CM: 'CMS', CENTIMETER: 'CMS', KM: 'KME',
  TONNE: 'TON', TONNES: 'TON', TONS: 'TON', MT: 'MTS', METRICTON: 'MTS',
  PKT: 'PAC', PACK: 'PAC', PACKET: 'PAC', PACKETS: 'PAC', PACKS: 'PAC', PKTS: 'PAC',
  DOZEN: 'DOZ', DZ: 'DOZ', PAIR: 'PRS', PAIRS: 'PRS', PR: 'PRS',
  BOTTLE: 'BTL', BOTTLES: 'BTL', BOXES: 'BOX', BX: 'BOX', BAGS: 'BAG',
  ROLL: 'ROL', ROLLS: 'ROL', SETS: 'SET', CARTON: 'CTN', CARTONS: 'CTN',
  SQFT: 'SQF', SFT: 'SQF', SQMT: 'SQM', SQMTR: 'SQM', SQYD: 'SQY',
  TAB: 'TBS', TABLET: 'TBS', TABLETS: 'TBS', TUBE: 'TUB', DRUM: 'DRM', CANS: 'CAN',
  BUNDLE: 'BDL', BUNDLES: 'BDL', QUINTAL: 'QTL', NOTAPPLICABLE: 'NA', NIL: 'NA',
};

export const DOC_NATURES = [
  'Invoices for outward supply',
  'Invoices for inward supply from unregistered person',
  'Revised Invoice',
  'Debit Note',
  'Credit Note',
  'Receipt voucher',
  'Payment Voucher',
  'Refund voucher',
  'Delivery Challan for job work',
  'Delivery Challan for supply on approval',
  'Delivery Challan in case of liquid gas',
  'Delivery Challan in cases other than by way of supply (excluding at S no. 9 to 11)',
];

export const B2B_INVOICE_TYPES = [
  'Regular B2B',
  'SEZ supplies with payment',
  'SEZ supplies without payment',
  'Deemed Exp',
  'Intra-State supplies attracting IGST',
];

export const EXEMP_DESCRIPTIONS = [
  'Inter-State supplies to registered persons',
  'Intra-State supplies to registered persons',
  'Inter-State supplies to unregistered persons',
  'Intra-State supplies to unregistered persons',
];
