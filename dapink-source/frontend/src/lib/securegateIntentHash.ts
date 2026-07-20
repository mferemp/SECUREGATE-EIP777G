// SecureGate client-side intent-hash builder — canonical parity.
//
// Pure, framework-free module. It imports ONLY `ethers` (no relative imports)
// so it is directly importable by the Node 24 verifier as well as the browser.
//
// It mirrors the canonical contract's `computeIntentHash` EXACTLY:
//
//   ACTION_TYPEHASH = keccak256(
//     "SecureGateAction(uint8 kind,address token,uint256 id,uint256 amount,"
//     "address k3,bytes32 nonce,uint256 deadline,uint256 chainId,address verifyingContract)")
//
//   intentHash = keccak256(abi.encode(
//     ACTION_TYPEHASH, kind, token, id, amount, k3, nonce, deadline, chainId, verifyingContract))
//
// where (kind, id, amount) are the queue-normalised values:
//   ERC20   -> kind=0, id=0,        amount=amount
//   ERC721  -> kind=1, id=tokenId,  amount=1
//   ERC1155 -> kind=2, id=tokenId,  amount=amount
//
// This module NEVER holds a private key and NEVER performs network I/O.

import { ethers } from 'ethers'
import type { QueueKind } from './securegateTxBuilder'

// keccak256 of the exact canonical type string — computed, not hard-coded,
// so any drift in the string literal is impossible to hide.
export const ACTION_TYPE_STRING =
  'SecureGateAction(uint8 kind,address token,uint256 id,uint256 amount,' +
  'address k3,bytes32 nonce,uint256 deadline,uint256 chainId,address verifyingContract)'

export const ACTION_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(ACTION_TYPE_STRING))

const HEX32 = /^0x[0-9a-fA-F]{64}$/
const UINT256_MAX = (1n << 256n) - 1n

const KIND_TO_UINT: Record<QueueKind, number> = { ERC20: 0, ERC721: 1, ERC1155: 2 }

function requireUint256(value: bigint | string | number, label: string): bigint {
  const v = ethers.getBigInt(value)
  if (v < 0n || v > UINT256_MAX) throw new Error(`${label} must fit in uint256`)
  return v
}

export type IntentHashInput = {
  assetType: QueueKind
  token: string
  tokenId?: bigint | string | number
  amount?: bigint | string | number
  nonce: string
  deadline: number | bigint
  k3: string
  chainId: number | bigint
  verifyingContract: string
}

// Normalise (kind, id, amount) the same way the contract's queue functions do.
export function normaliseIntent(input: IntentHashInput): {
  kind: number
  token: string
  id: bigint
  amount: bigint
} {
  if (!(input.assetType in KIND_TO_UINT)) {
    throw new Error(`assetType must be one of ERC20|ERC721|ERC1155, got ${String(input.assetType)}`)
  }
  if (!ethers.isAddress(input.token)) throw new Error('token is not a valid address')
  const token = ethers.getAddress(input.token)
  if (token === ethers.ZeroAddress) throw new Error('token must be non-zero')

  const kind = KIND_TO_UINT[input.assetType]
  if (input.assetType === 'ERC20') {
    return { kind, token, id: 0n, amount: requireUint256(input.amount ?? 0n, 'amount') }
  }
  if (input.assetType === 'ERC721') {
    return { kind, token, id: requireUint256(input.tokenId ?? 0n, 'tokenId'), amount: 1n }
  }
  // ERC1155
  return {
    kind,
    token,
    id: requireUint256(input.tokenId ?? 0n, 'tokenId'),
    amount: requireUint256(input.amount ?? 0n, 'amount'),
  }
}

// Compute the intent hash exactly as the contract does. This is a PURE local
// computation — it does not require the intent to be queued on-chain, matching
// the contract's `view` `computeIntentHash`.
export function computeClientIntentHash(input: IntentHashInput): string {
  const { kind, token, id, amount } = normaliseIntent(input)

  if (!HEX32.test(input.nonce)) throw new Error('nonce must be a 32-byte 0x-hex value')
  if (input.nonce === ethers.ZeroHash) throw new Error('nonce must be non-zero')

  const deadline = ethers.getBigInt(input.deadline)
  if (deadline <= 0n) throw new Error('deadline must be a positive unix timestamp')

  const chainId = requireUint256(input.chainId, 'chainId')
  if (!ethers.isAddress(input.verifyingContract)) {
    throw new Error('verifyingContract is not a valid address')
  }
  const verifyingContract = ethers.getAddress(input.verifyingContract)
  if (verifyingContract === ethers.ZeroAddress) {
    throw new Error('verifyingContract must be non-zero (deploy the gate first)')
  }
  if (!ethers.isAddress(input.k3)) throw new Error('k3 is not a valid address')
  const k3 = ethers.getAddress(input.k3)
  if (k3 === ethers.ZeroAddress) throw new Error('k3 must be non-zero')

  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'uint8', 'address', 'uint256', 'uint256', 'address', 'bytes32', 'uint256', 'uint256', 'address'],
    [ACTION_TYPEHASH, kind, token, id, amount, k3, input.nonce, deadline, chainId, verifyingContract],
  )
  return ethers.keccak256(encoded)
}
