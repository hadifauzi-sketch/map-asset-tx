import {
  IMPORTABLE_GAS_FIELDS,
  buildSingleSampleImportCandidate,
  getImportFieldKeyFromLabel,
  parseImportedFieldValue,
} from "./dgaImportShared.js";

// ELIMS exports without readable headers are assumed to place the nine gas results
// across P14:X14 in the same order used by the app table.
const ELIMS_FALLBACK_RANGE = {
  headerRow: 13,
  valueRow: 14,
  startColumn: "P",
  endColumn: "X",
  order: IMPORTABLE_GAS_FIELDS,
};

function scoreCandidate(candidate) {
  const strategyBoost = candidate.strategy === "headers" ? 1 : 0;
  return candidate.matchedFields.length * 10 + strategyBoost;
}

function extractHeaderCandidate(rows, sheetName) {
  let bestCandidate = null;

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const headerRow = rows[rowIndex] ?? [];
    const valueRow = rows[rowIndex + 1] ?? [];
    const columnsByField = new Map();

    headerRow.forEach((cellValue, columnIndex) => {
      const fieldKey = getImportFieldKeyFromLabel(cellValue);

      if (fieldKey && !columnsByField.has(fieldKey)) {
        columnsByField.set(fieldKey, columnIndex);
      }
    });

    const values = {};
    columnsByField.forEach((columnIndex, fieldKey) => {
      const parsedValue = parseImportedFieldValue(fieldKey, valueRow[columnIndex]);

      if (parsedValue != null) {
        values[fieldKey] = parsedValue;
      }
    });

    const candidate = buildSingleSampleImportCandidate(values, {
      sheetName,
      strategy: "headers",
      strategyLabel: `gas headers in row ${rowIndex + 1}`,
    });

    if (!candidate) {
      continue;
    }

    if (!bestCandidate || scoreCandidate(candidate) > scoreCandidate(bestCandidate)) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function extractFallbackCandidate(sheet, sheetName, XLSX) {
  const startColumn = XLSX.utils.decode_col(ELIMS_FALLBACK_RANGE.startColumn);
  const endColumn = XLSX.utils.decode_col(ELIMS_FALLBACK_RANGE.endColumn);
  const headerRowIndex = ELIMS_FALLBACK_RANGE.headerRow - 1;
  const valueRowIndex = ELIMS_FALLBACK_RANGE.valueRow - 1;
  const values = {};

  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    const offset = columnIndex - startColumn;
    const fallbackGasKey = ELIMS_FALLBACK_RANGE.order[offset] ?? null;
    const headerAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex });
    const valueAddress = XLSX.utils.encode_cell({ r: valueRowIndex, c: columnIndex });
    const headerValue = sheet[headerAddress]?.w ?? sheet[headerAddress]?.v ?? null;
    const detectedGasKey = getGasKeyFromLabel(headerValue);
    const gasKey = detectedGasKey ?? fallbackGasKey;
    const numericValue = parseImportedFieldValue(gasKey, sheet[valueAddress]?.w ?? sheet[valueAddress]?.v ?? null);

    if (gasKey && numericValue != null) {
      values[gasKey] = numericValue;
    }
  }

  return buildSingleSampleImportCandidate(values, {
    sheetName,
    strategy: "elims-range",
    strategyLabel: "ELIMS fallback range P14:X14",
  });
}

function pickBestImportCandidate(workbook, XLSX) {
  let bestCandidate = null;

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const headerCandidate = extractHeaderCandidate(rows, sheetName);
    const fallbackCandidate = extractFallbackCandidate(sheet, sheetName, XLSX);

    [headerCandidate, fallbackCandidate].forEach((candidate) => {
      if (!candidate) {
        return;
      }

      if (!bestCandidate || scoreCandidate(candidate) > scoreCandidate(bestCandidate)) {
        bestCandidate = candidate;
      }
    });
  });

  return bestCandidate;
}

export async function extractDgaImportFromFile(file) {
  if (!file) {
    throw new Error("Choose an Excel report before importing.");
  }

  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);

  if (!workbook.SheetNames.length) {
    throw new Error("This workbook does not contain any readable sheets.");
  }

  const candidate = pickBestImportCandidate(workbook, XLSX);

  if (!candidate) {
    throw new Error(
      "No DGA gas values were found. The importer first looks for gas headers anywhere in the workbook, then falls back to ELIMS cells P14:X14.",
    );
  }

  return {
    kind: "single-sample",
    fileType: "excel",
    ...candidate,
    fileName: file.name,
  };
}
