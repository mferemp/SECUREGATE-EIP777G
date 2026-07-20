#!/usr/bin/env node
'use strict';

// verify-e2e-local.cjs — runs the local E2E harness and asserts every required
// invariant, printing PASS/FAIL lines. All txHashes are real anvil receipts.
//
// Run: scripts/with-node24.sh node scripts/verify-e2e-local.cjs

const path = require('path');
const { run } = require('./e2e-local-securegate.cjs');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, d) { failed++; console.log('FAIL ' + m + (d ? ' :: ' + d : '')); }
function assert(cond, m, d) { if (cond) pass(m); else fail(m, d); }

const TXRE = /^0x[0-9a-fA-F]{64}$/;

(async () => {
  const out = await run();
  const by = (n) => out.steps.filter((s) => s.name === n);

  const keys = by('keys-distinct')[0];
  assert(keys && keys.distinct, 'K1/K2/K3 are distinct');

  const deploy = by('deploy')[0];
  assert(deploy && TXRE.test(deploy.txHash) && /^0x[0-9a-fA-F]{40}$/.test(deploy.gateAddr),
    'canonical SecureGate bytecode deploys (real tx)', deploy && deploy.txHash);

  for (const asset of ['ERC20', 'ERC721', 'ERC1155']) {
    const f = by('flow').find((x) => x.assetType === asset);
    assert(f && f.hashMatches, `${asset}: client intentHash == on-chain IntentQueued hash`);
    assert(f && f.k2Valid, `${asset}: K2 typed-data signature verifies`);
    assert(f && TXRE.test(f.queueTx), `${asset}: K1 queue is a real tx`, f && f.queueTx);
    assert(f && TXRE.test(f.authTx), `${asset}: authorizeIntent(sig) is a real tx`, f && f.authTx);
    assert(f && TXRE.test(f.execTx), `${asset}: K1 execute is a real tx`, f && f.execTx);
    assert(f && f.landedAtK3 === true, `${asset}: asset forced to K3 on execute`);
  }

  const cap = by('non-k3-capture')[0];
  assert(cap && cap.captured === true && cap.suspect === true && TXRE.test(cap.txHash),
    'non-K3 attempted destination captured, never routed');

  const bb = by('backend-boundary')[0];
  assert(bb && bb.signedTxOnly === true && bb.fields.length === 1 && bb.fields[0] === 'signedTx',
    'backend broadcast payload carries signedTx ONLY (no private key)');

  // Global no-fake guard: no txHash is the string "pending"; none are all-zero.
  const allHashes = out.steps.flatMap((s) =>
    Object.entries(s).filter(([k]) => /Tx$|txHash/.test(k)).map(([, v]) => v));
  assert(allHashes.every((h) => TXRE.test(h) && !/^0x0+$/.test(h)),
    'no fake / pending / all-zero txHash anywhere');

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
