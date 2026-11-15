// Builds the compact grid files that the 2D map's and 3D view's "Power grid"
// layers load (public/data/grid/):
//
//   substations.json         substation sites            -> one point each
//   lines.json               power=line segments
//   minor-lines.json         power=minor_line segments
//   cables.json              power=cable segments
//   transformers.json        power=transformer (primary/secondary/tertiary kV)
//   switches.json            power=switch (disconnector, circuit breaker, …)
//   compensators.json        power=compensator + power=converter
//   generators.json          power=generator (source, method, output)
//   plant-sites.json         power=plant (OSM sites, output MW)
//   portals.json             power=portal / terminal / insulator
//   towers.json              power=tower
//   transition-towers.json   power=tower that is an overhead/underground transition
//   poles.json               power=pole
//   transition-poles.json    power=pole that is a transition
//
//   node scripts/download-power-equipment.mjs   (refresh the equipment source)
//   node scripts/build-power-grid.mjs           (npm run globe:grid)
//
// Sources (© OpenStreetMap contributors, ODbL 1.0):
//   public/data/Malaysia_Power_Map/malaysia_<layer>.geojson   sites and lines
//   data/osm/malaysia_power_equipment.json                    equipment points
//     (git-ignored; without it transformers fall back to the GeoJSON export and
//      the other equipment files keep their last committed version)
//
// The browser never loads those raw files: the output keeps only the tags the
// map shows, rounds coordinates to 5 decimals (~1 m) and stores them as flat
// arrays, so each layer is one small JSON fetch.
//
// Output shape: { fields: [...], rows: [[...], ...], source, license, timestamp }
//   points:    [lon, lat, name, voltage, operator, kind, osm, ref, tags]
//   equipment: [lon, lat, osm, kind, ref, name, voltage, operator, tags]
//   lines:     [voltage, name, operator, cables, circuits, osm, coords, ref, tags]
// Trailing empty values are dropped from each row (a missing column reads as
// undefined), which keeps the 46k-row tower file small.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'public/data/Malaysia_Power_Map');
const equipmentFile = resolve(root, 'data/osm/malaysia_power_equipment.json');
const targetDir = resolve(root, 'public/data/grid');

const round = (value) => Math.round(value * 1e5) / 1e5;

function readCollection(name) {
  return JSON.parse(readFileSync(resolve(sourceDir, `malaysia_${name}.geojson`), 'utf8'));
}

/** Area-weighted centroid of a ring ([[lon, lat], ...]); falls back to the vertex mean. */
function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-14) {
    const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return { point: [sum[0] / ring.length, sum[1] / ring.length], area: 0 };
  }
  return { point: [cx / (3 * area), cy / (3 * area)], area: Math.abs(area / 2) };
}

/** One representative point for any geometry the export contains. */
function representativePoint(geometry) {
  switch (geometry?.type) {
    case 'Point':
      return geometry.coordinates;
    case 'LineString':
      return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
    case 'Polygon':
      return ringCentroid(geometry.coordinates[0]).point;
    case 'MultiPolygon': {
      // Largest part wins, so a site split in two pieces is pinned on the main one.
      const parts = geometry.coordinates.map((polygon) => ringCentroid(polygon[0]));
      parts.sort((left, right) => right.area - left.area);
      return parts[0]?.point || null;
    }
    default:
      return null;
  }
}

