export const OIL_TYPE_OPTIONS = [
  { value: 'Mineral Oil', label: 'Mineral Oil' },
  { value: 'Silicon Oil', label: 'Silicon Oil' },
  { value: 'Natural Ester', label: 'Natural Ester' },
  { value: 'Synthetic Ester', label: 'Synthetic Ester' },
  { value: 'Modified Ester', label: 'Modified Ester' },
  { value: 'Polybutene Oil', label: 'Polybutene Oil' },
];

const DEFAULT_OIL_TYPE = OIL_TYPE_OPTIONS[0].value;

const OIL_TYPE_NORMALISATION_MAP = new Map([
  ['mineral', 'Mineral Oil'],
  ['mineral oil', 'Mineral Oil'],
  ['silicon', 'Silicon Oil'],
  ['silicon oil', 'Silicon Oil'],
  ['natural ester', 'Natural Ester'],
  ['synthetic ester', 'Synthetic Ester'],
  ['modify ester', 'Modified Ester'],
  ['modified ester', 'Modified Ester'],
  ['blended ester', 'Modified Ester'],
  ['modified blended ester', 'Modified Ester'],
  ['modified / blended ester', 'Modified Ester'],
  ['modified/blended ester', 'Modified Ester'],
  ['polybutene', 'Polybutene Oil'],
  ['polybutene oil', 'Polybutene Oil'],
]);

export function normaliseOilType(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  return OIL_TYPE_NORMALISATION_MAP.get(rawValue.toLowerCase()) || rawValue;
}

export function normaliseOilTypeForStorage(value) {
  return normaliseOilType(value) || DEFAULT_OIL_TYPE;
}
