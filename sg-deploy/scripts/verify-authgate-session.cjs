#!/usr/bin/env node
'use strict';

// verify-authgate-session.cjs (S04/S05/S06) — proves the Auth-Gate model against
// the REAL shipped TS modules under Node 24:
//   S04 authGateSession  — K1 entered before any gate; K1 session-bound + auto-fills;
//                          fresh-per-use reset; K1 is a public address only.
//   S05 authGateSweep    — SCAN = same-device sweep, LINK DEVICE = usb-linked sweep;
//                          neither ever verifies or unlocks execution.
//   S06 authGateAttempts — 3 failed device attempts darken SCAN+LINK for THAT K1;
//                          passkey + human routes stay open; recovery never capped;
//                          per-K1 counter (fresh-per-use).
//
// Run: scripts/with-node24.sh node scripts/verify-authgate-session.cjs

const path = require('path');
const fs = require('fs');
const FRONTEND = path.resolve(__dirname, '..', 'frontend');
const SESSION_TS = path.join(FRONTEND, 'src', 'lib', 'authGateSession.ts');
const SWEEP_TS = path.join(FRONTEND, 'src', 'lib', 'authGateSweep.ts');
const ATTEMPTS_TS = path.join(FRONTEND, 'src', 'lib', 'authGateAttempts.ts');

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
  const S = await import(SESSION_TS);
  const W = await import(SWEEP_TS);
  const A = await import(ATTEMPTS_TS);

  // ---- S04 session ----
  check('S04: fresh session is unbound with no K1 (fresh-per-use)', () => {
    const s = S.freshSession();
    assert(s.bound === false && s.k1 === null, 'fresh session not clean');
  });
  check('S04: a gate must be blocked until a valid K1 is entered', () => {
    const s = S.freshSession();
    assert(S.canAttemptGate(s, '').ok === false, 'empty K1 should block');
    assert(S.canAttemptGate(s, 'not-an-address').ok === false, 'bad K1 should block');
    assert(S.canAttemptGate(s, K1).ok === true, 'valid K1 should allow');
  });
  check('S04: binding K1 makes it session-bound and auto-fills downstream', () => {
    let s = S.freshSession();
    s = S.bindK1(s, K1);
    assert(s.bound === true && s.k1 === K1.toLowerCase(), 'bind failed');
    assert(S.autofillK1(s) === K1.toLowerCase(), 'autofill mismatch');
  });
  check('S04: a different K1 cannot silently overwrite a bound session', () => {
    let s = S.bindK1(S.freshSession(), K1);
    const s2 = S.bindK1(s, K1B);
    assert(s2.k1 === K1.toLowerCase(), 'different K1 overwrote without reset');
  });
  check('S04: resetSession restores a clean unbound session (fresh-per-use)', () => {
    const s = S.resetSession();
    assert(s.bound === false && s.k1 === null, 'reset not clean');
    assert(S.autofillK1(s) === '', 'autofill should be empty before binding');
  });

  // ---- S05 sweep modes ----
  check('S05: SCAN is a same-device sweep that never verifies/unlocks', () => {
    const d = W.describeSweep('scan');
    assert(d.deviceScope === 'same-device', 'scan scope wrong');
    assert(d.verified === false && d.unlocksExecution === false, 'scan claims verify/unlock');
    assert(W.isSameDeviceSweep('scan') === true && W.isLinkedDeviceSweep('scan') === false, 'scan predicates wrong');
  });
  check('S05: LINK DEVICE is a usb-linked-device sweep that never verifies/unlocks', () => {
    const d = W.describeSweep('link');
    assert(d.deviceScope === 'usb-linked-device', 'link scope wrong');
    assert(d.verified === false && d.unlocksExecution === false, 'link claims verify/unlock');
    assert(W.isLinkedDeviceSweep('link') === true && W.isSameDeviceSweep('link') === false, 'link predicates wrong');
  });

  // ---- S06 attempt limits ----
  check('S06: 3 failed device attempts darken SCAN+LINK for that K1', () => {
    let st = A.freshAttempts();
    assert(A.devicesLocked(st) === false, 'should start unlocked');
    st = A.recordFailure(st, K1);
    st = A.recordFailure(st, K1);
    assert(A.devicesLocked(st) === false, 'should not lock before cap');
    st = A.recordFailure(st, K1);
    assert(A.devicesLocked(st) === true, 'should lock at 3 failures');
  });
  check('S06: passkey + human routes stay OPEN after device lockout', () => {
    let st = A.recordFailure(A.recordFailure(A.recordFailure(A.freshAttempts(), K1), K1), K1);
    assert(A.devicesLocked(st) === true, 'precondition: locked');
    assert(A.passkeyLaneOpen(st) === true, 'passkey lane should stay open');
    assert(A.humanRouteOpen(st) === true, 'human route should stay open');
    assert(A.recoveryCapped(st) === false, 'recovery must never be capped');
  });
  check('S06: a success clears failures; a new K1 resets the counter (per-K1)', () => {
    let st = A.recordFailure(A.recordFailure(A.freshAttempts(), K1), K1);
    st = A.recordSuccess(st, K1);
    assert(st.failures === 0, 'success did not clear');
    st = A.recordFailure(A.recordFailure(A.recordFailure(A.freshAttempts(), K1), K1), K1);
    st = A.recordFailure(st, K1B);
    assert(st.failures === 1 && st.k1 === K1B.toLowerCase(), 'new K1 did not reset counter');
  });

  console.log(`\nverify-authgate-session: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
