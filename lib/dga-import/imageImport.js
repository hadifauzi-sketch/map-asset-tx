import {
  formatImportedValue,
  IMPORTABLE_GAS_FIELDS,
  buildSingleSampleImportCandidate,
  getGasKeyFromLabel,
  parseNumericValue,
  replaceSubscriptDigits,
} from "./dgaImportShared.js";

const IMPORTABLE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp"]);
const IMPORTABLE_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const IMAGE_TABLE_GAS_ORDER = ["h2", "o2", "n2", "ch4", "co", "co2", "c2h4", "c2h6", "c2h2"];
const IMAGE_TABLE_COLUMN_COUNT = IMAGE_TABLE_GAS_ORDER.length + 1;
const MINIMUM_TABLE_ROW_VALUES = IMAGE_TABLE_GAS_ORDER.length;
const MAX_GAS_LABEL_TOKENS = 4;
const DATE_TOKEN_PATTERN = /^\d{2}[\/.-]\d{2}[\/.-]\d{4}$/;
const NUMERIC_TOKEN_PATTERN = /^-?\d[\d,]*(?:\.\d+)?$/;

function getFileName(file) {
  return String(file?.name ?? "").trim();
}

function getFileType(file) {
  return String(file?.type ?? "").trim().toLowerCase();
}

function getAppAssetUrl(relativePath) {
  if (typeof document === "undefined") {
    return relativePath;
  }

  return new URL(relativePath, document.baseURI).toString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getImageTokens(text) {
  return replaceSubscriptDigits(text).match(/[A-Za-z0-9/.,:+-]+/g) ?? [];
}

function isImageDateToken(value) {
  return DATE_TOKEN_PATTERN.test(String(value ?? "").trim());
}

function toIsoDateFromImage(token) {
  const [day, month, year] = String(token).trim().split(/[\/.-]/);
  return `${year}-${month}-${day}`;
}

function getWordCenterX(word) {
  return word.left + word.width / 2;
}

function getWordCenterY(word) {
  return word.top + word.height / 2;
}

function getLineSignals(line) {
  const tokens = getImageTokens(line);
  const consumedTokenIndexes = new Set();
  const gasKeys = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    let matchedGasKey = null;
    let matchedSpan = 0;

    for (let span = Math.min(MAX_GAS_LABEL_TOKENS, tokens.length - tokenIndex); span >= 1; span -= 1) {
      if (Array.from({ length: span }, (_, offset) => consumedTokenIndexes.has(tokenIndex + offset)).some(Boolean)) {
        continue;
      }

      const gasKey = getGasKeyFromLabel(tokens.slice(tokenIndex, tokenIndex + span).join(" "));

      if (gasKey) {
        matchedGasKey = gasKey;
        matchedSpan = span;
        break;
      }
    }

    if (!matchedGasKey || gasKeys.includes(matchedGasKey)) {
      continue;
    }

    gasKeys.push(matchedGasKey);
    for (let offset = 0; offset < matchedSpan; offset += 1) {
      consumedTokenIndexes.add(tokenIndex + offset);
    }
    tokenIndex += matchedSpan - 1;
  }

  const numericValues = tokens
    .filter((token, tokenIndex) => !consumedTokenIndexes.has(tokenIndex) && NUMERIC_TOKEN_PATTERN.test(token))
    .map((token) => parseNumericValue(token))
    .filter((value) => value != null);

  return {
    gasKeys,
    numericValues,
  };
}

function mapGasKeysToValues(gasKeys, numericValues) {
  if (!gasKeys.length || !numericValues.length) {
    return {};
  }

  const values = {};

  if (gasKeys.length === 1) {
    values[gasKeys[0]] = numericValues[0];
    return values;
  }

  const pairCount = Math.min(gasKeys.length, numericValues.length);

  for (let index = 0; index < pairCount; index += 1) {
    values[gasKeys[index]] = numericValues[index];
  }

  return values;
}

