// Scene handlers for the "Power grid" layers (substations, mapped transformers,
// power lines, minor lines, cables). Keyed by the layer ids in
// lib/globe3d/layerRegistry.js, same enable()/disable() contract as sceneLayers.js.
//
// Rendering is primitive-based rather than Entity-based so the whole country
// draws without per-object overhead:
//   points -> one PointPrimitiveCollection (+ one LabelCollection for named sites)
//   lines  -> one batched GroundPolylinePrimitive (clamped to terrain / 3D tiles)
// Each pickable item carries `id: { refInfo }`, which CesiumScene shows on click.

import * as Cesium from 'cesium';
import {
  GRID_ATTRIBUTION,
  GRID_LAYER_COLORS,
  describeGridRecord,
  gridRecordColor,
  lineWidthForVoltage,
  loadGridLayer,
} from '../../lib/globe3d/powerGrid';

const LABEL_FONT = '600 11px Inter, "Segoe UI", system-ui, sans-serif';
const READY_POLL_MS = 250;
const READY_POLL_LIMIT = 120; // 30 s

const css = (value) => Cesium.Color.fromCssColorString(value);

function describeError(error) {
  if (error instanceof TypeError) {
    return 'Data file unreachable';
  }
  return error?.message ? `Failed · ${error.message}` : 'Failed to load';
}

/** Shares one "© OpenStreetMap contributors" credit across all grid layers. */
function createCreditTracker(viewer) {
  const credit = new Cesium.Credit(GRID_ATTRIBUTION, true);
  let users = 0;
  return {
    add() {
      users += 1;
      if (users === 1) {
        viewer.creditDisplay.addStaticCredit(credit);
      }
    },
    remove() {
      users = Math.max(0, users - 1);
      if (users === 0) {
        viewer.creditDisplay.removeStaticCredit(credit);
      }
    },
  };
}

/**
 * Generic grid layer: loads its records once (cached in powerGrid.js), builds
 * primitives into its own PrimitiveCollection, and tears it all down on disable.
 */
function createGridLayer({ viewer, report, credits, id, build, describe }) {
  let collection = null;
  let generation = 0;
  let pollTimer = null;

  const stopPolling = () => {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  return {
    async enable() {
      const current = ++generation;
      collection = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      credits.add();
      report(id, { state: 'loading', text: 'Loading…' });

      try {
        const records = await loadGridLayer(id, { baseUrl: import.meta.env.BASE_URL });
        if (current !== generation || !collection) {
          return;
        }
        const waitFor = build(collection, records);
        report(id, { state: 'ok', text: describe(records), count: records.length });
        viewer.scene.requestRender();

        // Async primitives (ground polylines) finish on workers; keep the
        // request-render-mode scene drawing until they are ready.
        if (waitFor) {
          let polls = 0;
          stopPolling();
          pollTimer = window.setInterval(() => {
            polls += 1;
            if (current !== generation || waitFor.isDestroyed?.() || waitFor.ready || polls > READY_POLL_LIMIT) {
              stopPolling();
            }
            if (!viewer.isDestroyed()) {
              viewer.scene.requestRender();
            }
          }, READY_POLL_MS);
        }
      } catch (error) {
        if (current === generation) {
          console.error(`Grid layer "${id}" failed to load:`, error);
          report(id, { state: 'error', text: describeError(error) });
        }
      }
    },
    disable() {
      generation += 1;
      stopPolling();
      if (collection) {
        viewer.scene.primitives.remove(collection); // destroys its children
        collection = null;
        credits.remove();
      }
      report(id, null);
      viewer.scene.requestRender();
    },
  };
}

// ── Points ────────────────────────────────────────────────────────────────

function buildPoints(collection, records, { color, pixelSize, labelDistance, toInfo }) {
  const points = collection.add(new Cesium.PointPrimitiveCollection());
  const labels = collection.add(new Cesium.LabelCollection());
  const fill = css(color);
  const scaleByDistance = new Cesium.NearFarScalar(5e3, 1.0, 1.5e6, 0.45);
  const labelCondition = new Cesium.DistanceDisplayCondition(0, labelDistance);
  const labelBackground = css('rgba(6, 24, 26, 0.78)');
  const labelPadding = new Cesium.Cartesian2(6, 4);
  const labelOffset = new Cesium.Cartesian2(9, 0);

  for (const record of records) {
    if (!Number.isFinite(record.lon) || !Number.isFinite(record.lat)) {
      continue;
    }
    const position = Cesium.Cartesian3.fromDegrees(record.lon, record.lat);
    const pickId = { refInfo: toInfo(record) };
    points.add({
      position,
      pixelSize,
      color: fill,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
      scaleByDistance,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      id: pickId,
    });
    if (record.name) {
      labels.add({
        position,
        text: record.name,
        font: LABEL_FONT,
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: labelBackground,
        backgroundPadding: labelPadding,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: labelOffset,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: labelCondition,
        id: pickId,
      });
    }
  }
  return null;
}

// ── Lines ─────────────────────────────────────────────────────────────────

function buildLines(collection, records, { colorFor, widthFor, toInfo }, scene) {
  const ground = Cesium.GroundPolylinePrimitive.isSupported(scene);
  const instances = [];
  for (const record of records) {
    const coords = record.coords;
    if (!Array.isArray(coords) || coords.length < 4) {
      continue;
    }
    const positions = Cesium.Cartesian3.fromDegreesArray(coords);
    const width = widthFor(record);
    instances.push(
      new Cesium.GeometryInstance({
        geometry: ground
          ? new Cesium.GroundPolylineGeometry({ positions, width })
          : new Cesium.PolylineGeometry({ positions, width, vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT }),
        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(css(colorFor(record))) },
        id: { refInfo: toInfo(record) },
      })
    );
  }
  if (instances.length === 0) {
    return null;
  }
  const options = {
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({ translucent: false }),
    asynchronous: true,
  };
  return collection.add(ground ? new Cesium.GroundPolylinePrimitive(options) : new Cesium.Primitive(options));
}

// ── Layer set ─────────────────────────────────────────────────────────────

export function createGridLayers(viewer, report) {
  const credits = createCreditTracker(viewer);
  const layer = (id, build, describe) => createGridLayer({ viewer, report, credits, id, build, describe });
  const count = (noun) => (records) => `${records.length.toLocaleString()} ${noun}`;

  const pointLayer = (id, pixelSize, labelDistance, noun) =>
    layer(
      id,
      (collection, records) =>
        buildPoints(collection, records, {
          color: GRID_LAYER_COLORS[id],
          pixelSize,
          labelDistance,
          toInfo: (record) => describeGridRecord(id, record),
        }),
      count(noun)
    );

  const lineLayer = (id, baseWidth) =>
    layer(
      id,
      (collection, records) =>
        buildLines(
          collection,
          records,
          {
            colorFor: (record) => gridRecordColor(id, record),
            widthFor: (record) => (id === 'powerLines' ? lineWidthForVoltage(record.voltage, baseWidth) : baseWidth),
            toInfo: (record) => describeGridRecord(id, record),
          },
          viewer.scene
        ),
      count('segments')
    );

  return {
    substations: pointLayer('substations', 7, 4000, 'sites'),
    mappedTransformers: pointLayer('mappedTransformers', 6, 2500, 'transformers'),
    powerLines: lineLayer('powerLines', 2),
    minorLines: lineLayer('minorLines', 1.5),
    powerCables: lineLayer('powerCables', 2.5),
  };
}
