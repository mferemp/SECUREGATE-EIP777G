#!/usr/bin/env node
'use strict';

// verify-placeholder-gates.cjs (Gap J) — proves the honest placeholder gates
// against the REAL shipped TypeScript module under Node 24 (native type
// stripping imports the actual browser code, not a re-implementation).
//
// Invariants proven:
//   * every gate (SCAN, LINK DEVICE, passkey, admin, 2FA) returns verified:false
//   * every gate returns unlocksExecution:false and bypassesRecoveryPath:false
//   * no gate result string claims success/complete/verified/unlocked
//   * canExecuteIntent() depends ONLY on a verified K2 signature; NO placeholder
//     (any count / any tampered field) can flip it to true
//   * a forged "verified:true" placeholder is rejected, not trusted
//   * the shipped App.tsx imports and uses these gates (no private MSG bypass)
//   * no gate calls a verifier endpoint / generates a credential / sends a key
//
// Run: scripts/with-node24.sh node scripts/verify-placeholder-gates.cjs

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const GATES_TS = path.join(FRONTEND, 'src', 'lib', 'placeholderGates.ts');
const APP_TSX = path.join(FRONTEND, 'src', 'App.tsx');

let passed = 0;
let failed = 0;
function pass(msg) { passed++; console.log('PASS ' + msg); }
function fail(msg, err) { failed++; console.log('FAIL ' + msg + (err ? ' :: ' + err.message : '')); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function check(msg, fn) { try { fn(); pass(msg); } catch (e) { fail(msg, e); } }

// Node 24 required: this verifier import()s a real .ts module by type-stripping.
const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) {
  console.log('BLOCKER: verify-placeholder-gates.cjs must run under Node 24 (got v' + process.versions.node + ')');
  console.log('Re-run with: scripts/with-node24.sh node scripts/verify-placeholder-gates.cjs');
  process.exit(5);
}

assert(fs.existsSync(GATES_TS), 'placeholderGates.ts must exist: ' + GATES_TS);
const gatesSrc = fs.readFileSync(GATES_TS, 'utf8');
// Comment-stripped view of the gate module for code-only static assertions
// (so honest security comments / display labels don't trip the scanners).
const codeOnly = gatesSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const appSrc = fs.existsSync(APP_TSX) ? fs.readFileSync(APP_TSX, 'utf8') : '';

