const PDF_TABLE_TITLE = "dissolved gas analysis";
const LEGACY_PDF_ROW_FIELDS = ["h2", "o2", "n2", "ch4", "co", "co2", "c2h4", "c2h6", "c2h2", null];
const REPORT_PDF_ROW_FIELDS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2", "o2", "n2", "transformerAge"];
const MINIMUM_IMPORTED_FIELDS = 5;
const FURAN_TABLE_SECTION_TITLES = [
  "furan compound",
  "furan compounds",
  "furanic compound",
  "furanic compounds",
];
const FURAN_TABLE_EXPECTED_COLUMN_COUNT = 8;
const FURAN_TABLE_COLUMN_TO_KEY = [
  { index: 0, key: "fol2" },
  { index: 1, key: "hmf5" },
  { index: 2, key: "fal2" },
  { index: 3, key: "acf2" },
  { index: 4, key: "mef5" },
  { index: 6, key: "estimatedDpFuran" },
];
const ADDITIONAL_PDF_SECTIONS = [
  { titles: ["dielectric breakdown", "breakdown voltage"], key: "breakdown", valueType: "numeric" },
  { titles: ["moisture content", "water content"], key: "waterContent", valueType: "numeric" },
  { titles: ["acidity", "neutralization number", "neutralization value", "neutralisation number", "neutralisation value", "acid number"], key: "acidity", valueType: "numeric" },
  { titles: ["interfacial tension", "ift"], key: "interfacialTension", valueType: "numeric" },
  { titles: ["appearance"], key: "appearance", valueType: "text" },
  { titles: ["color", "colour"], key: "color", valueType: "text" },
  { titles: ["flash point"], key: "flashPoint", valueType: "numeric" },
  { titles: ["inhibitor"], key: "inhibitor", valueType: "numeric" },
  { titles: ["copper corrosive iec", "copper corrosive"], key: "copperCorrosive", valueType: "text" },
  { titles: ["density"], key: "density", valueType: "numeric" },
  { titles: ["dbds"], key: "dbds", valueType: "numeric" },
  { titles: ["viscosity @40c", "viscosity @40°c", "viscosity 40c"], key: "viscosity40", valueType: "numeric" },
  { titles: ["methanol"], key: "methanol", valueType: "numeric" },
  { titles: ["pcb"], key: "pcb", valueType: "numeric" },
  { titles: ["power factor"], key: "powerFactor", valueType: "numeric" },
  { titles: ["resistivity"], key: "resistivity", valueType: "numeric" },
  { titles: ["specific gravity"], key: "specificGravity", valueType: "numeric" },
  { titles: ["passivator"], key: "passivator", valueType: "numeric" },
  { titles: ["2-fol", "fol"], key: "fol2", valueType: "numeric" },
  { titles: ["5-hmf", "hmf"], key: "hmf5", valueType: "numeric" },
  { titles: ["2-fal", "fal", "furfural"], key: "fal2", valueType: "numeric" },
  { titles: ["2-acf", "acf"], key: "acf2", valueType: "numeric" },
  { titles: ["5-mef", "mef"], key: "mef5", valueType: "numeric" },
  { titles: ["copper - cu", "copper (cu)", "copper cu"], key: "copperCu", valueType: "numeric" },
  { titles: ["iron - fe", "iron (fe)", "iron fe"], key: "ironFe", valueType: "numeric" },
  { titles: ["aluminum - al", "aluminium - al", "aluminum (al)", "aluminium (al)", "aluminum al"], key: "aluminumAl", valueType: "numeric" },
  { titles: ["dp from furan", "estimated dp furan"], key: "estimatedDpFuran", valueType: "numeric" },
  { titles: ["dp from methanol", "estimated dp methanol"], key: "estimatedDpMethanol", valueType: "numeric" },
];
const PDF_SECTION_TERMINATORS = new Set([
  "flag",
  "reference",
  "moisture content",
  "dielectric breakdown",
  "duval diagnostics",
  "active diagrams",
  "dga trending",
  "percent trending table",
]);
const PDF_SECTION_HEADERS = new Set([
  PDF_TABLE_TITLE,
  ...PDF_SECTION_TERMINATORS,
  ...ADDITIONAL_PDF_SECTIONS.flatMap((section) => section.titles),
  ...FURAN_TABLE_SECTION_TITLES,
  "furanic compound",
  "furanic compounds",
  "metals in oil",
  "metals-in-oil",
  "estimate dp",
  "additional notes",
]);
const PDF_MONTH_LOOKUP = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};
const REPORT_TABLE_HEADER_MARKERS = ["id", "date", "h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2", "o2", "n2", "age", "fault zone"];

