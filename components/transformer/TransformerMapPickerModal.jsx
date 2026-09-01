import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, LocateFixed, RotateCcw } from 'lucide-react';
import GeoSearchControl from '../GeoSearchControl';
import { MAP_BASE_LAYERS, SATELLITE_LABELS_LAYER } from '../../lib/mapBaseLayers';
import { DEFAULT_TRANSFORMER_POSITION } from '../../lib/transformerDraft';
import { getCurrentLocation, isLocationSecureContext, isLocationSupported } from '../../lib/locationService';
import { AppTooltip } from '../ui/app-tooltip';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const PICKER_MAX_ZOOM = 21;
const PICKER_MAX_NATIVE_ZOOM = 19;
const PICKER_PLACED_ZOOM = 18;
const PICKER_FALLBACK_ZOOM = 12;
const COORDINATE_PAIR_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*[,;/\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

const pickerMarkerIcon = L.divIcon({
  className: 'custom-transformer-icon',
  html: `
    <div class="map-marker-shell" style="--marker-color: #0f766e">
      <div class="map-marker-core"></div>
      <div class="map-marker-stem"></div>
    </div>
  `,
  iconSize: [34, 42],
  iconAnchor: [17, 38],
});

function toValidPosition(position) {
  const latitude = Number(position?.[0]);
  const longitude = Number(position?.[1]);

  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
}

function formatCoordinateText(value) {
  return Number.isFinite(value) ? value.toFixed(6) : '';
}

function parseCoordinatePair(value) {
  const match = COORDINATE_PAIR_PATTERN.exec(String(value ?? ''));
  if (!match) {
    return null;
  }

  return toValidPosition([match[1], match[2]]);
}

function readCoordinateInputs(latitudeText, longitudeText) {
  const trimmedLatitude = String(latitudeText ?? '').trim();
  const trimmedLongitude = String(longitudeText ?? '').trim();

  if (!trimmedLatitude || !trimmedLongitude) {
    return { error: 'Enter both latitude and longitude before moving the pin.' };
  }

  const latitude = Number(trimmedLatitude);
  const longitude = Number(trimmedLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: 'Latitude and longitude must be plain decimal numbers, for example 3.205647 and 101.669884.' };
  }
  if (latitude < -90 || latitude > 90) {
    return { error: 'Latitude must be between -90 and 90.' };
  }
  if (longitude < -180 || longitude > 180) {
    return { error: 'Longitude must be between -180 and 180.' };
  }

  return { position: [latitude, longitude] };
}

function MapSizeSync() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    // The dialog scales in, so the map is measured before it reaches its final box.
    const timeoutIds = [60, 240, 520].map((delay) => window.setTimeout(invalidate, delay));
    let resizeObserver = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(invalidate);
      resizeObserver.observe(map.getContainer());
    }

    window.addEventListener('resize', invalidate);

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      resizeObserver?.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);

  return null;
}

function MapViewController({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target) {
      return;
    }

    if (target.bounds) {
      map.fitBounds(target.bounds, { maxZoom: PICKER_PLACED_ZOOM, animate: true });
      return;
    }

    map.flyTo(target.center, target.zoom ?? Math.max(map.getZoom(), PICKER_PLACED_ZOOM), { duration: 0.7 });
  }, [map, target]);

  return null;
}

