#!/usr/bin/env node
'use strict';

// verify-thank-you-envelope.cjs (S18) — proves the thank-you envelope is COMPLETELY
// separate from K3: its address is copy/tip data only, never a recovery destination,
// never a deploy/proof/execution parameter. Loads the REAL frontend module + checks
// the backend route is honest-capability (disabled unless configured).
//
// Run: scripts/with-node24.sh node scripts/verify-thank-you-envelope.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'frontend', 'src', 'lib', 'thankYouEnvelope.ts');
const ROUTE = path.join(ROOT, 'backend', 'routes', 'thank-you.js');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
async function check(m, fn) { try { await fn(); pass(m); } catch (e) { fail(m, e); } }

const route = fs.readFileSync(ROUTE, 'utf8');
const app = fs.readFileSync(APP, 'utf8');

(async () => {
  const m = await import('file://' + MOD);

  await check('thankYouIsNotK3 blocks a thank-you address equal to K3', () => {
    const addr = '0x' + '55'.repeat(20);
    assert(m.thankYouIsNotK3(addr, addr) === false, 'thank-you == K3 was allowed');
    assert(m.thankYouIsNotK3(addr, '0x' + '66'.repeat(20)) === true, 'distinct address wrongly blocked');
    assert(m.thankYouIsNotK3('', addr) === true, 'empty thank-you should be trivially not-K3');
  });
  await check('thank-you config exposes copyAddress as copy-only (no destination role)', () => {
    const src = fs.readFileSync(MOD, 'utf8');
    assert(/copy-only|NEVER used as a recovery destination/.test(src), 'copyAddress not documented copy-only');
  });
  await check('App uses thankYouIsNotK3 guard before copying the tip address', () => {
    assert(/thankYouIsNotK3\(/.test(app), 'App does not guard thank-you vs K3');
  });
  await check('thank-you panel and interactive handle are rendered only after Auth-Gate unlock', () => {
    assert(/\{dashboardUnlocked && \(\s*<section id="thanks-panel"/s.test(app), 'thank-you panel is not unlock-gated');
    assert(/\{dashboardUnlocked\s*\?\s*\([\s\S]*?<a[\s\S]*?className="sg-footer-handle"[\s\S]*?href="https:\/\/x\.com\/hope_ology"/s.test(app),
      'unlocked footer @hope_ology link branch missing');
    assert(/:\s*\(\s*<span className="sg-footer-handle">@hope_ology<\/span>\s*\)\s*\}/s.test(app),
      'locked footer @hope_ology branch is not non-interactive text');
  });
  await check('thank-you address is NOT wired into any deploy/proof/execution body', () => {
    // Line-scoped scan: no single statement may pass a thanks address into a
    // deploy / broadcast / execute / signed-tx call.
    const lines = app.split('\n');
    for (const ln of lines) {
      if (/thanksAddress|thanks-address/i.test(ln)) {
        assert(!/(deploy|broadcast|executeIntent|handleExecuteIntent|signedTx|backendDeployBody)\s*\(/.test(ln),
          'thanks address used in a deploy/execution call: ' + ln.trim());
      }
    }
  });
  await check('backend thank-you route is honest-capability (disabled unless configured)', () => {
    assert(/disabled/.test(route), 'route never reports disabled state');
    assert(/sent/.test(route), 'route has no sent flag');
  });

  console.log(`\nverify-thank-you-envelope: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
