'use strict';

// POST /api/rpc/:chain — safe backend JSON-RPC bridge.
//
// * Uses backend env RPC URLs ONLY (never exposed to the client).
// * Rejects any payload that looks like a private key / seed phrase.
// * Whitelists read-only + broadcast-safe methods.
// * Never returns the endpoint URL.

const express = require('express');
const chains = require('../config/chains');
const guard = require('../lib/address-guard');

const router = express.Router();

// Read-only + funding-estimate methods the client may ask for. Broadcasting is
// handled by the dedicated /api/deploy route, not here.
const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_estimateGas',
  'eth_call',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_feeHistory',
]);

// 64-hex standing alone == a secp256k1 private key. Also catch mnemonic-ish text.
function looksLikeSecret(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (/^0x?[0-9a-fA-F]{64}$/.test(v)) return true;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return true;
  const words = v.split(/\s+/);
  if (words.length >= 12 && words.every((w) => /^[a-z]+$/i.test(w))) return true; // seed phrase
  return false;
}

function scanForSecret(obj, depth = 0) {
  if (depth > 6 || obj == null) return false;
  if (typeof obj === 'string') return looksLikeSecret(obj);
  if (Array.isArray(obj)) return obj.some((v) => scanForSecret(v, depth + 1));
  if (typeof obj === 'object') {
    return Object.entries(obj).some(([k, v]) => {
      if (/priv|secret|mnemonic|seed|passphrase/i.test(k)) return true;
      return scanForSecret(v, depth + 1);
    });
  }
  return false;
}

router.post('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) {
    return res.status(404).json({ error: 'unknown chain' });
  }
  if (guard.hasForbiddenOverride(req.body) || scanForSecret(req.body)) {
    return res.status(400).json({ error: 'private key material is never accepted' });
  }

  const { method, params } = req.body || {};
  if (!ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: 'method not allowed' });
  }

  const url = chains.rpcUrlFor(slug);
  if (!url) {
    return res.status(503).json({ error: 'chain RPC not configured' });
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: Array.isArray(params) ? params : [] }),
    });
    const json = await upstream.json();
    if (json.error) {
      // Never leak upstream URL/detail; surface only the RPC error message.
      return res.status(502).json({ error: (json.error && json.error.message) || 'rpc error' });
    }
    return res.json({ result: json.result });
  } catch (_) {
    return res.status(502).json({ error: 'rpc request failed' });
  }
});

module.exports = router;
