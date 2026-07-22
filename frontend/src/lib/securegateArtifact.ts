// SecureGate artifact fetcher — the ONLY way the browser obtains ABI/bytecode.
//
// It calls GET /api/artifact/securegate and validates the response strictly.
// There is NO hardcoded ABI and NO root artifact-securegate.js fallback. If the
// backend has no validated artifact configured, the route returns 503 and this
// helper throws an honest error the UI surfaces verbatim.

import { fetchSecureGateArtifact } from './securegateApi'

export type Artifact = {
  bytecode: string
  abi: unknown[]
}

function validateArtifactShape(raw: unknown): Artifact {
  if (!raw || typeof raw !== 'object') throw new Error('artifact: invalid response')
  const r = raw as Record<string, unknown>
  if (typeof r.bytecode !== 'string' || !/^0x[0-9a-fA-F]+$/.test(r.bytecode)) {
    throw new Error('artifact: bytecode missing or malformed')
  }
  if (!Array.isArray(r.abi) || r.abi.length === 0) {
    throw new Error('artifact: abi missing or empty')
  }
  return { bytecode: r.bytecode, abi: r.abi }
}

export async function fetchArtifact(): Promise<Artifact> {
  let body: unknown
  try {
    body = await fetchSecureGateArtifact()
  } catch (e) {
    throw new Error('artifact route unreachable: ' + (e as Error).message)
  }
  return validateArtifactShape(body)
}
