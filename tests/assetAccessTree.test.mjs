import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let branchOwnerState;
let branchState;
let buildAssetTree;
let UNASSIGNED_SITE;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const assetAccessTree = await viteServer.ssrLoadModule('/lib/assetAccessTree.js');
  branchOwnerState = assetAccessTree.branchOwnerState;
  branchState = assetAccessTree.branchState;
  buildAssetTree = assetAccessTree.buildAssetTree;
  UNASSIGNED_SITE = assetAccessTree.UNASSIGNED_SITE;
});

after(async () => {
  await viteServer?.close();
});

const ASSETS = [
  { id: 'a1', tx_name: '132-TR-B', site_name: 'LOTTE CHEMICAL', state: 'Johor' },
  { id: 'a2', tx_name: '132-TR-A', site_name: 'LOTTE CHEMICAL', state: 'Johor' },
  { id: 'a3', tx_name: 'FM1', site_name: 'PERAK HANJOONG', state: 'Perak' },
  { id: 'a4', tx_name: 'CP', site_name: 'GENTING SANYEN', state: 'Selangor' },
  { id: 'a5', tx_name: 'ET1', site_name: '', state: 'Selangor' },
];

test('groups assets by state then site', () => {
  const tree = buildAssetTree(ASSETS);

  const johor = tree.find((node) => node.label === 'Johor');
  assert.deepEqual(johor.ids, ['a1', 'a2']);
  assert.equal(johor.children.length, 1);
  assert.equal(johor.children[0].label, 'LOTTE CHEMICAL');
  assert.deepEqual(johor.children[0].ids, ['a1', 'a2']);

  const perak = tree.find((node) => node.label === 'Perak');
  assert.deepEqual(perak.ids, ['a3']);
});

test('sorts transformers by name and sinks the unassigned site', () => {
  const tree = buildAssetTree(ASSETS);

  const johorSite = tree.find((node) => node.label === 'Johor').children[0];
  assert.deepEqual(
    johorSite.assets.map((asset) => asset.tx_name),
    ['132-TR-A', '132-TR-B']
  );

  const selangorSites = tree.find((node) => node.label === 'Selangor').children;
  assert.deepEqual(
    selangorSites.map((site) => site.label),
    ['GENTING SANYEN', UNASSIGNED_SITE]
  );
});

test('branchState reports off, partial, and on', () => {
  const ids = ['a1', 'a2', 'a3'];

  assert.deepEqual(branchState(ids, new Set()), { status: 'off', granted: 0 });
  assert.deepEqual(branchState(ids, new Set(['a2'])), { status: 'partial', granted: 1 });
  assert.deepEqual(branchState(ids, new Set(ids)), { status: 'on', granted: 3 });
});

test('branchOwnerState reports TNB, Non-TNB, and mixed', () => {
  const ids = ['a1', 'a2', 'a3'];
  const owners = (entries) => new Map(entries);

  assert.deepEqual(
    branchOwnerState(ids, owners([['a1', 'TNB'], ['a2', 'TNB'], ['a3', 'TNB']])),
    { status: 'TNB', tnb: 3, nonTnb: 0 }
  );
  assert.deepEqual(
    branchOwnerState(ids, owners([['a1', 'Non-TNB'], ['a2', 'Non-TNB'], ['a3', 'Non-TNB']])),
    { status: 'Non-TNB', tnb: 0, nonTnb: 3 }
  );
  assert.deepEqual(
    branchOwnerState(ids, owners([['a1', 'Non-TNB'], ['a2', 'TNB'], ['a3', 'TNB']])),
    { status: 'mixed', tnb: 2, nonTnb: 1 }
  );
});

test('branchOwnerState treats unknown and missing owners as TNB', () => {
  // Matches the column default: rows written before owner_type existed, and any
  // id the panel has not loaded, must not read as Non-TNB.
  const state = branchOwnerState(['a1', 'a2'], new Map([['a1', 'nontnb']]));

  assert.deepEqual(state, { status: 'mixed', tnb: 1, nonTnb: 1 });
});
