import assert from 'node:assert/strict';
import test from 'node:test';
import { getHiddenFuels, setHiddenFuels, subscribeHiddenFuels } from '../lib/hiddenFuelsStore.js';

test('hidden fuels keep legend order, drop unknown ids and duplicates', () => {
  setHiddenFuels(['Solar', 'Coal', 'Plutonium', 'Coal']);
  assert.deepEqual(getHiddenFuels(), ['Coal', 'Solar']);
  setHiddenFuels([]);
});

test('every subscriber (2D legend and 3D tab) hears one change', () => {
  let calls = 0;
  const stopA = subscribeHiddenFuels(() => { calls += 1; });
  const stopB = subscribeHiddenFuels(() => { calls += 1; });
  setHiddenFuels(['Gas']);
  assert.equal(calls, 2);
  setHiddenFuels(['Gas']); // same list: no extra notification
  assert.equal(calls, 2);
  stopA();
  stopB();
  setHiddenFuels([]);
  assert.equal(calls, 2);
});
