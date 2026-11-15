import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutPowerPlantLabels, rectanglesOverlap } from '../lib/powerPlantLabelLayout.js';

const viewport = { width: 1000, height: 700 };
const station = (id, x, y, priority = 100) => ({ id, x, y, width: 190, height: 52, radius: 9, priority });

test('co-located stations receive separate readable labels without covering their pins', () => {
  const items = [station('Tuanku Jaafar', 500, 350, 1400), station('PD', 500, 350, 700)];
  const result = layoutPowerPlantLabels(items, viewport);
  assert.equal(result.size, 2);
  assert.equal(rectanglesOverlap(...result.values()), false);
  for (const box of result.values()) {
    assert.equal(rectanglesOverlap(box, { x: 491, y: 341, width: 18, height: 18 }), false);
  }
});

test('nearby stations keep distinct labels at close and distant screen separations', () => {
  for (const separation of [2, 15, 60, 250]) {
    const result = layoutPowerPlantLabels([station('a', 400, 300), station('b', 400 + separation, 305)], viewport);
    assert.equal(result.size, 2);
    assert.equal(rectanglesOverlap(...result.values()), false);
  }
});

test('labels stay inside the map and avoid side panels and the legend', () => {
  const obstacles = [
    { x: 0, y: 0, width: 230, height: 700 },
    { x: 800, y: 0, width: 200, height: 400 },
    { x: 380, y: 500, width: 240, height: 190 },
  ];
  const result = layoutPowerPlantLabels([
    station('left', 240, 350), station('right', 790, 320),
    station('legend', 500, 490), station('edge', 990, 690),
  ], { ...viewport, obstacles });
  assert.equal(result.size, 4);
  for (const box of result.values()) {
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1000 && box.y + box.height <= 700);
    assert.ok(obstacles.every((obstacle) => !rectanglesOverlap(box, obstacle)));
  }
});

test('dense distant views prioritise capacity and never stack label cards', () => {
  const items = Array.from({ length: 55 }, (_, index) => station(String(index), 500 + index % 4, 350, index * 100));
  const result = layoutPowerPlantLabels(items, viewport);
  assert.ok(result.has('54'));
  assert.ok(result.size > 1 && result.size < items.length);
  const boxes = [...result.values()];
  boxes.forEach((box, index) => boxes.slice(index + 1).forEach((other) => assert.equal(rectanglesOverlap(box, other), false)));
  assert.deepEqual(layoutPowerPlantLabels([...items].reverse(), viewport), result);
});

test('empty and very small viewports handle labels without clipping', () => {
  assert.equal(layoutPowerPlantLabels([], viewport).size, 0);
  assert.equal(layoutPowerPlantLabels([station('a', 30, 30)], { width: 50, height: 50 }).size, 0);
});
