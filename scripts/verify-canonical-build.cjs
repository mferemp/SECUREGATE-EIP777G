#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

function read(p) {
  const full = path.resolve(p)
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : ''
}

function pass(msg) { console.log(`[PASS] ${msg}`) }
function fail(msg) { console.error(`[FAIL] ${msg}`); process.exitCode = 1 }
function assert(condition, msg) { condition ? pass(msg) : fail(msg) }

const rootPkg = JSON.parse(read('package.json') || '{}')
const frontendPkg = JSON.parse(read('frontend/package.json') || '{}')
const app = read('frontend/src/App.tsx')
const css = read('frontend/src/index.css')
const deployRoute = read('backend/routes/deploy.js')

const FORBIDDEN = [
  'GATE LOCKED',
  'server-supplied RPC',
  'RPC is not part',
  'OPERATOR PROOF',
  'operator-proof-field',
  'SMOKE TEST',
  'Smoke test',
  '2FA DEPLOYER',
  'Production-Ready',
  'production-ready',
  'public RPC',
  'Revoke',
  'queue',
  'QR'
]

// ── root package.json ────────────────────────────────────────────────────────
assert(rootPkg.scripts?.dev?.includes('npm --prefix frontend run dev'), 'root dev script delegates to frontend')
assert(rootPkg.scripts?.build?.includes('npm --prefix frontend run build'), 'root build script exists')
assert(rootPkg.scripts?.['verify:canonical'] != null, 'verify:canonical script exists')
assert(rootPkg.engines?.node != null, 'root Node engine declared')

// ── frontend package.json ────────────────────────────────────────────────────
assert(frontendPkg.scripts?.dev?.includes('vite'), 'frontend dev script is vite')
assert(frontendPkg.scripts?.build?.includes('vite build'), 'frontend build script is vite build')
assert(frontendPkg.scripts?.['type-check'] != null, 'frontend type-check script exists')

// ── state machine ────────────────────────────────────────────────────────────
assert(app.includes('const dashboardUnlocked = authGateVerified'), 'dashboardUnlocked is controlled by authGateVerified')
assert(!app.includes('dashboardUnlocked = humanRoute'), 'humanRoute does not unlock dashboard')
assert(app.includes('setAuthGateVerified(true)'), 'verified passkey can unlock dashboard')
assert(app.includes('setAuthGateVerified(false)'), 'failed paths keep dashboard locked')

// ── admin circle ─────────────────────────────────────────────────────────────
assert(app.includes('id="admin-black-circle"'), 'admin-black-circle button exists')
assert(app.includes("{'⚫'}") || app.includes('⚫️') || app.includes('⚫'), 'admin circle symbol present')
assert(!app.includes("{ key: 'admin'"), 'Admin tab removed from TABS')
assert(!app.includes("key: 'admin'"), 'Admin tab key absent')

// ── required copy ────────────────────────────────────────────────────────────
assert(app.includes('Chain checks stay backend-routed for security.'), 'backend-routed copy exists')
assert(app.includes('Endpoint details never appear in the browser.'), 'endpoint non-exposure copy exists')
assert(app.includes('DASHBOARD LOCKED'), 'DASHBOARD LOCKED card exists')
assert(app.includes('K1 COMPROMISED WALLET ADDRESS'), 'K1 address label exists')
assert(app.includes('LINK DEVICE'), 'LINK DEVICE exists')
assert(app.includes('PASSKEY'), 'PASSKEY label exists')
assert(app.includes('STANDALONE OPERATION'), 'STANDALONE OPERATION exists')
assert(app.includes('CAUTION'), 'CAUTION block exists')
assert(app.includes('THANK YOU'), 'THANK YOU footer exists')
assert(app.includes('BUILT BY EMP'), 'BUILT BY EMP footer exists')
assert(app.includes('@hope_ology'), '@hope_ology footer exists')

// ── dashboard tab labels ─────────────────────────────────────────────────────
assert(app.includes("activeTab === 'deployment'"), 'deployment tab exists')
assert(app.includes("activeTab === 'protection'"), 'protection tab exists')
assert(app.includes("activeTab === 'status'"), 'status tab exists')

// ── forbidden App.tsx terms ──────────────────────────────────────────────────
for (const term of FORBIDDEN) {
  assert(!app.includes(term), `forbidden App.tsx term absent: "${term}"`)
}

// ── CSS ──────────────────────────────────────────────────────────────────────
assert(css.includes('.sg-sidebar'), 'sidebar CSS exists')
assert(css.includes('.sg-scan'), 'scan CSS exists')
assert(css.includes('.sg-side-caution'), 'caution CSS exists')
assert(css.includes('.sg-admin-circle'), 'admin-circle CSS exists')
assert(css.includes('.sg-footer'), 'footer CSS exists')
assert(css.includes('position: fixed'), 'fixed positioning exists')

// ── deploy route ─────────────────────────────────────────────────────────────
assert(deployRoute.includes('signedTx required'), 'deploy route requires signedTx')
assert(deployRoute.includes('private key'), 'deploy route rejects private key material')
assert(deployRoute.includes('eth_sendRawTransaction'), 'deploy route broadcasts raw tx')
assert(!deployRoute.includes('overrideDestination'), 'deploy route does not accept overrideDestination')

// ── built dist (if present) ──────────────────────────────────────────────────
const distDir = 'frontend/dist/assets'
if (fs.existsSync(distDir)) {
  const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'))
  for (const file of jsFiles) {
    const src = read(`${distDir}/${file}`)
    for (const term of FORBIDDEN) {
      assert(!src.includes(term), `dist/${file}: forbidden term absent: "${term}"`)
    }
  }
}

if (process.exitCode) {
  console.error('\nBuild NOT canonical — fix FAILs above before deploying.')
  process.exit(1)
}

console.log('\nAll checks passed. Build is canonical.')
