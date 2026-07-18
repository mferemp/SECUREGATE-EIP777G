// SecureGate K2 EIP-712 authorization builder — canonical parity.
//
// Pure, framework-free module. It imports ONLY `ethers` (no relative imports)
// so it is directly importable by the Node 24 verifier as well as the browser.
//
// It mirrors the canonical contract's `computeAuthorizationDigest` EXACTLY:
//
//   DOMAIN: name="SecureGate", version="1", chainId, verifyingContract=gate
//
//   AUTHORIZE_TYPEHASH = keccak256(
//     "AuthorizeIntent(bytes32 intentHash,uint256 deadline,bytes32 nonce,"
//     "address k3,uint256 chainId,address verifyingContract)")
//
//   structHash = keccak256(abi.encode(
//     AUTHORIZE_TYPEHASH, intentHash, deadline, nonce, k3, chainId, verifyingContract))
//   digest = keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
//
// The typed-data domain + types below reproduce this byte-for-byte through
// ethers' TypedDataEncoder, so the browser signature is verifiable on-chain.
//
// SECURITY BOUNDARY:
//   * This module NEVER accepts, holds, derives, or logs the K2 private key.
//   * Signing is delegated to an injected `signTypedData` function (a wallet).
//   * It only VERIFIES a signature client-side (recovers the signer address).

import { ethers } from 'ethers'

const HEX32 = /^0x[0-9a-fA-F]{64}$/
const SIG65 = /^0x[0-9a-fA-F]{130}$/

export const AUTHORIZE_TYPE_STRING =
  'AuthorizeIntent(bytes32 intentHash,uint256 deadline,bytes32 nonce,' +
  'address k3,uint256 chainId,address verifyingContract)'

// Computed, not hard-coded — mirrors the contract's AUTHORIZE_TYPEHASH.
export const AUTHORIZE_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(AUTHORIZE_TYPE_STRING))

export type AuthorizationParams = {
  intentHash: string
  deadline: number | bigint | string
  nonce: string
  k3: string
  chainId: number | bigint | string
  verifyingContract: string
}

export type TypedData = {
  domain: {
    name: string
    version: string
    chainId: bigint
    verifyingContract: string
  }
  types: Record<string, { name: string; type: string }[]>
  primaryType: 'AuthorizeIntent'
  message: {
    intentHash: string
    deadline: bigint
    nonce: string
    k3: string
    chainId: bigint
    verifyingContract: string
  }
}

function normalise(params: AuthorizationParams): TypedData['message'] & { verifyingContract: string } {
  if (!HEX32.test(params.intentHash)) throw new Error('intentHash must be a 32-byte 0x-hex value')
  if (!HEX32.test(params.nonce)) throw new Error('nonce must be a 32-byte 0x-hex value')
  if (params.nonce === ethers.ZeroHash) throw new Error('nonce must be non-zero')
  const deadline = ethers.getBigInt(params.deadline)
  if (deadline <= 0n) throw new Error('deadline must be a positive unix timestamp')
  const chainId = ethers.getBigInt(params.chainId)
  if (chainId <= 0n) throw new Error('chainId must be positive')
  if (!ethers.isAddress(params.k3)) throw new Error('k3 is not a valid address')
  const k3 = ethers.getAddress(params.k3)
  if (k3 === ethers.ZeroAddress) throw new Error('k3 must be non-zero')
  if (!ethers.isAddress(params.verifyingContract)) {
    throw new Error('verifyingContract is not a valid address')
  }
  const verifyingContract = ethers.getAddress(params.verifyingContract)
  if (verifyingContract === ethers.ZeroAddress) {
    throw new Error('verifyingContract must be non-zero (deploy the gate first)')
  }
  return { intentHash: params.intentHash, deadline, nonce: params.nonce, k3, chainId, verifyingContract }
}

// Build the EIP-712 typed-data payload a K2 wallet is asked to sign.
export function buildAuthorizationTypedData(params: AuthorizationParams): TypedData {
  const m = normalise(params)
  return {
    domain: {
      name: 'SecureGate',
      version: '1',
      chainId: m.chainId,
      verifyingContract: m.verifyingContract,
    },
    types: {
      AuthorizeIntent: [
        { name: 'intentHash', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'k3', type: 'address' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    },
    primaryType: 'AuthorizeIntent',
    message: {
      intentHash: m.intentHash,
      deadline: m.deadline,
      nonce: m.nonce,
      k3: m.k3,
      chainId: m.chainId,
      verifyingContract: m.verifyingContract,
    },
  }
}

// The EIP-712 digest that the contract recomputes and recovers against.
// Must equal `computeAuthorizationDigest(intentHash)` on the deployed gate.
export function authorizationDigest(params: AuthorizationParams): string {
  const td = buildAuthorizationTypedData(params)
  return ethers.TypedDataEncoder.hash(td.domain, td.types, td.message)
}

// Sign via an injected wallet callback. The signer function is a wallet's
// `signTypedData(domain, types, message)` — the private key stays in the wallet.
export type SignTypedDataFn = (
  domain: TypedData['domain'],
  types: TypedData['types'],
  message: TypedData['message'],
) => Promise<string>

export async function signK2Authorization(
  params: AuthorizationParams,
  signTypedData: SignTypedDataFn | undefined | null,
): Promise<string> {
  if (typeof signTypedData !== 'function') {
    throw new Error('K2 signer not connected — connect the K2 authorization wallet to sign')
  }
  const td = buildAuthorizationTypedData(params)
  const sig = await signTypedData(td.domain, td.types, td.message)
  if (!SIG65.test(sig)) throw new Error('K2 wallet returned a malformed signature')
  return sig
}

// Recover the signer of a K2 authorization signature and confirm it is K2.
// Rejects empty / all-zero / malformed / wrong-signer signatures honestly.
export function verifyK2AuthorizationSignature(
  params: AuthorizationParams,
  signature: string,
  expectedK2: string,
): { valid: boolean; recovered: string } {
  if (typeof signature !== 'string' || !SIG65.test(signature.trim())) {
    throw new Error('signature must be a 65-byte (0x + 130 hex) value')
  }
  const sig = signature.trim()
  // Reject the all-zero 65-byte signature outright — it recovers to nothing real.
  if (/^0x0+$/.test(sig)) throw new Error('signature is all-zero and cannot authorize')
  if (!ethers.isAddress(expectedK2)) throw new Error('expected K2 is not a valid address')

  const td = buildAuthorizationTypedData(params)
  let recovered: string
  try {
    recovered = ethers.verifyTypedData(td.domain, td.types, td.message, sig)
  } catch (e: any) {
    throw new Error(`signature does not recover to a valid address: ${e?.message ?? e}`)
  }
  const valid = ethers.getAddress(recovered) === ethers.getAddress(expectedK2)
  return { valid, recovered: ethers.getAddress(recovered) }
}
