import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Minus, Plus, MapPin, X, Crosshair } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { getAssetOwnerLabel } from '../../lib/assetOwner';
import { getTransformerState } from '../../lib/malaysiaStates';
import { cn } from '../../lib/utils';

/**
 * Hover preview for the Asset Access table.
 *
 * Hovering (or focusing / tapping) a transformer row opens a floating card with
 * the same detail block the map popup shows, plus a zoomed-in snapshot minimap
 * of where the asset sits. The minimap is a static tile mosaic — no Leaflet
 * instance is created, so opening and closing the card stays cheap even when
 * the admin sweeps the pointer down a 300-row table.
 */

const TILE_SIZE = 256;
const CARD_WIDTH = 320;
const MAP_INSET = 12; // horizontal padding around the minimap
// Content-box width of the mosaic. The tile offsets and the centre pin share
// this coordinate space, so it has to match the rendered box exactly.
const MAP_WIDTH = CARD_WIDTH - MAP_INSET * 2 - 2; // -2 for the 1px border
const MAP_HEIGHT = 172;
const MIN_ZOOM = 11;
const MAX_ZOOM = 19;
export const DEFAULT_MINIMAP_ZOOM = 17;
export const DEFAULT_MINIMAP_LAYER = 'satellite';

const OPEN_DELAY_MS = 160;
const CLOSE_DELAY_MS = 140;

