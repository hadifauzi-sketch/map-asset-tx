export const IMPORTABLE_GAS_FIELDS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2", "o2", "n2"];
export const IMPORTABLE_ADDITIONAL_FIELDS = [
  "breakdown",
  "waterContent",
  "acidity",
  "interfacialTension",
  "appearance",
  "color",
  "flashPoint",
  "inhibitor",
  "copperCorrosive",
  "density",
  "dbds",
  "viscosity40",
  "methanol",
  "pcb",
  "powerFactor",
  "resistivity",
  "specificGravity",
  "passivator",
  "fol2",
  "hmf5",
  "fal2",
  "acf2",
  "mef5",
  "copperCu",
  "ironFe",
  "aluminumAl",
  "estimatedDpFuran",
  "estimatedDpMethanol",
];
export const IMPORTABLE_LAB_FIELDS = [...IMPORTABLE_GAS_FIELDS, ...IMPORTABLE_ADDITIONAL_FIELDS];
export const IMPORTABLE_TEXT_FIELDS = ["appearance", "color", "copperCorrosive"];
export const MINIMUM_IMPORTED_FIELDS = 5;

const GAS_LABEL_ALIASES = {
  h2: ["h2", "hydrogen", "hydrogenh2", "h2hydrogen"],
  ch4: ["ch4", "methane", "methanech4", "ch4methane"],
  c2h6: ["c2h6", "ethane", "ethanec2h6", "c2h6ethane"],
  c2h4: ["c2h4", "ethylene", "ethylenec2h4", "c2h4ethylene"],
  c2h2: ["c2h2", "acetylene", "acetylenec2h2", "c2h2acetylene"],
  co: ["co", "carbonmonoxide", "carbonmonoxideco", "cocarbonmonoxide"],
  co2: ["co2", "carbondioxide", "carbondioxideco2", "co2carbondioxide"],
  o2: ["o2", "oxygen", "oxygeno2", "o2oxygen"],
  n2: ["n2", "nitrogen", "nitrogenn2", "n2nitrogen"],
};

const ADDITIONAL_LABEL_ALIASES = {
  breakdown: ["bdv", "breakdown", "breakdownvoltage", "dielectricbreakdown", "dielectricstrength"],
  waterContent: ["moisture", "water", "watercontent", "moisturecontent", "watercontentppm"],
  acidity: ["acidity", "aciditymgkohg", "acidnumber", "neutralizationnumber", "nn"],
  interfacialTension: ["ift", "iftmnm", "interfacialtension", "interfacialtensionmnm", "interfacial"],
  appearance: ["appearance", "visualappearance", "oilappearance"],
  color: ["color", "colour", "astmcolor", "colorastm", "astm"],
  flashPoint: ["flashpoint", "flashpointc", "flashpointdegc", "flash"],
  inhibitor: ["inhibitor", "inhibitorcontent", "inhibitorpct", "inhibitorpercent"],
  copperCorrosive: ["coppercorrosive", "coppercorrosiveiec", "coppercorrosiveiecc", "coppercorrosivegrade"],
  density: ["density", "densitykgm3"],
  dbds: ["dbds"],
  viscosity40: ["viscosity40", "viscosity40c", "viscosityat40c", "viscosity"],
  methanol: ["methanol", "ch3oh"],
  pcb: ["pcb", "polychlorinatedbiphenyl", "polychlorinatedbiphenyls"],
  powerFactor: ["powerfactor", "tandelta", "tan", "tan90c", "tanδ"],
  resistivity: ["resistivity", "volume resistivity", "volumeresistivity", "resistivitygohmm"],
  specificGravity: ["specificgravity", "specificgrav", "sg"],
  passivator: ["passivator", "passivatorcontent"],
  fol2: ["2fol", "fol2"],
  hmf5: ["5hmf", "hmf5"],
  fal2: ["2fal", "fal2", "furfural", "2furaldehyde"],
  acf2: ["2acf", "acf2"],
  mef5: ["5mef", "mef5"],
  copperCu: ["coppercu", "cu", "copper"],
  ironFe: ["ironfe", "fe", "iron"],
  aluminumAl: ["aluminumal", "aluminiumal", "al", "aluminum", "aluminium"],
  estimatedDpFuran: ["estimateddpfuran", "dpfuran", "dpfromfuran", "dpfromfuran2fal"],
  estimatedDpMethanol: ["estimateddpmethanol", "dpmethanol", "dpfrommethanol"],
};

