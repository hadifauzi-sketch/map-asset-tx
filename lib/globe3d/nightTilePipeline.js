// Builds "Night" sensor-look tiles from NASA Black Marble tiles.
// Runs inside nightTiles.worker.js (or on the main thread as a fallback), so
// it only uses APIs available in both: fetch, createImageBitmap, OffscreenCanvas.

import {
  BLACK_MARBLE_TILE_URL,
  blackMarbleRadiance,
  pixelSizeKm,
  renderLightPollution,
  renderLightsOverlay,
} from './nightModes.js';

const SIZE = 256;

function decodeTile(blob) {
  return createImageBitmap(blob).then((bitmap) => {
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, SIZE, SIZE);
    bitmap.close?.();
    return context.getImageData(0, 0, SIZE, SIZE).data;
  });
}

export function createNightTilePipeline({ cacheSize = 120 } = {}) {
  // GIBS sends no-cache headers, so decoded tiles are kept here (LRU).
  const cache = new Map();

  function sourceTile(level, x, y) {
    const n = 2 ** level;
    if (y < 0 || y >= n) {
      return Promise.resolve(null);
    }
    const wrappedX = ((x % n) + n) % n;
    const key = `${level}/${wrappedX}/${y}`;
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const url = BLACK_MARBLE_TILE_URL.replace('{z}', level).replace('{x}', wrappedX).replace('{y}', y);
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Black Marble tile ${key}: ${response.status}`);
        }
        return response.blob();
      })
      .then(decodeTile);
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
    while (cache.size > cacheSize) {
      cache.delete(cache.keys().next().value);
    }
    return promise;
  }

  async function renderPollution(x, y, level, overlay) {
    // 3×3 neighbourhood so the glow crosses tile edges without seams.
    const offsets = [-1, 0, 1];
    const tiles = await Promise.all(
      offsets.flatMap((dy) =>
        offsets.map((dx) => {
          const tile = sourceTile(level, x + dx, y + dy);
          // A missing neighbour only dims the glow near that edge.
          return dx === 0 && dy === 0 ? tile : tile.catch(() => null);
        })
      )
    );
    const width = SIZE * 3;
    const radiance = new Float32Array(width * width);
    tiles.forEach((rgba, index) => {
      if (!rgba) {
        return;
      }
      const left = (index % 3) * SIZE;
      const top = Math.floor(index / 3) * SIZE;
      for (let row = 0; row < SIZE; row += 1) {
        let target = (top + row) * width + left;
        let source = row * SIZE * 4;
        for (let col = 0; col < SIZE; col += 1, target += 1, source += 4) {
          radiance[target] = blackMarbleRadiance(rgba[source], rgba[source + 1]);
        }
      }
    });
    return renderLightPollution(radiance, SIZE, pixelSizeKm(level, y), { overlay });
  }

  async function render(kind, x, y, level) {
    if (kind === 'pollution' || kind === 'pollutionOverlay') {
      return renderPollution(x, y, level, kind === 'pollutionOverlay');
    }
    const rgba = await sourceTile(level, x, y);
    return rgba ? renderLightsOverlay(rgba, SIZE) : new Uint8ClampedArray(SIZE * SIZE * 4);
  }

  return { render, size: SIZE };
}
