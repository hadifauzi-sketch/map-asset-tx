import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let getDocumentUploadErrorMessage;
let uploadStorageObjectWithRetry;
let viteServer;

before(async () => {
  viteServer = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { hmr: false, middlewareMode: true },
  });

  const storageUploadUtils = await viteServer.ssrLoadModule('/lib/storageUploadUtils.js');
  getDocumentUploadErrorMessage = storageUploadUtils.getDocumentUploadErrorMessage;
  uploadStorageObjectWithRetry = storageUploadUtils.uploadStorageObjectWithRetry;
});

after(async () => {
  await viteServer?.close();
});

test('retries a transient 520 upload against the same storage path', async () => {
  const uploadPaths = [];
  const waits = [];
  let attempt = 0;
  const storageBucket = {
    async exists() {
      return { data: false, error: null };
    },
    async upload(path) {
      uploadPaths.push(path);
      attempt += 1;

      if (attempt === 1) {
        return {
          data: null,
          error: { name: 'StorageApiError', status: 520, statusCode: '520' },
        };
      }

      return { data: { path }, error: null };
    },
  };

  const data = await uploadStorageObjectWithRetry(
    storageBucket,
    'transformer-id/report.pdf',
    { name: 'report.pdf' },
    { upsert: false },
    {
      retryDelays: [10],
      wait: async (delay) => waits.push(delay),
    }
  );

  assert.deepEqual(data, { path: 'transformer-id/report.pdf' });
  assert.deepEqual(uploadPaths, [
    'transformer-id/report.pdf',
    'transformer-id/report.pdf',
  ]);
  assert.deepEqual(waits, [10]);
});

test('accepts an ambiguous 520 response when the exact object already exists', async () => {
  let uploadCount = 0;
  const storageBucket = {
    async exists(path) {
      assert.equal(path, 'transformer-id/report.pdf');
      return { data: true, error: null };
    },
    async upload() {
      uploadCount += 1;
      return {
        data: null,
        error: { name: 'StorageApiError', status: 520, statusCode: '520' },
      };
    },
  };

  const data = await uploadStorageObjectWithRetry(
    storageBucket,
    'transformer-id/report.pdf',
    { name: 'report.pdf' },
    { upsert: false },
    { retryDelays: [0], wait: async () => {} }
  );

  assert.deepEqual(data, { path: 'transformer-id/report.pdf' });
  assert.equal(uploadCount, 1);
});

test('accepts an already-exists response after an ambiguous retry', async () => {
  let uploadCount = 0;
  const storageBucket = {
    async exists() {
      return { data: false, error: { status: 403 } };
    },
    async upload(path) {
      uploadCount += 1;

      if (uploadCount === 1) {
        return { data: null, error: { status: 520, statusCode: '520' } };
      }

      return {
        data: null,
        error: { status: 400, statusCode: 'KeyAlreadyExists', message: 'The resource already exists' },
      };
    },
  };

  const data = await uploadStorageObjectWithRetry(
    storageBucket,
    'transformer-id/report.pdf',
    { name: 'report.pdf' },
    { upsert: false },
    { retryDelays: [0], wait: async () => {} }
  );

  assert.deepEqual(data, { path: 'transformer-id/report.pdf' });
  assert.equal(uploadCount, 2);
});

test('does not retry a storage policy rejection', async () => {
  let uploadCount = 0;
  const accessError = {
    name: 'StorageApiError',
    message: 'Access denied',
    status: 403,
    statusCode: 'AccessDenied',
  };
  const storageBucket = {
    async upload() {
      uploadCount += 1;
      return { data: null, error: accessError };
    },
  };

  await assert.rejects(
    uploadStorageObjectWithRetry(
      storageBucket,
      'transformer-id/report.pdf',
      { name: 'report.pdf' },
      { upsert: false },
      { retryDelays: [0, 0], wait: async () => {} }
    ),
    accessError
  );
  assert.equal(uploadCount, 1);
  assert.match(getDocumentUploadErrorMessage(accessError), /access policy/i);
});

test('keeps the review open message after exhausted 520 retries', () => {
  assert.match(
    getDocumentUploadErrorMessage({ status: 520 }, { reviewOpen: true }),
    /reviewed results are still open/i
  );
});