const SUBSCRIPT_DIGITS = {
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
};

export function replaceSubscriptDigits(value) {
  return String(value ?? "").replace(/[\u2080-\u2089]/g, (digit) => SUBSCRIPT_DIGITS[digit] ?? digit);
}

export function normaliseLabel(value) {
  return replaceSubscriptDigits(value)
    .trim()
    .toLowerCase()
    .replace(/ppm|results?|values?|content|concentration|reading|gas|gases|dga/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

export function getGasKeyFromLabel(value) {
  const normalised = normaliseLabel(value);

  if (!normalised) {
    return null;
  }

  for (const [gasKey, aliases] of Object.entries(GAS_LABEL_ALIASES)) {
    if (aliases.includes(normalised)) {
      return gasKey;
    }
  }

  return null;
}

export function getImportFieldKeyFromLabel(value) {
  const gasKey = getGasKeyFromLabel(value);
  if (gasKey) {
    return gasKey;
  }

  const normalised = normaliseLabel(value);

  if (!normalised) {
    return null;
  }

  for (const [fieldKey, aliases] of Object.entries(ADDITIONAL_LABEL_ALIASES)) {
    if (aliases.includes(normalised)) {
      return fieldKey;
    }
  }

  return null;
}

export function parseNumericValue(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const rawText = String(value).trim();
  const upperText = rawText.toUpperCase();
  const compactAlphaNumericText = upperText.replace(/[^A-Z0-9]/g, "");

  if (upperText === "0" || compactAlphaNumericText === "NIL" || compactAlphaNumericText === "0") {
    return 0;
  }

  const normalised = rawText.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);

  if (!normalised) {
    return null;
  }

  const numeric = Number(normalised[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseTextValue(value) {
  const rawText = String(value ?? "").trim();
  const compactText = rawText.toLowerCase().replace(/\s+/g, "");

  if (!rawText || compactText === "-" || compactText === "--" || compactText === "nil" || compactText === "na" || compactText === "n/a") {
    return null;
  }

  return rawText;
}

export function parseImportedFieldValue(fieldKey, value) {
  if (IMPORTABLE_TEXT_FIELDS.includes(fieldKey)) {
    return parseTextValue(value);
  }

  return parseNumericValue(value);
}

export function formatImportedValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Number(value.toFixed(6));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatImportedFieldValue(fieldKey, value) {
  if (IMPORTABLE_TEXT_FIELDS.includes(fieldKey)) {
    return String(value ?? "").trim();
  }

  return formatImportedValue(value);
}

export function buildSingleSampleImportCandidate(values, details = {}) {
  const matchedFields = IMPORTABLE_GAS_FIELDS.filter((field) => values[field] != null);
  const matchedAdditionalFields = IMPORTABLE_ADDITIONAL_FIELDS.filter((field) => values[field] != null);

  if (matchedFields.length < MINIMUM_IMPORTED_FIELDS && matchedAdditionalFields.length === 0) {
    return null;
  }

  const samplePatch = {};
  [...matchedFields, ...matchedAdditionalFields].forEach((field) => {
    samplePatch[field] = formatImportedFieldValue(field, values[field]);
  });

  return {
    ...details,
    matchedFields,
    matchedAdditionalFields,
    missingFields: IMPORTABLE_GAS_FIELDS.filter((field) => !matchedFields.includes(field)),
    samplePatch,
  };
}
