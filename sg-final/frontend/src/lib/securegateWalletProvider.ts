// SecureGate — injected wallet provider bridge for K2 authorization signing.
//
// This module lets the K2 authorizer sign the canonical EIP-712 typed-data
// authorization *inside their own wallet* (MetaMask / Rabby / any EIP-1193
// injected provider). It produces a `SignTypedDataFn` that plugs directly into
// the existing `signK2Authorization` helper — the typed-data payload is byte-
// for-byte the canonical K2 authorization structure, so the signature it
// returns recovers on-chain against `computeAuthorizationDigest`.
//
// SECURITY BOUNDARY (must not regress):
//   * The K2 private key NEVER leaves the wallet — we only ever call the
//     provider's `eth_signTypedData_v4` RPC method.
//   * We NEVER read, request, store, or transmit any private key / mnemonic.
//   * If no injected provider is available we throw the honest, exact message
//     `K2 signer not connected` — no fake signer, no silent stub.
//   * We never fabricate a signature and never return an all-zero signature.
//   * There is NO server-side signing path here: signing is the wallet's job.
//
// It imports ONLY `ethers` + the canonical K2 helper types, so it stays
// framework-free and directly testable under Node 24.

import { ethers } from 'ethers'
import type { SignTypedDataFn, TypedData } from './securegateK2Authorization'

export const K2_NOT_CONNECTED = 'K2 signer not connected'

// Minimal EIP-1193 shape we depend on. We deliberately do NOT depend on any
// wallet SDK — any injected provider that speaks `request` works.
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

// Locate an injected EIP-1193 provider without assuming a browser global exists
// (so the Node 24 verifier can inject a mock). Returns null when unavailable.
export function getInjectedProvider(candidate?: unknown): Eip1193Provider | null {
  const g: any =
    candidate ??
    (typeof globalThis !== 'undefined' ? (globalThis as any).ethereum : undefined)
  if (g && typeof g.request === 'function') return g as Eip1193Provider
  return null
}

export function hasInjectedProvider(candidate?: unknown): boolean {
  return getInjectedProvider(candidate) !== null
}

// Ask the injected wallet for its selected account. Never touches key material.
export async function connectInjectedK2(candidate?: unknown): Promise<string> {
  const provider = getInjectedProvider(candidate)
  if (!provider) throw new Error(K2_NOT_CONNECTED)
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as unknown
  if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== 'string') {
    throw new Error(K2_NOT_CONNECTED)
  }
  const addr = accounts[0]
  if (!ethers.isAddress(addr)) throw new Error(K2_NOT_CONNECTED)
  return ethers.getAddress(addr)
}

// Build a `SignTypedDataFn` backed by the injected wallet. The returned function
// serializes the canonical typed data and calls `eth_signTypedData_v4` so the
// wallet — and only the wallet — holds K2's key.
export function injectedSignTypedData(
  from: string,
  candidate?: unknown,
): SignTypedDataFn {
  const provider = getInjectedProvider(candidate)
  if (!provider) {
    // Return a function that fails honestly when invoked — never a fake signer.
    return async () => {
      throw new Error(K2_NOT_CONNECTED)
    }
  }
  if (!ethers.isAddress(from)) throw new Error('K2 signer address is invalid')
  const signer = ethers.getAddress(from)

  return async (
    domain: TypedData['domain'],
    types: TypedData['types'],
    message: TypedData['message'],
  ): Promise<string> => {
    // eth_signTypedData_v4 expects the full EIP-712 envelope incl. the
    // EIP712Domain type and stringified numeric fields.
    const payload = {
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: Number(domain.chainId),
        verifyingContract: domain.verifyingContract,
      },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...types,
      },
      primaryType: 'AuthorizeIntent',
      message: {
        intentHash: message.intentHash,
        deadline: message.deadline.toString(),
        nonce: message.nonce,
        k3: message.k3,
        chainId: message.chainId.toString(),
        verifyingContract: message.verifyingContract,
      },
    }
    const sig = (await provider.request({
      method: 'eth_signTypedData_v4',
      params: [signer, JSON.stringify(payload)],
    })) as unknown
    if (typeof sig !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(sig)) {
      throw new Error('K2 wallet returned a malformed signature')
    }
    if (/^0x0+$/.test(sig)) throw new Error('K2 wallet returned an all-zero signature')
    return sig
  }
}