function parseNumericValue(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const rawText = String(value).trim();
  const upperText = rawText.toUpperCase();

  if (upperText === "NIL" || upperText === "0") {
    return 0;
  }

  const normalised = rawText.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);

  if (!normalised) {
    return null;
  }

  const numeric = Number(normalised[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatImportedValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Number(value.toFixed(6));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function normalisePdfToken(token) {
  return String(token ?? "").trim().toLowerCase();
}

function normalisePdfMatchText(value) {
  return normalisePdfToken(value).replace(/\s+/g, " ").trim();
}

function getPdfTokenWindowText(tokens, startIndex, span) {
  return tokens
    .slice(startIndex, startIndex + span)
    .map((token) => normalisePdfToken(token))
    .filter(Boolean)
    .join(" ");
}

function hasSectionTitleMatchAt(tokens, index, titles, maxSpan = 4) {
  for (let span = 1; span <= maxSpan; span += 1) {
    const windowText = getPdfTokenWindowText(tokens, index, span);

    if (!windowText) {
      continue;
    }

    if (
      titles.some((title) => {
        const normalisedTitle = normalisePdfMatchText(title);
        return normalisedTitle && windowText.startsWith(normalisedTitle);
      })
    ) {
      return true;
    }
  }

  return false;
}

function toIsoDateFromPdf(token) {
  const rawText = String(token ?? "").trim().replace(/[.,;:]$/, "");
  const slashMatch = rawText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dashMatch = rawText.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);

  if (!dashMatch) {
    return null;
  }

  const [, day, monthLabel, rawYear] = dashMatch;
  const month = PDF_MONTH_LOOKUP[monthLabel.toLowerCase()];

  if (!month) {
    return null;
  }

  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function isPdfDateToken(token) {
  return toIsoDateFromPdf(token) != null;
}

function isPdfSectionTerminator(token) {
  return PDF_SECTION_TERMINATORS.has(normalisePdfMatchText(token));
}

function isPdfSectionHeader(token) {
  const normalisedToken = normalisePdfMatchText(token);

  if (!normalisedToken) {
    return false;
  }

  return Array.from(PDF_SECTION_HEADERS).some(
    (header) => normalisedToken === normalisePdfMatchText(header) || normalisedToken.includes(normalisePdfMatchText(header))
  );
}

function isPdfSectionHeaderAt(tokens, index) {
  return hasSectionTitleMatchAt(tokens, index, Array.from(PDF_SECTION_HEADERS));
}

function findPdfTableStartIndex(tokens) {
  const matches = tokens.reduce((indexes, token, index) => {
    if (hasSectionTitleMatchAt(tokens, index, [PDF_TABLE_TITLE])) {
      indexes.push(index);
    }

    return indexes;
  }, []);

  if (!matches.length) {
    return -1;
  }

  return (
    matches.find((index) => {
      const nearbyText = tokens.slice(index, index + 40).map((token) => normalisePdfToken(token)).join(" ");
      return nearbyText.includes("fault zone") && nearbyText.includes("ch4");
    }) ?? matches[matches.length - 1]
  );
}

function detectRowFieldOrder(tokens, sectionStartIndex) {
  const nearbyText = tokens.slice(sectionStartIndex, sectionStartIndex + 40).map((token) => normalisePdfToken(token)).join(" ");
  const matchesGeneratedHeader = REPORT_TABLE_HEADER_MARKERS.every((marker) => nearbyText.includes(marker));

  return matchesGeneratedHeader ? REPORT_PDF_ROW_FIELDS : LEGACY_PDF_ROW_FIELDS;
}

async function extractPdfTokens(file) {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
  ]);

  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const tokens = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    textContent.items.forEach((item) => {
      const text = String(item.str ?? "").trim();

      if (text) {
        tokens.push(text);
      }
    });
  }

  return tokens;
}

