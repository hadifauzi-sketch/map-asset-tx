const PDF_TABLE_TITLE = "dissolved gas analysis";
const LEGACY_PDF_ROW_FIELDS = ["h2", "o2", "n2", "ch4", "co", "co2", "c2h4", "c2h6", "c2h2", null];
const REPORT_PDF_ROW_FIELDS = ["h2", "ch4", "c2h6", "c2h4", "c2h2", "co", "co2", "o2", "n2", "transformerAge"];
const MINIMUM_IMPORTED_FIELDS = 5;
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

function toIsoDateFromPdf(token) {
  const rawText = String(token ?? "").trim();
  const slashMatch = rawText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const dashMatch = rawText.match(/^(\d{2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);

  if (!dashMatch) {
    return null;
  }

  const [, day, monthLabel, rawYear] = dashMatch;
  const month = PDF_MONTH_LOOKUP[monthLabel.toLowerCase()];

  if (!month) {
    return null;
  }

  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day}`;
}

function isPdfDateToken(token) {
  return toIsoDateFromPdf(token) != null;
}

function isPdfSectionTerminator(token) {
  return PDF_SECTION_TERMINATORS.has(normalisePdfToken(token));
}

function findPdfTableStartIndex(tokens) {
  const matches = tokens.reduce((indexes, token, index) => {
    if (normalisePdfToken(token).includes(PDF_TABLE_TITLE)) {
      indexes.push(index);
    }

    return indexes;
  }, []);

  if (!matches.length) {
    return -1;
  }

  return (
    matches.find((index) => {
      const nearbyTokens = tokens.slice(index, index + 30).map(normalisePdfToken);
      return nearbyTokens.includes("fault zone") && nearbyTokens.includes("ch4");
    }) ?? matches[matches.length - 1]
  );
}

function detectRowFieldOrder(tokens, sectionStartIndex) {
  const nearbyTokens = tokens.slice(sectionStartIndex, sectionStartIndex + 30).map(normalisePdfToken);
  const matchesGeneratedHeader = REPORT_TABLE_HEADER_MARKERS.every((marker) => nearbyTokens.includes(marker));

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

  while (index < tokens.length) {
    const token = tokens[index];

    if (isPdfSectionTerminator(token)) {
      break;
    }

    if (!isPdfDateToken(token)) {
      index += 1;
      continue;
    }

    const rawValues = [];
    let cursor = index + 1;

    while (cursor < tokens.length && rawValues.length < expectedValueCount) {
      const candidate = tokens[cursor];

      if (isPdfDateToken(candidate) || isPdfSectionTerminator(candidate)) {
        break;
      }

      if (parseNumericValue(candidate) != null) {
        rawValues.push(candidate);
      }

      cursor += 1;
    }

    if (rawValues.length < expectedValueCount) {
      throw new Error(`The PDF row for ${token} is incomplete and could not be imported.`);
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

export async function extractDgaImportFromPdfFile(file) {
  if (!file) {
    throw new Error("Choose a PDF report before importing.");
  }

  const tokens = await extractPdfTokens(file);
  const samples = extractHistoryRowsFromTokens(tokens);

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
