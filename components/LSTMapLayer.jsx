import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Pane, TileLayer, useMap } from 'react-leaflet';
import {
  LST_TILE_ATTRIBUTION,
  buildArcGISLSTExportImageUrl,
  buildLSTTileUrl,
  getLSTSource,
  normalizeArcGISImageServiceUrl,
  normalizeLSTDate,
} from '../lib/lstService';

const TRANSPARENT_TILE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const WEB_MERCATOR_BOUNDS = [
  [-85.051129, -180],
  [85.051129, 180],
];

function LSTMapLayer({
  date,
  sourceId,
  compareDate,
  compareEnabled = false,
  opacity = 0.74,
  splitPosition = 50,
  refreshKey = 0,
  arcgisServiceUrl,
  arcgisToken = '',
  arcgisRasterFunction,
  arcgisWindowDays,
}) {
  const source = getLSTSource(sourceId);
  const safeDate = normalizeLSTDate(date);
  const safeCompareDate = normalizeLSTDate(compareDate, safeDate);
  const safeOpacity = clamp(Number(opacity), 0.2, 1);
  const safeSplit = clamp(Number(splitPosition), 12, 88);
  const showComparison = Boolean(compareEnabled && safeCompareDate && source.dateMode !== 'static');
  const isArcGISImageServer = source.serviceType === 'arcgisImageServer';
  const effectiveArcGISServiceUrl = normalizeArcGISImageServiceUrl(
    arcgisServiceUrl || source.defaultServiceUrl
  );
  const effectiveArcGISRasterFunction =
    arcgisRasterFunction === undefined || arcgisRasterFunction === null
      ? source.defaultRasterFunction
      : arcgisRasterFunction;
  const attribution = source.attribution || LST_TILE_ATTRIBUTION;

  const currentUrl = useMemo(
    () => (isArcGISImageServer ? '' : withRefreshKey(buildLSTTileUrl(source.id, safeDate), refreshKey)),
    [isArcGISImageServer, refreshKey, safeDate, source.id]
  );
  const compareUrl = useMemo(
    () =>
      isArcGISImageServer
        ? ''
        : withRefreshKey(buildLSTTileUrl(source.id, safeCompareDate), refreshKey),
    [isArcGISImageServer, refreshKey, safeCompareDate, source.id]
  );

  const sharedTileProps = {
    attribution,
    bounds: WEB_MERCATOR_BOUNDS,
    errorTileUrl: TRANSPARENT_TILE,
    maxNativeZoom: source.maxNativeZoom,
    maxZoom: 18,
    minZoom: 1,
    opacity: safeOpacity,
    tileSize: 256,
    updateWhenIdle: true,
  };

  return (
    <>
      {showComparison ? (
        <Pane
          name="lst-compare-pane"
          style={{
            clipPath: `inset(0 ${100 - safeSplit}% 0 0)`,
            pointerEvents: 'none',
            zIndex: 335,
          }}
        >
          {isArcGISImageServer ? (
            <ArcGISImageServerTileLayer
              key={`lst-compare-arcgis-${source.id}-${safeCompareDate}-${refreshKey}`}
              attribution={attribution}
              date={safeCompareDate}
              mosaicWindowDays={arcgisWindowDays}
              opacity={safeOpacity}
              pane="lst-compare-pane"
              rasterFunction={effectiveArcGISRasterFunction}
              refreshKey={refreshKey}
              serviceUrl={effectiveArcGISServiceUrl}
              token={arcgisToken}
            />
          ) : (
            <TileLayer
              key={`lst-compare-${source.id}-${safeCompareDate}-${refreshKey}`}
              url={compareUrl}
              {...sharedTileProps}
            />
          )}
        </Pane>
      ) : null}
      <Pane
        name="lst-current-pane"
        style={{
          clipPath: showComparison ? `inset(0 0 0 ${safeSplit}%)` : 'none',
          pointerEvents: 'none',
          zIndex: 340,
        }}
      >
        {isArcGISImageServer ? (
          <ArcGISImageServerTileLayer
            key={`lst-current-arcgis-${source.id}-${safeDate}-${refreshKey}`}
            attribution={attribution}
            date={safeDate}
            mosaicWindowDays={arcgisWindowDays}
            opacity={safeOpacity}
            pane="lst-current-pane"
            rasterFunction={effectiveArcGISRasterFunction}
            refreshKey={refreshKey}
            serviceUrl={effectiveArcGISServiceUrl}
            token={arcgisToken}
          />
        ) : (
          <TileLayer
            key={`lst-current-${source.id}-${safeDate}-${refreshKey}`}
            url={currentUrl}
            {...sharedTileProps}
          />
        )}
      </Pane>
    </>
  );
}

function ArcGISImageServerTileLayer({
  attribution,
  date,
  mosaicWindowDays,
  opacity,
  pane,
  rasterFunction,
  refreshKey,
  serviceUrl,
  token,
}) {
  const map = useMap();
  const safeServiceUrl = normalizeArcGISImageServiceUrl(serviceUrl);

  useEffect(() => {
    if (!map || !safeServiceUrl) {
      return undefined;
    }

    const layer = createArcGISImageServerGridLayer({
      attribution,
      date,
      mosaicWindowDays,
      opacity,
      pane,
      rasterFunction,
      refreshKey,
      serviceUrl: safeServiceUrl,
      token,
    });

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [
    attribution,
    date,
    map,
    mosaicWindowDays,
    opacity,
    pane,
    rasterFunction,
    refreshKey,
    safeServiceUrl,
    token,
  ]);

  return null;
}

function createArcGISImageServerGridLayer(options) {
  const ArcGISImageServerGridLayer = L.GridLayer.extend({
    createTile(coords, done) {
      const tile = L.DomUtil.create('img', 'leaflet-tile');
      const tileSize = this.getTileSize();
      let completed = false;

      tile.alt = '';
      tile.decoding = 'async';
      tile.setAttribute('role', 'presentation');

      const bounds = this._tileCoordsToBounds(coords);
      const crs = this._map?.options?.crs || L.CRS.EPSG3857;
      const northWest = crs.project(bounds.getNorthWest());
      const southEast = crs.project(bounds.getSouthEast());
      const bbox = [northWest.x, southEast.y, southEast.x, northWest.y].join(',');
      const tileUrl = buildArcGISLSTExportImageUrl({
        bbox,
        date: this.options.date,
        height: tileSize.y,
        mosaicWindowDays: this.options.mosaicWindowDays,
        rasterFunction: this.options.rasterFunction,
        refreshKey: this.options.refreshKey,
        serviceUrl: this.options.serviceUrl,
        token: this.options.token,
        width: tileSize.x,
      });

      const finish = () => {
        if (completed) {
          return;
        }

        completed = true;
        done(null, tile);
      };

      tile.onload = finish;
      tile.onerror = () => {
        tile.onerror = null;
        tile.onload = null;
        tile.src = TRANSPARENT_TILE;
        finish();
      };
      tile.src = tileUrl || TRANSPARENT_TILE;

      return tile;
    },
  });

  return new ArcGISImageServerGridLayer({
    ...options,
    bounds: WEB_MERCATOR_BOUNDS,
    maxZoom: 18,
    minZoom: 1,
    tileSize: 256,
    updateWhenIdle: true,
  });
}

function withRefreshKey(url, refreshKey) {
  return refreshKey ? `${url}?refresh=${refreshKey}` : url;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export default LSTMapLayer;
