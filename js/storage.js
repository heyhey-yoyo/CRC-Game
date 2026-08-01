(function initStorage(scope) {
  'use strict';

  const DB_NAME = 'crc-immune-frontier';
  const DB_VERSION = 2;
  const STORE = 'saves';
  const FALLBACK_KEY = 'crc-immune-frontier-v1-fallback';
  const SAVE_SCHEMA = 2;
  const memoryStore = new Map();

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function checksum(value) {
    const text = stableStringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function normalizeSave(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('存档格式无效。');
    const payload = raw.payload || raw;
    const schema = Number(raw.schemaVersion || payload.schemaVersion || 1);
    const migrated = schema === 1 ? { ...payload, schemaVersion: SAVE_SCHEMA, ui: payload.ui || {} } : { ...payload };
    migrated.schemaVersion = SAVE_SCHEMA;
    if (!migrated.appVersion) migrated.appVersion = '1.0.0';
    if (!migrated.caseId) migrated.caseId = 'case-b2m-escape';
    if (!migrated.updatedAt) migrated.updatedAt = new Date().toISOString();
    return migrated;
  }

  function envelope(payload) {
    const normalized = normalizeSave(payload);
    return {
      schemaVersion: SAVE_SCHEMA,
      createdAt: normalized.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checksum: checksum(normalized),
      payload: normalized
    };
  }

  function verifyEnvelope(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('存档为空或损坏。');
    const payload = normalizeSave(raw.payload || raw);
    if (raw.checksum && raw.checksum !== checksum(payload)) throw new Error('存档校验失败，文件可能不完整。');
    return payload;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in scope)) return reject(new Error('IndexedDB unavailable.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    });
  }

  async function save(slot, payload) {
    const record = { slot, ...envelope(payload) };
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return { backend: 'indexedDB', record };
    } catch (error) {
      try {
        localStorage.setItem(`${FALLBACK_KEY}:${slot}`, JSON.stringify(record));
        return { backend: 'localStorage', record, warning: error.message };
      } catch (storageError) {
        memoryStore.set(slot, record);
        return { backend: 'memory', record, warning: `${error.message}; ${storageError.message}` };
      }
    }
  }

  async function load(slot) {
    try {
      const db = await openDb();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(slot);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (record) return { backend: 'indexedDB', payload: verifyEnvelope(record), record };
    } catch {}
    try {
      const raw = localStorage.getItem(`${FALLBACK_KEY}:${slot}`);
      if (raw) {
        const record = JSON.parse(raw);
        return { backend: 'localStorage', payload: verifyEnvelope(record), record };
      }
    } catch {}
    const memoryRecord = memoryStore.get(slot);
    if (!memoryRecord) return null;
    return { backend: 'memory', payload: verifyEnvelope(memoryRecord), record: memoryRecord };
  }

  async function list() {
    const records = [];
    try {
      const db = await openDb();
      const items = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      db.close();
      records.push(...items);
    } catch {}
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(`${FALLBACK_KEY}:`)) {
          try {
            const record = JSON.parse(localStorage.getItem(key));
            if (!records.some((item) => item.slot === record.slot)) records.push(record);
          } catch {}
        }
      }
    } catch {}
    for (const record of memoryStore.values()) {
      if (!records.some((item) => item.slot === record.slot)) records.push(record);
    }
    return records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function remove(slot) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(slot);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {}
    try { localStorage.removeItem(`${FALLBACK_KEY}:${slot}`); } catch {}
    memoryStore.delete(slot);
  }

  function exportText(payload) {
    return JSON.stringify(envelope(payload), null, 2);
  }

  function importText(text) {
    return verifyEnvelope(JSON.parse(text));
  }

  scope.CRC_STORAGE = Object.freeze({ SAVE_SCHEMA, checksum, normalizeSave, verifyEnvelope, save, load, list, remove, exportText, importText });
  if (typeof module !== 'undefined' && module.exports) module.exports = scope.CRC_STORAGE;
})(typeof window !== 'undefined' ? window : globalThis);
