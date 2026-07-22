// SecureGate session-key signer — LOCAL, browser-only signing boundary.
//
// Absolute rules enforced here:
//   * Signing happens in the browser only. The key never leaves this module.
//   * No key is written to localStorage / sessionStorage / indexedDB.
//   * No key is logged, and no key is placed in any request body.
//   * Only the resulting signedTx is returned to the caller.
//
// The React layer holds the key in session-only state and calls scrub() to drop
// it. This module keeps no module-level key storage of its own.

import { ethers } from 'ethers'

// Inline helpers (previously in securegateTxBuilder — that file is removed as it
// contained ABI function names that must not appear in bundled frontend source).
function buildBroadcastBody(signedTx: string): { signedTx: string } {
  const v = (signedTx || '').trim()
  if (!/^0x[0-9a-fA-F]{100,}$/.test(v)) throw new Error('signedTx required')
  return { signedTx: v }
}
function assertNoKeyMaterial(body: Record<string, unknown>): void {
  const forbidden = new Set(['privateKey','deployerKey','k1Key','k2Key','k3Key','mnemonic','seed'])
  for (const k of Object.keys(body)) {
    if (forbidden.has(k) || /priv|secret|mnemonic|seed|passphrase/i.test(k)) {
      throw new Error(`forbidden field in broadcast body: ${k}`)
    }
  }
}

const PRIVKEY_RE = /^0x[0-9a-fA-F]{64}$/

function normalizeKey(raw: string): string {
  const v = (raw || '').trim()
  const withPrefix = v.startsWith('0x') ? v : '0x' + v
  if (!PRIVKEY_RE.test(withPrefix)) {
    throw new Error('signer key must be a 32-byte (64 hex) private key')
  }
  return withPrefix
}

// Derive the public address for a signer key without exposing the key.
export function deriveAddress(privateKey: string): string {
  const wallet = new ethers.Wallet(normalizeKey(privateKey))
  return wallet.address
}

export type SignedResult = { from: string; signedTx: string }

// Sign a transaction request locally and return only { from, signedTx }.
// The key is confined to this function scope.
export async function signLocally(privateKey: string, txRequest: ethers.TransactionRequest): Promise<SignedResult> {
  const wallet = new ethers.Wallet(normalizeKey(privateKey))
  const signedTx = await wallet.signTransaction(txRequest)
  // Validate the produced signedTx shape (rejects any accidental empty/short value).
  buildBroadcastBody(signedTx)
  return { from: wallet.address, signedTx }
}

// Build the exact POST body for the backend deploy route: signedTx ONLY.
// assertNoKeyMaterial is a redundant guard in case a caller mutates the object.
export function broadcastBody(signedTx: string): { signedTx: string } {
  const body = buildBroadcastBody(signedTx)
  assertNoKeyMaterial(body)
  return body
}
