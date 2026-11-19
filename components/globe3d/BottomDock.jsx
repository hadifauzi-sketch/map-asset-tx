import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Home,
  Layers3,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Moon,
  Plus,
  Rotate3d,
  Search,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { MAP_SOURCES } from '../../lib/globe3d/mapSources';
import { VISUAL_PRESETS } from '../../lib/globe3d/visualPresets';
import { NIGHT_MODES } from '../../lib/globe3d/nightModes';
import LightPollutionLegend from './LightPollutionLegend';
import { hasValidPosition } from '../../lib/globe3d/assetSummary';
import { cn } from '../../lib/utils';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** "3.139, 101.687" or "3.139 101.687" → { latitude, longitude } */
function parseCoordinates(text) {
  const match = String(text)
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  return { latitude, longitude };
}

function LocationSearch({ transformers, placeSearchEnabled, onSelectAsset, onFlyTo }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const rootRef = useRef(null);

  const assetMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      return [];
    }
    return transformers
      .filter((transformer) =>
        [transformer.txName, transformer.siteName, transformer.mnemonic, transformer.serialNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      )
      .slice(0, 5);
  }, [query, transformers]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) {
      return;
    }

    const coordinates = parseCoordinates(text);
    if (coordinates) {
      onFlyTo(coordinates.latitude, coordinates.longitude);
      setOpen(false);
      return;
    }

    // Google Photorealistic 3D Tiles may only be combined with Google's own
    // geocoder, so the OpenStreetMap place search is off while they are shown.
    if (!placeSearchEnabled) {
      setPlaces([]);
      setMessage('Place search is off on Google 3D. Search a Tx name or lat, lon, or switch map source.');
      setOpen(true);
      return;
    }

    setBusy(true);
    setMessage('');
    setOpen(true);
    try {
      const params = new URLSearchParams({ q: text, format: 'jsonv2', limit: '5', countrycodes: 'my' });
      const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const results = await response.json();
      setPlaces(Array.isArray(results) ? results : []);
      if (!Array.isArray(results) || results.length === 0) {
        setMessage(assetMatches.length ? '' : 'No place found in Malaysia for that search.');
      }
    } catch {
      setPlaces([]);
      setMessage('Place search is unavailable right now.');
    } finally {
      setBusy(false);
    }
  };

  const showResults = open && (assetMatches.length > 0 || places.length > 0 || message);

  return (
    <form ref={rootRef} className="g3d-dock-search" onSubmit={submit} role="search">
      <MapPin className="g3d-dock-search-icon" aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder={placeSearchEnabled ? 'Location, Tx name or lat, lon' : 'Tx name or lat, lon'}
        aria-label="Search location, transformer or coordinates"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setPlaces([]);
          setMessage('');
          setOpen(true);
        }}
      />
      <button type="submit" className="g3d-dock-search-submit" aria-label="Search" disabled={busy}>
        {busy ? <Loader2 className="g3d-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
      </button>

      {showResults ? (
        <div className="g3d-popover g3d-search-results">
          {assetMatches.length > 0 ? <p className="g3d-popover-label">Transformers</p> : null}
          {assetMatches.map((transformer) => (
            <button
              key={transformer.id}
              type="button"
              className="g3d-result-row"
              disabled={!hasValidPosition(transformer)}
              onClick={() => {
                onSelectAsset(transformer.id);
                setOpen(false);
              }}
            >
              <Zap aria-hidden="true" />
              <span>
                <strong>{transformer.txName || 'Unnamed transformer'}</strong>
                <small>{transformer.siteName || 'Unknown site'}</small>
              </span>
            </button>
          ))}
          {places.length > 0 ? <p className="g3d-popover-label">Places</p> : null}
          {places.map((place) => (
            <button
              key={place.place_id}
              type="button"
              className="g3d-result-row"
              onClick={() => {
                onFlyTo(Number(place.lat), Number(place.lon));
                setOpen(false);
              }}
            >
              <MapPin aria-hidden="true" />
              <span>
                <strong>{String(place.display_name || '').split(',')[0]}</strong>
                <small>{String(place.display_name || '').split(',').slice(1, 4).join(',').trim()}</small>
              </span>
            </button>
          ))}
          {message ? <p className="g3d-popover-message">{message}</p> : null}
          {!message && places.length === 0 && assetMatches.length > 0 && placeSearchEnabled ? (
            <p className="g3d-popover-message">Press Enter to also search places.</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** Bottom dock: location search, camera controls, visual presets + map source. */
export default function BottomDock({
  transformers,
  mapSource,
  visualPreset,
  nightMode = 'lights',
  availableKeys,
  placeSearchEnabled = true,
  onSelectAsset,
  onFlyTo,
  onCamera,
  onMapSourceChange,
  onVisualPresetChange,
  onNightModeChange = () => {},
  onOpenKeys,
}) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef(null);

  useEffect(() => {
    if (!presetsOpen) {
      return undefined;
    }
    const onPointerDown = (event) => {
      if (presetsRef.current && !presetsRef.current.contains(event.target)) {
        setPresetsOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPresetsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [presetsOpen]);

  const cameraButtons = [
    { id: 'home', label: 'Frame all transformers', icon: Home },
    { id: 'north', label: 'North up', icon: Compass },
    { id: 'tilt', label: 'Toggle tilt (top-down / oblique)', icon: Rotate3d },
    { id: 'zoomOut', label: 'Zoom out', icon: Minus },
    { id: 'zoomIn', label: 'Zoom in', icon: Plus },
  ];

  const showFloatingLegend =
    !presetsOpen && visualPreset === 'night' && (nightMode === 'pollution' || nightMode === 'pollutionCity');

  return (
    <div className="g3d-dock">
      {showFloatingLegend ? <LightPollutionLegend compact className="g3d-dock-legend" /> : null}
      <LocationSearch
        transformers={transformers}
        placeSearchEnabled={placeSearchEnabled}
        onSelectAsset={onSelectAsset}
        onFlyTo={onFlyTo}
      />

      <div className="g3d-dock-camera" role="toolbar" aria-label="Camera controls">
        {cameraButtons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              key={button.id}
              type="button"
              className="g3d-dock-button"
              onClick={() => onCamera(button.id)}
              aria-label={button.label}
              title={button.label}
            >
              <Icon aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div ref={presetsRef} className="g3d-dock-presets">
        <button
          type="button"
          className={cn('g3d-dock-toggle', presetsOpen && 'is-active')}
          aria-expanded={presetsOpen}
          onClick={() => setPresetsOpen((current) => !current)}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span>Visual presets</span>
        </button>

        {presetsOpen ? (
          <div className="g3d-popover g3d-presets-popover">
            <p className="g3d-popover-label">Sensor look</p>
            <div className="g3d-preset-grid">
              {VISUAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn('g3d-preset', visualPreset === preset.id && 'is-active')}
                  aria-pressed={visualPreset === preset.id}
                  onClick={() => onVisualPresetChange(preset.id)}
                >
                  <span className={cn('g3d-preset-swatch', `g3d-preset-swatch--${preset.id}`)} aria-hidden="true" />
                  <strong>{preset.label}</strong>
                  <small>{preset.hint}</small>
                </button>
              ))}
            </div>

            {visualPreset === 'night' ? (
              <>
                <p className="g3d-popover-label">
                  <Moon aria-hidden="true" /> Night mode
                </p>
                <div className="g3d-night-modes" role="group" aria-label="Night mode">
                  {NIGHT_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={cn('g3d-night-mode', nightMode === mode.id && 'is-active')}
                      aria-pressed={nightMode === mode.id}
                      title={mode.hint}
                      onClick={() => onNightModeChange(mode.id)}
                    >
                      <span className={cn('g3d-night-swatch', `g3d-night-swatch--${mode.id}`)} aria-hidden="true" />
                      <strong>{mode.label}</strong>
                      <small>{mode.hint}</small>
                    </button>
                  ))}
                </div>
                {nightMode === 'pollution' || nightMode === 'pollutionCity' ? (
                  <LightPollutionLegend className="g3d-night-legend" />
                ) : null}
              </>
            ) : null}

            <p className="g3d-popover-label">
              <Layers3 aria-hidden="true" /> Map source
            </p>
            <div className="g3d-source-row">
              {MAP_SOURCES.map((source) => {
                const locked = Boolean(source.requires && !availableKeys[source.requires]);
                return (
                  <button
                    key={source.id}
                    type="button"
                    className={cn('g3d-source', mapSource === source.id && !locked && 'is-active', locked && 'is-locked')}
                    aria-pressed={mapSource === source.id && !locked}
                    title={locked ? 'Needs an API key — click to add one' : source.tag}
                    onClick={() => {
                      if (locked) {
                        setPresetsOpen(false);
                        onOpenKeys();
                        return;
                      }
                      onMapSourceChange(source.id);
                    }}
                  >
                    {locked ? <Lock aria-hidden="true" /> : null}
                    {source.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
