#!/usr/bin/env node
'use strict';

// verify-obfuscation-ci.cjs — obfuscation-equivalence CI gate.
//
// If the project has an obfuscation build configured, this proves source/build
// token equivalence under Node 24 and asserts no fake txHash / verified:true /
// signedTx:"0x00" were introduced and that canonical ABI strings are preserved.
//
// If NO obfuscated build exists, it prints exactly:
//   SKIPPED: no obfuscated build configured
// and does NOT claim obfuscation CI complete.
//
// Run: scripts/with-node24.sh node scripts/verify-obfuscation-ci.cjs

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; } }

// An obfuscation build is "configured" only if BOTH a tool and an output/script
// exist. A token-guard verifier alone does not count as an obfuscated build.
function detectObfuscation() {
  const fe = readJson(path.join(ROOT, 'frontend', 'package.json'));
  const be = readJson(path.join(ROOT, 'backend', 'package.json'));
  const deps = {
    ...fe.dependencies, ...fe.devDependencies, ...be.dependencies, ...be.devDependencies,
  };
  const tool = ['javascript-obfuscator', 'terser-obfuscate', 'webpack-obfuscator']
    .find((d) => Object.prototype.hasOwnProperty.call(deps, d));
  const scripts = { ...(fe.scripts || {}), ...(be.scripts || {}) };
  const script = Object.entries(scripts).find(([k, v]) => /obfuscat/i.test(k) || /obfuscat/i.test(String(v)));
  const outputs = ['live', 'frontend/dist-obf', 'dist-obfuscated']
    .map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(d));
  const configured = !!tool && (!!script || outputs.length > 0);
  return { configured, tool: tool || null, script: script ? script[0] : null, outputs };
}

(async () => {
  const det = detectObfuscation();
  if (!det.configured) {
    console.log('SKIPPED: no obfuscated build configured');
    console.log('(A token-equivalence guard exists at backend/scripts/obfuscation-equivalence.cjs, ' +
      'but no obfuscation TOOL + build output is configured, so obfuscation CI is not claimed complete.)');
    process.exit(0);
  }

  // Obfuscation IS configured — run the equivalence guard and drift checks.
  let passed = 0, failed = 0;
  const pass = (m) => { passed++; console.log('PASS ' + m); };
  const fail = (m, d) => { failed++; console.log('FAIL ' + m + (d ? ' :: ' + d : '')); };

  console.log(`obfuscation tool: ${det.tool}; script: ${det.script}; outputs: ${det.outputs.join(', ') || 'none'}`);
  const res = spawnSync(process.execPath, ['scripts/obfuscation-equivalence.cjs'],
    { cwd: path.join(ROOT, 'backend'), encoding: 'utf8' });
  console.log(res.stdout || '');
  if (res.status === 0) pass('token equivalence preserved through obfuscation');
  else fail('token equivalence', (res.stderr || '').slice(0, 200));

  // No fake markers introduced by the obfuscated output.
  for (const dir of det.outputs) {
    const files = [];
    (function walk(d) {
      for (const n of fs.readdirSync(d)) {
        if (n === 'node_modules') continue;
        const p = path.join(d, n);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(js|cjs|mjs|ts|tsx|html|json)$/.test(n)) files.push(p);
      }
    })(dir);
    const blob = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    if (/verified:\s*true|signedTx:\s*["']0x00["']|txHash:\s*["']pending["']/.test(blob)) {
      fail(`no fake markers in ${dir}`);
    } else pass(`no fake txHash/verified/signedTx in ${dir}`);
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
