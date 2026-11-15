import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import DataCentreInfoCard, { DataCentreHoverCard } from './DataCentreInfoCard';
import { dataCentreSource, dataCentreMarkerSvg } from '../lib/dataCentres';

// The tracker panel only renders once the panel is opened.
const DataCentreTrackerPanel = lazy(() => import('./DataCentreTrackerPanel'));

export default function DataCentreMapLayer({ tracker, visible = true }) {
  const map = useMap();
  const [panelHost, setPanelHost] = useState(null);
  const [popupContext, setPopupContext] = useState(null);
  const [tooltipContext, setTooltipContext] = useState(null);
  const activePopup = useRef(null);
  const { settings, facilities, setSettings } = tracker;
  const mapped = facilities.filter((facility) => facility.mapped);

  const openPopup = useCallback((facility) => {
    const host = document.createElement('div');
    const width = Math.max(200, Math.min(400, map.getSize().x - 48));
    host.style.width = `${width}px`;
    const popup = L.popup({ className: 'dc-popup-shell', closeButton: false, maxWidth: width, minWidth: Math.min(280, width), autoPanPadding: [24, 24] })
      .setLatLng([facility.latitude, facility.longitude]).setContent(host);
    popup.on('remove', () => {
      if (activePopup.current === popup) activePopup.current = null;
      setPopupContext((current) => current?.popup === popup ? null : current);
    });
    popup.openOn(map);
    activePopup.current = popup;
    setPopupContext({ popup, host, facility });
  }, [map]);

  // Re-measure after React fills Leaflet's initially empty content containers.
  useLayoutEffect(() => { popupContext?.popup.update(); }, [popupContext]);
  useLayoutEffect(() => { tooltipContext?.tooltip.update(); }, [tooltipContext]);
  useEffect(() => () => {
    if (activePopup.current) map.closePopup(activePopup.current);
  }, [map, visible, facilities, settings.enabled]);

  useEffect(() => {
    if (!settings.enabled || !visible) return undefined;
    const records = facilities.filter((facility) => facility.mapped);
    const group = L.markerClusterGroup({ maxClusterRadius: 38, disableClusteringAtZoom: 16,
      showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => L.divIcon({ className: 'dc-cluster', html: `<span>${cluster.getChildCount()}</span>`, iconSize: [36, 36] }),
    }).addTo(map);
    let frame;
    let index = 0;
    // Bound work per frame and cancel pending batches when filters change.
    const addBatch = () => {
      const batch = records.slice(index, index + 100).map((facility) => {
        const { size, svg } = dataCentreMarkerSvg(facility, settings.colorBy, settings.markerScale);
        const icon = L.divIcon({ className: 'dc-map-marker', html: svg, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
        const marker = L.marker([facility.latitude, facility.longitude], { icon });
        marker.on('click', () => { marker.closeTooltip(); openPopup(facility); });
        marker.on('mouseover', () => {
          if (!marker.getTooltip()) {
            const host = document.createElement('div');
            host.style.width = '270px';
            marker.bindTooltip(host, { className: 'dc-tooltip-shell', direction: 'auto', offset: [12, 0], opacity: 1 });
            marker.on('tooltipopen', ({ tooltip }) => setTooltipContext({ tooltip, host, facility }));
            marker.on('tooltipclose', ({ tooltip }) => setTooltipContext((current) => current?.tooltip === tooltip ? null : current));
          }
          marker.openTooltip();
        });
        return marker;
      });
      group.addLayers(batch);
      index += batch.length;
      if (index < records.length) frame = requestAnimationFrame(addBatch);
    };
    frame = requestAnimationFrame(addBatch);
    return () => { cancelAnimationFrame(frame); group.clearLayers(); map.removeLayer(group); };
  }, [map, visible, facilities, settings.enabled, settings.colorBy, settings.markerScale, openPopup]);

  useEffect(() => {
    if (!settings.enabled || !visible) return undefined;
    const credit = dataCentreSource(settings.source).credit;
    map.attributionControl?.addAttribution(credit);
    return () => map.attributionControl?.removeAttribution(credit);
  }, [map, settings.enabled, settings.source, visible]);
  useEffect(() => {
    if (!settings.panelOpen || !visible) return undefined;
    const host = L.DomUtil.create('div', 'dc-tracker-host', map.getContainer());
    L.DomEvent.disableClickPropagation(host);
    L.DomEvent.disableScrollPropagation(host);
    setPanelHost(host);
    return () => { host.remove(); setPanelHost(null); };
  }, [map, settings.panelOpen, visible]);

  const flyTo = (campus) => {
    if (map.getSize().x < 700) setSettings((current) => ({ ...current, panelOpen: false }));
    map.flyTo([campus.latitude, campus.longitude], Math.max(map.getZoom(), 14));
    openPopup(campus);
  };
  const fit = () => {
    if (map.getSize().x < 700) setSettings((current) => ({ ...current, panelOpen: false }));
    if (mapped.length) map.fitBounds(mapped.map((campus) => [campus.latitude, campus.longitude]), {
      paddingTopLeft: [30, 30], paddingBottomRight: [settings.panelOpen && map.getSize().x > 700 ? 410 : 30, 30], maxZoom: 13,
    });
  };

  return <>
    {tooltipContext ? createPortal(<DataCentreHoverCard facility={tooltipContext.facility} />, tooltipContext.host) : null}
    {popupContext ? createPortal(<DataCentreInfoCard facility={popupContext.facility} onClose={() => map.closePopup(popupContext.popup)} />, popupContext.host) : null}
    {panelHost ? createPortal(<Suspense fallback={null}><DataCentreTrackerPanel tracker={tracker} onClose={() => setSettings((current) => ({ ...current, panelOpen: false }))}
      onFlyTo={flyTo} onFit={fit} /></Suspense>, panelHost) : null}
  </>;
}
