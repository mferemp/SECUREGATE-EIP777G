#!/usr/bin/env node
'use strict';

// verify-no-drift.cjs — asserts the SecureGate source has not drifted from the
// canonical rules, with emphasis on the K2 / intent-hash layer. Complements the
// backend drift-scan.cjs. Run:  scripts/with-node24.sh node scripts/verify-no-drift.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const F = (...p) => path.join(ROOT, ...p);
const read = (p) => fs.readFileSync(p, 'utf8');

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e.message }); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

const intentHashSrc = read(F('frontend', 'src', 'lib', 'securegateIntentHash.ts'));
const k2Src = read(F('frontend', 'src', 'lib', 'securegateK2Authorization.ts'));
const txSrc = read(F('frontend', 'src', 'lib', 'securegateTxBuilder.ts'));
const appSrc = read(F('frontend', 'src', 'App.tsx'));
const deploySrc = read(F('backend', 'routes', 'deploy.js'));
const contractSrc = read(F('contracts', 'SecureGate.sol'));

// 1. Canonical type strings in the JS helpers must match the contract EXACTLY.
// The helpers assemble the literal across concatenated string chunks; join them
// (remove `' + '` splices) before comparing so a real drift can't hide.
const joinLiterals = (s) => s.replace(/'\s*\+\s*'/g, '').replace(/'\s*\+\s*\n\s*'/g, '');
const intentHashJoined = joinLiterals(intentHashSrc);
const k2Joined = joinLiterals(k2Src);
check('ACTION type string matches contract', () => {
  const s = 'SecureGateAction(uint8 kind,address token,uint256 id,uint256 amount,address k3,bytes32 nonce,uint256 deadline,uint256 chainId,address verifyingContract)';
  assert(contractSrc.includes(s), 'contract missing ACTION type string');
  assert(intentHashJoined.includes(s), 'intentHash helper missing ACTION type string');
});
check('AUTHORIZE type string matches contract', () => {
  const s = 'AuthorizeIntent(bytes32 intentHash,uint256 deadline,bytes32 nonce,address k3,uint256 chainId,address verifyingContract)';
  assert(contractSrc.includes(s), 'contract missing AUTHORIZE type string');
  assert(k2Joined.includes(s), 'K2 helper missing AUTHORIZE type string');
});
check('EIP-712 domain is SecureGate / version 1', () => {
  assert(/name:\s*'SecureGate'/.test(k2Src) && /version:\s*'1'/.test(k2Src), 'domain drift in K2 helper');
  assert(contractSrc.includes('bytes("SecureGate")') && contractSrc.includes('bytes("1")'), 'domain drift in contract');
});

