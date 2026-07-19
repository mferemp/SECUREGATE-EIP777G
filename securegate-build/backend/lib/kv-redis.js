'use strict';

// kv-redis.js — durable KV adapter backed by @vercel/kv (Upstash Redis REST).
//
// This adapter is used ONLY when:
//   * the `@vercel/kv` dependency is installed, AND
//   * the KV_REST_API_URL + KV_REST_API_TOKEN env vars are configured.
// Otherwise createRedisKv() returns null and the caller falls back to memory.
//
// It never logs secrets (the token/URL are read from env and never printed).

function haveDurableEnv() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function createRedisKv() {
  if (!haveDurableEnv()) return null;
  let kv;
  try {
    // eslint-disable-next-line global-require
    const mod = require('@vercel/kv');
    kv = mod && mod.kv;
    if (!kv || typeof kv.set !== 'function') return null;
  } catch (_) {
    return null; // dependency not installed
  }

  return {
    backend: 'redis',
    durable: true,
    async set(key, value, { ttlSec } = {}) {
      if (ttlSec && ttlSec > 0) await kv.set(key, value, { ex: ttlSec });
      else await kv.set(key, value);
      return true;
    },
    async get(key) {
      const v = await kv.get(key);
      return v == null ? null : v;
    },
    async delete(key) {
      const n = await kv.del(key);
      return n > 0;
    },
    async incr(key, { ttlSec } = {}) {
      const n = await kv.incr(key);
      if (n === 1 && ttlSec && ttlSec > 0) await kv.expire(key, ttlSec);
      return n;
    },
    async ttl(key) {
      return kv.ttl(key);
    },
  };
}

module.exports = { createRedisKv, haveDurableEnv };
