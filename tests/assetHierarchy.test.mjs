import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHierarchy, filterHierarchy, sortTransformers } from '../lib/assetHierarchy.js';

const tx = (id, txName, siteName, state, extra = {}) => ({ id, txName, siteName, state, ...extra });

const transformers = [
  tx(1, 'TR-2', 'Lotte Chemical', 'Johor'),
  tx(2, 'TR-1', 'Lotte Chemical', 'Johor', { serialNumber: 'SN-777' }),
  tx(3, 'T10', 'UiTM JB', 'Johor'),
  tx(4, 'KL-1', 'Menara', 'Kuala Lumpur'),
];

test('groups transformers by state then company (site)', () => {
  const tree = buildHierarchy(transformers, []);
  const johor = tree.find((group) => group.state === 'Johor');
  assert.ok(johor, 'Johor group exists');
  assert.deepEqual(
    johor.companies.map((company) => company.companyName),
    ['Lotte Chemical', 'UiTM JB']
  );
  const lotte = johor.companies[0];
  assert.deepEqual(lotte.ungroupedTransformers.map((t) => t.txName), ['TR-1', 'TR-2']);
});

test('assets assigned to a floor plan move under that area, not the company list', () => {
  const floorPlans = [{ id: 'fp1', name: 'Substation A', companyName: 'Lotte Chemical', state: 'Johor', transformerIds: [1] }];
  const tree = buildHierarchy(transformers, floorPlans);
  const lotte = tree.find((group) => group.state === 'Johor').companies.find((c) => c.companyName === 'Lotte Chemical');
  assert.equal(lotte.floorPlans.length, 1);
  assert.deepEqual(lotte.floorPlans[0].transformers.map((t) => t.id), [1]);
  assert.deepEqual(lotte.ungroupedTransformers.map((t) => t.id), [2]);
});

test('company boundaries create (possibly empty) company groups', () => {
  const tree = buildHierarchy([], [], [{ companyName: 'Empty Co', state: 'Johor' }]);
  assert.equal(tree[0].companies[0].companyName, 'Empty Co');
  assert.equal(tree[0].companies[0].ungroupedTransformers.length, 0);
});

test('search keeps the matching transformer and prunes unrelated groups', () => {
  const tree = filterHierarchy(buildHierarchy(transformers, []), 'sn-777');
  assert.equal(tree.length, 1);
  assert.equal(tree[0].companies.length, 1);
  assert.deepEqual(tree[0].companies[0].ungroupedTransformers.map((t) => t.id), [2]);
});

test('a company-name match keeps every transformer of that company', () => {
  const tree = filterHierarchy(buildHierarchy(transformers, []), 'lotte');
  assert.deepEqual(tree[0].companies[0].ungroupedTransformers.map((t) => t.id).sort(), [1, 2]);
});

test('sortTransformers orders by site then name without mutating input', () => {
  const input = [tx(1, 'B', 'Z'), tx(2, 'A', 'Z'), tx(3, 'C', 'A')];
  const sorted = sortTransformers(input);
  assert.deepEqual(sorted.map((t) => t.id), [3, 2, 1]);
  assert.deepEqual(input.map((t) => t.id), [1, 2, 3]);
});
