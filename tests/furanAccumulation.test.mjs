import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let accumulateFuran;
let summariseFuran;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const furan = await viteServer.ssrLoadModule('/lib/furanAccumulation.js');
  accumulateFuran = furan.accumulateFuran;
  summariseFuran = furan.summariseFuran;
});

after(async () => {
  await viteServer?.close();
});

const totals = (rows) => rows.map((row) => row.FuranTotal);
const at = (isoDate, Furan) => ({ isoDate, Furan });

test('a filtration makes the next reading stack on the previous total', () => {
  // The worked example: 250 ppb, filtered to 0, next test reads 30 -> 280 ppb.
  const rows = accumulateFuran(
    [at('2020-01-01', 250), at('2021-01-01', 0), at('2022-01-01', 30)],
    ['2021-06-01']
  );

  assert.deepEqual(totals(rows), [250, 250, 280]);
  assert.equal(rows[2].furanReset, true);
});

test('stacks correctly even with no zero sample recorded after the strip', () => {
  const rows = accumulateFuran([at('2020-01-01', 250), at('2022-01-01', 30)], ['2021-06-01']);

  assert.deepEqual(totals(rows), [250, 280]);
});

test('does not double count furan already in the oil', () => {
  // Untreated, the 350 reading contains the 200 measured earlier.
  const rows = accumulateFuran([at('2020-01-01', 200), at('2021-01-01', 350)], []);

  assert.deepEqual(totals(rows), [200, 350]);
});

test('an ordinary dip between samples is variation, not a strip', () => {
  // This is the bug that inflated the real asset's total to ~2382 ppb: reading
  // 700 -> 650 as a removal added a further 650 ppb of imaginary production.
  const rows = accumulateFuran(
    [at('2020-01-01', 1200), at('2021-01-01', 700), at('2022-01-01', 650)],
    []
  );

  assert.deepEqual(totals(rows), [1200, 1200, 1200]);
  assert.equal(rows.some((row) => row.furanReset), false);
});

test('a dip and recovery within one fill does not inflate the total', () => {
  const rows = accumulateFuran(
    [at('2020-01-01', 700), at('2021-01-01', 650), at('2022-01-01', 710)],
    []
  );

  // Only the 10 ppb above the previous peak is new.
  assert.deepEqual(totals(rows), [700, 700, 710]);
});

test('each fill contributes its peak, and the peaks sum across strips', () => {
  const rows = accumulateFuran(
    [
      at('2019-01-01', 400),
      at('2020-01-01', 1200), // peak of the first fill
      at('2021-01-01', 900), // variation, still the first fill
      at('2023-01-01', 300), // after the strip
      at('2024-01-01', 500), // same fill, higher
    ],
    ['2022-06-01']
  );

  assert.deepEqual(totals(rows), [400, 1200, 1200, 1500, 1700]);
});

test('the lifetime total never falls', () => {
  const rows = accumulateFuran(
    [at('2019-01-01', 100), at('2020-01-01', 500), at('2021-01-01', 20), at('2022-01-01', 60)],
    ['2020-06-01']
  );
  const values = totals(rows);

  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i] >= values[i - 1], `total fell at index ${i}`);
  }
});

test('treats an unmeasured sample as a gap, not as a drop to zero', () => {
  const rows = accumulateFuran([at('2020-01-01', 200), at('2021-01-01', 0), at('2022-01-01', 260)], []);

  assert.deepEqual(totals(rows), [200, 200, 260]);
});

test('reports null before the first real reading', () => {
  const rows = accumulateFuran([at('2019-01-01', 0), at('2020-01-01', 0), at('2021-01-01', 40)], []);

  assert.deepEqual(totals(rows), [null, null, 40]);
});

test('a strip recorded before any reading does not create a phantom segment', () => {
  const rows = accumulateFuran([at('2021-01-01', 40)], ['2019-01-01']);

  assert.deepEqual(totals(rows), [40]);
});

test('summarises lifetime, current and removed furan', () => {
  const summary = summariseFuran(
    [at('2020-01-01', 250), at('2022-01-01', 30)],
    ['2021-06-01']
  );

  assert.equal(summary.total, 280);
  assert.equal(summary.current, 30);
  assert.equal(summary.removed, 250);
  assert.equal(summary.resetCount, 1);
});

test('an untreated asset reports nothing removed', () => {
  const summary = summariseFuran([at('2020-01-01', 200), at('2021-01-01', 350)], []);

  assert.equal(summary.total, 350);
  assert.equal(summary.removed, 0);
  assert.equal(summary.resetCount, 0);
});

test('copes with junk input', () => {
  assert.deepEqual(accumulateFuran(null), []);
  assert.equal(accumulateFuran([{}])[0].FuranTotal, null);
  assert.deepEqual(summariseFuran([at('2020-01-01', 0)]), {
    total: null,
    current: null,
    removed: null,
    resetCount: 0,
  });
});
