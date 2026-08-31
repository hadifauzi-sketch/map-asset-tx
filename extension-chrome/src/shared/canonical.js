// Canonical payload contract shared between the extension and the app.
//
// The shape below is what App.jsx already consumes: `transformer` matches the
// camelCase keys read by buildTransformerPayload() in lib/transformerService.js,
// and each entry of `oilTestPayloads` matches the keys read by
// oilTestService.create() in lib/oilTestService.js.
//
// Keeping this file the single source of truth means the LIMS adapter only ever
// has to produce this shape — nothing downstream needs to know about the LIMS.

export const BRIDGE_MESSAGE = '__limsBridge';
export const BRIDGE_VERSION = 1;

// What the app should do with the payload.
//   asset  — create or update the transformer's identity fields, in the edit
//            form, so nothing is written until the user saves.
//   result — upsert this sample into the matched asset's oil test records,
//            leaving the asset's own details untouched.
export const INTENT_ASSET = 'asset';
export const INTENT_RESULT = 'result';
export const INTENTS = [INTENT_ASSET, INTENT_RESULT];

export const TRANSFORMER_KEYS = [
  'siteName',
  'txName',
  'mnemonic',
  'serialNumber',
  'voltage',
  'loadMVA',
  'maker',
  'yearBuilt',
  'ownerType',
  'state',
  'oilType',
  'gasLimitStandard',
  'methodView',
  'paperType',
];

export const OIL_TEST_TEXT_KEYS = [
  'testDate',
  'testType',
  'oilType',
  'appearance',
  'color',
  'copperCorrosive',
  'waterContentBasis',
  'notes',
];

export const OIL_TEST_NUMERIC_KEYS = [
  // Physical & chemical
  'breakdown',
  'acidity',
  'waterContent',
  'waterContentTemperature',
  'interfacialTension',
  'flashPoint',
  'inhibitor',
  'density',
  'dbds',
  'viscosity40',
  'methanol',
  'ethanol',
  'pcb',
  'powerFactor',
  'resistivity',
  'specificGravity',
  'passivator',
  // DGA
  'h2',
  'ch4',
  'c2h2',
  'c2h4',
  'c2h6',
  'co',
  'co2',
  'o2',
  'n2',
  'tdcg',
  // Furanic compounds
  'fol2',
  'hmf5',
  'fal2',
  'acf2',
  'mef5',
  // Metals-in-oil
  'copperCu',
  'ironFe',
  'aluminumAl',
  // Estimated DP
  'estimatedDpFuran',
  'estimatedDpMethanol',
];

export const OIL_TEST_KEYS = [...OIL_TEST_TEXT_KEYS, ...OIL_TEST_NUMERIC_KEYS];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Lab notations for "below the detection limit", compared after upper-casing and
// stripping punctuation so "N.D." and "Not Detected" fold onto the same token.
// Mirrors BELOW_DETECTION_LIMIT in lib/dga-import/dgaImportShared.js.
const BELOW_DETECTION_LIMIT = new Set(['NIL', 'ND', 'NOTDETECTED', 'NONEDETECTED']);

/**
 * Coerce a LIMS value into a number, tolerating "< 0.5", "1,234", "12 kV",
 * and empty placeholders such as "-" or "N/A".
 *
 * Deliberately mirrors parseNumericValue() in lib/dga-import/dgaImportShared.js.
 * In particular ACTMS prints "NIL" (and some labs "ND" / "Not Detected") for a
 * gas below the detection limit, and the app stores that as 0 rather than as a
 * missing reading — treating it as null here would silently drop the H2 and
 * C2H2 rows that matter most for DGA.
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (compact === '0' || BELOW_DETECTION_LIMIT.has(compact)) {
    return 0;
  }

  // Keep the numeric core of strings like "<0.5", "1,234.5 ppm", "> 70".
  const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Text counterpart of toNumber, matching parseTextValue() in dgaImportShared.js:
 * lab placeholders are treated as "no value" rather than stored literally.
 */
