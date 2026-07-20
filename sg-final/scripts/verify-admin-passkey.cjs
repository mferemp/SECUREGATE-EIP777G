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
check('admin black-circle exists INSIDE the sidebar caution/warning block', () => {
  const circleIdx = app.indexOf('id="admin-black-circle"');
  const cautionIdx = app.indexOf('className="sg-side-caution"');
  const asideClose = app.indexOf('</aside>');
  assert(circleIdx !== -1, 'admin black-circle button missing');
  assert(cautionIdx !== -1, 'sidebar caution/warning block missing');
  assert(circleIdx > cautionIdx && circleIdx < asideClose, 'black-circle is not inside the caution block');
});
check('black-circle opens a compact panel with Admin key + K1 address + Generate + Copy', () => {
  const panelIdx = app.indexOf('id="admin-panel"');
  assert(panelIdx !== -1, 'admin compact panel missing');
  assert(/id="admin-key-gate"/.test(app), 'compact panel missing Admin key field');
  assert(/id="admin-k1-gate"/.test(app), 'compact panel missing K1 address field');
  assert(/id="admin-generate-gate"/.test(app), 'compact panel missing Generate passkey button');
  assert(/Admin key/.test(app), 'no "Admin key" label');
  assert(/id="admin-copy-gate"/.test(app), 'compact panel missing Copy button for generated passkey');
});

console.log(`\nverify-admin-passkey: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
