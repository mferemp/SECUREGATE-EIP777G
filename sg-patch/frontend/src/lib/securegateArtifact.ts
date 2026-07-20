// SecureGate artifact fetcher — the ONLY way the browser obtains ABI/bytecode.
//
// It calls GET /api/artifact/securegate and validates the response strictly.
// There is NO hardcoded ABI and NO root artifact-securegate.js fallback. If the
// backend has no validated artifact configured, the route returns 503 and this
// helper throws an honest error the UI surfaces verbatim.

import { api } from './api'
import { validateArtifactShape, type Artifact } from './securegateTxBuilder'

export type { Artifact }

export async function fetchArtifact(): Promise<Artifact> {
  let res: Response
  try {
    res = await fetch(api('artifact/securegate'))
  } catch (e) {
    throw new Error('artifact route unreachable: ' + (e as Error).message)
  }
  let body: any = null
  try {
    body = await res.json()
  } catch {
    throw new Error('artifact route returned malformed JSON')
  }
  if (!res.ok) {
    // Honest surface of the backend's 503 reason (e.g. "SECUREGATE_BYTECODE_HEX not set").
    const reason = (body && (body.reason || body.error)) || `HTTP ${res.status}`
    throw new Error('artifact unavailable: ' + reason)
  }
  // Strict shape validation (0x-hex bytecode, non-empty ABI array).
  return validateArtifactShape(body)
}
