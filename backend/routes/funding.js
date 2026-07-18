'use strict';

// GET /api/funding/:chain — estimate the native-token cost to deploy the gate,
// using the backend RPC only. Returns no endpoint URL.

const express = require('express');
const chains = require('../config/chains');

const router = express.Router();

// Conservative default gas for a SecureGate deployment (no artifact-specific
// estimate is available here; the browser builder refines this when wired).
const DEFAULT_DEPLOY_GAS = 2_500_000n;

async function rpcCall(url, method, params) {
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
  });
  const json = await upstream.json();
  if (json.error) throw new Error((json.error && json.error.message) || 'rpc error');
  return json.result;
}

function weiToDecimalString(wei) {
  // 18-decimal fixed-point formatting without float error.
  const s = wei.toString().padStart(19, '0');
  const whole = s.slice(0, -18);
  const frac = s.slice(-18).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

router.get('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) {
    return res.status(404).json({ error: 'unknown chain' });
  }
  const meta = chains.get(slug);
  const url = chains.rpcUrlFor(slug);
  if (!url) {
    return res.status(503).json({ error: 'chain RPC not configured' });
  }

  try {
    const gasPriceHex = await rpcCall(url, 'eth_gasPrice', []);
    const gasPrice = BigInt(gasPriceHex);
    const estWei = gasPrice * DEFAULT_DEPLOY_GAS;
    return res.json({
      chain: slug,
      nativeSymbol: meta.nativeSymbol,
      gasPriceWei: gasPrice.toString(),
      estGas: DEFAULT_DEPLOY_GAS.toString(),
      estimateNative: weiToDecimalString(estWei),
    });
  } catch (_) {
    return res.status(502).json({ error: 'funding estimate failed' });
  }
});

module.exports = router;
