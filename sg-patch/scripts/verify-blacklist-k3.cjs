#!/usr/bin/env node
'use strict';

// verify-blacklist-k3.cjs (S14) — proves the K3 forced-destination invariant end
// to end: the on-chain contract captures (never routes) a non-K3 destination, the
// backend address-guard classifies suspect destinations while keeping K3 forced,
// and the frontend k3Enforcement mirror always returns K3 with neutral copy.
//
// Run: scripts/with-node24.sh node scripts/verify-blacklist-k3.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const SOL = path.join(ROOT, 'contracts', 'SecureGate.sol');
const GUARD = path.join(ROOT, 'backend', 'lib', 'address-guard.js');
const FRONT = path.join(ROOT, 'frontend', 'src', 'lib', 'k3Enforcement.ts');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

const sol = fs.readFileSync(SOL, 'utf8');
const guardMod = require(GUARD);

(async () => {
  await check('contract executes ONLY to K3 (transfer targets K3, never a param)', () => {
    assert(/transfer\(K3,/.test(sol), 'ERC20 transfer not to K3');
    assert(/safeTransferFrom\(address\(this\), K3,/.test(sol), '721/1155 not to K3');
    assert(/emit IntentExecuted\(intentHash, intent\.token, K3\)/.test(sol), 'execution not emitted to K3');
  });
  await check('contract captures a non-K3 destination as suspect (blacklist), never routes it', () => {
    assert(/suspectDestination\[attempted\] = true/.test(sol), 'no suspect capture');
    assert(/emit NonK3DestinationCaptured\(attempted\)/.test(sol), 'no capture event');
    // recordAttemptedDestination must NOT transfer anything.
    const fn = sol.slice(sol.indexOf('function recordAttemptedDestination'));
    const body = fn.slice(0, fn.indexOf('}\n'));
    assert(!/transfer|safeTransferFrom/.test(body), 'capture function moves value');
  });
  await check('K3 is immutable in the contract', () => {
    assert(/address public immutable K3;/.test(sol), 'K3 not immutable');
  });
  await check('backend guard keeps forcedDestination == K3 even when override requested', () => {
    const k3 = '0x' + '11'.repeat(20);
    const other = '0x' + '22'.repeat(20);
    const r = guardMod.enforceK3(k3, other);
    assert(r.forcedDestination === k3.toLowerCase(), 'forced dest not K3');
    assert(r.effectiveDestination === k3.toLowerCase(), 'effective dest not K3');
    assert(r.suspect === true, 'override not flagged suspect');
    assert(r.suspectDestination === other.toLowerCase(), 'suspect dest not captured');
  });
  await check('backend guard rejects override-smuggling body keys', () => {
    assert(guardMod.hasForbiddenOverride({ overrideDestination: '0xabc' }) === true, 'overrideDestination not caught');
    assert(guardMod.hasForbiddenOverride({ k2OverrideDest: '0xabc' }) === true, 'k2OverrideDest not caught');
    assert(guardMod.hasForbiddenOverride({ signedTx: '0xabc' }) === false, 'signedTx wrongly flagged');
  });
  await check('frontend mirror always returns K3 with neutral copy', async () => {
    const m = await import('file://' + FRONT);
    const k3 = '0x' + '33'.repeat(20);
    const other = '0x' + '44'.repeat(20);
    const ev = m.enforceK3(k3, other);
    assert(ev.effectiveDestination === k3.toLowerCase(), 'mirror effective dest not K3');
    assert(ev.suspect === true, 'mirror did not flag suspect');
    assert(/Invalid alternate destination ignored\.|Verified K3 destination enforced\./.test(ev.message), 'copy not neutral');
    const okEv = m.enforceK3(k3, k3);
    assert(okEv.suspect === false, 'K3==K3 wrongly suspect');
  });

  console.log(`\nverify-blacklist-k3: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
