#!/usr/bin/env node
'use strict';

// verify-k2-intent-builders.cjs — proves the REAL frontend helpers produce a
// client-side intent hash and EIP-712 authorization digest that are byte-for-byte
// identical to the canonical SecureGate contract, on a live local EVM.
//
// It:
//   * imports the ACTUAL TypeScript helpers (Node 24 strips types) — not copies:
//       frontend/src/lib/securegateIntentHash.ts       (computeClientIntentHash)
//       frontend/src/lib/securegateK2Authorization.ts   (EIP-712 build/verify)
//       frontend/src/lib/securegateTxBuilder.ts         (encodeAuthorizeIntent)
//   * spins up anvil, deploys the canonical Foundry bytecode,
//   * queues ERC20/721/1155 intents and compares computeClientIntentHash()
//     against the on-chain computeIntentHash() view,
//   * compares the ethers EIP-712 digest against the on-chain
//     computeAuthorizationDigest(),
//   * has the K2 anvil wallet sign the typed data, verifies it client-side,
//     and submits authorizeIntent() to prove the contract accepts it,
//   * exercises the negative cases (wrong signer / chainId / verifyingContract /
//     intentHash / empty / all-zero signature).
//
// Run:  scripts/with-node24.sh node scripts/verify-k2-intent-builders.cjs

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const ARTIFACT = path.join(ROOT, 'out', 'SecureGate.sol', 'SecureGate.json');
const ANVIL = path.join(process.env.HOME || '/root', '.foundry', 'bin', 'anvil');
const PORT = 8600 + (process.pid % 300);
const RPC = `http://127.0.0.1:${PORT}`;

const { ethers } = require(path.join(FRONTEND, 'node_modules', 'ethers'));

// Deterministic anvil dev accounts (public, well-known — test only).
const PK = {
  k1: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  k2: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  k3: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
};

const results = [];
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e.message }); }
}
function expectThrow(fn, re) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  assert(threw, 'expected throw, got none');
  if (re) assert(re.test(threw.message), `msg ${JSON.stringify(threw.message)} !~ ${re}`);
}
const KIND = { ERC20: 0, ERC721: 1, ERC1155: 2 };

function waitForRpc(provider, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try { await provider.getBlockNumber(); resolve(); }
      catch (e) { if (--tries <= 0) reject(new Error('anvil did not become ready')); else setTimeout(tick, 250); }
    };
    tick();
  });
}

