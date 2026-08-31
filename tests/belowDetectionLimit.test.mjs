import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

// The app-side importer (PDF / manual review) and the extension's bridge must
// agree on what "below the detection limit" looks like, or the same certificate
// would import differently depending on which route it came in through.
let parseImportedFieldValue;
let parseNumericValue;
let toNumber;
let toText;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const shared = await viteServer.ssrLoadModule('/lib/dga-import/dgaImportShared.js');
  const canonical = await viteServer.ssrLoadModule('/extension/src/shared/canonical.js');

  parseImportedFieldValue = shared.parseImportedFieldValue;
  parseNumericValue = shared.parseNumericValue;
  toNumber = canonical.toNumber;
  toText = canonical.toText;
});

after(async () => {
  await viteServer?.close();
});

const BELOW_LIMIT_NOTATIONS = ['NIL', 'nil', 'Nil', 'ND', 'nd', 'N.D.', 'Not Detected', 'not detected', 'None Detected'];

test('every below-limit notation parses to 0 in the app importer', () => {
  BELOW_LIMIT_NOTATIONS.forEach((notation) => {
    assert.equal(parseNumericValue(notation), 0, `${notation} should parse to 0`);
  });
});

test('every below-limit notation parses to 0 in the extension', () => {
  BELOW_LIMIT_NOTATIONS.forEach((notation) => {
    assert.equal(toNumber(notation), 0, `${notation} should parse to 0`);
  });
});

test('a genuinely absent reading is still null, not 0', () => {
  ['', '   ', 'Not Specified', 'Not Tested', 'N/A', '-'].forEach((value) => {
    assert.equal(parseNumericValue(value), null, `${value || '(blank)'} should stay null`);
    assert.equal(toNumber(value), null, `${value || '(blank)'} should stay null`);
  });
});

test('real readings are unaffected by the below-limit tokens', () => {
  [
    ['17', 17],
    ['0.5', 0.5],
    ['1,234', 1234],
    ['<0.5', 0.5],
    ['7255', 7255],
  ].forEach(([input, expected]) => {
    assert.equal(parseNumericValue(input), expected);
    assert.equal(toNumber(input), expected);
  });
});

test('below-limit notations are not stored as literal text either', () => {
  BELOW_LIMIT_NOTATIONS.forEach((notation) => {
    assert.equal(toText(notation), '', `${notation} should not be stored as text`);
    assert.equal(parseImportedFieldValue('appearance', notation), null);
  });

  // A real text reading still comes through untouched.
  assert.equal(toText(' Clear & Bright '), 'Clear & Bright');
  assert.equal(parseImportedFieldValue('appearance', 'Clear & Bright'), 'Clear & Bright');
});
