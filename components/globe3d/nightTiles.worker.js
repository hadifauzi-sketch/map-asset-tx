// Web Worker: builds Night sensor-look tiles off the main thread.
// Message in:  { id, kind: 'pollution' | 'lightsAlpha', x, y, level }
// Message out: { id, pixels: Uint8ClampedArray (256² RGBA) } or { id, error }

import { createNightTilePipeline } from '../../lib/globe3d/nightTilePipeline.js';

const pipeline = createNightTilePipeline();

self.onmessage = async ({ data }) => {
  const { id, kind, x, y, level } = data;
  try {
    const pixels = await pipeline.render(kind, x, y, level);
    self.postMessage({ id, pixels }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
