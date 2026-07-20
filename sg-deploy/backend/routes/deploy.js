'use strict';

// POST /api/deploy/:chain — accepts a SIGNED transaction ONLY and broadcasts it
// through the backend RPC. The backend never receives, holds, or handles any
// private key. A bare 32-byte hex or seed-phrase body is rejected outright.

const express = require('express');
const chains = require('../config/chains');
const guard = require('../lib/address-guard');

const router = express.Router();

// A signed raw tx is long (>= ~100 hex chars). A bare 64-hex private key is short.
function isSignedTx(raw) {
  return typeof raw === 'string' && /^0x[0-9a-fA-F]{100,}$/.test(raw.trim());
}
function looksLikePrivateKey(raw) {
  return typeof raw === 'string' && /^0x?[0-9a-fA-F]{64}$/.test(raw.trim());
}

// Body field names that carry key/secret material. NONE may ever be accepted;
// the backend receives signedTx only.
const FORBIDDEN_KEY_FIELDS = [
  'privateKey', 'k1Key', 'k2Key', 'k3Key', 'deployerKey',
  'mnemonic', 'seed', 'secret', 'passphrase', 'k1SessionKey', 'k2SessionKey', 'sessionKey',
];
function hasKeyField(body) {
  if (!body || typeof body !== 'object') return false;
  return Object.keys(body).some((k) =>
    FORBIDDEN_KEY_FIELDS.includes(k) || /priv|secret|mnemonic|seed|passphrase|sessionkey/i.test(k));
}

router.post('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) {
    return res.status(404).json({ error: 'unknown chain' });
  }
  const meta = chains.get(slug);
  if (!meta.deploySupported) {
    return res.status(400).json({ error: 'deploy not supported on this chain' });
  }
  if (guard.hasForbiddenOverride(req.body)) {
    return res.status(400).json({ error: 'alternate destination overrides are not accepted' });
  }

  const signedTx = req.body && req.body.signedTx;

  // Hard refusal of anything private-key-shaped: named key fields or a bare key.
  if (hasKeyField(req.body) || looksLikePrivateKey(signedTx)) {
    return res.status(400).json({ error: 'private key material is never accepted; submit signedTx only' });
  }
  if (!isSignedTx(signedTx)) {
    return res.status(400).json({ error: 'signedTx (0x-prefixed signed transaction) required' });
  }

  const url = chains.rpcUrlFor(slug);
  if (!url) {
    return res.status(503).json({ error: 'chain RPC not configured' });
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [signedTx.trim()] }),
    });
    const json = await upstream.json();
    if (json.error) {
      return res.status(502).json({ error: (json.error && json.error.message) || 'broadcast rejected' });
    }
    return res.json({ txHash: json.result });
  } catch (_) {
    return res.status(502).json({ error: 'broadcast failed' });
  }
});

module.exports = router;
