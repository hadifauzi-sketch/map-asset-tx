// Scene handlers for the "Reference feeds" layers (grid layers: gridLayers.js).
//
// Each handler has enable() / disable() and may have onCameraIdle(). They are
// keyed by the layer id from lib/globe3d/layerRegistry.js — deleting a layer
// there and its handler here removes it completely.

import * as Cesium from 'cesium';
import {
  fetchEarthquakes,
  fetchPowerPlants,
  fetchRainRadarFrames,
} from '../../lib/globe3d/liveFeeds';
import {
  DEFAULT_RAIN_RADAR_SETTINGS,
  RAIN_RADAR_MAX_LEVEL,
  RAIN_RADAR_REFRESH_MS,
  formatRainRadarTime,
  rainRadarTileUrl,
  resolveRainRadarIndex,
} from '../../lib/globe3d/rainRadar';
import { createGridLayers } from './gridLayers';
import { countPlantsByFuel, describePowerPlant, fuelColor, fuelEntry, plantRadius } from '../../lib/powerPlants';
import { createGlobePowerPlantLabels } from './powerPlantLabels';

const LABEL_FONT = '600 11px Inter, "Segoe UI", system-ui, sans-serif';

function labelGraphics(text, maxDistance) {
  return {
    text,
    font: LABEL_FONT,
    fillColor: Cesium.Color.WHITE,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString('rgba(6, 24, 26, 0.78)'),
    backgroundPadding: new Cesium.Cartesian2(6, 4),
    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
    verticalOrigin: Cesium.VerticalOrigin.CENTER,
    pixelOffset: new Cesium.Cartesian2(10, 0),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, maxDistance),
  };
}

function describeError(error) {
  if (error?.name === 'AbortError') {
    return 'Timed out';
  }
  if (error instanceof TypeError) {
    return 'Provider unreachable'; // network, CORS or blocked request
  }
  return error?.message ? `Failed · ${error.message}` : 'Failed to load';
}

/**
 * A layer backed by a CustomDataSource whose entities are rebuilt from a fetch.
 */
// `isVisible(item)` (optional) decides each entity's `show`; call
// updateVisibility() after the rule changes. `summarize(items)` adds extra
// fields to the layer status (e.g. per-fuel counts).
function createFeedLayer({
  viewer,
  report,
  id,
  load,
  toEntity,
  describe,
  pollMs,
  onData,
  isVisible,
  summarize,
  cullBeyondHorizon = false,
}) {
  let dataSource = null;
  // entity -> { item, position }. Tracked whenever a layer filters or culls.
  const entryByEntity = new Map();
  const tracksEntities = Boolean(isVisible || cullBeyondHorizon);
  let controller = null;
  let timer = null;
  let active = false;
  let removeHorizonListener = null;
  const lastCameraPosition = new Cesium.Cartesian3();

  // Worldwide feeds draw with depth testing disabled (so terrain never hides
  // them); without this check, points on the far side of the Earth would show
  // through the globe. Hide anything below the horizon instead.
  function applyVisibility() {
    if (!dataSource || !entryByEntity.size) {
      return false;
    }
    const occluder = cullBeyondHorizon
      ? new Cesium.EllipsoidalOccluder(viewer.scene.globe.ellipsoid, viewer.camera.positionWC)
      : null;
    let changed = false;
    entryByEntity.forEach(({ item, position }, entity) => {
      const show =
        (!isVisible || isVisible(item)) && (!occluder || !position || occluder.isPointVisible(position));
      if (entity.show !== show) {
        entity.show = show;
        changed = true;
      }
    });
    return changed;
  }

  function onPostRender() {
    const cameraPosition = viewer.camera.positionWC;
    if (Cesium.Cartesian3.equalsEpsilon(cameraPosition, lastCameraPosition, 0, 1)) {
      return;
    }
    Cesium.Cartesian3.clone(cameraPosition, lastCameraPosition);
    if (applyVisibility()) {
      viewer.scene.requestRender();
    }
  }

  async function refresh(context) {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    try {
      const result = await load(signal, context);
      if (!active || signal.aborted) {
        return;
      }
      if (result?.skip) {
        dataSource.entities.removeAll();
        entryByEntity.clear();
        report(id, { state: 'hint', text: result.skip });
        viewer.scene.requestRender();
        return;
      }

      dataSource.entities.suspendEvents();
      dataSource.entities.removeAll();
      entryByEntity.clear();
      result.forEach((item) => {
        const definition = toEntity(item);
        const entity = dataSource.entities.add(definition);
        if (tracksEntities) {
          entryByEntity.set(entity, { item, position: definition.position });
        }
      });
      applyVisibility();
      dataSource.entities.resumeEvents();
      onData?.(result);
      report(id, { state: 'ok', text: describe(result), count: result.length, ...summarize?.(result) });
      viewer.scene.requestRender();
    } catch (error) {
      if (!active || signal.aborted) {
        return;
      }
      report(id, { state: 'error', text: describeError(error) });
    }
  }

  return {
    enable(context) {
      active = true;
      dataSource = new Cesium.CustomDataSource(`ref-${id}`);
      viewer.dataSources.add(dataSource);
      if (cullBeyondHorizon) {
        Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, lastCameraPosition);
        removeHorizonListener = viewer.scene.postRender.addEventListener(onPostRender);
      }
      report(id, { state: 'loading', text: 'Loading…' });
      refresh(context);
      if (pollMs) {
        timer = window.setInterval(() => refresh(context), pollMs);
      }
    },
    disable() {
      active = false;
      controller?.abort();
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      removeHorizonListener?.();
      removeHorizonListener = null;
      if (dataSource) {
        viewer.dataSources.remove(dataSource, true);
        dataSource = null;
      }
      entryByEntity.clear();
      report(id, null);
      viewer.scene.requestRender();
    },
    updateVisibility() {
      if (!isVisible || !dataSource) {
        return;
      }
      applyVisibility();
      viewer.scene.requestRender();
    },
    refresh,
  };
}

