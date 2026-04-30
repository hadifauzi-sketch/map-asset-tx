import { normaliseTestTypeForStorage } from './testTypeUtils';

const DEFAULT_TEST_TYPE = 'Routine';
const DGA_FIELDS = ['h2', 'ch4', 'c2h6', 'c2h4', 'c2h2', 'co', 'co2', 'o2', 'n2'];
const ADDITIONAL_IMPORT_FIELDS = [
  'breakdown',
  'waterContent',
  'acidity',
  'interfacialTension',
  'appearance',
  'color',
  'flashPoint',
  'inhibitor',
  'copperCorrosive',
  'density',
  'dbds',
  'viscosity40',
  'methanol',
  'pcb',
  'powerFactor',
  'resistivity',
  'specificGravity',
  'passivator',
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
];
const IMPORT_FIELDS = [...DGA_FIELDS, ...ADDITIONAL_IMPORT_FIELDS];
const TDCG_FIELDS = ['h2', 'ch4', 'c2h2', 'c2h4', 'c2h6', 'co'];

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function buildImportNotes(file, importResult) {
  const parts = [];

  if (file?.name) {
    parts.push(`Imported from ${file.name}`);
  }

  if (importResult?.strategyLabel) {
    parts.push(importResult.strategyLabel);
  }

  return parts.join(' - ');
}

function calculateImportedTdcg(row) {
  const total = TDCG_FIELDS.reduce((sum, key) => {
    const parsedValue = Number.parseFloat(String(row?.[key] ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(parsedValue) ? parsedValue : 0);
  }, 0);

  return total > 0 ? String(Number(total.toFixed(6))) : null;
}

export function buildImportedOilTestRows(importResult, file) {
  const samples =
    importResult?.kind === 'sample-history'
      ? importResult.samples || []
      : importResult?.samplePatch
        ? [importResult.samplePatch]
        : [];

  return samples.map((sample, index) => {
    const row = {
      localId: `${file?.name || 'import'}-${index + 1}`,
      sampleNumber: index + 1,
      testDate: sample.date || getTodayDateString(),
      testType: DEFAULT_TEST_TYPE,
      notes: buildImportNotes(file, importResult),
    };

    IMPORT_FIELDS.forEach((field) => {
      row[field] = sample?.[field] ?? '';
    });

    return row;
  });
}

export function hasImportedOilTestValues(row) {
  return IMPORT_FIELDS.some((field) => String(row?.[field] ?? '').trim() !== '');
}

export function normaliseImportedOilTest(row) {
  const payload = {
    testDate: row.testDate,
    testType: normaliseTestTypeForStorage(row.testType),
    notes: row.notes?.trim() || null,
    tdcg: calculateImportedTdcg(row),
  };

  DGA_FIELDS.forEach((field) => {
    payload[field] = String(row?.[field] ?? '').trim();
  });

  ADDITIONAL_IMPORT_FIELDS.forEach((field) => {
    payload[field] = String(row?.[field] ?? '').trim();
  });

  return payload;
}

export function buildImportedOilTestPayloads(importResult, file) {
  return buildImportedOilTestPayloadsFromRows(buildImportedOilTestRows(importResult, file));
}

export function buildImportedOilTestPayloadsFromRows(rows) {
  const validRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => row.testDate && hasImportedOilTestValues(row))
    .map(normaliseImportedOilTest);

  const rowsByDate = validRows.reduce((map, row) => {
    if (row.testDate) {
      map.set(row.testDate, row);
    }
    return map;
  }, new Map());

  return Array.from(rowsByDate.values());
}

function normaliseComparableValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

export function isSameImportedOilTestPayload(existingTest, incomingPayload) {
  if (!existingTest || !incomingPayload) {
    return false;
  }

  const fieldsToCompare = ['testDate', 'testType', 'notes', 'tdcg', ...IMPORT_FIELDS];

  return fieldsToCompare.every((field) => {
    const existingValue = existingTest[field];
    const incomingValue = incomingPayload[field];
    return normaliseComparableValue(existingValue) === normaliseComparableValue(incomingValue);
  });
}
