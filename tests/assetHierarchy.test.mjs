import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHierarchy, filterHierarchy, sortHierarchy, sortTransformers } from '../lib/assetHierarchy.js';

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

function sortingFixture() {
  const assets = [
    tx(1, 'TX 1', 'Alpha', 'Johor', { oilTests: [{ testDate: '2026-01-01' }] }),
    tx(2, 'TX 10', 'Beta', 'Johor', { serialNumber: 'SN-SORT', oilTests: [{ testDate: '2024-01-01' }, { testDate: '2023-01-01' }] }),
    tx(3, 'TX 2', 'Beta', 'Johor', { oilTests: [{ testDate: '2025-01-01' }] }),
    tx(4, 'TX 3', 'Beta', 'Johor', { oilTests: [{ testDate: 'invalid' }] }),
    tx(5, 'TX 5', 'Beta', 'Johor', { oilTests: [{ testDate: '2022-01-01' }] }),
    tx(6, 'TX 6', 'Beta', 'Johor'),
    tx(7, 'TX 7', 'Beta', 'Johor', { oilTests: [{ testDate: '2021-01-01' }] }),
    ...[8, 9, 10].map((id) => tx(id, `TX ${id}`, 'Gamma', 'Kedah')),
  ];
  const areas = [
    { id: 'z', name: 'Area Z', companyName: 'Beta', state: 'Johor', transformerIds: [2, 3, 4] },
    { id: 'a', name: 'Area A', companyName: 'Beta', state: 'Johor', transformerIds: [5] },
  ];
  const statuses = new Map([[2, 'critical'], [3, 'warning'], [4, 'critical'], [7, 'critical'],
    [8, 'critical'], [9, 'critical'], [10, 'critical']]);
  return { tree: buildHierarchy(assets, areas), statuses };
}

test('severity sorts states, companies, areas and assets by critical then warning counts', () => {
  const { tree, statuses } = sortingFixture();
  const sorted = sortHierarchy(tree, 'severity', statuses);
  // Both states have three critical assets; Johor's warning breaks the tie.
  assert.deepEqual(sorted.map((state) => state.state), ['Johor', 'Kedah']);
  const beta = sorted[0].companies[0];
  assert.equal(beta.companyName, 'Beta');
  assert.deepEqual(beta.floorPlans.map((area) => area.id), ['z', 'a']);
  assert.deepEqual(beta.floorPlans[0].transformers.map((asset) => asset.id), [4, 2, 3]);
  assert.deepEqual(beta.ungroupedTransformers.map((asset) => asset.id), [7, 6]);
});

test('name sorting uses natural names at every level and preserves the source hierarchy', () => {
  const { tree, statuses } = sortingFixture();
  const original = structuredClone(tree);
  const sorted = sortHierarchy(tree, 'name', statuses);
  assert.deepEqual(sorted[0].companies.map((company) => company.companyName), ['Alpha', 'Beta']);
  const beta = sorted[0].companies[1];
  assert.deepEqual(beta.floorPlans.map((area) => area.id), ['a', 'z']);
  assert.deepEqual(beta.floorPlans[1].transformers.map((asset) => asset.id), [3, 4, 2]);
  assert.deepEqual(beta.ungroupedTransformers.map((asset) => asset.id), [6, 7]);
  assert.deepEqual(tree, original);
  assert.notEqual(sorted[0], tree[0]);
});

test('latest sample sorts newest first and puts missing or invalid sample dates last', () => {
  const { tree, statuses } = sortingFixture();
  const sorted = sortHierarchy(tree, 'sample', statuses);
  assert.equal(sorted[0].state, 'Johor');
  assert.equal(sorted[0].companies[0].companyName, 'Alpha');
  const beta = sorted[0].companies[1];
  assert.deepEqual(beta.floorPlans.map((area) => area.id), ['z', 'a']);
  assert.deepEqual(beta.floorPlans[0].transformers.map((asset) => asset.id), [3, 2, 4]);
  assert.deepEqual(beta.ungroupedTransformers.map((asset) => asset.id), [7, 6]);
});

test('sorting works after search and retains empty saved boundaries and areas', () => {
  const { tree, statuses } = sortingFixture();
  const filtered = sortHierarchy(filterHierarchy(tree, 'SN-SORT'), 'severity', statuses);
  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].companies[0].floorPlans[0].transformers.map((asset) => asset.id), [2]);
  const empty = buildHierarchy([], [
    { id: 'empty', name: 'Empty area', companyName: 'Empty Co', state: 'Johor', transformerIds: [] },
  ], [{ companyName: 'Boundary Co', state: 'Kedah' }]);
  for (const mode of ['name', 'severity', 'sample']) {
    assert.deepEqual(sortHierarchy([], mode, statuses), []);
    assert.deepEqual(sortHierarchy(empty, mode, statuses), empty);
  }
});
