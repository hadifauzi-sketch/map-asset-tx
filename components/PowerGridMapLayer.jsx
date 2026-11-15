import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import PowerPlantLegend from './PowerPlantLegend';
import { countPlantsByFuel, fuelEntry, plantRadius, plantSummary } from '../lib/powerPlants';
import { useHiddenFuels } from '../lib/hiddenFuelsStore';
import {
  GRID_ATTRIBUTION,
  GRID_LINE_LAYERS,
  describeGridRecord,
  gridRecordColor,
  lineWidthForVoltage,
  loadGridLayer,
} from '../lib/globe3d/powerGrid';
import { fetchPowerPlants } from '../lib/globe3d/liveFeeds';
import { POWER_GRID_LAYER_IDS, gridPopupHtml } from '../lib/powerGridMap';
import { createPowerPlantLabelOverlay } from '../lib/powerPlantLabelOverlay';

// Power grid overlay for the 2D Leaflet map.
//
// Everything is drawn on two canvas renderers (lines below, points above) in
// their own panes, under the transformer markers, so thousands of features pan
// and zoom smoothly. Each layer is loaded once and kept, so switching it off and
// on again is instant.

const LINE_PANE = 'powerGridLines';
const POINT_PANE = 'powerGridPoints';
const LABEL_PANE = 'powerPlantLabels';

