import { api } from './api'

export type Chain = {
  slug: string
  name: string
  chainId: number
  nativeSymbol: string
  deploySupported: boolean
}

export type VerifyPasskeyResult = {
  verified: boolean
  reason?: string
  error?: string
}

export type AdminPasskeyResult = {
  generated?: boolean
  disabled?: boolean
  passkey?: string
  reason?: string
  error?: string
}

export type FundingEstimate = {
  chain: string
  nativeSymbol: string
  gasPriceWei: string
  estGas: string
  estimateNative: string
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(api(path), { ...init, headers })

  const text = await response.text()
  let data: unknown = {}

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: unknown }).error)
        : `request failed: ${response.status}`

    throw new ApiError(message, response.status, data)
  }

  return data as T
}

export function fetchChains(): Promise<{ chains: Chain[] }> {
  return request('chains')
}

export function fetchThanksConfig(): Promise<{
  handle: string
  network: string
  copyAddress: string
}> {
  return request('thank-you/config')
}

export function traceEvent(kind: string, subject: string): Promise<unknown> {
  return request(`trace/${encodeURIComponent(kind)}`, {
    method: 'POST',
    body: JSON.stringify({ subject }),
  }).catch(() => {})
}

export function antiAbuseEvent(action: string, subject: string): Promise<unknown> {
  return request('anti-abuse/event', {
    method: 'POST',
    body: JSON.stringify({ action, subject }),
  }).catch(() => {})
}

export function verifyPasskeyRemote(k1: string, passkey: string): Promise<VerifyPasskeyResult> {
  return request('passkeys/verify', {
    method: 'POST',
    body: JSON.stringify({ k1, passkey }),
  })
}

export function generateAdminPasskeyRemote(
  adminKey: string,
  k1: string
): Promise<AdminPasskeyResult> {
  return request('admin-passkey/generate', {
    method: 'POST',
    body: JSON.stringify({ adminKey, k1 }),
  })
}

export function fetchFunding(chain: string): Promise<FundingEstimate> {
  return request(`funding/${encodeURIComponent(chain)}`)
}

export function deploySignedTx(chain: string, signedTx: string): Promise<{ txHash: string }> {
  return request(`deploy/${encodeURIComponent(chain)}`, {
    method: 'POST',
    body: JSON.stringify({ signedTx: signedTx.trim() }),
  })
}

export function sendThanksRemote(message: string): Promise<{
  sent?: boolean
  disabled?: boolean
  reason?: string
  error?: string
}> {
  return request('thank-you/send', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}
