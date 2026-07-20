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

// --------------------------------------- 4. DAPINK locked-screen shell (topbar + footer)
// 4a. No topbar "GATE LOCKED" pill — the locked state lives in the sidebar card only.
assert(!/GATE(?:&nbsp;|\s)+LOCKED/i.test(app), 'no topbar GATE LOCKED pill text in App.tsx');
assert(!/id="power-status"/.test(app), 'no #power-status GATE LOCKED pill element in topbar');

// 4b. Footer must be a bottom-right envelope, not a centered full-width divider footer.
const footerBlockMatch = css.match(/\.sg-footer\s*\{[^}]*\}/);
assert(!!footerBlockMatch, '.sg-footer CSS rule exists');
const footerCss = footerBlockMatch ? footerBlockMatch[0] : '';
assert(/position:\s*(fixed|absolute)/.test(footerCss), '.sg-footer is fixed/absolute (bottom-right envelope)');
assert(/bottom:/.test(footerCss) && /right:/.test(footerCss), '.sg-footer is anchored bottom-right');
assert(!/border-top:\s*[^;]*(1px|solid)/.test(footerCss), '.sg-footer has NO border-top divider');
assert(!/justify-items:\s*center/.test(footerCss), '.sg-footer does not center content (justify-items)');
assert(!/text-align:\s*center/.test(footerCss), '.sg-footer does not center text');
assert(/pointer-events:\s*none/.test(footerCss), '.sg-footer is non-interactive by default (pointer-events:none)');
assert(!/margin-top:\s*30px/.test(footerCss), '.sg-footer does not push main-flow layout (no margin-top divider)');

// 4c. Locked sidebar canon: PASSKEY + ENTER, CAUTION/warning block, admin
// black-circle INSIDE the caution block, and a version/security badge.
assert(/id="passkey-input"/.test(app) && /id="passkey-enter"/.test(app), 'PASSKEY input + ENTER button present in locked sidebar');
const sideCautionIdx = app.indexOf('className="sg-side-caution"');
assert(sideCautionIdx !== -1, 'sidebar CAUTION/warning block present');
const blackCircleIdx = app.indexOf('id="admin-black-circle"');
const asideCloseIdx = app.indexOf('</aside>');
assert(blackCircleIdx !== -1, 'admin black-circle button present');
assert(blackCircleIdx > sideCautionIdx && blackCircleIdx < asideCloseIdx,
  'admin black-circle is inside the sidebar caution/warning block');
assert(/className="sg-side-badge"/.test(app), 'version/security badge present in sidebar');
// CAUTION main-canvas card must also remain.
assert(/className="sg-caution"/.test(app), 'main-canvas CAUTION card present');

console.log(`\nverify-design-fidelity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
