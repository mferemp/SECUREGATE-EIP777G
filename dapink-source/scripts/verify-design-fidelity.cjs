#!/usr/bin/env node
/*
 * verify-design-fidelity.cjs
 *
 * DAPINK design-lock gate. Tests passing is NOT design acceptance: this verifier
 * fails the build if the public SecureGate frontend loses its DAPINK identity or
 * regresses to a generic Surf/tabbed scaffold as the landing view.
 *
 * It asserts three things against the actual frontend source:
 *   1. No Surf / generic-scaffold branding appears in the public frontend.
 *   2. Every required DAPINK public label is present in the frontend source.
 *   3. The Recovery/Protection/Admin/Status tabbed workspace is NOT the dominant
 *      landing shell — the STANDALONE OPERATION canvas comes first and the tabs
 *      are gated behind the Auth-Gate unlock.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const APP = path.join(FRONTEND, 'src', 'App.tsx');
const INDEX_HTML = path.join(FRONTEND, 'index.html');
const INDEX_CSS = path.join(FRONTEND, 'src', 'index.css');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('PASS ' + msg); }
  else { failed++; console.log('FAIL ' + msg); }
}

const app = fs.readFileSync(APP, 'utf8');
const html = fs.existsSync(INDEX_HTML) ? fs.readFileSync(INDEX_HTML, 'utf8') : '';
const css = fs.existsSync(INDEX_CSS) ? fs.readFileSync(INDEX_CSS, 'utf8') : '';
// Public frontend surface = the app shell + the served HTML + the stylesheet.
const publicSrc = [app, html, css].join('\n');

// ------------------------------------------------------------------ 1. no Surf
const FORBIDDEN_BRANDING = [
  'Made by Surf',
  'SurfAI',
  'Surf AI',
  'generic Surf',
  'surf scaffold',
  'surf-badge',
  'asksurf.ai',
  'Surf Plaza',
  'plaza-badge',
];
for (const term of FORBIDDEN_BRANDING) {
  assert(!publicSrc.includes(term), `no forbidden branding in public frontend: "${term}"`);
}

// -------------------------------------------------------- 2. required DAPINK labels
const REQUIRED_LABELS = [
  'SECUREGATE',
  'EIP-777G',
  'GENESIS OWNER AUTHENTICATION',
  'DASHBOARD LOCKED',
  'K1 COMPROMISED WALLET ADDRESS',
  'LINK DEVICE',
  'PASSKEY',
  'AUTH-GATE',
  'STANDALONE OPERATION',
  'BY USING SECUREGATE YOU ACKNOWLEDGE',
  'SCRUB',
  'BUILT BY EMP',
  '@hope_ology',
];
for (const lbl of REQUIRED_LABELS) {
  assert(app.includes(lbl), `required DAPINK label present: "${lbl}"`);
}

// --------------------------------------------- 3. tabs are NOT the landing shell
const standaloneIdx = app.indexOf('STANDALONE OPERATION');
const tabsIdx = app.indexOf('className="sg-tabs"');
assert(standaloneIdx !== -1, 'STANDALONE OPERATION landing canvas exists');
assert(tabsIdx !== -1, 'tab navigation exists (workspace behind the gate)');
assert(
  standaloneIdx !== -1 && tabsIdx !== -1 && standaloneIdx < tabsIdx,
  'STANDALONE OPERATION landing renders BEFORE the Recovery/Protection/Admin/Status tabs',
);
// The tab workspace must be gated behind the Auth-Gate unlock, not the landing.
assert(/dashboardUnlocked/.test(app), 'a dashboardUnlocked gate exists');
const gateIdx = app.indexOf('{dashboardUnlocked ? (');
assert(
  gateIdx !== -1 && gateIdx < tabsIdx,
  'the tab workspace is wrapped in the dashboardUnlocked gate (not the landing view)',
);

// Neon SCAN circle control present (design element, still gated by devicesLocked).
assert(/id="scan-authenticator"[^>]*className="sg-scan-circle"/s.test(app), 'neon circular SCAN control present');
assert(/id="scan-authenticator"[^>]*disabled=\{devicesLocked\}/s.test(app), 'SCAN circle still honestly gated by devicesLocked');

console.log(`\nverify-design-fidelity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
