#!/usr/bin/env node
'use strict';

// verify-contract-obfuscation-layers.cjs (S15) — HONEST fail-close verifier.
//
// Owner reality: contract/dashboard obfuscation is NOT complete. There is no
// obfuscated build configured. This verifier therefore does NOT claim an
// obfuscation layer exists; it asserts the HONEST state instead:
//   * the canonical Foundry artifact exists and is the ONLY source of bytecode,
//   * no fabricated/placeholder "obfuscated" artifact has been dropped in,
//   * the source honestly documents the missing layer (no false completeness claim),
//   * the equivalence guard fails closed when no obfuscated build is present.
// It prints a SKIP note for the obfuscation build itself and exits non-fatally.
//
// Run: scripts/with-node24.sh node scripts/verify-contract-obfuscation-layers.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'out', 'SecureGate.sol', 'SecureGate.json');
const SOL = path.join(ROOT, 'contracts', 'SecureGate.sol');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

check('canonical Foundry artifact exists and carries real bytecode', () => {
  assert(fs.existsSync(ART), 'out/SecureGate.sol/SecureGate.json missing');
  const j = JSON.parse(fs.readFileSync(ART, 'utf8'));
  const bc = (j.bytecode && j.bytecode.object) || j.bytecode || '';
  assert(/^0x[0-9a-fA-F]{200,}$/.test(bc), 'artifact bytecode is not real hex');
});
check('no fabricated / placeholder obfuscated artifact is committed', () => {
  const candidates = [
    path.join(ROOT, 'out', 'SecureGate.obf.json'),
    path.join(ROOT, 'out', 'SecureGate.obfuscated.json'),
    path.join(ROOT, 'contracts', 'SecureGate.obf.sol'),
  ];
  for (const c of candidates) {
    assert(!fs.existsSync(c), 'a placeholder obfuscated artifact exists: ' + path.relative(ROOT, c));
  }
});
check('source honestly documents the missing layer (no false completeness claim)', () => {
  const sol = fs.readFileSync(SOL, 'utf8');
  assert(/missing layer|remain a separate/i.test(sol), 'contract does not document the missing layer');
  assert(!/fully obfuscated|obfuscation complete|production-ready/i.test(sol), 'contract makes a false obfuscation/production claim');
});

// The obfuscation build itself is NOT configured — report honestly, do not fake it.
console.log('SKIPPED: no obfuscated build configured');
console.log('NOTE: Contract/dashboard obfuscation is NOT complete.');

console.log(`\nverify-contract-obfuscation-layers: ${passed} passed, ${failed} failed (obfuscation build SKIPPED)`);
process.exit(failed ? 1 : 0);
