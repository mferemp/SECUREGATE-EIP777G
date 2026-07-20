#!/usr/bin/env node
'use strict';

// verify-recovery-k3.cjs (S13/S14/S16/S18) — proves recovery-flow invariants
// against the real shipped TS modules under Node 24:
//   S13 recoveryCleanupSweep — session-only secrets scrub; NO key material can ride
//                              in a backend payload; only { signedTx } is allowed.
//   S14 k3Enforcement        — K3 is the immutable forced destination; a non-K3
//                              request is captured as suspect but never returned as
//                              usable; neutral mechanics-free copy.
//   S16 k3ExecutionSweep     — executeIntent sweep target ALWAYS resolves to K3,
//                              even when an override destination is supplied.
//   S18 thankYouEnvelope     — the thank-you address is NEVER K3.
//
// Run: scripts/with-node24.sh node scripts/verify-recovery-k3.cjs

const path = require('path');
const FRONTEND = path.resolve(__dirname, '..', 'frontend');
const CLEANUP = path.join(FRONTEND, 'src', 'lib', 'recoveryCleanupSweep.ts');
const K3ENF = path.join(FRONTEND, 'src', 'lib', 'k3Enforcement.ts');
const K3EXE = path.join(FRONTEND, 'src', 'lib', 'k3ExecutionSweep.ts');
const THANKS = path.join(FRONTEND, 'src', 'lib', 'thankYouEnvelope.ts');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) { console.log('BLOCKER: requires Node 24 (got v' + process.versions.node + ')'); process.exit(5); }

const K3 = '0x3333333333333333333333333333333333333333';
const ALT = '0x4444444444444444444444444444444444444444';

(async () => {
  const C = await import(CLEANUP);
  const E = await import(K3ENF);
  const X = await import(K3EXE);
  const T = await import(THANKS);

  // ---- S13 cleanup sweep ----
  check('S13: scrub() blanks both session-only secrets', () => {
    const s = C.freshScratch();
    s.compromisedK1Key = 'deadbeef'; s.burnerDeployerKey = 'cafe';
    C.scrub(s);
    assert(s.compromisedK1Key === '' && s.burnerDeployerKey === '', 'scrub failed');
  });
  check('S13: a payload carrying key material is rejected (backend-safe fail-closed)', () => {
    assert(C.isBackendSafe({ signedTx: '0xabc' }) === true, 'signedTx should be safe');
    for (const bad of ['privateKey', 'k1Key', 'compromisedK1Key', 'burnerDeployerKey', 'mnemonic', 'seed', 'k2Key', 'k3Key', 'sessionKey']) {
      assert(C.isBackendSafe({ [bad]: 'x' }) === false, 'did not reject ' + bad);
    }
  });
  check('S13: backendDeployBody yields ONLY { signedTx }', () => {
    const b = C.backendDeployBody('0xsigned');
    assert(Object.keys(b).length === 1 && b.signedTx === '0xsigned', 'body shape drift');
  });

  // ---- S14 k3 enforcement ----
  check('S14: effective destination is ALWAYS K3 even with an alternate request', () => {
    const r = E.enforceK3(K3, ALT);
    assert(r.effectiveDestination === K3.toLowerCase(), 'effective != K3');
    assert(r.forcedDestination === K3.toLowerCase(), 'forced != K3');
    assert(r.suspect === true && r.suspectDestination === ALT.toLowerCase(), 'alt not captured as suspect');
    assert(r.message === 'Invalid alternate destination ignored.', 'wrong neutral copy on suspect');
  });
  check('S14: a matching K3 request is enforced with neutral copy', () => {
    const r = E.enforceK3(K3, K3);
    assert(r.suspect === false, 'k3==k3 flagged suspect');
    assert(r.message === 'Verified K3 destination enforced.', 'wrong neutral copy on match');
  });
  check('S14: an invalid K3 throws (never routes to a bad destination)', () => {
    let threw = false;
    try { E.enforceK3('not-an-addr', ALT); } catch { threw = true; }
    assert(threw, 'invalid K3 did not throw');
  });

  // ---- S16 execution sweep ----
  check('S16: sweep target resolves to K3 even when an override is supplied', () => {
    const plan = X.resolveSweepTarget({ intentHash: '0xhash', k3: K3, requestedDestination: ALT });
    assert(plan.target === K3.toLowerCase(), 'sweep target != K3');
    assert(plan.override === true, 'override not captured');
    assert(X.sweepTargetsOnlyK3({ intentHash: '0xhash', k3: K3, requestedDestination: ALT }) === true, 'guard false');
  });

  // ---- S18 thank-you separation ----
  check('S18: thank-you address is never treated as K3', () => {
    assert(T.thankYouIsNotK3(ALT, K3) === true, 'distinct addrs should be ok');
    assert(T.thankYouIsNotK3(K3, K3) === false, 'thank-you == K3 must be rejected');
    assert(T.thankYouIsNotK3('', K3) === true, 'empty thank-you is trivially not-K3');
  });

  console.log(`\nverify-recovery-k3: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