const MINIMAP_LAYERS = {
  streets: {
    label: 'Map',
    tile: (z, x, y) => `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`,
    credit: '© OpenStreetMap',
  },
  satellite: {
    label: 'Satellite',
    tile: (z, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    overlay: (z, x, y) =>
      `https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
    credit: '© Esri',
  },
};

/* ─────────────────────── tile math ─────────────────────── */

function lngToTileX(lng, zoom) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

function hasCoordinates(asset) {
  return Number.isFinite(Number(asset?.latitude)) && Number.isFinite(Number(asset?.longitude));
}

/* ─────────────────────── minimap ─────────────────────── */

function AssetMiniMap({ lat, lng, zoom, layerKey, onZoomChange, onLayerChange }) {
  const layer = MINIMAP_LAYERS[layerKey] ?? MINIMAP_LAYERS[DEFAULT_MINIMAP_LAYER];

  const tiles = useMemo(() => {
    const worldSize = 2 ** zoom;
    const centerX = lngToTileX(lng, zoom) * TILE_SIZE;
    const centerY = latToTileY(lat, zoom) * TILE_SIZE;
    const left = centerX - MAP_WIDTH / 2;
    const top = centerY - MAP_HEIGHT / 2;

    const out = [];
    for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + MAP_WIDTH) / TILE_SIZE); x += 1) {
      for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + MAP_HEIGHT) / TILE_SIZE); y += 1) {
        if (y < 0 || y >= worldSize) continue;
        out.push({
          key: `${x}:${y}`,
          x: ((x % worldSize) + worldSize) % worldSize,
          y,
          left: x * TILE_SIZE - left,
          top: y * TILE_SIZE - top,
        });
      }
    }
    return out;
  }, [lat, lng, zoom]);

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[color:var(--border)] bg-[var(--card-muted)]"
      style={{ width: MAP_WIDTH, height: MAP_HEIGHT, boxSizing: 'content-box' }}
    >
      <div className="absolute inset-0">
        {tiles.map((tile) => (
          <React.Fragment key={`${layerKey}-${zoom}-${tile.key}`}>
            <img
              src={layer.tile(zoom, tile.x, tile.y)}
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
              className="absolute select-none"
              style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
            />
            {layer.overlay ? (
              <img
                src={layer.overlay(zoom, tile.x, tile.y)}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
                className="absolute select-none"
                style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {/* asset pin — always dead centre of the mosaic */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[var(--primary)] opacity-25" />
        <span className="relative block h-3.5 w-3.5 rounded-full border-2 border-white bg-[var(--primary)] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
      </div>

      {/* zoom controls */}
      <div className="absolute right-1.5 top-1.5 flex flex-col overflow-hidden rounded-md border border-black/20 bg-black/55 backdrop-blur-sm">
        <MiniMapButton
          label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + 1))}
        >
          <Plus className="h-3.5 w-3.5" />
        </MiniMapButton>
        <MiniMapButton
          label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </MiniMapButton>
      </div>

      {/* base layer toggle */}
      <div className="absolute left-1.5 top-1.5 flex overflow-hidden rounded-md border border-black/20 bg-black/55 backdrop-blur-sm">
        {Object.entries(MINIMAP_LAYERS).map(([key, option]) => (
          <button
            key={key}
            type="button"
            onClick={() => onLayerChange(key)}
            className={cn(
              'px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition',
              key === layerKey ? 'bg-[var(--primary)] text-white' : 'text-white/75 hover:text-white'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-2 text-[10px] text-white/85">
        <span className="rounded bg-black/55 px-1.5 py-0.5 font-mono backdrop-blur-sm">
          {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
        </span>
        <span className="rounded bg-black/55 px-1.5 py-0.5 backdrop-blur-sm">
          z{zoom} · {layer.credit}
        </span>
      </div>
    </div>
  );
}

function MiniMapButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 items-center justify-center text-white/85 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/* ─────────────────────── data loading ─────────────────────── */

const countsCache = new Map();

async function loadCounts(transformerId) {
  if (countsCache.has(transformerId)) {
    return countsCache.get(transformerId);
  }
  if (!isSupabaseConfigured) {
    return null;
  }
  const [oilRes, docRes] = await Promise.all([
    supabase.from('oil_tests').select('id', { count: 'exact', head: true }).eq('transformer_id', transformerId),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('transformer_id', transformerId),
  ]);
  if (oilRes.error) throw oilRes.error;
  if (docRes.error) throw docRes.error;
  const counts = { oilTests: oilRes.count ?? 0, documents: docRes.count ?? 0 };
  countsCache.set(transformerId, counts);
  return counts;
}

/* ─────────────────────── hover controller ─────────────────────── */

/**
 * Owns which asset is previewed, where the card is anchored, and the shared
 * minimap view settings (so zoom/base layer survive moving between rows).
 */
export function useAssetHoverPreview() {
  const [preview, setPreview] = useState(null); // { asset, rect, pinned }
  const [zoom, setZoom] = useState(DEFAULT_MINIMAP_ZOOM);
  const [layerKey, setLayerKey] = useState(DEFAULT_MINIMAP_LAYER);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setPreview(null);
  }, [clearTimers]);

  const open = useCallback(
    (asset, element, { immediate = false, pinned = false } = {}) => {
      if (!asset || !element) return;
      clearTimers();
      const show = () => setPreview({ asset, rect: element.getBoundingClientRect(), pinned });
      if (immediate) {
        show();
      } else {
        openTimer.current = setTimeout(show, OPEN_DELAY_MS);
      }
    },
    [clearTimers]
  );

  const scheduleClose = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    closeTimer.current = setTimeout(() => {
      setPreview((current) => (current?.pinned ? current : null));
    }, CLOSE_DELAY_MS);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const togglePinned = useCallback(
    (asset, element) => {
      clearTimers();
      setPreview((current) => {
        if (current?.pinned && current.asset?.id === asset?.id) {
          return null;
        }
        return { asset, rect: element.getBoundingClientRect(), pinned: true };
      });
    },
    [clearTimers]
  );

  /** Props to spread on a table row so it drives the preview. */
  const getRowProps = useCallback(
    (asset) => ({
      onMouseEnter: (event) => open(asset, event.currentTarget),
      onMouseLeave: scheduleClose,
      onFocus: (event) => open(asset, event.currentTarget, { immediate: true }),
      onBlur: scheduleClose,
    }),
    [open, scheduleClose]
  );

  return {
    preview,
    zoom,
    layerKey,
    setZoom,
    setLayerKey,
    open,
    close,
    scheduleClose,
    cancelClose,
    togglePinned,
    getRowProps,
  };
}

/* ─────────────────────── the card ─────────────────────── */

export function AssetHoverCard({ preview, zoom, layerKey, onZoomChange, onLayerChange, onPointerEnter, onPointerLeave, onClose }) {
  const cardRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [counts, setCounts] = useState(null);
  const [countsError, setCountsError] = useState(false);

  const asset = preview?.asset ?? null;
  const assetId = asset?.id ?? null;

  // Load oil-test / document counts on demand, cached across hovers.
  useEffect(() => {
    if (!assetId) return undefined;
    let cancelled = false;
    setCounts(countsCache.get(assetId) ?? null);
    setCountsError(false);
    loadCounts(assetId)
      .then((result) => {
        if (!cancelled && result) setCounts(result);
      })
      .catch(() => {
        if (!cancelled) setCountsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  // Place the card beside its anchor row, flipping and clamping to stay on screen.
  useLayoutEffect(() => {
    const rect = preview?.rect;
    const element = cardRef.current;
    if (!rect || !element) {
      setPosition(null);
      return;
    }
    const gap = 12;
    const margin = 8;
    const height = element.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right + gap;
    if (left + CARD_WIDTH > viewportWidth - margin) {
      left = rect.left - CARD_WIDTH - gap;
    }
    left = Math.min(Math.max(margin, left), Math.max(margin, viewportWidth - CARD_WIDTH - margin));

    let top = rect.top + rect.height / 2 - height / 2;
    top = Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin));

    setPosition({ left, top });
  }, [preview, counts, countsError, zoom, layerKey]);

  // Any scroll behind the card invalidates the anchor rect — dismiss instead of drifting.
  useEffect(() => {
    if (!preview) return undefined;
    const handleScroll = () => onClose?.();
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('keydown', handleKey);
    };
  }, [preview, onClose]);

  if (!preview || !asset || typeof document === 'undefined') {
    return null;
  }

  const ownerLabel = getAssetOwnerLabel(asset.owner_type);
  const stateLabel = getTransformerState({
    state: asset.state,
    siteName: asset.site_name,
    txName: asset.tx_name,
    mnemonic: asset.mnemonic,
  });
  const coordinatesReady = hasCoordinates(asset);

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      data-asset-hover-card=""
      aria-label={`${asset.tx_name || 'Transformer'} preview`}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      style={{
        position: 'fixed',
        width: CARD_WIDTH,
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        zIndex: 5000,
        // Radix's modal Dialog sets pointer-events:none on <body>; opt this
        // body-level portal back in so the minimap controls stay clickable.
        pointerEvents: 'auto',
        opacity: position ? 1 : 0,
      }}
      className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition-opacity duration-100"
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Transformer</p>
          <h3 className="mt-1 truncate text-[15px] font-bold leading-tight text-[var(--foreground)]">
            {asset.tx_name || 'Unnamed transformer'}
          </h3>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-[var(--primary-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--primary-strong)]">
            {asset.voltage || 'Voltage N/A'}
          </span>
          <span className="rounded-md bg-[var(--card-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)]">
            {ownerLabel}
          </span>
        </div>
        {preview.pinned ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="-mr-1 -mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="px-3">
        {coordinatesReady ? (
          <AssetMiniMap
            lat={Number(asset.latitude)}
            lng={Number(asset.longitude)}
            zoom={zoom}
            layerKey={layerKey}
            onZoomChange={onZoomChange}
            onLayerChange={onLayerChange}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] text-[var(--muted)]"
            style={{ width: MAP_WIDTH, height: MAP_HEIGHT, boxSizing: 'content-box' }}
          >
            <Crosshair className="h-5 w-5" />
            <p className="text-xs">No coordinates recorded</p>
          </div>
        )}
      </div>

      <dl className="grid gap-2 px-4 pt-3.5">
        <DetailRow label="Site" value={asset.site_name} />
        <DetailRow label="Owner" value={ownerLabel} />
        <DetailRow label="State" value={stateLabel} />
        <DetailRow label="Mnemonic" value={asset.mnemonic} />
        <DetailRow label="Serial" value={asset.serial_number} />
        <DetailRow label="Load" value={asset.load_mva ? `${asset.load_mva} MVA` : '-'} />
        <DetailRow label="Maker" value={asset.maker} />
        <DetailRow label="Built" value={asset.year_built} />
      </dl>

      <div className="flex items-center gap-2 px-4 pb-4 pt-3 text-[11px] text-[var(--muted)]">
        {countsError ? (
          <span className="rounded-full bg-[var(--card-muted)] px-2.5 py-1">Counts unavailable</span>
        ) : counts ? (
          <>
            <span className="rounded-full bg-[var(--card-muted)] px-2.5 py-1">{counts.oilTests} oil tests</span>
            <span className="rounded-full bg-[var(--card-muted)] px-2.5 py-1">{counts.documents} documents</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--card-muted)] px-2.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading records…
          </span>
        )}
        {coordinatesReady ? (
          <span className="ml-auto inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Snapshot
          </span>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <dt className="font-medium text-[var(--muted)]">{label}</dt>
      <dd className="truncate text-right font-semibold text-[var(--foreground)]">{value || '-'}</dd>
    </div>
  );
}

export default AssetHoverCard;
