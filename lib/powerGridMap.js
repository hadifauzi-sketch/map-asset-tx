// Layer catalogue and saved on/off state for the 2D map's "Power grid" tool.
// Data, colours and info cards are shared with the 3D globe via
// lib/globe3d/powerGrid.js, so both views always draw the same thing.

export const POWER_GRID_STORAGE_KEY = 'tx-map-power-grid-layers';

export const POWER_GRID_MAP_LAYERS = [
  { id: 'powerPlants', label: 'Power stations', note: 'WRI · 55 plants · by fuel & MW', shape: 'point' },
  { id: 'substations', label: 'Substations', note: 'OSM · 4,993 sites', shape: 'point' },
  { id: 'mappedTransformers', label: 'Individually mapped transformers', note: 'OSM · 475 units', shape: 'point' },
  { id: 'powerLines', label: 'Power-line segments', note: 'OSM · coloured by voltage', shape: 'line' },
  { id: 'minorLines', label: 'Minor power-line segments', note: 'OSM · distribution', shape: 'line' },
  { id: 'powerCables', label: 'Cables', note: 'OSM · underground / submarine', shape: 'line' },
];

export const POWER_GRID_LAYER_IDS = POWER_GRID_MAP_LAYERS.map((layer) => layer.id);

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
  const swatch = color ? `<span class="grid-popup-swatch" style="background:${escapeHtml(color)}"></span>` : '';
  const href = info?.link?.href;
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
