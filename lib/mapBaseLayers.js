import { Layers3, Map as MapIcon, Satellite } from 'lucide-react';

const APP_CREDIT_ATTRIBUTION =
  'Apps by <a href="https://www.linkedin.com/in/chm-hadi-fauzi/" target="_blank" rel="noreferrer">ChM. Ts. Hadi Fauzi</a>';

const ESRI_IMAGERY_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export const MAP_BASE_LAYERS = {
  streets: {
    label: 'Map',
    icon: MapIcon,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | ${APP_CREDIT_ATTRIBUTION}`,
  },
  satellite: {
    label: 'Satellite',
    icon: Satellite,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: `${ESRI_IMAGERY_ATTRIBUTION} | ${APP_CREDIT_ATTRIBUTION}`,
  },
  hybrid: {
    label: 'Hybrid',
    icon: Layers3,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: `${ESRI_IMAGERY_ATTRIBUTION} | ${APP_CREDIT_ATTRIBUTION}`,
  },
};

export const SATELLITE_LABELS_LAYER = {
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Labels &copy; Esri',
};

export const DEFAULT_MAP_BASE_LAYER = 'streets';

export function resolveMapBaseLayer(layerKey) {
  return MAP_BASE_LAYERS[layerKey] || MAP_BASE_LAYERS[DEFAULT_MAP_BASE_LAYER];
}
