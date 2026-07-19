#!/usr/bin/env node
'use strict';

// verify-admin-passkey.cjs (S06) — proves the admin black-circle passkey route +
// client wrapper: admin key + K1 mints a K1-BOUND passkey (not per-chain); honest
// "disabled" when ADMIN_KEY unset; admin key constant-time compared, never stored;
// NO admin tabs / relay control / operator console / revoke UI / veil phrase.
//
// Run: scripts/with-node24.sh node scripts/verify-admin-passkey.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const ROUTE = path.join(ROOT, 'backend', 'routes', 'admin-passkey.js');
const CLIENT = path.join(ROOT, 'frontend', 'src', 'lib', 'adminPasskey.ts');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const route = fs.readFileSync(ROUTE, 'utf8');
const client = fs.readFileSync(CLIENT, 'utf8');
const app = fs.readFileSync(APP, 'utf8');

check('route mints a K1-BOUND passkey (not per-chain)', () => {
  assert(/boundTo: 'K1'/.test(route), 'not boundTo K1');
  assert(/perChain: false/.test(route), 'not perChain:false');
});
check('route honestly reports disabled when ADMIN_KEY is unset (no fake success)', () => {
  assert(/process\.env\.ADMIN_KEY/.test(route), 'does not read ADMIN_KEY');
  assert(/disabled: true[\s\S]*?admin key not configured/.test(route) || /admin key not configured/.test(route), 'no honest disabled path');
});
check('admin key constant-time compared and never stored/echoed', () => {
  assert(/timingSafeEqual/.test(route), 'no constant-time compare');
  assert(!/kv\.set\([^)]*adminKey/.test(route), 'admin key persisted');
});
check('minted passkey registered to the K1-bound passkey store', () => {
  assert(/store\.register/.test(route), 'minted passkey not registered');
});
check('client wrapper posts once and reports disabled honestly', () => {
  assert(/admin-passkey\/generate/.test(client), 'client does not call the route');
  assert(/disabled/.test(client), 'client drops the disabled signal');
});
check('compact black-circle panel only — NO admin tabs / relay / operator console / revoke / veil', () => {
  assert(!/operator-proof-input|submitRevokeBundle|getOperatorProof|OPERATOR_VEIL_PHRASE|X-Operator-Proof/.test(app), 'operator surface present');
  assert(!/\bRevoke\b/.test(app), 'revoke UI present');
  assert(!/relay control|operator console/i.test(app), 'relay/operator console present');
});
check('App wires the admin mint via generateAdminPasskeyRemote', () => {
  assert(/generateAdminPasskeyRemote\(/.test(app), 'App does not call the admin mint');
});

console.log(`\nverify-admin-passkey: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
