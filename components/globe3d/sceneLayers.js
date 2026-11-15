// Scene handlers for the "Reference feeds" layers (grid layers: gridLayers.js).
//
// Each handler has enable() / disable() and may have onCameraIdle(). They are
// keyed by the layer id from lib/globe3d/layerRegistry.js — deleting a layer
// there and its handler here removes it completely.

import * as Cesium from 'cesium';
import {
  fetchEarthquakes,
  fetchPowerPlants,
  fetchRainRadarFrame,
} from '../../lib/globe3d/liveFeeds';
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
function createFeedLayer({ viewer, report, id, load, toEntity, describe, pollMs, onData, isVisible, summarize }) {
  let dataSource = null;
  const itemByEntity = new Map();
  let controller = null;
  let timer = null;
  let active = false;

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
        report(id, { state: 'hint', text: result.skip });
        viewer.scene.requestRender();
        return;
      }

      dataSource.entities.suspendEvents();
      dataSource.entities.removeAll();
      itemByEntity.clear();
      result.forEach((item) => {
        const entity = dataSource.entities.add(toEntity(item));
        if (isVisible) {
          entity.show = isVisible(item);
          itemByEntity.set(entity, item);
        }
      });
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
      if (dataSource) {
        viewer.dataSources.remove(dataSource, true);
        dataSource = null;
      }
      itemByEntity.clear();
      report(id, null);
      viewer.scene.requestRender();
    },
    updateVisibility() {
      if (!isVisible || !dataSource) {
        return;
      }
      itemByEntity.forEach((item, entity) => {
        entity.show = isVisible(item);
      });
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

  // Rain radar is an imagery overlay rather than a set of entities.
  let radarLayer = null;
  let radarController = null;
  const rainRadar = {
    async enable() {
      // Keep this call's own signal: a quick off/on replaces radarController.
      const { signal } = (radarController = new AbortController());
      report('rainRadar', { state: 'loading', text: 'Loading…' });
      try {
        const frame = await fetchRainRadarFrame(signal);
        if (signal.aborted) {
          return;
        }
        radarLayer = viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: frame.url,
            maximumLevel: 7,
            credit: 'Radar © RainViewer',
          })
        );
        radarLayer.alpha = 0.65;
        report('rainRadar', {
          state: 'ok',
          text: frame.time
            ? `Frame ${new Date(frame.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
            : 'Latest frame',
        });
        viewer.scene.requestRender();
      } catch (error) {
        if (!signal.aborted) {
          report('rainRadar', { state: 'error', text: describeError(error) });
        }
      }
    },
    disable() {
      radarController?.abort();
      if (radarLayer) {
        viewer.imageryLayers.remove(radarLayer, true);
        radarLayer = null;
      }
      report('rainRadar', null);
      viewer.scene.requestRender();
    },
  };

  return { powerPlants, ...createGridLayers(viewer, report), earthquakes, rainRadar };
}
