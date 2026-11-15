import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DATA_CENTRE_CREDIT, DATA_CENTRE_SOURCE, DEFAULT_DC_SETTINGS, dataCentreColor, dataCentreCountryOptions, dataCentreSource,
  dataCentreMarkerSvg, dataCentresCsv, describeDataCentre, filterDataCentres, formatDataCentreMw,
  readDataCentreSettings, summarizeDataCentres, writeDataCentreSettings,
} from '../lib/dataCentres.js';
import { gridPopupHtml } from '../lib/powerGridMap.js';
import { addDataCentreLayer } from '../components/globe3d/dataCentreLayer.js';

const { metadata, rows } = JSON.parse(readFileSync(new URL('../public/data/data-centres-global.json', import.meta.url), 'utf8'));
const globalSettings = { ...DEFAULT_DC_SETTINGS, source: 'ringmast4r' };
const malaysia = filterDataCentres(rows, globalSettings);
const malaysiaSnapshot = JSON.parse(readFileSync(new URL('../public/data/data-centres-malaysia.json', import.meta.url), 'utf8'));

test('Ringmast4r snapshot preserves the full deduplicated list with provenance and licence', () => {
  assert.equal(rows.length, 18110);
  assert.equal(new Set(rows.map((row) => row.id)).size, 18110);
  assert.equal(rows.filter((row) => row.mapped).length, 6131);
  assert.equal(metadata.source, 'Ringmast4r');
  assert.equal(metadata.sourceFile, 'datacenters.json');
  assert.match(metadata.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(metadata.sourceDataSha256, /^[a-f0-9]{64}$/);
  assert.match(metadata.attribution, /Ringmast4r/);
  const license = readFileSync(new URL('../public/data/data-centres-LICENSE.txt', import.meta.url), 'utf8');
  assert.match(license, /ATTRIBUTION IS REQUIRED/);
  assert.match(license, /Copyright \(c\) 2025-2026 Ringmast4r/);
  assert.doesNotMatch(JSON.stringify(metadata), /SEAFIC|Seow E Kin|CC BY/);
});

test('Ringmast4r Malaysia entries remain unaltered and have no fabricated MW or build status', () => {
  assert.equal(malaysia.length, 129);
  assert.equal(malaysia.filter((row) => row.mapped).length, 28);
  assert.ok(malaysia.every((row) => row.status === 'Undisclosed' && row.capacityMw === null));
  assert.ok(malaysia.some((row) => row.name === 'CX2'));
  assert.equal(filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, country: '' }).length, 18110);
});

test('coordinates are numeric, correctly ordered and never inferred for unlocated records', () => {
  for (const row of rows) {
    if (!row.mapped) { assert.equal(row.latitude, null); assert.equal(row.longitude, null); continue; }
    assert.ok(Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90);
    assert.ok(Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180);
    assert.equal(row.approximate, true);
  }
  const cx2 = malaysia.find((row) => row.name === 'CX2');
  assert.equal(cx2.latitude, 2.9203335);
  assert.equal(cx2.longitude, 101.6618386);
  const numericString = rows.find((row) => row.name === 'PAIX Accra');
  assert.equal(numericString.latitude, 5.57162888555143);
});

test('country normalisation retains original values and isolates malformed source country labels', () => {
  const malformed = rows.find((row) => row.sourceCountry === '200090');
  assert.ok(malformed);
  assert.equal(malformed.country, 'Not recorded');
  assert.equal(malformed.sourceCountry, '200090');
  const options = dataCentreCountryOptions(rows);
  assert.equal(options[0].value, '');
  assert.equal(options[1].value, 'Malaysia');
  assert.equal(options.at(-1).value, 'Not recorded');
  assert.equal(metadata.counts.countries, new Set(rows.filter((row) => row.country !== 'Not recorded').map((row) => row.country)).size);
});

test('region, operator, status, coordinate coverage and multiword search compose consistently', () => {
  const query = filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, query: 'NTT Cyberjaya' });
  assert.ok(query.length > 0);
  assert.ok(query.every((row) => `${row.name} ${row.company} ${row.address}`.toLowerCase().includes('cyberjaya')));
  const mapped = filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, location: 'mapped' });
  const unmapped = filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, location: 'unmapped' });
  assert.equal(mapped.length, 28);
  assert.equal(mapped.length + unmapped.length, 129);
  const planned = filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, country: '', status: 'Planned', operator: 'SB Energy' });
  assert.ok(planned.length > 0);
  assert.ok(planned.every((row) => row.status === 'Planned' && row.company === 'SB Energy'));
  assert.equal(filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, query: 'no-match-xyz987654321' }).length, 0);
});

test('summary counts facility records and disclosed fields without inventing aggregate capacity', () => {
  const summary = summarizeDataCentres(malaysia);
  assert.equal(summary.total, 129);
  assert.equal(summary.mapped, 28);
  assert.equal(summary.unmapped, 101);
  assert.equal(summary.capacityReported, 0);
  assert.equal(summary.statusCounts.get('Undisclosed'), 129);
  assert.equal(summarizeDataCentres(rows).capacityReported, 801);
  assert.equal(summarizeDataCentres(rows).operators, 4181);
  assert.equal(formatDataCentreMw(null), 'Undisclosed');
  assert.equal(formatDataCentreMw(120), '120 MW');
});

