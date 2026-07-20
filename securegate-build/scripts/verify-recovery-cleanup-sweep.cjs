#!/usr/bin/env node
'use strict';

// verify-recovery-cleanup-sweep.cjs (S13) — proves session-only secret handling:
// the burner deployer key and compromised K1 key are held in a scratch record,
// scrubbed after use, and can NEVER leak into a backend payload. Loads the REAL
// frontend module under Node 24 type-stripping.
//
// Run: scripts/with-node24.sh node scripts/verify-recovery-cleanup-sweep.cjs

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'frontend', 'src', 'lib', 'recoveryCleanupSweep.ts');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

(async () => {
  const m = await import('file://' + MOD);

  await check('freshScratch() starts with both secrets blank', () => {
    const s = m.freshScratch();
    assert(s.compromisedK1Key === '' && s.burnerDeployerKey === '', 'scratch not blank');
  });
  await check('scrub() wipes both secrets in place', () => {
    const s = m.freshScratch();
    s.compromisedK1Key = '0xdead';
    s.burnerDeployerKey = '0xbeef';
    m.scrub(s);
    assert(s.compromisedK1Key === '' && s.burnerDeployerKey === '', 'secrets not scrubbed');
  });
  await check('FORBIDDEN_BACKEND_KEYS covers every session secret name', () => {
    for (const k of ['privateKey', 'k1Key', 'k1SessionKey', 'compromisedK1Key', 'k2Key', 'k3Key', 'deployerKey', 'burnerDeployerKey', 'mnemonic', 'seed', 'sessionKey']) {
      assert(m.FORBIDDEN_BACKEND_KEYS.includes(k), 'missing forbidden key: ' + k);
    }
  });
  await check('isBackendSafe rejects any key-shaped field', () => {
    assert(m.isBackendSafe({ signedTx: '0xabc' }) === true, 'signedTx-only should be safe');
    assert(m.isBackendSafe({ privateKey: 'x' }) === false, 'privateKey slipped through');
    assert(m.isBackendSafe({ k1SessionKey: 'x' }) === false, 'k1SessionKey slipped through');
    assert(m.isBackendSafe({ deployerKey: 'x' }) === false, 'deployerKey slipped through');
    assert(m.isBackendSafe({ some_mnemonic_thing: 'x' }) === false, 'mnemonic-shaped name slipped through');
  });
  await check('backendDeployBody yields signedTx ONLY', () => {
    const b = m.backendDeployBody('0xsigned');
    assert(Object.keys(b).length === 1 && b.signedTx === '0xsigned', 'body is not signedTx-only');
    assert(m.isBackendSafe(b) === true, 'produced body is not backend-safe');
  });

  console.log(`\nverify-recovery-cleanup-sweep: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