const TOOLTIP_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Leaflet tooltips render strings as HTML, so names from the data are escaped.
const escapeTooltip = (value) => String(value).replace(/[&<>"']/g, (char) => TOOLTIP_ESCAPES[char]);

const POINT_RADIUS = {
  powerPlants: [4, 5.5, 7],
  substations: [2, 3.5, 5],
  mappedTransformers: [1.5, 3, 4.5],
};

function radiusFor(layerId, zoom, record) {
  if (layerId === 'powerPlants') {
    // Capacity-scaled circles, a little smaller zoomed out so clusters stay readable.
    const scale = zoom < 7 ? 0.7 : zoom < 10 ? 0.9 : zoom < 13 ? 1.1 : 1.3;
    return plantRadius(record?.capacityMw, scale);
  }
  const [far, mid, near] = POINT_RADIUS[layerId] || [3, 4, 5];
  if (zoom < 8) return far;
  if (zoom < 12) return mid;
  return near;
}

function ensurePane(map, name, zIndex) {
  const pane = map.getPane(name) || map.createPane(name);
  pane.style.zIndex = String(zIndex);
  return pane;
}

async function loadRecords(layerId) {
  if (layerId === 'powerPlants') {
    const plants = await fetchPowerPlants();
    return plants.map((plant) => ({ ...plant, lon: plant.longitude, lat: plant.latitude }));
  }
  return loadGridLayer(layerId, { baseUrl: import.meta.env.BASE_URL });
}

function buildGroup(layerId, records, renderers, zoom) {
  const group = L.featureGroup();
  const plantMarkers = [];
  if (GRID_LINE_LAYERS.has(layerId)) {
    const base = layerId === 'minorLines' ? 1.5 : layerId === 'powerCables' ? 2.5 : 2;
    const paths = [];
    for (const record of records) {
      const coords = record.coords;
      if (!Array.isArray(coords) || coords.length < 4) continue;
      const latLngs = [];
      for (let index = 0; index < coords.length; index += 2) {
        latLngs.push([coords[index + 1], coords[index]]);
      }
      paths.push({ record, latLngs });
    }
    // Dark casing first (same renderer draws in add order), so grid lines stay
    // distinct from the red/orange roads on the street basemap.
    for (const { record, latLngs } of paths) {
      const weight = layerId === 'powerLines' ? lineWidthForVoltage(record.voltage, base) : base;
      L.polyline(latLngs, {
        renderer: renderers.lines,
        pane: LINE_PANE,
        color: '#0b1214',
        weight: weight + 2.5,
        opacity: 0.4,
        interactive: false,
      }).addTo(group);
    }
    for (const { record, latLngs } of paths) {
      const color = gridRecordColor(layerId, record);
      L.polyline(latLngs, {
        renderer: renderers.lines,
        pane: LINE_PANE,
        color,
        weight: layerId === 'powerLines' ? lineWidthForVoltage(record.voltage, base) : base,
        opacity: 0.92,
        dashArray: layerId === 'powerCables' ? '6 4' : undefined,
        gridLayerId: layerId,
        gridRecord: record,
      }).addTo(group);
    }
  } else {
    const isPlant = layerId === 'powerPlants';
    const layerColor = gridRecordColor(layerId, null);
    const layerRadius = radiusFor(layerId, zoom);
    // Plants: biggest first so small stations stay clickable on top of them.
    const ordered = isPlant ? [...records].sort((a, b) => (b.capacityMw || 0) - (a.capacityMw || 0)) : records;
    for (const record of ordered) {
      if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) continue;
      const marker = L.circleMarker([record.lat, record.lon], {
        renderer: renderers.points,
        pane: POINT_PANE,
        radius: isPlant ? radiusFor(layerId, zoom, record) : layerRadius,
        color: '#ffffff',
        weight: isPlant ? 1.2 : 1,
        fillColor: isPlant ? gridRecordColor(layerId, record) : layerColor,
        fillOpacity: isPlant ? 0.9 : 0.95,
        gridLayerId: layerId,
        gridRecord: record,
      }).addTo(group);
      if (isPlant) plantMarkers.push(marker);
    }
  }

  group.on('click', (event) => {
    const { gridLayerId, gridRecord } = event.layer.options;
    L.popup({ className: 'grid-popup-shell', maxWidth: gridLayerId === 'powerPlants' ? 300 : 280, autoPanPadding: [24, 24] })
      .setLatLng(event.latlng)
      .setContent(gridPopupHtml(describeGridRecord(gridLayerId, gridRecord), gridRecordColor(gridLayerId, gridRecord)))
      .openOn(group._map);
  });

  if (layerId === 'powerPlants') {
    let cleanupLabels = null;
    let plantLabels = null;
    let hiddenFuels = new Set();
    const isShown = (plant) => !hiddenFuels.has(fuelEntry(plant.fuel).id);

    /** Hide every plant (circle + label) whose fuel's legend id is listed. */
    group.setHiddenFuels = (ids = []) => {
      hiddenFuels = new Set(ids);
      // Re-add in the original biggest-first order so small plants stay on top.
      const map = group._map;
      group.clearLayers();
      for (const marker of plantMarkers) {
        const plant = marker.options.gridRecord;
        if (!isShown(plant)) continue;
        if (map) marker.setRadius(radiusFor(layerId, map.getZoom(), plant));
        group.addLayer(marker);
      }
      plantLabels?.setPlants(records.filter(isShown));
    };
    group.on('add', () => {
      const map = group._map;
      // Below marker (600), tooltip (650) and popup (700) panes. A direct
      // container overlay would sit above the entire transformed map pane.
      const labelPane = ensurePane(map, LABEL_PANE, 450);
      labelPane.style.pointerEvents = 'none';
      const labels = createPowerPlantLabelOverlay({
        container: map.getContainer(),
        mountContainer: labelPane,
        getOrigin: () => map.containerPointToLayerPoint([0, 0]),
        project: (plant) => {
          const point = map.latLngToContainerPoint([plant.lat, plant.lon]);
          return { x: point.x, y: point.y, radius: radiusFor(layerId, map.getZoom(), plant) };
        },
        onSelect: (plant) => L.popup({ className: 'grid-popup-shell', maxWidth: 300, autoPanPadding: [24, 24] })
          .setLatLng([plant.lat, plant.lon])
          .setContent(gridPopupHtml(describeGridRecord(layerId, plant), gridRecordColor(layerId, plant)))
          .openOn(map),
      });
      plantLabels = labels;
      labels.setPlants(records.filter(isShown));
      const hideLabels = () => labels.setVisible(false);
      const showLabels = () => labels.setVisible(true);
      map.on('move resize viewreset', labels.update);
      map.on('zoomstart', hideLabels);
      map.on('zoomend', showLabels);
      cleanupLabels = () => {
        map.off('move resize viewreset', labels.update);
        map.off('zoomstart', hideLabels);
        map.off('zoomend', showLabels);
        labels.destroy();
        plantLabels = null;
      };
    });
    group.on('remove', () => { cleanupLabels?.(); cleanupLabels = null; });
  }

  // Name on hover, bound lazily so thousands of unnamed features cost nothing.
  group.on('mouseover', (event) => {
    const target = event.layer;
    const { gridLayerId, gridRecord } = target.options;
    const name = gridRecord?.name;
    if (!name) return;
    if (!target.getTooltip()) {
      const summary = gridLayerId === 'powerPlants' ? plantSummary(gridRecord) : '';
      const label = summary ? `${escapeTooltip(name)}<br><span class="grid-hover-sub">${escapeTooltip(summary)}</span>` : escapeTooltip(name);
      target.bindTooltip(label, { direction: 'top', offset: [0, -6], className: 'grid-hover-label', sticky: GRID_LINE_LAYERS.has(target.options.gridLayerId) });
    }
    target.openTooltip(event.latlng);
  });
  return group;
}

/**
 * layers:   { [layerId]: boolean } (see lib/powerGridMap.js)
 * onStatus: (layerId, { state: 'loading' | 'ok' | 'error', text?, count? } | null) => void
 */
export default function PowerGridMapLayer({ layers, onStatus }) {
  const map = useMap();
  const stateRef = useRef({ groups: new Map(), loading: new Set(), renderers: null, attributed: false });
  const layersRef = useRef(layers);
  const onStatusRef = useRef(onStatus);
  layersRef.current = layers;
  onStatusRef.current = onStatus;
  const [legendHost, setLegendHost] = useState(null);
  const [fuelCounts, setFuelCounts] = useState(null);
  // Shared with the 3D globe's power plant tab.
  const [hiddenFuels, setHiddenFuels] = useHiddenFuels();
  const hiddenFuelsRef = useRef(hiddenFuels);
  hiddenFuelsRef.current = hiddenFuels;
  const showPlantLegend = Boolean(layers?.powerPlants);

  // Legend fuel toggles → plant circles and labels on the map.
  useEffect(() => {
    stateRef.current.groups.get('powerPlants')?.setHiddenFuels(hiddenFuels);
  }, [hiddenFuels]);

  // Centre the legend inside the map, clear of the side panels.
  useEffect(() => {
    if (!showPlantLegend) return undefined;
    const host = L.DomUtil.create('div', 'plant-legend-host', map.getContainer());
    L.DomEvent.disableClickPropagation(host);
    L.DomEvent.disableScrollPropagation(host);
    setLegendHost(host);
    return () => {
      host.remove();
      setLegendHost(null);
    };
  }, [map, showPlantLegend]);

  // Panes, renderers, zoom-based point sizes; tear everything down on unmount.
  useEffect(() => {
    const state = stateRef.current;
    ensurePane(map, LINE_PANE, 380);
    ensurePane(map, POINT_PANE, 390);
    state.renderers = {
      lines: L.canvas({ pane: LINE_PANE, padding: 0.4, tolerance: 5 }),
      points: L.canvas({ pane: POINT_PANE, padding: 0.4, tolerance: 3 }),
    };

    const onZoomEnd = () => {
      const zoom = map.getZoom();
      state.groups.forEach((group, layerId) => {
        if (GRID_LINE_LAYERS.has(layerId)) return;
        group.eachLayer((marker) => {
          const radius = radiusFor(layerId, zoom, marker.options.gridRecord);
          if (marker.getRadius() !== radius) marker.setRadius(radius);
        });
      });
    };
    map.on('zoomend', onZoomEnd);

    return () => {
      map.off('zoomend', onZoomEnd);
      state.groups.forEach((group) => map.removeLayer(group));
      state.groups.clear();
      state.loading.clear();
      state.renderers = null;
      if (state.attributed) {
        map.attributionControl?.removeAttribution(GRID_ATTRIBUTION);
        state.attributed = false;
      }
    };
  }, [map]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.renderers) return;
    let cancelled = false;

    const syncAttribution = () => {
      const osmOn = POWER_GRID_LAYER_IDS.some((id) => id !== 'powerPlants' && layersRef.current?.[id]);
      if (osmOn && !state.attributed) {
        map.attributionControl?.addAttribution(GRID_ATTRIBUTION);
        state.attributed = true;
      } else if (!osmOn && state.attributed) {
        map.attributionControl?.removeAttribution(GRID_ATTRIBUTION);
        state.attributed = false;
      }
    };
    syncAttribution();

    POWER_GRID_LAYER_IDS.forEach((layerId) => {
      const wanted = Boolean(layers?.[layerId]);
      const group = state.groups.get(layerId);

      if (group) {
        if (wanted && !map.hasLayer(group)) group.addTo(map);
        if (!wanted && map.hasLayer(group)) map.removeLayer(group);
        return;
      }
      if (!wanted || state.loading.has(layerId)) return;

      state.loading.add(layerId);
      onStatusRef.current?.(layerId, { state: 'loading', text: 'Loading…' });
      loadRecords(layerId)
        .then((records) => {
          state.loading.delete(layerId);
          if (!state.renderers) return; // unmounted meanwhile
          const built = buildGroup(layerId, records, state.renderers, map.getZoom());
          state.groups.set(layerId, built);
          if (layerId === 'powerPlants') {
            setFuelCounts(countPlantsByFuel(records));
            built.setHiddenFuels(hiddenFuelsRef.current);
          }
          if (layersRef.current?.[layerId]) built.addTo(map);
          onStatusRef.current?.(layerId, { state: 'ok', count: records.length });
        })
        .catch((error) => {
          state.loading.delete(layerId);
          if (!cancelled) {
            console.error(`Power grid layer "${layerId}" failed to load:`, error);
          }
          onStatusRef.current?.(layerId, {
            state: 'error',
            text: error instanceof TypeError ? 'Data file unreachable' : error?.message || 'Failed to load',
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [map, layers]);

  return legendHost ? createPortal(
        <PowerPlantLegend counts={fuelCounts} hiddenFuels={hiddenFuels} onHiddenFuelsChange={setHiddenFuels} />,
        legendHost
      ) : null;
}
