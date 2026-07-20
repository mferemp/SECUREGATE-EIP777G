#!/usr/bin/env node
'use strict';

// verify-authgate-attempt-limits.cjs (S03) — proves the device-attempt limiter
// against the real shipped TS module: 3 failed device attempts darken SCAN+LINK
// for THAT K1; passkey + human routes stay open; recovery is NEVER capped; the
// counter is per-K1 (fresh-per-use); a success clears it.
//
// Run: scripts/with-node24.sh node scripts/verify-authgate-attempt-limits.cjs

const path = require('path');
const FRONTEND = path.resolve(__dirname, '..', 'frontend');
const TS = path.join(FRONTEND, 'src', 'lib', 'authGateAttempts.ts');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) { console.log('BLOCKER: requires Node 24 (got v' + process.versions.node + ')'); process.exit(5); }

const K1 = '0x1111111111111111111111111111111111111111';
const K1B = '0x2222222222222222222222222222222222222222';

(async () => {
  const A = await import(TS);

  check('MAX_DEVICE_ATTEMPTS is 3', () => { assert(A.MAX_DEVICE_ATTEMPTS === 3, 'cap not 3'); });

  check('3 failed device attempts darken SCAN+LINK for that K1', () => {
    let st = A.freshAttempts();
    st = A.recordFailure(st, K1); st = A.recordFailure(st, K1);
    assert(A.devicesLocked(st) === false, 'locked too early');
    st = A.recordFailure(st, K1);
    assert(A.devicesLocked(st) === true, 'not locked at 3');
  });

  check('passkey + human routes stay OPEN after lockout; recovery never capped', () => {
    let st = A.recordFailure(A.recordFailure(A.recordFailure(A.freshAttempts(), K1), K1), K1);
    assert(A.devicesLocked(st) === true, 'precondition');
    assert(A.passkeyLaneOpen(st) === true, 'passkey lane closed');
    assert(A.humanRouteOpen(st) === true, 'human route closed');
    assert(A.recoveryCapped(st) === false, 'recovery capped');
  });

  check('per-K1 counter: a different K1 resets; success clears', () => {
    let st = A.recordFailure(A.recordFailure(A.recordFailure(A.freshAttempts(), K1), K1), K1);
    st = A.recordFailure(st, K1B);
    assert(st.failures === 1 && st.k1 === K1B.toLowerCase(), 'new K1 did not reset');
    st = A.recordSuccess(st, K1B);
    assert(st.failures === 0, 'success did not clear');
  });

  console.log(`\nverify-authgate-attempt-limits: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
