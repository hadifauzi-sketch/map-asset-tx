import React, { useEffect, useMemo, useRef } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { getTransformerState } from '../lib/malaysiaStates';

function TransformerMarker({ transformer, icon, onDragEnd, onEdit, onDelete, onViewDetails, onSelect, isSelected }) {
  const markerRef = useRef(null);
  const transformerState = getTransformerState(transformer);

  const eventHandlers = useMemo(
    () => ({
      click() {
        onSelect?.(transformer);
      },
      popupclose() {
        if (isSelected) {
          onSelect?.(null);
        }
      },
      dragend() {
        const marker = markerRef.current;
        if (!marker) {
          return;
        }
        const nextPosition = marker.getLatLng();
        onDragEnd(transformer.id, [nextPosition.lat, nextPosition.lng]);
      },
    }),
    [isSelected, onDragEnd, onSelect, transformer]
  );

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }

    if (isSelected) {
      marker.openPopup();
      return;
    }

    if (marker.isPopupOpen()) {
      marker.closePopup();
    }
  }, [isSelected]);

  return (
    <Marker
      position={transformer.position}
      draggable
      eventHandlers={eventHandlers}
      ref={markerRef}
      icon={icon}
    >
      <Tooltip
        direction="top"
        offset={[0, -26]}
        opacity={1}
        className="transformer-hover-tooltip"
      >
        <div className="hover-tooltip-content">
          <p className="hover-tooltip-title">{transformer.txName || 'Unnamed transformer'}</p>
          <p className="hover-tooltip-site">{transformer.siteName || 'Unknown site'}</p>
        </div>
      </Tooltip>
      <Popup className="transformer-popup" maxWidth={360} autoPan={false} closeOnClick={false}>
        <div className="popup-content">
          <div className="popup-header">
            <div>
              <p className="popup-eyebrow">Transformer</p>
              <h3>{transformer.txName || 'Unnamed transformer'}</h3>
            </div>
            <span className="popup-badge">{transformer.voltage || 'Voltage N/A'}</span>
          </div>

          <dl className="popup-details">
            <DetailRow label="Site" value={transformer.siteName} />
            <DetailRow label="State" value={transformerState} />
            <DetailRow label="Mnemonic" value={transformer.mnemonic} />
            <DetailRow label="Serial" value={transformer.serialNumber} />
            <DetailRow label="Load" value={transformer.loadMVA ? `${transformer.loadMVA} MVA` : '-'} />
            <DetailRow label="Maker" value={transformer.maker} />
            <DetailRow label="Built" value={transformer.yearBuilt} />
          </dl>

          <div className="popup-stats">
            <span>{transformer.oilTests?.length || 0} oil tests</span>
            <span>{transformer.documents?.length || 0} documents</span>
          </div>

          <div className="popup-actions">
            <button type="button" className="popup-action popup-action-primary" onClick={() => onViewDetails(transformer)}>
              Details
            </button>
            <button type="button" className="popup-action" onClick={() => onEdit(transformer)}>
              Edit
            </button>
            <button type="button" className="popup-action popup-action-danger" onClick={() => onDelete(transformer.id)}>
              Delete
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <dt className="label">{label}</dt>
      <dd className="value">{value || '-'}</dd>
    </div>
  );
}

export default TransformerMarker;
