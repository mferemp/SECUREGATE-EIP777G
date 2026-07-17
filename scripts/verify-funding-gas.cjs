#!/usr/bin/env node
'use strict';

// verify-funding-gas.cjs (S11) — proves the funding/gas estimate is served by the
// backend using its own RPC, exposes NO endpoint URL to the client, and the client
// funding path never leaks a private key.
//
// Run: scripts/with-node24.sh node scripts/verify-funding-gas.cjs

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const FUNDING = path.join(ROOT, 'backend', 'routes', 'funding.js');
const APP = path.join(ROOT, 'frontend', 'src', 'App.tsx');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, e) { failed++; console.log('FAIL ' + m + (e ? ' :: ' + e.message : '')); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function check(m, fn) { try { fn(); pass(m); } catch (e) { fail(m, e); } }

const funding = fs.readFileSync(FUNDING, 'utf8');
const app = fs.readFileSync(APP, 'utf8');

check('funding route exists at GET /api/funding/:chain', () => {
  assert(/router\.get\('\/:chain'/.test(funding), 'no GET /:chain handler');
});
check('funding estimate uses backend RPC (chains.rpcUrlFor)', () => {
  assert(/rpcUrlFor\(slug\)/.test(funding), 'does not resolve RPC via backend config');
});
check('funding response returns NO rpc endpoint URL', () => {
  assert(!/res\.json\([^)]*url/is.test(funding), 'response includes url');
  assert(!/rpcUrl:/.test(funding), 'response includes rpcUrl');
});
check('funding computes a real gas estimate (eth_gasPrice * gas)', () => {
  assert(/eth_gasPrice/.test(funding), 'no eth_gasPrice call');
  assert(/gasPrice \* DEFAULT_DEPLOY_GAS|estWei/.test(funding), 'no wei computation');
});
check('funding estimate is not a fabricated constant string', () => {
  assert(!/estimateNative:\s*'[0-9.]+'/.test(funding), 'hardcoded estimate string');
});
check('client reaches gas/funding data through backend routes only (no direct provider URL)', () => {
  assert(/funding\//.test(app), 'client does not call funding route');
  // A JSON-RPC method name (eth_gasPrice) may appear, but ONLY when routed through
  // the backend proxy api(`rpc/${slug}`) — never a hardcoded provider endpoint.
  assert(/api\(`rpc\/\$\{slug\}`\)|api\('rpc\//.test(app), 'client does not use the backend rpc proxy');
  assert(!/https?:\/\/[a-z0-9.-]*(infura|alchemy|quiknode|ankr|llamarpc|drpc|rpc\.)/i.test(app), 'client hits a direct provider URL');
});
check('client funding path carries no private-key material', () => {
  assert(!/funding[^;]*privateKey|funding[^;]*k1Key/i.test(app), 'key material near funding call');
});

console.log(`\nverify-funding-gas: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
