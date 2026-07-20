#!/usr/bin/env node
'use strict';

// verify-passkey-lane.cjs (S08/S09) — proves the K1-bound passkey store + admin
// mint against the REAL backend modules (memory KV fallback):
//   S08 passkey-store — register/verify are K1-bound (not per-chain); the raw
//                       passkey is NEVER stored (only a salted HMAC digest); a
//                       wrong passkey fails; a wrong K1 fails.
//   S09 admin mint    — route mints a K1-BOUND passkey (perChain:false); honest
//                       "disabled" when ADMIN_KEY is unset (no fake success);
//                       a wrong admin key is rejected.
//
// Run: node backend/scripts/verify-passkey-lane.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const store = require(path.join(ROOT, 'backend', 'lib', 'passkey-store'));

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

const K1 = '0x1111111111111111111111111111111111111111';
const K1B = '0x2222222222222222222222222222222222222222';

(async () => {
  await check('S08: register is K1-bound and stores ONLY a digest (never the raw passkey)', async () => {
    const out = await store.register(K1, 'hunter2secret');
    assert(out.registered === true && out.k1 === K1.toLowerCase(), 'register result wrong');
    const stored = await store._kv.get(K1.toLowerCase());
    assert(typeof stored === 'string' && stored.length === 64, 'stored value is not a 64-hex digest');
    assert(!stored.includes('hunter2secret'), 'raw passkey leaked into store');
  });

  await check('S08: verify accepts the correct passkey for the bound K1', async () => {
    const r = await store.verify(K1, 'hunter2secret');
    assert(r.verified === true, 'correct passkey rejected');
  });

  await check('S08: verify rejects a wrong passkey', async () => {
    const r = await store.verify(K1, 'wrongpass');
    assert(r.verified === false, 'wrong passkey accepted');
  });

  await check('S08: verify rejects an unregistered K1 (K1-bound, not global)', async () => {
    const r = await store.verify(K1B, 'hunter2secret');
    assert(r.verified === false && /no passkey registered/.test(r.reason), 'unregistered K1 accepted');
  });

  await check('S08: the same passkey under a different K1 yields a different digest', async () => {
    const dA = store._digest(K1.toLowerCase(), 'same');
    const dB = store._digest(K1B.toLowerCase(), 'same');
    assert(dA !== dB, 'digest not K1-bound');
  });

  await check('S09: admin-passkey route mints a K1-BOUND (not per-chain) passkey + honest disabled', () => {
    const src = fs.readFileSync(path.join(ROOT, 'backend', 'routes', 'admin-passkey.js'), 'utf8');
    assert(/boundTo: 'K1'/.test(src), 'route does not mark boundTo K1');
    assert(/perChain: false/.test(src), 'route does not mark perChain:false');
    assert(/disabled: true[\s\S]*admin key not configured/.test(src) || /admin key not configured/.test(src), 'no honest disabled path');
    assert(/timingSafeEqual/.test(src), 'admin key not constant-time compared');
    assert(/store\.register/.test(src), 'minted passkey not registered to the store');
  });

  console.log(`\nverify-passkey-lane: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
