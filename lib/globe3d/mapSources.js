// Base map sources for the 3D globe. `kind` tells the scene how to build it:
//   url     → keyless XYZ tiles
//   ion     → Cesium ion imagery asset (needs the Cesium ion token)
//   google3d→ Google Photorealistic 3D Tiles (needs the Google Maps key)
//   local   → low-resolution Natural Earth tiles bundled with Cesium (works offline)

const ESRI_CREDIT = 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
// Esri's grey canvas maps are keyless like World Imagery and cached to level 16.
// (CARTO's dark/light basemaps now serve "API key required" tiles without a key.)
const ESRI_CANVAS = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas';
const ESRI_CANVAS_CREDIT = 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community';

export const MAP_SOURCES = [
  {
    id: 'esriSatellite',
    label: 'Esri Satellite',
    tag: 'SAT',
    kind: 'url',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
    credit: ESRI_CREDIT,
  },
  {
    id: 'esriHybrid',
    label: 'Esri Hybrid',
    tag: 'SAT + LABELS',
    kind: 'url',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
    credit: ESRI_CREDIT,
    overlay: {
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
      credit: 'Labels © Esri',
    },
  },
  {
    id: 'osm',
    label: 'OSM',
    tag: 'MAP',
    kind: 'url',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maximumLevel: 19,
    credit: '© OpenStreetMap contributors',
  },
  {
    id: 'esriDark',
    label: 'Dark',
    tag: 'MAP',
    kind: 'url',
    url: `${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    maximumLevel: 16,
    credit: ESRI_CANVAS_CREDIT,
    overlay: {
      url: `${ESRI_CANVAS}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
      maximumLevel: 16,
      credit: 'Labels © Esri',
    },
  },
  {
    id: 'esriLight',
    label: 'Light',
    tag: 'MAP',
    kind: 'url',
    url: `${ESRI_CANVAS}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    maximumLevel: 16,
    credit: ESRI_CANVAS_CREDIT,
    overlay: {
      url: `${ESRI_CANVAS}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
      maximumLevel: 16,
      credit: 'Labels © Esri',
    },
  },
  {
    id: 'naturalEarth',
    label: 'Offline',
    tag: 'NATURAL EARTH · BUNDLED',
    kind: 'local',
  },
  {
    id: 'bingAerial',
    label: 'Bing Aerial',
    tag: 'ION',
    kind: 'ion',
    assetId: 2,
    requires: 'cesiumIon',
  },
  {
    id: 'google3d',
    label: 'Google 3D',
    tag: 'PHOTOREAL',
    kind: 'google3d',
    requires: 'googleMaps',
  },
];

export const DEFAULT_MAP_SOURCE = 'esriSatellite';

export function getMapSource(sourceId) {
  return MAP_SOURCES.find((source) => source.id === sourceId) || MAP_SOURCES[0];
}
