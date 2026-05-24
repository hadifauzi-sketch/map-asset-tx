export const ASSET_OWNER_TYPES = {
  TNB: 'TNB',
  NON_TNB: 'Non-TNB',
};

export const DEFAULT_ASSET_OWNER_TYPE = ASSET_OWNER_TYPES.TNB;

export const ASSET_OWNER_FILTERS = [
  {
    value: 'all',
    label: 'Show all',
    shortLabel: 'All',
  },
  {
    value: ASSET_OWNER_TYPES.TNB,
    label: 'TNB',
    shortLabel: 'TNB',
  },
  {
    value: ASSET_OWNER_TYPES.NON_TNB,
    label: 'Non-TNB',
    shortLabel: 'Non-TNB',
  },
];

export function normalizeAssetOwnerType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

  if (normalized === 'non-tnb' || normalized === 'nontnb' || normalized === 'private') {
    return ASSET_OWNER_TYPES.NON_TNB;
  }

  return ASSET_OWNER_TYPES.TNB;
}

export function getAssetOwnerLabel(value) {
  return normalizeAssetOwnerType(value);
}

export function normalizeAssetOwnerFilter(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

  if (!normalized || normalized === 'all') {
    return 'all';
  }

  if (normalized === 'tnb' || normalized === 'government') {
    return ASSET_OWNER_TYPES.TNB;
  }

  if (normalized === 'non-tnb' || normalized === 'nontnb' || normalized === 'private') {
    return ASSET_OWNER_TYPES.NON_TNB;
  }

  return 'all';
}

export function matchesAssetOwnerFilter(transformer, filter) {
  const normalizedFilter = normalizeAssetOwnerFilter(filter);

  if (normalizedFilter === 'all') {
    return true;
  }

  return normalizeAssetOwnerType(transformer?.ownerType) === normalizedFilter;
}
