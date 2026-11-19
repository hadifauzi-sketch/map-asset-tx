import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIGHT_POLLUTION_SCALE,
  NIGHT_MODES,
  blackMarbleRadiance,
  boxBlur,
  getNightMode,
  lightPollutionColor,
  lightPollutionGradientCss,
  nightModeRecipe,
  overlayAlpha,
  pixelSizeKm,
  renderLightPollution,
  renderLightsOverlay,
} from '../lib/globe3d/nightModes.js';

test('four night modes, unknown ids fall back to lights only', () => {
  assert.deepEqual(
    NIGHT_MODES.map((mode) => mode.id),
    ['lights', 'lightsCity', 'pollution', 'pollutionCity']
  );
  assert.equal(getNightMode('nope').id, 'lights');
  assert.equal(getNightMode(undefined).id, 'lights');
});

test('recipes: only the "+ city" modes dim the map and add roads and labels', () => {
  assert.deepEqual(nightModeRecipe('lights'), { dim: 0, kind: 'lights', alpha: 1, roadsAlpha: 0, labels: false });
  assert.equal(nightModeRecipe('pollution').kind, 'pollution');
  assert.equal(nightModeRecipe('pollution').labels, false);
  for (const id of ['lightsCity', 'pollutionCity']) {
    const recipe = nightModeRecipe(id);
    assert.ok(recipe.dim > 0, `${id} dims the base map`);
    assert.ok(recipe.roadsAlpha > 0, `${id} shows roads`);
    assert.equal(recipe.labels, true);
  }
  assert.equal(nightModeRecipe('lightsCity').kind, 'lightsAlpha');
});

test('colour scale hits its end stops and interpolates between them', () => {
  assert.deepEqual(lightPollutionColor(0), LIGHT_POLLUTION_SCALE[0].color);
  assert.deepEqual(lightPollutionColor(1), [255, 255, 255]);
  assert.deepEqual(lightPollutionColor(5), [255, 255, 255]);
  assert.deepEqual(lightPollutionColor(Number.NaN), LIGHT_POLLUTION_SCALE[0].color);
  const mid = lightPollutionColor(0.65); // between orange (0.6) and red (0.7)
  assert.ok(mid[0] > 230 && mid[1] > 52 && mid[1] < 136);
  assert.match(lightPollutionGradientCss(), /^linear-gradient\(90deg, rgb\(6, 8, 20\) 0%,.*rgb\(255, 255, 255\) 100%\)$/);
});

test('radiance ignores the dark background and grows with brightness', () => {
  assert.equal(blackMarbleRadiance(4, 5), 0);
  assert.ok(blackMarbleRadiance(30, 28) < blackMarbleRadiance(200, 180));
  assert.equal(blackMarbleRadiance(255, 255), 1);
});

test('pixel size shrinks with zoom and toward the poles', () => {
  assert.ok(Math.abs(pixelSizeKm(8, 127.5) - 0.611) < 0.01); // equator, zoom 8
  assert.ok(pixelSizeKm(7, 63) > pixelSizeKm(8, 126));
  assert.ok(pixelSizeKm(8, 10) < pixelSizeKm(8, 127));
});

test('box blur keeps total light and spreads a point source', () => {
  const size = 41;
  const source = new Float32Array(size * size);
  source[20 * size + 20] = 1;
  const blurred = boxBlur(source, size, size, 3);
  const total = blurred.reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-4);
  assert.ok(blurred[20 * size + 20] < 1 && blurred[20 * size + 26] > 0);
  assert.deepEqual(Array.from(boxBlur(source, size, size, 0)), Array.from(source));
});

test('light pollution glow is brightest at the city and fades with distance', () => {
  const size = 32;
  const width = size * 3;
  const radiance = new Float32Array(width * width);
  // A 4×4 "city" in the middle of the centre tile.
  for (let y = 46; y < 50; y += 1) for (let x = 46; x < 50; x += 1) radiance[y * width + x] = 1;
  const pixels = renderLightPollution(radiance, size, 1);
  const brightness = (x, y) => {
    const o = (y * size + x) * 4;
    return pixels[o] + pixels[o + 1] + pixels[o + 2];
  };
  assert.equal(pixels.length, size * size * 4);
  assert.equal(pixels[3], 255);
  assert.ok(brightness(15, 15) > brightness(15, 2), 'centre brighter than the edge');
  assert.ok(brightness(15, 2) > brightness(0, 0) || brightness(15, 2) === brightness(0, 0));
});

test('"+ city" pollution overlay lets the map show through dark skies only', () => {
  assert.ok(overlayAlpha(0) < 64, 'pristine sky mostly see-through');
  assert.ok(overlayAlpha(0.5) > 200, 'suburban glow nearly solid');
  assert.ok(overlayAlpha(0.2) > overlayAlpha(0.1));
  assert.equal(nightModeRecipe('pollutionCity').kind, 'pollutionOverlay');
  const radiance = new Float32Array(9 * 4);
  const pixels = renderLightPollution(radiance, 2, 1, { overlay: true });
  assert.equal(pixels[3], overlayAlpha(0));
});

test('lights overlay is clear over dark ground and opaque over city lights', () => {
  const dark = renderLightsOverlay(new Uint8ClampedArray([5, 6, 16, 255]), 1);
  assert.equal(dark[3], 0);
  const lit = renderLightsOverlay(new Uint8ClampedArray([250, 220, 160, 255]), 1);
  assert.equal(lit[3], 255);
  assert.ok(lit[0] >= 250, 'lights stay warm and bright');
});
