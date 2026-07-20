#!/usr/bin/env node
'use strict';

// verify-authgate-passkey.cjs (S05) — proves the K1-bound passkey lane end to end:
//   * PASSKEY input sits BELOW LINK DEVICE with an ENTER button;
//   * a passkey is K1-bound (not per-chain) — one passkey unlocks the human route
//     for that K1 on every chain;
//   * a mismatched passkey fails closed;
//   * the passkey lane stays usable even when SCAN/LINK are disabled (devicesLocked);
//   * the backend store keeps ONLY a salted digest (never the raw passkey);
//   * a verified passkey is a human-route signal only — it never authorizes an intent.
//
// Loads the REAL backend passkey-store under Node 24 + statically checks App.tsx.
// Run: scripts/with-node24.sh node scripts/verify-authgate-passkey.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');
const STORE = path.join(ROOT, 'backend', 'lib', 'passkey-store.js');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

const app = fs.readFileSync(APP, 'utf8');
const store = require(STORE);

(async () => {
  await check('PASSKEY input + ENTER button render below LINK DEVICE', () => {
    const link = app.indexOf('id="link-device"');
    const input = app.indexOf('id="passkey-input"');
    const enter = app.indexOf('id="passkey-enter"');
    assert(link !== -1, 'no LINK DEVICE control');
    assert(input !== -1 && input > link, 'passkey input is not below LINK DEVICE');
    assert(enter !== -1 && enter > input, 'no ENTER button after passkey input');
    assert(/>ENTER</.test(app), 'ENTER label missing');
  });

  await check('passkey lane stays enabled while SCAN/LINK are darkened (devicesLocked)', () => {
    // SCAN + LINK are gated by devicesLocked...
    assert(/id="scan-authenticator"[^>]*disabled=\{devicesLocked\}/s.test(app), 'SCAN not gated by devicesLocked');
    assert(/id="link-device"[^>]*disabled=\{devicesLocked\}/s.test(app), 'LINK not gated by devicesLocked');
    // ...but the passkey ENTER button is NOT disabled by devicesLocked.
    const enterTag = app.slice(app.indexOf('id="passkey-enter"'), app.indexOf('id="passkey-enter"') + 120);
    assert(!/disabled=\{devicesLocked\}/.test(enterTag), 'passkey ENTER wrongly gated by devicesLocked');
  });

  await check('register stores ONLY a salted digest (raw passkey never persisted)', async () => {
    const k1 = '0x' + '1a'.repeat(20);
    const raw = 'correct-horse-battery';
    const r = await store.register(k1, raw);
    assert(r.registered === true, 'register did not succeed');
    const stored = await store._kv.get(store._normK1(k1));
    assert(typeof stored === 'string' && /^[0-9a-f]{64}$/.test(stored), 'stored value is not a 64-hex digest');
    assert(!stored.includes(raw), 'raw passkey leaked into store');
  });

  await check('correct passkey verifies; mismatch fails closed', async () => {
    const k1 = '0x' + '2b'.repeat(20);
    await store.register(k1, 'right-secret');
    const ok = await store.verify(k1, 'right-secret');
    assert(ok.verified === true, 'correct passkey did not verify');
    const bad = await store.verify(k1, 'wrong-secret');
    assert(bad.verified === false, 'mismatch did not fail closed');
  });

  await check('passkey is K1-bound, not per-chain (digest keyed on K1 only)', async () => {
    const src = fs.readFileSync(STORE, 'utf8');
    assert(/digest\(k1n, rawPasskey\)/.test(src), 'digest is not keyed on K1');
    assert(!/chain|slug|network/i.test(src.replace(/\/\/.*$/gm, '')), 'store code references a chain — passkey may be per-chain');
    // same passkey+K1 verifies regardless of any chain context (no chain arg exists).
    const k1 = '0x' + '3c'.repeat(20);
    await store.register(k1, 'one-key-all-chains');
    assert((await store.verify(k1, 'one-key-all-chains')).verified === true, 'K1-bound passkey did not verify uniformly');
  });

  await check('client wrapper treats a verified passkey as human-route signal ONLY', () => {
    assert(/human-route access signal only|never authorizes an intent/.test(fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'lib', 'passkeyAccess.ts'), 'utf8')), 'passkey wrapper does not document human-route-only');
    assert(/setHumanRoute\(/.test(app), 'verified passkey does not set the human route');
    // Line-scoped: no single statement may pass a passkey into intent authorize/execute.
    for (const ln of app.split('\n')) {
      if (/passkey/i.test(ln)) {
        assert(!/\b(authorizeIntent|executeIntent|handleExecuteIntent)\s*\(/.test(ln),
          'passkey wired into intent authorization/execution: ' + ln.trim());
      }
    }
  });

  console.log(`\nverify-authgate-passkey: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
