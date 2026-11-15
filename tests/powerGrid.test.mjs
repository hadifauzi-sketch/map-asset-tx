import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  GRID_FILES,
  GRID_SYMBOL_LAYERS,
  UNKNOWN_VOLTAGE_COLOR,
  clearGridCache,
  describeGridRecord,
  formatOutput,
  formatVoltage,
  formatVoltageChain,
  gridHoverText,
  humanizeTag,
  loadGridLayer,
  osmLink,
  parseVoltageKv,
  rowsToRecords,
  voltageColor,
} from '../lib/globe3d/powerGrid.js';
import { GRID_SYMBOLS, gridSymbolFor, sourceColor } from '../lib/gridSymbols.js';
import { POWER_GRID_GROUPS, POWER_GRID_MAP_LAYERS } from '../lib/powerGridMap.js';

test('every menu layer belongs to a known section and symbol layers name a symbol', () => {
  const groups = new Set(POWER_GRID_GROUPS.map((group) => group.id));
  for (const layer of POWER_GRID_MAP_LAYERS) {
    assert.ok(groups.has(layer.group), `${layer.id} group`);
    if (layer.shape === 'symbol') {
      assert.ok(GRID_SYMBOLS[layer.swatch], `${layer.id} swatch`);
      assert.ok(GRID_SYMBOL_LAYERS.has(layer.id), `${layer.id} drawn as symbols`);
    }
  }
});

test('parseVoltageKv reads OSM volt text, multi-values and kV text', () => {
  assert.deepEqual(parseVoltageKv('275000'), [275]);
  assert.deepEqual(parseVoltageKv('275000;275000;132000;132000'), [275, 132]);
  assert.deepEqual(parseVoltageKv('300000;0'), [300]);
  assert.deepEqual(parseVoltageKv('33 kV'), [33]);
  assert.deepEqual(parseVoltageKv('11000'), [11]);
  assert.deepEqual(parseVoltageKv(''), []);
  assert.deepEqual(parseVoltageKv(undefined), []);
  assert.deepEqual(parseVoltageKv('unknown'), []);
});

test('formatVoltage and voltageColor follow the highest voltage', () => {
  assert.equal(formatVoltage('275000;132000'), '275 / 132 kV');
  assert.equal(formatVoltage(''), '');
  assert.equal(voltageColor('500000'), '#f43f5e');
  assert.equal(voltageColor('275000;132000'), '#fb923c');
  assert.equal(voltageColor('132000'), '#60a5fa');
  assert.equal(voltageColor('33000'), '#4ade80');
  assert.equal(voltageColor(''), UNKNOWN_VOLTAGE_COLOR);
});

test('humanizeTag and rowsToRecords', () => {
  assert.equal(humanizeTag('minor_distribution'), 'Minor distribution');
  assert.equal(humanizeTag(''), '');
  assert.deepEqual(rowsToRecords({ fields: ['a', 'b'], rows: [[1, 2]] }), [{ a: 1, b: 2 }]);
  assert.deepEqual(rowsToRecords(null), []);
});

test('loadGridLayer fetches once, caches, and retries after a failure', async () => {
  clearGridCache();
  let calls = 0;
  const ok = async (url) => {
    calls += 1;
    assert.equal(url, '/app/data/grid/cables.json');
    return { ok: true, json: async () => ({ fields: ['x'], rows: [[1]] }) };
  };
  assert.deepEqual(await loadGridLayer('powerCables', { baseUrl: '/app/', fetchImpl: ok }), [{ x: 1 }]);
  await loadGridLayer('powerCables', { baseUrl: '/app/', fetchImpl: ok });
  assert.equal(calls, 1);

  clearGridCache();
  const failing = async () => ({ ok: false, status: 404, statusText: 'Not Found' });
  await assert.rejects(loadGridLayer('powerLines', { fetchImpl: failing }), /404/);
  await new Promise((resolve) => setImmediate(resolve));
  const recovered = await loadGridLayer('powerLines', {
    fetchImpl: async () => ({ ok: true, json: async () => ({ fields: [], rows: [] }) }),
  });
  assert.deepEqual(recovered, []);
  await assert.rejects(loadGridLayer('nope'), /Unknown grid layer/);
});

