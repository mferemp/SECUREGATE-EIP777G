#!/usr/bin/env node
'use strict';

/**
 * verify-zip-contents.cjs
 *
 * Verifies the final SecureGate / EIP-777G ZIP is a normal ZIP with a central
 * directory, contains required active-root files, and does not rely on
 * uploads/, outputs/, restored-original-*, _stitch_zip/, node_modules/, or .git
 * as implementation source.
 *
 * No external dependencies.
 */

const fs = require('node:fs');

const zipPath = process.argv[2];
if (!zipPath) {
  console.error('usage: node scripts/verify-zip-contents.cjs <zip-file>');
  process.exit(2);
}

let buf;
try {
  buf = fs.readFileSync(zipPath);
} catch (err) {
  console.error(`[FAIL] cannot read ZIP: ${zipPath}`);
  console.error(String(err && err.message || err));
  process.exit(2);
}

function u16(o) { return buf.readUInt16LE(o); }
function u32(o) { return buf.readUInt32LE(o); }

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`[PASS] ${msg}`);
}

// EOCD signature: 0x06054b50 == PK\x05\x06
let eocd = -1;
const min = Math.max(0, buf.length - 0xffff - 22);
for (let i = buf.length - 22; i >= min; i -= 1) {
  if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
    eocd = i;
    break;
  }
}

if (eocd < 0) {
  fail('ZIP end-of-central-directory record missing; not a normal ZIP');
  process.exit(process.exitCode || 1);
}

const totalEntries = u16(eocd + 10);
const centralSize = u32(eocd + 12);
const centralOffset = u32(eocd + 16);

if (totalEntries <= 0) fail('ZIP has zero central-directory entries');
if (centralOffset <= 0 || centralOffset >= buf.length) fail('central directory offset invalid');
if (centralOffset + centralSize > buf.length) fail('central directory size/offset invalid');

const names = [];
let pos = centralOffset;

for (let i = 0; i < totalEntries; i += 1) {
  if (pos + 46 > buf.length || u32(pos) !== 0x02014b50) {
    fail(`central-directory entry ${i} has invalid signature`);
    break;
  }

  const nameLen = u16(pos + 28);
  const extraLen = u16(pos + 30);
  const commentLen = u16(pos + 32);
  const nameStart = pos + 46;
  const nameEnd = nameStart + nameLen;

  if (nameEnd > buf.length) {
    fail(`central-directory entry ${i} filename out of range`);
    break;
  }

  const rawName = buf.slice(nameStart, nameEnd).toString('utf8');
  const name = rawName.replace(/\\/g, '/');
  names.push(name);

  pos = nameEnd + extraLen + commentLen;
}

if (process.exitCode) process.exit(process.exitCode);

const nameSet = new Set(names);

const required = [
  'contracts/SecureGate.sol',
  'test/SecureGate.t.sol',
  'foundry.toml',
  'script/DeploySecureGate.s.sol',
  'out/SecureGate.sol/SecureGate.json',

  'scripts/bootstrap-node24.sh',
  'scripts/with-node24.sh',
  'scripts/extract-bytecode.js',
  'scripts/verify-abi-canonical.cjs',
  'scripts/verify-zip-contents.cjs',

  '.node-version',
  '.nvmrc',
  '.npmrc',

  'backend/package.json',
  'frontend/package.json',

  'frontend/src/App.tsx',
  'frontend/src/index.css',
  'frontend/src/lib/api.ts',
  'frontend/src/lib/uiLabels.ts',
  'frontend/src/lib/authGateSession.ts',
  'frontend/src/lib/authGateSweep.ts',
  'frontend/src/lib/authGateAttempts.ts',
  'frontend/src/lib/deviceBreadcrumb.ts',
  'frontend/src/lib/passkeyAccess.ts',
  'frontend/src/lib/adminPasskey.ts',
  'frontend/src/lib/twoFactorProactive.ts',
  'frontend/src/lib/recoveryCleanupSweep.ts',
  'frontend/src/lib/securegateTxBuilder.ts',
  'frontend/src/lib/securegateIntentHash.ts',
  'frontend/src/lib/securegateK2Authorization.ts',
  'frontend/src/lib/securegateWalletProvider.ts',
  'frontend/src/lib/k3Enforcement.ts',
  'frontend/src/lib/k3ExecutionSweep.ts',
  'frontend/src/lib/thankYouEnvelope.ts',
  'frontend/src/lib/placeholderGates.ts',

  'backend/server.js',
  'backend/config/chains.js',
  'backend/routes/artifact.js',
  'backend/routes/funding.js',
  'backend/routes/deploy.js',
  'backend/routes/runtime.js',
  'backend/routes/trace.js',
  'backend/routes/thank-you.js',
  'backend/routes/passkeys.js',
  'backend/routes/admin-passkey.js',
  'backend/lib/address-guard.js',
  'backend/lib/trace-store.js',
  'backend/lib/passkey-store.js',
  'backend/lib/anti-abuse-kv.js',

  'scripts/verify-ui-baseline.cjs',
  'scripts/verify-no-drift.cjs',
  'scripts/verify-authgate-session.cjs',
  'scripts/verify-authgate-sweep.cjs',
  'scripts/verify-authgate-attempt-limits.cjs',
  'scripts/verify-authgate-passkey.cjs',
  'scripts/verify-admin-passkey.cjs',
  'scripts/verify-2fa-no-limits.cjs',
  'scripts/verify-recovery-flow-ui.cjs',
  'scripts/verify-funding-gas.cjs',
  'scripts/verify-recovery-cleanup-sweep.cjs',
  'scripts/verify-blacklist-k3.cjs',
  'scripts/verify-k3-execution-sweep.cjs',
  'scripts/verify-k2-intent-builders.cjs',
  'scripts/verify-wallet-k2-flow.cjs',
  'scripts/verify-front-back-wiring.cjs',
  'scripts/verify-thank-you-envelope.cjs',
  'scripts/verify-contract-obfuscation-layers.cjs',
  'scripts/verify-obfuscation-ci.cjs',
  'scripts/verify-anti-abuse-downloads.cjs',
  'scripts/verify-placeholder-gates.cjs',
];

const forbiddenPrefixes = [
  'uploads/',
  'outputs/',
  'restored-original',
  '_stitch_zip/',
  'node_modules/',
  '.git/',
];

let missing = 0;
for (const file of required) {
  if (!nameSet.has(file)) {
    fail(`missing required active-root file: ${file}`);
    missing += 1;
  }
}

for (const name of names) {
  if (name.startsWith('/') || name.includes('../') || name.includes('/../')) {
    fail(`unsafe path in ZIP: ${name}`);
  }

  for (const prefix of forbiddenPrefixes) {
    if (name === prefix.slice(0, -1) || name.startsWith(prefix)) {
      fail(`forbidden non-active implementation path in ZIP: ${name}`);
    }
  }
}

if (!process.exitCode) {
  pass(`standard ZIP central directory parsed (${names.length} entries)`);
  pass(`all ${required.length} required active-root files present`);
  pass('no uploads/, outputs/, restored-original-*, _stitch_zip/, node_modules/, or .git paths');
  pass('ZIP content gate satisfied');
}

process.exit(process.exitCode || 0);