function mergeDetectedValues(target, nextValues) {
  Object.entries(nextValues).forEach(([field, value]) => {
    if (target[field] == null && value != null) {
      target[field] = value;
    }
  });
}

function getOcrLines(text) {
  return replaceSubscriptDigits(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractSameLineValues(lines) {
  const values = {};

  lines.forEach((line) => {
    const { gasKeys, numericValues } = getLineSignals(line);
    mergeDetectedValues(values, mapGasKeysToValues(gasKeys, numericValues));
  });

  return values;
}

function extractAdjacentLineValues(lines) {
  const values = {};

  for (let lineIndex = 0; lineIndex < lines.length - 1; lineIndex += 1) {
    const currentLine = getLineSignals(lines[lineIndex]);
    const nextLine = getLineSignals(lines[lineIndex + 1]);
    mergeDetectedValues(values, mapGasKeysToValues(currentLine.gasKeys, nextLine.numericValues));
  }

  return values;
}

function buildOcrStrategyLabel({ sameLineValues, adjacentLineValues }) {
  const matchedSameLine = Object.keys(sameLineValues).length;
  const matchedAdjacent = Object.keys(adjacentLineValues).length;

  if (matchedSameLine > 0 && matchedAdjacent > 0) {
    return "OCR matched gas labels in the pasted screenshot";
  }

  if (matchedAdjacent > 0) {
    return "OCR aligned gas labels with the following value rows";
  }

  return "OCR matched gas labels and values on the same line";
}

export function parseOcrTsvWords(tsv) {
  const lines = String(tsv ?? "")
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  return lines
    .slice(1)
    .map((line) => line.split("\t"))
    .filter((columns) => columns.length >= 12 && Number(columns[0]) === 5)
    .map((columns) => ({
      text: columns.slice(11).join("\t").trim(),
      left: Number(columns[6]),
      top: Number(columns[7]),
      width: Number(columns[8]),
      height: Number(columns[9]),
      confidence: Number(columns[10]),
    }))
    .filter((word) => word.text && Number.isFinite(word.left) && Number.isFinite(word.top) && Number.isFinite(word.width) && Number.isFinite(word.height));
}

export function clusterOcrWordsIntoRows(words) {
  if (!words.length) {
    return [];
  }

  const sortedWords = [...words].sort((left, right) => getWordCenterY(left) - getWordCenterY(right) || left.left - right.left);
  const averageHeight = sortedWords.reduce((sum, word) => sum + Math.max(word.height, 1), 0) / sortedWords.length;
  const rowThreshold = Math.max(10, averageHeight * 0.75);
  const rows = [];

  sortedWords.forEach((word) => {
    const centerY = getWordCenterY(word);
    const matchingRow = rows.find((row) => Math.abs(centerY - row.centerY) <= rowThreshold);

    if (!matchingRow) {
      rows.push({
        centerY,
        words: [word],
      });
      return;
    }

    matchingRow.words.push(word);
    matchingRow.centerY = matchingRow.words.reduce((sum, rowWord) => sum + getWordCenterY(rowWord), 0) / matchingRow.words.length;
  });

  return rows
    .sort((left, right) => left.centerY - right.centerY)
    .map((row) => row.words.sort((left, right) => left.left - right.left));
}

function extractDateFromOcrRow(words) {
  const maxStartIndex = Math.min(2, Math.max(words.length - 1, 0));

  for (let startIndex = 0; startIndex <= maxStartIndex; startIndex += 1) {
    const maxSpan = Math.min(5, words.length - startIndex);

    for (let span = 1; span <= maxSpan; span += 1) {
      const candidate = words
        .slice(startIndex, startIndex + span)
        .map((word) => word.text)
        .join("")
        .replace(/\s+/g, "");

      if (isImageDateToken(candidate)) {
        return {
          dateToken: candidate,
          nextWordIndex: startIndex + span,
        };
      }
    }
  }

  return null;
}

function getNumericWordsFromOcrRow(words, startIndex) {
  return words.slice(startIndex).filter((word) => parseNumericValue(word.text) != null);
}

function mergeClosestColumnClusters(clusters) {
  if (clusters.length <= 1) {
    return clusters;
  }

  let closestGap = Number.POSITIVE_INFINITY;
  let closestIndex = 0;

  for (let index = 0; index < clusters.length - 1; index += 1) {
    const gap = clusters[index + 1].centerX - clusters[index].centerX;

    if (gap < closestGap) {
      closestGap = gap;
      closestIndex = index;
    }
  }

  const mergedValues = [...clusters[closestIndex].values, ...clusters[closestIndex + 1].values];
  const mergedCluster = {
    values: mergedValues,
    centerX: mergedValues.reduce((sum, value) => sum + value, 0) / mergedValues.length,
  };

  return [...clusters.slice(0, closestIndex), mergedCluster, ...clusters.slice(closestIndex + 2)];
}

function calculateTableColumnCenters(rowEntries) {
  const allValueWords = rowEntries.flatMap((rowEntry) => rowEntry.valueWords);

  if (allValueWords.length < IMAGE_TABLE_COLUMN_COUNT) {
    return null;
  }

  let clusters = [];

  [...allValueWords]
    .sort((left, right) => getWordCenterX(left) - getWordCenterX(right))
    .forEach((word) => {
      const centerX = getWordCenterX(word);
      const lastCluster = clusters[clusters.length - 1];

      if (!lastCluster || Math.abs(centerX - lastCluster.centerX) > 24) {
        clusters.push({
          values: [centerX],
          centerX,
        });
        return;
      }

      lastCluster.values.push(centerX);
      lastCluster.centerX = lastCluster.values.reduce((sum, value) => sum + value, 0) / lastCluster.values.length;
    });

  while (clusters.length > IMAGE_TABLE_COLUMN_COUNT) {
    clusters = mergeClosestColumnClusters(clusters);
  }

  if (clusters.length < IMAGE_TABLE_COLUMN_COUNT) {
    return null;
  }

  return clusters.map((cluster) => cluster.centerX);
}

function getNearestColumnIndex(centerX, columnCenters) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  columnCenters.forEach((columnCenter, columnIndex) => {
    const distance = Math.abs(centerX - columnCenter);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = columnIndex;
    }
  });

  return nearestIndex;
}

