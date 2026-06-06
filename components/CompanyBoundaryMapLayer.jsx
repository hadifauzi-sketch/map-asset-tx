import React, { Fragment, useEffect, useState } from 'react';
import L from 'leaflet';
import { Marker, Polygon, Polyline, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { getPolygonCentroid } from '../lib/floorPlanStorage';

const COMPANY_LABEL_ICON = L.divIcon({
  className: 'company-boundary-label-marker',
  html: '<div class="company-boundary-label-shell"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const COMPANY_VERTEX_ICON = L.divIcon({
  className: 'company-boundary-vertex-marker',
  html: '<div class="company-boundary-vertex-shell"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const COMPANY_LABEL_VISIBLE_ZOOM = 11;
const COMPANY_LABEL_FULL_ZOOM = 14;

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createCompanyLabelIcon(label, variant = 'compact') {
  const isCompact = variant === 'compact';
  const width = isCompact ? 120 : 156;
  const height = isCompact ? 24 : 28;
  const escapedLabel = escapeHtml(label);

  return L.divIcon({
    className: 'company-boundary-label-marker',
    html: `<div class="company-boundary-label-shell${isCompact ? ' company-boundary-label-shell--compact' : ''}">${escapedLabel}</div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

function CompanyBoundaryMapLayer({
  companyBoundaries = [],
  floorPlans = [],
  canManageAssets = true,
  showCompanyBoundaries = true,
  selectedCompanyBoundaryId = null,
  draft = null,
  onSelectCompanyBoundary,
  onEditCompanyBoundaryInfo,
  onEditCompanyBoundary,
  onDeleteCompanyBoundary,
  onDraftVertexMove,
}) {
  const [mapZoom, setMapZoom] = useState(COMPANY_LABEL_VISIBLE_ZOOM);
  const map = useMapEvents({
    zoomend: (event) => {
      setMapZoom(event.target.getZoom());
    },
  });

  useEffect(() => {
    setMapZoom(map.getZoom());
  }, [map]);

  const visibleBoundaries = showCompanyBoundaries ? companyBoundaries : [];
  const showCompanyLabels = mapZoom >= COMPANY_LABEL_VISIBLE_ZOOM;
  const companyLabelVariant = mapZoom >= COMPANY_LABEL_FULL_ZOOM ? 'full' : 'compact';

  return (
    <>
      {visibleBoundaries.map((boundary) => {
        const isSelected = selectedCompanyBoundaryId === boundary.id;
        const centroid = getPolygonCentroid(boundary.points);
        const childFloors = floorPlans.filter(
          (floorPlan) =>
            String(floorPlan.companyName || '').trim().toLowerCase() ===
            String(boundary.companyName || '').trim().toLowerCase()
        );
        const childAssetCount = childFloors.reduce(
          (total, floorPlan) => total + (Array.isArray(floorPlan.transformerIds) ? floorPlan.transformerIds.length : 0),
          0
        );

        return (
          <Fragment key={boundary.id}>
            <Polygon
              positions={boundary.points}
              pathOptions={{
                color: isSelected ? '#0ea5e9' : '#7c3aed',
                weight: isSelected ? 4 : 2,
                fillColor: isSelected ? '#38bdf8' : '#a855f7',
                fillOpacity: isSelected ? 0.14 : 0.08,
                dashArray: isSelected ? undefined : '14 10',
              }}
              eventHandlers={{
                click: () => onSelectCompanyBoundary?.(boundary),
              }}
            >
              <Popup className="floor-plan-popup" maxWidth={340}>
                <div className="floor-plan-popup-content">
                  <p className="floor-plan-popup-eyebrow">Company / Parent Boundary</p>
                  <h3 className="floor-plan-popup-title">{boundary.companyName || 'Unnamed company'}</h3>
                  <p className="floor-plan-popup-copy">{boundary.state || 'Unassigned state'}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{childFloors.length} areas/floors</Badge>
                    <Badge variant="outline">{childAssetCount} assets</Badge>
                    <Badge variant="outline">{boundary.points.length} boundary points</Badge>
                  </div>

                  {boundary.notes ? (
                    <p className="mt-3 rounded-md bg-[var(--card-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                      {boundary.notes}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canManageAssets ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onEditCompanyBoundaryInfo?.(boundary)}>
                          Edit info
                        </Button>
                        <Button size="sm" onClick={() => onEditCompanyBoundary?.(boundary)}>
                          Reshape
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDeleteCompanyBoundary?.(boundary.id)}>
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Popup>

              <Tooltip className="floor-plan-tooltip" direction="top" offset={[0, -8]}>
                {boundary.companyName || 'Company boundary'}
              </Tooltip>
            </Polygon>

            {centroid && showCompanyLabels ? (
              <Marker
                position={centroid}
                icon={createCompanyLabelIcon(boundary.companyName || 'Company', companyLabelVariant)}
                interactive={false}
              />
            ) : null}
          </Fragment>
        );
      })}

      {draft?.points?.length ? (
        <>
          <Polyline
            positions={draft.points}
            pathOptions={{
              color: '#0ea5e9',
              weight: 3,
              dashArray: '10 7',
            }}
          />
          {draft.points.length >= 3 ? (
            <Polygon
              positions={draft.points}
              pathOptions={{
                color: '#0ea5e9',
                weight: 3,
                fillColor: '#38bdf8',
                fillOpacity: 0.12,
                dashArray: '10 7',
              }}
            />
          ) : null}
          {draft.points.map((point, index) => (
            <Marker
              key={`${draft.id || 'company-boundary-draft'}-${index}`}
              position={point}
              icon={index === draft.points.length - 1 ? COMPANY_VERTEX_ICON : COMPANY_LABEL_ICON}
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

export default CompanyBoundaryMapLayer;
