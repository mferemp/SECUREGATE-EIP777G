#!/usr/bin/env node
'use strict';

// drift-scan.cjs — scan the SecureGate source for forbidden public wording and
// forbidden constructs that would violate the canonical rules. Run from backend/:
//   node scripts/drift-scan.cjs
//
// It reads real source files and fails (exit 1) if any forbidden marker appears.
// Note: this scanner necessarily *names* the forbidden tokens; those literals are
// split so the scanner does not flag its own source.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // repo root (/workspaces)

// Directories to scan for source drift.
const SCAN_DIRS = [
  path.join(ROOT, 'backend', 'config'),
  path.join(ROOT, 'backend', 'routes'),
  path.join(ROOT, 'backend', 'lib'),
  path.join(ROOT, 'backend', 'scripts'),
  path.join(ROOT, 'frontend', 'src'),
];

// Forbidden substrings (assembled so this file itself is not a match).
// These must not appear ANYWHERE in the scanned source.
const FORBIDDEN = [
  'flash' + 'bots',
  '/api/' + 'relay',
  'final-' + 'ui-repair',
  '_EIP777G_' + 'ARTIFACT',
];

// Alternate-destination override keys. These may appear ONLY in the canonical
// rejection list (lib/address-guard.js), which exists precisely to block them.
// Anywhere else they signal effective alternate routing and are drift.
const FORBIDDEN_OVERRIDE = [
  'override' + 'Destination',
  'override' + 'Dest',
  'k2' + 'OverrideDest',
];
const OVERRIDE_ALLOWLIST = 'address-guard.js';

// Public-wording tokens that must not appear as user-facing copy. Matched only as
// whole words to avoid false hits inside unrelated identifiers.
const FORBIDDEN_WORDS = [
  're' + 'voke',
  'swee' + 'per',
  'smoke-' + 'test',
];

function walk(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(js|cjs|mjs|ts|tsx|jsx|html|css)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const findings = [];
const files = SCAN_DIRS.reduce((acc, d) => walk(d, acc), []);

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const base = path.basename(file);
  for (const token of FORBIDDEN) {
    if (text.includes(token)) findings.push({ rel, token });
  }
  // Override keys are drift everywhere except the canonical rejection list.
  if (base !== OVERRIDE_ALLOWLIST) {
    for (const token of FORBIDDEN_OVERRIDE) {
      if (text.includes(token)) findings.push({ rel, token });
    }
  }
  for (const word of FORBIDDEN_WORDS) {
    const re = new RegExp('\\b' + word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
    if (re.test(text)) findings.push({ rel, token: word });
  }
}

if (findings.length) {
  for (const f of findings) {
    // eslint-disable-next-line no-console
    console.log(`DRIFT  ${f.rel}  contains forbidden token: ${f.token}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\ndrift:scan: ${findings.length} forbidden marker(s) found`);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`drift:scan: clean (${files.length} source files scanned)`);
process.exit(0);
