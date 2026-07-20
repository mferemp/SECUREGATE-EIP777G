// deviceBreadcrumb.ts (S07) — client poster for device breadcrumb / ping.
//
// Owner rule: repeated scans / downloads leave a coarse device breadcrumb so
// anti-abuse can notice repetition. The client sends ONLY a coarse subject (a K1
// bucket + a low-entropy device marker) — never a raw fingerprint, key, or seed.
// The backend (routes/trace.js) reduces the subject to an opaque trace key.

import { api } from './api'

// A low-entropy, non-identifying device marker: coarse platform + a per-session
// random tag. It is NOT a fingerprint and cannot correlate a user across sessions.
let sessionTag: string | null = null
function deviceMarker(): string {
  if (sessionTag == null) {
    const rand = Math.random().toString(36).slice(2, 8)
    const plat = typeof navigator !== 'undefined' ? (navigator.platform || 'web').slice(0, 8) : 'node'
    sessionTag = `${plat}:${rand}`
  }
  return sessionTag
}

export type BreadcrumbResult = {
  ok: boolean
  repeatCount: number
  flagged: boolean
}

async function post(kind: 'ping' | 'download', k1: string): Promise<BreadcrumbResult> {
  try {
    const subject = `${(k1 || 'anon').toLowerCase()}|${deviceMarker()}`
    const r = await fetch(api(`trace/${kind}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject }),
    })
    const d = await r.json()
    return { ok: r.ok, repeatCount: Number(d?.repeatCount) || 0, flagged: d?.flagged === true }
  } catch {
    return { ok: false, repeatCount: 0, flagged: false }
  }
}

export function pingDevice(k1: string): Promise<BreadcrumbResult> {
  return post('ping', k1)
}
export function markDownload(k1: string): Promise<BreadcrumbResult> {
  return post('download', k1)
}
