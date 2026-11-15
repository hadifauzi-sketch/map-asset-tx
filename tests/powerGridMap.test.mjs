import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeGridRecord, gridRecordColor, lineWidthForVoltage } from '../lib/globe3d/powerGrid.js';
import {
  DEFAULT_POWER_GRID_STATE,
  POWER_GRID_LAYER_IDS,
  POWER_GRID_STORAGE_KEY,
  countActiveGridLayers,
  gridPopupHtml,
  readPowerGridState,
  writePowerGridState,
} from '../lib/powerGridMap.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); }, data };
};

test('power grid state round-trips and ignores junk', () => {
  const storage = memoryStorage();
  assert.deepEqual(readPowerGridState(storage), DEFAULT_POWER_GRID_STATE);
  writePowerGridState({ ...DEFAULT_POWER_GRID_STATE, substations: true, powerLines: true }, storage);
  const state = readPowerGridState(storage);
  assert.equal(state.substations, true);
  assert.equal(state.powerLines, true);
  assert.equal(countActiveGridLayers(state), 2);

  const junk = memoryStorage({ [POWER_GRID_STORAGE_KEY]: '{"substations":"yes","bogus":true,"powerCables":true}' });
  const cleaned = readPowerGridState(junk);
  assert.deepEqual(Object.keys(cleaned), POWER_GRID_LAYER_IDS);
  assert.equal(cleaned.substations, false);
  assert.equal(cleaned.powerCables, true);

  assert.deepEqual(readPowerGridState(memoryStorage({ [POWER_GRID_STORAGE_KEY]: 'not json' })), DEFAULT_POWER_GRID_STATE);
  assert.deepEqual(readPowerGridState({ getItem() { throw new Error('blocked'); } }), DEFAULT_POWER_GRID_STATE);
  assert.doesNotThrow(() => writePowerGridState({}, { setItem() { throw new Error('quota'); } }));
});

test('describeGridRecord builds the shared info cards', () => {
  const substation = describeGridRecord('substations', {
    name: 'PMU Salak Selatan', kind: 'transmission', voltage: '275000;132000', operator: 'TNB', osm: 'way/1',
  });
  assert.equal(substation.kind, 'Substation');
  assert.equal(substation.title, 'PMU Salak Selatan');
  assert.deepEqual(substation.rows[0], ['Type', 'Transmission']);
  assert.deepEqual(substation.rows[1], ['Voltage', '275 / 132 kV']);

  const line = describeGridRecord('powerLines', { voltage: '500000', cables: '6', osm: 'way/2' });
  assert.equal(line.title, '500 kV power line');
  assert.equal(describeGridRecord('powerCables', {}).title, 'Cable');
  assert.equal(describeGridRecord('powerPlants', { name: 'Jimah' }).title, 'Jimah');
  assert.equal(gridRecordColor('powerPlants', { fuel: 'Coal' }), '#000000');

  assert.equal(gridRecordColor('powerLines', { voltage: '132000' }), '#60a5fa');
  assert.equal(gridRecordColor('substations', {}), '#a78bfa');
  assert.equal(lineWidthForVoltage('500000', 2), 3.5);
  assert.equal(lineWidthForVoltage('', 2), 2);
});

test('gridPopupHtml escapes values and drops empty rows', () => {
  const html = gridPopupHtml({ kind: 'Substation', title: '<b>A&B</b>', rows: [['Voltage', ''], ['Operator', 'T"N"B']] }, '#a78bfa');
  assert.match(html, /&lt;b&gt;A&amp;B&lt;\/b&gt;/);
  assert.match(html, /T&quot;N&quot;B/);
  assert.doesNotMatch(html, /Voltage/);
  assert.match(html, /background:#a78bfa/);
});