function MapRefCapture({ mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;

    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);

  return null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click: (event) => {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function MapPickerBody({ position, assetLabel, onCancel, onConfirm }) {
  const mapRef = useRef(null);
  const initialPosition = useMemo(
    () => toValidPosition(position) || [...DEFAULT_TRANSFORMER_POSITION],
    // Only the position this session opened with matters; later edits live in local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // A record still sitting on the app-wide default has never really been placed, so open wider
  // and let the user search or pan instead of dropping them into a random street at zoom 18.
  const isUnplacedPosition =
    initialPosition[0] === DEFAULT_TRANSFORMER_POSITION[0] &&
    initialPosition[1] === DEFAULT_TRANSFORMER_POSITION[1];

  const [draftPosition, setDraftPosition] = useState(initialPosition);
  const [latitudeText, setLatitudeText] = useState(() => formatCoordinateText(initialPosition[0]));
  const [longitudeText, setLongitudeText] = useState(() => formatCoordinateText(initialPosition[1]));
  const [baseLayerKey, setBaseLayerKey] = useState('streets');
  const [viewTarget, setViewTarget] = useState(null);
  const [coordinateError, setCoordinateError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const activeBaseLayer = MAP_BASE_LAYERS[baseLayerKey] || MAP_BASE_LAYERS.streets;

  const movePin = useCallback((nextPosition, { fly = false, zoom } = {}) => {
    const validPosition = toValidPosition(nextPosition);
    if (!validPosition) {
      return;
    }

    setDraftPosition(validPosition);
    setLatitudeText(formatCoordinateText(validPosition[0]));
    setLongitudeText(formatCoordinateText(validPosition[1]));
    setCoordinateError('');

    if (fly) {
      setViewTarget({ center: validPosition, zoom });
    }
  }, []);

  const handleMarkerDragEnd = useCallback(
    (event) => {
      const nextLatLng = event.target.getLatLng();
      movePin([nextLatLng.lat, nextLatLng.lng]);
    },
    [movePin]
  );

  const markerEventHandlers = useMemo(() => ({ dragend: handleMarkerDragEnd }), [handleMarkerDragEnd]);

  const handleCoordinateTextChange = (field) => (event) => {
    const { value } = event.target;
    const pastedPair = parseCoordinatePair(value);

    if (pastedPair) {
      movePin(pastedPair, { fly: true });
      return;
    }

    setCoordinateError('');
    if (field === 'latitude') {
      setLatitudeText(value);
    } else {
      setLongitudeText(value);
    }
  };

  const applyManualCoordinates = () => {
    const result = readCoordinateInputs(latitudeText, longitudeText);

    if (result.error) {
      setCoordinateError(result.error);
      return;
    }

    movePin(result.position, { fly: true });
  };

  const handleCoordinateKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyManualCoordinates();
    }
  };

  const handleGeoSearchPlaceSelect = (place) => {
    const placePosition = toValidPosition(place?.position);
    if (!placePosition) {
      return;
    }

    movePin(placePosition);

    if (Array.isArray(place?.boundingBox) && place.boundingBox.length === 4) {
      const [south, north, west, east] = place.boundingBox;
      setViewTarget({
        center: placePosition,
        bounds: [
          [south, west],
          [north, east],
        ],
      });
      return;
    }

    setViewTarget({ center: placePosition, zoom: PICKER_PLACED_ZOOM });
  };

  const handleUseCurrentLocation = async () => {
    setLocationError('');

    if (!isLocationSupported()) {
      setLocationError('This browser does not support GPS location.');
      return;
    }
    if (!isLocationSecureContext()) {
      setLocationError('Browser GPS needs a secure page. Open this app on HTTPS or localhost.');
      return;
    }

    setIsLocating(true);
    try {
      const snapshot = await getCurrentLocation();
      movePin([snapshot.latitude, snapshot.longitude], { fly: true, zoom: PICKER_PLACED_ZOOM });
    } catch (error) {
      setLocationError(error?.message || 'Unable to read the current location from this browser.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleResetPin = () => {
    setLocationError('');
    movePin(initialPosition, { fly: true, zoom: PICKER_PLACED_ZOOM });
  };

  const handleConfirm = () => {
    const result = readCoordinateInputs(latitudeText, longitudeText);

    if (result.error) {
      setCoordinateError(result.error);
      return;
    }

    onConfirm(result.position);
  };

  return (
    <>
      <DialogHeader className="shrink-0 pr-12">
        <DialogTitle>Pick the map placement</DialogTitle>
        <DialogDescription>
          Click anywhere on the map to drop the pin{assetLabel ? ` for ${assetLabel}` : ''}, drag it to fine tune, or type
          the coordinates below if you already know them.
        </DialogDescription>
      </DialogHeader>

      <div className="relative z-[30] flex shrink-0 flex-col gap-2 border-b border-[color:var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <GeoSearchControl
          mapRef={mapRef}
          onSelectPlace={handleGeoSearchPlaceSelect}
          defaultExpanded
          placeholder="Search a site, road, or place to jump there"
          expandedClassName="w-full sm:w-[360px] lg:w-[440px]"
        />

        <div className="flex shrink-0 items-center gap-1 self-start rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-1 sm:self-auto">
          {Object.entries(MAP_BASE_LAYERS).map(([layerKey, layer]) => {
            const isActive = baseLayerKey === layerKey;
            const LayerIcon = layer.icon;

            return (
              <AppTooltip key={layerKey} content={layer.label}>
                <button
                  type="button"
                  onClick={() => setBaseLayerKey(layerKey)}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent transition-colors',
                    isActive
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                      : 'text-[var(--foreground)]/80 hover:border-[color:var(--border)] hover:bg-[var(--card)] hover:text-[var(--foreground)]'
                  )}
                  aria-label={layer.label}
                  aria-pressed={isActive}
                >
                  <LayerIcon className="h-4 w-4" />
                  <span className="sr-only">{layer.label}</span>
                </button>
              </AppTooltip>
            );
          })}
        </div>
      </div>

      {/* `isolate` keeps Leaflet's own z-indexes (panes, controls) from painting over the toolbar dropdown. */}
      <div className="tx-map-picker-canvas relative isolate flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <MapContainer
          center={initialPosition}
          zoom={isUnplacedPosition ? PICKER_FALLBACK_ZOOM : PICKER_PLACED_ZOOM}
          maxZoom={PICKER_MAX_ZOOM}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            key={baseLayerKey}
            url={activeBaseLayer.url}
            attribution={activeBaseLayer.attribution}
            maxNativeZoom={PICKER_MAX_NATIVE_ZOOM}
            maxZoom={PICKER_MAX_ZOOM}
          />
          {baseLayerKey === 'hybrid' ? (
            <TileLayer
              url={SATELLITE_LABELS_LAYER.url}
              attribution={SATELLITE_LABELS_LAYER.attribution}
              maxNativeZoom={PICKER_MAX_NATIVE_ZOOM}
              maxZoom={PICKER_MAX_ZOOM}
            />
          ) : null}
          <ZoomControl position="topleft" />
          <MapSizeSync />
          <MapViewController target={viewTarget} />
          <MapClickHandler onPick={movePin} />
          <Marker
            position={draftPosition}
            icon={pickerMarkerIcon}
            draggable
            autoPan
            eventHandlers={markerEventHandlers}
          />
        </MapContainer>

        <div className="pointer-events-none absolute left-1/2 top-3 z-[900] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-[var(--primary)] px-4 py-1.5 text-center text-xs font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)]">
          Click the map to move the pin, or drag it
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-[color:var(--border)] px-4 py-3 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">Latitude</span>
            <Input
              value={latitudeText}
              onChange={handleCoordinateTextChange('latitude')}
              onKeyDown={handleCoordinateKeyDown}
              inputMode="decimal"
              placeholder="3.205647"
              aria-label="Latitude"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">Longitude</span>
            <Input
              value={longitudeText}
              onChange={handleCoordinateTextChange('longitude')}
              onKeyDown={handleCoordinateKeyDown}
              inputMode="decimal"
              placeholder="101.669884"
              aria-label="Longitude"
            />
          </label>
          <Button type="button" variant="secondary" onClick={applyManualCoordinates} className="sm:w-[150px]">
            <Crosshair className="h-4 w-4" />
            Move pin here
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
          >
            <LocateFixed className={cn('h-4 w-4', isLocating && 'animate-pulse')} />
            {isLocating ? 'Reading GPS...' : 'Use my location'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleResetPin}>
            <RotateCcw className="h-4 w-4" />
            Reset pin
          </Button>
          <span className="text-xs text-[var(--muted)]">
            You can paste a full coordinate pair such as 3.205647, 101.669884 into either field.
          </span>
        </div>

        {coordinateError ? (
          <p className="rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/55 px-3 py-2 text-xs text-[var(--danger-strong)]">
            {coordinateError}
          </p>
        ) : null}

        {locationError ? (
          <p className="rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/55 px-3 py-2 text-xs text-[var(--danger-strong)]">
            {locationError}
          </p>
        ) : null}
      </div>

      <DialogFooter className="shrink-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm}>
          Use this location
        </Button>
      </DialogFooter>
    </>
  );
}

function TransformerMapPickerModal({ open, position, assetLabel, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : null)}>
      <DialogContent className="tx-map-picker-dialog mobile-fullscreen-dialog flex h-full w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:h-[88vh] sm:max-h-[900px] sm:w-[95vw] sm:max-w-[1040px]">
        <MapPickerBody
          position={position}
          assetLabel={assetLabel}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

export default TransformerMapPickerModal;
