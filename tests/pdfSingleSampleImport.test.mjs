import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let importUtils;
let parseHistory;
let parseSingleSample;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const pdfImport = await viteServer.ssrLoadModule('/lib/dga-import/pdfImport.js');
  importUtils = await viteServer.ssrLoadModule('/lib/oilTestImportUtils.js');
  parseHistory = pdfImport.extractHistoryImportFromPdfTokens;
  parseSingleSample = pdfImport.extractSingleSampleFromOcrPages;
});

after(async () => {
  await viteServer?.close();
});

const TSV_HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';

function createOcrPage(rows) {
  let wordNumber = 0;
  const lines = [TSV_HEADER];

  rows.forEach(({ top, words }, lineIndex) => {
    words.forEach(({ text, left, width = Math.max(12, text.length * 9) }) => {
      wordNumber += 1;
      lines.push([
        5,
        1,
        1,
        1,
        lineIndex + 1,
        wordNumber,
        left,
        top,
        width,
        18,
        96,
        text,
      ].join('\t'));
    });
  });

  return { text: '', tsv: lines.join('\n') };
}

function resultRow(top, labelWords, result, reference) {
  const words = labelWords.map((text, index) => ({ text, left: 140 + index * 105 }));
  words.push({ text: result, left: 630 });
  words.push({ text: result === 'NIL' ? 'Normal' : 'High', left: 805 });
  words.push({ text: reference, left: 1070 });
  return { top, words };
}

test('reads every supported result from a scanned single-sample certificate', () => {
  const firstPage = createOcrPage([
    {
      top: 30,
      words: [
        { text: '8/23/2026', left: 50 },
        { text: 'Sample', left: 700 },
        { text: 'Result', left: 770 },
        { text: 'List', left: 835 },
      ],
    },
    {
      top: 70,
      words: [
        { text: 'Sampling', left: 750 },
        { text: 'Date', left: 850 },
        { text: '15/07/2026', left: 1080 },
      ],
    },
    {
      top: 100,
      words: [
        { text: 'Test', left: 330 },
        { text: 'Result', left: 620 },
        { text: 'Flag', left: 815 },
        { text: 'Reference', left: 1065 },
      ],
    },
    resultRow(130, ['Hydrogen'], 'NIL', '100'),
    resultRow(160, ['Oxygen'], '32531', 'Not specified'),
    resultRow(190, ['Nitrogen'], '79162', 'Not specified'),
    resultRow(220, ['Methane'], '2', '120'),
    resultRow(250, ['Carbon', 'Monoxide'], '536', '350'),
    resultRow(280, ['Carbon', 'Dioxide'], '2758', '2500'),
    resultRow(310, ['Ethylene'], '148', '50'),
    resultRow(340, ['Ethane'], 'NIL', '65'),
    resultRow(370, ['Acetylene'], 'NIL', '1'),
  ]);
  const secondPage = createOcrPage([
    {
      top: 40,
      words: [
        { text: 'Test', left: 330 },
        { text: 'Result', left: 620 },
        { text: 'Flag', left: 815 },
        { text: 'Reference', left: 1065 },
      ],
    },
    resultRow(70, ['Water', 'Content'], '8', '25'),
    resultRow(100, ['Dielectric', 'Breakdown'], '94', '30'),
  ]);

  const candidate = parseSingleSample([firstPage, secondPage]);

  assert.deepEqual(candidate.samplePatch, {
    h2: '0',
    ch4: '2',
    c2h6: '0',
    c2h4: '148',
    c2h2: '0',
    co: '536',
    co2: '2758',
    o2: '32531',
    n2: '79162',
    breakdown: '94',
    waterContent: '8',
    date: '2026-07-15',
  });

  const payloads = importUtils.buildImportedOilTestPayloads(
    { kind: 'single-sample', ...candidate },
    { name: 'single-certificate.pdf' }
  );

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].testDate, '2026-07-15');
  assert.equal(payloads[0].tdcg, '686');
});

test('preserves appearance when Documents submits reviewed import rows', () => {
  const payloads = importUtils.buildImportedOilTestPayloadsFromRows([
    {
      testDate: '2026-07-15',
      testType: 'Routine',
      appearance: 'Clear and bright',
    },
  ]);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].appearance, 'Clear and bright');
});

test('keeps legacy historical PDF rows and date-matched additional tests', () => {
  const historyImport = parseHistory([
    'Dissolved Gas Analysis',
    'Date',
    'H2',
    'O2',
    'N2',
    'CH4',
    'CO',
    'CO2',
    'C2H4',
    'C2H6',
    'C2H2',
    'Fault Zone',
    '15/07/2025',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '99',
    '16/07/2025',
    '10',
    '20',
    '30',
    '40',
    '50',
    '60',
    '70',
    '80',
    '90',
    '100',
    'Moisture Content',
    'Date',
    'Result',
    '15/07/2025',
    '12',
    '16/07/2025',
    '13',
    'Reference',
  ], 'history.pdf');

  assert.equal(historyImport.sampleCount, 2);
  assert.deepEqual(historyImport.samples[0], {
    date: '2025-07-15',
    h2: '1',
    o2: '2',
    n2: '3',
    ch4: '4',
    co: '5',
    co2: '6',
    c2h4: '7',
    c2h6: '8',
    c2h2: '9',
    waterContent: '12',
  });
  assert.equal(historyImport.samples[1].waterContent, '13');
});

test('keeps the generated historical PDF gas column order', () => {
  const historyImport = parseHistory([
    'Dissolved Gas Analysis',
    'ID',
    'Date',
    'H2',
    'CH4',
    'C2H6',
    'C2H4',
    'C2H2',
    'CO',
    'CO2',
    'O2',
    'N2',
    'Age',
    'Fault Zone',
    '15/07/2025',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
  ], 'generated-history.pdf');

  assert.equal(historyImport.sampleCount, 1);
  assert.deepEqual(historyImport.samples[0], {
    date: '2025-07-15',
    h2: '1',
    ch4: '2',
    c2h6: '3',
    c2h4: '4',
    c2h2: '5',
    co: '6',
    co2: '7',
    o2: '8',
    n2: '9',
    transformerAge: '10',
  });
});
