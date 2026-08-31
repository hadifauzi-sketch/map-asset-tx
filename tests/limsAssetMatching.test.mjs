import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let matchLimsRecordToAsset;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const limsBridge = await viteServer.ssrLoadModule('/lib/limsBridge.js');
  matchLimsRecordToAsset = limsBridge.matchLimsRecordToAsset;
});

after(async () => {
  await viteServer?.close();
});

// "T1" is a common transformer name, so the register holds several.
const REGISTER = [
  { id: 'a1', txName: 'T1', siteName: 'GSPP COGEN', serialNumber: '4030598', mnemonic: 'SS-T01' },
  { id: 'a2', txName: 'T2', siteName: 'GSPP COGEN', serialNumber: '4030597' },
  { id: 'a3', txName: 'T1', siteName: '1BAU SILO6&7', serialNumber: '82034757', mnemonic: '369/TF1' },
  { id: 'a4', txName: 'T1', siteName: 'RAW MATERIAL HANDLING', serialNumber: 'KM-49743' },
];

test('matches on serial number even when an earlier asset shares the name', () => {
  // The regression: ACTMS sample for 1BAU SILO6&7 / T1 / 82034757 was matched
  // to GSPP COGEN's T1, because a per-asset name check beat the later serial.
  const { match, reason } = matchLimsRecordToAsset(
    { txName: 'T1', siteName: '1BAU SILO6&7', serialNumber: '82034757' },
    REGISTER
  );

  assert.equal(match.id, 'a3');
  assert.equal(reason, 'serial number');
});

test('never matches on transformer name alone', () => {
  const { match } = matchLimsRecordToAsset({ txName: 'T1' }, REGISTER);

  assert.equal(match, null, '"T1" alone is ambiguous across sites');
});

test('normalises serials the way the database uniqueness index does', () => {
  const dashed = matchLimsRecordToAsset({ serialNumber: 'km 49743' }, REGISTER);
  const spaced = matchLimsRecordToAsset({ serialNumber: 'KM49743' }, REGISTER);

  assert.equal(dashed.match.id, 'a4');
  assert.equal(spaced.match.id, 'a4');
});

test('falls back to site and name when the serial is unknown', () => {
  const { match, reason } = matchLimsRecordToAsset(
    { txName: 'T1', siteName: 'GSPP COGEN' },
    REGISTER
  );

  assert.equal(match.id, 'a1');
  assert.equal(reason, 'site and name');
});

test('fills a blank serial on an otherwise matching asset', () => {
  const register = [{ id: 'b1', txName: 'T1', siteName: 'TELUK EWA', serialNumber: '' }];
  const { match } = matchLimsRecordToAsset(
    { txName: 'T1', siteName: 'TELUK EWA', serialNumber: '999' },
    register
  );

  assert.equal(match.id, 'b1');
});

test('refuses to merge a same-site same-name asset with a conflicting serial', () => {
  const { match } = matchLimsRecordToAsset(
    { txName: 'T1', siteName: 'GSPP COGEN', serialNumber: '82034757' },
    // a3 holds that serial but at a different site; a1 is GSPP COGEN T1 with a
    // different serial. Neither is a safe match.
    [REGISTER[0]]
  );

  assert.equal(match, null, 'two different serials means two different assets');
});

test('returns no match against an empty register', () => {
  const { match, reason } = matchLimsRecordToAsset({ serialNumber: '82034757' }, []);

  assert.equal(match, null);
  assert.equal(reason, null);
});
