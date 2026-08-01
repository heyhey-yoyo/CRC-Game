import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const storage = require('../js/storage.js');

test('save checksum is stable across object key order', () => {
  assert.equal(storage.checksum({ a: 1, b: 2 }), storage.checksum({ b: 2, a: 1 }));
});

test('legacy save payload migrates to schema 2', () => {
  const migrated = storage.normalizeSave({ schemaVersion: 1, caseId: 'case-b2m-escape', pathwayId: 'pembro' });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.appVersion, '1.0.0');
  assert.deepEqual(migrated.ui, {});
});

test('tampered envelope fails checksum verification', () => {
  const payload = { schemaVersion: 2, appVersion: '1.0.0', caseId: 'case-b2m-escape', value: 1 };
  const envelope = JSON.parse(storage.exportText(payload));
  envelope.payload.value = 2;
  assert.throws(() => storage.verifyEnvelope(envelope), /校验失败/);
});

test('storage falls back to in-memory session when browser storage is unavailable', async () => {
  const result = await storage.save('memory-test', { schemaVersion: 2, appVersion: '1.0.0', caseId: 'case-b2m-escape', value: 7 });
  assert.equal(result.backend, 'memory');
  const loaded = await storage.load('memory-test');
  assert.equal(loaded.backend, 'memory');
  assert.equal(loaded.payload.value, 7);
  assert.ok((await storage.list()).some((item) => item.slot === 'memory-test'));
  await storage.remove('memory-test');
  assert.equal(await storage.load('memory-test'), null);
});
