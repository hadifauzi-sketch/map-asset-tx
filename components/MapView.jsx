import React, { memo, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import TransformerMarker from './TransformerMarker';
import LSTMapLayer from './LSTMapLayer';
import WeatherMapLayer from './WeatherMapLayer';
import PowerGridMapLayer from './PowerGridMapLayer';
import DataCentreMapLayer from './DataCentreMapLayer';
import CompanyBoundaryMapLayer from './CompanyBoundaryMapLayer';
import FloorPlanMapLayer from './FloorPlanMapLayer';
import { MAP_BASE_LAYERS, SATELLITE_LABELS_LAYER } from '../lib/mapBaseLayers';

const MARKER_CLUSTER_DISABLE_AT_ZOOM = 15;
const DEFAULT_MARKER_COLOR = '#16a34a';

const transformerIconCache = new Map();

// One shared L.divIcon per colour. A fresh icon object on every render made
// react-leaflet call setIcon() and rebuild every marker's DOM.
function createTransformerIcon(color = '#0f766e') {
  const cached = transformerIconCache.get(color);
  if (cached) {
    return cached;
  }
  const icon = L.divIcon({
    className: 'custom-transformer-icon',
    html: `
      <div class="map-marker-shell" style="--marker-color: ${color}">
        <div class="map-marker-core"></div>
        <div class="map-marker-stem"></div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -30],
  });
  transformerIconCache.set(color, icon);
  return icon;
}

const geoSearchIcon = L.divIcon({
  className: 'geo-search-pin-icon',
  html: '<div class="geo-search-pin"><div class="geo-search-pin-dot"></div></div>',
  iconSize: [34, 42],
  iconAnchor: [17, 38],
  popupAnchor: [0, -32],
});

function MapUpdater({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.75 });
  }, [center, zoom, map]);

  return null;
}

function MapRefCapture({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function MapClickHandler({ onMapClick, onMapContextMenu }) {
  useMapEvents({
    click: (event) => {
      onMapClick(event);
    },
    contextmenu: (event) => {
      onMapContextMenu?.(event);
    },
  });

  return null;
}

function MapInteractionController({ sidebarActive }) {
  const map = useMap();
  const isHoveringRef = useRef(false);
  const sidebarActiveRef = useRef(sidebarActive);

  // Keep ref in sync with latest prop value so event handlers always read fresh state
  useEffect(() => {
    sidebarActiveRef.current = sidebarActive;
  });

  // Register mouse enter/leave listeners once — handlers read refs to avoid stale closures
  useEffect(() => {
    const container = map.getContainer();

    map.scrollWheelZoom.disable();

    const handleMouseEnter = () => {
      isHoveringRef.current = true;
      if (!sidebarActiveRef.current) {
        map.scrollWheelZoom.enable();
      }
    };

    const handleMouseLeave = () => {
      isHoveringRef.current = false;
      map.scrollWheelZoom.disable();
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [map]);

  // When sidebarActive changes, sync scroll wheel zoom state immediately
  useEffect(() => {
    if (sidebarActive) {
      map.scrollWheelZoom.disable();
    } else if (isHoveringRef.current) {
      // Mouse is already inside the map — re-enable without requiring a mouse-out/in
      map.scrollWheelZoom.enable();
    }
  }, [sidebarActive, map]);

  return null;
}

/**
 * The 2D Leaflet map with every overlay and the transformer markers.
 *
 * Memoised: App re-renders on every piece of state it owns (dialogs, notices,
 * toolbar, tool panels …). MapView only re-renders when one of the props the
 * map actually draws changes. Every prop is a primitive, a state value, a
 * memoised value or a ref, and all callbacks arrive through `handlers`, an
 * object with stable identities (see lib/useStableHandlers.js). Keep it that
 * way: passing an inline object, array or lambda here re-renders the map on
 * every App render.
 */
function MapView({
  mapCenter,
  mapZoom,
  mapBaseLayer,
  leafletMapRef,
  isSidebarInteracting,
  isLSTOverlayVisible,
  lstDate,
  lstCompareDate,
  lstSourceId,
  lstCompareEnabled,
  lstOpacity,
  lstCompareSplit,
  lstRefreshKey,
  lstArcgisServiceUrl,
  lstArcgisToken,
  lstArcgisRasterFunction,
  lstArcgisWindowDays,
  companyBoundaries,
  showCompanyBoundaries,
  selectedCompanyBoundaryId,
  companyBoundaryDraft,
  floorPlans,
  showFloorPlans,
  selectedFloorPlanId,
  floorPlanDraft,
  transformers,
  markerColors,
  selectedTransformerId,
  markersDraggable,
  canEditAssets,
  powerGridLayers,
  onPowerGridStatus,
  dataCentreTracker,
  isGlobe3DOpen,
  isWeatherOverlayVisible,
  weatherRecords,
  weatherOptions,
  geoSearchSelection,
  handlers,
}) {
  const activeBaseLayer = MAP_BASE_LAYERS[mapBaseLayer];
  const markerClusterEnabled = !markersDraggable;

  const transformerMarkerNodes = useMemo(
    () =>
      transformers.map((transformer) => (
        <TransformerMarker
          key={transformer.id}
          transformer={transformer}
          icon={createTransformerIcon(markerColors.get(transformer.id) ?? DEFAULT_MARKER_COLOR)}
          isSelected={selectedTransformerId === transformer.id}
          isDraggable={markersDraggable}
          canManageAssets={canEditAssets}
          onDragEnd={handlers.onMarkerDragEnd}
          onEdit={handlers.onEditTransformer}
          onDelete={handlers.onDeleteTransformer}
          onViewDetails={handlers.onViewTransformerDetails}
          onSelect={handlers.onSelectTransformer}
        />
      )),
    [canEditAssets, handlers, markerColors, markersDraggable, selectedTransformerId, transformers]
  );

  return (
    <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" zoomControl={false}>
      <TileLayer attribution={activeBaseLayer.attribution} url={activeBaseLayer.url} />
      {mapBaseLayer === 'hybrid' ? (
        <TileLayer attribution={SATELLITE_LABELS_LAYER.attribution} url={SATELLITE_LABELS_LAYER.url} />
      ) : null}
      {isLSTOverlayVisible ? (
        <LSTMapLayer
          date={lstDate}
          compareDate={lstCompareDate}
          sourceId={lstSourceId}
          compareEnabled={lstCompareEnabled}
          opacity={lstOpacity}
          splitPosition={lstCompareSplit}
          refreshKey={lstRefreshKey}
          arcgisServiceUrl={lstArcgisServiceUrl}
          arcgisToken={lstArcgisToken}
          arcgisRasterFunction={lstArcgisRasterFunction}
          arcgisWindowDays={lstArcgisWindowDays}
        />
      ) : null}
      <MapUpdater center={mapCenter} zoom={mapZoom} />
      <MapRefCapture mapRef={leafletMapRef} />
      <MapInteractionController sidebarActive={isSidebarInteracting} />
      <MapClickHandler onMapClick={handlers.onMapClick} onMapContextMenu={handlers.onMapContextMenu} />
      <CompanyBoundaryMapLayer
        companyBoundaries={companyBoundaries}
        floorPlans={floorPlans}
        canManageAssets={canEditAssets}
        showCompanyBoundaries={showCompanyBoundaries}
        selectedCompanyBoundaryId={selectedCompanyBoundaryId}
        draft={companyBoundaryDraft}
        onSelectCompanyBoundary={handlers.onSelectCompanyBoundary}
        onEditCompanyBoundaryInfo={handlers.onEditCompanyBoundaryInfo}
        onEditCompanyBoundary={handlers.onEditCompanyBoundary}
        onDeleteCompanyBoundary={handlers.onDeleteCompanyBoundary}
        onDraftVertexMove={handlers.onCompanyBoundaryDraftVertexMove}
      />
      <FloorPlanMapLayer
        floorPlans={floorPlans}
        transformers={transformers}
        canManageAssets={canEditAssets}
        showFloorPlans={showFloorPlans}
        selectedFloorPlanId={selectedFloorPlanId}
        draft={floorPlanDraft}
        onSelectFloorPlan={handlers.onSelectFloorPlan}
        onOpenFloor={handlers.onOpenFloor}
        onEditFloorPlanInfo={handlers.onEditFloorPlanInfo}
        onEditFloorPlan={handlers.onEditFloorPlan}
        onDeleteFloorPlan={handlers.onDeleteFloorPlan}
        onDraftVertexMove={handlers.onFloorDraftVertexMove}
      />
      <PowerGridMapLayer layers={powerGridLayers} onStatus={onPowerGridStatus} />
      <DataCentreMapLayer tracker={dataCentreTracker} visible={!isGlobe3DOpen} />
      {isWeatherOverlayVisible ? (
        <WeatherMapLayer
          records={weatherRecords}
          options={weatherOptions}
          selectedRecordId={selectedTransformerId}
          onSelectRecord={handlers.onSelectWeatherRecord}
        />
      ) : null}
      {geoSearchSelection?.position ? (
        <Marker position={geoSearchSelection.position} icon={geoSearchIcon}>
          <Popup className="geo-search-popup">
            <div className="min-w-[190px] space-y-1 px-3 py-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {geoSearchSelection.title}
              </p>
              {geoSearchSelection.subtitle ? (
                <p className="text-xs text-[var(--muted)]">
                  {geoSearchSelection.subtitle}
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ) : null}
      {markerClusterEnabled ? (
        <MarkerClusterGroup
          chunkedLoading
          disableClusteringAtZoom={MARKER_CLUSTER_DISABLE_AT_ZOOM}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          removeOutsideVisibleBounds
        >
          {transformerMarkerNodes}
        </MarkerClusterGroup>
      ) : (
        transformerMarkerNodes
      )}
    </MapContainer>
  );
}

export default memo(MapView);