function extractHistoryRowsFromTokens(tokens) {
  const sectionStartIndex = findPdfTableStartIndex(tokens);

  if (sectionStartIndex === -1) {
    throw new Error("The PDF does not contain a readable 'Dissolved Gas Analysis' section.");
  }

  const rowFieldOrder = detectRowFieldOrder(tokens, sectionStartIndex);
  const expectedValueCount = rowFieldOrder.length;
  const rows = [];
  let index = sectionStartIndex + 1;
  let hasSeenDateRow = false;

  while (index < tokens.length) {
    const token = tokens[index];

    if (
      hasSeenDateRow &&
      index > sectionStartIndex + 1 &&
      isPdfSectionHeaderAt(tokens, index) &&
      !hasSectionTitleMatchAt(tokens, index, [PDF_TABLE_TITLE])
    ) {
      break;
    }

    if (!isPdfDateToken(token)) {
      index += 1;
      continue;
    }

    hasSeenDateRow = true;

    const rawValues = [];
    let cursor = index + 1;

    while (cursor < tokens.length && rawValues.length < expectedValueCount) {
      const candidate = tokens[cursor];

      if (isPdfDateToken(candidate) || (isPdfSectionHeaderAt(tokens, cursor) && !hasSectionTitleMatchAt(tokens, cursor, [PDF_TABLE_TITLE]))) {
        break;
      }

      if (parseNumericValue(candidate) != null) {
        rawValues.push(candidate);
      }

      cursor += 1;
    }

    // Some reports omit trailing values (for example transformer age) or have sparse cells.
    // Do not fail the entire import for one incomplete row; keep parsing what is available.
    if (rawValues.length === 0) {
      index = Math.max(cursor, index + 1);
      continue;
    }

    const samplePatch = {
      date: toIsoDateFromPdf(token),
    };

    rowFieldOrder.forEach((fieldKey, fieldIndex) => {
      if (!fieldKey) {
        return;
      }

      const numericValue = parseNumericValue(rawValues[fieldIndex]);

      if (numericValue != null) {
        samplePatch[fieldKey] = formatImportedValue(numericValue);
      }
    });

    const matchedFieldCount = rowFieldOrder.filter((fieldKey) => fieldKey && samplePatch[fieldKey] != null).length;

    if (matchedFieldCount >= MINIMUM_IMPORTED_FIELDS) {
      rows.push(samplePatch);
    }

    index = cursor;
  }

  if (!rows.length) {
    throw new Error("No sampling rows were found in the PDF Dissolved Gas Analysis table.");
  }

  return rows;
}

function findPdfSectionIndex(tokens, sectionTitles) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (hasSectionTitleMatchAt(tokens, index, sectionTitles)) {
      return index;
    }
  }

  return -1;
}

function parseTextMetricValue(value) {
  const rawText = String(value ?? "").trim();
  const normalisedText = normalisePdfToken(rawText).replace(/[^a-z0-9]/g, "");

  if (!rawText || !normalisedText) {
    return null;
  }

  if (normalisedText === "nil" || normalisedText === "na" || normalisedText === "n/a") {
    return null;
  }

  const unitTokens = new Set(["ppm", "ppb", "kv", "mgkg", "mgkohg", "mnm", "degc", "astm", "cst", "gohmm", "kgm3", "percent", "%"]);
  if (unitTokens.has(normalisedText)) {
    return null;
  }

  return rawText;
}

function parseSectionMetricValue(value, valueType) {
  if (valueType === "text") {
    return parseTextMetricValue(value);
  }

  return parseNumericValue(value);
}

function formatSectionMetricValue(value, valueType) {
  if (valueType === "text") {
    return String(value ?? "").trim();
  }

  return formatImportedValue(value);
}

