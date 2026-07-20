#!/usr/bin/env node
'use strict';

// obfuscation-equivalence.cjs — guards that any obfuscated/minified build keeps the
// tokens the app depends on (DOM ids, API paths, chain slugs, progress strings).
// Run from backend/:  node scripts/obfuscation-equivalence.cjs
//
// If no obfuscated build output exists yet, the script verifies the clean source
// contains the protected tokens and exits 0 with an honest "no build to compare"
// note. It never fabricates an equivalence result.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// Clean source is the shipped shell (App.tsx) PLUS the user-facing label module
// (uiLabels.ts), which is the single source of truth for progress strings.
const CLEAN_FILES = [
  path.join(ROOT, 'frontend', 'src', 'App.tsx'),
  path.join(ROOT, 'frontend', 'src', 'lib', 'uiLabels.ts'),
];

// Candidate obfuscated/build outputs to compare against, if present.
const BUILD_CANDIDATES = [
  path.join(ROOT, 'frontend', 'dist'),
  path.join(ROOT, 'live'),
];

// Tokens that MUST survive verbatim through any transform.
const PROTECTED = [
  // DOM ids
  'recovery-k1', 'k1-session-key', 'deployer-burner-key', 'k2-address', 'k3-address',
  'network-select', 'funding-check', 'deploy-gate', 'funding-panel', 'deploy-status',
  'thanks-handle', 'thanks-address-label', 'thanks-address-box', 'thanks-copy-address',
  'thanks-message', 'thanks-send', 'thanks-status',
  // API paths
  'chains', 'funding/', 'anti-abuse/event', 'thank-you/config', 'thank-you/send',
  // progress strings
  'Funding check', 'Preparing gate', 'Locking gate in', 'Verifying protection', 'Complete',
];

function readAll(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  const stat = fs.statSync(dir);
  if (stat.isFile()) { acc.push(fs.readFileSync(dir, 'utf8')); return acc; }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readAll(full, acc);
    else if (/\.(js|css|html)$/.test(entry.name)) acc.push(fs.readFileSync(full, 'utf8'));
  }
  return acc;
}

function missingTokens(text) {
  return PROTECTED.filter((t) => !text.includes(t));
}

// 1. Verify the clean source carries every protected token.
const missingCleanFile = CLEAN_FILES.find((f) => !fs.existsSync(f));
if (missingCleanFile) {
  console.log('obfuscation-equivalence: clean source not found at ' + path.relative(ROOT, missingCleanFile));
  process.exit(1);
}
const cleanText = CLEAN_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const cleanMissing = missingTokens(cleanText);
if (cleanMissing.length) {
  console.log('obfuscation-equivalence: clean source is missing protected tokens:');
  cleanMissing.forEach((t) => console.log('  - ' + t));
  process.exit(1);
}

// 2. If an obfuscated build exists, verify tokens survive there too.
const existingBuild = BUILD_CANDIDATES.find((d) => fs.existsSync(d));
if (!existingBuild) {
  console.log('obfuscation-equivalence: clean source OK; no obfuscated build present to compare');
  process.exit(0);
}

const buildText = readAll(existingBuild, []).join('\n');
const buildMissing = missingTokens(buildText);
if (buildMissing.length) {
  console.log(`obfuscation-equivalence: build at ${path.relative(ROOT, existingBuild)} dropped tokens:`);
  buildMissing.forEach((t) => console.log('  - ' + t));
  process.exit(1);
}

console.log(`obfuscation-equivalence: clean and build agree (${PROTECTED.length} tokens preserved)`);
process.exit(0);
