// Layer catalogue and saved on/off state for the 2D map's "Power grid" tool.
// Data, colours and info cards are shared with the 3D globe via
// lib/globe3d/powerGrid.js, so both views always draw the same thing.

export const POWER_GRID_STORAGE_KEY = 'tx-map-power-grid-layers';

/** Menu sections, in display order. Each has an "all on / off" switch. */
export const POWER_GRID_GROUPS = [
  { id: 'sites', label: 'Generation & sites' },
  { id: 'switchgear', label: 'Switchgear' },
  { id: 'supports', label: 'Power line supports' },
  { id: 'lines', label: 'Lines & cables' },
];

// shape: 'point' (coloured dot), 'symbol' (OpenInfraMap-style glyph, see
// lib/gridSymbols.js), 'line'. minZoom: the layer only draws from this zoom
// (dense layers stay readable and fast); symbolZoom: below it a symbol layer
// draws as a small dot. swatch: the symbol shown in the menu.
export const POWER_GRID_MAP_LAYERS = [
  { id: 'powerPlants', group: 'sites', label: 'Power stations', note: 'WRI · 55 plants · by fuel & MW', shape: 'point' },
  {
    id: 'osmPlants', group: 'sites', label: 'Power plant sites', note: 'OSM · 223 sites · source & MW',
    shape: 'symbol', swatch: 'plant', minZoom: 0, symbolZoom: 9,
  },
  { id: 'substations', group: 'sites', label: 'Substations', note: 'OSM · 4,993 sites', shape: 'point' },

  {
    id: 'generators', group: 'switchgear', label: 'Generators', note: 'OSM · 807 units · source & output',
    shape: 'symbol', swatch: 'generator', minZoom: 8, symbolZoom: 12,
  },
  {
    id: 'mappedTransformers', group: 'switchgear', label: 'Transformers', note: 'OSM · 475 units · kV ratio, rating',
    shape: 'symbol', swatch: 'transformer', minZoom: 0, symbolZoom: 13,
  },
  {
    id: 'switches', group: 'switchgear', label: 'Switches & circuit breakers', note: 'OSM · disconnector, breaker',
    shape: 'symbol', swatch: 'circuitBreaker', minZoom: 10, symbolZoom: 13,
  },
  {
    id: 'compensators', group: 'switchgear', label: 'Reactors, capacitors & converters', note: 'OSM · compensation, DC',
    shape: 'symbol', swatch: 'shuntReactor', minZoom: 10, symbolZoom: 13,
  },
  {
    id: 'portals', group: 'switchgear', label: 'Portals & line terminals', note: 'OSM · 2,023 · zoom 14+',
    shape: 'symbol', swatch: 'portal', minZoom: 14, symbolZoom: 15,
  },

  {
    id: 'powerTowers', group: 'supports', label: 'Towers / pylons', note: 'OSM · 46,400 · zoom 13+',
    shape: 'symbol', swatch: 'tower', minZoom: 13, symbolZoom: 15,
  },
  {
    id: 'transitionTowers', group: 'supports', label: 'Transition towers', note: 'OSM · overhead ↔ underground',
    shape: 'symbol', swatch: 'transitionTower', minZoom: 9, symbolZoom: 12,
  },
  {
    id: 'powerPoles', group: 'supports', label: 'Power poles', note: 'OSM · 405 · zoom 13+',
    shape: 'symbol', swatch: 'pole', minZoom: 13, symbolZoom: 15,
  },
  {
    id: 'transitionPoles', group: 'supports', label: 'Transition poles', note: 'OSM · overhead ↔ underground',
    shape: 'symbol', swatch: 'transitionPole', minZoom: 9, symbolZoom: 12,
  },

  { id: 'powerLines', group: 'lines', label: 'Power-line segments', note: 'OSM · coloured by voltage', shape: 'line' },
  { id: 'minorLines', group: 'lines', label: 'Minor power-line segments', note: 'OSM · distribution', shape: 'line' },
  { id: 'powerCables', group: 'lines', label: 'Cables', note: 'OSM · underground / submarine', shape: 'line' },
];

export const POWER_GRID_LAYER_IDS = POWER_GRID_MAP_LAYERS.map((layer) => layer.id);

export const POWER_GRID_LAYER_BY_ID = Object.fromEntries(POWER_GRID_MAP_LAYERS.map((layer) => [layer.id, layer]));

/** Layers of one menu section. */
export function gridLayersInGroup(groupId) {
  return POWER_GRID_MAP_LAYERS.filter((layer) => layer.group === groupId);
}

/** Symbol radius (px) for an equipment layer at a zoom; supports stay a touch smaller. */
export function gridSymbolRadius(layerId, zoom) {
  const support = layerId === 'powerTowers' || layerId === 'powerPoles' || layerId === 'portals';
  const steps = support ? [4.5, 5.5, 6.5, 7.5] : [5.5, 6.5, 8, 9.5];
  if (zoom < 14) return steps[0];
  if (zoom < 16) return steps[1];
  if (zoom < 17) return steps[2];
  return steps[3];
}

export const DEFAULT_POWER_GRID_STATE = Object.fromEntries(POWER_GRID_LAYER_IDS.map((id) => [id, false]));

/** Saved state merged over the defaults; unknown keys and non-booleans are dropped. */
export function readPowerGridState(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(POWER_GRID_STORAGE_KEY) || '{}');
    return Object.fromEntries(
      POWER_GRID_LAYER_IDS.map((id) => [id, typeof stored?.[id] === 'boolean' ? stored[id] : false])
    );
  } catch {
    return { ...DEFAULT_POWER_GRID_STATE };
  }
}

export function writePowerGridState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(POWER_GRID_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / blocked storage: the toggles still work for this session.
  }
}

export function countActiveGridLayers(state) {
  return POWER_GRID_LAYER_IDS.filter((id) => state?.[id]).length;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Popup HTML for an info card from describeGridRecord(); empty rows are left out. */
export function gridPopupHtml(info, color) {
  const isList = info?.layout === 'list';
  const rows = (info?.rows || [])
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) =>
      isList
        ? `<div class="grid-popup-line"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</div>`
        : `<div class="grid-popup-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join('');
  const swatch = color ? `<span class="grid-popup-swatch" style="background:${escapeHtml(color)}"></span>` : '';  const href = info?.link?.href;
  const link =
    href && /^https?:\/\//i.test(href)
      ? `<a class="grid-popup-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          info.link.label || 'Source'
        )} ↗</a>`
      : '';
  if (isList) {
    return (
      `<div class="grid-popup is-list">` +
      `<div class="grid-popup-heading">${swatch}<span>${escapeHtml(info?.kind || '')}</span></div>` +
      `${rows}${link}</div>`
    );
  }
  return (
    `<div class="grid-popup">` +
    `<div class="grid-popup-kind">${swatch}${escapeHtml(info?.kind || '')}</div>` +
    `<div class="grid-popup-title">${escapeHtml(info?.title || '')}</div>` +
    `${rows}${link}</div>`
  );
}
