'use strict'

const crypto = require('crypto')

const PREFIX = 'sgpk'

function normalizeK1(k1) {
  if (typeof k1 !== 'string') return ''
  const trimmed = k1.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return ''
  return trimmed.toLowerCase()
}

function secret() {
  return process.env.SECUREGATE_PASSKEY_PEPPER || process.env.SECUREGATE_ADMIN_KEY || ''
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function unbase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payload) {
  const key = secret()
  if (!key) return ''
  return crypto.createHmac('sha256', key).update(payload).digest('base64url')
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

async function mint(k1) {
  const boundK1 = normalizeK1(k1)
  if (!boundK1) return { error: 'valid k1 required' }
  if (!secret()) {
    return { disabled: true, reason: 'Passkey minting is not configured on this deployment.' }
  }
  const payload = base64url(JSON.stringify({
    v: 1,
    k1: boundK1,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Date.now()
  }))
  return {
    passkey: `${PREFIX}.${payload}.${sign(payload)}`,
    boundK1,
    issuedAt: Date.now()
  }
}

async function verify(k1, passkey) {
  const expectedK1 = normalizeK1(k1)
  if (!expectedK1) return { verified: false, reason: 'valid k1 required' }
  if (typeof passkey !== 'string') return { verified: false, reason: 'passkey required' }

  const parts = passkey.trim().split('.')
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { verified: false, reason: 'invalid passkey format' }
  }

  const [, payload, sig] = parts
  const expectedSig = sign(payload)
  if (!expectedSig || !safeEqual(sig, expectedSig)) {
    return { verified: false, reason: 'passkey signature invalid' }
  }

  let decoded
  try {
    decoded = JSON.parse(unbase64url(payload))
  } catch {
    return { verified: false, reason: 'passkey payload invalid' }
  }

  if (decoded.v !== 1 || decoded.k1 !== expectedK1) {
    return { verified: false, reason: 'passkey is not bound to this K1' }
  }

  return { verified: true, boundK1: expectedK1, issuedAt: decoded.iat || null }
}

async function register(k1) {
  const normalized = normalizeK1(k1)
  if (!normalized) return { error: 'valid k1 required' }
  return {
    disabled: true,
    reason: "Self-registration is disabled. Use the admin \u26ab-' human route."
  }
}

module.exports = { mint, verify, register, normalizeK1 }
