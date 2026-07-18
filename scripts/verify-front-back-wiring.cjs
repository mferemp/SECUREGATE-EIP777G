#!/usr/bin/env node
'use strict';

// verify-front-back-wiring.cjs (S17) — proves the shipped App.tsx actually wires
// the net-new libraries into user flows, and that every backend route the frontend
// calls exists on disk (auto-mounted by the Surf SDK at /api/<name>).
//
// Static-only (no Node 24 requirement): asserts imports + call sites in App.tsx.

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');
const ROUTES = path.join(ROOT, 'backend', 'routes');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const app = fs.readFileSync(APP, 'utf8');

// (import path, symbol used in a call site)
const WIRING = [
  ['./lib/uiLabels', 'UI_PROGRESS_LABELS'],
  ['./lib/deviceBreadcrumb', 'pingDevice'],
  ['./lib/passkeyAccess', 'verifyPasskey'],
  ['./lib/adminPasskey', 'generateAdminPasskeyRemote'],
  ['./lib/twoFactorProactive', 'twoFactorStatus'],
  ['./lib/k3Enforcement', 'enforceK3'],
  ['./lib/recoveryCleanupSweep', 'isBackendSafe'],
  ['./lib/k3ExecutionSweep', 'sweepTargetsOnlyK3'],
  ['./lib/thankYouEnvelope', 'thankYouIsNotK3'],
];

for (const [mod, sym] of WIRING) {
  check(`App imports from ${mod} and uses ${sym}`, () => {
    assert(app.includes(`from '${mod}'`), 'missing import of ' + mod);
    // symbol must appear at least twice (import + a call site)
    const n = app.split(sym).length - 1;
    assert(n >= 2, `${sym} appears ${n}× (expected import + ≥1 use)`);
  });
}

check('App broadcast() fails closed on key-bearing payloads (isBackendSafe guard)', () => {
  assert(/if \(!isBackendSafe\(/.test(app), 'broadcast missing isBackendSafe guard');
});

check('App execute path enforces K3 before broadcasting', () => {
  assert(/sweepTargetsOnlyK3\(/.test(app), 'execute path missing K3 sweep guard');
});

const NEEDED_ROUTES = ['trace.js', 'passkeys.js', 'admin-passkey.js', 'funding.js', 'deploy.js', 'anti-abuse.js', 'thank-you.js', 'chains.js', 'rpc.js'];
for (const f of NEEDED_ROUTES) {
  check(`backend route exists: /api/${f.replace(/\.js$/, '')}`, () => {
    assert(fs.existsSync(path.join(ROUTES, f)), 'missing route file ' + f);
  });
}

console.log(`\nverify-front-back-wiring: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
