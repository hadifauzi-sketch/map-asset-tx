import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let toCanonical;
let buildBridgePayload;
let resolveOilTestKey;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const adapter = await viteServer.ssrLoadModule('/extension-chrome/src/lims/adapter.js');
  const canonical = await viteServer.ssrLoadModule('/extension-chrome/src/shared/canonical.js');
  const fieldMap = await viteServer.ssrLoadModule('/extension-chrome/src/lims/fieldMap.js');

  toCanonical = adapter.toCanonical;
  buildBridgePayload = canonical.buildBridgePayload;
  resolveOilTestKey = fieldMap.resolveOilTestKey;
});

after(async () => {
  await viteServer?.close();
});

// Transcribed from a real ACTMS Sample Result List page
// (SampleResultList.asp?txtJobID=627431&txtSampleID=763943).
const SCRAPED = {
  header: {
    'Job No.': 'TNBR-AC-62637-26-2572',
    Client: 'KEDAH CEMENT SDN. BHD.',
    Region: '-',
    Address:
      'MALAYAN CEMENT INDUSTRIES SDN BHD TELUK EWA, MUKIM AIR HANGAT, 07000 PULAU LANGKAWI, Kedah, Malaysia',
    'Sample No.': 'AC-TXOIL-26-08458',
    'Certificate No.': 'TNBR-AC-ECP001-26-09614',
    Site: 'RAW MATERIAL HANDLING',
    'TX No.': 'T1',
    'Serial No.': 'KM-49743',
    Mnemonic: '221/TF1',
    'Load MVA': '2',
    'Voltages (KV)': '6.6',
    Maker: 'TRAFO UNION',
    'Year Built': '1994',
    'Sample Type': 'Oil',
    'Sampling Point': 'Main Tank',
    'Winding Temp.(°C)': '-',
    'Sampling Date': '20/07/2026',
    'Date Received': '27/07/2026',
    'Test Date': '30/07/2026',
  },
  sections: [
    {
      rows: [
        { test: 'Hydrogen (H₂), ppm v/v', result: 'NIL' },
        { test: 'Oxygen (O₂), ppm v/v', result: '36034' },
        { test: 'Nitrogen (N₂), ppm v/v', result: '73683' },
        { test: 'Methane (CH₄), ppm v/v', result: '7' },
        { test: 'Carbon Monoxide (CO), ppm v/v', result: '261' },
        { test: 'Carbon Dioxide (CO₂), ppm v/v', result: '4470' },
        { test: 'Ethylene (C₂H₄), ppm v/v', result: '1' },
        { test: 'Ethane (C₂H₆), ppm v/v', result: 'NIL' },
        { test: 'Acetylene (C₂H₂), ppm v/v', result: 'NIL' },
        { test: 'Total Dissolved Combustible Gases (TDCG), ppm v/v', result: '269' },
      ],
    },
    { rows: [{ test: 'Neutralization Value (NV), mgKOH/g', result: '0.0227' }] },
    { rows: [{ test: 'Water Content (H₂O),mg/kg (ppm)', result: '16' }] },
    { rows: [{ test: 'Colour', result: 'L1.0' }] },
  ],
};

const REF = { recordId: 'AC-TXOIL-26-08458', sampleNo: 'AC-TXOIL-26-08458', jobId: '627431' };

function buildFromScrape() {
  const { transformer, oilTests, address } = toCanonical(SCRAPED, REF);
  return buildBridgePayload({
    transformer,
    oilTests,
    address,
    recordId: REF.recordId,
    sourceUrl: 'https://actms.tnbr.com.my/ACTMS/Modules/Job/SampleResultList.asp',
  });
}

test('resolves ACTMS analyte labels that carry formula and units', () => {
  assert.equal(resolveOilTestKey('Hydrogen (H₂), ppm v/v'), 'h2');
  assert.equal(resolveOilTestKey('Carbon Dioxide (CO₂), ppm v/v'), 'co2');
  assert.equal(resolveOilTestKey('Acetylene (C₂H₂), ppm v/v'), 'c2h2');
  assert.equal(resolveOilTestKey('Total Dissolved Combustible Gases (TDCG), ppm v/v'), 'tdcg');
  assert.equal(resolveOilTestKey('Neutralization Value (NV), mgKOH/g'), 'acidity');
  assert.equal(resolveOilTestKey('Water Content (H₂O),mg/kg (ppm)'), 'waterContent');
  assert.equal(resolveOilTestKey('Colour'), 'color');
});

