export const TEST_TYPE_OPTIONS = [
  { value: 'Routine', label: 'Routine (In-service)' },
  { value: 'After Filter', label: 'After Filter' },
  { value: 'Tripping', label: 'Tripping' },
  { value: 'Commissioning', label: 'Commissioning (Before energization)' },
];

const TEST_TYPE_NORMALISATION_MAP = new Map([
  ['routine', 'Routine'],
  ['in service', 'Routine'],
  ['in-service', 'Routine'],
  ['in service oil', 'Routine'],
  ['in-service oil', 'Routine'],
  ['special', 'After Filter'],
  ['after filter', 'After Filter'],
  ['emergency', 'Tripping'],
  ['tripping', 'Tripping'],
  ['commissioning', 'Commissioning'],
  ['commisioning', 'Commissioning'],
  ['before energization', 'Commissioning'],
  ['prior to first energization', 'Commissioning'],
]);

export function normaliseTestType(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  return TEST_TYPE_NORMALISATION_MAP.get(rawValue.toLowerCase()) || rawValue;
}

export function normaliseTestTypeForStorage(value) {
  return normaliseTestType(value) || 'Routine';
}
