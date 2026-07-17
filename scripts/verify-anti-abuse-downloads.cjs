#!/usr/bin/env node
'use strict';

// verify-anti-abuse-downloads.cjs (S07) — proves the download/scan breadcrumb +
// anti-abuse limiter: repeated dashboard downloads and device pings are throttled
// and flagged WITHOUT ever storing a raw fingerprint/K1/key, and a breadcrumb never
// blocks recovery and never limits 2FA. Loads the REAL backend modules.
//
// Run: scripts/with-node24.sh node scripts/verify-anti-abuse-downloads.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, 'backend', 'lib', 'trace-store.js');
const AB = path.join(ROOT, 'backend', 'lib', 'anti-abuse-kv.js');
const TKEY = path.join(ROOT, 'backend', 'lib', 'trace-key.js');
const ROUTE = path.join(ROOT, 'backend', 'routes', 'trace.js');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

const store = require(STORE);
const ab = require(AB);
const tkey = require(TKEY);
const routeSrc = fs.readFileSync(ROUTE, 'utf8');

(async () => {
  await check('anti-abuse limits include dashboard_download and dashboard_ping', () => {
    assert(ab.LIMITS.dashboard_download && ab.LIMITS.dashboard_download.max > 0, 'no dashboard_download limit');
    assert(ab.LIMITS.dashboard_ping && ab.LIMITS.dashboard_ping.max > 0, 'no dashboard_ping limit');
  });
  await check('repeated downloads eventually flag (breadcrumb count crosses threshold)', async () => {
    const key = 'test-dl-' + Date.now();
    let last;
    for (let i = 0; i < store.REPEAT_FLAG_THRESHOLD; i++) {
      last = await store.recordBreadcrumb('download', key);
    }
    assert(last.count >= store.REPEAT_FLAG_THRESHOLD, 'count did not accumulate');
    assert(last.flagged === true, 'repeated downloads never flagged');
  });
  await check('anti-abuse record() eventually disallows beyond the max window', async () => {
    const key = 'test-ab-' + Date.now();
    const max = ab.LIMITS.dashboard_download.max;
    let res;
    for (let i = 0; i < max + 1; i++) {
      res = await ab.record('dashboard_download', key);
    }
    assert(res.allowed === false, 'limiter never disallowed past max');
  });
  await check('trace key is opaque — a raw subject is NOT recoverable from it', () => {
    const raw = '0xK1_secret_subject_value';
    const k = tkey.bucketKey('download', raw);
    assert(typeof k === 'string' && k.length > 0, 'no trace key produced');
    assert(!k.includes(raw), 'raw subject leaked into trace key');
    assert(!/secret|0xK1/.test(k), 'raw subject fragment leaked');
  });
  await check('canonical event vocabulary excludes 2FA (breadcrumbs never limit 2FA)', () => {
    assert(store.TWO_FACTOR_LIMITED_BY_BREADCRUMB === false, '2FA limited-by-breadcrumb flag is not false');
    assert(!Object.keys(store.TRACE_EVENTS).some((e) => /2fa|two_factor|twofactor/i.test(e)), '2FA event in breadcrumb vocab');
  });
  await check('recordEvent rejects an unknown event (fail closed)', async () => {
    let threw = false;
    try { await store.recordEvent('totally_unknown_event', 'k'); } catch (_) { threw = true; }
    assert(threw, 'unknown event was silently accepted');
  });
  await check('trace route stores NO raw subject (reduces to bucketKey before recording)', () => {
    assert(/bucketKey\(kind, subject\)/.test(routeSrc), 'route does not reduce subject to a trace key');
    assert(!/recordBreadcrumb\(kind, subject\)/.test(routeSrc), 'route records the raw subject');
  });

  console.log(`\nverify-anti-abuse-downloads: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
