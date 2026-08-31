import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let compareAcrossEvent;
let summariseInterventionImpact;
let mapOilTestsToChartData;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const impact = await viteServer.ssrLoadModule('/lib/maintenanceImpact.js');
  const chartData = await viteServer.ssrLoadModule('/lib/oilTestChartData.js');

  compareAcrossEvent = impact.compareAcrossEvent;
  summariseInterventionImpact = impact.summariseInterventionImpact;
  mapOilTestsToChartData = chartData.mapOilTestsToChartData;
});

after(async () => {
  await viteServer?.close();
});

// A filtration on 2021-06-01 sits between the 2019 and 2022 samples.
const POINTS = [
  { isoDate: '2017-02-22', date: '22/02/2017', TDCG: 300, BDV: 32, Moisture: 18, Furan: 200 },
  { isoDate: '2019-04-02', date: '02/04/2019', TDCG: 500, BDV: 22, Moisture: 26, Furan: 350 },
  { isoDate: '2022-01-10', date: '10/01/2022', TDCG: 60, BDV: 45, Moisture: 7, Furan: 90 },
];

function measureFor(measures, key) {
  return measures.find((measure) => measure.key === key);
}

test('compares the samples immediately either side of the event', () => {
  const { before: prior, after: next } = compareAcrossEvent('2021-06-01', POINTS);

  assert.equal(prior.isoDate, '2019-04-02', 'the closest sample before, not the oldest');
  assert.equal(next.isoDate, '2022-01-10');
});

test('reads a drop in moisture as an improvement and a drop in BDV as not', () => {
  const { measures } = compareAcrossEvent('2021-06-01', POINTS);

  const moisture = measureFor(measures, 'Moisture');
  const bdv = measureFor(measures, 'BDV');

  // Moisture 26 -> 7 is good; BDV 22 -> 45 is also good, but they moved in
  // opposite directions, so direction alone cannot decide.
  assert.equal(moisture.delta, -19);
  assert.equal(moisture.improved, true);
  assert.equal(bdv.delta, 23);
  assert.equal(bdv.improved, true);
});

test('flags a rise in moisture as a regression', () => {
  const { measures } = compareAcrossEvent('2018-01-01', POINTS);
  const moisture = measureFor(measures, 'Moisture');

  assert.equal(moisture.from, 18);
  assert.equal(moisture.to, 26);
  assert.equal(moisture.improved, false);
});

test('computes percent change against the earlier reading', () => {
  const { measures } = compareAcrossEvent('2021-06-01', POINTS);
  const tdcg = measureFor(measures, 'TDCG');

  assert.equal(tdcg.from, 500);
  assert.equal(tdcg.to, 60);
  assert.equal(Math.round(tdcg.percent), -88);
});

test('skips percent when the baseline is zero rather than dividing by it', () => {
  const points = [
    { isoDate: '2020-01-01', TDCG: 0, BDV: 30, Moisture: 5, Furan: 0 },
    { isoDate: '2021-01-01', TDCG: 40, BDV: 30, Moisture: 5, Furan: 10 },
  ];

  const { measures } = compareAcrossEvent('2020-06-01', points);
  const tdcg = measureFor(measures, 'TDCG');

  assert.equal(tdcg.percent, null);
  assert.equal(tdcg.delta, 40);
});

test('reports an event with no earlier sample as uncomparable', () => {
  const { compared, uncomparable } = summariseInterventionImpact(
    [{ id: 'e1', eventDate: '2016-01-01', eventType: 'filtration' }],
    POINTS
  );

  assert.equal(compared.length, 0);
  assert.equal(uncomparable.length, 1);
  assert.match(uncomparable[0].reason, /No sample before/);
});

test('reports an event with no later sample as uncomparable', () => {
  const { compared, uncomparable } = summariseInterventionImpact(
    [{ id: 'e1', eventDate: '2026-01-01', eventType: 'filtration' }],
    POINTS
  );

  assert.equal(compared.length, 0);
  assert.match(uncomparable[0].reason, /No sample taken since/);
});

test('lists comparable events newest first', () => {
  const { compared } = summariseInterventionImpact(
    [
      { id: 'old', eventDate: '2018-01-01', eventType: 'filtration' },
      { id: 'new', eventDate: '2021-06-01', eventType: 'reclamation' },
    ],
    POINTS
  );

  assert.deepEqual(
    compared.map((row) => row.event.id),
    ['new', 'old']
  );
});

test('works end to end on records shaped like the oil test service returns', () => {
  const oilTests = [
    { testDate: '2022-01-10', tdcg: 60, breakdown: 45, waterContent: 7, fal2: 90 },
    { testDate: '2019-04-02', tdcg: 500, breakdown: 22, waterContent: 26, fal2: 350 },
  ];

  const points = mapOilTestsToChartData(oilTests);
  const { measures } = compareAcrossEvent('2021-06-01', points);

  // fal2 is the furan column; confirm the mapper's key names line up with the
  // measure keys, which is the join most likely to break silently.
  assert.equal(measureFor(measures, 'Furan').from, 350);
  assert.equal(measureFor(measures, 'Furan').to, 90);
  assert.equal(measureFor(measures, 'BDV').to, 45);
});

test('copes with junk input', () => {
  assert.deepEqual(compareAcrossEvent('', POINTS), { before: null, after: null, measures: [] });
  assert.deepEqual(compareAcrossEvent('2021-06-01', null), {
    before: null,
    after: null,
    measures: [],
  });
  assert.deepEqual(summariseInterventionImpact(null, POINTS), { compared: [], uncomparable: [] });
});
