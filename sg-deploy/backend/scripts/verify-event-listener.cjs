#!/usr/bin/env node
'use strict';

// verify-event-listener.cjs — proves the SecureGate on-chain event listener on a
// live anvil chain, using the canonical ABI. It:
//   * deploys the canonical gate + mock assets, runs queue/authorize/execute so
//     real IntentQueued / IntentAuthorized / IntentExecuted / NonK3DestinationCaptured
//     events are emitted,
//   * polls via the listener and asserts each canonical event is parsed,
//   * proves checkpoint read/write through the durable-first KV + resume,
//   * proves RPC is read from backend env only and fail-closes (503) when unset,
//   * proves the frontend never receives an RPC URL (listener module exports none).
//
// Run: cd backend && ../scripts/with-node24.sh node scripts/verify-event-listener.cjs

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const BACKEND = path.resolve(__dirname, '..');
const ROOT = path.resolve(BACKEND, '..');
const OUT = path.join(ROOT, 'out');
const ANVIL = path.join(process.env.HOME || '/root', '.foundry', 'bin', 'anvil');
const PORT = 9300 + (process.pid % 250);
const RPC = `http://127.0.0.1:${PORT}`;

const { ethers } = require(path.join(BACKEND, 'node_modules', 'ethers'));
const events = require(path.join(BACKEND, 'lib', 'securegate-events.js'));
const kvmod = require(path.join(BACKEND, 'lib', 'kv.js'));

const PK = {
  k1: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  k2: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  k3: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
};

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, d) { failed++; console.log('FAIL ' + m + (d ? ' :: ' + d : '')); }
function assert(cond, m, d) { if (cond) pass(m); else fail(m, d); }
function loadArt(p) { const a = JSON.parse(fs.readFileSync(p, 'utf8')); return { abi: a.abi, bytecode: a.bytecode.object || a.bytecode }; }
function waitForRpc(provider, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = async () => { try { await provider.getBlockNumber(); resolve(); } catch (e) { if (--tries <= 0) reject(e); else setTimeout(tick, 250); } };
    tick();
  });
}

(async () => {
  kvmod._resetForTests(true);

  // 1. Fail-closed when RPC not configured for a real chain slug.
  await (async () => {
    let threw = null;
    try { events.createListener({ chainSlug: 'eth-mainnet', address: '0x' + '11'.repeat(20) }); }
    catch (e) { threw = e; }
    assert(threw && threw.status === 503 && threw.code === 'RPC_NOT_CONFIGURED',
      'listener fail-closes (503) when backend RPC env is unset');
  })();

  // 2. Frontend never receives an RPC URL — the module surface exposes none.
  assert(!('rpcUrl' in events) && typeof events.createListener === 'function',
    'event module exposes no RPC URL to callers');

  if (!fs.existsSync(ANVIL)) { fail('anvil available', 'not found at ' + ANVIL); }
  else {
    const anvil = spawn(ANVIL, ['--silent', '--port', String(PORT)], { stdio: ['ignore', 'ignore', 'inherit'] });
    let exited = false; anvil.on('exit', () => { exited = true; });
    const cleanup = () => { if (!exited) try { anvil.kill('SIGKILL'); } catch (_) {} };
    process.on('exit', cleanup);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const provider = new ethers.JsonRpcProvider(RPC);
      await waitForRpc(provider);
      const chainId = Number((await provider.getNetwork()).chainId);

      const w1 = new ethers.Wallet(PK.k1, provider);
      const w2 = new ethers.Wallet(PK.k2, provider);
      const K1 = w1.address, K2 = w2.address, K3 = new ethers.Wallet(PK.k3).address;
      const m1 = new ethers.NonceManager(w1);

      const gateArt = loadArt(path.join(OUT, 'SecureGate.sol', 'SecureGate.json'));
      const t20Art = loadArt(path.join(OUT, 'MockAssets.sol', 'MockERC20E2E.json'));
      const iface = new ethers.Interface(gateArt.abi);

      const gate = await new ethers.ContractFactory(gateArt.abi, gateArt.bytecode, m1).deploy(K1, K2, K3);
      await gate.waitForDeployment();
      const gateAddr = await gate.getAddress();
      const t20 = await new ethers.ContractFactory(t20Art.abi, t20Art.bytecode, m1).deploy();
      await t20.waitForDeployment();
      const tokenAddr = await t20.getAddress();
      await (await t20.mint(gateAddr, '1000000000000000000')).wait();

      // Emit the full canonical event set.
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const clientHash = await gate.computeIntentHash(0, tokenAddr, 0, '1000000000000000000', nonce, deadline);
      await (await m1.sendTransaction({ to: gateAddr, data: iface.encodeFunctionData('queueERC20', [tokenAddr, '1000000000000000000', nonce, deadline]) })).wait();
      const digest = await gate.computeAuthorizationDigest(clientHash);
      const sig = await w2.signingKey.sign(digest).serialized;
      await (await m1.sendTransaction({ to: gateAddr, data: iface.encodeFunctionData('authorizeIntent', [clientHash, sig]) })).wait();
      await (await m1.sendTransaction({ to: gateAddr, data: iface.encodeFunctionData('executeIntent', [clientHash]) })).wait();
      const attacker = ethers.getAddress('0x' + 'be'.repeat(20));
      await (await m1.sendTransaction({ to: gateAddr, data: iface.encodeFunctionData('recordAttemptedDestination', [attacker]) })).wait();

      // 3. Listener parses canonical events via canonical ABI (directUrl = anvil).
      const listener = events.createListener({ directUrl: RPC, address: gateAddr, kvNamespace: 'evt-test' });
      const first = await listener.poll({ fromBlock: 0 });
      const names = new Set(first.events.map((e) => e.name));
      for (const n of ['IntentQueued', 'IntentAuthorized', 'IntentExecuted', 'NonK3DestinationCaptured']) {
        assert(names.has(n), `canonical event parsed: ${n}`);
      }
      // Parsed args are normalized (bigint -> string) and typed correctly.
      const queued = first.events.find((e) => e.name === 'IntentQueued');
      assert(queued && queued.args.intentHash.toLowerCase() === clientHash.toLowerCase(),
        'IntentQueued.intentHash matches computeIntentHash');
      const captured = first.events.find((e) => e.name === 'NonK3DestinationCaptured');
      assert(captured && ethers.getAddress(captured.args.attempted) === attacker,
        'NonK3DestinationCaptured.attempted matches');

      // 4. Checkpoint written; resume from checkpoint yields no re-processing.
      const cp = await listener.getCheckpoint();
      assert(Number.isInteger(cp) && cp >= first.toBlock, 'checkpoint written to KV', String(cp));
      const second = await listener.poll(); // resumes from checkpoint+1
      assert(second.events.length === 0 && second.fromBlock === cp + 1,
        'resume from checkpoint reprocesses nothing');
    } catch (e) {
      fail('event listener live run', e.message);
    } finally {
      cleanup();
    }
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
