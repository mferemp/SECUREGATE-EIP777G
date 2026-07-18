#!/usr/bin/env node
'use strict';

// e2e-testnet-securegate.cjs — REAL testnet end-to-end harness. It runs ONLY
// when the required env is configured; otherwise it prints exactly:
//   SKIPPED: missing funded testnet env
// and exits 0 (an honest skip, never a fake pass).
//
// Boundary rules (must not regress):
//   * Private keys are used LOCALLY inside this script process only, purely to
//     sign testnet transactions. They are NEVER sent to the backend and NEVER
//     committed. The backend broadcast path (if used) receives signedTx only.
//   * A txHash is printed ONLY when the upstream RPC actually returns one. There
//     is no fake `pending`, no fabricated hash.
//
// Required env:
//   TESTNET_CHAIN_ID
//   TESTNET_RPC_URL
//   TESTNET_K1_PRIVATE_KEY
//   TESTNET_K2_PRIVATE_KEY   (or TESTNET_K2_SIGNER_MODE=external)
//   TESTNET_K3_ADDRESS
//   TESTNET_TOKEN_MODE=mock
//
// Run: scripts/with-node24.sh node scripts/e2e-testnet-securegate.cjs

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const OUT = path.join(ROOT, 'out');
const { ethers } = require(path.join(FRONTEND, 'node_modules', 'ethers'));

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function checkEnv() {
  const chainId = env('TESTNET_CHAIN_ID');
  const rpc = env('TESTNET_RPC_URL');
  const k1 = env('TESTNET_K1_PRIVATE_KEY');
  const k2mode = env('TESTNET_K2_SIGNER_MODE');
  const k2 = env('TESTNET_K2_PRIVATE_KEY');
  const k3 = env('TESTNET_K3_ADDRESS');
  const tokenMode = env('TESTNET_TOKEN_MODE');
  const k2Ok = k2 || k2mode === 'external';
  const ok = chainId && rpc && k1 && k2Ok && k3 && tokenMode;
  return { ok, chainId, rpc, k1, k2, k2mode, k3, tokenMode };
}

async function run() {
  const cfg = checkEnv();
  if (!cfg.ok) {
    // Exact honest skip message required by the directive.
    console.log('SKIPPED: missing funded testnet env');
    return { skipped: true };
  }

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const chainId = Number(cfg.chainId);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== chainId) {
    throw new Error(`RPC chainId ${net.chainId} != TESTNET_CHAIN_ID ${chainId}`);
  }

  // Keys are used locally ONLY to sign; never transmitted to any backend.
  const w1 = new ethers.Wallet(cfg.k1, provider);
  const K3 = ethers.getAddress(cfg.k3);
  const K1 = w1.address;

  // Require funding before attempting real txs — otherwise fail honestly.
  const bal = await provider.getBalance(K1);
  if (bal === 0n) throw new Error(`K1 ${K1} has zero balance on testnet ${chainId} — fund it first`);

  const gateArt = JSON.parse(fs.readFileSync(path.join(OUT, 'SecureGate.sol', 'SecureGate.json'), 'utf8'));
  const abi = gateArt.abi;
  const bytecode = gateArt.bytecode.object || gateArt.bytecode;

  let K2addr;
  if (cfg.k2) K2addr = new ethers.Wallet(cfg.k2).address;
  else K2addr = null; // external signer mode: address comes from the external signer

  // Deploy the canonical gate on testnet (real tx hash from RPC only).
  const m1 = new ethers.NonceManager(w1);
  const factory = new ethers.ContractFactory(abi, bytecode, m1);
  const gate = await factory.deploy(K1, K2addr || K1, K3);
  const rcpt = await gate.deploymentTransaction().wait();
  const gateAddr = await gate.getAddress();
  console.log(`TESTNET deploy tx (real RPC result): ${rcpt.hash}`);
  console.log(`TESTNET gate address: ${gateAddr}`);
  console.log('NOTE: full queue/authorize/execute requires TESTNET_TOKEN_MODE=mock token deploys with funded gas.');

  return { skipped: false, chainId, gateAddr, deployTx: rcpt.hash };
}

module.exports = { run, checkEnv };

if (require.main === module) {
  run()
    .then((r) => process.exit(0))
    .catch((e) => { console.error('TESTNET E2E ERROR:', e.message); process.exit(1); });
}
