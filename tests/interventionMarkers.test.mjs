import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let buildInterventionMarkers;
let markersForSeries;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const markers = await viteServer.ssrLoadModule('/lib/interventionMarkers.js');
  buildInterventionMarkers = markers.buildInterventionMarkers;
  markersForSeries = markers.markersForSeries;
});

after(async () => {
  await viteServer?.close();
});

const POINTS = [
  { date: '18/02/2016', isoDate: '2016-02-18' },
  { date: '22/02/2017', isoDate: '2017-02-22' },
  { date: '09/11/2021', isoDate: '2021-11-09' },
  { date: '23/07/2024', isoDate: '2024-07-23' },
];

test('anchors an event to the first sample taken after it', () => {
  // Filtration in June 2021: the November 2021 sample is the first one that can
  // show its effect, so that is where the trend step appears.
  const { groups } = buildInterventionMarkers(
    [{ id: 'i1', eventDate: '2021-06-01', eventType: 'filtration' }],
    POINTS
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].x, '09/11/2021');
  assert.equal(groups[0].label, 'FIL');
});

test('anchors an event that falls exactly on a sample date to that sample', () => {
  const { groups } = buildInterventionMarkers(
    [{ id: 'i1', eventDate: '2017-02-22', eventType: 'degassing' }],
    POINTS
  );

  assert.equal(groups[0].x, '22/02/2017');
});

test('holds back events newer than the last sample', () => {
  // Nothing has been measured since, so there is no step to point at yet — but
  // the UI still needs to say the work happened.
  const { groups, pending } = buildInterventionMarkers(
    [{ id: 'i1', eventDate: '2026-01-01', eventType: 'retrofill' }],
    POINTS
  );

  assert.equal(groups.length, 0);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'i1');
});

test('groups events that land between the same pair of samples', () => {
  const { groups } = buildInterventionMarkers(
    [
      { id: 'i1', eventDate: '2021-03-01', eventType: 'filtration' },
      { id: 'i2', eventDate: '2021-05-01', eventType: 'inhibitor_dosing' },
    ],
    POINTS
  );

  // One line, not two overlapping ones.
  assert.equal(groups.length, 1);
  assert.equal(groups[0].x, '09/11/2021');
  assert.equal(groups[0].label, 'FIL+INH');
  assert.equal(groups[0].events.length, 2);
});

test('unions the reset series across a grouped marker', () => {
  const { groups } = buildInterventionMarkers(
    [
      { id: 'i1', eventDate: '2021-03-01', eventType: 'degassing' },
      { id: 'i2', eventDate: '2021-05-01', eventType: 'inhibitor_dosing' },
    ],
    POINTS
  );

  assert.ok(groups[0].resets.includes('DGA'));
  assert.ok(groups[0].resets.includes('Inhibitor'));
});

test('an event before the first sample anchors to that first sample', () => {
  const { groups, pending } = buildInterventionMarkers(
    [{ id: 'i1', eventDate: '2010-01-01', eventType: 'retrofill' }],
    POINTS
  );

  assert.equal(pending.length, 0);
  assert.equal(groups[0].x, '18/02/2016');
});

test('each chart only draws the events that reset what it plots', () => {
  const { groups } = buildInterventionMarkers(
    [
      { id: 'i1', eventDate: '2021-03-01', eventType: 'inhibitor_dosing' },
      { id: 'i2', eventDate: '2016-01-01', eventType: 'degassing' },
    ],
    POINTS
  );

  const dga = markersForSeries(groups, 'DGA');
  const inhibitor = markersForSeries(groups, 'Inhibitor');

  assert.equal(dga.length, 1);
  assert.equal(dga[0].x, '18/02/2016', 'only the degas belongs on the DGA chart');
  assert.equal(inhibitor.length, 1);
  assert.equal(inhibitor[0].x, '09/11/2021');
});

test('an inspection marks nothing, since it changes no baseline', () => {
  const { groups } = buildInterventionMarkers(
    [{ id: 'i1', eventDate: '2021-03-01', eventType: 'inspection' }],
    POINTS
  );

  assert.equal(groups.length, 1, 'it still appears on the timeline');
  assert.equal(markersForSeries(groups, 'DGA').length, 0, 'but annotates no chart');
});

test('filtration and reclamation annotate different charts', () => {
  // They are different processes: filtration is physical (vacuum dehydration and
  // particle removal, which also strips gas and furans) and cannot remove acids.
  // Reclamation is chemical clay treatment, which is what addresses acids,
  // sludge and soluble decay products.
  const { groups } = buildInterventionMarkers(
    [
      { id: 'fil', eventDate: '2016-01-01', eventType: 'filtration' },
      { id: 'rec', eventDate: '2021-03-01', eventType: 'reclamation' },
    ],
    POINTS
  );

  const dga = markersForSeries(groups, 'DGA');
  const furan = markersForSeries(groups, 'Furan');
  const acidity = markersForSeries(groups, 'Acidity');
  const moisture = markersForSeries(groups, ['Moisture', 'BDV']);

  assert.equal(dga[0].events[0].id, 'fil', 'filtration strips dissolved gas');
  assert.equal(furan[0].events[0].id, 'fil', 'filtration removes furans');
  assert.equal(moisture[0].events[0].id, 'fil', 'filtration is what recovers BDV and moisture');

  assert.equal(acidity.length, 1);
  assert.equal(acidity[0].events[0].id, 'rec', 'only reclamation resets acidity');
});

test('filtration does not claim to reset acidity', () => {
  const { groups } = buildInterventionMarkers(
    [{ id: 'fil', eventDate: '2016-01-01', eventType: 'filtration' }],
    POINTS
  );

  assert.equal(markersForSeries(groups, 'Acidity').length, 0);
});

test('reclamation resets the soluble decay indicators', () => {
  const { groups } = buildInterventionMarkers(
    [{ id: 'rec', eventDate: '2016-01-01', eventType: 'reclamation' }],
    POINTS
  );

  assert.equal(groups[0].label, 'REC');
  // IFT and colour are how soluble decay products and sludge show up in testing.
  assert.deepEqual([...groups[0].resets].sort(), ['Acidity', 'Color', 'IFT']);
});

test('copes with no samples, no events, and junk input', () => {
  assert.deepEqual(buildInterventionMarkers([], POINTS), { groups: [], pending: [] });
  assert.deepEqual(buildInterventionMarkers(null, null), { groups: [], pending: [] });
  assert.deepEqual(
    buildInterventionMarkers([{ id: 'x', eventType: 'filtration' }], POINTS),
    { groups: [], pending: [] },
    'an event with no date is skipped rather than throwing'
  );
});
