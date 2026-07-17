#!/usr/bin/env node
'use strict';

// verify-k3-execution-sweep.cjs (S16) — proves the final execution sweep resolves
// to K3 and ONLY K3, no matter what requested destination an intent carries. Loads
// the REAL frontend module under Node 24 type-stripping.
//
// Run: scripts/with-node24.sh node scripts/verify-k3-execution-sweep.cjs

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'frontend', 'src', 'lib', 'k3ExecutionSweep.ts');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

(async () => {
  const m = await import('file://' + MOD);
  const k3 = '0x' + 'ab'.repeat(20);
  const other = '0x' + 'cd'.repeat(20);

  await check('resolveSweepTarget targets K3 when no override is present', () => {
    const plan = m.resolveSweepTarget({ intentHash: '0x01', k3 });
    assert(plan.target === k3.toLowerCase(), 'target not K3');
    assert(plan.override === false, 'override falsely reported');
  });
  await check('resolveSweepTarget IGNORES a requested override, still targets K3', () => {
    const plan = m.resolveSweepTarget({ intentHash: '0x02', k3, requestedDestination: other });
    assert(plan.target === k3.toLowerCase(), 'override honored — target not K3');
    assert(plan.override === true, 'override attempt not captured');
  });
  await check('sweepTargetsOnlyK3 is true with an override attempt', () => {
    assert(m.sweepTargetsOnlyK3({ intentHash: '0x03', k3, requestedDestination: other }) === true, 'sweep not pinned to K3');
  });
  await check('sweepTargetsOnlyK3 is true with no override', () => {
    assert(m.sweepTargetsOnlyK3({ intentHash: '0x04', k3 }) === true, 'sweep not pinned to K3');
  });
  await check('no asset-movement primitive is exported by the sweep module', () => {
    for (const forbidden of ['transfer', 'send', 'broadcast', 'signTx', 'sweep']) {
      assert(typeof m[forbidden] !== 'function', 'exported asset-movement primitive: ' + forbidden);
    }
  });

  console.log(`\nverify-k3-execution-sweep: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
