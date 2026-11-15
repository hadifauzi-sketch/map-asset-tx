// Import the independently researched Malaysia tracker, without executing HTML.
// node scripts/build-malaysia-data-centres.mjs [--input source.html]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { groupMalaysiaCampuses, MALAYSIA_DC_SOURCE } from '../lib/malaysiaDataCentres.js';
const input = process.argv.indexOf('--input');
let html;
if (input >= 0) html = await readFile(process.argv[input + 1], 'utf8');
else {
  const response = await fetch(MALAYSIA_DC_SOURCE, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Malaysia tracker returned HTTP ${response.status}`);
  html = await response.text();
}
const declaration = /\bconst DATA\s*=\s*/.exec(html);
if (!declaration) throw new Error('Published site DATA not found.');
const start = declaration.index + declaration[0].length;
let depth = 0;
let quoted = false;
let escaped = false;
let end = start;
for (; end < html.length; end++) {
  const char = html[end];
  if (quoted) {
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') quoted = false;
  } else if (char === '"') quoted = true;
  else if (char === '{' || char === '[') depth++;
  else if ((char === '}' || char === ']') && --depth === 0) { end++; break; }
}
const raw = html.slice(start, end);
const data = JSON.parse(raw);
if (data.type !== 'FeatureCollection' || !data.features?.length) throw new Error('Invalid site FeatureCollection.');
const phases = data.features.map(({ properties, geometry }) => {
  if (!properties.record_id || !properties.project || !Number.isFinite(properties.mw_net) || properties.mw_net < 0) throw new Error('Invalid phase record.');
  const coordinates = geometry?.type === 'Point' ? geometry.coordinates : null;
  const mapped = properties.on_map === 'yes' && coordinates?.length === 2
    && Number.isFinite(coordinates[0]) && Math.abs(coordinates[0]) <= 180
    && Number.isFinite(coordinates[1]) && Math.abs(coordinates[1]) <= 90;
  return { ...properties, mapped: Boolean(mapped), latitude: mapped ? coordinates[1] : null, longitude: mapped ? coordinates[0] : null };
});
if (new Set(phases.map((phase) => phase.record_id)).size !== phases.length) throw new Error('Duplicate phase IDs.');
const rows = groupMalaysiaCampuses(phases);
const metadata = { schemaVersion: 3, sourceId: 'seafic', source: 'SEAFIC', sourceUrl: MALAYSIA_DC_SOURCE,
  sourceUpdated: /Updated\s+([A-Za-z]+\s+\d{4})/.exec(html)?.[1] || '',
  importedAt: new Date().toISOString(), sourceDataSha256: createHash('sha256').update(raw).digest('hex'),
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Site data © SEAFIC; compiled and designed by Seow E Kin Zane Ryan; location credit Ringmast4r.',
  attributionFile: 'data/malaysia-data-centres-ATTRIBUTION.md',
  counts: { campuses: rows.length, phases: phases.length, mapped: rows.filter((row) => row.mapped).length,
    netMw: Math.round(phases.reduce((sum, phase) => sum + phase.mw_net, 0) * 10) / 10 },
  transformations: 'Grouped phases by public campus ID, retaining source net MW, first mapped coordinates, precision and check dates. No identities matched to the global directory.',
};
await writeFile(new URL('../public/data/data-centres-malaysia.json', import.meta.url), `${JSON.stringify({ metadata, rows }, null, 2)}\n`);
console.log(JSON.stringify(metadata.counts));
