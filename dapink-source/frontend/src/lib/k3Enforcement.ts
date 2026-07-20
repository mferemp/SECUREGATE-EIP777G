// k3Enforcement.ts (S14) — K3 forced-destination enforcement (client mirror).
//
// Owner rules:
//   * K3 is the IMMUTABLE forced recovery destination. K1 initiates, K2 authorizes,
//     K3 receives. Assets route ONLY to K3.
//   * A non-K3 destination is captured and blacklisted internally; the user sees
//     neutral copy ("Invalid alternate destination ignored." / "Verified K3
//     destination enforced.") — no mechanics are revealed.
//   * This module never signs or routes value; it classifies and reports the forced
//     route so the UI can never honor an override.

import { K3_INVALID_ALT, K3_ENFORCED } from './uiLabels.ts'

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export function isAddress(a: string): boolean {
  return typeof a === 'string' && ADDR_RE.test(a.trim())
}
function norm(a: string): string | null {
  return isAddress(a) ? a.trim().toLowerCase() : null
}

export type K3Evaluation = {
  forcedDestination: string // ALWAYS K3
  effectiveDestination: string // ALWAYS K3 — never the requested override
  suspect: boolean // true when a non-K3 destination was requested
  suspectDestination: string | null // captured for internal blacklist
  message: string // neutral, mechanics-free copy
}

// Evaluate a requested destination against the immutable K3. The effective route
// is unconditionally K3; a mismatched request is captured as suspect but never
// returned as usable.
export function enforceK3(k3: string, requested: string): K3Evaluation {
  const k3n = norm(k3)
  if (!k3n) {
    throw new Error('K3 forced destination is not a valid address')
  }
  const reqN = norm(requested)
  const suspect = reqN !== null && reqN !== k3n
  return {
    forcedDestination: k3n,
    effectiveDestination: k3n, // never the override
    suspect,
    suspectDestination: suspect ? reqN : null,
    message: suspect ? K3_INVALID_ALT : K3_ENFORCED,
  }
}
