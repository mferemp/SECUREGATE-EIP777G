// authGateAttempts.ts (S06) — device-attempt limiting for the Auth-Gate.
//
// Owner rules:
//   * 3 FAILED device attempts (SCAN + LINK together) darken SCAN + LINK for THAT
//     K1 — an abuse cooldown that only triggers after failed attempts.
//   * The PASSKEY path and the human recovery route REMAIN OPEN after lockout.
//   * This is NOT a recovery limit: it never caps legitimate per-chain recovery,
//     and it is unrelated to 2FA (which has NO limits at all — see twoFactorProactive).

export const MAX_DEVICE_ATTEMPTS = 3

export type AttemptState = {
  k1: string | null // which K1 the attempts belong to (lowercased public addr)
  failures: number // failed SCAN+LINK attempts for this K1
}

export function freshAttempts(): AttemptState {
  return { k1: null, failures: 0 }
}

// Record one FAILED device attempt for a K1. Attempts are per-K1: a new K1 resets
// the counter (fresh-per-use gate).
export function recordFailure(state: AttemptState, k1: string): AttemptState {
  const n = (k1 || '').trim().toLowerCase() || null
  if (state.k1 && n && state.k1 !== n) {
    return { k1: n, failures: 1 }
  }
  return { k1: n ?? state.k1, failures: state.failures + 1 }
}

// A SUCCESSFUL device gate clears the failure counter for that K1.
export function recordSuccess(state: AttemptState, k1: string): AttemptState {
  const n = (k1 || '').trim().toLowerCase() || null
  return { k1: n ?? state.k1, failures: 0 }
}

// Device buttons (SCAN + LINK) are darkened once the K1 hits the failure cap.
export function devicesLocked(state: AttemptState): boolean {
  return state.failures >= MAX_DEVICE_ATTEMPTS
}

// The passkey lane and human route are NEVER locked by device attempts.
export function passkeyLaneOpen(_state: AttemptState): boolean {
  return true
}
export function humanRouteOpen(_state: AttemptState): boolean {
  return true
}

// Legitimate recovery is NEVER capped by this state — device lockout only darkens
// the two device buttons; recovery proceeds via passkey/human route.
export function recoveryCapped(_state: AttemptState): boolean {
  return false
}
