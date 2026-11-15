import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../public/data/buildings3d/', import.meta.url);
const built = existsSync(new URL('tileset.json', root));

test('local 3D buildings tileset is valid 3D Tiles (skipped until built)', { skip: !built && 'run npm run globe:buildings' }, () => {
  const tileset = JSON.parse(readFileSync(new URL('tileset.json', root), 'utf8'));
  assert.equal(tileset.asset.version, '1.0');
  assert.equal(tileset.asset.gltfUpAxis, 'Z');
  assert.ok(tileset.properties.buildings > 1_000_000, 'whole-country build');
  const [west, south, east, north] = tileset.root.boundingVolume.region.map((r, i) => (i < 4 ? (r * 180) / Math.PI : r));
  assert.ok(west > 99 && east < 120 && south > 0 && north < 8, 'covers Malaysia');

  // One external cell tileset and one of its leaf tiles.
  const cell = tileset.root.children.find((child) => child.content.uri.includes('101_3')) || tileset.root.children[0];
  const cellUrl = new URL(cell.content.uri, root);
  const cellTileset = JSON.parse(readFileSync(cellUrl, 'utf8'));
  const leaf = cellTileset.root.children[0].children[0];
  assert.equal(leaf.geometricError, 0);
  const b3dm = readFileSync(new URL(leaf.content.uri, cellUrl));
  assert.equal(b3dm.toString('ascii', 0, 4), 'b3dm');
  assert.equal(b3dm.readUInt32LE(8), b3dm.length, 'byteLength header');
  const featureJsonLength = b3dm.readUInt32LE(12);
  const batchJsonLength = b3dm.readUInt32LE(20);
  const batchBinLength = b3dm.readUInt32LE(24);
  const feature = JSON.parse(b3dm.toString('utf8', 28, 28 + featureJsonLength));
  const batch = JSON.parse(b3dm.toString('utf8', 28 + featureJsonLength, 28 + featureJsonLength + batchJsonLength));
  assert.ok(feature.BATCH_LENGTH > 0 && feature.RTC_CENTER.length === 3);
  for (const key of ['name', 'building', 'cesium#estimatedHeight', 'cesium#latitude', 'cesium#longitude']) {
    assert.ok(key in batch, `batch table has ${key}`);
  }
  assert.equal(batch.building.length, feature.BATCH_LENGTH);
  const glbStart = 28 + featureJsonLength + batchJsonLength + batchBinLength;
  assert.equal(glbStart % 8, 0, 'glb is 8-byte aligned');
  assert.equal(b3dm.toString('ascii', glbStart, glbStart + 4), 'glTF');
  assert.ok(readdirSync(new URL('cells/', root)).length >= 50);
});
