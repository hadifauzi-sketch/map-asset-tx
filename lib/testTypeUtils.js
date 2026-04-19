export const TEST_TYPE_OPTIONS = [
  { value: 'Routine', label: 'Routine' },
  { value: 'After Filter', label: 'After Filter' },
  { value: 'Tripping', label: 'Tripping' },
  { value: 'Commissioning', label: 'Commissioning' },
];

const TEST_TYPE_NORMALISATION_MAP = new Map([
  ['routine', 'Routine'],
  ['special', 'After Filter'],
  ['after filter', 'After Filter'],
  ['emergency', 'Tripping'],
  ['tripping', 'Tripping'],
  ['commissioning', 'Commissioning'],
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
