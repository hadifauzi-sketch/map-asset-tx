// Power plant styling and info cards shared by the 2D map and the 3D globe.
//
// Plants come from the WRI Global Power Plant Database (see
// scripts/build-power-plants.mjs). Each is coloured by primary fuel and sized
// by installed capacity, so both views read the same way as the legend.

export const POWER_PLANT_LAYER_TITLE = 'Power Plants by Capacity (MW) and Fuel Type';

/** Legend order and colours. Fuels not listed here fall under "Others". */
export const FUEL_LEGEND = [
  { id: 'Coal', label: 'Coal', color: '#000000' },
  { id: 'Oil', label: 'Oil', color: '#b15928' },
  { id: 'Gas', label: 'Gas', color: '#bc80bd' },
  { id: 'Hydro', label: 'Hydro', color: '#1f78b4' },
  { id: 'Nuclear', label: 'Nuclear', color: '#e31a1c' },
  { id: 'Solar', label: 'Solar', color: '#ff7f00' },
  { id: 'Waste', label: 'Waste', color: '#6a3d9a' },
  { id: 'Wind', label: 'Wind', color: '#5ca2d1' },
  { id: 'Geothermal', label: 'Geothermal', color: '#fdbf6f' },
  { id: 'Biomass', label: 'Biomass', color: '#229a00' },
  { id: 'Others', label: 'Others', color: '#b2df8a' },
];

const FUEL_BY_ID = new Map(FUEL_LEGEND.map((entry) => [entry.id.toLowerCase(), entry]));
const OTHERS = FUEL_LEGEND[FUEL_LEGEND.length - 1];

/** Legend entry for a WRI primary_fuel value ("Gas", "Petcoke", "" ...). */
export function fuelEntry(fuel) {
  return FUEL_BY_ID.get(String(fuel || '').trim().toLowerCase()) || OTHERS;
}

export function fuelColor(fuel) {
  return fuelEntry(fuel).color;
}


/** Plants per legend entry: { Gas: 20, Coal: 7, Others: 1, ... }. */
export function countPlantsByFuel(plants = []) {
  const counts = {};
  for (const plant of plants) {
    const { id } = fuelEntry(plant?.fuel);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

/** Sample capacities for the legend's size key. */
export const CAPACITY_KEY_MW = [50, 500, 2000];

/**
 * Circle radius in screen pixels for a plant of `capacityMw`. Area grows with
 * capacity (square-root scale) so a 4 GW station reads clearly bigger than a
 * 3 MW solar farm without swamping the map. `scale` adjusts for zoom.
 */
export function plantRadius(capacityMw, scale = 1) {
  const capacity = Number(capacityMw);
  const base = 3 + (Number.isFinite(capacity) && capacity > 0 ? Math.sqrt(capacity) * 0.12 : 0);
  return Math.round(base * scale * 10) / 10;
}

const NOT_REPORTED = 'Not reported';

function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function generationRow(label, generation, fallbackYear) {
  const year = generation?.year || fallbackYear;
  const value = Number.isFinite(generation?.gwh) ? `${formatNumber(generation.gwh, 2)} GWh` : NOT_REPORTED;
  return [`${label} (${year})`, value];
}

/** Only http(s) links are shown; anything else in the data is dropped. */
function safeUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '';
}

/**
 * Info card for one plant, in the layout both views render:
 * { kind, title, color, layout: 'list', rows: [[label, value], ...], link }.
 * Accepts the raw JSON record or the shape returned by fetchPowerPlants().
 */
export function describePowerPlant(plant = {}) {
  const fuel = plant.fuel || '';
  const otherFuels = (plant.otherFuels || []).filter(Boolean);
  const fuelText = fuel ? (otherFuels.length ? `${fuel} (also ${otherFuels.join(', ')})` : fuel) : NOT_REPORTED;
  const capacity = Number(plant.capacityMw);
  const url = safeUrl(plant.url);

  return {
    kind: POWER_PLANT_LAYER_TITLE,
    title: plant.name || 'Power plant',
    color: fuelColor(fuel),
    layout: 'list',
    rows: [
      ['Country', plant.country || 'Malaysia'],
      ['Name', plant.name || NOT_REPORTED],
      ['Fuel Type', fuelText],
      ['Owner', plant.owner || plant.operator || NOT_REPORTED],
      ['Capacity', Number.isFinite(capacity) && capacity > 0 ? `${formatNumber(capacity, 1)} MW` : NOT_REPORTED],
      ['Commissioned', plant.commissioned || ''],
      ['Data Source', plant.source || NOT_REPORTED],
      generationRow('Reported Generation', plant.reportedGeneration, 2018),
      generationRow('Estimated Generation', plant.estimatedGeneration, 2017),
    ],
    link: url ? { href: url, label: 'Open data source' } : null,
  };
}

/** Short hover / label line: "Gas · 625 MW". */
export function plantSummary(plant = {}) {
  const capacity = Number(plant.capacityMw);
  return [plant.fuel, Number.isFinite(capacity) && capacity > 0 ? `${formatNumber(capacity, 1)} MW` : '']
    .filter(Boolean)
    .join(' · ');
}
