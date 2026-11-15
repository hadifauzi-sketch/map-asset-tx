// Builds public/data/power-plants-<iso3>.json for the 3D view's "Power stations"
// layer from the WRI Global Power Plant Database CSV.
//
//   node scripts/build-power-plants.mjs [ISO3 ...]     (default: MYS)
//
// Source CSV: public/data/global_power_plant_database.csv (v1.3.0, June 2021,
// CC BY 4.0 — https://datasets.wri.org/dataset/globalpowerplantdatabase).
// The browser only ever loads the small JSON this writes, never the 12 MB CSV.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = ['public/data/global_power_plant_database.csv', 'public/global_power_plant_database.csv']
  .map((path) => resolve(root, path))
  .find((path) => existsSync(path));
if (!source) {
  console.error('global_power_plant_database.csv not found in public/data/ or public/');
  process.exit(1);
}
const countries = process.argv.slice(2).map((code) => code.toUpperCase());
if (countries.length === 0) {
  countries.push('MYS');
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas in quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const [header, ...records] = parseCsv(readFileSync(source, 'utf8'));
const column = Object.fromEntries(header.map((name, index) => [name.trim(), index]));
const text = (record, name) => (record[column[name]] || '').trim();
const number = (record, name) => {
  const value = Number.parseFloat(text(record, name));
  return Number.isFinite(value) ? value : null;
};

/** Latest year with a value among `<prefix><year>` columns: { year, gwh } or null. */
function latestGeneration(record, prefix) {
  const years = header
    .map((name) => name.trim())
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length)))
    .filter(Number.isFinite)
    .sort((left, right) => right - left);
  for (const year of years) {
    const gwh = number(record, `${prefix}${year}`);
    if (gwh !== null) {
      return { year, gwh: Math.round(gwh * 100) / 100 };
    }
  }
  return null;
}

for (const country of countries) {
  const plants = records
    .filter((record) => record[column.country] === country)
    .map((record) => ({
      id: text(record, 'gppd_idnr'),
      name: text(record, 'name'),
      country: text(record, 'country_long'),
      latitude: Number(record[column.latitude]),
      longitude: Number(record[column.longitude]),
      capacityMw: number(record, 'capacity_mw'),
      fuel: text(record, 'primary_fuel'),
      otherFuels: ['other_fuel1', 'other_fuel2', 'other_fuel3'].map((name) => text(record, name)).filter(Boolean),
      owner: text(record, 'owner'),
      commissioned: Number.parseInt(text(record, 'commissioning_year'), 10) || null,
      source: text(record, 'source'),
      url: text(record, 'url'),
      reportedGeneration: latestGeneration(record, 'generation_gwh_'),
      estimatedGeneration: latestGeneration(record, 'estimated_generation_gwh_'),
    }))
    .filter((plant) => Number.isFinite(plant.latitude) && Number.isFinite(plant.longitude))
    .sort((left, right) => (right.capacityMw || 0) - (left.capacityMw || 0));

  const target = resolve(root, `public/data/power-plants-${country.toLowerCase()}.json`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(plants)}\n`);
  console.log(`${country}: ${plants.length} plants -> ${target}`);
}
