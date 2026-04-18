export const MALAYSIA_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Kuala Lumpur',
  'Labuan',
  'Putrajaya',
];

export const UNASSIGNED_STATE = 'Unassigned';

const STATE_ALIASES = {
  Johor: [
    'johor',
    'johor bahru',
    'jb',
    'pasir gudang',
    'kulai',
    'batu pahat',
    'muar',
    'kluang',
    'pontian',
    'segamat',
    'senai',
  ],
  Kedah: ['kedah', 'alor setar', 'kulim', 'sungai petani', 'baling', 'langkawi', 'jitra', 'pendang'],
  Kelantan: ['kelantan', 'kota bharu', 'machang', 'pasir mas', 'tanah merah', 'gua musang', 'tumpat'],
  Melaka: ['melaka', 'malacca', 'ayer keroh', 'alor gajah', 'jasin', 'bukit katil'],
  'Negeri Sembilan': ['negeri sembilan', 'seremban', 'port dickson', 'nilai', 'senawang', 'rembau'],
  Pahang: ['pahang', 'kuantan', 'gambang', 'temerloh', 'pekan', 'raub', 'bentong', 'jerantut', 'mentakab'],
  Perak: ['perak', 'ipoh', 'taiping', 'manjung', 'seri iskandar', 'teluk intan', 'lumut', 'kampar', 'bidor'],
  Perlis: ['perlis', 'kangar', 'arau', 'padang besar'],
  'Pulau Pinang': ['pulau pinang', 'penang', 'george town', 'butterworth', 'seberang perai', 'bukit mertajam'],
  Sabah: ['sabah', 'kota kinabalu', 'kk', 'sandakan', 'tawau', 'lahad datu', 'keningau', 'kudat', 'beaufort'],
  Sarawak: ['sarawak', 'kuching', 'sibu', 'miri', 'bintulu', 'limbang', 'sarikei', 'mukah', 'sri aman'],
  Selangor: [
    'selangor',
    'rawang',
    'shah alam',
    'klang',
    'kajang',
    'subang',
    'subang jaya',
    'petaling jaya',
    'puncak alam',
    'bestari jaya',
    'sungai buloh',
    'batu caves',
    'selayang',
    'meru',
    'kapar',
    'bukit jelutong',
    'cyberjaya',
    'sepang',
    'ampang jaya',
    'damansara',
    'puchong',
    'gombak',
  ],
  Terengganu: ['terengganu', 'kuala terengganu', 'kemaman', 'dungun', 'kijal', 'besut', 'marang'],
  'Kuala Lumpur': ['kuala lumpur', 'wp kuala lumpur', 'wilayah persekutuan kuala lumpur', 'bukit jalil', 'setapak'],
  Labuan: ['labuan', 'wp labuan', 'wilayah persekutuan labuan'],
  Putrajaya: ['putrajaya', 'wp putrajaya', 'wilayah persekutuan putrajaya'],
};

const STATE_ORDER = new Map(MALAYSIA_STATES.map((state, index) => [state, index]));

export function normalizeMalaysianState(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue) {
    return '';
  }

  for (const state of MALAYSIA_STATES) {
    if (state.toLowerCase() === normalizedValue) {
      return state;
    }
  }

  for (const [state, aliases] of Object.entries(STATE_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalizedValue)) {
      return state;
    }
  }

  return '';
}

export function inferMalaysianStateFromText(...values) {
  const haystack = values
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) {
    return '';
  }

  for (const state of MALAYSIA_STATES) {
    if (haystack.includes(state.toLowerCase())) {
      return state;
    }
  }

  for (const [state, aliases] of Object.entries(STATE_ALIASES)) {
    if (aliases.some((alias) => haystack.includes(alias))) {
      return state;
    }
  }

  return '';
}

export function getTransformerState(transformer) {
  return (
    normalizeMalaysianState(transformer?.state) ||
    inferMalaysianStateFromText(transformer?.siteName, transformer?.txName, transformer?.mnemonic) ||
    UNASSIGNED_STATE
  );
}

export function compareMalaysianStates(left, right) {
  if (left === right) {
    return 0;
  }

  if (left === UNASSIGNED_STATE) {
    return 1;
  }

  if (right === UNASSIGNED_STATE) {
    return -1;
  }

  const leftOrder = STATE_ORDER.get(left);
  const rightOrder = STATE_ORDER.get(right);

  if (leftOrder != null && rightOrder != null) {
    return leftOrder - rightOrder;
  }

  if (leftOrder != null) {
    return -1;
  }

  if (rightOrder != null) {
    return 1;
  }

  return left.localeCompare(right);
}
