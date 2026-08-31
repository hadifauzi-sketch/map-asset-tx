// Receives transformer + oil test payloads posted by the LIMS Chrome extension
// (see extension/src/shared/canonical.js for the sending side).
//
// The key whitelists below are deliberately duplicated rather than imported from
// the extension folder: a postMessage payload is untrusted input, so the app
// validates it independently and the app build stays independent of extension/.

import { normalizeIdentifier, normalizeLookupText } from './transformerMnemonicAssist';

const BRIDGE_MESSAGE = '__limsBridge';
const SUPPORTED_VERSIONS = [1];

// Mirrors extension/src/shared/canonical.js.
export const INTENT_ASSET = 'asset';
export const INTENT_RESULT = 'result';
const INTENTS = [INTENT_ASSET, INTENT_RESULT];

const TRANSFORMER_KEYS = new Set([
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
]);

const OIL_TEST_TEXT_KEYS = new Set([
  'testDate',
  'testType',
  'oilType',
  'appearance',
  'color',
  'copperCorrosive',
  'waterContentBasis',
  'notes',
]);

const OIL_TEST_NUMERIC_KEYS = new Set([
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
  'fol2',
  'hmf5',
  'fal2',
  'acf2',
  'mef5',
  'copperCu',
  'ironFe',
  'aluminumAl',
  'estimatedDpFuran',
  'estimatedDpMethanol',
]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TESTS_PER_PAYLOAD = 200;

function sanitiseOilTest(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const testDate = typeof raw.testDate === 'string' ? raw.testDate.trim() : '';
  if (!ISO_DATE_PATTERN.test(testDate)) {
    return null;
  }

  const clean = { testDate };

  Object.entries(raw).forEach(([key, value]) => {
    if (key === 'testDate') {
      return;
    }

    if (OIL_TEST_TEXT_KEYS.has(key)) {
      const text = String(value ?? '').trim();
      if (text) {
        clean[key] = text;
      }
      return;
    }

    if (OIL_TEST_NUMERIC_KEYS.has(key)) {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(numeric)) {
        clean[key] = numeric;
      }
    }
  });

  return clean;
}

function sanitiseTransformer(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const clean = {};

  Object.entries(raw).forEach(([key, value]) => {
    if (!TRANSFORMER_KEYS.has(key)) {
      return;
    }

    if (key === 'loadMVA' || key === 'yearBuilt') {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(numeric)) {
        clean[key] = numeric;
      }
      return;
    }

    const text = String(value ?? '').trim();
    if (text) {
      clean[key] = text;
    }
  });

  if (Array.isArray(raw.position) && raw.position.length === 2) {
    const [lat, lng] = raw.position.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      clean.position = [lat, lng];
    }
  }

  return clean;
}

/**
 * Validate an inbound bridge payload. Returns a normalised
 * `{ transformer, oilTestPayloads, recordId, sourceUrl, capturedAt }`
 * or null if the message is not a well-formed LIMS payload.
 */
export function parseBridgePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (!SUPPORTED_VERSIONS.includes(payload.version)) {
    return null;
  }

  const transformer = sanitiseTransformer(payload.transformer);
  if (!transformer || (!transformer.serialNumber && !transformer.txName)) {
    return null;
  }

  const intent = INTENTS.includes(payload.intent) ? payload.intent : INTENT_ASSET;

  const oilTestPayloads = (Array.isArray(payload.oilTestPayloads) ? payload.oilTestPayloads : [])
    .slice(0, MAX_TESTS_PER_PAYLOAD)
    .map(sanitiseOilTest)
    .filter(Boolean);

  // A result import with nothing to file is meaningless; an asset import is
  // still valid without readings, since it only carries identity fields.
  if (intent === INTENT_RESULT && !oilTestPayloads.length) {
    return null;
  }

  return {
    intent,
    transformer,
    oilTestPayloads,
    recordId: typeof payload.recordId === 'string' ? payload.recordId : null,
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : null,
    capturedAt: typeof payload.capturedAt === 'string' ? payload.capturedAt : null,
    // Raw site address from the LIMS; the app resolves it to a state itself
    // rather than trusting the extension to know Malaysian geography.
    address: typeof payload.address === 'string' ? payload.address.slice(0, 500).trim() : null,
  };
}

/**
 * Decide which existing asset a LIMS record belongs to.
 *
 * Returns `{ match, reason }`, with a null match when nothing is safe enough.
 * Order matters: the serial number is the only globally unique identifier, so it
 * is resolved across the whole register before anything weaker is considered.
 * Testing both rules per-asset in a single pass would let a name collision on an
 * early asset beat an exact serial match on a later one.
 */
export function matchLimsRecordToAsset(incomingTransformer, transformers) {
  const register = Array.isArray(transformers) ? transformers : [];
  const incomingSerial = normalizeIdentifier(incomingTransformer?.serialNumber);
  const incomingName = normalizeLookupText(incomingTransformer?.txName);
  const incomingSite = normalizeLookupText(incomingTransformer?.siteName);

  const serialMatch = incomingSerial
    ? register.find(
        (transformer) => normalizeIdentifier(transformer.serialNumber) === incomingSerial
      )
    : null;

  if (serialMatch) {
    return { match: serialMatch, reason: 'serial number' };
  }

  // Names like "T1" repeat across sites, so a name only counts when the site
  // agrees too. Matching on name alone would attach a Kedah cement sample to
  // whichever unrelated "T1" happened to load first.
  if (!incomingName || !incomingSite) {
    return { match: null, reason: null };
  }

  const siteAndNameMatch = register.find((transformer) => {
    if (
      normalizeLookupText(transformer.txName) !== incomingName ||
      normalizeLookupText(transformer.siteName) !== incomingSite
    ) {
      return false;
    }

    // Same site and name but a different serial on record means these are two
    // different assets, not one — never silently merge them.
    const candidateSerial = normalizeIdentifier(transformer.serialNumber);
    return !candidateSerial || !incomingSerial || candidateSerial === incomingSerial;
  });

  return siteAndNameMatch
    ? { match: siteAndNameMatch, reason: 'site and name' }
    : { match: null, reason: null };
}

/**
 * Listen for LIMS payloads. Returns an unsubscribe function.
 *
 * The handler receives a parsed payload only; malformed or foreign messages are
 * ignored silently, since any page script can post to window.
 */
export function subscribeToLimsBridge(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return () => {};
  }

  const onMessage = (event) => {
    // Only accept messages this window posted to itself (the extension relays
    // through an isolated-world script running on this exact origin).
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || data[BRIDGE_MESSAGE] !== true) {
      return;
    }

    const parsed = parseBridgePayload(data.payload);
    if (!parsed) {
      console.warn('[limsBridge] Ignored a malformed LIMS payload.');
      return;
    }

    handler(parsed);
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
