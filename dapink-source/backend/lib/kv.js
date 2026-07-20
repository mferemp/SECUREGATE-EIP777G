'use strict';

// kv.js — durable-first KV facade with namespaced keys and an honest durability
// signal. It selects the durable Redis/Upstash adapter when configured, else it
// falls back to the in-memory adapter which is CLEARLY marked non-durable.
//
// API (all async): set(key,value,{ttlSec}), get(key), delete(key),
//   incr(key,{ttlSec}), ttl(key). Keys are namespaced as `sg:<ns>:<key>`.
//
// Rules:
//   * Never silently pretend memory is production-durable — `isDurable()` and
//     `describe()` report the true backend.
//   * Never log secrets. The KV token/URL are read from env only.

const { createMemoryKv } = require('./kv-memory');
const { createRedisKv } = require('./kv-redis');

let backing = null;
function backend() {
  if (backing) return backing;
  backing = createRedisKv() || createMemoryKv();
  return backing;
}

function nsKey(namespace, key) {
  if (typeof namespace !== 'string' || !namespace) throw new Error('namespace required');
  if (typeof key !== 'string' || !key) throw new Error('key required');
  return `sg:${namespace}:${key}`;
}

function createKv(namespace) {
  const b = backend();
  return {
    namespace,
    backend: b.backend,
    durable: b.durable === true,
    async set(key, value, opts) { return b.set(nsKey(namespace, key), value, opts || {}); },
    async get(key) { return b.get(nsKey(namespace, key)); },
    async delete(key) { return b.delete(nsKey(namespace, key)); },
    async incr(key, opts) { return b.incr(nsKey(namespace, key), opts || {}); },
    async ttl(key) { return b.ttl(nsKey(namespace, key)); },
  };
}

function isDurable() { return backend().durable === true; }

function describe() {
  const b = backend();
  return {
    backend: b.backend,
    durable: b.durable === true,
    note: b.durable === true
      ? 'durable KV backend configured'
      : 'in-memory fallback — NOT production durable (data lost on restart)',
  };
}

// For tests: force a fresh memory backing (isolated from any global state).
function _resetForTests(useMemory = true) {
  backing = useMemory ? createMemoryKv() : (createRedisKv() || createMemoryKv());
  return backing;
}

module.exports = { createKv, isDurable, describe, nsKey, _resetForTests };
