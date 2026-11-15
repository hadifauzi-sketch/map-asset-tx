// Downloads every OpenStreetMap power equipment point in Malaysia — the detail
// OpenInfraMap draws inside substations and along lines — from the Overpass API:
//
//   switchgear:    transformer, switch, compensator, converter
//   generation:    generator, plant
//   line supports: tower, pole (incl. transition towers / poles)
//   terminations:  portal, terminal, insulator
//
//   node scripts/download-power-equipment.mjs      (then: npm run globe:grid)
//
// Output: data/osm/malaysia_power_equipment.json (raw Overpass JSON, every tag
// kept, ways/relations reduced to their centre point). It is git-ignored;
// scripts/build-power-grid.mjs turns it into the small files the map loads.
// Data © OpenStreetMap contributors, ODbL 1.0.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'data/osm/malaysia_power_equipment.json');

export const EQUIPMENT_POWER_VALUES = [
  'transformer',
  'switch',
  'compensator',
  'converter',
  'generator',
  'plant',
  'tower',
  'pole',
  'portal',
  'terminal',
  'insulator',
];

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const query =
  '[out:json][timeout:900];' +
  'area["ISO3166-1"="MY"]["admin_level"="2"]->.a;' +
  `nwr["power"~"^(${EQUIPMENT_POWER_VALUES.join('|')})$"](area.a);` +
  'out center tags qt;';

async function fetchFrom(endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'tx-asset-map-grid-build/1.0' },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.elements)) {
    throw new Error(payload.remark || 'response has no elements');
  }
  return payload;
}

async function main() {
  let payload = null;
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`Querying ${endpoint} …`);
      payload = await fetchFrom(endpoint);
      break;
    } catch (error) {
      console.warn(`  failed: ${error.message}`);
    }
  }
  if (!payload) {
    throw new Error('Every Overpass endpoint failed; try again later.');
  }
  if (payload.remark) {
    console.warn(`Overpass remark: ${payload.remark}`);
  }

  const counts = {};
  for (const element of payload.elements) {
    const key = element.tags?.power || '?';
    counts[key] = (counts[key] || 0) + 1;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    `${JSON.stringify({
      source: 'OpenStreetMap contributors via Overpass API',
      license: 'ODbL-1.0',
      timestamp: payload.osm3s?.timestamp_osm_base || null,
      query,
      elements: payload.elements,
    })}\n`
  );
  console.log(`Saved ${payload.elements.length.toLocaleString()} elements to ${target}`);
  for (const [power, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${power.padEnd(12)} ${String(count).padStart(6)}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
