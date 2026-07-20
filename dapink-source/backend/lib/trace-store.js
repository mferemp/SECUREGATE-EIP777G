'use strict';

// trace-store.js — device breadcrumb / ping store (S07).
//
// Purpose: when the same device repeats scans or downloads, we leave a coarse,
// privacy-preserving breadcrumb so anti-abuse can notice repetition WITHOUT ever
// storing a raw fingerprint, K1 value, private key, seed, or raw marker.
//
// Every subject is already reduced to an opaque trace key by trace-key.js before
// it reaches this module. We only keep an integer count + a coarse first-seen
// bucket under a namespaced, TTL'd KV key. Nothing here signs, routes, or holds
// key material.

const { createKv } = require('./kv');

const kv = createKv('trace');

// Breadcrumbs expire so the store self-heals; repetition within the window is the
// signal we care about (a device scanning/downloading over and over).
const DEFAULT_TTL_SEC = 24 * 3600;

// Canonical breadcrumb event vocabulary (S04). Each event has an explicit TTL
// window so the store self-heals; repetition within the window is the signal.
// NOTE: 2FA is deliberately ABSENT here — a breadcrumb NEVER limits 2FA.
const TRACE_EVENTS = {
  dashboard_download:         { ttlSec: 3600 },
  authgate_scan_start:        { ttlSec: 900 },
  authgate_scan_fail:         { ttlSec: 900 },
  authgate_scan_success:      { ttlSec: 900 },
  link_device_start:          { ttlSec: 900 },
  link_device_fail:           { ttlSec: 900 },
  passkey_fail:               { ttlSec: 900 },
  non_k3_destination_attempt: { ttlSec: 24 * 3600 },
};

// Explicit invariant: breadcrumbs cover recovery / Auth-Gate / download abuse only.
const TWO_FACTOR_LIMITED_BY_BREADCRUMB = false;

function isTraceEvent(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(TRACE_EVENTS, name);
}

// Record a named canonical event for an opaque trace key, using that event's TTL.
async function recordEvent(event, traceKey) {
  if (!isTraceEvent(event)) throw new Error('unknown trace event: ' + event);
  return recordBreadcrumb(event, traceKey, { ttlSec: TRACE_EVENTS[event].ttlSec });
}

// A repeated-event count at/above this threshold is "flagged" (coarse signal only;
// it never blocks recovery — anti-abuse cooldowns handle enforcement separately).
const REPEAT_FLAG_THRESHOLD = 5;

function eventKey(kind, traceKey) {
  return `${kind}:${traceKey}`;
}

// Record one breadcrumb for (kind, traceKey). Returns { count, flagged } where
// count is the number of times this opaque subject repeated `kind` in the window.
async function recordBreadcrumb(kind, traceKey, opts) {
  if (typeof kind !== 'string' || !kind) throw new Error('kind required');
  if (typeof traceKey !== 'string' || !traceKey) throw new Error('traceKey required');
  const ttlSec = (opts && opts.ttlSec) || DEFAULT_TTL_SEC;
  const key = eventKey(kind, traceKey);
  const count = await kv.incr(key, { ttlSec });
  return {
    kind,
    count: Number(count) || 0,
    flagged: (Number(count) || 0) >= REPEAT_FLAG_THRESHOLD,
    durable: kv.durable === true,
  };
}

async function getBreadcrumbCount(kind, traceKey) {
  const raw = await kv.get(eventKey(kind, traceKey));
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

module.exports = {
  recordBreadcrumb,
  recordEvent,
  getBreadcrumbCount,
  isTraceEvent,
  TRACE_EVENTS,
  TWO_FACTOR_LIMITED_BY_BREADCRUMB,
  REPEAT_FLAG_THRESHOLD,
  DEFAULT_TTL_SEC,
  _kv: kv,
};
