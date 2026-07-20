// k3ExecutionSweep.ts (S16) — final execution sweep target resolution.
//
// Owner rules:
//   * executeIntent moves the queued asset to K3 and ONLY K3. There is no path,
//     parameter, or override by which execution can target anything else.
//   * This module resolves the sweep target from an intent by delegating to
//     k3Enforcement — so even if a caller passes a requested destination, the
//     effective target is always K3.

import { enforceK3, type K3Evaluation } from './k3Enforcement.ts'

export type ExecutableIntent = {
  intentHash: string
  k3: string // immutable forced destination (public address)
  requestedDestination?: string // any attempted override — ignored
}

export type SweepPlan = {
  intentHash: string
  target: string // ALWAYS K3
  override: boolean // whether an override was attempted (captured, not honored)
  message: string
}

export function resolveSweepTarget(intent: ExecutableIntent): SweepPlan {
  const evalResult: K3Evaluation = enforceK3(intent.k3, intent.requestedDestination ?? intent.k3)
  return {
    intentHash: intent.intentHash,
    target: evalResult.effectiveDestination, // == K3, unconditionally
    override: evalResult.suspect,
    message: evalResult.message,
  }
}

// Guard the verifier can assert: no matter the requested destination, the resolved
// target equals K3.
export function sweepTargetsOnlyK3(intent: ExecutableIntent): boolean {
  const plan = resolveSweepTarget(intent)
  const k3n = intent.k3.trim().toLowerCase()
  return plan.target === k3n
}
