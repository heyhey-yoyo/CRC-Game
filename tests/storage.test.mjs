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
  assert.equal(migrated.appVersion, '0.7.0');
  assert.deepEqual(migrated.ui, {});
});

test('tampered envelope fails checksum verification', () => {
  const payload = { schemaVersion: 2, appVersion: '0.7.0', caseId: 'case-b2m-escape', value: 1 };
  const envelope = JSON.parse(storage.exportText(payload));
  envelope.payload.value = 2;
  assert.throws(() => storage.verifyEnvelope(envelope), /校验失败/);
});

test('storage falls back to in-memory session when browser storage is unavailable', async () => {
  const result = await storage.save('memory-test', { schemaVersion: 2, appVersion: '0.7.0', caseId: 'case-b2m-escape', value: 7 });
  assert.equal(result.backend, 'memory');
  const loaded = await storage.load('memory-test');
  assert.equal(loaded.backend, 'memory');
  assert.equal(loaded.payload.value, 7);
  assert.ok((await storage.list()).some((item) => item.slot === 'memory-test'));
  await storage.remove('memory-test');
  assert.equal(await storage.load('memory-test'), null);
});

test('unknown, malformed or conflicting schemas fail even with a valid checksum', () => {
  const envelope = JSON.parse(storage.exportText({ schemaVersion: 2, value: 7 }));
  for (const version of [0, 3, 999, '2', null]) {
    assert.throws(() => storage.verifyEnvelope({ ...envelope, schemaVersion: version }), /schema/);
    assert.throws(() => storage.normalizeSave({ schemaVersion: version }), /schema/);
  }
  assert.throws(() => storage.verifyEnvelope({ ...envelope, schemaVersion: 1 }), /不一致/);
  for (const payload of [null, [], 5, 'invalid']) assert.throws(() => storage.verifyEnvelope({ schemaVersion: 2, payload }), /格式/);
  assert.throws(() => storage.normalizeSave([]), /格式/);
  assert.equal(storage.importText(JSON.stringify(envelope)).value, 7);
  assert.equal(storage.importText('{"pathwayId":"pembro"}').schemaVersion, 2);
});

test('known legacy envelopes verify their original payload before migration', () => {
  const payload = { schemaVersion: 1, pathwayId: 'pembro' };
  const envelope = { schemaVersion: 1, payload, checksum: storage.checksum(payload) };
  const migrated = storage.verifyEnvelope(envelope);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.ui, {});
  assert.equal(payload.schemaVersion, 1);
  assert.throws(() => storage.verifyEnvelope({ ...envelope, payload: { ...payload, pathwayId: 'folfoxbev' } }), /校验失败/);
  for (const checksum of [undefined, null, '', false, 'invalid']) {
    assert.throws(() => storage.verifyEnvelope({ ...envelope, checksum }), /checksum/);
  }
  assert.equal(storage.verifyEnvelope(payload).schemaVersion, 2);
});
