'use strict';

// kv-memory.js — in-memory KV adapter for LOCAL DEV ONLY.
//
// It is explicitly labeled NON-production-durable (`durable === false`). Data is
// lost on process restart and is not shared across instances. Never treat this
// as a durable store. It exists so the app runs locally without a KV backend.

function createMemoryKv() {
  const map = new Map(); // key -> { value, expiresAt|null }

  function now() { return Date.now(); }

  function sweep() {
    const t = now();
    for (const [k, v] of map.entries()) {
      if (v.expiresAt != null && v.expiresAt <= t) map.delete(k);
    }
  }

  function alive(rec) {
    return rec && (rec.expiresAt == null || rec.expiresAt > now());
  }

  return {
    backend: 'memory',
    durable: false, // <-- NEVER production-durable
    async set(key, value, { ttlSec } = {}) {
      const expiresAt = ttlSec && ttlSec > 0 ? now() + ttlSec * 1000 : null;
      map.set(key, { value, expiresAt });
      return true;
    },
    async get(key) {
      const rec = map.get(key);
      if (!alive(rec)) { map.delete(key); return null; }
      return rec.value;
    },
    async delete(key) {
      return map.delete(key);
    },
    async incr(key, { ttlSec } = {}) {
      const rec = map.get(key);
      let n;
      if (!alive(rec)) {
        n = 1;
        map.set(key, { value: 1, expiresAt: ttlSec && ttlSec > 0 ? now() + ttlSec * 1000 : null });
      } else {
        n = Number(rec.value || 0) + 1;
        rec.value = n;
      }
      return n;
    },
    async ttl(key) {
      const rec = map.get(key);
      if (!alive(rec)) return -2; // missing
      if (rec.expiresAt == null) return -1; // no expiry
      return Math.max(0, Math.round((rec.expiresAt - now()) / 1000));
    },
    _sweep: sweep,
  };
}

module.exports = { createMemoryKv };
