// SecureGate browser transaction builder — canonical ABI only.
//
// Pure, framework-free module. It imports ONLY `ethers` (no relative imports)
// so it is directly importable by the Node 24 verifier as well as the browser.
//
// Boundaries enforced here:
//   * Only the canonical ABI methods are ever encoded.
//   * Forbidden old-ABI methods are rejected outright.
//   * K1/K2/K3 must be valid, non-zero, distinct EVM addresses.
//   * Nonces are 32-byte hex; deadlines must be in the future.
//   * The broadcast body carries `signedTx` ONLY — never key material.
//
// This module NEVER holds a private key and NEVER performs network I/O.

import { ethers } from 'ethers'

export const CANONICAL_METHODS = [
  'queueERC20',
  'queueERC721',
  'queueERC1155',
  'authorizeIntent',
  'executeIntent',
] as const

// Old ABI that must never be referenced by the builder.
export const FORBIDDEN_ABI = [
  'queueIntent',
  'forwardERC20',
  'computeEIP712Digest',
  'domainSeparator',
] as const

// Request-body field names that must never leave the browser.
export const FORBIDDEN_KEY_FIELDS = [
  'privateKey',
  'k1Key',
  'k2Key',
  'k3Key',
  'deployerKey',
  'mnemonic',
  'seed',
  'secret',
  'passphrase',
  'k1SessionKey',
  'k2SessionKey',
  'sessionKey',
]

export type Artifact = { version: string; abi: any[]; bytecode: string }
export type QueueKind = 'ERC20' | 'ERC721' | 'ERC1155'

const HEX32 = /^0x[0-9a-fA-F]{64}$/

// ---- artifact shape validation (used by the artifact fetcher) --------------
// Honest, strict validation of an /api/artifact/securegate response.
export function validateArtifactShape(obj: any): Artifact {
  if (!obj || typeof obj !== 'object') throw new Error('artifact response is not an object')
  const bytecode = typeof obj.bytecode === 'string' ? obj.bytecode.trim() : ''
  if (!/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode.length < 4) {
    throw new Error('artifact bytecode is not non-empty 0x-hex')
  }
  if (!Array.isArray(obj.abi) || obj.abi.length === 0) {
    throw new Error('artifact ABI is not a non-empty array')
  }
  const version = typeof obj.version === 'string' && obj.version ? obj.version : 'securegate@unknown'
  return { version, abi: obj.abi, bytecode }
}

// ---- canonical ABI guard ---------------------------------------------------
// Build an ethers Interface and assert the canonical methods are present and
// no forbidden old-ABI method exists. Returns the Interface for reuse.
export function assertCanonicalInterface(abi: any[]): ethers.Interface {
  const iface = new ethers.Interface(abi)
  const names = new Set<string>()
  iface.forEachFunction((f) => names.add(f.name))
  for (const bad of FORBIDDEN_ABI) {
    if (names.has(bad)) throw new Error(`forbidden old ABI method present: ${bad}`)
  }
  for (const need of CANONICAL_METHODS) {
    if (!names.has(need)) throw new Error(`canonical ABI method missing: ${need}`)
  }
  return iface
}

// ---- key validation --------------------------------------------------------
// Validate K1/K2/K3: each a valid EVM address, non-zero, all distinct.
export function validateKeys(k1: string, k2: string, k3: string): { k1: string; k2: string; k3: string } {
  const out: Record<string, string> = {}
  for (const [name, v] of Object.entries({ k1, k2, k3 })) {
    if (!ethers.isAddress(v)) throw new Error(`${name.toUpperCase()} is not a valid EVM address`)
    const cs = ethers.getAddress(v)
    if (cs === ethers.ZeroAddress) throw new Error(`${name.toUpperCase()} must not be the zero address`)
    out[name] = cs
  }
  const low = [out.k1, out.k2, out.k3].map((a) => a.toLowerCase())
  if (new Set(low).size !== 3) throw new Error('K1, K2 and K3 must all be different addresses')
  return { k1: out.k1, k2: out.k2, k3: out.k3 }
}

// ---- nonce / deadline helpers ---------------------------------------------
export function randomNonce32(): string {
  return ethers.hexlify(ethers.randomBytes(32))
}
function requireNonce(nonce: string): string {
  if (!HEX32.test(nonce)) throw new Error('nonce must be a 32-byte 0x-hex value')
  return nonce
}
export function requireFutureDeadline(deadline: number | bigint): bigint {
  const d = BigInt(deadline)
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (d <= now) throw new Error('deadline must be a future unix timestamp (seconds)')
  return d
}

