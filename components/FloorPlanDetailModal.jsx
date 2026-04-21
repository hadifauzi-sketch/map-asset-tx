import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Eye, Pencil, X, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getPolygonCentroid } from '../lib/floorPlanStorage';

function createMarkerIcon(color = '#0f766e') {
  return L.divIcon({
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
}

function BoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length < 3) return;
    try {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [16, 16], maxZoom: 22 });
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount — re-fitting on every render breaks user zoom
  return null;
}

function AddModeClickHandler({ active, onMapClick }) {
  useMapEvents({
    click: (e) => {
      if (active) onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function FloorPlanDetailModal({
  floorPlan,
  transformers = [],
  isOpen,
  onClose,
  onEditInfo,
  onReshape,
  onAddTransformerToFloor,
  onEditTransformer,
  onViewDetails,
  onRemoveFromFloor,
  onMarkerDragEnd,
}) {
  const [isAddMode, setIsAddMode] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setMapKey((k) => k + 1);
      setIsAddMode(false);
    }
  }, [isOpen]);

  const floorTransformers = useMemo(() => {
    if (!floorPlan) return [];
    const idSet = new Set((floorPlan.transformerIds || []).map(String));
    return transformers.filter((t) => idSet.has(String(t.id)));
  }, [floorPlan, transformers]);

  const centroid = useMemo(
    () => getPolygonCentroid(floorPlan?.points || []) || [3.139, 101.6869],
    [floorPlan]
  );

  const handleMapClick = useCallback(
    (position) => {
      setIsAddMode(false);
      onAddTransformerToFloor?.(position, floorPlan.id);
    },
    [onAddTransformerToFloor, floorPlan]
  );

  if (!floorPlan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="floor-detail-modal mobile-fullscreen-dialog flex h-full w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:h-[88vh] sm:max-h-[880px] sm:w-[95vw] sm:max-w-[1020px]"
        showClose={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 border-b border-[color:var(--border)] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                {floorPlan.companyName || 'Floor plan'}
              </p>
              <DialogTitle className="mt-0.5 text-lg font-bold leading-tight text-[var(--foreground)]">
                {floorPlan.name || 'Unnamed floor'}
              </DialogTitle>
              {floorPlan.state ? (
                <p className="mt-0.5 text-sm text-[var(--muted)]">{floorPlan.state}</p>
              ) : null}
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 pt-0.5 sm:w-auto sm:justify-end">
              <Badge variant="secondary">{floorTransformers.length} assets</Badge>
              <Badge variant="outline">{floorPlan.points.length} boundary pts</Badge>
              <Button size="sm" variant="outline" onClick={() => onEditInfo?.(floorPlan)}>
                Edit info
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onReshape?.(floorPlan);
                }}
              >
                Reshape
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Map ────────────────────────────────────────────── */}
        <div
          className={`relative flex-1 overflow-hidden${isAddMode ? ' floor-detail-add-mode' : ''}`}
          style={{ minHeight: 0 }}
        >
          {isAddMode && (
            <div
              className="pointer-events-none absolute left-4 right-4 top-3 z-[1000] rounded-2xl bg-[var(--primary)] px-4 py-2 text-center text-xs font-semibold text-white shadow-lg sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-full sm:py-1.5"
            >
              Click anywhere on the map to place a new transformer
            </div>
          )}

          <MapContainer
            key={mapKey}
            center={centroid}
            zoom={19}
            maxZoom={22}
            zoomControl
            scrollWheelZoom
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxNativeZoom={19}
              maxZoom={22}
            />
            <BoundsFitter points={floorPlan.points} />
            <AddModeClickHandler active={isAddMode} onMapClick={handleMapClick} />

            {/* Floor boundary */}
            <Polygon
              positions={floorPlan.points}
              pathOptions={{
                color: '#1d4ed8',
                weight: 3,
                fillColor: '#2563eb',
                fillOpacity: 0.14,
                dashArray: undefined,
              }}
            />

            {/* Transformer markers */}
            {floorTransformers.map((transformer) => (
              <Marker
                key={transformer.id}
                position={transformer.position}
                icon={createMarkerIcon('#0f766e')}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    onMarkerDragEnd?.(transformer.id, [lat, lng]);
                  },
                }}
              >
                <Popup className="floor-plan-popup floor-detail-tx-popup-wrap" maxWidth={260}>
                  <div className="floor-detail-tx-popup">
                    <p className="floor-detail-tx-name">
                      {transformer.txName || transformer.mnemonic || 'Unnamed'}
                    </p>
                    {transformer.siteName ? (
                      <p className="floor-detail-tx-site">{transformer.siteName}</p>
                    ) : null}
                    <div className="floor-detail-tx-actions">
                      <button
                        className="floor-detail-action-btn floor-detail-action-primary"
                        onClick={() => { onViewDetails?.(transformer); onClose(); }}
                      >
                        <Eye size={13} />
                        View details
                      </button>
                      <button
                        className="floor-detail-action-btn floor-detail-action-outline"
                        onClick={() => { onEditTransformer?.(transformer); onClose(); }}
                      >
                        <Pencil size={13} />
                        Edit transformer
                      </button>
                      <button
                        className="floor-detail-action-btn floor-detail-action-danger"
                        onClick={() => onRemoveFromFloor?.(floorPlan.id, transformer.id)}
                      >
                        <X size={13} />
                        Remove from floor
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="shrink-0 flex flex-col gap-3 border-t border-[color:var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {floorTransformers.length === 0 ? (
              <span className="text-xs text-[var(--muted)]">
                No transformers on this floor yet — click &ldquo;Add transformer&rdquo; to place one.
              </span>
            ) : (
              floorTransformers.map((t) => (
                <span key={t.id} className="floor-plan-chip text-xs">
                  {t.txName || t.mnemonic || 'Unnamed'}
                </span>
              ))
            )}
          </div>
          <Button
            size="sm"
            className={`w-full shrink-0 transition-all sm:w-auto${isAddMode ? ' ring-2 ring-amber-400 ring-offset-1' : ''}`}
            variant={isAddMode ? 'secondary' : 'default'}
            onClick={() => setIsAddMode((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {isAddMode ? 'Cancel placing' : 'Add transformer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
