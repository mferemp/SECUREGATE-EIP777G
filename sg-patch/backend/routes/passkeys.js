'use strict';

// /api/passkeys — K1-bound passkey lane (S08).
//
//   POST /api/passkeys/register { k1, passkey } — bind a passkey to a K1 address.
//   POST /api/passkeys/verify   { k1, passkey } — check a candidate passkey.
//
// The raw passkey is hashed inside passkey-store before storage and is never
// persisted or echoed back. Passkeys are K1-bound (not per-chain). A verified
// passkey is a human-route access signal only; it never authorizes an intent.

const express = require('express');
const store = require('../lib/passkey-store');
const { record } = require('../lib/anti-abuse-kv');
const { bucketKey } = require('../lib/trace-key');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { k1, passkey } = req.body || {};
  try {
    const out = await store.register(k1, passkey);
    return res.json(out);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'registration failed' });
  }
});

router.post('/verify', async (req, res) => {
  const { k1, passkey } = req.body || {};
  // Throttle verify attempts per K1 bucket (abuse cooldown only after failures).
  const limit = await record('passkey_verify', bucketKey('passkey_verify', k1 || 'anon'));
  if (!limit.allowed) {
    return res.status(429).json({ verified: false, reason: 'too many attempts' });
  }
  try {
    const out = await store.verify(k1, passkey);
    return res.json(out);
  } catch (_) {
    return res.status(400).json({ verified: false, reason: 'verify failed' });
  }
});

module.exports = router;