export function toText(value) {
  const text = String(value ?? '').trim();
  const compact = text.toLowerCase().replace(/\s+/g, '');
  const compactAlphaNumeric = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (
    !text ||
    compact === '-' ||
    compact === '--' ||
    compact === 'na' ||
    compact === 'n/a' ||
    BELOW_DETECTION_LIMIT.has(compactAlphaNumeric)
  ) {
    return '';
  }

  return text;
}

/**
 * Normalise a LIMS date into the `YYYY-MM-DD` string the oil_tests table stores.
 * Accepts ISO strings, epoch millis, and common DD/MM/YYYY LIMS formats.
 */
export function toIsoDate(value) {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value.trim())) {
    return value.trim();
  }

  if (typeof value === 'string') {
    // DD/MM/YYYY or DD-MM-YYYY, the usual LIMS report format.
    const dmy = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const [, day, month, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

/**
 * Drop unknown keys and coerce values, so a sloppy adapter can never push an
 * unexpected column at the app. Returns null when the record has no test date,
 * which the app requires to upsert against existing tests.
 */
export function sanitiseOilTest(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const testDate = toIsoDate(raw.testDate);
  if (!testDate) {
    return null;
  }

  const clean = { testDate };

  OIL_TEST_TEXT_KEYS.forEach((key) => {
    if (key === 'testDate') {
      return;
    }
    const text = toText(raw[key]);
    if (text) {
      clean[key] = text;
    }
  });

  OIL_TEST_NUMERIC_KEYS.forEach((key) => {
    const value = toNumber(raw[key]);
    if (value !== null) {
      clean[key] = value;
    }
  });

  return clean;
}

export function sanitiseTransformer(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const clean = {};

  TRANSFORMER_KEYS.forEach((key) => {
    if (key === 'loadMVA' || key === 'yearBuilt') {
      const numeric = toNumber(raw[key]);
      if (numeric !== null) {
        clean[key] = numeric;
      }
      return;
    }

    // toText, not String(): ACTMS prints "-" for fields it has no value for
    // (Region, Winding Temp), which must not be stored as a literal "-".
    const text = toText(raw[key]);
    if (text) {
      clean[key] = text;
    }
  });

  if (Array.isArray(raw.position) && raw.position.length === 2) {
    const lat = toNumber(raw.position[0]);
    const lng = toNumber(raw.position[1]);
    if (lat !== null && lng !== null) {
      clean.position = [lat, lng];
    }
  }

  return clean;
}

/**
 * Build the message the extension posts into the app tab.
 * Throws when the adapter produced nothing usable, so failures surface in the
 * popup rather than as a silent no-op in the app.
 */
export function buildBridgePayload({
  transformer,
  oilTests,
  sourceUrl,
  recordId,
  address,
  intent = INTENT_ASSET,
}) {
  const cleanTransformer = sanitiseTransformer(transformer);
  const cleanTests = (Array.isArray(oilTests) ? oilTests : [])
    .map(sanitiseOilTest)
    .filter(Boolean);

  if (!INTENTS.includes(intent)) {
    throw new Error(`Unknown intent "${intent}".`);
  }

  if (!cleanTransformer?.serialNumber && !cleanTransformer?.txName) {
    throw new Error(
      'LIMS record has neither a serial number nor a transformer name — cannot match it to an asset.'
    );
  }

  // Only the result action needs readings; the asset action is about identity
  // fields and must still work on a page whose results have not been filled in.
  if (intent === INTENT_RESULT && !cleanTests.length) {
    throw new Error('LIMS record contained no dated test results.');
  }

  return {
    version: BRIDGE_VERSION,
    intent,
    capturedAt: new Date().toISOString(),
    recordId: recordId ? String(recordId) : null,
    sourceUrl: sourceUrl || null,
    address: toText(address) || null,
    transformer: cleanTransformer,
    oilTestPayloads: cleanTests,
  };
}
