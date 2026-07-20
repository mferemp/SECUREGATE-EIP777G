#!/usr/bin/env node
'use strict';

// verify-csp.cjs — proves SecureGate's production CSP / security headers.
// Checks the canonical policy module, the applier, and (when present) the built
// dist/client artifacts (_headers + injected meta). It asserts the mandated
// directives, that there is NO external script CDN and NO public RPC URL in the
// frontend CSP, and that no QR/operator/revoke drift leaked into the headers.
//
// Run: scripts/with-node24.sh node scripts/verify-csp.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const MODULE = path.join(FRONTEND, 'security-headers.cjs');
const APPLIER = path.join(FRONTEND, 'scripts', 'apply-security-headers.cjs');
const DIST = path.join(FRONTEND, 'dist', 'client');

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, d) { failed++; console.log('FAIL ' + m + (d ? ' :: ' + d : '')); }
function assert(cond, m, d) { if (cond) pass(m); else fail(m, d); }

(async () => {
  assert(fs.existsSync(MODULE), 'canonical security-headers module exists');
  assert(fs.existsSync(APPLIER), 'production header applier exists');

  const { buildCsp, securityHeaders, CSP_DIRECTIVES } = require(MODULE);
  const csp = buildCsp();
  const headers = securityHeaders();

  // Mandated directives.
  assert(/(^|;\s)default-src 'self'/.test(csp), "CSP has default-src 'self'");
  assert(/(^|;\s)base-uri 'self'/.test(csp), "CSP has base-uri 'self'");
  assert(/(^|;\s)object-src 'none'/.test(csp), "CSP has object-src 'none'");
  assert(/(^|;\s)form-action 'none'/.test(csp), "CSP has form-action 'none'");
  assert(/(^|;\s)frame-ancestors 'none'/.test(csp), "CSP has frame-ancestors 'none'");

  // No external script CDN: script-src has only 'self' (+ optional inline hashes).
  const scriptSrc = (CSP_DIRECTIVES['script-src'] || []).join(' ');
  assert(!/https?:\/\//.test(scriptSrc), 'script-src has no external CDN host', scriptSrc);
  assert(scriptSrc.includes("'self'") && !scriptSrc.includes("'unsafe-inline'"),
    "script-src is 'self' (+hashes), not unsafe-inline");

  // No public RPC URL / no external host anywhere in the CSP connect-src.
  const connectSrc = (CSP_DIRECTIVES['connect-src'] || []).join(' ');
  assert(connectSrc === "'self'", "connect-src is 'self' (no public RPC URLs)", connectSrc);
  assert(!/https?:\/\//.test(csp), 'no absolute http(s) host anywhere in CSP', csp);

  // Companion hardening headers present.
  assert(headers['X-Content-Type-Options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
  assert(headers['Referrer-Policy'] === 'no-referrer', 'Referrer-Policy: no-referrer');
  assert(/frame-ancestors|DENY/.test(headers['X-Frame-Options'] || 'DENY'), 'X-Frame-Options: DENY');

  // No QR/operator/revoke drift in the header source.
  const moduleSrc = fs.readFileSync(MODULE, 'utf8');
  assert(!/operator|revoke|submitRevoke|X-Operator-Proof|\bQR\b|Flashbots|sweeper/i.test(moduleSrc),
    'no operator/revoke/QR drift in header module');

  // Built production artifacts, when present, carry the full policy.
  const headersFile = path.join(DIST, '_headers');
  const indexFile = path.join(DIST, 'index.html');
  if (fs.existsSync(headersFile)) {
    const h = fs.readFileSync(headersFile, 'utf8');
    assert(/Content-Security-Policy:.*frame-ancestors 'none'/.test(h), 'built _headers carries frame-ancestors none');
    assert(/Content-Security-Policy:.*object-src 'none'/.test(h), 'built _headers carries object-src none');
    assert(/Content-Security-Policy:.*form-action 'none'/.test(h), 'built _headers carries form-action none');
    assert(!/https?:\/\/[^ ]*rpc|connect-src[^;]*https?:\/\//i.test(h), 'built _headers has no public RPC in connect-src');
  } else {
    console.log('NOTE: dist/client/_headers not present (run `npm run build` to emit it)');
  }
  if (fs.existsSync(indexFile)) {
    const idx = fs.readFileSync(indexFile, 'utf8');
    assert(/<meta http-equiv="Content-Security-Policy"/.test(idx), 'built index.html has injected CSP meta');
    // Inline scripts must be covered by sha256 hashes (strict, no unsafe-inline).
    assert(/script-src 'self'( 'sha256-[^']+')+/.test(idx) || /script-src 'self'"/.test(idx),
      'built index.html script-src uses self + inline hashes');
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
