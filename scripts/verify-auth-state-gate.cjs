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

// Locked state must-haves
check('has dashboardUnlocked state', appTsx.includes('dashboardUnlocked'))
check('has DASHBOARD LOCKED text', appTsx.includes('DASHBOARD LOCKED'))
check('has GENESIS OWNER AUTHENTICATION', appTsx.includes('GENESIS OWNER AUTHENTICATION'))
check('has AUTH-GATE section', appTsx.includes('AUTH-GATE'))
check('has STANDALONE OPERATION', appTsx.includes('STANDALONE OPERATION'))
check('has CAUTION block', appTsx.includes('CAUTION'))
check('has admin-black-circle button', appTsx.includes('admin-black-circle'))
check('has SCAN button', appTsx.includes('scan-authenticator') || appTsx.includes('scan-device') || appTsx.includes('SCAN'))
check('has LINK DEVICE button', appTsx.includes('LINK DEVICE') || appTsx.includes('link-device'))
check('has PASSKEY + ENTER', appTsx.includes('PASSKEY') && appTsx.includes('ENTER'))

// Unlocked must-haves
check('has EIP-777G DEPLOYMENT heading', appTsx.includes('EIP-777G DEPLOYMENT'))
check('has DEPLOYMENT BUNDLE', appTsx.includes('DEPLOYMENT BUNDLE'))
check('has K2 AUTH ADDRESS', appTsx.includes('K2 AUTH ADDRESS'))
check('has K3 CLEAN DROP ADDRESS', appTsx.includes('K3 CLEAN DROP ADDRESS'))
check('has CALCULATE FUNDING', appTsx.includes('CALCULATE FUNDING'))
check('has DEPLOYMENT PROGRESS', appTsx.includes('DEPLOYMENT PROGRESS'))
check('has VERIFYING PROTECTION', appTsx.includes('VERIFYING PROTECTION'))
check('has THANK YOU / BUILT BY EMP / hope_ology', appTsx.includes('hope_ology'))

// Wording corrections
check('uses backend-routed chain checks (not server-supplied RPC)', appTsx.includes('backend-routed'))
check('uses Endpoint details never appear (not RPC is not part)', appTsx.includes('Endpoint details never appear'))

// Forbidden content
absent('no SMOKE TEST wording', 'SMOKE TEST')
absent('no operator proof UI', 'OPERATOR PROOF')
absent('no 2FA DEPLOYER heading', '2FA DEPLOYER')
absent('no overrideDestination', 'overrideDestination')
absent('no privateKey field', /id=".*private.*key/i)
absent('no seed phrase field', /seed.?phrase/i)
absent('no Flashbots', 'Flashbots')
absent('no sweeper/bot', /sweep(er|ing)|bot\b/i)
absent('no production-ready claim', /production.?ready/i)
absent('no public RPC URL exposed', /https?:\/\/[a-z0-9.-]+(infura|alchemy|rpc\.|rpc\/)/i)

if (!pass) { console.error('[verify-auth-state-gate] FAILED'); process.exit(1) }
console.log('[verify-auth-state-gate] ALL PASS')
