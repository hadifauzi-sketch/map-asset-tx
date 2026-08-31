// Label/key aliases for LIMS responses.
//
// Mirrors the alias tables in lib/dga-import/dgaImportShared.js so a value the
// PDF importer already understands is understood here too. Add LIMS-specific
// spellings to the arrays below rather than editing the adapter.

export const OIL_TEST_ALIASES = {
  // Physical & chemical
  breakdown: ['breakdown', 'breakdown voltage', 'bdv', 'dielectric strength', 'dielectric breakdown'],
  acidity: ['acidity', 'acid number', 'neutralization value', 'neutralisation value', 'tan'],
  waterContent: ['water content', 'moisture', 'moisture content', 'water'],
  waterContentTemperature: ['water content temperature', 'oil temperature', 'sample temperature'],
  interfacialTension: ['interfacial tension', 'ift'],
  appearance: ['appearance', 'visual examination', 'visual'],
  color: ['color', 'colour'],
  flashPoint: ['flash point', 'flashpoint'],
  inhibitor: ['inhibitor', 'oxidation inhibitor', 'dbpc', 'antioxidant'],
  copperCorrosive: ['copper corrosive', 'corrosive sulphur', 'corrosive sulfur'],
  density: ['density'],
  dbds: ['dbds', 'dibenzyl disulphide', 'dibenzyl disulfide'],
  viscosity40: ['viscosity', 'viscosity 40', 'viscosity at 40', 'kinematic viscosity'],
  methanol: ['methanol', 'meoh'],
  ethanol: ['ethanol', 'etoh'],
  pcb: ['pcb', 'polychlorinated biphenyl'],
  powerFactor: ['power factor', 'dissipation factor', 'tan delta', 'dielectric dissipation factor'],
  resistivity: ['resistivity', 'volume resistivity', 'specific resistance'],
  specificGravity: ['specific gravity', 'relative density'],
  passivator: ['passivator', 'irgamet', 'benzotriazole'],

  // Dissolved gases
  h2: ['h2', 'hydrogen'],
  ch4: ['ch4', 'methane'],
  c2h2: ['c2h2', 'acetylene'],
  c2h4: ['c2h4', 'ethylene'],
  c2h6: ['c2h6', 'ethane'],
  co: ['co', 'carbon monoxide'],
  co2: ['co2', 'carbon dioxide'],
  o2: ['o2', 'oxygen'],
  n2: ['n2', 'nitrogen'],
  tdcg: [
    'tdcg',
    'total dissolved combustible gas',
    'total dissolved combustible gases',
    'total combustible gas',
  ],

  // Furanic compounds
  fol2: ['2fol', '2-fol', 'furfuryl alcohol', '2-furfuryl alcohol'],
  hmf5: ['5hmf', '5-hmf', 'hydroxymethyl furfural', '5-hydroxymethyl-2-furfural'],
  fal2: ['2fal', '2-fal', 'furfural', '2-furfuraldehyde'],
  acf2: ['2acf', '2-acf', 'acetyl furan', '2-acetylfuran'],
  mef5: ['5mef', '5-mef', 'methyl furfural', '5-methyl-2-furfural'],

  // Metals-in-oil
  copperCu: ['copper', 'cu', 'copper cu'],
  ironFe: ['iron', 'fe', 'iron fe'],
  aluminumAl: ['aluminium', 'aluminum', 'al'],

  // Estimated DP
  estimatedDpFuran: ['estimated dp furan', 'dp furan', 'degree of polymerisation furan'],
  estimatedDpMethanol: ['estimated dp methanol', 'dp methanol'],

  // Sample metadata
  testDate: ['test date', 'sample date', 'sampling date', 'date sampled', 'date of sampling'],
  testType: ['test type', 'analysis type', 'test', 'test name'],
  oilType: ['oil type', 'fluid type', 'insulating fluid'],
  notes: ['notes', 'remarks', 'comment', 'comments', 'observation'],
};

