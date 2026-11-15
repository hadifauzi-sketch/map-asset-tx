import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  FUEL_LEGEND,
  POWER_PLANT_LAYER_TITLE,
  countPlantsByFuel,
  describePowerPlant,
  fuelColor,
  plantRadius,
  plantSummary,
} from '../lib/powerPlants.js';
import { gridPopupHtml } from '../lib/powerGridMap.js';

const plants = JSON.parse(readFileSync(new URL('../public/data/power-plants-mys.json', import.meta.url), 'utf8'));

test('fuel colours follow the legend, unknown fuels fall under Others', () => {
  assert.deepEqual(
    FUEL_LEGEND.map((entry) => entry.label),
    ['Coal', 'Oil', 'Gas', 'Hydro', 'Nuclear', 'Solar', 'Waste', 'Wind', 'Geothermal', 'Biomass', 'Others']
  );
  assert.equal(fuelColor('Coal'), '#000000');
  assert.equal(fuelColor('gas'), '#bc80bd');
  assert.equal(fuelColor('Petcoke'), '#b2df8a');
  assert.equal(fuelColor(''), '#b2df8a');
});

test('plant radius grows with capacity and scales with zoom', () => {
  assert.equal(plantRadius(null), 3);
  assert.ok(plantRadius(4180) > plantRadius(625));
  assert.ok(plantRadius(625) > plantRadius(3));
  assert.equal(plantRadius(625, 2), Math.round(plantRadius(625) * 2 * 10) / 10);
});

test('generated Malaysia data carries the detail fields', () => {
  assert.equal(plants.length, 55);
  const putrajaya = plants.find((plant) => plant.name === 'Putrajaya');
  assert.equal(putrajaya.country, 'Malaysia');
  assert.equal(putrajaya.capacityMw, 625);
  assert.equal(putrajaya.source, 'Penisular Malaysia Electricity Supply Company');
  assert.deepEqual(putrajaya.estimatedGeneration, { year: 2017, gwh: 3123.13 });
  assert.equal(countPlantsByFuel(plants).Gas, 20);
});

test('describePowerPlant builds the "Label: value" card', () => {
  const putrajaya = plants.find((plant) => plant.name === 'Putrajaya');
  const info = describePowerPlant(putrajaya);
  assert.equal(info.kind, POWER_PLANT_LAYER_TITLE);
  assert.equal(info.layout, 'list');
  assert.equal(info.color, '#bc80bd');
  const rows = Object.fromEntries(info.rows);
  assert.equal(rows.Country, 'Malaysia');
  assert.equal(rows['Fuel Type'], 'Gas');
  assert.equal(rows.Owner, 'Not reported');
  assert.equal(rows.Capacity, '625 MW');
  assert.equal(rows['Reported Generation (2018)'], 'Not reported');
  assert.equal(rows['Estimated Generation (2017)'], '3,123.13 GWh');
  assert.match(info.link.href, /^http:\/\/www\.st\.gov\.my/);
  assert.equal(plantSummary(putrajaya), 'Gas · 625 MW');

  assert.equal(describePowerPlant({ name: 'X', url: 'javascript:alert(1)' }).link, null);
});

test('gridPopupHtml renders list cards with bold labels and a safe link', () => {
  const html = gridPopupHtml(describePowerPlant({ name: '<Jimah>', fuel: 'Coal', capacityMw: 1400, url: 'https://e.org/a"b' }), '#000000');
  assert.match(html, /<b>Name:<\/b> &lt;Jimah&gt;/);
  assert.match(html, /<b>Capacity:<\/b> 1,400 MW/);
  assert.match(html, /href="https:\/\/e\.org\/a&quot;b"/);
  assert.doesNotMatch(html, /Commissioned/);
});