function buildSamplePatchFromOcrRow(rowEntry, columnCenters) {
  const buckets = Array.from({ length: IMAGE_TABLE_COLUMN_COUNT }, () => []);

  rowEntry.valueWords.forEach((word) => {
    const columnIndex = getNearestColumnIndex(getWordCenterX(word), columnCenters);
    buckets[columnIndex].push(word);
  });

  const samplePatch = {
    date: toIsoDateFromImage(rowEntry.dateToken),
  };

  IMAGE_TABLE_GAS_ORDER.forEach((fieldKey, fieldIndex) => {
    const bucketText = buckets[fieldIndex]
      .sort((left, right) => left.left - right.left)
      .map((word) => word.text)
      .join("");
    const numericValue = parseNumericValue(bucketText);

    if (numericValue != null) {
      samplePatch[fieldKey] = formatImportedValue(numericValue);
    }
  });

  return samplePatch;
}

function extractHistoryRowsFromOcrTsv(tsv) {
  const rowEntries = clusterOcrWordsIntoRows(parseOcrTsvWords(tsv))
    .map((rowWords) => {
      const dateInfo = extractDateFromOcrRow(rowWords);

      if (!dateInfo) {
        return null;
      }

      return {
        dateToken: dateInfo.dateToken,
        valueWords: getNumericWordsFromOcrRow(rowWords, dateInfo.nextWordIndex),
      };
    })
    .filter((rowEntry) => rowEntry && rowEntry.valueWords.length >= 4);

  if (!rowEntries.length) {
    return [];
  }

  const calibrationEntries = rowEntries.filter((rowEntry) => rowEntry.valueWords.length >= MINIMUM_TABLE_ROW_VALUES);
  const columnCenters = calculateTableColumnCenters(calibrationEntries.length ? calibrationEntries : rowEntries);

  if (!columnCenters) {
    return [];
  }

  return rowEntries
    .map((rowEntry) => buildSamplePatchFromOcrRow(rowEntry, columnCenters))
    .filter((samplePatch) => IMAGE_TABLE_GAS_ORDER.filter((fieldKey) => samplePatch[fieldKey] != null).length >= 5);
}

