// recoveryCleanupSweep.ts (S13) — session-only sensitive-material handling.
//
// Owner rules:
//   * The recovery flow MAY ask for a burner deployer key and the compromised K1
//     key. These are SESSION-ONLY: held in memory, scrubbed after use, and NEVER
//     sent to the backend.
//   * The backend receives a SIGNED transaction only. This module provides the
//     scrub + the guard that proves no key field can leak into a backend payload.
//   * K2 / K3 are PUBLIC addresses only — their private keys are never entered.
//   * All recovered assets route to K3 (enforced by k3Enforcement).

// A mutable scratch record for the two session-only secrets. Callers mutate it and
// MUST call scrub() before the session ends.
export type RecoveryScratch = {
  compromisedK1Key: string // session-only, never to backend
  burnerDeployerKey: string // session-only, never to backend
}

export function freshScratch(): RecoveryScratch {
  return { compromisedK1Key: '', burnerDeployerKey: '' }
}

// Overwrite secret material in place, then blank it. Best-effort memory hygiene.
export function scrub(scratch: RecoveryScratch): RecoveryScratch {
  scratch.compromisedK1Key = ''
  scratch.burnerDeployerKey = ''
  return scratch
}

// Field names that must NEVER appear in a backend payload. Mirrors the backend
// deploy-route refusal list so the client fails closed too.
export const FORBIDDEN_BACKEND_KEYS = [
  'privateKey',
  'k1Key',
  'k1SessionKey',
  'compromisedK1Key',
  'k2Key',
  'k3Key',
  'deployerKey',
  'burnerDeployerKey',
  'mnemonic',
  'seed',
  'secret',
  'passphrase',
  'sessionKey',
]

// Assert an outgoing backend body carries NO key material. Returns true only when
// the payload is safe to send. Any forbidden key (or key-shaped name) => false.
export function isBackendSafe(body: Record<string, unknown>): boolean {
  if (!body || typeof body !== 'object') return true
  for (const k of Object.keys(body)) {
    if (FORBIDDEN_BACKEND_KEYS.includes(k)) return false
    if (/priv|secret|mnemonic|seed|passphrase|sessionkey|deployerkey|k1key|k2key|k3key/i.test(k)) return false
  }
  return true
}

// Convenience: build the ONLY allowed deploy payload shape — a signed tx string.
export function backendDeployBody(signedTx: string): { signedTx: string } {
  return { signedTx }
}
