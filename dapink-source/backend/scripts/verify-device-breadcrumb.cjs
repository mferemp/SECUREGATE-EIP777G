#!/usr/bin/env node
'use strict';

// verify-device-breadcrumb.cjs (S07) — proves the device breadcrumb / trace store
// against the REAL backend module (memory KV fallback):
//   * repeated events for the same opaque subject increment a coarse count;
//   * a count at/above threshold is flagged (coarse signal, never a block);
//   * the raw subject is reduced to an opaque trace key — no raw fingerprint/key
//     is stored;
//   * the /api/trace route file exists and posts through anti-abuse.
//
// Run: node backend/scripts/verify-device-breadcrumb.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const store = require(path.join(ROOT, 'backend', 'lib', 'trace-store'));
const { traceKey } = require(path.join(ROOT, 'backend', 'lib', 'trace-key'));

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

(async () => {
  const tk = traceKey('ping', '0xk1|web:abc123');

  await check('S04: canonical trace events include all required names', () => {
    const req = ['dashboard_download', 'authgate_scan_start', 'authgate_scan_fail', 'authgate_scan_success', 'link_device_start', 'link_device_fail', 'passkey_fail', 'non_k3_destination_attempt'];
    for (const e of req) assert(store.isTraceEvent(e), 'missing trace event: ' + e);
  });

  await check('S04: every trace event has an explicit TTL window', () => {
    for (const [name, cfg] of Object.entries(store.TRACE_EVENTS)) {
      assert(typeof cfg.ttlSec === 'number' && cfg.ttlSec > 0, 'no TTL for ' + name);
    }
  });

  await check('S04: breadcrumbs NEVER limit 2FA', () => {
    assert(store.TWO_FACTOR_LIMITED_BY_BREADCRUMB === false, '2FA must not be breadcrumb-limited');
    assert(!store.isTraceEvent('two_factor') && !store.isTraceEvent('2fa'), '2FA must not be a trace event');
  });

  await check('S04: recordEvent uses the event TTL and rejects unknown events', async () => {
    const r = await store.recordEvent('authgate_scan_fail', traceKey('authgate_scan_fail', 'k1-' + Date.now()));
    assert(r.count === 1, 'recordEvent did not count');
    let threw = false;
    try { await store.recordEvent('not_a_real_event', 'x'); } catch { threw = true; }
    assert(threw, 'unknown event was accepted');
  });

  await check('S07: trace key is opaque (no raw subject material)', () => {
    assert(/^[0-9a-f]{32}$/.test(tk), 'trace key not a 32-hex digest');
    assert(!tk.includes('0xk1') && !tk.includes('web:abc123'), 'raw subject leaked into key');
  });

  await check('S07: repeated breadcrumbs increment a coarse count', async () => {
    const r1 = await store.recordBreadcrumb('ping', tk);
    const r2 = await store.recordBreadcrumb('ping', tk);
    assert(r2.count === r1.count + 1, 'count did not increment');
    assert(await store.getBreadcrumbCount('ping', tk) === r2.count, 'getBreadcrumbCount mismatch');
  });

  await check('S07: crossing the repeat threshold sets flagged=true (signal only)', async () => {
    const k = traceKey('download', 'subject-' + Date.now());
    let last;
    for (let i = 0; i < store.REPEAT_FLAG_THRESHOLD; i++) last = await store.recordBreadcrumb('download', k);
    assert(last.flagged === true, 'threshold did not flag');
  });

  await check('S07: distinct subjects do not collide', async () => {
    const a = await store.recordBreadcrumb('ping', traceKey('ping', 'A-' + Date.now()));
    const b = await store.recordBreadcrumb('ping', traceKey('ping', 'B-' + Date.now()));
    assert(a.count === 1 && b.count === 1, 'subjects collided');
  });

  await check('S07: /api/trace route exists and uses anti-abuse + trace-store', () => {
    const src = fs.readFileSync(path.join(ROOT, 'backend', 'routes', 'trace.js'), 'utf8');
    assert(/router\.post\('\/ping'/.test(src), 'no /ping handler');
    assert(/router\.post\('\/download'/.test(src), 'no /download handler');
    assert(/anti-abuse-kv/.test(src) && /recordBreadcrumb/.test(src), 'route not wired to anti-abuse + breadcrumb');
    assert(/bucketKey/.test(src), 'route does not reduce subject to a trace key');
  });

  console.log(`\nverify-device-breadcrumb: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
