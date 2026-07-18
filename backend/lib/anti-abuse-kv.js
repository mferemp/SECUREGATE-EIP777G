'use strict';

// Anti-abuse counters with a durable-first design.
//
// Uses @vercel/kv when available (production / preview). Falls back to an
// in-process memory store for local dev only. We store ONLY opaque trace keys
// and integer counts inside fixed time windows — never raw fingerprints, keys,
// seed phrases, raw markers, or raw K1 values.

// Per-action limits within a rolling window.
const LIMITS = {
  auth_gate_attempt:  { max: 3,   windowSec: 900 },
  link_device_attempt:{ max: 3,   windowSec: 900 },
  passkey_verify:     { max: 10,  windowSec: 900 },
  funding_check:      { max: 30,  windowSec: 300 },
  deploy_broadcast:   { max: 5,   windowSec: 900 },
  dashboard_download: { max: 20,  windowSec: 3600 },
  dashboard_ping:     { max: 120, windowSec: 300 },
  security_event:     { max: 60,  windowSec: 300 },
  thank_you_address:  { max: 30,  windowSec: 3600 },
};

// ---- durable backend (optional) ------------------------------------------
let kv = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('@vercel/kv');
  if (mod && mod.kv && typeof mod.kv.incr === 'function') kv = mod.kv;
} catch (_) {
  kv = null; // memory fallback below
}

// ---- memory fallback (local dev) -----------------------------------------
const mem = new Map(); // key -> { count, expiresAt }

function memIncr(key, windowSec) {
  const now = Date.now();
  const rec = mem.get(key);
  if (!rec || rec.expiresAt <= now) {
    const fresh = { count: 1, expiresAt: now + windowSec * 1000 };
    mem.set(key, fresh);
    return fresh.count;
  }
  rec.count += 1;
  return rec.count;
}

// Opportunistic sweep so the memory map can't grow unbounded.
function memSweep() {
  const now = Date.now();
  for (const [k, v] of mem.entries()) if (v.expiresAt <= now) mem.delete(k);
}

function isKnownAction(action) {
  return Object.prototype.hasOwnProperty.call(LIMITS, action);
}

/**
 * Record one event for (action, traceKey) and report whether the limit is hit.
 * @returns {Promise<{ allowed:boolean, count:number, max:number, action:string }>}
 */
async function record(action, tKey) {
  if (!isKnownAction(action)) {
    return { allowed: false, count: 0, max: 0, action, unknown: true };
  }
  const { max, windowSec } = LIMITS[action];
  const key = `sg:ab:${action}:${tKey}`;

  let count;
  if (kv) {
    count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSec);
  } else {
    memSweep();
    count = memIncr(key, windowSec);
  }
  return { allowed: count <= max, count, max, action };
}

module.exports = { record, LIMITS, isKnownAction, usingDurableStore: () => !!kv };
