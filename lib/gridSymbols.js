// Map symbols for OSM power equipment, in the spirit of the OpenInfraMap legend
// (tower ⊠, transition tower ∇, pole ●, transformer ⊜, generator ~, …).
//
// Each symbol is a list of SVG path parts in a 16 × 16 box centred on (8, 8).
// The same definitions draw the Leaflet canvas markers (via Path2D) and the
// inline <svg> swatches in the layer menu, so the menu always matches the map.
//
// Part: { d, fill?, stroke?, width? } — width is in screen pixels; a fill or
// stroke of ACCENT is replaced by the record's colour (generator fuel etc.).

import { fuelColor } from './powerPlants.js';

export const ACCENT = 'accent';
const INK = '#1f2937';
const PAPER = '#ffffff';
const POLE_BROWN = '#8b5a2b';

const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const DISC = circle(8, 8, 7);
const WAVE = 'M4.2 8c1.27-2.6 2.53-2.6 3.8 0s2.53 2.6 3.8 0';
const SWITCH_BOX = 'M1.5 4H14.5V12H1.5Z';

const disc = (fill = PAPER) => ({ d: DISC, fill, stroke: INK });
const ink = (d, width = 1.1) => ({ d, stroke: INK, width });
const box = { d: SWITCH_BOX, fill: PAPER, stroke: INK, width: 0.8 };

export const GRID_SYMBOLS = {
  // Line supports
  tower: [{ d: 'M3.5 3.5H12.5V12.5H3.5Z', fill: PAPER, stroke: INK }, ink('M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5', 0.9)],
  transitionTower: [{ d: 'M2.5 3.5H13.5L8 13Z', fill: PAPER, stroke: INK }],
  pole: [{ d: circle(8, 8, 4), fill: POLE_BROWN, stroke: PAPER }],
  transitionPole: [{ d: 'M4 4.5H12L8 11.5Z', fill: PAPER, stroke: POLE_BROWN, width: 1.3 }],

  // Transformers
  transformer: [disc(), ink(`${circle(8, 6.1, 2.6)}${circle(8, 9.9, 2.6)}`)],
  transformer3: [disc(), ink(`${circle(8, 5.7, 2.3)}${circle(6, 9.4, 2.3)}${circle(10, 9.4, 2.3)}`)],
  currentTransformer: [disc(), ink(`M8 2V14${circle(8, 8, 2.6)}`)],
  potentialTransformer: [disc(), ink(`${circle(8, 6.3, 2.4)}M8 8.7V11.2M5.6 11.2H10.4`)],

  // Switchgear
  disconnector: [box, ink('M2.5 9.5H5.5M5.5 9.5L10 5.8M10.5 8V11M10.5 9.5H13.5')],
  circuitBreaker: [box, ink('M2.5 10.5H5M11 10.5H13.5M5 10.5a3 3 0 0 1 6 0')],
  otherSwitch: [box, ink('M2.5 9.5H5.5L10.5 6M10.5 9.5H13.5')],

  // Compensators & converters
  seriesReactor: [disc(), ink('M2.5 8H5.2M10.8 8H13.5M5.2 8a2.8 2.8 0 1 1 2.8 2.8')],
  shuntReactor: [disc(), ink('M8 2.5V5.2M8 5.2a2.8 2.8 0 1 1 -2.8 2.8M8 10.8V13.5')],
  seriesCapacitor: [disc(), ink('M7 4.5V11.5M9 4.5V11.5M2.5 8H7M9 8H13.5')],
  shuntCapacitor: [disc(), ink('M4.5 7H11.5M4.5 9H11.5M8 2.5V7M8 9V13.5')],
  filter: [disc(), ink(WAVE, 1.2)],
  otherCompensator: [{ d: 'M3 3H13V13H3Z', fill: '#e5e7eb', stroke: INK }],
  converter: [disc(), ink('M3.6 12.4L12.4 3.6')],

  // Generation
  generator: [{ d: DISC, fill: ACCENT, stroke: PAPER }, { d: WAVE, stroke: PAPER, width: 1.4 }],
  plant: [
    { d: 'M3 1.5H13Q14.5 1.5 14.5 3V13Q14.5 14.5 13 14.5H3Q1.5 14.5 1.5 13V3Q1.5 1.5 3 1.5Z', fill: ACCENT, stroke: PAPER },
    { d: WAVE, stroke: PAPER, width: 1.5 },
  ],

  // Line terminations
  portal: [ink('M2 5H14', 2.2), ink('M3.2 5V12.5M12.8 5V12.5', 1.4)],
  terminal: [ink('M8 4V13M4.5 4H11.5', 1.6)],
  insulator: [ink('M8 2.5V13.5', 1.2), { d: circle(8, 8, 2.4), fill: PAPER, stroke: INK }],
};

const TRANSFORMER_SYMBOL = {
  current: 'currentTransformer',
  potential: 'potentialTransformer',
  voltage: 'potentialTransformer',
};
const SWITCH_SYMBOL = { disconnector: 'disconnector', circuit_breaker: 'circuitBreaker' };
const COMPENSATOR_SYMBOL = {
  converter: 'converter',
  series_reactor: 'seriesReactor',
  shunt_reactor: 'shuntReactor',
  series_capacitor: 'seriesCapacitor',
  shunt_capacitor: 'shuntCapacitor',
  filter: 'filter',
};

/** True when a transformer has a third winding (tertiary voltage or windings=3). */
export function isThreeWinding(record) {
  return Boolean(record?.tags?.['voltage:tertiary']) || String(record?.tags?.windings || '') === '3';
}

/** Symbol id for one record of an equipment layer. */
export function gridSymbolFor(layerId, record) {
  const kind = String(record?.kind || '');
  switch (layerId) {
    case 'powerTowers':
      return 'tower';
    case 'transitionTowers':
      return 'transitionTower';
    case 'powerPoles':
      return 'pole';
    case 'transitionPoles':
      return 'transitionPole';
    case 'mappedTransformers':
      return TRANSFORMER_SYMBOL[kind] || (isThreeWinding(record) ? 'transformer3' : 'transformer');
    case 'switches':
      return SWITCH_SYMBOL[kind] || 'otherSwitch';
    case 'compensators':
      return COMPENSATOR_SYMBOL[kind] || 'otherCompensator';
    case 'generators':
      return 'generator';
    case 'osmPlants':
      return 'plant';
    case 'portals':
      return kind === 'terminal' || kind === 'insulator' ? kind : 'portal';
    default:
      return null;
  }
}

// OSM generator:source / plant:source values -> the fuel legend used for
// WRI power stations, so a gas generator is the same colour in both layers.
const SOURCE_ALIASES = {
  diesel: 'Oil',
  oil: 'Oil',
  gas: 'Gas',
  natural_gas: 'Gas',
  biogas: 'Biomass',
  biofuel: 'Biomass',
  biomass: 'Biomass',
  waste: 'Waste',
};

/** Fill colour for generator / plant symbols, from the (first) energy source. */
export function sourceColor(source) {
  const first = String(source || '').split(';')[0].trim().toLowerCase();
  return fuelColor(SOURCE_ALIASES[first] || first);
}

/** Accent colour that replaces ACCENT in a record's symbol. */
export function symbolAccent(layerId, record) {
  if (layerId === 'generators' || layerId === 'osmPlants') {
    return sourceColor(record?.kind);
  }
  return INK;
}
