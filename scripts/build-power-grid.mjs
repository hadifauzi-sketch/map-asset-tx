// Builds the compact grid files that the 3D view's "Power grid" layers load:
//
//   public/data/grid/substations.json   4,993 sites  -> one point each
//   public/data/grid/transformers.json    475 mapped transformers -> one point each
//   public/data/grid/lines.json          power=line segments
//   public/data/grid/minor-lines.json    power=minor_line segments
//   public/data/grid/cables.json         power=cable segments
//
//   node scripts/build-power-grid.mjs
//
// Source: public/data/Malaysia_Power_Map/malaysia_<layer>.geojson (OpenStreetMap
// export, © OpenStreetMap contributors, ODbL 1.0). The browser never loads those
// raw files: the output keeps only the tags the map shows, rounds coordinates to
// 5 decimals (~1 m) and stores them as flat arrays, so each layer is one small
// JSON fetch that can be turned into Cesium primitives without any parsing work.
//
// Output shape: { fields: [...], rows: [[...], ...], source, license, timestamp }
//   points: [lon, lat, name, voltage, operator, kind, osmKey]
//   lines:  [voltage, name, operator, cables, circuits, osmKey, [lon, lat, lon, lat, ...]]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'public/data/Malaysia_Power_Map');
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

function buildPoints(name, kindOf) {
  const collection = readCollection(name);
  const rows = [];
  for (const feature of collection.features) {
    const point = representativePoint(feature.geometry);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      continue;
    }
    const props = feature.properties || {};
    rows.push([
      round(point[0]),
      round(point[1]),
      text(props.name || props['name:en'] || props['name:ms'] || props.ref),
      text(props.voltage || props['voltage:primary']),
      text(props.operator),
      kindOf(props),
      osmKey(props),
    ]);
  }
  return { meta: collection, fields: ['lon', 'lat', 'name', 'voltage', 'operator', 'kind', 'osm'], rows };
}

function buildLines(name) {
  const collection = readCollection(name);
  const rows = [];
  for (const feature of collection.features) {
    const props = feature.properties || {};
    for (const flat of lineParts(feature.geometry)) {
      rows.push([
        text(props.voltage),
        text(props.name || props['name:en'] || props.ref),
        text(props.operator),
        text(props.cables),
        text(props.circuits),
        osmKey(props),
        flat,
      ]);
    }
  }
  return {
    meta: collection,
    fields: ['voltage', 'name', 'operator', 'cables', 'circuits', 'osm', 'coords'],
    rows,
  };
}

function write(file, { meta, fields, rows }) {
  const payload = {
    source: '© OpenStreetMap contributors',
    license: meta.license || 'ODbL-1.0',
    timestamp: meta.source_timestamp || null,
    fields,
    rows,
  };
  const target = resolve(targetDir, file);
  writeFileSync(target, `${JSON.stringify(payload)}\n`);
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`${file.padEnd(18)} ${String(rows.length).padStart(5)} rows  ${kb.padStart(5)} KB`);
}

mkdirSync(targetDir, { recursive: true });

write('substations.json', buildPoints('substation', (props) => text(props.substation)));
write('transformers.json', buildPoints('transformer', (props) => text(props.transformer)));
write('lines.json', buildLines('line'));
write('minor-lines.json', buildLines('minor_line'));
write('cables.json', buildLines('cable'));
