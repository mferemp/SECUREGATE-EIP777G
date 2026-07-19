// adminPasskey.ts (S09) — client wrapper for the admin black-circle passkey.
//
// Owner rule: the admin black circle takes an ADMIN KEY + a K1 address and mints a
// K1-BOUND passkey (not per-chain). The admin key is sent once for verification and
// is never stored client-side. Honest reporting: if the backend has no admin key
// configured, generation is reported disabled (no fake success).

import { api } from './api'

export type AdminPasskeyResult = {
  generated: boolean
  disabled?: boolean
  passkey?: string
  k1?: string
  reason?: string
}

export async function generateAdminPasskeyRemote(adminKey: string, k1: string): Promise<AdminPasskeyResult> {
  try {
    const r = await fetch(api('admin-passkey/generate'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ adminKey, k1 }),
    })
    const d = await r.json()
    return {
      generated: d?.generated === true,
      disabled: d?.disabled === true,
      passkey: d?.passkey,
      k1: d?.k1,
      reason: d?.reason || d?.error,
    }
  } catch {
    return { generated: false, reason: 'network error' }
  }
}
