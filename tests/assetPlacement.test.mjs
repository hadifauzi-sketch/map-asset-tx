import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let resolveAssetPlacement;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  ({ resolveAssetPlacement } = await viteServer.ssrLoadModule('/lib/assetPlacement.js'));
});

after(async () => {
  await viteServer?.close();
});

// Mirrors the shape floorPlanService.getAll() returns for the saved "WWT" area.
const WWT_AREA = {
  id: 'floor-mpjssg8x-tmf65q',
  name: 'WWT',
  companyName: 'GS Paper & Packaging',
  state: 'Selangor',
  points: [
    [2.8025, 101.6472],
    [2.8025, 101.6492],
    [2.8005, 101.6492],
    [2.8005, 101.6472],
  ],
  transformerIds: ['85dfb6fc-2931-4a5b-813c-cd603bf9ffab', '186d6739-1ece-4be7-8cbb-d62f5f039d20'],
};

const COGEN_AREA = {
  id: 'floor-mpjtgvh2-agws0f',
  name: 'GSPP COGEN',
  companyName: 'GS Paper & Packaging',
  points: [
    [2.812, 101.647],
    [2.812, 101.649],
    [2.811, 101.649],
    [2.811, 101.647],
  ],
  transformerIds: [],
};

const GSPP_BOUNDARY = {
  id: 'company-gspp',
  companyName: 'GS Paper & Packaging',
  state: 'Selangor',
  points: [
    [2.815, 101.644],
    [2.815, 101.652],
    [2.798, 101.652],
    [2.798, 101.644],
  ],
};

const T1 = {
  id: '85dfb6fc-2931-4a5b-813c-cd603bf9ffab',
  txName: 'T1',
  siteName: 'WWTP',
  serialNumber: '4045549',
  position: [2.801571, 101.648051],
};

test('resolves company and area from the saved floor-plan assignment', () => {
  const placement = resolveAssetPlacement(T1, [COGEN_AREA, WWT_AREA], [GSPP_BOUNDARY]);

  assert.deepEqual(placement, {
    companyName: 'GS Paper & Packaging',
    areaName: 'WWT',
  });
});

test('falls back to the containing polygon when the asset was never ticked into an area', () => {
  const unassigned = { ...WWT_AREA, transformerIds: [] };
  const placement = resolveAssetPlacement(T1, [COGEN_AREA, unassigned], [GSPP_BOUNDARY]);

  assert.equal(placement.areaName, 'WWT');
  assert.equal(placement.companyName, 'GS Paper & Packaging');
});

test('numeric ids still match string transformer ids stored on the area', () => {
  const numericPlan = { ...WWT_AREA, points: [], transformerIds: [42] };
  const placement = resolveAssetPlacement({ id: 42, position: [0, 0] }, [numericPlan], []);

  assert.equal(placement.areaName, 'WWT');
});

test('company still resolves from the parent boundary when no area contains the asset', () => {
  const placement = resolveAssetPlacement(
    { id: 'not-assigned', position: [2.8005, 101.6455] },
    [COGEN_AREA],
    [GSPP_BOUNDARY]
  );

  assert.equal(placement.companyName, 'GS Paper & Packaging');
  assert.equal(placement.areaName, '');
});

test('returns empty strings for an asset outside every polygon', () => {
  const placement = resolveAssetPlacement(
    { id: 'far-away', position: [5.4, 100.3] },
    [COGEN_AREA, WWT_AREA],
    [GSPP_BOUNDARY]
  );

  assert.deepEqual(placement, { companyName: '', areaName: '' });
});

test('handles a missing transformer and malformed overlay records', () => {
  assert.deepEqual(resolveAssetPlacement(null, [WWT_AREA], [GSPP_BOUNDARY]), {
    companyName: '',
    areaName: '',
  });

  assert.deepEqual(resolveAssetPlacement(T1, [{ id: 'broken' }], [{ id: 'broken' }]), {
    companyName: '',
    areaName: '',
  });
});