function extractHistoryRowsFromOcrText(text) {
  const lines = getOcrLines(text);
  const rows = [];

  lines.forEach((line) => {
    const tokens = getImageTokens(line);
    const dateIndex = tokens.findIndex((token) => isImageDateToken(token));

    if (dateIndex === -1) {
      return;
    }

    const rawValues = [];

    for (let tokenIndex = dateIndex + 1; tokenIndex < tokens.length; tokenIndex += 1) {
      const token = tokens[tokenIndex];

      if (isImageDateToken(token)) {
        break;
      }

      const numericValue = parseNumericValue(token);

      if (numericValue != null) {
        rawValues.push(numericValue);
      }
    }

    if (rawValues.length < MINIMUM_TABLE_ROW_VALUES) {
      return;
    }

    const samplePatch = {
      date: toIsoDateFromImage(tokens[dateIndex]),
    };

    IMAGE_TABLE_GAS_ORDER.forEach((fieldKey, fieldIndex) => {
      const numericValue = rawValues[fieldIndex];

      if (numericValue != null) {
        samplePatch[fieldKey] = formatImportedValue(numericValue);
      }
    });

    const matchedFieldCount = IMAGE_TABLE_GAS_ORDER.filter((fieldKey) => samplePatch[fieldKey] != null).length;

    if (matchedFieldCount >= 5) {
      rows.push(samplePatch);
    }
  });

  return rows;
}

function buildSingleSampleCandidateFromTableRow(samplePatch) {
  const rawValues = {};

  IMPORTABLE_GAS_FIELDS.forEach((fieldKey) => {
    const numericValue = parseNumericValue(samplePatch[fieldKey]);

    if (numericValue != null) {
      rawValues[fieldKey] = numericValue;
    }
  });

  const candidate = buildSingleSampleImportCandidate(rawValues, {
    strategy: "ocr-table-row",
    strategyLabel: "OCR read a DGA table row from the screenshot",
  });

  if (!candidate) {
    return null;
  }

  candidate.samplePatch = {
    ...candidate.samplePatch,
    date: samplePatch.date,
  };

  return candidate;
}

function extractCandidateFromRecognizedText(text) {
  const lines = getOcrLines(text);
  const sameLineValues = extractSameLineValues(lines);
  const adjacentLineValues = extractAdjacentLineValues(lines);
  const mergedValues = {};

  mergeDetectedValues(mergedValues, sameLineValues);
  mergeDetectedValues(mergedValues, adjacentLineValues);

  return buildSingleSampleImportCandidate(mergedValues, {
    strategy: "ocr",
    strategyLabel: buildOcrStrategyLabel({ sameLineValues, adjacentLineValues }),
  });
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The pasted screenshot could not be opened."));
    };

    image.src = objectUrl;
  });
}

