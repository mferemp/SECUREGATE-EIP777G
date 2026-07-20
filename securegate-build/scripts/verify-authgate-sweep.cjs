#!/usr/bin/env node
'use strict';

// verify-authgate-sweep.cjs (S03) — proves the two Auth-Gate sweep modes against
// the real shipped TS module: SCAN = same-device sweep, LINK DEVICE = usb-linked
// sweep, neither verifies/unlocks, and NEITHER moves any asset (the sweep is an
// ownership check only — there is no transfer/queue/execute surface in it).
//
// Run: scripts/with-node24.sh node scripts/verify-authgate-sweep.cjs

const path = require('path');
const fs = require('fs');
const FRONTEND = path.resolve(__dirname, '..', 'frontend');
const SWEEP_TS = path.join(FRONTEND, 'src', 'lib', 'authGateSweep.ts');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) { console.log('BLOCKER: requires Node 24 (got v' + process.versions.node + ')'); process.exit(5); }

const src = fs.readFileSync(SWEEP_TS, 'utf8');
const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

(async () => {
  const W = await import(SWEEP_TS);

  check('SCAN is a same-device sweep', () => {
    const d = W.describeSweep('scan');
    assert(d.deviceScope === 'same-device', 'scan scope wrong');
    assert(W.isSameDeviceSweep('scan') && !W.isLinkedDeviceSweep('scan'), 'scan predicates wrong');
  });
  check('LINK DEVICE is a usb-linked-device sweep', () => {
    const d = W.describeSweep('link');
    assert(d.deviceScope === 'usb-linked-device', 'link scope wrong');
    assert(W.isLinkedDeviceSweep('link') && !W.isSameDeviceSweep('link'), 'link predicates wrong');
  });
  check('neither sweep ever verifies or unlocks execution', () => {
    for (const m of ['scan', 'link']) {
      const d = W.describeSweep(m);
      assert(d.verified === false && d.unlocksExecution === false, m + ' claims verify/unlock');
    }
  });
  check('sweep module has NO asset-movement surface (no transfer/queue/execute/sign/broadcast)', () => {
    assert(!/transfer|queueERC|executeIntent|signLocally|broadcast|sendRawTransaction/i.test(code),
      'sweep module references an asset-movement primitive');
  });

  console.log(`\nverify-authgate-sweep: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(2); });
