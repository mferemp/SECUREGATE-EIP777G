'use strict'

// Verifies root package.json has required dev script and structure
const fs = require('fs')
const path = require('path')

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

let pass = true

function check(label, cond) {
  if (!cond) { console.error('[FAIL]', label); pass = false } else console.log('[PASS]', label)
}

check('name is securegate-eip777g-root', pkg.name === 'securegate-eip777g-root')
check('has scripts.dev', typeof pkg.scripts?.dev === 'string' && pkg.scripts.dev.includes('frontend'))
check('has scripts.build', typeof pkg.scripts?.build === 'string')
check('has scripts.verify', typeof pkg.scripts?.verify === 'string')
check('has express dependency', Boolean(pkg.dependencies?.express))

if (!pass) { console.error('[verify-root-dev] FAILED'); process.exit(1) }
console.log('[verify-root-dev] ALL PASS')
