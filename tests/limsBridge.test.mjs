import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let parseBridgePayload;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const limsBridge = await viteServer.ssrLoadModule('/lib/limsBridge.js');
  parseBridgePayload = limsBridge.parseBridgePayload;
});

after(async () => {
  await viteServer?.close();
});

function validPayload(overrides = {}) {
  return {
    version: 1,
    recordId: 'LIMS-4471',
    sourceUrl: 'https://lims.example.com/equipment/4471',
    capturedAt: '2026-08-31T02:00:00.000Z',
    transformer: { serialNumber: 'SN-99012', txName: '132-TR-B', maker: 'ABB' },
    oilTestPayloads: [{ testDate: '2026-08-14', testType: 'DGA', h2: 12, c2h2: 0 }],
    ...overrides,
  };
}

test('accepts a well-formed payload and preserves canonical fields', () => {
  const parsed = parseBridgePayload(validPayload());

  assert.equal(parsed.recordId, 'LIMS-4471');
  assert.equal(parsed.transformer.serialNumber, 'SN-99012');
  assert.equal(parsed.oilTestPayloads.length, 1);
  assert.equal(parsed.oilTestPayloads[0].h2, 12);
  assert.equal(parsed.oilTestPayloads[0].c2h2, 0, 'a zero gas reading must survive sanitising');
});

test('rejects unsupported envelope versions', () => {
  assert.equal(parseBridgePayload(validPayload({ version: 99 })), null);
  assert.equal(parseBridgePayload(validPayload({ version: undefined })), null);
});

test('rejects a payload with no way to match an asset', () => {
  const parsed = parseBridgePayload(
    validPayload({ transformer: { maker: 'ABB', state: 'Johor' } })
  );

  assert.equal(parsed, null);
});

test('drops tests without a valid ISO date', () => {
  const parsed = parseBridgePayload(
    validPayload({
      oilTestPayloads: [
        { testDate: '14/08/2026', h2: 5 },
        { testDate: '2026-08-14', h2: 5 },
      ],
    })
  );

  assert.equal(parsed.oilTestPayloads.length, 1);
  assert.equal(parsed.oilTestPayloads[0].testDate, '2026-08-14');
});

test('rejects a result import with no dated tests', () => {
  const empty = validPayload({ intent: 'result', oilTestPayloads: [] });
  const undated = validPayload({ intent: 'result', oilTestPayloads: [{ testDate: 'not-a-date' }] });

  assert.equal(parseBridgePayload(empty), null);
  assert.equal(parseBridgePayload(undated), null);
});

test('accepts an asset import with no dated tests', () => {
  // The asset action only carries identity fields, so it must still work on a
  // sample page whose results have not been entered yet.
  const parsed = parseBridgePayload(validPayload({ intent: 'asset', oilTestPayloads: [] }));

  assert.equal(parsed.intent, 'asset');
  assert.equal(parsed.transformer.serialNumber, 'SN-99012');
  assert.deepEqual(parsed.oilTestPayloads, []);
});

test('defaults to the asset intent and rejects unknown ones', () => {
  assert.equal(parseBridgePayload(validPayload()).intent, 'asset');
  assert.equal(parseBridgePayload(validPayload({ intent: 'result' })).intent, 'result');
  // An unrecognised intent must fall back to the action that writes nothing.
  assert.equal(parseBridgePayload(validPayload({ intent: 'delete-everything' })).intent, 'asset');
});

test('strips keys outside the canonical whitelist', () => {
  const parsed = parseBridgePayload(
    validPayload({
      transformer: { serialNumber: 'SN-1', id: 'spoofed-uuid', created_at: 'x' },
      oilTestPayloads: [{ testDate: '2026-08-14', h2: 1, transformer_id: 'spoofed', notes: 'ok' }],
    })
  );

  assert.deepEqual(Object.keys(parsed.transformer), ['serialNumber']);
  assert.equal(parsed.oilTestPayloads[0].transformer_id, undefined);
  assert.equal(parsed.oilTestPayloads[0].notes, 'ok');
});

test('coerces numeric strings and rejects non-numeric ones', () => {
  const parsed = parseBridgePayload(
    validPayload({
      oilTestPayloads: [{ testDate: '2026-08-14', h2: '45', ch4: 'trace', loadMVA: '30' }],
    })
  );

  assert.equal(parsed.oilTestPayloads[0].h2, 45);
  assert.equal(parsed.oilTestPayloads[0].ch4, undefined);
});

test('validates latitude and longitude bounds', () => {
  const good = parseBridgePayload(
    validPayload({ transformer: { serialNumber: 'SN-1', position: ['1.48', '103.76'] } })
  );
  const bad = parseBridgePayload(
    validPayload({ transformer: { serialNumber: 'SN-1', position: [999, 103.76] } })
  );

  assert.deepEqual(good.transformer.position, [1.48, 103.76]);
  assert.equal(bad.transformer.position, undefined);
});

test('ignores junk input', () => {
  assert.equal(parseBridgePayload(null), null);
  assert.equal(parseBridgePayload('string'), null);
  assert.equal(parseBridgePayload({}), null);
});
