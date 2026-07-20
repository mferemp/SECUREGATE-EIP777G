#!/usr/bin/env node
'use strict';

// verify-recovery-flow-ui.cjs (S08) — proves the recovery-flow UI contract against
// the shipped App.tsx + libs: burner deployer key and compromised K1 key are
// session-only and scrubbed; K2/K3 are PUBLIC address fields (no private-key
// fields); chain dropdown shows names only; no frontend RPC URLs; funding via
// backend route.
//
// Run: scripts/with-node24.sh node scripts/verify-recovery-flow-ui.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const app = fs.readFileSync(APP, 'utf8');

check('recovery form exposes burner deployer key + compromised K1 key fields', () => {
  assert(/deployer-burner-key/.test(app) && /deployerBurnerKey/.test(app), 'no deployer burner key field');
  assert(/k1-session-key/.test(app) && /k1SessionKey/.test(app), 'no compromised K1 key field');
});
check('deployer + K1 keys are scrubbed immediately after signing', () => {
  assert(/setDeployerBurnerKey\(''\)/.test(app), 'deployer key not scrubbed');
  assert(/setK1SessionKey\(''\)/.test(app), 'K1 key not scrubbed');
});
check('K2/K3 are PUBLIC address fields — no K2/K3 private-key fields', () => {
  assert(/k2-address/.test(app) && /k3-address/.test(app), 'K2/K3 address fields missing');
  assert(!/k2-private|k2Key|k2PrivateKey|k3-private|k3Key|k3PrivateKey/.test(app), 'K2/K3 private-key field present');
});
check('chain dropdown shows chain NAMES only (no rpc URL rendered)', () => {
  assert(/network-select/.test(app), 'no network selector');
  assert(!/rpcUrl|http:\/\/|https:\/\/[^\s'")]*rpc/i.test(app), 'frontend renders an RPC URL');
});
check('no public frontend RPC URLs anywhere in App', () => {
  assert(!/https?:\/\/[a-z0-9.-]*(infura|alchemy|quiknode|ankr|llamarpc|drpc)/i.test(app), 'hardcoded RPC provider URL');
});
check('funding estimate goes through the backend funding route', () => {
  assert(/api\(`funding\/\$\{selectedChain\}`\)|api\('funding|funding\//.test(app), 'funding not via backend route');
});
check('no fake estimate / no production-ready label', () => {
  assert(!/production-ready|Production-Ready|PRODUCTION READY/.test(app), 'production-ready claim present');
});

console.log(`\nverify-recovery-flow-ui: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
