// SecureGate / EIP-777G — Placeholder honesty gates (Gap J)
//
// The hard identity/device layers (Auth-Gate SCAN, USB LINK DEVICE, WebAuthn /
// passkey, Admin passkey generator, proactive 2FA) are NOT wired to a real
// verifier. This module is the single source of truth for how those
// placeholders behave so the UI can never accidentally fake a success.
//
// Hard invariants enforced here (and proven by scripts/verify-placeholder-gates.cjs):
//   1. A placeholder gate ALWAYS reports `verified: false`. There is no code
//      path that returns a truthy verified flag.
//   2. A placeholder gate ALWAYS reports `unlocksExecution: false`. It can never
//      authorize executeIntent.
//   3. A placeholder gate ALWAYS reports `bypassesRecoveryPath: false`. It can
//      never stand in for K1 (initiate), K2 (EIP-712 authorization) or K3
//      (immutable forced destination).
//   4. Execution is gated EXCLUSIVELY on a verified K2 EIP-712 signature.
//      Placeholder results are structurally incapable of contributing to that
//      decision — see canExecuteIntent().
//
// Nothing in this module generates credentials, transmits secrets, or contacts
// a verifier. Attempts may be *recorded* (for anti-abuse rate limiting) but an
// "attempt recorded" is explicitly not a "verification".

export type PlaceholderGateKind = 'scan' | 'link' | 'passkey' | 'admin' | 'twofa'

// The `verified`, `unlocksExecution` and `bypassesRecoveryPath` fields are typed
// as the literal `false` so the TypeScript compiler itself rejects any future
// attempt to hand back a truthy value from a placeholder gate.
export interface PlaceholderGateResult {
  kind: PlaceholderGateKind
  verified: false
  pending: true
  unlocksExecution: false
  bypassesRecoveryPath: false
  attemptRecorded: boolean
  message: string
}

// Honest, non-faked status copy. Every string makes the "nothing verified"
// state explicit; none of them claim success or completion.
export const PLACEHOLDER_GATE_MESSAGES: Record<PlaceholderGateKind, string> = {
  scan: 'Auth-Gate verifier not connected yet — attempt recorded, nothing verified.',
  link: 'LINK DEVICE verifier not connected yet — attempt recorded, nothing verified.',
  passkey: 'Passkey verifier not connected yet — entry recorded, not verified (no fake success).',
  admin: 'Passkey generator not connected yet — no credential was generated. This is an honest placeholder.',
  twofa: 'Proactive 2FA is NOT ACTIVE YET — this layer reports no status and cannot protect anything.',
}

// Human-readable list of the layers that are deliberately still placeholders.
export const PENDING_PLACEHOLDER_LAYERS: string[] = [
  'Auth-Gate verifier (SCAN)',
  'USB LINK DEVICE verifier',
  'WebAuthn / passkey verifier',
  'Admin passkey generator',
  '2FA / proactive protection',
]

// Internal constructor — the ONLY place a PlaceholderGateResult is built. It
// hard-codes every honesty invariant so no caller can smuggle in a truthy
// verification. `as const` locks the literal-false fields.
function makeResult(kind: PlaceholderGateKind, attemptRecorded: boolean): PlaceholderGateResult {
  return {
    kind,
    verified: false,
    pending: true,
    unlocksExecution: false,
    bypassesRecoveryPath: false,
    attemptRecorded,
    message: PLACEHOLDER_GATE_MESSAGES[kind],
  } as const
}

// Auth-Gate SCAN attempt. Never verifies; may record the attempt for anti-abuse.
export function attemptScan(): PlaceholderGateResult {
  return makeResult('scan', true)
}

// USB LINK DEVICE attempt. Never verifies; may record the attempt.
export function attemptLinkDevice(): PlaceholderGateResult {
  return makeResult('link', true)
}

// WebAuthn / passkey ENTER. Never verifies; records the entry only.
export function enterPasskey(): PlaceholderGateResult {
  return makeResult('passkey', true)
}

// Admin passkey generator. Generates NOTHING and transmits NOTHING; the
// "attempt" is not even recorded as a security event because no credential
// exists. Always a placeholder.
export function generateAdminPasskey(hasInputs: boolean): PlaceholderGateResult {
  return makeResult('admin', hasInputs)
}

// Proactive 2FA status. Not active; returns a placeholder with no protection.
export function twoFactorStatus(): PlaceholderGateResult {
  return makeResult('twofa', false)
}

// Type guard: is this value a placeholder result? Used to defensively strip any
// placeholder object out of an execution decision.
export function isPlaceholderResult(x: unknown): x is PlaceholderGateResult {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.kind === 'string' &&
    r.verified === false &&
    r.pending === true &&
    r.unlocksExecution === false &&
    r.bypassesRecoveryPath === false
  )
}

// THE execution gate. Whether executeIntent may proceed depends ONLY on a real,
// verified K2 EIP-712 signature — full stop. This function accepts an optional
// bag of placeholder gate results purely to prove they are ignored: they are
// asserted to be placeholders and then discarded. There is no argument, field,
// or combination that lets a placeholder flip the return value to true.
export function canExecuteIntent(
  k2SignatureVerified: boolean,
  placeholderResults: PlaceholderGateResult[] = [],
): boolean {
  // Defensive: if any supplied "gate" is not a genuine placeholder, or claims to
  // verify / unlock, refuse outright rather than trust it.
  for (const r of placeholderResults) {
    if (!isPlaceholderResult(r)) return false
    if ((r as { verified: unknown }).verified === true) return false
    if ((r as { unlocksExecution: unknown }).unlocksExecution === true) return false
    if ((r as { bypassesRecoveryPath: unknown }).bypassesRecoveryPath === true) return false
  }
  // The placeholder results are now provably incapable of affecting the outcome.
  return k2SignatureVerified === true
}