// 2. The helpers must import ONLY ethers (no relative deep imports that could
//    smuggle key material or network I/O). A type-only import of QueueKind is ok.
check('helpers import only ethers (+ type QueueKind)', () => {
  for (const [label, src] of [['intentHash', intentHashSrc], ['k2', k2Src]]) {
    const imports = [...src.matchAll(/^import\s.*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    for (const spec of imports) {
      const ok = spec === 'ethers' || spec === './securegateTxBuilder';
      assert(ok, `${label} imports disallowed module: ${spec}`);
    }
  }
});

// 3. No server-side K2 signing and no key material accepted by the backend.
check('deploy route rejects k2SessionKey + all key fields', () => {
  assert(deploySrc.includes("'k2SessionKey'"), 'deploy.js must list k2SessionKey as forbidden');
  assert(deploySrc.includes("'k1SessionKey'") && deploySrc.includes("'privateKey'"), 'deploy.js key list incomplete');
});
check('no signTypedData / private-key signing in backend runtime', () => {
  const backendDir = F('backend');
  // Scope: the production backend RUNTIME (routes, lib, server.js, middleware).
  // Proof harnesses under backend/scripts/** spin up a local anvil chain and must
  // sign with anvil dev keys to emit events for the verifier — they are the same
  // category as scripts/e2e-local-securegate.cjs and are NOT server-side runtime.
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return (e.name === 'node_modules' || e.name === 'scripts') ? [] : walk(p);
    return p.endsWith('.js') || p.endsWith('.cjs') ? [p] : [];
  });
  for (const p of walk(backendDir)) {
    const src = read(p);
    assert(!/signTypedData/.test(src), `backend runtime performs typed-data signing in ${p}`);
    assert(!/new\s+ethers\.Wallet\(/.test(src), `backend runtime instantiates a Wallet in ${p}`);
  }
});

// 4. Forbidden old ABI must not be referenced anywhere in the new helpers/UI.
check('no forbidden old-ABI method names in helpers/UI', () => {
  for (const bad of ['queueIntent', 'forwardERC20', 'computeEIP712Digest', 'domainSeparator']) {
    for (const [label, src] of [['intentHash', intentHashSrc], ['k2', k2Src], ['app', appSrc]]) {
      assert(!src.includes(bad), `${label} references forbidden ABI ${bad}`);
    }
  }
});

// 5. The K2 helper must never accept/hold a raw private key.
check('K2 helper never reads a k2 private key', () => {
  assert(!/k2Key|k2PrivateKey|k2SessionKey/.test(k2Src), 'K2 helper references a K2 key field');
  assert(/signTypedData/.test(k2Src), 'K2 helper must delegate signing to an injected wallet');
});

// 6. UI must not request the K2/K3 private key (only addresses + a pasted sig).
check('UI collects K2 signature + addresses, not K2/K3 keys', () => {
  assert(appSrc.includes('authK2Signature') && appSrc.includes('authK2Expected'), 'K2 sig/address wiring missing');
  assert(!/setK2SessionKey|k2SessionKey/.test(appSrc), 'UI references a K2 session key');
});

// 7. All-zero 65-byte signature is explicitly rejected.
check('K2 helper rejects the all-zero signature', () => {
  assert(/all-zero/.test(k2Src) && /0x0\+/.test(k2Src), 'K2 helper lacks all-zero signature rejection');
});

// ---------------------------------------------------------------------------
// 8. Active-source drift scan with classification.
//    Scans active source only; every forbidden hit must be classifiable as a
//    rejection list / verifier assertion / test / docs warning, else it is
//    ACTIVE DRIFT and fails the run.
const SCAN_DIRS = ['contracts', 'test', 'script', 'scripts', 'backend', 'frontend/src', 'docs'];
const SCAN_FILES = ['README.md'];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.vulcan']);

function collectFiles() {
  const out = [];
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isFile()) { out.push(p); return; }
    for (const name of fs.readdirSync(p)) {
      if (EXCLUDE_DIRS.has(name)) continue;
      walk(path.join(p, name));
    }
  };
  SCAN_DIRS.forEach((d) => walk(F(d)));
  SCAN_FILES.forEach((f) => walk(F(f)));
  return out.filter((p) => /\.(sol|ts|tsx|js|cjs|jsx|md|txt|json|sh)$/.test(p) && !/package-lock\.json|bun\.lock/.test(p));
}

// Forbidden markers (assembled so this scanner file is not itself a hit).
const FORBIDDEN_PATTERNS = [
  'queue' + 'Intent', 'forward' + 'ERC20', 'compute' + 'EIP712Digest', 'domain' + 'Separator',
  'operator-' + 'proof-input', 'submit' + 'RevokeBundle', 'submit-' + 'revoke-bundle',
  'get' + 'OperatorProof', '/api/' + 'recovery/execute', 'OPERATOR_' + 'VEIL_PHRASE',
  'X-' + 'Operator-Proof', 'Flash' + 'bots', 'sweep' + 'er', 'smoke ' + 'test', 'SMOKE ' + 'TEST',
  'DEPLOYMENT ' + 'BUNDLE', 'override' + 'Destination', 'override' + 'Dest', 'k2' + 'OverrideDest',
  'EIP-712 ' + 'SecureGate', 'EIP-712 ' + 'recovery protocol', 'EIP-712 ' + 'project',
  'EIP-712 ' + 'architecture', 'EIP-712 ' + 'invention',
];