export const TRANSFORMER_ALIASES = {
  serialNumber: ['serial number', 'serial no', 'serial', 'sn', 'equipment serial'],
  txName: [
    'transformer name',
    'transformer',
    'equipment name',
    'equipment id',
    'asset name',
    'tag',
    // ACTMS Transformer Identification block
    'tx no',
    'tx name',
    'transformer no',
  ],
  siteName: ['site', 'site name', 'substation', 'location', 'plant', 'station'],
  mnemonic: ['mnemonic', 'short code', 'code'],
  maker: ['maker', 'manufacturer', 'make', 'brand'],
  voltage: ['voltage', 'voltages', 'rated voltage', 'voltage rating', 'kv'],
  loadMVA: ['mva', 'rating', 'rated power', 'capacity', 'load mva'],
  yearBuilt: ['year built', 'year of manufacture', 'manufactured', 'yom', 'commissioned'],
  ownerType: ['owner', 'owner type', 'ownership'],
  state: ['state', 'region', 'province'],
  oilType: ['oil type', 'fluid type'],
  paperType: ['paper type', 'insulation paper', 'paper insulation'],
};

const SUBSCRIPT_DIGITS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

function stripSubscripts(label) {
  return String(label ?? '').replace(/[₀-₉]/g, (char) => SUBSCRIPT_DIGITS[char] || char);
}

/**
 * Reduce a LIMS label or JSON key to a comparable form:
 * "C₂H₂ (ppm)" -> "c2h2", "Water_Content" -> "water content".
 */
export function normaliseLabel(label) {
  return stripSubscripts(label)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * ACTMS result rows carry the analyte, its formula, and its unit in one cell:
 *   "Hydrogen (H₂), ppm v/v"
 *   "Water Content (H₂O),mg/kg (ppm)"
 *   "Neutralization Value (NV), mgKOH/g"
 * Naive normalising leaves "hydrogen ppm v v", which matches nothing, so try a
 * few readings of the same label and take the first that resolves.
 */
function labelCandidates(label) {
  const raw = stripSubscripts(label);
  const beforeComma = raw.split(',')[0];
  const parenthesised = [...raw.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]);

  return [
    normaliseLabel(beforeComma), // "Hydrogen (H2), ppm v/v" -> "hydrogen"
    ...parenthesised.map(normaliseLabel), // -> "h2"
    normaliseLabel(raw), // full label, for anything without units
  ].filter(Boolean);
}

function buildLookup(aliasTable) {
  const lookup = new Map();

  Object.entries(aliasTable).forEach(([canonicalKey, aliases]) => {
    lookup.set(normaliseLabel(canonicalKey), canonicalKey);
    aliases.forEach((alias) => {
      lookup.set(normaliseLabel(alias), canonicalKey);
    });
  });

  return lookup;
}

const OIL_TEST_LOOKUP = buildLookup(OIL_TEST_ALIASES);
const TRANSFORMER_LOOKUP = buildLookup(TRANSFORMER_ALIASES);

function resolveWith(lookup, label) {
  const candidates = labelCandidates(label);

  for (const candidate of candidates) {
    const key = lookup.get(candidate);
    if (key) {
      return key;
    }
  }

  return null;
}

export function resolveOilTestKey(label) {
  return resolveWith(OIL_TEST_LOOKUP, label);
}

export function resolveTransformerKey(label) {
  return resolveWith(TRANSFORMER_LOOKUP, label);
}

/**
 * Fold an arbitrary `{ label: value }` bag from the LIMS into canonical keys.
 * Unrecognised labels are returned under `unmapped` so the popup can show you
 * exactly which LIMS fields still need an alias.
 */
export function mapByAlias(source, resolver) {
  const mapped = {};
  const unmapped = {};

  Object.entries(source || {}).forEach(([label, value]) => {
    const key = resolver(label);
    if (key) {
      mapped[key] = value;
    } else {
      unmapped[label] = value;
    }
  });

  return { mapped, unmapped };
}
