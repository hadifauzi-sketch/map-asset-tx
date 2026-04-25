import React, { Fragment, useMemo } from 'react';
import L from 'leaflet';
import { Marker, Polygon, Polyline, Popup, Tooltip } from 'react-leaflet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { getPolygonCentroid } from '../lib/floorPlanStorage';

const FLOOR_LABEL_ICON = L.divIcon({
  className: 'floor-plan-label-marker',
  html: '<div class="floor-plan-label-shell"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const DRAFT_VERTEX_ICON = L.divIcon({
  className: 'floor-plan-vertex-marker',
  html: '<div class="floor-plan-vertex-shell"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createFloorLabelIcon(label) {
  return L.divIcon({
    className: 'floor-plan-label-marker',
    html: `<div class="floor-plan-label-shell">${escapeHtml(label)}</div>`,
    iconSize: [140, 30],
    iconAnchor: [70, 15],
  });
}

function FloorPlanMapLayer({
  floorPlans = [],
  transformers = [],
  canManageAssets = true,
  showFloorPlans = true,
  selectedFloorPlanId = null,
  draft = null,
  onSelectFloorPlan,
  onOpenFloor,
  onEditFloorPlanInfo,
  onEditFloorPlan,
  onDeleteFloorPlan,
  onDraftVertexMove,
}) {
  const transformersById = useMemo(() => {
    const map = new Map();
    transformers.forEach((transformer) => {
      map.set(String(transformer.id), transformer);
    });
    return map;
  }, [transformers]);

  const visibleFloorPlans = showFloorPlans ? floorPlans : [];

  return (
    <>
      {visibleFloorPlans.map((floorPlan) => {
        const isSelected = selectedFloorPlanId === floorPlan.id;
        const centroid = getPolygonCentroid(floorPlan.points);
        const assignedTransformers = floorPlan.transformerIds
          .map((transformerId) => transformersById.get(String(transformerId)))
          .filter(Boolean);

        return (
          <Fragment key={floorPlan.id}>
            <Polygon
              positions={floorPlan.points}
              pathOptions={{
                color: isSelected ? '#1d4ed8' : '#0f766e',
                weight: isSelected ? 4 : 3,
                fillColor: isSelected ? '#2563eb' : '#0f766e',
                fillOpacity: isSelected ? 0.18 : 0.1,
                dashArray: isSelected ? undefined : '10 8',
              }}
              eventHandlers={{
                click: () => onSelectFloorPlan?.(floorPlan),
              }}
            >
              <Popup className="floor-plan-popup" maxWidth={340}>
                <div className="floor-plan-popup-content">
                  <p className="floor-plan-popup-eyebrow">{floorPlan.companyName || 'Company'}</p>
                  <h3 className="floor-plan-popup-title">{floorPlan.name || 'Unnamed floor'}</h3>
                  <p className="floor-plan-popup-copy">{floorPlan.state || 'Unassigned state'}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{assignedTransformers.length} assets</Badge>
                    <Badge variant="outline">{floorPlan.points.length} boundary points</Badge>
                  </div>

                  {assignedTransformers.length ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                        Transformers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedTransformers.map((transformer) => (
                          <span key={transformer.id} className="floor-plan-chip">
                            {transformer.txName || transformer.mnemonic || 'Unnamed'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onOpenFloor?.(floorPlan)}>
                      Open floor
                    </Button>
                    {canManageAssets ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onEditFloorPlanInfo?.(floorPlan)}>
                          Edit info
                        </Button>
                        <Button size="sm" onClick={() => onEditFloorPlan?.(floorPlan)}>
                          Reshape
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDeleteFloorPlan?.(floorPlan.id)}>
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Popup>

              <Tooltip className="floor-plan-tooltip" direction="top" offset={[0, -6]}>
                {floorPlan.name || 'Floor plan'}
              </Tooltip>
            </Polygon>

          </Fragment>
        );
      })}

      {draft?.points?.length ? (
        <>
          <Polyline
            positions={draft.points}
            pathOptions={{
              color: '#2563eb',
              weight: 3,
              dashArray: '8 6',
            }}
          />
          {draft.points.length >= 3 ? (
            <Polygon
              positions={draft.points}
              pathOptions={{
                color: '#2563eb',
                weight: 3,
                fillColor: '#2563eb',
                fillOpacity: 0.12,
                dashArray: '8 6',
              }}
            />
          ) : null}
          {draft.points.map((point, index) => (
            <Marker
              key={`${draft.id || draft.mode || 'draft'}-${index}`}
              position={point}
              icon={index === draft.points.length - 1 ? DRAFT_VERTEX_ICON : FLOOR_LABEL_ICON}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const nextPosition = event.target.getLatLng();
                  onDraftVertexMove?.(index, [nextPosition.lat, nextPosition.lng]);
                },
              }}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

export default FloorPlanMapLayer;