/** Flat [lon, lat, ...] arrays for each line part, consecutive duplicates removed. */
function lineParts(geometry) {
  const parts =
    geometry?.type === 'LineString'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiLineString'
        ? geometry.coordinates
        : [];
  return parts
    .map((coordinates) => {
      const flat = [];
      for (const [lon, lat] of coordinates) {
        const x = round(lon);
        const y = round(lat);
        if (flat.length >= 2 && flat[flat.length - 2] === x && flat[flat.length - 1] === y) {
          continue;
        }
        flat.push(x, y);
      }
      return flat;
    })
    .filter((flat) => flat.length >= 4);
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const osmKey = (props) => `${props.osm_type}/${props.osm_id}`;
const nameOf = (tags) => text(tags.name || tags['name:en'] || tags['name:ms']);

// Tags shown in the info cards, kept per record when present. Everything else
// (source, notes, fixme, wikidata ids …) stays out of the browser payload.
const DETAIL_TAGS = [
  // transformers
  'transformer', 'voltage:primary', 'voltage:secondary', 'voltage:tertiary', 'windings', 'rating',
  'phases', 'frequency', 'cooling', 'devices',
  // switchgear
  'switch', 'cables', 'compensator', 'converter', 'poles',
  // generation
  'generator:source', 'generator:method', 'generator:type', 'generator:output:electricity',
  'generator:plant', 'plant:source', 'plant:method', 'plant:output:electricity', 'plant:storage',
  // supports
  'design', 'structure', 'material', 'height', 'line_attachment', 'line_management',
  'location:transition', 'colour',
  // sites & lines
  'substation', 'location', 'line', 'wires', 'circuits',
  // common
  'manufacturer', 'model', 'start_date', 'disused',
];

function pickTags(tags, exclude = []) {
  const picked = {};
  for (const key of DETAIL_TAGS) {
    if (exclude.includes(key)) continue;
    const value = text(tags[key]);
    if (value) picked[key] = value;
  }
  return Object.keys(picked).length > 0 ? picked : '';
}

/** Drops trailing '' values so absent columns cost nothing in the JSON. */
function trimRow(row) {
  let end = row.length;
  while (end > 0 && (row[end - 1] === '' || row[end - 1] === null || row[end - 1] === undefined)) {
    end -= 1;
  }
  return row.slice(0, end);
}

// ── Sites and lines (GeoJSON export) ──────────────────────────────────────

function buildPoints(name, kindOf) {
  const collection = readCollection(name);
  const rows = [];
  for (const feature of collection.features) {
    const point = representativePoint(feature.geometry);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      continue;
    }
    const props = feature.properties || {};
    rows.push(
      trimRow([
        round(point[0]),
        round(point[1]),
        text(props.name || props['name:en'] || props['name:ms'] || props.ref),
        text(props.voltage || props['voltage:primary']),
        text(props.operator),
        kindOf(props),
        osmKey(props),
        text(props.ref),
        pickTags(props, ['substation', 'circuits']),
      ])
    );
  }
  return {
    meta: { license: collection.license, timestamp: collection.source_timestamp },
    fields: ['lon', 'lat', 'name', 'voltage', 'operator', 'kind', 'osm', 'ref', 'tags'],
    rows,
  };
}

function buildLines(name) {
  const collection = readCollection(name);
  const rows = [];
  for (const feature of collection.features) {
    const props = feature.properties || {};
    for (const flat of lineParts(feature.geometry)) {
      rows.push(
        trimRow([
          text(props.voltage),
          text(props.name || props['name:en'] || props.ref),
          text(props.operator),
          text(props.cables),
          text(props.circuits),
          osmKey(props),
          flat,
          text(props.ref),
          pickTags(props, ['cables', 'circuits']),
        ])
      );
    }
  }
  return {
    meta: { license: collection.license, timestamp: collection.source_timestamp },
    fields: ['voltage', 'name', 'operator', 'cables', 'circuits', 'osm', 'coords', 'ref', 'tags'],
    rows,
  };
}

// ── Equipment points (Overpass download) ──────────────────────────────────

/** [{ lon, lat, osm, tags }] from the Overpass file, or null when it is missing. */
function readEquipment() {
  if (!existsSync(equipmentFile)) {
    return null;
  }
  const payload = JSON.parse(readFileSync(equipmentFile, 'utf8'));
  const items = [];
  for (const element of payload.elements || []) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    items.push({ lon, lat, osm: `${element.type}/${element.id}`, tags: element.tags || {} });
  }
  return { meta: { license: payload.license, timestamp: payload.timestamp }, items };
}

/** The same item shape from a GeoJSON export layer (fallback for transformers). */
function equipmentFromGeojson(name) {
  const collection = readCollection(name);
  const items = [];
  for (const feature of collection.features) {
    const point = representativePoint(feature.geometry);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const props = feature.properties || {};
    items.push({ lon: point[0], lat: point[1], osm: osmKey(props), tags: props });
  }
  return { meta: { license: collection.license, timestamp: collection.source_timestamp }, items };
}

