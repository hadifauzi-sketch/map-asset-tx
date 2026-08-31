import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let paperLife;
let accumulateFuran;
let accumulateMarker;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  paperLife = await viteServer.ssrLoadModule('/lib/paperLife.js');
  const furan = await viteServer.ssrLoadModule('/lib/furanAccumulation.js');
  accumulateFuran = furan.accumulateFuran;
  accumulateMarker = furan.accumulateMarker;
});

after(async () => {
  await viteServer?.close();
});

test('new paper reads 100% remaining and end-of-life reads 0%', () => {
  assert.equal(paperLife.remainingLifePercent(1000), 100);
  assert.equal(paperLife.remainingLifePercent(200), 0);
  assert.equal(paperLife.remainingLifePercent(600), 50);
});

test('remaining life is the complement of the life-used figure in the oil test table', () => {
  // The "Life" chip shows used; the chart shows remaining. They must add to 100
  // or the two screens will appear to contradict each other.
  [1000, 800, 600, 313, 200].forEach((dp) => {
    assert.equal(
      paperLife.remainingLifePercent(dp) + paperLife.lifeUsedPercent(dp),
      100,
      `dp ${dp}`
    );
  });
});

test('clamps rather than reporting negative or above-new life', () => {
  assert.equal(paperLife.remainingLifePercent(1500), 100);
  assert.equal(paperLife.remainingLifePercent(50), 0);
});

test('returns null when the by-product was never measured', () => {
  assert.equal(paperLife.calculateDpFromFuran(0), null);
  assert.equal(paperLife.calculateDpFromMethanol(null), null);
  assert.equal(paperLife.remainingLifePercent(null), null);
});

test('reads 2-FAL as ppb, the unit the app stores', () => {
  // The correlation is defined for ppm. Passing the stored ppb value straight in
  // made it cross zero at ~66 ppb, so every realistic reading returned null and
  // the furan DP silently produced nothing anywhere in the app.
  assert.equal(paperLife.calculateDpFromFuran(1000), 402, '1000 ppb = 1 ppm');
  assert.ok(paperLife.calculateDpFromFuran(632) > 0, 'a real in-oil reading');
  assert.ok(paperLife.calculateDpFromFuran(1851) > 0, 'a real lifetime total');
});

test('produces plausible DP across the range real assets report', () => {
  // Sanity band: an in-service transformer should land between new paper and
  // end of life, not outside it.
  [100, 350, 632, 1200, 1851, 3000].forEach((ppb) => {
    const dp = paperLife.calculateDpFromFuran(ppb);
    assert.ok(dp > 0 && dp < 800, `${ppb} ppb gave DP ${dp}`);
  });
});

test('higher furan means lower remaining life', () => {
  const young = paperLife.remainingLifePercent(paperLife.calculateDpFromFuran(100));
  const old = paperLife.remainingLifePercent(paperLife.calculateDpFromFuran(1851));

  assert.ok(young > old, `${young}% should exceed ${old}%`);
});

test('life does not recover after a filtration', () => {
  // The trap: filtration strips furan, so DP-from-measured-furan jumps up and
  // the paper appears to get younger. Driving it from the lifetime total keeps
  // the curve monotonic.
  const points = [
    { isoDate: '2020-01-01', Furan: 1200, Methanol: 0 },
    { isoDate: '2023-01-01', Furan: 90, Methanol: 0 }, // after a strip
    { isoDate: '2024-01-01', Furan: 300, Methanol: 0 },
  ];

  const rows = paperLife.buildPaperLifeSeries(accumulateFuran(points, ['2022-06-01']));
  const life = rows.map((row) => row.LifeFromFuran);

  assert.ok(life.every((value) => typeof value === 'number'), `got ${life.join(', ')}`);
  for (let i = 1; i < life.length; i += 1) {
    assert.ok(life[i] <= life[i - 1], `life rose at index ${i}: ${life.join(', ')}`);
  }
});

test('the naive measured value would have shown the paper getting younger', () => {
  // Guards the reason for the design: same data, read off the measured value.
  const beforeStrip = paperLife.remainingLifePercent(paperLife.calculateDpFromFuran(1200));
  const afterStrip = paperLife.remainingLifePercent(paperLife.calculateDpFromFuran(90));

  assert.ok(
    afterStrip > beforeStrip,
    `measured furan implies a younger transformer after a strip (${beforeStrip}% -> ${afterStrip}%)`
  );
});

test('methanol gets the same lifetime treatment as furan', () => {
  const points = [
    { isoDate: '2020-01-01', Furan: 0, Methanol: 30 },
    { isoDate: '2023-01-01', Furan: 0, Methanol: 4 },
  ];

  const withFuran = accumulateFuran(points, ['2022-06-01']);
  const rows = paperLife.buildPaperLifeSeries(
    accumulateMarker(withFuran, ['2022-06-01'], {
      sourceKey: 'Methanol',
      totalKey: 'MethanolTotal',
      resetKey: 'methanolReset',
    })
  );

  assert.equal(rows[1].MethanolTotal, 34, 'methanol stacks across the strip too');
  assert.ok(rows[1].LifeFromMethanol <= rows[0].LifeFromMethanol);
});

test('reports the worst-case estimate across both markers', () => {
  const rows = [
    { LifeFromFuran: 60, LifeFromMethanol: 45 },
    { LifeFromFuran: 55, LifeFromMethanol: null },
  ];

  assert.equal(paperLife.lowestRemainingLife(rows), 45);
});

test('lowest remaining life is null when nothing can be estimated', () => {
  assert.equal(paperLife.lowestRemainingLife([{ LifeFromFuran: null }]), null);
  assert.equal(paperLife.lowestRemainingLife([]), null);
});
