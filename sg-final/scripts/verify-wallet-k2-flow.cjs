#!/usr/bin/env node
'use strict';

// verify-wallet-k2-flow.cjs — proves the injected-provider (EIP-1193) K2 signing
// path against the REAL shipped TypeScript helpers under Node 24. Node 24 strips
// types natively so we import the actual browser modules (not re-implementations).
//
// Boundary proven:
//   * no injected provider  -> exact error `K2 signer not connected`
//   * injected signing path uses eth_signTypedData_v4 (key stays in wallet)
//   * the signed typed-data payload matches the canonical K2 helper byte-for-byte
//   * recovered signer == configured K2; wrong K2 / chainId / verifyingContract /
//     intentHash all rejected; empty + all-zero + malformed signatures rejected
//   * no K2 private-key field exists in the UI or backend payload
//   * pasted-signature fallback still verifies K2
//   * no server-side K2 signing anywhere
//
// Run: scripts/with-node24.sh node scripts/verify-wallet-k2-flow.cjs

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const K2_TS = path.join(FRONTEND, 'src', 'lib', 'securegateK2Authorization.ts');
const WALLET_TS = path.join(FRONTEND, 'src', 'lib', 'securegateWalletProvider.ts');
const APP_TSX = path.join(FRONTEND, 'src', 'App.tsx');
const BACKEND_ROUTES = path.join(ROOT, 'backend', 'routes');

const { ethers } = require(path.join(FRONTEND, 'node_modules', 'ethers'));

