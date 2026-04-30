import { MALAYSIA_STATES } from '../malaysiaStates';

const FIELD_DEFINITIONS = [
  {
    key: 'siteName',
    label: 'Site name',
    labels: ['site name', 'site'],
    stops: ['tx no.', 'tx no', 'transformer no', 'sample type', 'serial no.', 'serial no'],
  },
  {
    key: 'txName',
    label: 'Transformer name',
    labels: ['transformer no.', 'transformer no', 'tx no.', 'tx no'],
    stops: ['sample type', 'serial no.', 'serial no', 'sampling point', 'mnemonic', 'load mva'],
  },
  {
    key: 'serialNumber',
    label: 'Serial number',
    labels: ['serial number', 'serial no.', 'serial no'],
    stops: ['sampling point', 'mnemonic', 'maker', 'manufacturer', 'load mva', 'voltages (kv)', 'voltage'],
  },
  {
    key: 'mnemonic',
    label: 'Mnemonic',
    labels: ['mnemonic'],
    stops: ['load mva', 'voltages (kv)', 'voltage', 'maker', 'manufacturer', 'year built'],
  },
  {
    key: 'loadMVA',
    label: 'Load (MVA)',
    labels: ['load mva', 'load'],
    stops: ['voltages (kv)', 'voltage', 'maker', 'manufacturer', 'year built'],
  },
  {
    key: 'voltage',
    label: 'Voltage',
    labels: ['voltages (kv)', 'voltage (kv)', 'voltage'],
    stops: ['maker', 'manufacturer', 'year built'],
  },
  {
    key: 'maker',
    label: 'Manufacturer',
    labels: ['manufacturer', 'maker'],
    stops: ['year built'],
  },
  {
    key: 'yearBuilt',
    label: 'Year built',
    labels: ['year built'],
    stops: ['dissolved gas analysis', 'neutralization value', 'moisture content', 'colour', 'color'],
  },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseExtractedValue(value) {
  return collapseWhitespace(value).replace(/\s+:/g, ':');
}

function buildAlternation(values) {
  return values
    .slice()
    .sort((left, right) => right.length - left.length)
    .map((value) => escapeRegex(value).replace(/\s+/g, '\\s+'))
    .join('|');
}

function extractLabeledValue(text, definition) {
  const labelPattern = buildAlternation(definition.labels);
  const stopPattern = buildAlternation(definition.stops);
  const matcher = new RegExp(
    `(?:${labelPattern})\\s*:\\s*(.+?)(?=\\s+(?:${stopPattern})\\s*:|$)`,
    'i'
  );
  const match = text.match(matcher);

  if (!match) {
    return '';
  }

  return normaliseExtractedValue(match[1]);
}

function inferStateFromText(text) {
  const lowerText = text.toLowerCase();
  return MALAYSIA_STATES.find((state) => lowerText.includes(state.toLowerCase())) || '';
}

async function extractPdfPlainText(file) {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
  ]);

  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const segments = [];

    textContent.items.forEach((item) => {
      const chunk = collapseWhitespace(item?.str);

      if (chunk) {
        segments.push(chunk);
      }
    });

    if (segments.length) {
      pages.push(segments.join(' '));
    }
  }

  return collapseWhitespace(pages.join(' '));
}

export async function extractTransformerImportFromPdfFile(file) {
  const fileName = file?.name || 'report.pdf';
  const lowerFileName = fileName.toLowerCase();
  const mimeType = String(file?.type || '').toLowerCase();

  if (!lowerFileName.endsWith('.pdf') && mimeType !== 'application/pdf') {
    throw new Error('Please choose a PDF report.');
  }

  const pdfText = await extractPdfPlainText(file);

  if (!pdfText) {
    throw new Error('This PDF does not contain readable text yet. A scanned-image OCR flow can be added later.');
  }

  const fields = FIELD_DEFINITIONS.reduce((result, definition) => {
    const value = extractLabeledValue(pdfText, definition);
    return value ? { ...result, [definition.key]: value } : result;
  }, {});

  if (!fields.state) {
    const inferredState = inferStateFromText(pdfText);
    if (inferredState) {
      fields.state = inferredState;
    }
  }

  const matchedFields = FIELD_DEFINITIONS
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      value: fields[definition.key] || '',
    }))
    .filter((field) => field.value);

  if (!matchedFields.length) {
    throw new Error('No transformer details were found in this PDF. Try a text-based ACTMS result PDF.');
  }

  return {
    fileName,
    sourceLabel: 'Transformer test-result PDF',
    matchedFields,
    matchedCount: matchedFields.length,
    fields,
  };
}
