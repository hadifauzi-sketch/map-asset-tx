// Malaysian power grid layers (OpenStreetMap export, © OpenStreetMap contributors,
// ODbL 1.0). The compact files in public/data/grid/ are generated from
// public/data/Malaysia_Power_Map by scripts/build-power-grid.mjs and served with
// the app — no third-party request, and each file is fetched once per session.

import { sourceColor } from '../gridSymbols.js';
import { describePowerPlant, fuelColor } from '../powerPlants.js';

export const GRID_FILES = {
  substations: 'substations.json',
  mappedTransformers: 'transformers.json',
  powerLines: 'lines.json',
  minorLines: 'minor-lines.json',
  powerCables: 'cables.json',
  // Equipment points (scripts/download-power-equipment.mjs)
  osmPlants: 'plant-sites.json',
  generators: 'generators.json',
  switches: 'switches.json',
  compensators: 'compensators.json',
  portals: 'portals.json',
  powerTowers: 'towers.json',
  transitionTowers: 'transition-towers.json',
  powerPoles: 'poles.json',
  transitionPoles: 'transition-poles.json',
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

/**
 * Transformer windings in tag order, the way OpenInfraMap labels them:
 * "500000;275000" -> "500/275 kV", "11000;415" -> "11/0.415 kV".
 * When any winding is given in volts (≥ 1000), bare numbers are all volts, so
 * the 415 V low side is not mistaken for 415 kV.
 */
export function formatVoltageChain(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const parts = String(value).split(';').map((part) => part.trim()).filter(Boolean);
  const bare = (part) => !/kv/i.test(part) && Number.parseFloat(part.replace(/[^\d.]/g, ''));
  const inVolts = parts.some((part) => bare(part) >= 1000);
  const kv = parts
    .map((part) => {
      const number = bare(part);
      if (inVolts && Number.isFinite(number) && number > 0) return number / 1000;
      return parseVoltageKv(part)[0];
    })
    .filter((number) => Number.isFinite(number));
  if (kv.length === 0) {
    return '';
  }
  return `${kv.map((number) => Number(number.toFixed(3)).toString()).join('/')} kV`;
}

/** "650 MW" / "1.5 MW" / "500" -> readable output; "yes" and junk -> "". */
export function formatOutput(value) {
  const textValue = String(value || '').trim();
  if (!/\d/.test(textValue)) return '';
  return /[a-z]/i.test(textValue) ? textValue.replace(/\s*([kMG]W[p]?)$/i, ' $1') : `${textValue} MW`;
}

/** "50" -> "50 Hz". */
const formatFrequency = (value) => (/^\d+(\.\d+)?$/.test(String(value || '').trim()) ? `${value} Hz` : value || '');
/** "45" -> "45 m". */
const formatHeight = (value) => (/^\d+(\.\d+)?$/.test(String(value || '').trim()) ? `${value} m` : value || '');
/** "a;b" -> "A, B" with humanised words. */
const humanizeList = (value) =>
  String(value || '')
    .split(';')
    .map((part) => humanizeTag(part.trim()))
    .filter(Boolean)
    .join(', ');

/** Link to the feature on openstreetmap.org, for "node/123" style keys. */
export function osmLink(osm) {
  return /^(node|way|relation)\/\d+$/.test(String(osm || ''))
    ? { href: `https://www.openstreetmap.org/${osm}`, label: 'Open in OpenStreetMap' }
    : null;
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
  osmPlants: '#f97316',
  generators: '#eab308',
  switches: '#94a3b8',
  compensators: '#64748b',
  portals: '#475569',
  powerTowers: '#334155',
  transitionTowers: '#0f172a',
  powerPoles: '#8b5a2b',
  transitionPoles: '#a16207',
};

/** Equipment layers drawn with OpenInfraMap-style symbols (lib/gridSymbols.js). */
export const GRID_SYMBOL_LAYERS = new Set([
  'mappedTransformers',
  'osmPlants',
  'generators',
  'switches',
  'compensators',
  'portals',
  'powerTowers',
  'transitionTowers',
  'powerPoles',
  'transitionPoles',
]);

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

const tagsOf = (record) => (record?.tags && typeof record.tags === 'object' ? record.tags : {});

/** Rows shared by every OSM card: equipment details, then ownership / provenance. */
const commonRows = (record, tags) => [
  ['Manufacturer', tags.manufacturer],
  ['Model', tags.model],
  ['In service since', tags.start_date],
  ['Disused', tags.disused === 'yes' ? 'Yes' : ''],
  ['Ref', record.ref],
  ['Operator', record.operator],
  ['OSM', record.osm],
];

function card(kind, title, rows, record) {
  return { kind, title, rows, link: osmLink(record?.osm) };
}

function lineInfo(kind, record) {
  const voltage = formatVoltage(record.voltage);
  const tags = tagsOf(record);
  return card(
    kind,
    record.name || (voltage ? `${voltage} ${kind.toLowerCase()}` : kind),
    [
      ['Voltage', voltage],
      ['Circuits', record.circuits],
      ['Cables', record.cables],
      ['Wires', humanizeTag(tags.wires)],
      ['Frequency', formatFrequency(tags.frequency)],
      ['Line type', humanizeTag(tags.line)],
      ['Location', humanizeTag(tags.location)],
      ...commonRows({ ...record, ref: record.ref }, tags),
    ],
    record
  );
}

const TRANSFORMER_TYPES = {
  main: 'Main (power)',
  distribution: 'Distribution',
  current: 'Current transformer (CT)',
  potential: 'Potential transformer (VT)',
  voltage: 'Voltage transformer (VT)',
  auxiliary: 'Auxiliary',
  generator: 'Generator step-up',
  converter: 'Converter',
  traction: 'Traction',
  phase_angle_regulator: 'Phase-angle regulator',
};

const SWITCH_TYPES = {
  disconnector: 'Disconnector',
  circuit_breaker: 'Circuit breaker',
  earthing: 'Earthing switch',
  mechanical: 'Mechanical switch',
  fuse: 'Fuse',
};

const COMPENSATOR_TYPES = {
  series_reactor: 'Series reactor',
  shunt_reactor: 'Shunt reactor',
  series_capacitor: 'Series capacitor',
  shunt_capacitor: 'Shunt capacitor',
  filter: 'Filter',
  statcom: 'STATCOM',
  svc: 'Static VAR compensator',
  converter: 'DC converter',
};

function describeTransformer(record) {
  const tags = tagsOf(record);
  const voltage = formatVoltageChain(record.voltage);
  const windings = tags.windings || (tags['voltage:tertiary'] ? '3' : tags['voltage:secondary'] ? '2' : '');
  const type = TRANSFORMER_TYPES[record.kind] || humanizeTag(record.kind);
  // Per-winding values from the same chain, so "11000;415" reads 11 kV / 0.415 kV.
  const perWinding = tags['voltage:primary'] ? voltage.replace(/ kV$/, '').split('/') : [];
  const winding = (index) => (perWinding[index] ? `${perWinding[index]} kV` : '');
  return card(
    'Transformer',
    record.name || (voltage ? `${voltage} transformer` : 'Transformer'),
    [
      ['Type', type],
      ['Voltage', voltage],
      ['Primary', perWinding.length > 1 ? winding(0) : ''],
      ['Secondary', winding(1)],
      ['Tertiary', winding(2)],
      ['Windings', windings],
      ['Rating', tags.rating],
      ['Phases', tags.phases],
      ['Frequency', formatFrequency(tags.frequency)],
      ['Cooling', tags.cooling],
      ['Location', humanizeTag(tags.location)],
      ['Units', tags.devices],
      ...commonRows(record, tags),
    ],
    record
  );
}

function describeSupport(kindLabel, record) {
  const tags = tagsOf(record);
  return card(
    kindLabel,
    record.name || (record.ref ? `${kindLabel} ${record.ref}` : kindLabel),
    [
      ['Design', humanizeTag(tags.design)],
      ['Structure', humanizeTag(tags.structure)],
      ['Material', humanizeTag(tags.material)],
      ['Height', formatHeight(tags.height)],
      ['Line attachment', humanizeTag(tags.line_attachment)],
      ['Line management', humanizeTag(tags.line_management)],
      ['Transition', tags['location:transition'] === 'yes' ? 'Overhead ↔ underground' : ''],
      ['Voltage', formatVoltage(record.voltage)],
      ...commonRows(record, tags),
    ],
    record
  );
}

/**
 * Info card for one grid record: { kind, title, rows: [[label, value], ...], link? }.
 * Used by the globe's feature card and the 2D map popup.
 */
export function describeGridRecord(layerId, record) {
  const tags = tagsOf(record);
  switch (layerId) {
    case 'powerPlants':
      return describePowerPlant(record);
    case 'substations':
      return card(
        'Substation',
        record.name || 'Substation',
        [
          ['Type', humanizeTag(record.kind)],
          ['Voltage', formatVoltage(record.voltage)],
          ['Location', humanizeTag(tags.location)],
          ['Frequency', formatFrequency(tags.frequency)],
          ...commonRows({ ...record, ref: record.ref && record.ref !== record.name ? record.ref : '' }, tags),
        ],
        record
      );
    case 'mappedTransformers':
      return describeTransformer(record);
    case 'switches': {
      const type = SWITCH_TYPES[record.kind] || humanizeTag(record.kind) || 'Switch';
      return card(
        'Switchgear',
        record.name || type,
        [
          ['Type', type],
          ['Voltage', formatVoltage(record.voltage)],
          ['Cables', tags.cables],
          ['Phases', tags.phases],
          ['Rating', tags.rating],
          ['Location', humanizeTag(tags.location)],
          ...commonRows(record, tags),
        ],
        record
      );
    }
    case 'compensators': {
      const type = COMPENSATOR_TYPES[record.kind] || humanizeTag(record.kind) || 'Compensator';
      return card(
        record.kind === 'converter' ? 'Converter' : 'Compensator',
        record.name || type,
        [
          ['Type', type],
          ['Converter', humanizeTag(tags.converter)],
          ['Voltage', formatVoltage(record.voltage)],
          ['Rating', tags.rating],
          ['Phases', tags.phases],
          ['Poles', tags.poles],
          ...commonRows(record, tags),
        ],
        record
      );
    }
    case 'generators': {
      const output = formatOutput(tags['generator:output:electricity']);
      const source = humanizeList(tags['generator:source']);
      return card(
        'Generator',
        record.name || [output, source.toLowerCase(), 'generator'].filter(Boolean).join(' ').replace(/^./, (c) => c.toUpperCase()),
        [
          ['Source', source],
          ['Method', humanizeList(tags['generator:method'])],
          ['Type', humanizeList(tags['generator:type'])],
          ['Output', output],
          ['Role in plant', humanizeTag(tags['generator:plant'])],
          ['Voltage', formatVoltage(record.voltage)],
          ...commonRows(record, tags),
        ],
        record
      );
    }
    case 'osmPlants': {
      const output = formatOutput(tags['plant:output:electricity']);
      return card(
        'Power plant (OSM)',
        record.name || 'Power plant',
        [
          ['Source', humanizeList(tags['plant:source'])],
          ['Method', humanizeList(tags['plant:method'])],
          ['Output', output],
          ['Storage', humanizeTag(tags['plant:storage'])],
          ...commonRows(record, tags),
        ],
        record
      );
    }
    case 'portals':
      return describeSupport(record.kind === 'terminal' ? 'Line terminal' : record.kind === 'insulator' ? 'Insulator' : 'Portal (gantry)', record);
    case 'powerTowers':
      return describeSupport('Tower', record);
    case 'transitionTowers':
      return describeSupport('Transition tower', record);
    case 'powerPoles':
      return describeSupport('Pole', record);
    case 'transitionPoles':
      return describeSupport('Transition pole', record);
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

/**
 * Short hover label: the name when there is one, otherwise a summary such as
 * "500/275 kV transformer" or "Tower T42". "" means no tooltip.
 */
export function gridHoverText(layerId, record) {
  if (!record) return '';
  if (record.name) return record.name;
  if (!GRID_SYMBOL_LAYERS.has(layerId)) return '';
  const info = describeGridRecord(layerId, record);
  // Generic titles ("Tower", "Transformer") add nothing over the symbol itself.
  return info.title && info.title !== info.kind ? info.title : '';
}

/** Colour for one record of a grid layer. */
export function gridRecordColor(layerId, record) {
  if (layerId === 'powerLines') return voltageColor(record?.voltage);
  if (layerId === 'powerPlants' && record) return fuelColor(record.fuel);
  if ((layerId === 'generators' || layerId === 'osmPlants') && record?.kind) return sourceColor(record.kind);
  if (layerId === 'mappedTransformers' && record?.voltage) return voltageColor(record.voltage);
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
