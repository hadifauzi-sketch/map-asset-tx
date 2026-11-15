import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEFAULT_DC_SETTINGS, dataCentreBreakdown, filterDataCentres, readDataCentreSettings, summarizeDataCentres,
} from '../lib/dataCentres.js';

const snapshot = JSON.parse(readFileSync(new URL('../public/data/data-centres-malaysia.json', import.meta.url), 'utf8'));
const rows = snapshot.rows;

test('breakdown total MW matches the tracker summary and every cell adds up', () => {
  const breakdown = dataCentreBreakdown(rows);
  assert.equal(Math.round(breakdown.total.mw), Math.round(summarizeDataCentres(rows).totalMw));
  assert.equal(breakdown.total.campuses, rows.length);

  const statusSum = breakdown.statuses.reduce((sum, entry) => sum + entry.mw, 0);
  assert.equal(Math.round(statusSum), Math.round(breakdown.total.mw));
  const categorySum = breakdown.categories.reduce((sum, entry) => sum + entry.mw, 0);
  assert.equal(Math.round(categorySum), Math.round(breakdown.total.mw));
  const basisSum = breakdown.basis.reduce((sum, entry) => sum + entry.mw, 0);
  assert.equal(Math.round(basisSum), Math.round(breakdown.total.mw));

  for (const category of breakdown.categories) {
    const rowSum = Object.values(category.cells).reduce((sum, cell) => sum + cell.mw, 0);
    assert.equal(Math.round(rowSum), Math.round(category.mw), category.id);
  }
});

test('status MW in the breakdown equals filtering the map by that status', () => {
  const breakdown = dataCentreBreakdown(rows);
  for (const entry of breakdown.statuses) {
    const selected = filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, status: entry.id });
    assert.equal(entry.campuses, selected.length, entry.id);
    assert.equal(Math.round(entry.mw), Math.round(summarizeDataCentres(selected).totalMw), entry.id);
  }
});

test('state chips count campuses and the state filter keeps only that state', () => {
  const { states } = dataCentreBreakdown(rows);
  assert.equal(states.reduce((sum, [, total]) => sum + total, 0), rows.filter((row) => row.state).length);
  const [topState, topCount] = states[0];
  const selected = filterDataCentres(rows, { ...DEFAULT_DC_SETTINGS, state: topState });
  assert.equal(selected.length, topCount);
  assert.ok(selected.every((row) => row.state === topState));
});

test('the state filter is saved and restored with the other data centre settings', () => {
  const stored = new Map();
  const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  stored.set('tx-map-data-centres-v3', JSON.stringify({ ...DEFAULT_DC_SETTINGS, state: 'Johor' }));
  assert.equal(readDataCentreSettings(storage).state, 'Johor');
  stored.set('tx-map-data-centres-v3', JSON.stringify({ ...DEFAULT_DC_SETTINGS, state: 42 }));
  assert.equal(readDataCentreSettings(storage).state, '');
});
