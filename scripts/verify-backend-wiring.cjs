#!/usr/bin/env node
'use strict'

const fs = require('fs')

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

function pass(msg) { console.log(`[PASS] ${msg}`) }
function fail(msg) { console.error(`[FAIL] ${msg}`); process.exitCode = 1 }
function assert(condition, msg) { condition ? pass(msg) : fail(msg) }

const requiredFiles = [
  'api/_lib/mount.js',
  'api/health.js',
  'api/chains.js',
  'api/runtime.js',
  'api/funding/[chain].js',
  'api/deploy/[chain].js',
  'api/rpc/[chain].js',
  'api/passkeys/register.js',
  'api/passkeys/verify.js',
  'api/admin-passkey/generate.js',
  'api/thank-you/config.js',
  'api/thank-you/send.js',
  'api/trace/[kind].js',
  'api/anti-abuse/event.js',
  'api/artifact/securegate.js',
  'backend/config/chains.js',
  'backend/routes/chains.js',
  'backend/routes/runtime.js',
  'backend/routes/funding.js',
  'backend/routes/deploy.js',
  'backend/routes/rpc.js',
  'backend/routes/passkeys.js',
  'backend/routes/admin-passkey.js',
  'backend/routes/thank-you.js',
  'backend/routes/trace.js',
  'backend/routes/anti-abuse.js',
  'backend/routes/artifact.js',
  'backend/lib/passkey-store.js',
  'frontend/src/lib/api.ts'
]

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `${file} exists`)
}

const app        = read('frontend/src/App.tsx')
const apiHelper  = read('frontend/src/lib/api.ts')
const deployRoute = read('backend/routes/deploy.js')
const chainsConfig = read('backend/config/chains.js')
const thankYou   = read('backend/routes/thank-you.js')
const passkeys   = read('backend/routes/passkeys.js')
const admin      = read('backend/routes/admin-passkey.js')
const vercel     = read('vercel.json')
const mount      = read('api/_lib/mount.js')

// api helper
assert(apiHelper.includes('return `/api/${clean}`'), 'frontend api helper targets /api')

// frontend calls correct routes
assert(app.includes("api('chains')") || app.includes('api("chains")'), 'frontend calls /api/chains')
assert(app.includes("api('thank-you/config')") || app.includes('api("thank-you/config")'), 'frontend calls thank-you config')
assert(app.includes('passkeys/verify'), 'frontend calls passkeys/verify')
assert(app.includes('admin-passkey/generate'), 'frontend calls admin-passkey/generate')
assert(app.includes('funding/') || app.includes('funding/${'), 'frontend calls funding route')
assert(app.includes('deploy/') || app.includes('deploy/${'), 'frontend calls deploy route')
assert(app.includes('signedTx'), 'frontend has signedTx field')

// deploy route security
assert(deployRoute.includes('signedTx required') || deployRoute.includes('signedTx (0x'), 'deploy route requires signedTx')
assert(deployRoute.includes('eth_sendRawTransaction'), 'deploy route broadcasts via eth_sendRawTransaction')
assert(deployRoute.includes('private key'), 'deploy route rejects private key material')
assert(!deployRoute.includes('req.body.privateKey'), 'deploy route does not consume privateKey')
assert(!deployRoute.includes('req.body.k2Key'), 'deploy route does not consume k2Key')
assert(!deployRoute.includes('req.body.k3Key'), 'deploy route does not consume k3Key')

// chains config
assert(chainsConfig.includes('listPublic'), 'chains config has listPublic')
assert(chainsConfig.includes('rpcUrlFor'), 'chains config has rpcUrlFor')
assert(!read('backend/routes/chains.js').includes('rpcEnv'), 'chains route does not expose rpcEnv')
assert(!read('backend/routes/chains.js').includes('rpcUrl'), 'chains route does not expose rpcUrl')

// thank-you
assert(thankYou.includes('copyAddress'), 'thank-you config exposes copyAddress')
assert(!thankYou.includes('K3'), 'thank-you route does not mention K3')

// passkeys + admin
assert(passkeys.includes("router.post('/verify'"), 'passkeys verify route exists')
assert(admin.includes("router.post('/generate'"), 'admin generate route exists')
assert(admin.includes('SECUREGATE_ADMIN_KEY'), 'admin route requires SECUREGATE_ADMIN_KEY')

// mount adapter uses stripSegments
assert(mount.includes('stripSegments'), 'mount.js uses stripSegments parameter')

// vercel config
assert(vercel.includes('"api/**/*.js"'), 'vercel deploys explicit api files')
assert(vercel.includes('((?!api/)'), 'vercel SPA rewrite excludes api paths')
assert(!fs.existsSync('api/[...path].js'), 'catch-all api route absent')
assert(!fs.existsSync('api/_lib/app.js'), 'stale api app wrapper absent')

// passkey-store self-contained (no kv dependency)
const pkStore = read('backend/lib/passkey-store.js')
assert(!pkStore.includes("require('./kv')"), 'passkey-store does not import ./kv')
assert(!pkStore.includes("require('../lib/kv')"), 'passkey-store does not import kv via lib')

// passkeys route self-contained
assert(!passkeys.includes('anti-abuse-kv'), 'passkeys route does not import anti-abuse-kv')
assert(!passkeys.includes('trace-key'), 'passkeys route does not import trace-key')

if (process.exitCode) process.exit(process.exitCode)
console.log('\n[OK] verify-backend-wiring: all checks passed')