let passed = 0;
let failed = 0;
function pass(msg) { passed++; console.log('PASS ' + msg); }
function fail(msg, err) { failed++; console.log('FAIL ' + msg + (err ? ' :: ' + err.message : '')); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
async function check(msg, fn) { try { await fn(); pass(msg); } catch (e) { fail(msg, e); } }

// A mock EIP-1193 provider whose eth_signTypedData_v4 is backed by a REAL local
// wallet. This is the K2 wallet — its key lives ONLY inside this mock, never in
// the app helper. It mirrors how MetaMask/Rabby would answer the request.
function makeMockProvider(wallet, { account } = {}) {
  const addr = account || wallet.address;
  return {
    _calls: [],
    async request({ method, params }) {
      this._calls.push({ method, params });
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [addr];
      if (method === 'eth_signTypedData_v4') {
        const [from, json] = params;
        if (ethers.getAddress(from) !== ethers.getAddress(addr)) throw new Error('unknown account');
        const typed = JSON.parse(json);
        const { EIP712Domain, ...types } = typed.types;
        // Sign the EXACT payload the app serialized — proves parity end to end.
        return wallet.signTypedData(typed.domain, types, typed.message);
      }
      throw new Error('method not mocked: ' + method);
    },
  };
}

(async () => {
  const K2W = require(path.join(FRONTEND, 'node_modules', 'ethers'));
  const K2 = await import(K2_TS);
  const WP = await import(WALLET_TS);

  // Canonical params (a realistic queued intent authorization).
  const gate = ethers.getAddress('0x' + 'ab'.repeat(20));
  const k3 = ethers.getAddress('0x' + '33'.repeat(20));
  const chainId = 31337;
  const params = {
    intentHash: ethers.keccak256(ethers.toUtf8Bytes('intent-1')),
    deadline: Math.floor(Date.now() / 1000) + 3600,
    nonce: ethers.hexlify(ethers.randomBytes(32)),
    k3,
    chainId,
    verifyingContract: gate,
  };

  const k2Wallet = ethers.Wallet.createRandom();
  const K2_ADDR = k2Wallet.address;

  // 1. No injected provider -> honest `K2 signer not connected`.
  await check('provider unavailable returns K2 signer not connected', async () => {
    assert(WP.hasInjectedProvider(null) === false, 'null provider should be unavailable');
    const signer = WP.injectedSignTypedData(K2_ADDR, null);
    let threw = null;
    try { await signer(params, {}, {}); } catch (e) { threw = e; }
    assert(threw && threw.message === WP.K2_NOT_CONNECTED, 'expected exact K2_NOT_CONNECTED');
    assert(WP.K2_NOT_CONNECTED === 'K2 signer not connected', 'exact string');
    let threw2 = null;
    try { await WP.connectInjectedK2(null); } catch (e) { threw2 = e; }
    assert(threw2 && threw2.message === 'K2 signer not connected', 'connect should reject honestly');
  });

  // 2. Injected typed-data signing path verifies K2 (full parity).
  let injectedSig = null;
  await check('injected typed-data signing path verifies K2', async () => {
    const mock = makeMockProvider(k2Wallet);
    const from = await WP.connectInjectedK2(mock);
    assert(from === K2_ADDR, 'connected account must equal K2');
    const signFn = WP.injectedSignTypedData(from, mock);
    injectedSig = await K2.signK2Authorization(params, signFn);
    assert(/^0x[0-9a-fA-F]{130}$/.test(injectedSig), 'must be 65-byte sig');
    // The wallet was actually asked to sign typed data — no key ever left it.
    assert(mock._calls.some((c) => c.method === 'eth_signTypedData_v4'), 'must call eth_signTypedData_v4');
    const { valid, recovered } = K2.verifyK2AuthorizationSignature(params, injectedSig, K2_ADDR);
    assert(valid && recovered === K2_ADDR, 'must recover to K2');
  });

  // 3. Payload parity: what the wallet signed == canonical helper digest.
  await check('injected payload matches canonical K2 helper digest', async () => {
    let capturedJson = null;
    const capturing = {
      async request({ method, params: p }) {
        if (method === 'eth_signTypedData_v4') { capturedJson = p[1]; return k2Wallet.signTypedData(
          JSON.parse(p[1]).domain,
          (() => { const { EIP712Domain, ...t } = JSON.parse(p[1]).types; return t; })(),
          JSON.parse(p[1]).message,
        ); }
        throw new Error('nope');
      },
    };
    const signFn = WP.injectedSignTypedData(K2_ADDR, capturing);
    const sig = await K2.signK2Authorization(params, signFn);
    const typed = JSON.parse(capturedJson);
    const { EIP712Domain, ...types } = typed.types;
    const walletDigest = ethers.TypedDataEncoder.hash(typed.domain, types, typed.message);
    const canonicalDigest = K2.authorizationDigest(params);
    assert(walletDigest === canonicalDigest, 'wallet-signed digest must equal canonical digest');
    const { valid } = K2.verifyK2AuthorizationSignature(params, sig, K2_ADDR);
    assert(valid, 'captured-path sig must verify');
  });

  // 4. Pasted-signature fallback still verifies K2 (independent of provider).
  await check('pasted signature fallback verifies K2', async () => {
    const { EIP712Domain, ...types } = {
      EIP712Domain: null,
      AuthorizeIntent: K2.buildAuthorizationTypedData(params).types.AuthorizeIntent,
    };
    const td = K2.buildAuthorizationTypedData(params);
    const pasted = await k2Wallet.signTypedData(td.domain, td.types, td.message);
    const { valid, recovered } = K2.verifyK2AuthorizationSignature(params, pasted, K2_ADDR);
    assert(valid && recovered === K2_ADDR, 'pasted sig must verify to K2');
  });

  // 5. Wrong K2 rejected.
  await check('wrong K2 rejected', async () => {
    const other = ethers.Wallet.createRandom().address;
    const { valid } = K2.verifyK2AuthorizationSignature(params, injectedSig, other);
    assert(valid === false, 'must not validate against wrong K2');
  });

  // 6. Wrong chainId rejected.
  await check('wrong chainId rejected', async () => {
    const { valid } = K2.verifyK2AuthorizationSignature({ ...params, chainId: 1 }, injectedSig, K2_ADDR);
    assert(valid === false, 'wrong chainId must not validate');
  });

  // 7. Wrong verifyingContract rejected.
  await check('wrong verifyingContract rejected', async () => {
    const { valid } = K2.verifyK2AuthorizationSignature(
      { ...params, verifyingContract: ethers.getAddress('0x' + 'cd'.repeat(20)) },
      injectedSig,
      K2_ADDR,
    );
    assert(valid === false, 'wrong verifyingContract must not validate');
  });

  // 8. Wrong intentHash rejected.
  await check('wrong intentHash rejected', async () => {
    const { valid } = K2.verifyK2AuthorizationSignature(
      { ...params, intentHash: ethers.keccak256(ethers.toUtf8Bytes('other')) },
      injectedSig,
      K2_ADDR,
    );
    assert(valid === false, 'wrong intentHash must not validate');
  });

  // 9. Empty signature rejected.
  await check('empty signature rejected', async () => {
    let threw = null;
    try { K2.verifyK2AuthorizationSignature(params, '', K2_ADDR); } catch (e) { threw = e; }
    assert(threw, 'empty signature must throw');
  });

  // 10. All-zero 65-byte signature rejected.
  await check('all-zero signature rejected', async () => {
    let threw = null;
    try { K2.verifyK2AuthorizationSignature(params, '0x' + '00'.repeat(65), K2_ADDR); } catch (e) { threw = e; }
    assert(threw && /all-zero/.test(threw.message), 'all-zero must throw');
  });

  // 11. Malformed signature rejected.
  await check('malformed signature rejected', async () => {
    let threw = null;
    try { K2.verifyK2AuthorizationSignature(params, '0xdeadbeef', K2_ADDR); } catch (e) { threw = e; }
    assert(threw, 'malformed must throw');
  });

  // 12. No K2 private-key field exists in UI or backend payloads.
  await check('no K2 private key enters payload', async () => {
    const app = fs.readFileSync(APP_TSX, 'utf8');
    const wallet = fs.readFileSync(WALLET_TS, 'utf8');
    // Strip comments so we scan actual code, not the security prose in comments.
    const walletCode = wallet.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // The injected path must only ever call eth_signTypedData_v4 / requestAccounts.
    assert(/eth_signTypedData_v4/.test(walletCode), 'must use eth_signTypedData_v4');
    assert(!/new\s+ethers\.Wallet\s*\(|\.privateKey|k2Key|eth_sign(?!TypedData)/.test(walletCode), 'no key material handled in wallet bridge code');
    // No K2 private key input in the app UI.
    assert(!/k2[-_]?private|k2Key|k2PrivateKey/i.test(app), 'no K2 private key field in UI');
    // Scan backend routes: nothing accepts a K2 key nor signs as K2.
    for (const f of fs.readdirSync(BACKEND_ROUTES)) {
      if (!/\.(js|cjs)$/.test(f)) continue;
      const t = fs.readFileSync(path.join(BACKEND_ROUTES, f), 'utf8');
      assert(!/signTypedData|_signTypedData|new\s+ethers\.Wallet\s*\(/.test(t), `no K2 signing in backend/routes/${f}`);
    }
  });

  // 13. No server-side K2 signing anywhere in backend source.
  await check('no server-side K2 signing', async () => {
    const backendDir = path.join(ROOT, 'backend');
    const hits = [];
    (function walk(d) {
      for (const name of fs.readdirSync(d)) {
        if (name === 'node_modules') continue;
        const p = path.join(d, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(js|cjs|ts)$/.test(name)) {
          const t = fs.readFileSync(p, 'utf8');
          if (/signTypedData\s*\(|_signTypedData\s*\(/.test(t) && !/verify-|scripts\//.test(p)) hits.push(p);
        }
      }
    })(backendDir);
    assert(hits.length === 0, 'server-side signTypedData found: ' + hits.join(', '));
  });

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