async function prepareImageForOcr(file) {
  if (typeof document === "undefined") {
    return file;
  }

  const imageSource = await loadImageSource(file);
  const width = "naturalWidth" in imageSource && imageSource.naturalWidth ? imageSource.naturalWidth : imageSource.width ?? 0;
  const height = "naturalHeight" in imageSource && imageSource.naturalHeight ? imageSource.naturalHeight : imageSource.height ?? 0;
  const scale = width > 0 && width < 1800 ? Math.max(1.5, 1800 / width) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("The pasted screenshot could not be prepared for OCR.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(imageSource, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const contrasted = clamp((luminance - 128) * 1.45 + 128, 0, 255);
    const adjusted = contrasted > 235 ? 255 : contrasted < 30 ? 0 : contrasted;
    pixels[index] = adjusted;
    pixels[index + 1] = adjusted;
    pixels[index + 2] = adjusted;
    pixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  if (typeof imageSource.close === "function") {
    imageSource.close();
  }

  return canvas;
}

export async function createImageRecognizer() {
  const tesseractModule = await import("tesseract.js");
  const Tesseract = tesseractModule.default ?? tesseractModule;
  const worker = await Tesseract.createWorker("eng", 1, {
    workerPath: getAppAssetUrl("tesseract/worker.min.js"),
    corePath: getAppAssetUrl("tesseract/core/"),
    langPath: getAppAssetUrl("tesseract/lang/"),
    logger: () => {},
  });

  await worker.setParameters({
    tessedit_pageseg_mode: String(Tesseract.PSM.AUTO),
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  return {
    async recognize(image) {
      const result = await worker.recognize(image, {}, { text: true, tsv: true });
      return {
        text: String(result?.data?.text ?? ""),
        tsv: String(result?.data?.tsv ?? ""),
      };
    },
    terminate() {
      return worker.terminate();
    },
  };
}

async function recognizeImageData(image) {
  const recognizer = await createImageRecognizer();

  try {
    return await recognizer.recognize(image);
  } finally {
    await recognizer.terminate();
  }
}

export function isImportableImageFile(file) {
  const fileName = getFileName(file).toLowerCase();
  const mimeType = getFileType(file);

  return IMPORTABLE_IMAGE_MIME_TYPES.has(mimeType) || IMPORTABLE_IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

export async function extractDgaImportFromImageFile(file, options = {}) {
  if (!file || !isImportableImageFile(file)) {
    throw new Error("Choose a screenshot image before importing.");
  }

  const resolvedFileName = options.fileName ?? getFileName(file);
  const preparedImage = await prepareImageForOcr(file);
  const recognizedData = await recognizeImageData(preparedImage);
  const historyRows = extractHistoryRowsFromOcrTsv(recognizedData.tsv);
  const fallbackHistoryRows = historyRows.length ? historyRows : extractHistoryRowsFromOcrText(recognizedData.text);

  if (fallbackHistoryRows.length > 1) {
    return {
      kind: "sample-history",
      fileType: "image",
      fileName: resolvedFileName || "Clipboard screenshot",
      sourceLabel: options.sourceLabel ?? "screenshot OCR",
      strategyLabel: "OCR read DGA table rows from the screenshot",
      sampleCount: fallbackHistoryRows.length,
      samples: fallbackHistoryRows,
    };
  }

  if (fallbackHistoryRows.length === 1) {
    const candidateFromRow = buildSingleSampleCandidateFromTableRow(fallbackHistoryRows[0]);

    if (candidateFromRow) {
      return {
        kind: "single-sample",
        fileType: "image",
        fileName: resolvedFileName || "Clipboard screenshot",
        sourceLabel: options.sourceLabel ?? "screenshot OCR",
        ...candidateFromRow,
      };
    }
  }

  const candidate = extractCandidateFromRecognizedText(recognizedData.text);

  if (!candidate) {
    throw new Error(
      "No DGA gas values or readable sampling rows were found in the screenshot. Copy a clearer screenshot that shows the table or gas labels and numeric results, then press Ctrl+V again.",
    );
  }

  return {
    kind: "single-sample",
    fileType: "image",
    fileName: resolvedFileName || "Clipboard screenshot",
    sourceLabel: options.sourceLabel ?? "screenshot OCR",
    ...candidate,
  };
}
