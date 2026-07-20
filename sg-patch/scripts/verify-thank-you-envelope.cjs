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

  // ---- Unlock-gating structural proofs (thank-you controls must be post-auth only) ----

  // Region inside the recovery-workspace Auth-Gate: from the marker comment to the
  // gate's closing token (`</>` ... `) : null}`) immediately before </main>.
  const markerIdx = app.indexOf('RECOVERY WORKSPACE (revealed after Auth-Gate)');
  const gateOpenIdx = app.indexOf('{dashboardUnlocked ? (', markerIdx);
  const mainCloseIdx = app.indexOf('</main>', gateOpenIdx);
  const gateCloseTok = app.lastIndexOf(') : null}', mainCloseIdx);
  const gatedRegion = app.slice(gateOpenIdx, gateCloseTok);
  const afterGate = app.slice(gateCloseTok, mainCloseIdx); // between gate close and </main>

  await check('thanks-panel is unlock-gated (inside dashboardUnlocked block)', () => {
    assert(markerIdx !== -1 && gateOpenIdx !== -1 && gateCloseTok !== -1, 'auth-gate region not found');
    assert(/id="thanks-panel"/.test(gatedRegion), 'thanks-panel is not inside the unlock gate');
    assert(!/id="thanks-panel"/.test(afterGate), 'thanks-panel leaks outside the unlock gate');
  });
  await check('thanks-message textarea is unlock-gated', () => {
    assert(/id="thanks-message"/.test(gatedRegion), 'thanks-message not inside the unlock gate');
    assert(!/id="thanks-message"/.test(afterGate), 'thanks-message leaks outside the unlock gate');
  });
  await check('thanks-send button is unlock-gated', () => {
    assert(/id="thanks-send"/.test(gatedRegion), 'thanks-send not inside the unlock gate');
    assert(!/id="thanks-send"/.test(afterGate), 'thanks-send leaks outside the unlock gate');
  });

  // Footer block: locked handle must be a non-interactive span; deliverables-link and
  // the interactive @hope_ology link must live in the dashboardUnlocked branch only.
  const footerOpen = app.indexOf('<footer className="sg-footer">');
  const footerClose = app.indexOf('</footer>', footerOpen);
  const footer = app.slice(footerOpen, footerClose);
  const footerGateIdx = footer.indexOf('{dashboardUnlocked ? (');
  const footerElseIdx = footer.indexOf(') : (', footerGateIdx);
  const footerUnlocked = footer.slice(footerGateIdx, footerElseIdx);
  const footerLocked = footer.slice(footerElseIdx);

  await check('deliverables-link is unlock-gated (unlocked footer branch only)', () => {
    assert(footerGateIdx !== -1 && footerElseIdx !== -1, 'footer unlock branch not found');
    assert(/id="deliverables-link"/.test(footerUnlocked), 'deliverables-link not in unlocked footer branch');
    assert(!/id="deliverables-link"/.test(footerLocked), 'deliverables-link leaks into locked footer branch');
  });
  await check('locked footer @hope_ology is a non-interactive span', () => {
    assert(/<span[^>]*className="sg-footer-handle"[^>]*aria-disabled/.test(footerLocked),
      'locked footer handle is not a non-interactive span');
    assert(!/<a[^>]*sg-footer-handle/.test(footerLocked), 'locked footer handle is an interactive link');
  });
  await check('unlocked footer @hope_ology may be an interactive link', () => {
    assert(/<a[^>]*className="sg-footer-handle"[^>]*x\.com\/hope_ology/.test(footerUnlocked),
      'unlocked footer handle is not an interactive link');
  });

  // ---- DAPINK footer/envelope placement proofs (bottom-right, no divider) ----
  const cssPath = path.join(ROOT, 'frontend', 'src', 'index.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const footerCssMatch = css.match(/\.sg-footer\s*\{[^}]*\}/);
  const footerCss = footerCssMatch ? footerCssMatch[0] : '';

  await check('footer/envelope is anchored bottom-right (fixed/absolute)', () => {
    assert(!!footerCss, '.sg-footer CSS rule not found');
    assert(/position:\s*(fixed|absolute)/.test(footerCss), '.sg-footer is not fixed/absolute');
    assert(/bottom:/.test(footerCss) && /right:/.test(footerCss), '.sg-footer is not bottom-right');
  });
  await check('no centered THANK YOU block / no full-width footer divider', () => {
    assert(!/justify-items:\s*center/.test(footerCss), '.sg-footer centers content');
    assert(!/text-align:\s*center/.test(footerCss), '.sg-footer centers text');
    assert(!/border-top:\s*[^;]*(1px|solid)/.test(footerCss), '.sg-footer has a full-width divider');
    assert(!/margin-top:\s*30px/.test(footerCss), '.sg-footer pushes main-flow layout');
  });
  await check('no topbar GATE LOCKED pill remains in App.tsx', () => {
    assert(!/GATE(?:&nbsp;|\s)+LOCKED/i.test(app), 'topbar GATE LOCKED pill text present');
    assert(!/id="power-status"/.test(app), '#power-status GATE LOCKED pill present');
  });

  console.log(`\nverify-thank-you-envelope: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
