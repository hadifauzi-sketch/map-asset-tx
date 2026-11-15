// Malaysian power grid layers (OpenStreetMap export, © OpenStreetMap contributors,
// ODbL 1.0). The compact files in public/data/grid/ are generated from
// public/data/Malaysia_Power_Map by scripts/build-power-grid.mjs and served with
// the app — no third-party request, and each file is fetched once per session.

import { describePowerPlant, fuelColor } from '../powerPlants.js';

export const GRID_FILES = {
  substations: 'substations.json',
  mappedTransformers: 'transformers.json',
  powerLines: 'lines.json',
  minorLines: 'minor-lines.json',
  powerCables: 'cables.json',
};

export const GRID_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

/** Voltage colour bands, highest first. Also used for the panel legend. */
export const VOLTAGE_BANDS = [
  { minKv: 400, label: '500 kV', color: '#f43f5e' },
  { minKv: 200, label: '275 kV', color: '#fb923c' },
  { minKv: 100, label: '132 kV', color: '#60a5fa' },
  { minKv: 1, label: '≤ 66 kV', color: '#4ade80' },
];
export const UNKNOWN_VOLTAGE_COLOR = '#cbd5e1';

/**
 * OSM voltage text ("275000", "275000;132000", "33 kV") -> distinct kV values,
 * highest first. Zero and unparsable parts are dropped.
 */
export function parseVoltageKv(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const values = String(value)
    .split(/[;,/]/)
    .map((part) => {
      const number = Number.parseFloat(part.replace(/[^\d.]/g, ''));
      if (!Number.isFinite(number) || number <= 0) {
        return null;
      }
      // OSM stores volts; a bare small number is already kV.
      return /kv/i.test(part) || number < 1000 ? number : number / 1000;
    })
    .filter((number) => number !== null);
  return [...new Set(values)].sort((left, right) => right - left);
}

/** "275000;132000" -> "275 / 132 kV"; "" when unknown. */
export function formatVoltage(value) {
  const kv = parseVoltageKv(value);
  if (kv.length === 0) {
    return '';
  }
  return `${kv.map((number) => Number(number.toFixed(1)).toString()).join(' / ')} kV`;
}

/** CSS colour for a line by its highest voltage. */
export function voltageColor(value) {
  const [highest] = parseVoltageKv(value);
  if (!highest) {
    return UNKNOWN_VOLTAGE_COLOR;
  }
  return (VOLTAGE_BANDS.find((band) => highest >= band.minKv) || VOLTAGE_BANDS[VOLTAGE_BANDS.length - 1]).color;
}

/** "minor_distribution" -> "Minor distribution". */
export function humanizeTag(value) {
  const textValue = String(value || '').replace(/[_-]+/g, ' ').trim();
  return textValue ? textValue.charAt(0).toUpperCase() + textValue.slice(1) : '';
}

/** Colours shared by the 2D map and the 3D globe (power lines use voltageColor). */
export const GRID_LAYER_COLORS = {
  powerPlants: '#f59e0b',
  substations: '#a78bfa',
  mappedTransformers: '#f472b6',
  minorLines: '#facc15',
  powerCables: '#22d3ee',
};

/** Grid layers drawn as lines; everything else is a point layer. */
export const GRID_LINE_LAYERS = new Set(['powerLines', 'minorLines', 'powerCables']);

/** Line width (px) for a power line: thicker for higher voltage. */
export function lineWidthForVoltage(voltage, base = 2) {
  const [highest] = parseVoltageKv(voltage);
  if (!highest) return base;
  if (highest >= 400) return base + 1.5;
  if (highest >= 200) return base + 1;
  if (highest >= 100) return base + 0.5;
  return base;
}

function lineInfo(kind, record) {
  const voltage = formatVoltage(record.voltage);
  return {
    kind,
    title: record.name || (voltage ? `${voltage} ${kind.toLowerCase()}` : kind),
    rows: [
      ['Voltage', voltage],
      ['Circuits', record.circuits],
      ['Cables', record.cables],
      ['Operator', record.operator],
      ['OSM', record.osm],
    ],
  };
}

/**
 * Info card for one grid record: { kind, title, rows: [[label, value], ...] }.
 * Used by the globe's feature card and the 2D map popup.
 */
export function describeGridRecord(layerId, record) {
  switch (layerId) {
    case 'powerPlants':
      return describePowerPlant(record);
    case 'substations':
      return {
        kind: 'Substation',
        title: record.name || 'Substation',
        rows: [
          ['Type', humanizeTag(record.kind)],
          ['Voltage', formatVoltage(record.voltage)],
          ['Operator', record.operator],
          ['OSM', record.osm],
        ],
      };
    case 'mappedTransformers':
      return {
        kind: 'Mapped transformer',
        title: record.name || 'Transformer (OSM)',
        rows: [
          ['Type', humanizeTag(record.kind)],
          ['Primary voltage', formatVoltage(record.voltage)],
          ['Operator', record.operator],
          ['OSM', record.osm],
        ],
      };
    case 'powerLines':
      return lineInfo('Power line', record);
    case 'minorLines':
      return lineInfo('Minor line', record);
    case 'powerCables':
      return lineInfo('Cable', record);
    default:
      return { kind: 'Feature', title: record?.name || 'Feature', rows: [] };
  }
}

/** Colour for one record of a grid layer. */
export function gridRecordColor(layerId, record) {
  if (layerId === 'powerLines') return voltageColor(record?.voltage);
  if (layerId === 'powerPlants' && record) return fuelColor(record.fuel);
  return GRID_LAYER_COLORS[layerId] || UNKNOWN_VOLTAGE_COLOR;
}

/** { fields, rows } -> array of objects keyed by field name. */
export function rowsToRecords(payload) {
  const fields = Array.isArray(payload?.fields) ? payload.fields : [];
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows.map((row) => Object.fromEntries(fields.map((field, index) => [field, row[index]])));
}

const cache = new Map();

/**
 * Loads one grid layer's records. The promise is cached, so switching a layer
 * off and on again does not refetch; a failed load is forgotten so it can retry.
 */
export function loadGridLayer(layerId, { baseUrl = '/', fetchImpl = globalThis.fetch } = {}) {
  const file = GRID_FILES[layerId];
  if (!file) {
    return Promise.reject(new Error(`Unknown grid layer: ${layerId}`));
  }
  if (!cache.has(layerId)) {
    const promise = fetchImpl(`${baseUrl}data/grid/${file}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText || 'request failed'}`);
        }
        return response.json();
      })
      .then(rowsToRecords);
    promise.catch(() => cache.delete(layerId));
    cache.set(layerId, promise);
  }
  return cache.get(layerId);
}

export function clearGridCache() {
  cache.clear();
}
