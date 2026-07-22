// adminPasskey.ts (S09) — client wrapper for the admin black-circle passkey.
//
// Owner rule: the admin black circle takes an ADMIN KEY + a K1 address and mints a
// K1-BOUND passkey (not per-chain). The admin key is sent once for verification and
// is never stored client-side. Honest reporting: if the backend has no admin key
// configured, generation is reported disabled (no fake success).

import { generateAdminPasskeyRemote as _generateAdminPasskeyRemote } from './securegateApi'

export type AdminPasskeyResult = {
  generated: boolean
  disabled?: boolean
  passkey?: string
  k1?: string
  reason?: string
}

export async function generateAdminPasskeyRemote(adminKey: string, k1: string): Promise<AdminPasskeyResult> {
  try {
    const d = await _generateAdminPasskeyRemote(adminKey, k1)
    return {
      generated: !!d?.passkey,
      disabled: d?.disabled === true,
      passkey: d?.passkey,
      k1,
      reason: d?.reason || d?.error,
    }
  } catch {
    return { generated: false, reason: 'network error' }
  }
}
