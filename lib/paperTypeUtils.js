export const PAPER_TYPE_OPTIONS = [
  { value: 'TUP', label: 'TUP (Thermal Upgraded Paper)' },
  { value: 'Kraft Paper', label: 'Kraft Paper' },
  { value: 'DDP', label: 'DDP (Diamond Dotted Paper)' },
];

const PAPER_TYPE_NORMALISATION_MAP = new Map([
  ['tup', 'TUP'],
  ['thermal upgraded paper', 'TUP'],
  ['thermally upgraded paper', 'TUP'],
  ['kraft', 'Kraft Paper'],
  ['kraft paper', 'Kraft Paper'],
  ['kraff', 'Kraft Paper'],
  ['kraff paper', 'Kraft Paper'],
  ['ddp', 'DDP'],
  ['diamond dotted paper', 'DDP'],
  ['diamond-dotted paper', 'DDP'],
]);

export function normalisePaperType(value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }
  return PAPER_TYPE_NORMALISATION_MAP.get(rawValue.toLowerCase()) || rawValue;
}

export function getPaperTypeLabel(value) {
  const normalized = normalisePaperType(value);
  if (!normalized) {
    return '';
  }
  const match = PAPER_TYPE_OPTIONS.find((option) => option.value === normalized);
  return match ? match.label : normalized;
}
