import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let buildOilTestRow;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  ({ buildOilTestRow } = await viteServer.ssrLoadModule('/lib/oilTestService.js'));
});

after(async () => {
  await viteServer?.close();
});

const BASE = { testDate: '2026-08-30', testType: 'Routine' };

// The ACTMS certificate in the screenshot: acetylene and every other gas below
// the detection limit is printed as NIL, which the adapter parses to 0.
test('keeps a zero reading instead of writing null', () => {
  const row = buildOilTestRow({ ...BASE, c2h2: 0, h2: 17, ch4: 1 });

  assert.equal(row.c2h2, 0, 'NIL acetylene must store as 0, not null');
  assert.equal(row.h2, 17);
  assert.equal(row.ch4, 1);
});

test('keeps zero across every numeric column', () => {
  const numericColumns = [
    'breakdown',
    'acidity',
    'water_content',
    'interfacial_tension',
    'flash_point',
    'inhibitor',
    'density',
    'dbds',
    'viscosity_40',
    'methanol',
    'ethanol',
    'pcb',
    'power_factor',
    'resistivity',
    'specific_gravity',
    'passivator',
    'h2',
    'ch4',
    'c2h2',
    'c2h4',
    'c2h6',
    'co',
    'co2',
    'o2',
    'n2',
    'tdcg',
    'fol_2',
    'hmf_5',
    'fal_2',
    'acf_2',
    'mef_5',
    'copper_cu',
    'iron_fe',
    'aluminum_al',
    'estimated_dp_furan',
    'estimated_dp_methanol',
  ];

  const row = buildOilTestRow({
    ...BASE,
    breakdown: 0,
    acidity: 0,
    waterContent: 0,
    interfacialTension: 0,
    flashPoint: 0,
    inhibitor: 0,
    density: 0,
    dbds: 0,
    viscosity40: 0,
    methanol: 0,
    ethanol: 0,
    pcb: 0,
    powerFactor: 0,
    resistivity: 0,
    specificGravity: 0,
    passivator: 0,
    h2: 0,
    ch4: 0,
    c2h2: 0,
    c2h4: 0,
    c2h6: 0,
    co: 0,
    co2: 0,
    n2: 0,
    o2: 0,
    tdcg: 0,
    fol2: 0,
    hmf5: 0,
    fal2: 0,
    acf2: 0,
    mef5: 0,
    copperCu: 0,
    ironFe: 0,
    aluminumAl: 0,
    estimatedDpFuran: 0,
    estimatedDpMethanol: 0,
  });

  numericColumns.forEach((column) => {
    assert.equal(row[column], 0, `${column} lost its zero`);
  });
});

test('a missing reading is still null, and stays distinct from zero', () => {
  const row = buildOilTestRow({ ...BASE, c2h2: 0, co2: '', o2: null, n2: undefined });

  assert.equal(row.c2h2, 0);
  assert.equal(row.co2, null);
  assert.equal(row.o2, null);
  assert.equal(row.n2, null);
});

test('accepts numeric strings from the form and the importers', () => {
  const row = buildOilTestRow({ ...BASE, c2h2: '0', h2: '17', co2: '1,234', o2: ' 7255 ' });

  assert.equal(row.c2h2, 0);
  assert.equal(row.h2, 17);
  assert.equal(row.co2, 1234);
  assert.equal(row.o2, 7255);
});

test('non-numeric text never reaches a numeric column', () => {
  const row = buildOilTestRow({ ...BASE, h2: 'Not Specified', co: 'abc' });

  assert.equal(row.h2, null);
  assert.equal(row.co, null);
});

test('blank text columns stay null while real text is trimmed', () => {
  const row = buildOilTestRow({ ...BASE, appearance: '  Clear & Bright ', color: '', notes: '   ' });

  assert.equal(row.appearance, 'Clear & Bright');
  assert.equal(row.color, null);
  assert.equal(row.notes, null);
});
