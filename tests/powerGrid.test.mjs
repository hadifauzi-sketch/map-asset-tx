import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  GRID_FILES,
  UNKNOWN_VOLTAGE_COLOR,
  clearGridCache,
  formatVoltage,
  humanizeTag,
  loadGridLayer,
  parseVoltageKv,
  rowsToRecords,
  voltageColor,
} from '../lib/globe3d/powerGrid.js';

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

test('generated grid files exist and match the source counts', () => {
  const expected = { substations: 4993, mappedTransformers: 475, powerLines: 2873, minorLines: 44, powerCables: 38 };
  for (const [layerId, file] of Object.entries(GRID_FILES)) {
    const payload = JSON.parse(readFileSync(new URL(`../public/data/grid/${file}`, import.meta.url), 'utf8'));
    assert.equal(payload.rows.length, expected[layerId], file);
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