const isTransition = (tags) =>
  tags['location:transition'] === 'yes' || tags.line_management === 'transition' || tags.transition === 'yes';

/**
 * Transformer voltage in winding order (primary;secondary;tertiary, in volts) —
 * the order OpenInfraMap shows as "500/275 kV". Falls back to `voltage`.
 */
function transformerVoltage(tags) {
  const windings = ['voltage:primary', 'voltage:secondary', 'voltage:tertiary'].map((key) => text(tags[key])).filter(Boolean);
  return windings.length > 0 ? windings.join(';') : text(tags.voltage);
}

const EQUIPMENT_KIND = {
  transformer: (tags) => text(tags.transformer),
  switch: (tags) => text(tags.switch),
  compensator: (tags) => text(tags.compensator),
  converter: () => 'converter',
  generator: (tags) => text(tags['generator:source']),
  plant: (tags) => text(tags['plant:source']),
  portal: () => 'portal',
  terminal: () => 'terminal',
  insulator: () => 'insulator',
  tower: (tags) => (isTransition(tags) ? 'transition' : ''),
  pole: (tags) => (isTransition(tags) ? 'transition' : ''),
};

function buildEquipment({ meta, items }, filter) {
  const rows = [];
  for (const { lon, lat, osm, tags } of items) {
    if (!filter(tags)) continue;
    const power = tags.power;
    const kind = (EQUIPMENT_KIND[power] || (() => ''))(tags);
    rows.push(
      trimRow([
        round(lon),
        round(lat),
        osm,
        kind,
        text(tags.ref),
        nameOf(tags),
        power === 'transformer' ? transformerVoltage(tags) : text(tags.voltage),
        text(tags.operator),
        pickTags(tags, ['transformer', 'switch', 'compensator']),
      ])
    );
  }
  // Stable order (west to east) so a refresh diffs cleanly.
  rows.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  return { meta, fields: ['lon', 'lat', 'osm', 'kind', 'ref', 'name', 'voltage', 'operator', 'tags'], rows };
}

// ── Write ─────────────────────────────────────────────────────────────────

function write(file, { meta, fields, rows }) {
  const payload = {
    source: '© OpenStreetMap contributors',
    license: meta.license || 'ODbL-1.0',
    timestamp: meta.timestamp || null,
    fields,
    rows,
  };
  const target = resolve(targetDir, file);
  const json = JSON.stringify(payload);
  writeFileSync(target, `${json}\n`);
  const kb = (Buffer.byteLength(json) / 1024).toFixed(0);
  console.log(`${file.padEnd(24)} ${String(rows.length).padStart(6)} rows  ${kb.padStart(5)} KB`);
}

mkdirSync(targetDir, { recursive: true });

write('substations.json', buildPoints('substation', (props) => text(props.substation)));
write('lines.json', buildLines('line'));
write('minor-lines.json', buildLines('minor_line'));
write('cables.json', buildLines('cable'));

const equipment = readEquipment();
const is = (...powers) => (tags) => powers.includes(tags.power);

write('transformers.json', buildEquipment(equipment || equipmentFromGeojson('transformer'), is('transformer')));

if (equipment) {
  write('switches.json', buildEquipment(equipment, is('switch')));
  write('compensators.json', buildEquipment(equipment, is('compensator', 'converter')));
  write('generators.json', buildEquipment(equipment, is('generator')));
  write('plant-sites.json', buildEquipment(equipment, is('plant')));
  write('portals.json', buildEquipment(equipment, is('portal', 'terminal', 'insulator')));
  write('towers.json', buildEquipment(equipment, (tags) => tags.power === 'tower' && !isTransition(tags)));
  write('transition-towers.json', buildEquipment(equipment, (tags) => tags.power === 'tower' && isTransition(tags)));
  write('poles.json', buildEquipment(equipment, (tags) => tags.power === 'pole' && !isTransition(tags)));
  write('transition-poles.json', buildEquipment(equipment, (tags) => tags.power === 'pole' && isTransition(tags)));
} else {
  console.warn(
    'data/osm/malaysia_power_equipment.json not found — run `node scripts/download-power-equipment.mjs` to refresh ' +
      'switchgear, generators and line supports. Existing files were left as they are.'
  );
}
