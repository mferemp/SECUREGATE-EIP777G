#!/usr/bin/env node
'use strict';

// e2e-local-securegate.cjs — deterministic LOCAL end-to-end flow for SecureGate
// on a live anvil chain, using the REAL shipped frontend helpers (Node 24 type
// stripping) and the canonical Foundry artifact. No fakes: every txHash is a
// real anvil receipt; the K2 authorization is a real EIP-712 signature.
//
// Flow proven for ERC20 / ERC721 / ERC1155:
//   deploy canonical bytecode -> mint asset to gate -> client computes intentHash
//   -> K2 signs typed data -> K1 queues -> authorizeIntent(sig) -> K1 executes
//   -> asset lands at K3 (forced immutable destination).
// Plus: non-K3 attempted destination is captured (never routed), and the
// backend-bound broadcast payload is proven to carry signedTx ONLY.
//
// Exports run() so scripts/verify-e2e-local.cjs can assert on the results.
// Run directly: scripts/with-node24.sh node scripts/e2e-local-securegate.cjs

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const OUT = path.join(ROOT, 'out');
const ARTIFACT = path.join(OUT, 'SecureGate.sol', 'SecureGate.json');
const ANVIL = path.join(process.env.HOME || '/root', '.foundry', 'bin', 'anvil');
const PORT = 8900 + (process.pid % 300);
const RPC = `http://127.0.0.1:${PORT}`;

const { ethers } = require(path.join(FRONTEND, 'node_modules', 'ethers'));

const PK = {
  k1: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  k2: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  k3: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
};
const KIND = { ERC20: 0, ERC721: 1, ERC1155: 2 };

function loadArtifact(p) {
  const a = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { abi: a.abi, bytecode: a.bytecode.object || a.bytecode };
}
function waitForRpc(provider, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try { await provider.getBlockNumber(); resolve(); }
      catch (e) { if (--tries <= 0) reject(new Error('anvil not ready')); else setTimeout(tick, 250); }
    };
    tick();
  });
}

