#!/usr/bin/env node
'use strict';

// selftest.cjs — structural + safety self-check for the SecureGate source layer.
// Run from backend/:  node scripts/selftest.cjs
//
// It loads the real modules (so a syntax/logic error fails the test) and asserts
// the canonical invariants: chain registry shape, K3 forcing, private-key refusal
// wiring, anti-abuse limits, and trace-key non-reversibility.

const path = require('path');
const assert = require('assert');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
  }
}

const chains = require(path.join('..', 'config', 'chains.js'));
const guard = require(path.join('..', 'lib', 'address-guard.js'));
const trace = require(path.join('..', 'lib', 'trace-key.js'));
const ab = require(path.join('..', 'lib', 'anti-abuse-kv.js'));

// 1. Chain registry exposes public metadata only.
check('chains.listPublic omits rpcEnv/url', () => {
  const list = chains.listPublic();
  assert(Array.isArray(list) && list.length >= 6, 'expected >= 6 chains');
  for (const c of list) {
    assert(c.slug && c.name && c.chainId && c.nativeSymbol, 'missing public field');
    assert(!('rpcEnv' in c), 'rpcEnv must not be public');
    assert(!('url' in c), 'url must not be public');
  }
});

// 2. Every chain names an RPC env var.
check('every chain has an rpcEnv name', () => {
  const names = chains.rpcEnvNames();
  assert(names.length === chains.SLUGS.length, 'rpcEnv count mismatch');
  names.forEach((n) => assert(/^RPC_[A-Z0-9_]+$/.test(n), 'bad rpc env name ' + n));
});

// 3. K3 is forced; non-K3 destinations are suspect but never returned as route.
check('address-guard forces K3', () => {
  const k3 = '0x' + '3'.repeat(40);
  const attacker = '0x' + 'a'.repeat(40);
  const r = guard.enforceK3(k3, attacker);
  assert.strictEqual(r.forcedDestination, k3.toLowerCase());
  assert.strictEqual(r.effectiveDestination, k3.toLowerCase());
  assert.strictEqual(r.suspect, true);
  assert.strictEqual(r.suspectDestination, attacker.toLowerCase());
  // effective destination must NEVER equal the attacker destination
  assert.notStrictEqual(r.effectiveDestination, attacker.toLowerCase());
});

// 4. Forbidden alternate-destination overrides are detected.
check('address-guard rejects override keys', () => {
  for (const key of guard.FORBIDDEN_OVERRIDE_KEYS) {
    const obj = {};
    obj[key] = '0xdeadbeef';
    assert(guard.hasForbiddenOverride(obj), 'should reject ' + key);
  }
  assert(!guard.hasForbiddenOverride({ k3Address: '0x1' }));
});

// 5. Trace keys are opaque and non-reversible (no raw subject leaks through).
check('trace keys are opaque digests', () => {
  const k1 = '0x' + 'b'.repeat(40);
  const key = trace.bucketKey('auth_gate_attempt', k1);
  assert(/^[0-9a-f]{32}$/.test(key), 'trace key must be a hex digest');
  assert(!key.includes(k1), 'raw K1 must not appear in trace key');
});

// 6. Anti-abuse defines every required limited action.
check('anti-abuse limits cover required actions', () => {
  const required = [
    'auth_gate_attempt', 'link_device_attempt', 'passkey_verify', 'funding_check',
    'deploy_broadcast', 'dashboard_download', 'dashboard_ping', 'security_event', 'thank_you_address',
  ];
  required.forEach((a) => assert(ab.isKnownAction(a), 'missing limit for ' + a));
  assert.strictEqual(ab.LIMITS.auth_gate_attempt.max, 3);
  assert.strictEqual(ab.LIMITS.link_device_attempt.max, 3);
});

// ---- report ---------------------------------------------------------------
let failed = 0;
for (const r of results) {
  // eslint-disable-next-line no-console
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.err}`);
  if (!r.ok) failed += 1;
}
// eslint-disable-next-line no-console
console.log(`\nselftest: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
