const DEFAULT_TRANSFORMER_POSITION = Object.freeze([3.139, 101.6869]);

function normalizeTransformerPosition(position) {
  const latitude = Number(position?.[0]);
  const longitude = Number(position?.[1]);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return [latitude, longitude];
  }

  return [...DEFAULT_TRANSFORMER_POSITION];
}

export { DEFAULT_TRANSFORMER_POSITION };

export function createTransformerDraft(overrides = {}) {
  const safeOverrides =
    overrides && typeof overrides === 'object' && !Array.isArray(overrides)
      ? overrides
      : {};

  const draft = {
    siteName: '',
    state: '',
    txName: '',
    mnemonic: '',
    serialNumber: '',
    voltage: '',
    loadMVA: '',
    maker: '',
    yearBuilt: '',
    paperType: '',
    position: [...DEFAULT_TRANSFORMER_POSITION],
    oilTests: [],
    documents: [],
    ...safeOverrides,
  };

  return {
    ...draft,
    position: normalizeTransformerPosition(safeOverrides.position ?? draft.position),
    oilTests: Array.isArray(draft.oilTests) ? [...draft.oilTests] : [],
    documents: Array.isArray(draft.documents) ? [...draft.documents] : [],
  };
}