// ---- deployment data -------------------------------------------------------
// Build the contract-creation calldata: bytecode ++ encoded constructor args.
// Returns { data, to: null } — a creation tx has no `to`.
export function buildDeployData(
  artifact: Artifact,
  keys: { k1: string; k2: string; k3: string },
): { data: string; to: null } {
  const iface = assertCanonicalInterface(artifact.abi)
  const { k1, k2, k3 } = validateKeys(keys.k1, keys.k2, keys.k3)
  const encodedArgs = iface.encodeDeploy([k1, k2, k3])
  const data = ethers.hexlify(ethers.concat([artifact.bytecode, encodedArgs]))
  return { data, to: null }
}

// ---- K1 action calldata (canonical methods only) --------------------------
export function encodeQueueERC20(
  abi: any[],
  token: string,
  amount: bigint | string,
  nonce: string,
  deadline: number | bigint,
): string {
  const iface = assertCanonicalInterface(abi)
  if (!ethers.isAddress(token)) throw new Error('token is not a valid address')
  return iface.encodeFunctionData('queueERC20', [
    ethers.getAddress(token),
    ethers.getBigInt(amount),
    requireNonce(nonce),
    requireFutureDeadline(deadline),
  ])
}

export function encodeQueueERC721(
  abi: any[],
  token: string,
  tokenId: bigint | string,
  nonce: string,
  deadline: number | bigint,
): string {
  const iface = assertCanonicalInterface(abi)
  if (!ethers.isAddress(token)) throw new Error('token is not a valid address')
  return iface.encodeFunctionData('queueERC721', [
    ethers.getAddress(token),
    ethers.getBigInt(tokenId),
    requireNonce(nonce),
    requireFutureDeadline(deadline),
  ])
}

export function encodeQueueERC1155(
  abi: any[],
  token: string,
  tokenId: bigint | string,
  amount: bigint | string,
  nonce: string,
  deadline: number | bigint,
): string {
  const iface = assertCanonicalInterface(abi)
  if (!ethers.isAddress(token)) throw new Error('token is not a valid address')
  return iface.encodeFunctionData('queueERC1155', [
    ethers.getAddress(token),
    ethers.getBigInt(tokenId),
    ethers.getBigInt(amount),
    requireNonce(nonce),
    requireFutureDeadline(deadline),
  ])
}

export function encodeAuthorizeIntent(abi: any[], intentHash: string, signature: string): string {
  const iface = assertCanonicalInterface(abi)
  if (!HEX32.test(intentHash)) throw new Error('intentHash must be a 32-byte 0x-hex value')
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) throw new Error('signature must be 0x-hex')
  return iface.encodeFunctionData('authorizeIntent', [intentHash, signature])
}

export function encodeExecuteIntent(abi: any[], intentHash: string): string {
  const iface = assertCanonicalInterface(abi)
  if (!HEX32.test(intentHash)) throw new Error('intentHash must be a 32-byte 0x-hex value')
  return iface.encodeFunctionData('executeIntent', [intentHash])
}

// ---- broadcast body --------------------------------------------------------
// The ONLY object shape that may be POSTed to the backend deploy route.
// Carries signedTx exclusively and refuses to embed any key-shaped field.
export function buildBroadcastBody(signedTx: string): { signedTx: string } {
  if (typeof signedTx !== 'string' || !/^0x[0-9a-fA-F]{100,}$/.test(signedTx.trim())) {
    throw new Error('signedTx must be a 0x-prefixed signed transaction')
  }
  return { signedTx: signedTx.trim() }
}

// Defense-in-depth: throw if any object about to be sent carries key material.
export function assertNoKeyMaterial(body: Record<string, any>): void {
  if (!body || typeof body !== 'object') return
  for (const k of Object.keys(body)) {
    if (FORBIDDEN_KEY_FIELDS.includes(k)) throw new Error(`refusing to send key-shaped field: ${k}`)
    if (/priv|secret|mnemonic|seed|passphrase|sessionkey/i.test(k)) {
      throw new Error(`refusing to send key-shaped field: ${k}`)
    }
  }
}
