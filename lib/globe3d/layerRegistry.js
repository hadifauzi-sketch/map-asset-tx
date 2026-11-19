// Data layer registry for the 3D globe view.
//
// Every switch in the "Layers" panel comes from this list. To remove a layer,
// delete its entry here (and its handler in components/globe3d/sceneLayers.js
// if it has one). To add one, add an entry + a handler with enable/disable.
//
// requires: id of an API key from settingsStore (the switch stays locked until
//           the key is present).

import {
  Activity,
  Building2,
  Cable,
  CloudRain,
  Cylinder,
  Factory,
  LandPlot,
  MapPinned,
  Mountain,
  Network,
  Server,
  Spline,
  Sun,
  Tag,
  UtilityPole,
  Zap,
} from 'lucide-react';

export const LAYER_GROUPS = [
  { id: 'assets', label: 'Assets' },
  { id: 'world', label: '3D world' },
  { id: 'grid', label: 'Power grid', note: 'OpenStreetMap · Malaysia' },
  { id: 'digital', label: 'Digital infrastructure', note: 'Malaysia & worldwide' },
  { id: 'reference', label: 'Reference feeds', note: 'Sample live layers — safe to remove' },
];

export const LAYERS = [
  {
    id: 'dataCentres', group: 'digital', label: 'Data centres',
    source: 'Malaysia tracker & global directory', icon: Server, defaultOn: false,
  },
  // ── Assets (from Supabase, same data as the 2D map) ──────────────────────
  {
    id: 'transformers',
    group: 'assets',
    label: 'Transformers',
    source: 'Supabase · coloured by DGA status',
    icon: Zap,
    defaultOn: true,
  },
  {
    id: 'assetLabels',
    group: 'assets',
    label: 'Asset labels',
    source: 'Tx name beside each pin',
    icon: Tag,
    defaultOn: true,
  },
  {
    id: 'companyBoundaries',
    group: 'assets',
    label: 'Company boundaries',
    source: 'Drawn on the 2D map',
    icon: LandPlot,
    defaultOn: true,
  },
  {
    id: 'floorPlans',
    group: 'assets',
    label: 'Site areas',
    source: 'Floor / site polygons',
    icon: MapPinned,
    defaultOn: true,
  },

  // ── 3D world ─────────────────────────────────────────────────────────────
  {
    id: 'buildings',
    group: 'world',
    label: '3D buildings',
    // Local OSM tileset (Malaysia) without a key; Cesium OSM Buildings with one.
    source: 'OSM 3D Tiles · Malaysia',
    icon: Building2,
    defaultOn: true,
  },
  {
    id: 'terrain',
    group: 'world',
    label: 'World terrain',
    source: 'Cesium World Terrain',
    icon: Mountain,
    requires: 'cesiumIon',
    defaultOn: true,
  },
  {
    id: 'lighting',
    group: 'world',
    label: 'Sun lighting',
    source: 'Day / night shading, now',
    icon: Sun,
    defaultOn: false,
  },

  // ── Power grid (OpenStreetMap export served from public/data/grid) ───────
  // Built by scripts/build-power-grid.mjs from public/data/Malaysia_Power_Map.
  {
    id: 'powerPlants',
    group: 'grid',
    label: 'Power stations',
    source: 'WRI power plant database · Malaysia',
    icon: Factory,
    defaultOn: false,
  },
  {
    id: 'substations',
    group: 'grid',
    label: 'Substations',
    source: 'OSM · 4,993 sites',
    icon: Network,
    defaultOn: false,
  },
  {
    id: 'mappedTransformers',
    group: 'grid',
    label: 'Individually mapped transformers',
    source: 'OSM · 475 mapped units',
    icon: Cylinder,
    defaultOn: false,
  },
  {
    id: 'powerLines',
    group: 'grid',
    label: 'Power-line segments',
    source: 'OSM · coloured by voltage',
    icon: UtilityPole,
    defaultOn: false,
  },
  {
    id: 'minorLines',
    group: 'grid',
    label: 'Minor power-line segments',
    source: 'OSM · distribution lines',
    icon: Spline,
    defaultOn: false,
  },
  {
    id: 'powerCables',
    group: 'grid',
    label: 'Cables',
    source: 'OSM · underground / submarine',
    icon: Cable,
    defaultOn: false,
  },

  // ── Reference feeds (keyless, loaded only while switched on) ─────────────
  {
    id: 'rainRadar',
    group: 'reference',
    label: 'Rain radar',
    source: 'RainViewer · past 2 h, playable',
    icon: CloudRain,
    defaultOn: false,
  },
  {
    id: 'earthquakes',
    group: 'reference',
    label: 'Earthquakes',
    source: 'USGS · M2.5+ past 7 days',
    icon: Activity,
    defaultOn: false,
  },
];

export const DEFAULT_LAYER_STATE = Object.fromEntries(
  LAYERS.map((layer) => [layer.id, Boolean(layer.defaultOn)])
);

export function getLayer(layerId) {
  return LAYERS.find((layer) => layer.id === layerId) || null;
}
