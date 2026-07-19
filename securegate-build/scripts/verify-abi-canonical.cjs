#!/usr/bin/env node
'use strict';

// verify-abi-canonical.cjs (S02) — proves the ONLY authoritative artifact
// (out/SecureGate.sol/SecureGate.json) carries the required ABI and none of the
// forbidden old ABI, and that it was produced by a Foundry build (bytecode present).
//
// Run: scripts/with-node24.sh node scripts/verify-abi-canonical.cjs

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'out', 'SecureGate.sol', 'SecureGate.json');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

assert(fs.existsSync(ART), 'canonical artifact missing: ' + ART);
const art = JSON.parse(fs.readFileSync(ART, 'utf8'));
const abi = art.abi || [];
const bytecode = (art.bytecode && art.bytecode.object) || art.bytecode || '';
const sigs = abi.filter((e) => e.type === 'function')
  .map((e) => `${e.name}(${(e.inputs || []).map((i) => i.type).join(',')})`);

const REQUIRED = [
  'DOMAIN_SEPARATOR()', 'GATE_CHAIN_ID()', 'K1()', 'K2()', 'K3()',
  'authorizeIntent(bytes32,bytes)', 'computeAuthorizationDigest(bytes32)',
  'computeIntentHash(uint8,address,uint256,uint256,bytes32,uint256)',
  'executeIntent(bytes32)', 'intents(bytes32)',
  'queueERC1155(address,uint256,uint256,bytes32,uint256)',
  'queueERC20(address,uint256,bytes32,uint256)',
  'queueERC721(address,uint256,bytes32,uint256)',
  'recordAttemptedDestination(address)', 'suspectDestination(address)', 'usedNonces(bytes32)',
];
const FORBIDDEN = ['queueIntent', 'forwardERC20', 'computeEIP712Digest', 'domainSeparator'];

check('canonical artifact was produced by a Foundry build (bytecode present)', () => {
  assert(typeof bytecode === 'string' && /^0x[0-9a-fA-F]{2,}$/.test(bytecode), 'no bytecode object');
  assert((bytecode.replace(/^0x/, '').length) / 2 > 1000, 'bytecode implausibly small');
});

for (const sig of REQUIRED) {
  check('required ABI present: ' + sig, () => {
    assert(sigs.includes(sig), 'missing ' + sig);
  });
}

for (const bad of FORBIDDEN) {
  check('forbidden old ABI absent: ' + bad, () => {
    assert(!sigs.some((s) => s.startsWith(bad + '(')), 'present: ' + bad);
    // domainSeparator() lowercase forbidden, but DOMAIN_SEPARATOR() required — guard exact case.
    if (bad === 'domainSeparator') assert(!sigs.includes('domainSeparator()'), 'lowercase domainSeparator present');
  });
}

check('ABI entry count + bytecode size reported', () => {
  const sha = crypto.createHash('sha256').update(Buffer.from(bytecode.replace(/^0x/, ''), 'hex')).digest('hex');
  console.log(`     abiEntries=${abi.length} bytecodeBytes=${(bytecode.replace(/^0x/, '').length) / 2} bytecodeSha256=${sha}`);
});

console.log(`\nverify-abi-canonical: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
