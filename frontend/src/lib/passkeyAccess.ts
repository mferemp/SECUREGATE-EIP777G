// passkeyAccess.ts (S08) — client wrapper for the K1-bound passkey lane.
//
// Owner rules:
//   * Passkeys are K1-bound, not per-chain — a single passkey unlocks the human
//     route for that K1 on every chain.
//   * The raw passkey is POSTed once for register/verify; the backend hashes it and
//     never stores or echoes it. This module never claims a passkey authorizes an
//     intent — a verified passkey is a human-route access signal only.

import { verifyPasskeyRemote, registerPasskeyRemote } from './securegateApi'

export type PasskeyResult = {
  verified: boolean
  registered?: boolean
  reason?: string
}

export async function registerPasskey(k1: string, passkey: string): Promise<PasskeyResult> {
  try {
    const d = await registerPasskeyRemote(k1, passkey)
    return { verified: false, registered: d?.registered === true, reason: d?.error }
  } catch {
    return { verified: false, reason: 'network error' }
  }
}

export async function verifyPasskey(k1: string, passkey: string): Promise<PasskeyResult> {
  try {
    const d = await verifyPasskeyRemote(k1, passkey)
    return { verified: d?.verified === true, reason: d?.reason }
  } catch {
    return { verified: false, reason: 'network error' }
  }
}
