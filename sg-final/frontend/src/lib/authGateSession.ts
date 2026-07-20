// authGateSession.ts (S04) — K1 session binding for the Auth-Gate.
//
// Owner rules encoded here:
//   * K1 is entered BEFORE any SCAN / LINK DEVICE / PASSKEY action.
//   * After a gate verifies, K1 becomes session-bound and auto-fills downstream
//     (recovery K1 field, admin K1 field) — the user does not retype it.
//   * The gate is fresh per use: a new session starts unbound; nothing about a
//     prior K1 persists across a reset.
//   * K1 here is a PUBLIC address only. No private key is ever part of the session
//     binding.

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export type AuthGateSession = {
  k1: string | null // public address, lowercased; null until bound
  bound: boolean // true once a gate verified this K1
  boundAt: number | null // ms epoch when bound (session-only)
}

export function freshSession(): AuthGateSession {
  return { k1: null, bound: false, boundAt: null }
}

export function isValidK1(k1: string): boolean {
  return typeof k1 === 'string' && ADDR_RE.test(k1.trim())
}

export function normalizeK1(k1: string): string | null {
  return isValidK1(k1) ? k1.trim().toLowerCase() : null
}

// Precondition for attempting any device/passkey gate: a valid K1 must be present
// and NOT yet require re-entry. Returns a reason when the gate must be blocked.
export function canAttemptGate(session: AuthGateSession, enteredK1: string): { ok: boolean; reason: string } {
  const k1 = normalizeK1(enteredK1)
  if (!k1) return { ok: false, reason: 'Enter K1 before running a device or passkey check.' }
  return { ok: true, reason: '' }
}

// Bind K1 to the session after a gate verifies. Idempotent for the same K1;
// rebinding a different K1 requires a fresh session first (fresh-per-use).
export function bindK1(session: AuthGateSession, k1: string): AuthGateSession {
  const n = normalizeK1(k1)
  if (!n) return session
  if (session.bound && session.k1 && session.k1 !== n) {
    // A different K1 cannot silently overwrite a bound session — caller must reset.
    return session
  }
  return { k1: n, bound: true, boundAt: Date.now() }
}

// Value that auto-fills downstream fields once bound; empty string before binding.
export function autofillK1(session: AuthGateSession): string {
  return session.bound && session.k1 ? session.k1 : ''
}

// Fresh-per-use: full reset returns an unbound session (no residual K1).
export function resetSession(): AuthGateSession {
  return freshSession()
}