function extractMetricValuesByDate(tokens, sectionConfig) {
  const sectionIndex = findPdfSectionIndex(tokens, sectionConfig.titles);

  if (sectionIndex === -1) {
    return new Map();
  }

  const valuesByDate = new Map();
  let index = sectionIndex + 1;
  let hasSeenDateRow = false;

  while (index < tokens.length) {
    const token = tokens[index];

    if (
      hasSeenDateRow &&
      index > sectionIndex + 1 &&
      isPdfSectionHeaderAt(tokens, index) &&
      !hasSectionTitleMatchAt(tokens, index, sectionConfig.titles)
    ) {
      break;
    }

    if (!isPdfDateToken(token)) {
      index += 1;
      continue;
    }

    const isoDate = toIsoDateFromPdf(token);

    if (!isoDate) {
      index += 1;
      continue;
    }

    hasSeenDateRow = true;

    let cursor = index + 1;
    let detectedValue = null;

    while (cursor < tokens.length) {
      const candidate = tokens[cursor];

      if (isPdfDateToken(candidate) || (isPdfSectionHeaderAt(tokens, cursor) && !hasSectionTitleMatchAt(tokens, cursor, sectionConfig.titles))) {
        break;
      }

      const numericValue = parseSectionMetricValue(candidate, sectionConfig.valueType);

      if (numericValue != null) {
        detectedValue = numericValue;
        break;
      }

      cursor += 1;
    }

    if (detectedValue != null) {
      valuesByDate.set(isoDate, formatSectionMetricValue(detectedValue, sectionConfig.valueType));
    }

    index = Math.max(cursor, index + 1);
  }

  return valuesByDate;
}

function isNoDataMetricToken(value) {
  const compactValue = normalisePdfMatchText(value).replace(/[^a-z0-9]/g, "");
  return compactValue === "nd" || compactValue === "na" || compactValue === "nil" || compactValue === "nondetected";
}

function collectFuranRowValues(tokens, startIndex) {
  const values = [];
  let cursor = startIndex;

  while (cursor < tokens.length && values.length < FURAN_TABLE_EXPECTED_COLUMN_COUNT) {
    const candidate = tokens[cursor];
    const normalisedCandidate = normalisePdfMatchText(candidate);

    if (isPdfDateToken(candidate)) {
      break;
    }

    if (
      values.length > 0 &&
      (normalisedCandidate === "flag" ||
        normalisedCandidate === "reference" ||
        normalisedCandidate.startsWith("method") ||
        normalisedCandidate === "sample result list" ||
        normalisedCandidate.startsWith("http"))
    ) {
      break;
    }

    const numericValue = parseNumericValue(candidate);

    if (numericValue != null) {
      values.push(formatImportedValue(numericValue));
    } else if (isNoDataMetricToken(candidate)) {
      values.push(null);
    }

    cursor += 1;
  }

  return {
    values,
    nextIndex: cursor,
  };
}

function extractFuranTableMetricMaps(tokens) {
  const sectionIndex = findPdfSectionIndex(tokens, FURAN_TABLE_SECTION_TITLES);

  if (sectionIndex === -1) {
    return [];
  }

  const valuesByKey = new Map(
    FURAN_TABLE_COLUMN_TO_KEY.map(({ key }) => [key, new Map()])
  );

  let index = sectionIndex + 1;
  let hasSeenDateRow = false;

  while (index < tokens.length) {
    const token = tokens[index];

    if (
      hasSeenDateRow &&
      index > sectionIndex + 1 &&
      isPdfSectionHeaderAt(tokens, index) &&
      !hasSectionTitleMatchAt(tokens, index, FURAN_TABLE_SECTION_TITLES)
    ) {
      break;
    }

    if (!isPdfDateToken(token)) {
      index += 1;
      continue;
    }

    const isoDate = toIsoDateFromPdf(token);

    if (!isoDate) {
      index += 1;
      continue;
    }

    hasSeenDateRow = true;

    const { values, nextIndex } = collectFuranRowValues(tokens, index + 1);

    FURAN_TABLE_COLUMN_TO_KEY.forEach(({ index: columnIndex, key }) => {
      const value = values[columnIndex];

      if (value != null) {
        valuesByKey.get(key)?.set(isoDate, value);
      }
    });

    index = Math.max(nextIndex, index + 1);
  }

  return Array.from(valuesByKey.entries())
    .map(([key, valuesByDate]) => ({ key, valuesByDate }))
    .filter(({ valuesByDate }) => valuesByDate.size > 0);
}