export function createReferenceLayers(viewer, report, onPlantSelect) {
  let plantLabels = null;
  let plantItems = [];
  // Legend ids ("Coal", "Others", ...) switched off in the power plant legend.
  let hiddenFuels = new Set();
  const isPlantVisible = (plant) => !hiddenFuels.has(fuelEntry(plant.fuel).id);
  const showPlantLabels = () => plantLabels?.setPlants(plantItems.filter(isPlantVisible));
  const plantFeed = createFeedLayer({
    viewer,
    report,
    id: 'powerPlants',
    // Biggest first so smaller stations draw (and pick) on top of them.
    load: async (signal) =>
      (await fetchPowerPlants(signal)).sort((left, right) => (right.capacityMw || 0) - (left.capacityMw || 0)),
    describe: (items) => `${items.length} stations`,
    onData: (items) => {
      plantItems = items;
      showPlantLabels();
    },
    isVisible: isPlantVisible,
    summarize: (items) => ({ fuelCounts: countPlantsByFuel(items) }),
    toEntity: (plant) => {
      return {
        position: Cesium.Cartesian3.fromDegrees(plant.longitude, plant.latitude),
        point: {
          // Same capacity scale as the 2D map; shrinks a little when zoomed far out.
          pixelSize: plantRadius(plant.capacityMw) * 2,
          color: Cesium.Color.fromCssColorString(fuelColor(plant.fuel)).withAlpha(0.92),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1.5,
          scaleByDistance: new Cesium.NearFarScalar(5.0e4, 1.25, 3.0e6, 0.6),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          refInfo: describePowerPlant(plant),
        },
      };
    },
  });
  const powerPlants = {
    enable(context) {
      plantLabels = createGlobePowerPlantLabels(viewer, onPlantSelect);
      plantFeed.enable(context);
    },
    disable() {
      plantLabels?.destroy();
      plantLabels = null;
      plantItems = [];
      plantFeed.disable();
    },
    /** Hide every plant (point + label) whose fuel's legend id is listed. */
    setHiddenFuels(ids = []) {
      hiddenFuels = new Set(ids);
      plantFeed.updateVisibility();
      showPlantLabels();
    },
    refresh: plantFeed.refresh,
  };

  const earthquakes = createFeedLayer({
    viewer,
    report,
    id: 'earthquakes',
    cullBeyondHorizon: true,
    load: (signal) => fetchEarthquakes(signal),
    describe: (items) => `${items.length} events`,
    toEntity: (quake) => {
      const magnitude = Number(quake.magnitude) || 0;
      return {
        position: Cesium.Cartesian3.fromDegrees(quake.longitude, quake.latitude),
        point: {
          pixelSize: Math.max(6, magnitude * 3.2),
          color: Cesium.Color.fromCssColorString('#f43f5e').withAlpha(0.55),
          outlineColor: Cesium.Color.fromCssColorString('#fecdd3'),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: labelGraphics(`M${magnitude.toFixed(1)}`, 3000000),
        properties: {
          refInfo: {
            kind: 'Earthquake',
            title: `M${magnitude.toFixed(1)} · ${quake.place}`,
            rows: [
              ['Depth', Number.isFinite(quake.depthKm) ? `${quake.depthKm.toFixed(0)} km` : ''],
              ['Time', quake.time ? new Date(quake.time).toLocaleString('en-GB') : ''],
            ],
          },
        },
      };
    },
  });

  const rainRadar = createRainRadarLayer(viewer, report);

  return { powerPlants, ...createGridLayers(viewer, report), earthquakes, rainRadar };
}

/**
 * Rain radar: an imagery overlay rather than entities. Each visited frame gets
 * its own Cesium layer, kept but hidden when another frame is shown, so
 * scrubbing and looped playback reuse tiles that are already loaded.
 *
 * Options come from the right-rail "Rain radar" tab via setOptions():
 *   frameIndex (null = live), opacity, smooth, autoRefresh, refreshToken.
 * Status reports carry the frame list so the tab can draw its time scrubber;
 * they are sent only when the list changes, not on every played frame.
 */
function createRainRadarLayer(viewer, report) {
  let options = { ...DEFAULT_RAIN_RADAR_SETTINGS, frameIndex: null, refreshToken: 0 };
  let host = '';
  let frames = [];
  const layerByKey = new Map();
  let controller = null;
  let refreshTimer = null;
  let active = false;

  const keyFor = (frame) => `${frame.path}|${options.smooth ? 1 : 0}`;

  function removeLayers(keepKeys) {
    layerByKey.forEach((layer, key) => {
      if (keepKeys?.has(key)) {
        return;
      }
      viewer.imageryLayers.remove(layer, true);
      layerByKey.delete(key);
    });
  }

  function apply() {
    if (!active || !frames.length || viewer.isDestroyed()) {
      return;
    }
    const frame = frames[resolveRainRadarIndex(frames, options.frameIndex)];
    const key = keyFor(frame);
    let layer = layerByKey.get(key);
    if (!layer) {
      layer = viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: rainRadarTileUrl(host, frame.path, options),
          maximumLevel: RAIN_RADAR_MAX_LEVEL,
          credit: 'Radar © RainViewer',
        })
      );
      layerByKey.set(key, layer);
    }
    layerByKey.forEach((candidate) => {
      candidate.show = candidate === layer;
    });
    layer.alpha = options.opacity;
    viewer.scene.requestRender();
  }

  function reportFrames() {
    const latest = frames[resolveRainRadarIndex(frames, null)];
    report('rainRadar', {
      state: 'ok',
      text: `${frames.length} frames · latest ${formatRainRadarTime(latest?.time)}`,
      count: frames.length,
      frames: frames.map(({ time, nowcast }) => ({ time, nowcast })),
      fetchedAt: Date.now(),
    });
  }

  async function load() {
    controller?.abort();
    const { signal } = (controller = new AbortController());
    try {
      const result = await fetchRainRadarFrames(signal);
      if (!active || signal.aborted) {
        return;
      }
      host = result.host;
      frames = result.frames;
      // Frames that rolled out of RainViewer's ~2 h window are dropped.
      removeLayers(new Set(frames.map(keyFor)));
      reportFrames();
      apply();
    } catch (error) {
      if (!active || signal.aborted) {
        return;
      }
      if (frames.length) {
        // A failed background refresh keeps the frames already on screen.
        console.warn('Rain radar refresh failed:', error);
        return;
      }
      report('rainRadar', { state: 'error', text: describeError(error) });
    }
  }

  function syncRefreshTimer() {
    const wanted = active && options.autoRefresh;
    if (wanted && !refreshTimer) {
      refreshTimer = window.setInterval(load, RAIN_RADAR_REFRESH_MS);
    } else if (!wanted && refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return {
    enable() {
      active = true;
      report('rainRadar', { state: 'loading', text: 'Loading…' });
      syncRefreshTimer();
      load();
    },
    disable() {
      active = false;
      controller?.abort();
      syncRefreshTimer();
      removeLayers();
      frames = [];
      report('rainRadar', null);
      viewer.scene.requestRender();
    },
    setOptions(next = {}) {
      const smoothChanged = next.smooth !== undefined && next.smooth !== options.smooth;
      const refreshRequested = next.refreshToken !== undefined && next.refreshToken !== options.refreshToken;
      options = { ...options, ...next };
      if (smoothChanged) {
        // Different tiles: drop the cached layers and rebuild on demand.
        removeLayers();
      }
      syncRefreshTimer();
      if (refreshRequested && active) {
        load();
      } else {
        apply();
      }
    },
  };
}
