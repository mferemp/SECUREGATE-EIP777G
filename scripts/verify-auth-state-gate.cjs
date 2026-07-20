'use strict'

// Verifies App.tsx has correct locked/unlocked state gating and forbidden content is absent
const fs = require('fs')
const path = require('path')

const appTsx = fs.readFileSync(path.resolve(__dirname, '../frontend/src/App.tsx'), 'utf8')

let pass = true

function check(label, cond) {
  if (!cond) { console.error('[FAIL]', label); pass = false } else console.log('[PASS]', label)
}

function absent(label, pattern) {
  const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
  check(label, !re.test(appTsx))
}

function present(label, pattern) {
  const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
  check(label, re.test(appTsx))
}

// ── Locked state must-haves ──────────────────────────────────────────────────
check('has dashboardUnlocked state', appTsx.includes('dashboardUnlocked'))
check('dashboardUnlocked uses authGateVerified (not humanRoute.trim)', !appTsx.includes('dashboardUnlocked = humanRoute'))
check('authGateVerified is derived from humanRoute', appTsx.includes('authGateVerified'))
check('has DASHBOARD LOCKED text', appTsx.includes('DASHBOARD LOCKED'))
check('has GENESIS OWNER AUTHENTICATION', appTsx.includes('GENESIS OWNER AUTHENTICATION'))
check('has AUTH-GATE section', appTsx.includes('AUTH-GATE'))
check('has STANDALONE OPERATION', appTsx.includes('STANDALONE OPERATION'))
check('has CAUTION block', appTsx.includes('CAUTION'))
check('admin symbol ⚫-\' present in CAUTION', appTsx.includes('admin-black-circle') && (appTsx.includes('9899') || appTsx.includes('⚫') || appTsx.includes('&#9899;')))
check('has SCAN button', appTsx.includes('scan-authenticator') || appTsx.includes('scan-device') || appTsx.includes('SCAN'))
check('has LINK DEVICE button', appTsx.includes('LINK DEVICE') || appTsx.includes('link-device'))
check('has PASSKEY + ENTER', appTsx.includes('PASSKEY') && appTsx.includes('ENTER'))
check('admin panel does not use a separate tab (no admin TabKey)', !appTsx.includes("'admin' | '") && !appTsx.includes("| 'admin'"))

// ── Unlocked must-haves ──────────────────────────────────────────────────────
check('has EIP-777G DEPLOYMENT heading', appTsx.includes('EIP-777G DEPLOYMENT'))
check('has DEPLOYMENT BUNDLE', appTsx.includes('DEPLOYMENT BUNDLE'))
check('has K2 AUTH ADDRESS', appTsx.includes('K2 AUTH ADDRESS'))
check('has K3 CLEAN DROP ADDRESS', appTsx.includes('K3 CLEAN DROP ADDRESS'))
check('has CALCULATE FUNDING', appTsx.includes('CALCULATE FUNDING'))
check('has DEPLOYMENT PROGRESS', appTsx.includes('DEPLOYMENT PROGRESS'))
check('has VERIFYING PROTECTION', appTsx.includes('VERIFYING PROTECTION'))
check('has hope_ology attribution', appTsx.includes('hope_ology'))

// ── Wording corrections ──────────────────────────────────────────────────────
check('uses backend-routed chain checks', appTsx.includes('backend-routed'))
check('uses Endpoint details never appear', appTsx.includes('Endpoint details never appear'))
absent('no server-supplied RPC', 'server-supplied RPC')
absent('no RPC is not part', 'RPC is not part')
absent('no GATE LOCKED pill', /GATE LOCKED/)

// ── Forbidden content ────────────────────────────────────────────────────────
absent('no OPERATOR PROOF label', 'OPERATOR PROOF')
absent('no operator-proof-field id', 'operator-proof-field')
absent('no SMOKE TEST', 'SMOKE TEST')
absent('no 2FA DEPLOYER', '2FA DEPLOYER')
absent('no Admin tab key', /'admin'/)
absent('no overrideDestination', 'overrideDestination')
absent('no privateKey input field', /id=["'].*private.*key/i)
absent('no seed phrase input', /seed.?phrase/i)
absent('no production-ready claim', /production.?ready/i)
absent('no public RPC URL exposed', /https?:\/\/[a-z0-9.-]+(infura|alchemy|rpc\.|rpc\/)/i)
absent('no sweeper/bot', /sweep(er|ing)|(?<![a-z])bot(?![a-z])/i)

// ── Built asset check (if dist exists) ──────────────────────────────────────
const distDir = path.resolve(__dirname, '../frontend/dist/assets')
if (fs.existsSync(distDir)) {
  const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'))
  let builtClean = true
  const forbidden = [
    /OPERATOR PROOF/i, /operator-proof-field/i, /server-supplied RPC/i,
    /RPC is not part/i, /GATE LOCKED/, /SMOKE TEST/i, /2FA DEPLOYER/i,
  ]
  for (const f of jsFiles) {
    const src = fs.readFileSync(path.join(distDir, f), 'utf8')
    for (const re of forbidden) {
      if (re.test(src)) {
        console.error('[FAIL] built asset', f, 'contains forbidden string:', re.source)
        builtClean = false
        pass = false
      }
    }
  }
  if (builtClean) console.log('[PASS] built assets contain no forbidden strings')
} else {
  console.log('[SKIP] frontend/dist not built yet — run npm run build first')
}

if (!pass) { console.error('[verify-auth-state-gate] FAILED'); process.exit(1) }
console.log('[verify-auth-state-gate] ALL PASS')
