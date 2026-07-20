// thankYouEnvelope.ts (S18) — optional thank-you envelope, separate from K3.
//
// Owner rules:
//   * The thank-you envelope is COMPLETELY separate from K3. Its address is copy /
//     tip data only — NOT K3, NOT a fallback route, NOT a deploy parameter, NOT part
//     of any proof or execution logic.
//   * Sending is honest-capability: disabled unless the backend has X configured.

import { api } from './api.ts'

export type ThankYouConfig = {
  handle: string
  network: string
  copyAddress: string // copy-only; NEVER used as a recovery destination
}

export type ThankYouSendResult = {
  sent: boolean
  disabled?: boolean
  reason?: string
}

export async function fetchThankYouConfig(): Promise<ThankYouConfig> {
  try {
    const r = await fetch(api('thank-you/config'))
    const d = await r.json()
    return {
      handle: d?.handle || '@hope_ology',
      network: d?.network || 'EVM',
      copyAddress: d?.copyAddress || '',
    }
  } catch {
    return { handle: '@hope_ology', network: 'EVM', copyAddress: '' }
  }
}

export async function sendThankYou(message: string): Promise<ThankYouSendResult> {
  try {
    const r = await fetch(api('thank-you/send'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    const d = await r.json()
    return { sent: d?.sent === true, disabled: d?.disabled === true, reason: d?.reason }
  } catch {
    return { sent: false, reason: 'network error' }
  }
}

// Invariant the verifier asserts: the thank-you address is never K3. This is a
// pure guard — the two values must be kept distinct by construction.
export function thankYouIsNotK3(thankYouAddress: string, k3: string): boolean {
  const t = (thankYouAddress || '').trim().toLowerCase()
  const k = (k3 || '').trim().toLowerCase()
  if (!t) return true // no thank-you address at all is trivially "not K3"
  return t !== k
}