(async () => {
  assert(fs.existsSync(ARTIFACT), `missing canonical artifact: ${ARTIFACT}`);
  assert(fs.existsSync(ANVIL), `anvil not found at ${ANVIL}`);
  const art = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  const abi = art.abi;
  const bytecode = art.bytecode.object || art.bytecode;

  // Import the REAL shipped helpers.
  const IH = await import(path.join(FRONTEND, 'src', 'lib', 'securegateIntentHash.ts'));
  const K2A = await import(path.join(FRONTEND, 'src', 'lib', 'securegateK2Authorization.ts'));
  const TX = await import(path.join(FRONTEND, 'src', 'lib', 'securegateTxBuilder.ts'));

  const anvil = spawn(ANVIL, ['--silent', '--port', String(PORT)], { stdio: ['ignore', 'ignore', 'inherit'] });
  let exited = false;
  anvil.on('exit', () => { exited = true; });
  const cleanup = () => { if (!exited) try { anvil.kill('SIGKILL'); } catch (_) {} };
  process.on('exit', cleanup);

  try {
    await new Promise((r) => setTimeout(r, 1500));
    const provider = new ethers.JsonRpcProvider(RPC);
    await waitForRpc(provider);
    const net = await provider.getNetwork();
    const chainId = Number(net.chainId);

    const w1 = new ethers.Wallet(PK.k1, provider);
    const w2 = new ethers.Wallet(PK.k2, provider);
    const w3 = new ethers.Wallet(PK.k3, provider);
    const K1 = w1.address, K2 = w2.address, K3 = w3.address;
    // K1 sends multiple sequential txs (deploy, queue, authorize) — a NonceManager
    // keeps the nonce monotonic without racing provider.getTransactionCount.
    const m1 = new ethers.NonceManager(w1);

    // Deploy the canonical bytecode.
    const factory = new ethers.ContractFactory(abi, bytecode, m1);
    const gate = await factory.deploy(K1, K2, K3);
    await gate.waitForDeployment();
    const gateAddr = await gate.getAddress();

    await check('anvil chainId matches contract GATE_CHAIN_ID', async () => {
      const onchain = await gate.GATE_CHAIN_ID();
      assert(Number(onchain) === chainId, `GATE_CHAIN_ID ${onchain} != anvil ${chainId}`);
    });

    const TOKEN = ethers.getAddress('0x' + 'ab'.repeat(20));
    const cases = [
      { assetType: 'ERC20', token: TOKEN, tokenId: '0', amount: '1000000000000000000' },
      { assetType: 'ERC721', token: TOKEN, tokenId: '7', amount: '1' },
      { assetType: 'ERC1155', token: TOKEN, tokenId: '42', amount: '5' },
    ];

    for (const c of cases) {
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // id/amount normalised the same way the helper does, for the view call.
      const id = c.assetType === 'ERC20' ? 0n : BigInt(c.tokenId);
      const amount = c.assetType === 'ERC721' ? 1n : BigInt(c.amount);

      const clientHash = IH.computeClientIntentHash({
        assetType: c.assetType, token: c.token, tokenId: c.tokenId, amount: c.amount,
        nonce, deadline, k3: K3, chainId, verifyingContract: gateAddr,
      });

      await check(`${c.assetType}: client intentHash == on-chain computeIntentHash`, async () => {
        const onchain = await gate.computeIntentHash(KIND[c.assetType], c.token, id, amount, nonce, deadline);
        assert(onchain.toLowerCase() === clientHash.toLowerCase(),
          `client ${clientHash} != onchain ${onchain}`);
      });

      // Queue the intent on-chain so computeAuthorizationDigest can be called.
      if (c.assetType === 'ERC20') await (await gate.connect(m1).queueERC20(c.token, amount, nonce, deadline)).wait();
      else if (c.assetType === 'ERC721') await (await gate.connect(m1).queueERC721(c.token, id, nonce, deadline)).wait();
      else await (await gate.connect(m1).queueERC1155(c.token, id, amount, nonce, deadline)).wait();

      const authParams = { intentHash: clientHash, deadline, nonce, k3: K3, chainId, verifyingContract: gateAddr };

      await check(`${c.assetType}: EIP-712 digest == on-chain computeAuthorizationDigest`, async () => {
        const clientDigest = K2A.authorizationDigest(authParams);
        const onchain = await gate.computeAuthorizationDigest(clientHash);
        assert(onchain.toLowerCase() === clientDigest.toLowerCase(),
          `client digest ${clientDigest} != onchain ${onchain}`);
      });

      // K2 signs the typed data (private key stays in the anvil wallet object).
      const td = K2A.buildAuthorizationTypedData(authParams);
      const sig = await w2.signTypedData(td.domain, td.types, td.message);

      await check(`${c.assetType}: client verify recovers K2`, async () => {
        const { valid, recovered } = K2A.verifyK2AuthorizationSignature(authParams, sig, K2);
        assert(valid && recovered.toLowerCase() === K2.toLowerCase(), `recovered ${recovered} != K2 ${K2}`);
      });

      await check(`${c.assetType}: contract accepts authorizeIntent with the K2 sig`, async () => {
        const data = TX.encodeAuthorizeIntent(abi, clientHash, sig);
        const sel = new ethers.Interface(abi).getFunction('authorizeIntent').selector;
        assert(data.startsWith(sel), 'authorizeIntent selector mismatch');
        await (await m1.sendTransaction({ to: gateAddr, data })).wait();
        const intent = await gate.intents(clientHash);
        assert(intent.authorized === true, 'intent not authorized on-chain');
      });

      // ---- negative cases (client-side rejection) ----
      await check(`${c.assetType}: wrong expected-K2 => valid=false`, async () => {
        const { valid } = K2A.verifyK2AuthorizationSignature(authParams, sig, K3);
        assert(valid === false, 'wrong K2 should not verify');
      });
      await check(`${c.assetType}: wrong chainId => not K2`, async () => {
        const { valid } = K2A.verifyK2AuthorizationSignature({ ...authParams, chainId: chainId + 1 }, sig, K2);
        assert(valid === false, 'wrong chainId should not recover K2');
      });
      await check(`${c.assetType}: wrong verifyingContract => not K2`, async () => {
        const bogus = ethers.getAddress('0x' + 'cd'.repeat(20));
        const { valid } = K2A.verifyK2AuthorizationSignature({ ...authParams, verifyingContract: bogus }, sig, K2);
        assert(valid === false, 'wrong verifyingContract should not recover K2');
      });
      await check(`${c.assetType}: wrong intentHash => not K2`, async () => {
        const other = ethers.hexlify(ethers.randomBytes(32));
        const { valid } = K2A.verifyK2AuthorizationSignature({ ...authParams, intentHash: other }, sig, K2);
        assert(valid === false, 'wrong intentHash should not recover K2');
      });
    }

    // ---- signature-shape rejections (no chain needed) ----
    const p = { intentHash: '0x' + '11'.repeat(32), deadline: 9999999999, nonce: '0x' + '22'.repeat(32), k3: K3, chainId, verifyingContract: gateAddr };
    await check('rejects empty signature', () => {
      expectThrow(() => K2A.verifyK2AuthorizationSignature(p, '0x', K2), /65-byte/);
    });
    await check('rejects all-zero 65-byte signature', () => {
      expectThrow(() => K2A.verifyK2AuthorizationSignature(p, '0x' + '00'.repeat(65), K2), /all-zero/);
    });
    await check('rejects malformed-length signature', () => {
      expectThrow(() => K2A.verifyK2AuthorizationSignature(p, '0x1234', K2), /65-byte/);
    });
    await check('computeClientIntentHash rejects zero token', () => {
      expectThrow(() => IH.computeClientIntentHash({ ...p, assetType: 'ERC20', token: ethers.ZeroAddress, amount: '1' }), /token/);
    });
    await check('computeClientIntentHash rejects zero verifyingContract', () => {
      expectThrow(() => IH.computeClientIntentHash({ assetType: 'ERC20', token: '0x' + 'ab'.repeat(20), amount: '1', nonce: p.nonce, deadline: p.deadline, k3: K3, chainId, verifyingContract: ethers.ZeroAddress }), /verifyingContract/);
    });
    await check('ACTION_TYPEHASH matches contract type string', () => {
      const expected = ethers.keccak256(ethers.toUtf8Bytes(
        'SecureGateAction(uint8 kind,address token,uint256 id,uint256 amount,address k3,bytes32 nonce,uint256 deadline,uint256 chainId,address verifyingContract)'));
      assert(IH.ACTION_TYPEHASH === expected, 'ACTION_TYPEHASH drift');
    });
    await check('AUTHORIZE_TYPEHASH matches contract type string', () => {
      const expected = ethers.keccak256(ethers.toUtf8Bytes(
        'AuthorizeIntent(bytes32 intentHash,uint256 deadline,bytes32 nonce,address k3,uint256 chainId,address verifyingContract)'));
      assert(K2A.AUTHORIZE_TYPEHASH === expected, 'AUTHORIZE_TYPEHASH drift');
    });
  } finally {
    cleanup();
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.err}`);
    if (!r.ok) failed += 1;
  }
  console.log(`\nverify-k2-intent-builders: ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('verifier crashed:', e && e.stack ? e.stack : e); process.exit(1); });
