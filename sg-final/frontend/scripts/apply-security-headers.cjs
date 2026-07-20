#!/usr/bin/env node
'use strict';

// apply-security-headers.cjs — production post-build step. It:
//   1. reads the built dist/client/index.html,
//   2. computes sha256 hashes of every inline <script> so a STRICT script-src
//      keeps the same-origin platform bootstrap scripts working (no unsafe-inline,
//      no external CDN),
//   3. writes dist/client/_headers with the full canonical security header set
//      (incl. frame-ancestors, which only works via an HTTP header),
//   4. injects a <meta http-equiv="Content-Security-Policy"> with the meta-safe
//      directives so the policy also travels with a statically-served file.
//
// Runs as `postbuild`. It is a no-op (with a notice) if dist/client is absent, so
// it never fails a build that hasn't produced client output.
//
// Run: node scripts/apply-security-headers.cjs   (from frontend/)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FRONTEND = path.resolve(__dirname, '..');
const DIST = path.join(FRONTEND, 'dist', 'client');
const INDEX = path.join(DIST, 'index.html');
const { CSP_DIRECTIVES, securityHeaders } = require(path.join(FRONTEND, 'security-headers.cjs'));

function inlineScriptHashes(html) {
  const hashes = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const body = m[1];
    if (!body) continue;
    const h = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${h}'`);
  }
  return hashes;
}

function buildCspWith(scriptSrcExtra) {
  const dirs = { ...CSP_DIRECTIVES };
  dirs['script-src'] = ["'self'", ...scriptSrcExtra];
  return Object.entries(dirs).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

function metaSafeCsp(fullCsp) {
  // frame-ancestors is ignored inside <meta>; strip it for the meta variant.
  return fullCsp
    .split('; ')
    .filter((d) => !/^frame-ancestors\b/.test(d))
    .join('; ');
}

function main() {
  if (!fs.existsSync(INDEX)) {
    console.log('apply-security-headers: dist/client/index.html not found — skipping (build client first)');
    return 0;
  }
  let html = fs.readFileSync(INDEX, 'utf8');
  const hashes = inlineScriptHashes(html);
  const fullCsp = buildCspWith(hashes);
  const headers = { ...securityHeaders(), 'Content-Security-Policy': fullCsp };

  // 1. _headers (static host header file) — carries the FULL policy.
  const headerLines = ['/*'];
  for (const [k, v] of Object.entries(headers)) headerLines.push(`  ${k}: ${v}`);
  fs.writeFileSync(path.join(DIST, '_headers'), headerLines.join('\n') + '\n');

  // 2. Inject/replace the meta CSP (meta-safe subset).
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${metaSafeCsp(fullCsp)}" />`;
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '');
  html = html.replace(/<head>/i, `<head>\n    ${metaTag}`);
  fs.writeFileSync(INDEX, html);

  console.log(`apply-security-headers: wrote dist/client/_headers and injected CSP meta (${hashes.length} inline script hashes)`);
  return 0;
}

process.exit(main());