test('legacy settings migrate without carrying unsupported phase filters into the new source', () => {
  const stored = new Map([['tx-map-data-centres-v1', JSON.stringify({ enabled: true, panelOpen: true,
    colorBy: 'category', filters: { category: ['AI-ready'] }, markerScale: 1.3 })]]);
  const storage = { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  const migrated = readDataCentreSettings(storage);
  assert.equal(migrated.enabled, true);
  assert.equal(migrated.panelOpen, false);
  assert.equal(migrated.colorBy, 'status');
  assert.equal(migrated.country, 'Malaysia');
  assert.equal(migrated.markerScale, 1.3);
  assert.equal(migrated.filters, undefined);
  assert.equal(migrated.source, 'seafic');
  writeDataCentreSettings({ ...migrated, source: 'ringmast4r', country: '', operator: 'NTT', panelOpen: true, colorBy: 'operator' }, storage);
  const restored = readDataCentreSettings(storage);
  assert.equal(restored.country, '');
  assert.equal(restored.operator, 'NTT');
  assert.equal(restored.colorBy, 'operator');
  assert.equal(restored.panelOpen, false);
  assert.equal(restored.source, 'ringmast4r');
  stored.set('tx-map-data-centres-v3', '{bad json');
  assert.deepEqual(readDataCentreSettings(storage), DEFAULT_DC_SETTINGS);
});

test('markers use uniform size and stable colours, without claiming plot precision', () => {
  const facility = malaysia.find((row) => row.mapped);
  const svg = dataCentreMarkerSvg(facility, 'status');
  assert.match(svg.svg, /stroke-dasharray/);
  assert.equal(dataCentreMarkerSvg({ ...facility, capacityMw: 9000 }, 'status').size, svg.size);
  assert.ok(dataCentreMarkerSvg(facility, 'operator', 1.6).size > dataCentreMarkerSvg(facility, 'operator', 0.7).size);
  assert.equal(dataCentreColor(facility, 'operator'), dataCentreColor({ company: facility.company }, 'operator'));
});

test('visible attribution is compact and facility popups contain only the current source', () => {
  assert.match(DATA_CENTRE_CREDIT, />© Ringmast4r<\/a>/);
  assert.doesNotMatch(DATA_CENTRE_CREDIT, /SEAFIC|Seow|Data centre|Global-Data-Center-Map<\/a>/);
  const detail = describeDataCentre({ ...malaysia[0], name: '<img src=x onerror=alert(1)>' });
  assert.equal(detail.kind, 'Data centre');
  assert.equal(detail.link.label, 'Ringmast4r');
  assert.ok(!detail.rows.some(([label]) => label === 'Credit'));
  const html = gridPopupHtml(detail, '#28cfa4');
  assert.doesNotMatch(html, /<img|SEAFIC|Seow E Kin|CC BY/);
  assert.match(html, /&lt;img/);
  assert.match(html, /Ringmast4r/);
});

test('CSV exports the filtered directory, keeps source attribution, and preserves numeric coordinates', () => {
  const facility = { ...malaysia[0], name: '=HYPERLINK("bad")', company: '@untrusted', latitude: -1.5, longitude: 100 };
  const csv = dataCentresCsv([facility]);
  assert.match(csv, /^"Facility","Operator","Country"/);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'@untrusted/);
  assert.match(csv, /,"-1.5","100",/);
  assert.match(csv, /,"Ringmast4r",/);
  assert.ok(csv.includes(DATA_CENTRE_SOURCE));
});

test('3D plots only source coordinates and removes source and compact credit on teardown', () => {
  let source;
  let credits = 0;
  const viewer = { isDestroyed: () => false,
    dataSources: { add: (value) => { source = value; }, remove: () => { source = null; } },
    scene: { requestRender() {} }, creditDisplay: { addStaticCredit: () => { credits++; }, removeStaticCredit: () => { credits--; } } };
  const cleanup = addDataCentreLayer(viewer, malaysia, globalSettings);
  assert.equal(source.entities.values.length, 28);
  assert.equal(source.clustering.enabled, true);
  assert.ok(source.entities.values.every((entity) => entity.properties.refInfo.getValue().link.label === 'Ringmast4r'));
  assert.equal(credits, 1);
  cleanup();
  assert.equal(source, null);
  assert.equal(credits, 0);
});

test('Malaysia tracker is the default source and matches SEAFIC campus, phase, mapping and net MW totals', () => {
  assert.equal(DEFAULT_DC_SETTINGS.source, 'seafic');
  const selected = filterDataCentres(malaysiaSnapshot.rows, DEFAULT_DC_SETTINGS);
  const summary = summarizeDataCentres(selected);
  assert.equal(summary.total, 105);
  assert.equal(summary.phaseCount, 142);
  assert.equal(summary.mapped, 47);
  assert.equal(summary.unmapped, 58);
  assert.ok(Math.abs(summary.totalMw - 10607.1) < 0.001);
  assert.equal(malaysiaSnapshot.metadata.sourceUpdated, 'October 2026');
  assert.equal(malaysiaSnapshot.metadata.license, 'CC BY 4.0');
  assert.equal(new Set(selected.flatMap((row) => row.phases.map((phase) => phase.record_id))).size, 142);
});

test('missing Cyberjaya sites preserve the exact SEAFIC positions rather than guessed Ringmast4r matches', () => {
  for (const [name, latitude, longitude, mw] of [
    ['Site SEL-08', 2.93771, 101.65747, 100],
    ['Site SEL-05', 2.92729, 101.65855, 22],
    ['Site SEL-22', 2.93273, 101.65749, null],
  ]) {
    const campus = malaysiaSnapshot.rows.find((row) => row.name === name);
    assert.ok(campus.mapped);
    assert.equal(campus.latitude, latitude);
    assert.equal(campus.longitude, longitude);
    assert.equal(campus.capacityMw, mw);
    assert.equal(campus.source, 'seafic');
    assert.equal(campus.company, 'Not disclosed');
    assert.equal(campus.approximate, false);
    assert.equal(describeDataCentre(campus).dataCentre, campus);
    assert.equal(describeDataCentre(campus).link.label, 'SEAFIC');
  }
});

test('Malaysia phase status filters match the source counts and avoid counting campus ceilings twice', () => {
  const summary = summarizeDataCentres(malaysiaSnapshot.rows);
  const statuses = ['Operating', 'Under construction', 'Planned', 'Canceled'];
  assert.deepEqual(statuses.map((status) => summary.statusCounts.get(status)), [32, 29, 55, 2]);
  assert.deepEqual(statuses.map((status) => {
    const selected = filterDataCentres(malaysiaSnapshot.rows, { ...DEFAULT_DC_SETTINGS, status });
    return [selected.length, Math.round(summarizeDataCentres(selected).totalMw)];
  }), [[32, 1089], [29, 3058], [55, 6110], [2, 350]]);
  const campus = malaysiaSnapshot.rows.find((row) => row.name === 'Site SEL-05');
  assert.equal(campus.phases.reduce((sum, phase) => sum + (phase.mw || 0), 0), 31.7);
  assert.equal(campus.capacityMw, 22);
});

test('Malaysia precision, unlocated records and source credits remain accurate in both map layers', () => {
  const precise = malaysiaSnapshot.rows.find((row) => row.mapped && !row.approximate);
  const approximate = malaysiaSnapshot.rows.find((row) => row.mapped && row.approximate);
  assert.doesNotMatch(dataCentreMarkerSvg(precise, 'status').svg, /stroke-dasharray/);
  assert.match(dataCentreMarkerSvg(approximate, 'status').svg, /stroke-dasharray/);
  malaysiaSnapshot.rows.filter((row) => !row.mapped).forEach((row) => {
    assert.equal(row.latitude, null);
    assert.equal(row.longitude, null);
  });
  assert.match(dataCentreSource('seafic').credit, /SEAFIC/);
  assert.match(dataCentreSource('seafic').credit, /Ringmast4r/);
  assert.doesNotMatch(dataCentreSource('ringmast4r').credit, /SEAFIC/);
  assert.notEqual(dataCentreSource('seafic').file, dataCentreSource('ringmast4r').file);
  const csv = dataCentresCsv([precise]);
  assert.match(csv, /"SEAFIC"/);
  assert.match(csv, /"CC BY 4.0"/);
  let source;
  let credit;
  const viewer = { isDestroyed: () => false, dataSources: { add: (value) => { source = value; }, remove() {} },
    scene: { requestRender() {} }, creditDisplay: { addStaticCredit: (value) => { credit = value; }, removeStaticCredit() {} } };
  const cleanup = addDataCentreLayer(viewer, malaysiaSnapshot.rows, DEFAULT_DC_SETTINGS);
  assert.equal(source.entities.values.length, 47);
  assert.match(credit.html, /SEAFIC/);
  assert.ok(source.entities.values.every((entity) => entity.properties.refInfo.getValue().dataCentre.source === 'seafic'));
  cleanup();
});

test('existing GitHub-only preferences migrate to the restored Malaysia view without stale filters', () => {
  const stored = new Map([['tx-map-data-centres-v2', JSON.stringify({ enabled: true, country: 'Malaysia', status: 'Undisclosed', operator: 'NTT' })]]);
  const settings = readDataCentreSettings({ getItem: (key) => stored.get(key) });
  assert.equal(settings.source, 'seafic');
  assert.equal(settings.status, '');
  assert.equal(settings.operator, '');
  assert.equal(filterDataCentres(malaysiaSnapshot.rows, settings).filter((row) => row.mapped).length, 47);
});