function collectAdditionalMetricMaps(tokens) {
  const sectionMetricMaps = ADDITIONAL_PDF_SECTIONS.map((sectionConfig) => ({
    key: sectionConfig.key,
    valuesByDate: extractMetricValuesByDate(tokens, sectionConfig),
  })).filter((metricMap) => metricMap.valuesByDate.size > 0);

  const furanTableMetricMaps = extractFuranTableMetricMaps(tokens);

  if (!furanTableMetricMaps.length) {
    return sectionMetricMaps;
  }

  const mergedByKey = new Map();

  sectionMetricMaps.forEach(({ key, valuesByDate }) => {
    mergedByKey.set(key, new Map(valuesByDate));
  });

  furanTableMetricMaps.forEach(({ key, valuesByDate }) => {
    const mergedValues = mergedByKey.get(key) ?? new Map();
    valuesByDate.forEach((value, date) => {
      mergedValues.set(date, value);
    });
    mergedByKey.set(key, mergedValues);
  });

  return Array.from(mergedByKey.entries())
    .map(([key, valuesByDate]) => ({ key, valuesByDate }))
    .filter(({ valuesByDate }) => valuesByDate.size > 0);
}

function mergeAdditionalSectionValues(samples, tokens) {
  if (!samples.length) {
    return samples;
  }

  const metricMaps = collectAdditionalMetricMaps(tokens);

  if (!metricMaps.length) {
    return samples;
  }

  return samples.map((sample) => {
    const sampleDate = sample.date || "";

    if (!sampleDate) {
      return sample;
    }

    const samplePatch = { ...sample };

    metricMaps.forEach(({ key, valuesByDate }) => {
      const value = valuesByDate.get(sampleDate);

      if (value != null) {
        samplePatch[key] = value;
      }
    });

    return samplePatch;
  });
}

function buildSamplesFromAdditionalSections(tokens) {
  const metricMaps = collectAdditionalMetricMaps(tokens);

  if (!metricMaps.length) {
    return [];
  }

  const dateSet = new Set(metricMaps.flatMap((metricMap) => Array.from(metricMap.valuesByDate.keys())));

  return Array.from(dateSet)
    .sort((left, right) => left.localeCompare(right))
    .map((date) => {
      const sample = { date };
      metricMaps.forEach((metricMap) => {
        const value = metricMap.valuesByDate.get(date);
        if (value != null) {
          sample[metricMap.key] = value;
        }
      });
      return sample;
    })
    .filter((sample) => Object.keys(sample).length > 1);
}

export async function extractDgaImportFromPdfFile(file) {
  if (!file) {
    throw new Error("Choose a PDF report before importing.");
  }

  const tokens = await extractPdfTokens(file);
  let dgaSamples = [];
  let dgaReadError = null;

  try {
    dgaSamples = extractHistoryRowsFromTokens(tokens);
  } catch (error) {
    dgaReadError = error;
  }

  const samples = dgaSamples.length
    ? mergeAdditionalSectionValues(dgaSamples, tokens)
    : buildSamplesFromAdditionalSections(tokens);

  if (!samples.length) {
    if (dgaReadError) {
      throw dgaReadError;
    }

    throw new Error("No importable lab values were found in the PDF.");
  }

  return {
    kind: "sample-history",
    fileType: "pdf",
    fileName: file.name,
    sourceLabel: "Dissolved Gas Analysis table",
    strategyLabel: "historical DGA rows in PDF",
    sampleCount: samples.length,
    samples,
  };
}
