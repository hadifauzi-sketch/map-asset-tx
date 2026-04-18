export const IMPORTABLE_GAS_FIELDS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2", "o2", "n2"];
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

export function formatImportedValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Number(value.toFixed(6));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function buildSingleSampleImportCandidate(values, details = {}) {
  const matchedFields = IMPORTABLE_GAS_FIELDS.filter((field) => values[field] != null);

  if (matchedFields.length < MINIMUM_IMPORTED_FIELDS) {
    return null;
  }

  const samplePatch = {};
  matchedFields.forEach((field) => {
    samplePatch[field] = formatImportedValue(values[field]);
  });

  return {
    ...details,
    matchedFields,
    missingFields: IMPORTABLE_GAS_FIELDS.filter((field) => !matchedFields.includes(field)),
    samplePatch,
  };
}
