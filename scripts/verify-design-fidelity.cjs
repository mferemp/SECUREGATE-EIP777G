#!/usr/bin/env node
'use strict';

// verify-design-fidelity.cjs — static proof that the shipped SecureGate dashboard
// keeps the required locked/unlocked design contract:
//   * locked landing shows the DAPINK Auth-Gate canvas and terminal branding
//   * recovery/protection/admin/status workspace is unlock-gated
//   * interactive thank-you actions and deliverables link are unlock-gated
//   * SCRUB stays pink, power icon stays yellow, footer branding stays SecureGate-only
//   * no Surf / v0 scaffold branding leaks into the shipped frontend sources
//
// Run: scripts/with-node24.sh node scripts/verify-design-fidelity.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');
const CSS = path.join(ROOT, 'frontend', 'src', 'index.css');
const HTML = path.join(ROOT, 'frontend', 'index.html');
const UI_LABELS = path.join(ROOT, 'frontend', 'src', 'lib', 'uiLabels.ts');

let passed = 0;
let failed = 0;
function pass(msg) { passed++; console.log('PASS ' + msg); }
function fail(msg, err) { failed++; console.log('FAIL ' + msg + (err ? ' :: ' + err.message : '')); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function check(msg, fn) { try { fn(); pass(msg); } catch (err) { fail(msg, err); } }

const app = fs.readFileSync(APP, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
const html = fs.readFileSync(HTML, 'utf8');
const uiLabels = fs.readFileSync(UI_LABELS, 'utf8');
const appCode = app.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const visibleFrontend = [app.replace(/\/\/[^\n]*/g, ''), html].join('\n');

check('topbar keeps SecureGate / EIP-777G branding only', () => {
  assert(/<span className="sg-brand">SECUREGATE<\/span>/.test(app), 'SecureGate wordmark missing');
  assert(/<span className="sg-badge">EIP-777G<\/span>/.test(app), 'EIP-777G badge missing');
  assert(/<title>SecureGate EIP-777G<\/title>/.test(html), 'document title missing SecureGate branding');
});

check('locked DAPINK Auth-Gate canvas is present', () => {
  for (const snippet of [
    'GENESIS OWNER AUTHENTICATION',
    'DASHBOARD LOCKED',
    'K1 COMPROMISED WALLET ADDRESS',
    'LINK DEVICE',
    'PASSKEY',
    'ENTER',
    'AUTH-GATE',
    'STANDALONE OPERATION',
    'SCRUB',
  ]) {
    assert(app.includes(snippet), 'missing locked UI copy: ' + snippet);
  }
  assert(/aria-label="Caution"/.test(app), 'caution card missing');
  assert(/className="sg-scan-circle"/.test(app), 'neon circular SCAN control missing');
  assert(/className="sg-locked-card"/.test(app), 'locked warning card missing');
  assert(/className="sg-standalone"/.test(app), 'standalone card missing');
  assert(/className="sg-caution"/.test(app), 'caution card missing');
});

check('footer keeps canonical thank-you branding only', () => {
  assert(/<div className="sg-footer-thanks">THANK YOU<\/div>/.test(app), 'THANK YOU footer copy missing');
  assert(/<div className="sg-footer-built">BUILT BY EMP<\/div>/.test(app), 'BUILT BY EMP footer copy missing');
  assert(/@hope_ology/.test(app), '@hope_ology footer copy missing');
});

check('pink SCRUB and yellow power icon tokens are defined in shipped CSS', () => {
  assert(/--sg-pink:\s*#ff2d78;/i.test(css), 'pink SCRUB token missing or wrong');
  assert(/--sg-gold:\s*#d9b25a;/i.test(css), 'yellow power token missing');
  assert(/\.sg-scrub-btn[\s\S]*background:\s*var\(--sg-pink\)/.test(css), 'SCRUB button is not pink');
  assert(/\.sg-power \.dot[\s\S]*background:\s*var\(--sg-gold\)/.test(css), 'power dot is not yellow');
  assert(/\.sg-power-btn[\s\S]*color:\s*var\(--sg-gold\)/.test(css), 'power button is not yellow');
});

check('workspace tabs and recovery controls are unlock-gated', () => {
  assert(/const dashboardUnlocked = humanRoute\.trim\(\) !== ''/.test(appCode), 'dashboard unlock gate missing');
  assert(/\{dashboardUnlocked \? \(\s*<>[\s\S]*?<nav className="sg-tabs"/.test(app), 'tabs are not unlock-gated');
  assert(/label: 'Recovery'/.test(app), 'Recovery tab missing');
  assert(/label: 'Protection'/.test(app), 'Protection tab missing');
  assert(/label: 'Admin'/.test(app), 'Admin tab missing');
  assert(/label: 'Status'/.test(app), 'Status tab missing');
});

check('recovery workspace exposes the required unlocked fields and controls', () => {
  for (const snippet of [
    'Auth-Gate fills this',
    'Compromised K1 key',
    'Deployer burner key',
    'K2 authority address',
    'K3 recovery address',
    'Calculate funding',
    'Deploy gate',
  ]) {
    assert(app.includes(snippet), 'missing unlocked control/copy: ' + snippet);
  }
  for (const label of ['Funding check', 'Preparing gate', 'Locking gate in', 'Verifying protection', 'Complete']) {
    assert(uiLabels.includes(`'${label}'`), 'missing progress label: ' + label);
  }
});

check('interactive thank-you controls and deliverables link are unlock-gated', () => {
  assert(/\{dashboardUnlocked && \(\s*<section id="thanks-panel"/s.test(app), 'thank-you panel is not unlock-gated');
  assert(/\{dashboardUnlocked && \(\s*<a[\s\S]*?id="deliverables-link"/s.test(app), 'deliverables link is not unlock-gated');
  assert(/placeholder="Optional thank-you note"/.test(app), 'optional thank-you note control missing');
  assert(/>Send thank-you<\/Btn>/.test(app), 'send thank-you control missing');
});

check('locked branch keeps footer handle non-interactive', () => {
  assert(/:\s*\(\s*<span className="sg-footer-handle">@hope_ology<\/span>\s*\)\s*\}/s.test(app),
    'locked footer handle is not non-interactive text');
});

check('no Surf or v0 scaffold branding leaks into visible frontend sources', () => {
  for (const banned of [/\bSurf\b/i, /\bSurfAI\b/i, /\bv0\b/i]) {
    assert(!banned.test(visibleFrontend), 'forbidden branding leaked: ' + banned);
  }
});

console.log(`\nverify-design-fidelity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
