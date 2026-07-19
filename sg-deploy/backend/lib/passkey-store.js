'use strict';

// passkey-store.js — K1-bound passkey registry (S08).
//
// Canonical rules (owner corrections):
//   * Passkeys are bound to K1, NOT to a chain (one passkey per K1, all chains).
//   * The raw passkey is NEVER stored. We store only a salted HMAC digest, so the
//     store cannot reveal or replay a passkey even if dumped.
//   * This module never unlocks execution by itself — a verified passkey is a
//     human-route access signal; K2's EIP-712 signature is still what authorizes
//     an intent. (Enforced client-side by placeholderGates.canExecuteIntent.)

const crypto = require('crypto');
const { createKv } = require('./kv');

const kv = createKv('passkey');

function pepper() {
  return process.env.PASSKEY_PEPPER || process.env.ABUSE_TRACE_PEPPER || ProcessSalt.value;
}
const ProcessSalt = { value: crypto.randomBytes(32).toString('hex') };

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
function normK1(k1) {
  return typeof k1 === 'string' && ADDR_RE.test(k1.trim()) ? k1.trim().toLowerCase() : null;
}

// Digest a raw passkey to an opaque, non-reversible value bound to its K1.
function digest(k1n, rawPasskey) {
  return crypto
    .createHmac('sha256', pepper())
    .update(`sg-passkey:${k1n}:${String(rawPasskey)}`)
    .digest('hex');
}

// Register (or overwrite) the K1-bound passkey. Returns { registered, k1 } and
// stores ONLY the digest.
async function register(k1, rawPasskey) {
  const k1n = normK1(k1);
  if (!k1n) throw new Error('valid K1 address required');
  if (typeof rawPasskey !== 'string' || rawPasskey.length < 6) {
    throw new Error('passkey too short');
  }
  await kv.set(k1n, digest(k1n, rawPasskey));
  return { registered: true, k1: k1n };
}

// Verify a candidate passkey against the stored K1-bound digest. Constant-time
// compare; returns { verified } only — never the stored digest.
async function verify(k1, rawPasskey) {
  const k1n = normK1(k1);
  if (!k1n) return { verified: false, reason: 'invalid K1' };
  const stored = await kv.get(k1n);
  if (!stored) return { verified: false, reason: 'no passkey registered for K1' };
  const cand = digest(k1n, rawPasskey);
  const a = Buffer.from(String(stored));
  const b = Buffer.from(cand);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { verified: ok, reason: ok ? 'ok' : 'mismatch' };
}

module.exports = { register, verify, _digest: digest, _normK1: normK1, _kv: kv };
