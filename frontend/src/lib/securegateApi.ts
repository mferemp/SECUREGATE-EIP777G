'use strict'

// securegateApi.ts
// All backend calls go through this module.
// App.tsx must not contain scattered fetch('/api/...') calls.

import { api } from './api'

// ── shared ────────────────────────────────────────────────────────────────────

async function post<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const res = await fetch(api(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data: T = await res.json().catch(() => ({} as T))
  return data
}

async function get<T = Record<string, unknown>>(path: string): Promise<T> {
  const res = await fetch(api(path))
  const data: T = await res.json().catch(() => ({} as T))
  return data
}

// ── chains ────────────────────────────────────────────────────────────────────

export type Chain = {
  slug: string
  name: string
  chainId: number
  nativeSymbol: string
  deploySupported: boolean
}

export async function fetchChains(): Promise<Chain[]> {
  const data = await get<{ chains?: Chain[] }>('chains')
  return Array.isArray(data?.chains) ? data.chains : []
}

// ── thank-you config ──────────────────────────────────────────────────────────

export type ThanksConfig = {
  handle?: string
  copyAddress?: string
}

export async function fetchThanksConfig(): Promise<ThanksConfig> {
  return get<ThanksConfig>('thank-you/config')
}

// ── passkey verify ────────────────────────────────────────────────────────────

export type VerifyResult = {
  verified?: boolean
  reason?: string
  error?: string
}

export async function verifyPasskeyRemote(k1: string, passkey: string): Promise<VerifyResult> {
  return post<VerifyResult>('passkeys/verify', { k1, passkey })
}

// ── admin passkey generate ────────────────────────────────────────────────────

export type AdminPasskeyResult = {
  passkey?: string
  disabled?: boolean
  reason?: string
  error?: string
}

export async function generateAdminPasskeyRemote(
  adminKey: string,
  k1: string
): Promise<AdminPasskeyResult> {
  return post<AdminPasskeyResult>('admin-passkey/generate', { adminKey, k1 })
}

// ── funding estimate ──────────────────────────────────────────────────────────

export type FundingResult = {
  estimateNative?: string
  nativeSymbol?: string
  error?: string
}

export async function fetchFunding(chain: string): Promise<{ ok: boolean; data: FundingResult }> {
  const res = await fetch(api(`funding/${chain}`))
  const data: FundingResult = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

// ── deploy signedTx ───────────────────────────────────────────────────────────
// Backend receives signedTx only. No private keys, no seeds, no K2/K3 private
// material, no override destination.

export type DeployResult = {
  txHash?: string
  error?: string
}

export async function deploySignedTx(
  chain: string,
  signedTx: string
): Promise<{ ok: boolean; data: DeployResult }> {
  const res = await fetch(api(`deploy/${chain}`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signedTx })
  })
  const data: DeployResult = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

// ── thank-you send ────────────────────────────────────────────────────────────

export type SendThanksResult = {
  sent?: boolean
  disabled?: boolean
  reason?: string
  error?: string
}

export async function sendThanksRemote(message: string): Promise<SendThanksResult> {
  return post<SendThanksResult>('thank-you/send', { message })
}

// ── trace (non-blocking) ──────────────────────────────────────────────────────

export async function traceEvent(kind: string, k1: string): Promise<void> {
  try {
    await post(`trace/${kind}`, { k1: k1 || 'anon' })
  } catch {
    // non-blocking
  }
}

// ── anti-abuse (non-blocking) ─────────────────────────────────────────────────

export async function antiAbuseEvent(action: string, subject: string): Promise<void> {
  try {
    await post('anti-abuse/event', { action, subject: subject || 'anon' })
  } catch {
    // non-blocking
  }
}
