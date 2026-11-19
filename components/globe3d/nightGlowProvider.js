// Cesium imagery provider for the Night sensor look's processed modes:
//   'pollution'         estimated light-pollution glow (atlas colours), opaque
//   'pollutionOverlay'  the same, with dark skies see-through for the "+ city" mode
//   'lightsAlpha'  city lights with soft transparency, to draw over a map
// Tiles are built in a shared Web Worker; if workers are unavailable the same
// pipeline runs on the main thread.

import * as Cesium from 'cesium';
import { BLACK_MARBLE_CREDIT, BLACK_MARBLE_MAX_LEVEL } from '../../lib/globe3d/nightModes';
import { createNightTilePipeline } from '../../lib/globe3d/nightTilePipeline';

let worker; // undefined = not tried yet, null = unavailable
let nextJobId = 1;
const pendingJobs = new Map();
let fallbackPipeline = null;

function renderOnMainThread(job) {
  fallbackPipeline ??= createNightTilePipeline();
  return fallbackPipeline.render(job.kind, job.x, job.y, job.level);
}

function startWorker() {
  try {
    worker = new Worker(new URL('./nightTiles.worker.js', import.meta.url), { type: 'module' });
  } catch (error) {
    console.warn('Night tiles worker unavailable, using the main thread:', error);
    worker = null;
    return;
  }
  worker.onmessage = ({ data }) => {
    const job = pendingJobs.get(data.id);
    if (!job) {
      return;
    }
    pendingJobs.delete(data.id);
    if (data.error) {
      job.reject(new Error(data.error));
    } else {
      job.resolve(data.pixels);
    }
  };
  worker.onerror = (event) => {
    console.warn('Night tiles worker failed, using the main thread:', event.message || event);
    worker?.terminate();
    worker = null;
    // Re-run anything that was waiting on the worker.
    pendingJobs.forEach((job) => renderOnMainThread(job.payload).then(job.resolve, job.reject));
    pendingJobs.clear();
  };
}

function renderTile(payload) {
  if (worker === undefined) {
    startWorker();
  }
  if (!worker) {
    return renderOnMainThread(payload);
  }
  return new Promise((resolve, reject) => {
    const id = nextJobId;
    nextJobId += 1;
    pendingJobs.set(id, { resolve, reject, payload });
    worker.postMessage({ id, ...payload });
  });
}

export class NightGlowImageryProvider {
  constructor({ kind }) {
    this._kind = kind;
    this._tilingScheme = new Cesium.WebMercatorTilingScheme();
    this._errorEvent = new Cesium.Event();
    this._credit = new Cesium.Credit(
      kind.startsWith('pollution') ? `Light pollution estimated from ${BLACK_MARBLE_CREDIT}` : BLACK_MARBLE_CREDIT
    );
  }

  get tilingScheme() {
    return this._tilingScheme;
  }

  get rectangle() {
    return this._tilingScheme.rectangle;
  }

  get tileWidth() {
    return 256;
  }

  get tileHeight() {
    return 256;
  }

  get minimumLevel() {
    return 0;
  }

  // Beyond the source's native zoom, Cesium upsamples (smoothly) from level 8.
  get maximumLevel() {
    return BLACK_MARBLE_MAX_LEVEL;
  }

  get tileDiscardPolicy() {
    return undefined;
  }

  get errorEvent() {
    return this._errorEvent;
  }

  get credit() {
    return this._credit;
  }

  get proxy() {
    return undefined;
  }

  get hasAlphaChannel() {
    return true;
  }

  get ready() {
    return true;
  }

  getTileCredits() {
    return undefined;
  }

  requestImage(x, y, level) {
    return renderTile({ kind: this._kind, x, y, level }).then((pixels) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      canvas.getContext('2d').putImageData(new ImageData(pixels, 256, 256), 0, 0);
      return canvas;
    });
  }

  pickFeatures() {
    return undefined;
  }
}
