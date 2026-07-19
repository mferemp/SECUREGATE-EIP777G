#!/usr/bin/env node
'use strict';

// verify-2fa-no-limits.cjs (S10) — proves proactive 2FA against the real TS module:
//   * 2FA has NO recovery limit and NO attempt cooldown.
//   * 2FA NEVER asks for a private key.
//   * 2FA NEVER gates/unlocks intent execution.
//   * 2FA is proactive + honestly "not active yet" (no fake success).
//   * App.tsx renders the honest status via twoFactorStatus().
//
// Run: scripts/with-node24.sh node scripts/verify-2fa-no-limits.cjs

const path = require('path');
const fs = require('fs');
const FRONTEND = path.resolve(__dirname, '..', 'frontend');
const TS = path.join(FRONTEND, 'src', 'lib', 'twoFactorProactive.ts');
const APP = path.join(FRONTEND, 'src', 'App.tsx');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) { console.log('BLOCKER: requires Node 24 (got v' + process.versions.node + ')'); process.exit(5); }

const appSrc = fs.readFileSync(APP, 'utf8');

(async () => {
  const m = await import(TS);
  const s = m.twoFactorStatus();

  check('S10: 2FA reports NO recovery limit', () => {
    assert(s.hasRecoveryLimit === false, 'hasRecoveryLimit not false');
    assert(m.twoFactorHasNoLimits(s) === true, 'guard failed');
  });
  check('S10: 2FA NEVER requires a private key', () => {
    assert(s.requiresPrivateKey === false, 'requiresPrivateKey not false');
    assert(m.twoFactorNeverTakesPrivateKey(s) === true, 'guard failed');
  });
  check('S10: 2FA NEVER gates/unlocks execution', () => {
    assert(s.gatesExecution === false, 'gatesExecution not false');
    assert(m.twoFactorNeverGatesExecution(s) === true, 'guard failed');
  });
  check('S10: 2FA is proactive + not active yet (honest, no fake success)', () => {
    assert(s.proactive === true, 'not marked proactive');
    assert(s.active === false, 'must be not-active-yet');
  });
  check('S10: App.tsx renders honest 2FA status via twoFactorStatus()', () => {
    assert(/twoFactorStatus\(\)/.test(appSrc), 'App does not call twoFactorStatus');
    assert(/from '\.\/lib\/twoFactorProactive'/.test(appSrc), 'App does not import twoFactorProactive');
  });

  console.log(`\nverify-2fa-no-limits: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
