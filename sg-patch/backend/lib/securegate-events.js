'use strict';

// securegate-events.js — on-chain event listener/indexer for SecureGate.
//
// Parses the canonical SecureGate events using the canonical ABI, polls by block
// range, stores a resume checkpoint in the durable-first KV, and resumes from the
// last checkpoint. RPC URLs are read from BACKEND ENV ONLY (never exposed to the
// frontend). If no RPC is configured for the requested chain it fail-closes.
//
// Canonical events parsed:
//   IntentQueued(bytes32 intentHash, uint8 kind, address token, uint256 id, uint256 amount)
//   IntentAuthorized(bytes32 intentHash)
//   IntentExecuted(bytes32 intentHash, address token, address k3)
//   NonK3DestinationCaptured(address attempted)

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const chains = require('../config/chains');
const { createKv } = require('./kv');

const ARTIFACT = path.join(__dirname, '..', '..', 'out', 'SecureGate.sol', 'SecureGate.json');

// The event topics we index. Kept in sync with the canonical contract.
const EVENT_NAMES = [
  'IntentQueued',
  'IntentAuthorized',
  'IntentExecuted',
  'NonK3DestinationCaptured',
];

function loadCanonicalAbi() {
  const art = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  return art.abi;
}

// Fail-closed RPC resolution: backend env only. `directUrl` is allowed for the
// local anvil verifier (still a backend-side value, never sent to a browser).
function resolveRpc({ chainSlug, directUrl } = {}) {
  if (directUrl) return directUrl;
  if (!chainSlug) throw new Error('event listener: chainSlug required');
  const url = chains.rpcUrlFor(chainSlug);
  if (!url) {
    const e = new Error(`event listener: RPC not configured for ${chainSlug}`);
    e.code = 'RPC_NOT_CONFIGURED';
    e.status = 503;
    throw e;
  }
  return url;
}

function createListener({ chainSlug, directUrl, address, kvNamespace = 'events' } = {}) {
  const abi = loadCanonicalAbi();
  const iface = new ethers.Interface(abi);
  const wanted = new Set(EVENT_NAMES);
  const kv = createKv(kvNamespace);
  const rpcUrl = resolveRpc({ chainSlug, directUrl }); // throws 503 if unset
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const gate = ethers.getAddress(address);
  const checkpointKey = `checkpoint:${(chainSlug || 'direct')}:${gate.toLowerCase()}`;

  async function getCheckpoint() {
    const v = await kv.get(checkpointKey);
    return Number.isInteger(v) ? v : null;
  }
  async function setCheckpoint(block) {
    await kv.set(checkpointKey, block);
  }

  function parseLog(log) {
    let parsed;
    try { parsed = iface.parseLog(log); } catch (_) { return null; }
    if (!parsed || !wanted.has(parsed.name)) return null;
    return {
      name: parsed.name,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      args: Object.fromEntries(
        parsed.fragment.inputs.map((inp, i) => [inp.name, normalizeArg(parsed.args[i])]),
      ),
    };
  }

  function normalizeArg(v) {
    if (typeof v === 'bigint') return v.toString();
    return v;
  }

  // Poll a block range [fromBlock..toBlock]; returns parsed events + advances the
  // checkpoint. Resumes from the stored checkpoint when fromBlock is omitted.
  async function poll({ fromBlock, toBlock } = {}) {
    const head = await provider.getBlockNumber();
    const cp = await getCheckpoint();
    const start = Number.isInteger(fromBlock) ? fromBlock : (cp != null ? cp + 1 : 0);
    const end = Number.isInteger(toBlock) ? toBlock : head;
    if (start > end) return { events: [], fromBlock: start, toBlock: end, head };

    const logs = await provider.getLogs({ address: gate, fromBlock: start, toBlock: end });
    const events = logs.map(parseLog).filter(Boolean);
    await setCheckpoint(end);
    return { events, fromBlock: start, toBlock: end, head };
  }

  return { poll, getCheckpoint, setCheckpoint, parseLog, rpcConfigured: true, address: gate, EVENT_NAMES };
}

module.exports = { createListener, resolveRpc, loadCanonicalAbi, EVENT_NAMES };
