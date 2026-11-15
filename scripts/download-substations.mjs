// Downloads every OpenStreetMap substation in a country to a CSV file, ready to
// import into a database table.
//
//   node scripts/download-substations.mjs [ISO2]      (default: MY)
//
// Output: data/substations-<iso2>.csv  (kept outside public/, so it is not deployed)
// Data © OpenStreetMap contributors, ODbL — https://www.openstreetmap.org/copyright

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const country = (process.argv[2] || 'MY').toUpperCase();
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const query =
  `[out:json][timeout:300];area["ISO3166-1"="${country}"][admin_level=2]->.a;` +
  `nwr["power"="substation"](area.a);out center tags;`;

async function download() {
  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`Querying ${endpoint} …`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'substation-export-script/1.0' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(330000),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.remark) {
        throw new Error(data.remark);
      }
      return data;
    } catch (error) {
      lastError = error;
      console.log(`  failed: ${error.message}`);
    }
  }
  throw lastError;
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** "132000;33000" -> 132 (highest voltage in kV), or '' when not tagged. */
function maxVoltageKv(voltage) {
  const volts = String(voltage || '')
    .split(/[;,/]/)
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value) && value > 0);
  return volts.length ? Math.max(...volts) / 1000 : '';
}

const data = await download();
const columns = ['osm_id', 'osm_type', 'name', 'latitude', 'longitude', 'voltage', 'max_voltage_kv', 'operator', 'substation_type', 'ref', 'osm_timestamp'];
const seen = new Set();
const rows = [];
for (const element of data.elements || []) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const key = `${element.type}/${element.id}`;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || seen.has(key)) {
    continue;
  }
  seen.add(key);
  const tags = element.tags || {};
  rows.push([
    element.id,
    element.type,
    tags.name || tags['name:en'] || tags['name:ms'] || '',
    latitude.toFixed(7),
    longitude.toFixed(7),
    tags.voltage || '',
    maxVoltageKv(tags.voltage),
    tags.operator || '',
    tags.substation || '',
    tags.ref || '',
    data.osm3s?.timestamp_osm_base || '',
  ]);
}
rows.sort((left, right) => String(left[2]).localeCompare(String(right[2])) || left[0] - right[0]);

const target = resolve(root, `data/substations-${country.toLowerCase()}.csv`);
mkdirSync(dirname(target), { recursive: true });
// UTF-8 with BOM so Excel shows Malay / Chinese names correctly.
writeFileSync(target, `﻿${[columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
console.log(`${country}: ${rows.length} substations -> ${target}`);