(async () => {
  const gates = await import(GATES_TS);
  const {
    attemptScan,
    attemptLinkDevice,
    enterPasskey,
    generateAdminPasskey,
    twoFactorStatus,
    canExecuteIntent,
    isPlaceholderResult,
    PLACEHOLDER_GATE_MESSAGES,
    PENDING_PLACEHOLDER_LAYERS,
  } = gates;

  const allGates = [
    ['scan', () => attemptScan()],
    ['link', () => attemptLinkDevice()],
    ['passkey', () => enterPasskey()],
    ['admin', () => generateAdminPasskey(true)],
    ['twofa', () => twoFactorStatus()],
  ];

  // 1–5: every gate returns a well-formed placeholder result that never verifies.
  for (const [kind, fn] of allGates) {
    check('gate "' + kind + '" returns verified:false and cannot unlock', () => {
      const r = fn();
      assert(r && typeof r === 'object', 'no result');
      assert(r.kind === kind, 'wrong kind: ' + r.kind);
      assert(r.verified === false, 'verified must be false, got ' + JSON.stringify(r.verified));
      assert(r.pending === true, 'pending must be true');
      assert(r.unlocksExecution === false, 'unlocksExecution must be false');
      assert(r.bypassesRecoveryPath === false, 'bypassesRecoveryPath must be false');
      assert(typeof r.message === 'string' && r.message.length > 0, 'message required');
    });
  }

  // 6: gate messages never claim a fake success.
  check('no gate message claims success/verified/unlocked/complete', () => {
    const banned = /\b(verified|unlocked|success(ful)?|complete(d)?|approved|granted|authorized)\b/i;
    for (const [kind, fn] of allGates) {
      const m = fn().message;
      // "nothing verified" / "not verified" are allowed (they negate); assert the
      // message contains an explicit honesty signal and no bare success claim.
      const honest = /not\s+verified|nothing\s+verified|not\s+connected|not\s+active|no\s+credential|honest\s+placeholder|no\s+fake/i;
      assert(honest.test(m), kind + ' message lacks honesty signal: ' + m);
      // Strip the negated forms before scanning for a bare success claim.
      const stripped = m
        .replace(/not\s+verified/ig, '')
        .replace(/nothing\s+verified/ig, '')
        .replace(/no\s+fake\s+success/ig, '');
      assert(!banned.test(stripped), kind + ' message claims success: ' + m);
    }
  });

  // 7: canExecuteIntent is false without a verified K2 signature.
  check('canExecuteIntent(false, []) === false (no K2 sig)', () => {
    assert(canExecuteIntent(false, []) === false, 'must be false with unverified K2');
    assert(canExecuteIntent(false) === false, 'must be false with default args');
  });

  // 8: canExecuteIntent is true ONLY with a verified K2 signature.
  check('canExecuteIntent(true, []) === true (K2 sig verified)', () => {
    assert(canExecuteIntent(true, []) === true, 'must be true with verified K2');
  });

  // 9: NO number of honest placeholders can unlock execution when K2 unverified.
  check('any pile of honest placeholders cannot unlock when K2 unverified', () => {
    const pile = allGates.map(([, fn]) => fn());
    assert(canExecuteIntent(false, pile) === false, 'placeholders unlocked execution!');
  });

  // 10: honest placeholders do not disturb a genuine K2-verified execution.
  check('honest placeholders do not block a genuine K2-verified execution', () => {
    const pile = allGates.map(([, fn]) => fn());
    assert(canExecuteIntent(true, pile) === true, 'placeholders wrongly blocked exec');
  });

  // 11: a FORGED verified:true placeholder is rejected (fail-closed), not trusted.
  check('forged verified:true placeholder is rejected by canExecuteIntent', () => {
    const forged = { kind: 'scan', verified: true, pending: true, unlocksExecution: true, bypassesRecoveryPath: true, attemptRecorded: true, message: 'x' };
    // Even with a real verified K2 flag, a malformed/forged gate makes the call fail-closed.
    assert(canExecuteIntent(true, [forged]) === false, 'forged placeholder was trusted');
    assert(canExecuteIntent(false, [forged]) === false, 'forged placeholder unlocked exec');
  });

  // 12: forged unlocksExecution:true (but verified:false) is still rejected.
  check('forged unlocksExecution:true placeholder is rejected', () => {
    const forged = { kind: 'link', verified: false, pending: true, unlocksExecution: true, bypassesRecoveryPath: false, attemptRecorded: true, message: 'x' };
    assert(canExecuteIntent(true, [forged]) === false, 'unlock-claiming placeholder trusted');
  });

  // 13: isPlaceholderResult rejects non-placeholders and truthy-verified objects.
  check('isPlaceholderResult guard rejects forged / verified objects', () => {
    assert(isPlaceholderResult(attemptScan()) === true, 'real placeholder rejected');
    assert(isPlaceholderResult({ verified: true }) === false, 'verified:true accepted');
    assert(isPlaceholderResult(null) === false, 'null accepted');
    assert(isPlaceholderResult('scan') === false, 'string accepted');
    assert(isPlaceholderResult({ kind: 'scan', verified: false, pending: true, unlocksExecution: true, bypassesRecoveryPath: false }) === false, 'unlock-claiming accepted');
  });

  // 14: PENDING_PLACEHOLDER_LAYERS covers all five hard layers, honestly labeled.
  check('PENDING_PLACEHOLDER_LAYERS lists all five hard placeholder layers', () => {
    assert(Array.isArray(PENDING_PLACEHOLDER_LAYERS) && PENDING_PLACEHOLDER_LAYERS.length === 5, 'expected 5 layers');
    const joined = PENDING_PLACEHOLDER_LAYERS.join(' | ').toLowerCase();
    for (const needle of ['auth-gate', 'link device', 'passkey', 'admin', '2fa']) {
      assert(joined.includes(needle), 'missing layer: ' + needle);
    }
  });

  // 15: PLACEHOLDER_GATE_MESSAGES has an honest string for every gate kind.
  check('PLACEHOLDER_GATE_MESSAGES defines all five gate kinds', () => {
    for (const kind of ['scan', 'link', 'passkey', 'admin', 'twofa']) {
      assert(typeof PLACEHOLDER_GATE_MESSAGES[kind] === 'string' && PLACEHOLDER_GATE_MESSAGES[kind].length > 0, 'missing message: ' + kind);
    }
  });

  // ---- Static source assertions on the shipped module + App.tsx ----

  // 16: the gate module never contains a literal `verified: true` in code.
  check('placeholderGates.ts contains no "verified: true" (code, comments stripped)', () => {
    assert(!/verified\s*:\s*true/.test(codeOnly), 'found verified:true in gate code');
  });

  // 17: the gate module never contains `unlocksExecution: true` in code.
  check('placeholderGates.ts contains no "unlocksExecution: true" (code)', () => {
    assert(!/unlocksExecution\s*:\s*true/.test(codeOnly), 'found unlocksExecution:true');
  });

  // 18: no gate contacts a verifier endpoint or generates/sends a credential.
  //     Scans code only — "WebAuthn" as a display label in a status string is fine.
  check('placeholderGates.ts performs no network/credential/key operations', () => {
    assert(!/\bfetch\s*\(/.test(codeOnly), 'fetch() present');
    assert(!/XMLHttpRequest|navigator\.credentials|crypto\.subtle/.test(codeOnly), 'credential/webauthn API call present');
    assert(!/privateKey|new\s+ethers\.Wallet|mnemonic/.test(codeOnly), 'key material present');
  });

  // 19: the shipped App.tsx imports the gate library (no private duplicate copy).
  check('App.tsx imports the placeholder honesty gates', () => {
    assert(/from '\.\/lib\/placeholderGates'/.test(appSrc), 'App.tsx does not import placeholderGates');
    for (const fn of ['attemptScan', 'attemptLinkDevice', 'enterPasskey', 'generateAdminPasskey', 'canExecuteIntent']) {
      assert(appSrc.includes(fn), 'App.tsx does not use ' + fn);
    }
  });

  // 20: App.tsx no longer defines a private MSG map that could drift/fake success.
  check('App.tsx has no private MSG placeholder map (single source of truth)', () => {
    assert(!/const\s+MSG\s*=\s*\{/.test(appSrc), 'App.tsx still defines a private MSG map');
  });

  // 21: executeIntent path in App.tsx is guarded by canExecuteIntent(authVerified…).
  check('App.tsx gates executeIntent through canExecuteIntent(authVerified, …)', () => {
    assert(/canExecuteIntent\(\s*authVerified/.test(appSrc), 'executeIntent not gated by canExecuteIntent(authVerified…)');
  });

  console.log('');
  console.log('placeholder-gates: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