test('maps the transformer identification block', () => {
  const { transformer } = buildFromScrape();

  assert.equal(transformer.txName, 'T1');
  assert.equal(transformer.siteName, 'RAW MATERIAL HANDLING');
  assert.equal(transformer.serialNumber, 'KM-49743');
  assert.equal(transformer.mnemonic, '221/TF1');
  assert.equal(transformer.maker, 'TRAFO UNION');
  assert.equal(transformer.voltage, '6.6');
  assert.equal(transformer.loadMVA, 2);
  assert.equal(transformer.yearBuilt, 1994);
});

test('does not store ACTMS placeholder dashes as real values', () => {
  const { transformer } = buildFromScrape();

  // ACTMS prints "-" for Region; storing that literally would create a
  // transformer whose state is "-".
  assert.equal(transformer.state, undefined);
});

test('records NIL gases as 0, matching the PDF importer', () => {
  const [test] = buildFromScrape().oilTestPayloads;

  // parseNumericValue() in dgaImportShared.js maps NIL to 0: the gas was
  // measured and found below detection, which is not the same as "not measured".
  assert.equal(test.h2, 0);
  assert.equal(test.c2h6, 0);
  assert.equal(test.c2h2, 0);
});

test('records ND and Not Detected as 0 alongside NIL', () => {
  // Not every lab writes NIL; the same "below detection limit" finding comes
  // back as ND, N.D., or Not Detected depending on who issued the certificate.
  const scraped = {
    ...SCRAPED,
    sections: [
      {
        rows: [
          { test: 'Hydrogen (H₂), ppm v/v', result: 'ND' },
          { test: 'Methane (CH₄), ppm v/v', result: 'N.D.' },
          { test: 'Acetylene (C₂H₂), ppm v/v', result: 'Not Detected' },
          { test: 'Ethylene (C₂H₄), ppm v/v', result: 'None Detected' },
          { test: 'Carbon Monoxide (CO), ppm v/v', result: '261' },
        ],
      },
    ],
  };

  const [test] = buildBridgePayload({
    ...toCanonical(scraped, { sampleNo: 'AC-TXOIL-26-08458' }),
    intent: 'result',
  }).oilTestPayloads;

  assert.equal(test.h2, 0);
  assert.equal(test.ch4, 0);
  assert.equal(test.c2h2, 0);
  assert.equal(test.c2h4, 0);
  // A real reading alongside them is untouched.
  assert.equal(test.co, 261);
});

test('carries every dissolved gas across with its numeric value', () => {
  const [test] = buildFromScrape().oilTestPayloads;

  assert.equal(test.o2, 36034);
  assert.equal(test.n2, 73683);
  assert.equal(test.ch4, 7);
  assert.equal(test.co, 261);
  assert.equal(test.co2, 4470);
  assert.equal(test.c2h4, 1);
  assert.equal(test.tdcg, 269);
});

test('maps the non-DGA result sections', () => {
  const [test] = buildFromScrape().oilTestPayloads;

  assert.equal(test.acidity, 0.0227);
  assert.equal(test.waterContent, 16);
  assert.equal(test.color, 'L1.0');
});

test('files the record under the sampling date, not the test date', () => {
  const [test] = buildFromScrape().oilTestPayloads;

  // pdfImport.js uses `samplingDate || testDate`. Choosing the test date here
  // would file the same report under 2026-07-30 and duplicate the row instead
  // of updating the one a PDF import already created.
  assert.equal(test.testDate, '2026-07-20');
});

test('falls back to the test date when sampling date is absent', () => {
  const header = { ...SCRAPED.header };
  delete header['Sampling Date'];

  const { oilTests } = toCanonical({ ...SCRAPED, header }, REF);
  assert.equal(oilTests[0].testDate, '30/07/2026');
});

test('keeps ACTMS provenance in the notes field', () => {
  const [test] = buildFromScrape().oilTestPayloads;

  assert.match(test.notes, /AC-TXOIL-26-08458/);
  assert.match(test.notes, /TNBR-AC-62637-26-2572/);
  assert.match(test.notes, /Main Tank/);
});

test('passes the client address through for app-side state inference', () => {
  assert.match(buildFromScrape().address, /Kedah/);
});

test('reports labels it could not map', () => {
  const { diagnostics } = toCanonical(SCRAPED, REF);

  assert.ok(diagnostics.unmappedTransformerFields.includes('Client'));
  assert.equal(diagnostics.unmappedResultLabels.length, 0, 'every result row should map');
});