// A line is an ALLOWED (classified) hit if its file or the line itself is clearly
// a rejection list, verifier assertion, test, or docs warning.
const ALLOW_FILE = /(verify-no-drift|verify-|drift-scan|obfuscation-equivalence|selftest|address-guard|\.t\.sol$|docs\/|provenance\.md$|README\.md$)/;
const ALLOW_LINE = /forbidden|FORBIDDEN|reject|Reject|must never|do not|Do not|Do NOT|not merge|quarantine|stale|warning|assert|classif|placeholder|separate and|never (become|request|leave|entered)|only as a|typed-data signature mechanism/i;

check('active-source drift scan (all hits classified)', () => {
  const files = collectFiles();
  const unclassified = [];
  const classified = [];
  for (const p of files) {
    const rel = path.relative(ROOT, p);
    const lines = read(p).split('\n');
    lines.forEach((line, i) => {
      for (const pat of FORBIDDEN_PATTERNS) {
        if (line.includes(pat)) {
          const rec = { rel, ln: i + 1, pat, line: line.trim().slice(0, 120) };
          // A hit is classified (allowed) if the file/line is a rejection/verifier/
          // docs context, OR it sits inside a FORBIDDEN_* rejection block (look back).
          const back = lines.slice(Math.max(0, i - 12), i).join('\n');
          const inForbiddenBlock = /FORBIDDEN|forbidden/.test(back);
          if (ALLOW_FILE.test(rel) || ALLOW_LINE.test(line) || inForbiddenBlock) classified.push(rec);
          else unclassified.push(rec);
        }
      }
    });
  }
  // Print classification summary for the record.
  process.stdout.write(`    [scan] ${files.length} active files, ${classified.length} classified hits, ${unclassified.length} unclassified\n`);
  if (unclassified.length) {
    for (const u of unclassified) process.stdout.write(`      ACTIVE-DRIFT ${u.rel}:${u.ln} [${u.pat}] ${u.line}\n`);
    throw new Error(`${unclassified.length} unclassified active-drift hit(s)`);
  }
});

// 9. Provenance drift: active source must not present SecureGate as an EIP-712
//    project/architecture/invention outside of an explicit rejection/warning.
check('no active provenance drift (SecureGate is not an EIP-712 project)', () => {
  const files = collectFiles();
  const bad = [];
  for (const p of files) {
    const rel = path.relative(ROOT, p);
    const text = read(p);
    for (const phrase of ['EIP-712 SecureGate', 'EIP-712 recovery protocol', 'EIP-712 project', 'EIP-712 architecture', 'EIP-712 invention']) {
      if (text.includes(phrase) && !ALLOW_FILE.test(rel) && !/forbidden|Forbidden|reject|must never|Do not|incorrect/i.test(text)) {
        bad.push(`${rel} :: ${phrase}`);
      }
    }
  }
  assert(bad.length === 0, `provenance drift: ${bad.join('; ')}`);
});

// 10. Required provenance phrases exist in active docs.
check('required provenance wording present in active docs', () => {
  const corpus = [F('README.md'), F('docs', 'provenance.md')].filter(fs.existsSync).map(read).join('\n');
  for (const phrase of [
    'SecureGate / EIP-777G',
    'EIP-712 was not part of the original project framing',
    'introduced later only as a standard typed-data signature mechanism',
    'does not rename, replace, originate, or define SecureGate / EIP-777G',
  ]) {
    assert(corpus.includes(phrase), `missing provenance phrase: ${phrase}`);
  }
});

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.err}`);
  if (!r.ok) failed += 1;
}
console.log(`\nverify-no-drift: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