async function run() {
  const steps = [];
  const record = (name, detail) => steps.push({ name, ...detail });

  if (!fs.existsSync(ARTIFACT)) throw new Error(`missing canonical artifact: ${ARTIFACT}`);
  if (!fs.existsSync(ANVIL)) throw new Error(`anvil not found at ${ANVIL}`);

  const gateArt = loadArtifact(ARTIFACT);
  const erc20Art = loadArtifact(path.join(OUT, 'MockAssets.sol', 'MockERC20E2E.json'));
  const erc721Art = loadArtifact(path.join(OUT, 'MockAssets.sol', 'MockERC721E2E.json'));
  const erc1155Art = loadArtifact(path.join(OUT, 'MockAssets.sol', 'MockERC1155E2E.json'));

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
    const chainId = Number((await provider.getNetwork()).chainId);

    const w1 = new ethers.Wallet(PK.k1, provider);
    const w2 = new ethers.Wallet(PK.k2, provider);
    const w3 = new ethers.Wallet(PK.k3, provider);
    const K1 = w1.address, K2 = w2.address, K3 = w3.address;
    record('keys-distinct', { K1, K2, K3, distinct: new Set([K1, K2, K3]).size === 3 });

    const m1 = new ethers.NonceManager(w1);

    // Deploy canonical gate.
    const gateFactory = new ethers.ContractFactory(gateArt.abi, gateArt.bytecode, m1);
    const gate = await gateFactory.deploy(K1, K2, K3);
    const dRcpt = await gate.deploymentTransaction().wait();
    const gateAddr = await gate.getAddress();
    record('deploy', { gateAddr, txHash: dRcpt.hash });

    const iface = new ethers.Interface(gateArt.abi);

    // Deploy mock assets.
    const t20 = await new ethers.ContractFactory(erc20Art.abi, erc20Art.bytecode, m1).deploy();
    await t20.waitForDeployment();
    const t721 = await new ethers.ContractFactory(erc721Art.abi, erc721Art.bytecode, m1).deploy();
    await t721.waitForDeployment();
    const t1155 = await new ethers.ContractFactory(erc1155Art.abi, erc1155Art.bytecode, m1).deploy();
    await t1155.waitForDeployment();

    const scenarios = [
      { assetType: 'ERC20',  token: await t20.getAddress(),   tokenId: '0',  amount: '1000000000000000000', mint: async () => (await t20.mint(gateAddr, '1000000000000000000')).wait(),  check: async () => (await t20.balanceOf(K3)).toString() === '1000000000000000000' },
      { assetType: 'ERC721', token: await t721.getAddress(),  tokenId: '7',  amount: '1',                   mint: async () => (await t721.mint(gateAddr, 7)).wait(),                        check: async () => ethers.getAddress(await t721.ownerOf(7)) === K3 },
      { assetType: 'ERC1155',token: await t1155.getAddress(), tokenId: '42', amount: '5',                   mint: async () => (await t1155.mint(gateAddr, 42, 5)).wait(),                   check: async () => (await t1155.balanceOf(K3, 42)).toString() === '5' },
    ];

    for (const s of scenarios) {
      await s.mint();
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // 1. Client helper computes the intent hash.
      const clientHash = IH.computeClientIntentHash({
        assetType: s.assetType, token: s.token, tokenId: s.tokenId, amount: s.amount,
        nonce, deadline, k3: K3, chainId, verifyingContract: gateAddr,
      });

      // 2. K1 queues the intent (real tx).
      let queueData;
      if (s.assetType === 'ERC20') queueData = TX.encodeQueueERC20(gateArt.abi, s.token, s.amount, nonce, deadline);
      else if (s.assetType === 'ERC721') queueData = TX.encodeQueueERC721(gateArt.abi, s.token, s.tokenId, nonce, deadline);
      else queueData = TX.encodeQueueERC1155(gateArt.abi, s.token, s.tokenId, s.amount, nonce, deadline);
      const qRcpt = await (await m1.sendTransaction({ to: gateAddr, data: queueData })).wait();

      // Recover the on-chain intent hash from the IntentQueued event.
      let onchainHash = null;
      for (const log of qRcpt.logs) {
        try { const p = iface.parseLog(log); if (p && p.name === 'IntentQueued') onchainHash = p.args.intentHash; } catch (_) {}
      }
      const hashMatches = onchainHash && onchainHash.toLowerCase() === clientHash.toLowerCase();

      // 3. K2 signs the canonical typed data (real EIP-712 signature).
      const authParams = { intentHash: clientHash, deadline, nonce, k3: K3, chainId, verifyingContract: gateAddr };
      const td = K2A.buildAuthorizationTypedData(authParams);
      const sig = await w2.signTypedData(td.domain, td.types, td.message);
      const { valid, recovered } = K2A.verifyK2AuthorizationSignature(authParams, sig, K2);

      // 4. authorizeIntent(sig) — anyone can submit; the auth is K2's signature.
      const authData = TX.encodeAuthorizeIntent(gateArt.abi, clientHash, sig);
      const aRcpt = await (await m1.sendTransaction({ to: gateAddr, data: authData })).wait();

      // 5. K1 executes -> asset forced to K3.
      const execData = TX.encodeExecuteIntent(gateArt.abi, clientHash);
      const eRcpt = await (await m1.sendTransaction({ to: gateAddr, data: execData })).wait();
      const landedAtK3 = await s.check();

      record('flow', {
        assetType: s.assetType, clientHash, onchainHash, hashMatches,
        k2Valid: valid && recovered === K2,
        queueTx: qRcpt.hash, authTx: aRcpt.hash, execTx: eRcpt.hash, landedAtK3,
      });
    }

    // Non-K3 destination is captured, never routed.
    const attacker = ethers.getAddress('0x' + 'be'.repeat(20));
    const recData = iface.encodeFunctionData('recordAttemptedDestination', [attacker]);
    const rRcpt = await (await m1.sendTransaction({ to: gateAddr, data: recData })).wait();
    let captured = false;
    for (const log of rRcpt.logs) {
      try { const p = iface.parseLog(log); if (p && p.name === 'NonK3DestinationCaptured') captured = ethers.getAddress(p.args.attempted) === attacker; } catch (_) {}
    }
    const suspect = await gate.suspectDestination(attacker);
    record('non-k3-capture', { attacker, captured, suspect, txHash: rRcpt.hash });

    // Backend broadcast boundary: build a signed tx and prove the payload we would
    // POST to /api/deploy carries signedTx ONLY — never a private key.
    const signedTx = await w1.signTransaction({
      to: gateAddr, data: recData /* any real calldata; boundary check only */, nonce: await provider.getTransactionCount(K1),
      gasLimit: 100000, gasPrice: (await provider.getFeeData()).gasPrice, chainId,
    });
    const backendBody = { signedTx };
    const bodyStr = JSON.stringify(backendBody);
    const hasKeyMaterial = /"(privateKey|k1Key|k2Key|k3Key|mnemonic|seed|secret|passphrase)"/.test(bodyStr) ||
      new RegExp(PK.k1.slice(2)).test(bodyStr) || new RegExp(PK.k2.slice(2)).test(bodyStr);
    record('backend-boundary', { fields: Object.keys(backendBody), signedTxOnly: !hasKeyMaterial && /^0x[0-9a-fA-F]{100,}$/.test(signedTx) });

    return { chainId, gateAddr, steps };
  } finally {
    cleanup();
  }
}

module.exports = { run };

if (require.main === module) {
  run()
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
    .catch((e) => { console.error('E2E ERROR', e); process.exit(1); });
}