test('formatVoltageChain keeps transformer winding order like OpenInfraMap', () => {
  assert.equal(formatVoltageChain('500000;275000'), '500/275 kV');
  assert.equal(formatVoltageChain('275000;132000;33000'), '275/132/33 kV');
  assert.equal(formatVoltageChain('11000;415'), '11/0.415 kV');
  assert.equal(formatVoltageChain('33 kV;11 kV'), '33/11 kV');
  assert.equal(formatVoltageChain(''), '');
  assert.equal(formatOutput('650 MW'), '650 MW');
  assert.equal(formatOutput('1.5MW'), '1.5 MW');
  assert.equal(formatOutput('yes'), '');
  assert.deepEqual(osmLink('node/1'), { href: 'https://www.openstreetmap.org/node/1', label: 'Open in OpenStreetMap' });
  assert.equal(osmLink('bogus'), null);
});

test('the 500/275 kV transformer at node/13324672658 keeps both windings', () => {
  const payload = JSON.parse(readFileSync(new URL('../public/data/grid/transformers.json', import.meta.url), 'utf8'));
  const [record] = rowsToRecords(payload).filter((item) => item.osm === 'node/13324672658');
  assert.ok(record, 'transformer present');
  const card = describeGridRecord('mappedTransformers', record);
  assert.equal(card.title, '500/275 kV transformer');
  assert.deepEqual(card.rows.find(([label]) => label === 'Voltage'), ['Voltage', '500/275 kV']);
  assert.deepEqual(card.rows.find(([label]) => label === 'Type'), ['Type', 'Main (power)']);
  assert.equal(card.link.href, 'https://www.openstreetmap.org/node/13324672658');
});

test('every equipment layer has symbols and a sensible hover text', () => {
  assert.equal(gridSymbolFor('powerTowers', {}), 'tower');
  assert.equal(gridSymbolFor('transitionTowers', {}), 'transitionTower');
  assert.equal(gridSymbolFor('powerPoles', {}), 'pole');
  assert.equal(gridSymbolFor('transitionPoles', {}), 'transitionPole');
  assert.equal(gridSymbolFor('mappedTransformers', { kind: 'main' }), 'transformer');
  assert.equal(gridSymbolFor('mappedTransformers', { kind: 'main', tags: { 'voltage:tertiary': '33000' } }), 'transformer3');
  assert.equal(gridSymbolFor('mappedTransformers', { kind: 'current' }), 'currentTransformer');
  assert.equal(gridSymbolFor('switches', { kind: 'circuit_breaker' }), 'circuitBreaker');
  assert.equal(gridSymbolFor('switches', { kind: 'disconnector' }), 'disconnector');
  assert.equal(gridSymbolFor('compensators', { kind: 'shunt_reactor' }), 'shuntReactor');
  assert.equal(gridSymbolFor('compensators', { kind: 'converter' }), 'converter');
  assert.equal(gridSymbolFor('portals', { kind: 'terminal' }), 'terminal');
  for (const layerId of GRID_SYMBOL_LAYERS) {
    const symbol = gridSymbolFor(layerId, {});
    assert.ok(GRID_SYMBOLS[symbol], `${layerId} -> ${symbol}`);
    assert.ok(GRID_FILES[layerId], `${layerId} has a data file`);
  }
  assert.equal(sourceColor('gas'), sourceColor('natural_gas'));
  assert.equal(gridHoverText('powerTowers', { ref: 'T42' }), 'Tower T42');
  assert.equal(gridHoverText('powerTowers', {}), '');
  assert.equal(gridHoverText('substations', { name: 'PMU X' }), 'PMU X');
  assert.equal(
    describeGridRecord('generators', { kind: 'gas', tags: { 'generator:source': 'gas', 'generator:output:electricity': '650 MW' } }).title,
    '650 MW gas generator'
  );
});

test('generated grid files exist and match the source counts', () => {
  const expected = {
    substations: 4993,
    mappedTransformers: 475,
    powerLines: 2873,
    minorLines: 44,
    powerCables: 38,
  };
  for (const [layerId, file] of Object.entries(GRID_FILES)) {
    const payload = JSON.parse(readFileSync(new URL(`../public/data/grid/${file}`, import.meta.url), 'utf8'));
    if (layerId in expected) {
      assert.equal(payload.rows.length, expected[layerId], file);
    } else {
      assert.ok(payload.rows.length > 0, `${file} has rows`);
    }
    for (const row of payload.rows) {
      const coords = payload.fields.includes('coords') ? row[payload.fields.indexOf('coords')] : [row[0], row[1]];
      assert.ok(coords.length >= 2 && coords.length % 2 === 0, `${file} coords`);
      for (let index = 0; index < coords.length; index += 2) {
        assert.ok(coords[index] > 95 && coords[index] < 125, `${file} lon ${coords[index]}`);
        assert.ok(coords[index + 1] > -5 && coords[index + 1] < 10, `${file} lat ${coords[index + 1]}`);
      }
    }
  }
});
