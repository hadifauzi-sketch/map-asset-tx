// Import Ringmast4r's deduplicated list, pinning the source commit.
// node scripts/build-data-centres.mjs [--input file.json] [--ref commit-sha]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const repository = 'Ringmast4r/Global-Data-Center-Map';
const hasArg = (name) => process.argv.includes(name);
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const get = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'Asset-TX-data-importer' } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}: ${url}`);
  return response.text();
};
const commit = hasArg('--ref') ? arg('--ref') : JSON.parse(await get(`https://api.github.com/repos/${repository}/commits/main`)).sha;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected a pinned 40-character source commit.');
const rawUrl = `https://raw.githubusercontent.com/${repository}/${commit}`;
const raw = hasArg('--input') ? await readFile(arg('--input'), 'utf8') : await get(`${rawUrl}/datacenters.json`);
const source = JSON.parse(raw.replace(/^\uFEFF/, ''));
if (!Array.isArray(source) || !source.length) throw new Error('Expected the deduplicated facility array.');
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const key = (value) => clean(value).normalize('NFKC').toLocaleLowerCase('en').replace(/[’']/g, '').replace(/\s+/g, ' ');
const countries = new Map();
// Normalise names and ISO codes, without inferring a country from an address.
for (const locale of ['en', 'nl', 'fi', 'pt', 'da', 'bg', 'zh', 'ru', 'fr']) {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const english = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    const name = english.of(code);
    if (name === code || ['Unknown Region', 'Outlying Oceania', 'European Union', 'Eurozone'].includes(name)) continue;
    countries.set(key(names.of(code)), name);
    countries.set(key(code), name);
  }
}
for (const [alias, name] of Object.entries({
  'Hong Kong': 'Hong Kong SAR China', Macau: 'Macao SAR China', Macao: 'Macao SAR China',
  Congo: 'Congo - Brazzaville', 'Ivory Coast': 'Côte d’Ivoire', Macedonia: 'North Macedonia',
  Swaziland: 'Eswatini', 'The Gambia': 'Gambia', 'Cabo Verde': 'Cape Verde', 'La Réunion': 'Réunion',
  USA: 'United States', UK: 'United Kingdom', UAE: 'United Arab Emirates',
})) countries.set(key(alias), name);
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const ids = new Map();
const rows = source.map((entry) => {
  if (!clean(entry.name)) throw new Error('Facility has no name.');
  const [latitude, longitude] = Array.isArray(entry.city_coords) && entry.city_coords.length === 2 ? entry.city_coords.map(number) : [null, null];
  const mapped = latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const hash = createHash('sha256').update(JSON.stringify(entry)).digest('hex').slice(0, 20);
  const occurrence = (ids.get(hash) || 0) + 1;
  ids.set(hash, occurrence);
  const sourceCountry = clean(entry.country);
  const capacity = number(entry.capacity_mw);
  return { id: `ring-${hash}${occurrence > 1 ? `-${occurrence}` : ''}`, name: clean(entry.name),
    company: clean(entry.company) || 'Not recorded', country: countries.get(key(sourceCountry)) || 'Not recorded', sourceCountry,
    city: clean(entry.city), state: clean(entry.state), address: clean(entry.address), street: clean(entry.street), postcode: clean(entry.zip),
    status: ['Operating', 'Planned', 'Canceled'].includes(entry.status) ? entry.status : 'Undisclosed',
    capacityMw: capacity !== null && capacity >= 0 ? capacity : null,
    mapped, latitude: mapped ? latitude : null, longitude: mapped ? longitude : null,
    approximate: mapped, precision: mapped ? 'Source coordinates; precision varies' : 'No source coordinates',
  };
});
const metadata = {
  schemaVersion: 2, source: 'Ringmast4r', sourceUrl: `https://github.com/${repository}`,
  sourceFile: 'datacenters.json', sourceCommit: commit,
  sourceDataSha256: createHash('sha256').update(raw).digest('hex'), importedAt: new Date().toISOString(),
  license: 'Attribution required', licenseUrl: `https://github.com/${repository}/blob/${commit}/LICENSE`,
  attribution: 'Data centers (c) Ringmast4r - Global-Data-Center-Map',
  counts: { facilities: rows.length, mapped: rows.filter((row) => row.mapped).length,
    countries: new Set(rows.filter((row) => row.country !== 'Not recorded').map((row) => row.country)).size,
    operators: new Set(rows.filter((row) => row.company !== 'Not recorded').map((row) => row.company)).size },
  transformations: 'Country names and numeric coordinate strings normalised; original country values retained. Missing coordinates, MW and statuses are not inferred. Source coordinates can be city, state or country centroids.',
};
const target = fileURLToPath(new URL('../public/data/data-centres-global.json', import.meta.url));
const licenseTarget = fileURLToPath(new URL('../public/data/data-centres-LICENSE.txt', import.meta.url));
const license = hasArg('--license') ? await readFile(arg('--license'), 'utf8') : await get(`${rawUrl}/LICENSE`);
await writeFile(licenseTarget, license);
await writeFile(target, `${JSON.stringify({ metadata, rows })}\n`);
console.log(JSON.stringify({ ...metadata.counts, malaysia: rows.filter((row) => row.country === 'Malaysia').length,
  malaysiaMapped: rows.filter((row) => row.country === 'Malaysia' && row.mapped).length, commit, target }));
