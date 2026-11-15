// 3D Tiles feature styling presets for the OSM Buildings tileset.
// Each preset returns a plain Cesium3DTileStyle definition (the Cesium styling
// language), so this file stays free of Cesium imports and is easy to extend.
// Reference: https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling

const HEIGHT = "${feature['cesium#estimatedHeight']}";
const BUILDING = "${feature['building']}";

export const BUILDING_STYLES = [
  {
    id: 'teal',
    label: 'Teal glass',
    description: 'Uniform brand tint',
    legend: [{ color: '#2dd4bf', label: 'All buildings' }],
    build: () => ({
      color: "color('#2dd4bf', 0.82)",
    }),
  },
  {
    id: 'osm',
    label: 'OSM colours',
    description: 'Colours tagged in OpenStreetMap',
    legend: [{ color: '#e5e7eb', label: 'Tagged colour or white' }],
    build: () => ({
      color: "Boolean(${feature['cesium#color']}) ? color(${feature['cesium#color']}) : color('#ffffff')",
    }),
  },
  {
    id: 'height',
    label: 'By height',
    description: 'Estimated building height',
    legend: [
      { color: '#134e4a', label: '< 15 m' },
      { color: '#0f766e', label: '15–30 m' },
      { color: '#14b8a6', label: '30–75 m' },
      { color: '#5eead4', label: '75–150 m' },
      { color: '#f0fdfa', label: '> 150 m' },
    ],
    build: () => ({
      defines: { h: HEIGHT },
      color: {
        conditions: [
          ['${h} === undefined', "color('#134e4a', 0.9)"],
          ['${h} > 150', "color('#f0fdfa')"],
          ['${h} > 75', "color('#5eead4')"],
          ['${h} > 30', "color('#14b8a6')"],
          ['${h} > 15', "color('#0f766e')"],
          ['true', "color('#134e4a')"],
        ],
      },
    }),
  },
  {
    id: 'type',
    label: 'By type',
    description: 'OSM building tag',
    legend: [
      { color: '#f59e0b', label: 'Industrial / warehouse' },
      { color: '#38bdf8', label: 'Commercial / office / retail' },
      { color: '#a3e635', label: 'Residential' },
      { color: '#f472b6', label: 'Hospital / school' },
      { color: '#94a3b8', label: 'Other' },
    ],
    build: () => ({
      defines: { b: BUILDING },
      color: {
        conditions: [
          ["${b} === 'industrial' || ${b} === 'warehouse' || ${b} === 'factory'", "color('#f59e0b')"],
          ["${b} === 'commercial' || ${b} === 'office' || ${b} === 'retail'", "color('#38bdf8')"],
          [
            "${b} === 'residential' || ${b} === 'apartments' || ${b} === 'house' || ${b} === 'terrace' || ${b} === 'detached'",
            "color('#a3e635')",
          ],
          [
            "${b} === 'hospital' || ${b} === 'school' || ${b} === 'university' || ${b} === 'college'",
            "color('#f472b6')",
          ],
          ['true', "color('#94a3b8')"],
        ],
      },
    }),
  },
  {
    id: 'industrial',
    label: 'Industrial focus',
    description: 'Highlights industrial and utility buildings, fades the rest',
    legend: [
      { color: '#f59e0b', label: 'Industrial / utility' },
      { color: '#64748b', label: 'Everything else (faded)' },
    ],
    build: () => ({
      defines: { b: BUILDING },
      color: {
        conditions: [
          [
            "${b} === 'industrial' || ${b} === 'warehouse' || ${b} === 'factory' || ${b} === 'transformer_tower' || ${b} === 'service'",
            "color('#f59e0b')",
          ],
          ['true', "color('#64748b', 0.35)"],
        ],
      },
    }),
  },
  {
    id: 'proximity',
    label: 'Near selected Tx',
    description: 'Distance from the selected transformer',
    needsSelection: true,
    legend: [
      { color: '#f43f5e', label: '< 150 m' },
      { color: '#f59e0b', label: '150–500 m' },
      { color: '#2dd4bf', label: '500 m – 1 km' },
      { color: '#475569', label: 'Farther (faded)' },
    ],
    // position = [latitude, longitude] of the selected transformer.
    build: (position) => {
      if (!Array.isArray(position)) {
        return { color: "color('#2dd4bf', 0.82)" };
      }
      const [latitude, longitude] = position;
      // Degrees → metres near the equator (Malaysia): 1° ≈ 111 km.
      return {
        defines: {
          meters: `distance(vec2(\${feature['cesium#longitude']}, \${feature['cesium#latitude']}), vec2(${Number(
            longitude
          )}, ${Number(latitude)})) * 111000.0`,
        },
        color: {
          conditions: [
            ['${meters} < 150', "color('#f43f5e')"],
            ['${meters} < 500', "color('#f59e0b')"],
            ['${meters} < 1000', "color('#2dd4bf')"],
            ['true', "color('#475569', 0.4)"],
          ],
        },
      };
    },
  },
];

export const DEFAULT_BUILDING_STYLE = 'teal';

export function getBuildingStyle(styleId) {
  return BUILDING_STYLES.find((style) => style.id === styleId) || BUILDING_STYLES[0];
}
