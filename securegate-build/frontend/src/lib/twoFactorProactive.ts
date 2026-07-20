// twoFactorProactive.ts (S10) — proactive 2FA, deliberately limitless.
//
// Owner rules (explicit):
//   * 2FA has NO recovery limits and NO attempt cooldowns.
//   * 2FA NEVER asks for a compromised K1 private key (or any private key).
//   * 2FA is SEPARATE, PROACTIVE protection — it is not part of the recovery gate
//     and does not gate/unlock intent execution.
// The current shell ships 2FA as "NOT ACTIVE YET"; this module encodes the honest
// status + the invariants the verifier asserts.

export type TwoFactorStatus = {
  active: boolean // shell status — not active yet
  proactive: true // always proactive protection, not a recovery step
  hasRecoveryLimit: false // NEVER limits recovery
  requiresPrivateKey: false // NEVER asks for K1 (or any) private key
  gatesExecution: false // NEVER unlocks intent execution
  message: string
}

export function twoFactorStatus(): TwoFactorStatus {
  return {
    active: false,
    proactive: true,
    hasRecoveryLimit: false,
    requiresPrivateKey: false,
    gatesExecution: false,
    message: 'Two-factor protection is proactive and optional. It is not active yet and never limits recovery.',
  }
}

// Explicit guards the verifier can call to prove the invariants hold regardless of
// any future "active" flip.
export function twoFactorHasNoLimits(s: TwoFactorStatus): boolean {
  return s.hasRecoveryLimit === false
}
export function twoFactorNeverTakesPrivateKey(s: TwoFactorStatus): boolean {
  return s.requiresPrivateKey === false
}
export function twoFactorNeverGatesExecution(s: TwoFactorStatus): boolean {
  return s.gatesExecution === false
}
