#!/usr/bin/env node
'use strict';

// extract-bytecode.js — read the canonical Foundry artifact and emit ONLY the
// four canonical env names. Never invents bytecode/ABI; fails if the artifact
// is missing or malformed.
//
//   SECUREGATE_BYTECODE_HEX      0x-prefixed creation bytecode
//   SECUREGATE_ABI_JSON          compact JSON ABI array
//   SECUREGATE_ARTIFACT_SHA256   sha256(utf8 of the 0x bytecode string)  -- matches backend/routes/artifact.js
//   SECUREGATE_ARTIFACT_VERSION  securegate@<sha12>
//
// Old names SECUREGATE_BYTECODE / SECUREGATE_ABI are intentionally NOT written.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'out', 'SecureGate.sol', 'SecureGate.json');
const OUT_ENV = path.join(ROOT, 'backend', '.env.securegate');

function fail(msg) {
  console.error(`[extract-bytecode][BLOCKER] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(ARTIFACT)) {
  fail(`artifact not found: ${ARTIFACT} — run \`forge build --via-ir\` first`);
}

let artifact;
try {
  artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
} catch (e) {
  fail(`artifact is not valid JSON: ${e.message}`);
}

// Foundry shape: { abi: [...], bytecode: { object: "0x..." }, ... }
const abi = artifact.abi;
if (!Array.isArray(abi) || abi.length === 0) fail('artifact.abi missing or empty');

let bytecode =
  (artifact.bytecode && (artifact.bytecode.object || artifact.bytecode)) || '';
if (typeof bytecode !== 'string' || bytecode.length === 0) {
  fail('artifact.bytecode.object missing');
}
if (!bytecode.startsWith('0x')) bytecode = '0x' + bytecode;
if (!/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode.length < 4) {
  fail('bytecode is not valid 0x-hex');
}

const abiJson = JSON.stringify(abi);
// Hash the 0x hex string as utf8 — identical to backend/routes/artifact.js.
const sha256 = crypto.createHash('sha256').update(bytecode, 'utf8').digest('hex');
const version = `securegate@${sha256.slice(0, 12)}`;

const lines = [
  `SECUREGATE_BYTECODE_HEX=${bytecode}`,
  `SECUREGATE_ABI_JSON=${abiJson}`,
  `SECUREGATE_ARTIFACT_SHA256=${sha256}`,
  `SECUREGATE_ARTIFACT_VERSION=${version}`,
  '',
].join('\n');

fs.mkdirSync(path.dirname(OUT_ENV), { recursive: true });
fs.writeFileSync(OUT_ENV, lines);

console.log('[extract-bytecode] wrote', path.relative(ROOT, OUT_ENV));
console.log('  SECUREGATE_BYTECODE_HEX      (' + (bytecode.length - 2) / 2 + ' bytes)');
console.log('  SECUREGATE_ABI_JSON          (' + abi.length + ' ABI entries)');
console.log('  SECUREGATE_ARTIFACT_SHA256   ' + sha256);
console.log('  SECUREGATE_ARTIFACT_VERSION  ' + version);
