'use strict';

// /api/admin-passkey — admin black-circle passkey generation (S09).
//
//   POST /api/admin-passkey/generate { adminKey, k1 }
//
// Owner rule: the admin black circle takes an ADMIN KEY + a K1 address and mints a
// K1-BOUND passkey (not per-chain). The admin key is verified against ADMIN_KEY in
// backend env and is NEVER stored or echoed. The generated passkey is a
// deterministic HMAC bound to that K1; it is registered in the passkey store the
// same way a user passkey would be, so the user can later ENTER it on the passkey
// lane. If ADMIN_KEY is not configured, generation is honestly reported disabled.

const express = require('express');
const crypto = require('crypto');
const store = require('../lib/passkey-store');

const router = express.Router();

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

function mintPasskey(k1n) {
  const pepper = process.env.PASSKEY_PEPPER || process.env.ABUSE_TRACE_PEPPER || 'sg-admin-mint';
  // 12-char base32-ish token, deterministic per (pepper, k1) but non-reversible.
  return crypto
    .createHmac('sha256', pepper)
    .update(`sg-admin-passkey:${k1n}`)
    .digest('hex')
    .slice(0, 16);
}

router.post('/generate', async (req, res) => {
  const adminKey = (req.body && req.body.adminKey) || '';
  const k1 = (req.body && req.body.k1) || '';
  const k1n = typeof k1 === 'string' && ADDR_RE.test(k1.trim()) ? k1.trim().toLowerCase() : null;

  if (!k1n) {
    return res.status(400).json({ error: 'valid K1 address required' });
  }

  const configured = process.env.ADMIN_KEY;
  if (!configured) {
    // Honest capability reporting — no fake success.
    return res.json({ generated: false, disabled: true, reason: 'admin key not configured' });
  }
  // Constant-time admin key check.
  const a = Buffer.from(String(adminKey));
  const b = Buffer.from(String(configured));
  const authed = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!authed) {
    return res.status(403).json({ generated: false, reason: 'admin key rejected' });
  }

  const passkey = mintPasskey(k1n);
  try {
    await store.register(k1n, passkey);
  } catch (e) {
    return res.status(400).json({ generated: false, reason: e.message || 'register failed' });
  }
  // The minted passkey IS returned here (once) so the operator can hand it to the
  // K1 owner; only its digest is persisted. It is K1-bound, not per-chain.
  return res.json({ generated: true, k1: k1n, passkey, boundTo: 'K1', perChain: false });
});

module.exports = router;
