#!/usr/bin/env node
'use strict';

// verify-ui-baseline.cjs (S01) — proves the UI-label single source of truth and
// that the shipped App.tsx consumes it (no divergent hardcoded progress copy, no
// forbidden mechanics vocabulary in user-facing labels).
//
// Run: scripts/with-node24.sh node scripts/verify-ui-baseline.cjs

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const LABELS_TS = path.join(FRONTEND, 'src', 'lib', 'uiLabels.ts');
const APP_TSX = path.join(FRONTEND, 'src', 'App.tsx');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) { console.log('BLOCKER: requires Node 24 (got v' + process.versions.node + ')'); process.exit(5); }

assert(fs.existsSync(LABELS_TS), 'uiLabels.ts must exist');
const appSrc = fs.readFileSync(APP_TSX, 'utf8');
const appCode = appSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

(async () => {
  const m = await import(LABELS_TS);

  check('PROGRESS_LABELS is exactly the 5 canonical labels in order', () => {
    assert(JSON.stringify(m.PROGRESS_LABELS) === JSON.stringify([
      'Funding check', 'Preparing gate', 'Locking gate in', 'Verifying protection', 'Complete',
    ]), 'progress labels drifted');
  });

  check('neutral K3 copy present (mechanics hidden)', () => {
    assert(m.K3_INVALID_ALT === 'Invalid alternate destination ignored.', 'invalid-alt copy drift');
    assert(m.K3_ENFORCED === 'Verified K3 destination enforced.', 'enforced copy drift');
  });

  check('no forbidden mechanics vocabulary appears in exported UI strings', () => {
    const strings = [
      ...m.PROGRESS_LABELS, m.K3_INVALID_ALT, m.K3_ENFORCED, m.HUMAN_ROUTE_MSG, m.DEVICES_LOCKED_MSG,
    ].join(' ').toLowerCase();
    for (const bad of ['revoke', 'flashbot', 'mempool', 'smoke-test', 'smoke test', 'sweeper bot']) {
      assert(!strings.includes(bad), 'forbidden term leaked: ' + bad);
    }
  });

  check('safeLabel() redacts forbidden mechanics terms at runtime', () => {
    assert(m.safeLabel('revoke the token') === '—', 'safeLabel did not redact');
    assert(m.safeLabel('Funding check') === 'Funding check', 'safeLabel over-redacted');
  });

  check('App.tsx imports PROGRESS_LABELS + HUMAN_ROUTE_MSG from uiLabels', () => {
    assert(/from '\.\/lib\/uiLabels'/.test(appSrc), 'App does not import uiLabels');
    assert(/PROGRESS_LABELS\s*=\s*UI_PROGRESS_LABELS/.test(appCode), 'App does not bind PROGRESS_LABELS from uiLabels');
  });

  check('App.tsx does NOT hardcode a divergent progress-label array', () => {
    // The only allowed literal array of these labels lives in uiLabels.ts.
    assert(!/\[\s*'Funding check',\s*'Preparing gate'/.test(appCode), 'App re-hardcodes progress labels');
  });

  console.log(`\nverify-ui-baseline: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
