import { useEffect, useRef, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { api } from './lib/api'
import { fetchArtifact } from './lib/securegateArtifact'
import {
  buildDeployData,
  validateKeys,
  encodeQueueERC20,
  encodeQueueERC721,
  encodeQueueERC1155,
  encodeAuthorizeIntent,
  encodeExecuteIntent,
  randomNonce32,
} from './lib/securegateTxBuilder'
import { computeClientIntentHash } from './lib/securegateIntentHash'
import {
  buildAuthorizationTypedData,
  verifyK2AuthorizationSignature,
  signK2Authorization,
} from './lib/securegateK2Authorization'
import {
  connectInjectedK2,
  injectedSignTypedData,
  hasInjectedProvider,
  K2_NOT_CONNECTED,
} from './lib/securegateWalletProvider'
import { deriveAddress, signLocally, broadcastBody } from './lib/securegateSessionKeys'
import {
  PENDING_PLACEHOLDER_LAYERS,
  attemptScan,
  attemptLinkDevice,
  enterPasskey,
  generateAdminPasskey,
  canExecuteIntent,
} from './lib/placeholderGates'
import { PROGRESS_LABELS as UI_PROGRESS_LABELS, HUMAN_ROUTE_MSG as UI_HUMAN_ROUTE_MSG } from './lib/uiLabels'
import { pingDevice } from './lib/deviceBreadcrumb'
import { verifyPasskey } from './lib/passkeyAccess'
import { generateAdminPasskeyRemote } from './lib/adminPasskey'
import { twoFactorStatus } from './lib/twoFactorProactive'
import { enforceK3 } from './lib/k3Enforcement'
import { isBackendSafe, backendDeployBody } from './lib/recoveryCleanupSweep'
import { sweepTargetsOnlyK3 } from './lib/k3ExecutionSweep'
import { thankYouIsNotK3 } from './lib/thankYouEnvelope'

type Chain = {
  slug: string
  name: string
  chainId: number
  nativeSymbol: string
  deploySupported: boolean
}

type RuntimeStatus = {
  status: string
  node: string
  node24: boolean
  uptimeSec: number
}

type FundingSnapshot = {
  chain: string
  nativeSymbol: string
  estimateNative: string
  estGas: string
}

type Toast = { id: number; kind: 'info' | 'warn' | 'error'; text: string }
type TabKey = 'recovery' | 'protection' | 'admin' | 'status'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recovery', label: 'Recovery' },
  { key: 'protection', label: 'Protection' },
  { key: 'admin', label: 'Admin' },
  { key: 'status', label: 'Status' },
]

// Progress labels + human-route copy come from the single source of truth in
// ./lib/uiLabels (proven by verify-ui-baseline.cjs). Re-bound locally so existing
// references keep working.
const PROGRESS_LABELS = UI_PROGRESS_LABELS

const MAX_DEVICE_ATTEMPTS = 3

// Honest, non-faked placeholder statuses. The gate-specific copy is owned by
// ./lib/placeholderGates (single source of truth, proven by verify-placeholder-gates.cjs);
// only the local "human recovery route" fallback string lives here.
const HUMAN_ROUTE_MSG = UI_HUMAN_ROUTE_MSG

// Layers shown in the Status tab: what is connected vs an honest "not yet".
const CONNECTED_LAYERS = ['Chain registry (/api/chains)', 'Funding estimate (/api/funding)', 'Anti-abuse events (/api/anti-abuse)', 'Thank-you envelope (/api/thank-you)', 'Browser deploy builder (signedTx)', 'Browser K1 action builder (signedTx)', 'Browser K2 authorization builder (EIP-712, signedTx)']
// The pending placeholder layers come straight from the honesty-gate library.
const PENDING_LAYERS = PENDING_PLACEHOLDER_LAYERS

const inputStyle: React.CSSProperties = {
  background: 'var(--sg-panel-2)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
  boxShadow: '0 0 14px rgba(150,90,255,0.16)',
}

const label: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cyan' | 'gold' | 'plain' | 'pink' }) {
  const { tone = 'plain', style, disabled, ...rest } = props
  const tones: Record<string, React.CSSProperties> = {
    cyan: { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' },
    gold: { borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)' },
    pink: { borderColor: 'var(--sg-pink)', color: 'var(--sg-pink)' },
    plain: { borderColor: 'var(--border-primary)', color: 'var(--text-primary)' },
  }
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        background: 'var(--sg-panel-2)',
        border: '1px solid',
        borderRadius: 10,
        padding: '10px 14px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        ...tones[tone],
        ...style,
      }}
    />
  )
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 20,
}

function formatUptime(uptimeSec: number) {
  if (uptimeSec <= 0) return 'just started'
  if (uptimeSec < 60) return `${uptimeSec}s`
  if (uptimeSec < 3600) return `${Math.floor(uptimeSec / 60)}m`
  return `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
}

function getRuntimeTitle(runtimePhase: 'loading' | 'ready' | 'error', runtime: RuntimeStatus | null) {
  if (runtimePhase === 'ready' && runtime?.node24) return 'NODE 24 READY'
  if (runtimePhase === 'error') return 'RUNTIME TELEMETRY OFFLINE'
  return 'CHECKING RUNTIME'
}

function getRuntimeDescription(runtimePhase: 'loading' | 'ready' | 'error', runtime: RuntimeStatus | null) {
  if (runtimePhase === 'ready' && runtime) return `${runtime.node} · uptime ${formatUptime(runtime.uptimeSec)}`
  if (runtimePhase === 'error') return 'Backend runtime could not be loaded from /api/runtime.'
  return 'Backend runtime is reported through /api/runtime.'
}

export default function App() {
  const [chains, setChains] = useState<Chain[]>([])
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [runtimePhase, setRuntimePhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedChain, setSelectedChain] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('recovery')
  const [toasts, setToasts] = useState<Toast[]>([])

  // Auth-Gate state
  const [k1Address, setK1Address] = useState('')
  const [deviceAttempts, setDeviceAttempts] = useState(0)
  const [authMsg, setAuthMsg] = useState('')
  const [humanRoute, setHumanRoute] = useState('')
  const [passkey, setPasskey] = useState('')

  // Recovery form — session-only sensitive values. NEVER sent to the backend.
  const [k1SessionKey, setK1SessionKey] = useState('')
  const [deployerBurnerKey, setDeployerBurnerKey] = useState('')
  const [k2Address, setK2Address] = useState('')
  const [k3Address, setK3Address] = useState('')
  const [fundingPanel, setFundingPanel] = useState('')
  const [deployStatus, setDeployStatus] = useState('')
  const [activeStep, setActiveStep] = useState(-1)

  // Browser K1 action builder — build + locally sign queue* txs (session-only key).
  const [gateAddress, setGateAddress] = useState('')
  const [actionKind, setActionKind] = useState<'ERC20' | 'ERC721' | 'ERC1155'>('ERC20')
  const [actionToken, setActionToken] = useState('')
  const [actionAmount, setActionAmount] = useState('')
  const [actionTokenId, setActionTokenId] = useState('')
  const [actionStatus, setActionStatus] = useState('')

  // K2 authorization (EIP-712) — session-only. K2 private key is NEVER entered
  // here: the K2 wallet signs the typed data externally and the signature is
  // pasted back for client-side verification before authorizeIntent is built.
  const [lastIntent, setLastIntent] = useState<null | {
    assetType: 'ERC20' | 'ERC721' | 'ERC1155'
    token: string
    tokenId: string
    amount: string
    nonce: string
    deadline: number
  }>(null)
  const [authIntentHash, setAuthIntentHash] = useState('')
  const [authTypedData, setAuthTypedData] = useState('')
  const [authK2Expected, setAuthK2Expected] = useState('')
  const [authK2Signature, setAuthK2Signature] = useState('')
  const [authVerified, setAuthVerified] = useState(false)
  const [authStatus, setAuthStatus] = useState('')
  // Injected-wallet (EIP-1193) K2 signing — the K2 wallet signs in-wallet; the
  // key never enters this app. Pasted-signature flow remains the fallback.
  const [k2WalletAddress, setK2WalletAddress] = useState('')

  // Admin passkey generation (honest placeholder only)
  const [adminKey, setAdminKey] = useState('')
  const [adminK1, setAdminK1] = useState('')
  const [adminStatus, setAdminStatus] = useState('')

  // Thank-you envelope
  const [thanksAddress, setThanksAddress] = useState('')
  const [thanksHandle, setThanksHandle] = useState('@hope_ology')
  const [thanksMessage, setThanksMessage] = useState('')
  const [thanksStatus, setThanksStatus] = useState('')
  const [latestFunding, setLatestFunding] = useState<FundingSnapshot | null>(null)

  const devicesLocked = deviceAttempts >= MAX_DEVICE_ATTEMPTS
  // The recovery/protection/admin/status workspace is revealed only AFTER the
  // Auth-Gate resolves (a verified K1-bound passkey, or the human-fallback
  // route after repeated device failures). Until then the landing view is the
  // STANDALONE OPERATION canvas — the tabbed workspace is never the landing.
  const dashboardUnlocked = humanRoute.trim() !== ''
  const sessionScratch = useRef<Record<string, string>>({})
  const toastId = useRef(0)
  const selectedChainMeta = chains.find((c) => c.slug === selectedChain)
  const deployableChains = chains.filter((c) => c.deploySupported)
  const runtimeTitle = getRuntimeTitle(runtimePhase, runtime)
  const runtimeDescription = getRuntimeDescription(runtimePhase, runtime)
  const chainSummary = chains.length
    ? `${chains.slice(0, 3).map((chain) => chain.name).join(' · ')}${chains.length > 3 ? ` · +${chains.length - 3} more` : ''}`
    : 'SecureGate is loading /api/chains.'

  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  useEffect(() => {
    fetch(api('chains'))
      .then((r) => r.json())
      .then((d) => setChains(Array.isArray(d?.chains) ? d.chains : []))
      .catch(() => setChains([]))
    fetch(api('runtime'))
      .then((r) => r.json())
      .then((d) => {
        setRuntime({
          status: typeof d?.status === 'string' ? d.status : 'error',
          node: typeof d?.node === 'string' ? d.node : 'unknown',
          node24: Boolean(d?.node24),
          uptimeSec: typeof d?.uptimeSec === 'number' ? d.uptimeSec : 0,
        })
        setRuntimePhase('ready')
      })
      .catch(() => {
        setRuntime(null)
        setRuntimePhase('error')
      })
    fetch(api('thank-you/config'))
      .then((r) => r.json())
      .then((d) => {
        if (d?.handle) setThanksHandle(d.handle)
        if (d?.copyAddress) setThanksAddress(d.copyAddress)
      })
      .catch(() => {})
  }, [])

  async function recordAbuse(action: string, subject: string) {
    try {
      const r = await fetch(api('anti-abuse/event'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, subject }),
      })
      return await r.json()
    } catch {
      return null
    }
  }

  // SCAN / LINK DEVICE are honest placeholders: they route through the honesty
  // gates, which structurally cannot return a verified/unlocking result.
  async function deviceAttempt(kind: 'scan' | 'link') {
    if (devicesLocked) return
    const action = kind === 'scan' ? 'auth_gate_attempt' : 'link_device_attempt'
    await recordAbuse(action, k1Address || 'anon')
    const next = deviceAttempts + 1
    setDeviceAttempts(next)
    const result = kind === 'scan' ? attemptScan() : attemptLinkDevice()
    // result.verified is the literal false — nothing here can unlock the gate.
    // Leave a coarse device breadcrumb so repeated scans are noticed (no raw
    // fingerprint leaves the browser).
    void pingDevice(k1Address || 'anon')
    setAuthMsg(result.message)
    pushToast('warn', result.message)
    if (next >= MAX_DEVICE_ATTEMPTS) {
      setHumanRoute(HUMAN_ROUTE_MSG)
      pushToast('warn', 'Device checks disabled for this session.')
    }
  }

  async function passkeyEnter() {
    await recordAbuse('passkey_verify', k1Address || 'anon')
    // Honest local placeholder status (never verifies on its own)...
    const result = enterPasskey()
    setAuthMsg(result.message)
    pushToast('warn', result.message)
    // ...plus the real K1-bound passkey check against the backend lane. A verified
    // passkey is a human-route access signal only — it never authorizes an intent.
    if (passkey.trim() && k1Address.trim()) {
      const remote = await verifyPasskey(k1Address, passkey)
      if (remote.verified) {
        setHumanRoute('Passkey verified for this K1 — human recovery route unlocked.')
        pushToast('info', 'Passkey verified for this K1.')
      }
    }
  }

  async function handleFundingCheck() {
    if (!selectedChain) {
      setFundingPanel('Select a chain first.')
      pushToast('info', 'Pick a network in the topbar first.')
      return
    }
    setActiveStep(0)
    setFundingPanel('Funding check…')
    await recordAbuse('funding_check', k1Address || 'anon')
    try {
      const r = await fetch(api(`funding/${selectedChain}`))
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'estimate failed')
      setFundingPanel(`Estimated deploy cost: ${d.estimateNative} ${d.nativeSymbol} (gas ${d.estGas})`)
      setLatestFunding({
        chain: selectedChain,
        nativeSymbol: d.nativeSymbol,
        estimateNative: d.estimateNative,
        estGas: d.estGas,
      })
      pushToast('info', 'Funding estimate updated.')
    } catch (e) {
      setFundingPanel('Funding check unavailable: ' + (e as Error).message)
      setLatestFunding(null)
      pushToast('error', 'Funding check unavailable.')
    }
  }

  // Read-only RPC bridge — backend keeps the URL; the browser only asks for
  // nonce/gas/chainId-style reads. Never used for broadcasting.
  async function rpcRead(slug: string, method: string, params: unknown[]) {
    const r = await fetch(api(`rpc/${slug}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, params }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d?.error || 'rpc error')
    return d.result as string
  }

  // Broadcast a locally-signed tx. The backend receives signedTx ONLY.
  async function broadcast(slug: string, signedTx: string): Promise<string> {
    // Build the only allowed payload shape and fail closed if anything key-shaped
    // ever tried to ride along (defense in depth; the backend also refuses).
    const body = backendDeployBody(signedTx)
    if (!isBackendSafe(body as unknown as Record<string, unknown>)) {
      throw new Error('refusing to send: payload carries key material')
    }
    const r = await fetch(api(`deploy/${slug}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, ...broadcastBody(signedTx) }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d?.error || 'broadcast failed')
    if (!d?.txHash) throw new Error('no txHash returned by RPC')
    return d.txHash as string
  }

  // Build EIP-1559 fee + nonce fields from read-only RPC calls.
  async function buildTxCommon(slug: string, from: string, to: string | null, data: string) {
    const nonceHex = await rpcRead(slug, 'eth_getTransactionCount', [from, 'pending'])
    const gasPriceHex = await rpcRead(slug, 'eth_gasPrice', [])
    let gasHex: string
    try {
      const estParams = to ? [{ from, to, data }] : [{ from, data }]
      gasHex = await rpcRead(slug, 'eth_estimateGas', estParams)
    } catch {
      gasHex = to ? '0x30d40' /* 200k */ : '0x2625a0' /* 2.5M */
    }
    const gasPrice = BigInt(gasPriceHex)
    return {
      nonce: Number(BigInt(nonceHex)),
      gasLimit: BigInt(gasHex),
      maxFeePerGas: gasPrice * 2n,
      maxPriorityFeePerGas: gasPrice,
    }
  }

  // Browser deploy builder: fetch canonical artifact, build creation calldata,
  // sign locally with the deployer burner key, broadcast signedTx only.
  async function handleDeployGate() {
    setDeployStatus('')
    if (!selectedChain || !selectedChainMeta) {
      setDeployStatus('Select a network in the topbar first.')
      pushToast('info', 'Pick a network first.')
      return
    }
    if (!deployerBurnerKey.trim()) {
      setDeployStatus('Enter a deployer burner key (session-only, never sent).')
      return
    }
    let keys
    try {
      keys = validateKeys(k1Address, k2Address, k3Address)
    } catch (e) {
      setDeployStatus('Key check failed: ' + (e as Error).message)
      pushToast('error', 'K1/K2/K3 check failed.')
      return
    }
    try {
      setActiveStep(1)
      setDeployStatus('Fetching canonical artifact…')
      const artifact = await fetchArtifact()
      const { data } = buildDeployData(artifact, keys)
      const from = deriveAddress(deployerBurnerKey)
      setActiveStep(2)
      setDeployStatus(`Building deployment tx locally (deployer ${from.slice(0, 8)}…)…`)
      const common = await buildTxCommon(selectedChain, from, null, data)
      const txReq: ethers.TransactionRequest = {
        type: 2,
        chainId: selectedChainMeta.chainId,
        data,
        value: 0n,
        ...common,
      }
      setActiveStep(3)
      setDeployStatus('Signing locally in the browser…')
      const { signedTx } = await signLocally(deployerBurnerKey, txReq)
      setDeployStatus('Broadcasting signed transaction…')
      const txHash = await broadcast(selectedChain, signedTx)
      setActiveStep(4)
      setDeployStatus(`Deployed — tx ${txHash}`)
      setDeployerBurnerKey('') // scrub signer key immediately after use
      await recordAbuse('deploy_broadcast', from)
      pushToast('info', 'Deployment broadcast.')
    } catch (e) {
      setDeployStatus('Deploy failed: ' + (e as Error).message)
      pushToast('error', 'Deploy failed.')
    }
  }

  // Browser K1 action builder: build a canonical queue* calldata, sign locally
  // with the compromised K1 key (session-only), broadcast signedTx only.
  async function handleK1Action() {
    setActionStatus('')
    if (!selectedChain || !selectedChainMeta) {
      setActionStatus('Select a network in the topbar first.')
      return
    }
    if (!ethers.isAddress(gateAddress)) {
      setActionStatus('Enter the deployed gate contract address.')
      return
    }
    if (!k1SessionKey.trim()) {
      setActionStatus('Enter the compromised K1 key (session-only, never sent).')
      return
    }
    try {
      const artifact = await fetchArtifact()
      const nonce = randomNonce32()
      const deadline = Math.floor(Date.now() / 1000) + 3600
      let data: string
      if (actionKind === 'ERC20') {
        data = encodeQueueERC20(artifact.abi, actionToken, actionAmount || '0', nonce, deadline)
      } else if (actionKind === 'ERC721') {
        data = encodeQueueERC721(artifact.abi, actionToken, actionTokenId || '0', nonce, deadline)
      } else {
        data = encodeQueueERC1155(artifact.abi, actionToken, actionTokenId || '0', actionAmount || '0', nonce, deadline)
      }
      const from = deriveAddress(k1SessionKey)
      const to = ethers.getAddress(gateAddress)
      setActionStatus(`Building ${actionKind} queue tx locally (K1 ${from.slice(0, 8)}…)…`)
      const common = await buildTxCommon(selectedChain, from, to, data)
      const txReq: ethers.TransactionRequest = {
        type: 2,
        chainId: selectedChainMeta.chainId,
        to,
        data,
        value: 0n,
        ...common,
      }
      const { signedTx } = await signLocally(k1SessionKey, txReq)
      setActionStatus('Broadcasting signed K1 action…')
      const txHash = await broadcast(selectedChain, signedTx)
      setActionStatus(`Queued ${actionKind} — tx ${txHash} (nonce ${nonce.slice(0, 10)}…)`)
      setK1SessionKey('') // scrub K1 key immediately after use
      // Persist the queued intent parameters so the K2 authorization panel can
      // recompute the exact intentHash. No key material is stored here.
      setLastIntent({
        assetType: actionKind,
        token: ethers.getAddress(actionToken),
        tokenId: actionTokenId || '0',
        amount: actionAmount || '0',
        nonce,
        deadline,
      })
      setAuthIntentHash('')
      setAuthTypedData('')
      setAuthK2Signature('')
      setAuthVerified(false)
      setAuthStatus('Intent queued. Compute its hash below to prepare K2 authorization.')
      pushToast('info', 'K1 action broadcast.')
    } catch (e) {
      setActionStatus('K1 action failed: ' + (e as Error).message)
      pushToast('error', 'K1 action failed.')
    }
  }

  // Compute the client-side intent hash for the last queued intent. This mirrors
  // the canonical contract's computeIntentHash byte-for-byte (verified on-chain
  // by scripts/verify-k2-intent-builders.cjs). Pure local computation.
  function handleComputeIntentHash() {
    setAuthStatus('')
    setAuthVerified(false)
    if (!lastIntent) {
      setAuthStatus('Queue a K1 intent first.')
      return
    }
    if (!selectedChainMeta) {
      setAuthStatus('Select a network first.')
      return
    }
    if (!ethers.isAddress(gateAddress)) {
      setAuthStatus('Enter the deployed gate contract address above.')
      return
    }
    if (!ethers.isAddress(k3Address)) {
      setAuthStatus('Enter the K3 forced-recovery address (from deployment).')
      return
    }
    try {
      const params = {
        assetType: lastIntent.assetType,
        token: lastIntent.token,
        tokenId: lastIntent.tokenId,
        amount: lastIntent.amount,
        nonce: lastIntent.nonce,
        deadline: lastIntent.deadline,
        k3: ethers.getAddress(k3Address),
        chainId: selectedChainMeta.chainId,
        verifyingContract: ethers.getAddress(gateAddress),
      }
      const intentHash = computeClientIntentHash(params)
      const td = buildAuthorizationTypedData({
        intentHash,
        deadline: lastIntent.deadline,
        nonce: lastIntent.nonce,
        k3: ethers.getAddress(k3Address),
        chainId: selectedChainMeta.chainId,
        verifyingContract: ethers.getAddress(gateAddress),
      })
      setAuthIntentHash(intentHash)
      setAuthTypedData(
        JSON.stringify(
          { domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message },
          (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
          2,
        ),
      )
      setAuthStatus('Intent hash computed. Have K2 sign the typed data, then paste the signature below.')
    } catch (e) {
      setAuthStatus('Compute failed: ' + (e as Error).message)
    }
  }

  // Sign the K2 authorization via an injected wallet (EIP-1193). The K2 private
  // key stays in the wallet — we only ever call eth_signTypedData_v4. If no
  // provider is present we surface the honest `K2 signer not connected` error.
  async function handleSignWithK2Wallet() {
    setAuthStatus('')
    setAuthVerified(false)
    if (!authIntentHash || !lastIntent || !selectedChainMeta) {
      setAuthStatus('Compute the intent hash first.')
      return
    }
    if (!hasInjectedProvider()) {
      setAuthStatus(K2_NOT_CONNECTED)
      pushToast('error', K2_NOT_CONNECTED)
      return
    }
    try {
      const from = await connectInjectedK2()
      setK2WalletAddress(from)
      if (!authK2Expected) setAuthK2Expected(from)
      const signer = injectedSignTypedData(from)
      const sig = await signK2Authorization(
        {
          intentHash: authIntentHash,
          deadline: lastIntent.deadline,
          nonce: lastIntent.nonce,
          k3: ethers.getAddress(k3Address),
          chainId: selectedChainMeta.chainId,
          verifyingContract: ethers.getAddress(gateAddress),
        },
        signer,
      )
      setAuthK2Signature(sig)
      setAuthStatus(`K2 wallet ${from.slice(0, 10)}… signed. Verify it recovers K2 next.`)
      pushToast('info', 'K2 wallet signed the authorization.')
    } catch (e) {
      setAuthStatus('K2 wallet signing failed: ' + (e as Error).message)
      pushToast('error', 'K2 wallet signing failed.')
    }
  }

  // Verify a pasted K2 signature recovers the expected K2 address. The K2 key is
  // never entered here — only the resulting signature is checked client-side.
  function handleVerifyK2Signature() {
    setAuthStatus('')
    setAuthVerified(false)
    if (!authIntentHash) {
      setAuthStatus('Compute the intent hash first.')
      return
    }
    if (!ethers.isAddress(authK2Expected)) {
      setAuthStatus('Enter the expected K2 address to verify against.')
      return
    }
    try {
      const { valid, recovered } = verifyK2AuthorizationSignature(
        {
          intentHash: authIntentHash,
          deadline: lastIntent!.deadline,
          nonce: lastIntent!.nonce,
          k3: ethers.getAddress(k3Address),
          chainId: selectedChainMeta!.chainId,
          verifyingContract: ethers.getAddress(gateAddress),
        },
        authK2Signature,
        authK2Expected,
      )
      if (valid) {
        setAuthVerified(true)
        setAuthStatus(`Signature verified — recovers to K2 ${recovered.slice(0, 10)}…`)
        pushToast('info', 'K2 signature verified.')
      } else {
        setAuthStatus(`Signature is valid but recovers to ${recovered} — NOT the expected K2. Rejected.`)
        pushToast('error', 'K2 signature mismatch.')
      }
    } catch (e) {
      setAuthStatus('Verification failed: ' + (e as Error).message)
      pushToast('error', 'K2 signature invalid.')
    }
  }

  // Build + broadcast authorizeIntent(intentHash, K2 signature). Sent by the K1
  // session key (pays gas); the authorization is K2's signature. signedTx only.
  async function handleAuthorizeIntent() {
    setAuthStatus('')
    if (!authVerified) {
      setAuthStatus('Verify the K2 signature before authorizing.')
      return
    }
    if (!selectedChain || !selectedChainMeta) {
      setAuthStatus('Select a network first.')
      return
    }
    if (!k1SessionKey.trim()) {
      setAuthStatus('Enter the K1 key (session-only) to pay gas for authorizeIntent.')
      return
    }
    try {
      const artifact = await fetchArtifact()
      const data = encodeAuthorizeIntent(artifact.abi, authIntentHash, authK2Signature.trim())
      const from = deriveAddress(k1SessionKey)
      const to = ethers.getAddress(gateAddress)
      setAuthStatus(`Building authorizeIntent tx locally (from ${from.slice(0, 8)}…)…`)
      const common = await buildTxCommon(selectedChain, from, to, data)
      const txReq: ethers.TransactionRequest = {
        type: 2,
        chainId: selectedChainMeta.chainId,
        to,
        data,
        value: 0n,
        ...common,
      }
      const { signedTx } = await signLocally(k1SessionKey, txReq)
      setAuthStatus('Broadcasting signed authorizeIntent…')
      const txHash = await broadcast(selectedChain, signedTx)
      setK1SessionKey('')
      setAuthStatus(`Authorized — tx ${txHash}. K1 may now executeIntent to force recovery to K3.`)
      pushToast('info', 'authorizeIntent broadcast.')
    } catch (e) {
      setAuthStatus('authorizeIntent failed: ' + (e as Error).message)
      pushToast('error', 'authorizeIntent failed.')
    }
  }

  // Build + broadcast executeIntent(intentHash) — K1-only, forces the asset to
  // the immutable K3 destination. signedTx only.
  async function handleExecuteIntent() {
    setAuthStatus('')
    if (!authIntentHash) {
      setAuthStatus('Compute + authorize the intent first.')
      return
    }
    // Execution is gated EXCLUSIVELY on a verified K2 EIP-712 signature. Passing
    // an empty placeholder-results array proves those honest placeholders (SCAN,
    // LINK DEVICE, passkey, admin, 2FA) can never contribute to this decision.
    if (!canExecuteIntent(authVerified, [])) {
      setAuthStatus('Execution is locked until the K2 signature is verified. No placeholder can unlock it.')
      return
    }
    if (!selectedChain || !selectedChainMeta) {
      setAuthStatus('Select a network first.')
      return
    }
    if (!k1SessionKey.trim()) {
      setAuthStatus('Enter the K1 key (session-only) to execute.')
      return
    }
    // Enforce the immutable K3 destination. If a K3 address is present, the sweep
    // target MUST resolve to K3 and any alternate is captured/ignored (neutral copy).
    if (k3Address.trim()) {
      const evalK3 = enforceK3(k3Address, k3Address)
      const onlyK3 = sweepTargetsOnlyK3({ intentHash: authIntentHash, k3: k3Address })
      if (!onlyK3 || evalK3.effectiveDestination !== k3Address.trim().toLowerCase()) {
        setAuthStatus(evalK3.message)
        return
      }
    }
    try {
      const artifact = await fetchArtifact()
      const data = encodeExecuteIntent(artifact.abi, authIntentHash)
      const from = deriveAddress(k1SessionKey)
      const to = ethers.getAddress(gateAddress)
      const common = await buildTxCommon(selectedChain, from, to, data)
      const txReq: ethers.TransactionRequest = {
        type: 2,
        chainId: selectedChainMeta.chainId,
        to,
        data,
        value: 0n,
        ...common,
      }
      const { signedTx } = await signLocally(k1SessionKey, txReq)
      setAuthStatus('Broadcasting signed executeIntent…')
      const txHash = await broadcast(selectedChain, signedTx)
      setK1SessionKey('')
      setAuthStatus(`Executed — tx ${txHash}. Asset forced to K3.`)
      pushToast('info', 'executeIntent broadcast.')
    } catch (e) {
      setAuthStatus('executeIntent failed: ' + (e as Error).message)
      pushToast('error', 'executeIntent failed.')
    }
  }

  // Admin passkey generation — the admin black circle mints a K1-BOUND passkey
  // (not per-chain) from an admin key + K1. The honest local placeholder reports
  // status; the backend performs the real mint when an admin key is configured,
  // and reports "disabled" (no fake success) when it is not.
  async function generatePasskey() {
    if (!adminKey.trim() || !adminK1.trim()) {
      setAdminStatus('Enter both the admin key and a K1 address.')
      return
    }
    const local = generateAdminPasskey(true)
    setAdminStatus(local.message)
    const remote = await generateAdminPasskeyRemote(adminKey, adminK1)
    setAdminKey('') // scrub admin key immediately after use
    if (remote.generated && remote.passkey) {
      setAdminStatus(`K1-bound passkey minted for ${remote.k1}: ${remote.passkey}`)
      pushToast('info', 'K1-bound passkey minted.')
    } else if (remote.disabled) {
      setAdminStatus('Admin minting is not configured on this deployment.')
      pushToast('warn', 'Admin minting not configured.')
    } else {
      pushToast('warn', remote.reason || local.message)
    }
  }

  // SCRUB clears every sensitive field and session-only variable.
  function scrub() {
    setK1SessionKey('')
    setDeployerBurnerKey('')
    setPasskey('')
    setK2Address('')
    setK3Address('')
    setDeployStatus('')
    setFundingPanel('')
    setAdminKey('')
    setActiveStep(-1)
    setActionToken('')
    setActionAmount('')
    setActionTokenId('')
    setActionStatus('')
    setLastIntent(null)
    setAuthIntentHash('')
    setAuthTypedData('')
    setAuthK2Expected('')
    setAuthK2Signature('')
    setAuthVerified(false)
    setK2WalletAddress('')
    setAuthStatus('')
    setLatestFunding(null)
    sessionScratch.current = {}
    setAuthMsg('Session-only fields cleared.')
    pushToast('info', 'Session-only fields scrubbed.')
  }

  async function sendThanks() {
    if (!thanksMessage.trim()) {
      setThanksStatus('Write a note first.')
      return
    }
    try {
      const r = await fetch(api('thank-you/send'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: thanksMessage.trim() }),
      })
      const d = await r.json()
      if (d?.sent) setThanksStatus('Sent — thank you.')
      else if (d?.disabled) setThanksStatus('Thank-you sending is not configured.')
      else setThanksStatus('Could not send: ' + (d?.reason || 'unknown'))
    } catch {
      setThanksStatus('Could not send.')
    }
  }

  function copyThanksAddress() {
    // The thank-you address is copy-only and is NEVER K3. Guard proves the two are
    // kept distinct before anything touches the clipboard.
    if (thanksAddress && thankYouIsNotK3(thanksAddress, k3Address)) {
      navigator.clipboard?.writeText(thanksAddress).catch(() => {})
      pushToast('info', 'Address copied.')
    }
  }

  return (
    <div className="sg-root">
      {/* ============================ 42px FIXED TOPBAR ==================== */}
      <header className="sg-topbar">
        <span className="sg-brandmark" />
        <span className="sg-wordmark">
          <span className="sg-brand">SECUREGATE</span>
          <span className="sg-badge">EIP-777G</span>
        </span>

        <span className="sg-topbar-spacer" />

        {/* Power/status control — honest: the gate stays LOCKED until a real
            verifier is connected. Never reports a fake "armed" state. */}
        <span id="power-status" className="sg-power" title="Gate stays locked until a verifier is connected">
          <span className="dot" />
          <span className="txt">GATE&nbsp;LOCKED</span>
        </span>

        <button id="scrub-session" type="button" className="sg-scrub-btn" onClick={scrub}>SCRUB</button>
        <button
          id="power-button"
          type="button"
          className="sg-power-btn"
          onClick={scrub}
          title="Power / clear session"
          aria-label="Power — clears the session"
        >
          <span aria-hidden="true">⏻</span>
        </button>
      </header>

      <div className="sg-shell">
        {/* ========================== 264px FIXED SIDEBAR ================== */}
        <aside className="sg-sidebar" aria-label="Auth-Gate">
          {/* Neon circular SCAN control — same-device Auth-Gate signal */}
          <div className="sg-scan-wrap">
            <button
              id="scan-authenticator"
              type="button"
              className="sg-scan-circle"
              disabled={devicesLocked}
              onClick={() => deviceAttempt('scan')}
              aria-label="SCAN — same-device ownership check"
            >
              <span className="sg-scan-ring" aria-hidden="true" />
              <span className="sg-scan-label">SCAN</span>
            </button>
          </div>

          <div className="sg-genesis">GENESIS OWNER AUTHENTICATION</div>

          <div className="sg-locked-card" role="status">
            <strong>DASHBOARD LOCKED</strong>
            <span>AUTHENTICATION OF K1 GENESIS OWNER REQUIRED</span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={label} htmlFor="authgate-k1">K1 COMPROMISED WALLET ADDRESS</label>
            <input
              id="authgate-k1"
              value={k1Address}
              onChange={(e) => setK1Address(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <Btn id="link-device" tone="pink" disabled={devicesLocked} onClick={() => deviceAttempt('link')}>
              LINK DEVICE
            </Btn>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={label} htmlFor="passkey-input">PASSKEY</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                id="passkey-input"
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="K1-bound passkey"
                autoComplete="off"
                spellCheck={false}
                style={inputStyle}
              />
              <Btn id="passkey-enter" onClick={passkeyEnter}>ENTER</Btn>
            </div>
          </div>

          {authMsg ? (
            <div id="authgate-status" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }} aria-live="polite">
              {authMsg}
            </div>
          ) : null}
          <div id="human-route" style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-secondary)' }} aria-live="polite">
            {humanRoute}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            Device attempts: {Math.min(deviceAttempts, MAX_DEVICE_ATTEMPTS)}/{MAX_DEVICE_ATTEMPTS}
          </div>

          {/* AUTH-GATE guidance */}
          <div className="sg-authgate-note">
            <div className="sg-authgate-title">AUTH-GATE</div>
            <p>Same device: press SCAN.</p>
            <p>Different device: connect by USB first, then press LINK DEVICE.</p>
            <p>Enter K1 before SCAN, LINK DEVICE, or PASSKEY. K1 binds to this session until you SCRUB.</p>
            <p>Save this passkey. It is bound to this K1 only. If lost, you must re-run Auth-Gate.</p>
            <p>
              Human fallback stays open: reach out to{' '}
              <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">@hope_ology</a>.
            </p>
            <p>SCRUB clears local/session state at any time.</p>
          </div>
        </aside>

        {/* ============================ MAIN ============================== */}
        <main className="sg-main" style={{ display: 'grid', gap: 20 }}>
          {/* ===================== STANDALONE OPERATION (landing canvas) ===================== */}
          <section className="sg-standalone" aria-label="Standalone operation">
            <h1 className="sg-standalone-title">STANDALONE OPERATION</h1>
            <p>This dashboard executes the authentication flow client-side.</p>
            <p>You are not submitting K1 authentication data to any operator, server, or third party.</p>
            <p>Cryptographic checks run in your browser.</p>
            <p>Chain reads use the server-supplied RPC configuration.</p>
            <p>RPC is not part of the auth gate.</p>
          </section>

          <section className="sg-caution" role="note" aria-label="Caution">
            <p>BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE.</p>
            <p>PLUS YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I'M JUST A STICK FIGURE.</p>
          </section>

          <section className="sg-overview-grid" aria-label="Operations overview">
            <article className="sg-overview-card">
              <div className="sg-overview-kicker">RUNTIME</div>
              <strong>{runtimeTitle}</strong>
              <span>{runtimeDescription}</span>
            </article>
            <article className="sg-overview-card">
              <div className="sg-overview-kicker">CHAINS</div>
              <strong>{chains.length ? `${deployableChains.length}/${chains.length} DEPLOYABLE` : 'LOADING CHAIN REGISTRY'}</strong>
              <span>{chainSummary}</span>
            </article>
            <article className="sg-overview-card">
              <div className="sg-overview-kicker">FUNDING</div>
              <strong>{latestFunding ? `${latestFunding.estimateNative} ${latestFunding.nativeSymbol}` : 'NO FUNDING QUOTE YET'}</strong>
              <span>{latestFunding ? `${latestFunding.chain} deploy estimate at gas ${latestFunding.estGas}.` : 'Pick a network and run Calculate funding to stage a deploy quote.'}</span>
            </article>
            <article className="sg-overview-card">
              <div className="sg-overview-kicker">ACCESS</div>
              <strong>{dashboardUnlocked ? 'RECOVERY WORKSPACE LIVE' : 'AUTH-GATE LOCKED'}</strong>
              <span>{dashboardUnlocked ? 'Recovery, protection, admin, and status controls are available.' : 'Complete the Auth-Gate to open the operator workspace.'}</span>
            </article>
          </section>

          <section className="sg-chain-board" aria-label="Chain board">
            <div className="sg-chain-board-head">
              <div>
                <div className="sg-overview-kicker">CHAIN BOARD</div>
                <h2 className="sg-chain-board-title">Deployment lanes</h2>
              </div>
              <div className="sg-chain-board-note">Registry powered by /api/chains · estimates by /api/funding</div>
            </div>
            <div className="sg-chain-list">
              {chains.length ? chains.map((chain) => (
                <div
                  key={chain.slug}
                  className={`sg-chain-row${selectedChain === chain.slug ? ' is-active' : ''}`}
                  onClick={() => setSelectedChain(chain.slug)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedChain(chain.slug)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedChain === chain.slug}
                >
                  <div>
                    <strong>{chain.name}</strong>
                    <span>{chain.slug} · chain {chain.chainId}</span>
                  </div>
                  <div className="sg-chain-meta">
                    <span>{chain.nativeSymbol}</span>
                    <span>{chain.deploySupported ? 'DEPLOY READY' : 'VIEW ONLY'}</span>
                  </div>
                </div>
              )) : (
                <div className="sg-chain-empty">Waiting for chain metadata.</div>
              )}
            </div>
          </section>

          {!dashboardUnlocked ? (
            <p className="sg-gate-hint" aria-live="polite">
              Complete the Auth-Gate (verified passkey or human fallback) to reveal the recovery workspace.
            </p>
          ) : null}

          {/* ===================== RECOVERY WORKSPACE (revealed after Auth-Gate) ===================== */}
          {dashboardUnlocked ? (
          <>
          {/* Tab navigation */}
          <nav className="sg-tabs" role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
                className="sg-tab"
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* ---------- RECOVERY TAB ---------- */}
          {activeTab === 'recovery' ? (
            <section style={card} aria-label="Recovery gate">
              <h1 style={{ margin: '0 0 4px', fontSize: 20 }}>Recovery gate</h1>
              <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 13 }}>
                K1 proves ownership · K2 authorizes · K3 is the immutable forced destination.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <label style={label} htmlFor="recovery-k1">K1 address</label>
                  <input id="recovery-k1" value={k1Address} readOnly placeholder="Auth-Gate fills this" style={{ ...inputStyle, opacity: 0.8 }} />
                </div>
                <div>
                  <label style={label} htmlFor="k1-session-key">Compromised K1 key</label>
                  <input id="k1-session-key" type="password" value={k1SessionKey} onChange={(e) => setK1SessionKey(e.target.value)} placeholder="Paste only for this session" autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
                <div>
                  <label style={label} htmlFor="deployer-burner-key">Deployer burner key</label>
                  <input id="deployer-burner-key" type="password" value={deployerBurnerKey} onChange={(e) => setDeployerBurnerKey(e.target.value)} placeholder="One-time deploy signer" autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
                <div>
                  <label style={label} htmlFor="k2-address">K2 authority address</label>
                  <input id="k2-address" value={k2Address} onChange={(e) => setK2Address(e.target.value)} placeholder="0x… (public address only)" autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
                <div>
                  <label style={label} htmlFor="k3-address">K3 recovery address</label>
                  <input id="k3-address" value={k3Address} onChange={(e) => setK3Address(e.target.value)} placeholder="0x… (public address only)" autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
                <div>
                  <label style={label} htmlFor="network-select">Network</label>
                  <select
                    id="network-select"
                    aria-label="Network"
                    value={selectedChain}
                    onChange={(e) => setSelectedChain(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select network</option>
                    {chains.map((c) => (
                      <option key={c.slug} value={c.slug} disabled={!c.deploySupported}>
                        {c.name} ({c.nativeSymbol}){c.deploySupported ? '' : ' — view only'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
                <Btn id="funding-check" tone="plain" onClick={handleFundingCheck}>Calculate funding</Btn>
                <Btn id="deploy-gate" tone="cyan" onClick={handleDeployGate}>Deploy gate</Btn>
              </div>

              {fundingPanel ? (
                <div id="funding-panel" style={{ marginTop: 14, padding: 14, border: '1px dashed var(--border-primary)', borderRadius: 10, background: 'var(--bg-tertiary)', fontSize: 13 }}>
                  {fundingPanel}
                </div>
              ) : null}
              <div id="deploy-status" style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-secondary)' }} aria-live="polite">
                {deployStatus}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                {PROGRESS_LABELS.map((s, i) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 12,
                      padding: '5px 10px',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: i <= activeStep ? 'var(--accent-primary)' : 'var(--border-primary)',
                      color: i <= activeStep ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* ---------- BROWSER K1 ACTION BUILDER ---------- */}
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-primary)' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>K1 action builder</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Build a canonical <code>queueERC20/721/1155</code> intent on a deployed gate. The tx is
                  built and signed <strong>locally</strong> with the session-only K1 key — only the signed
                  transaction is broadcast. Keys and RPC URLs never leave their boundary.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={label} htmlFor="k1-gate-address">Deployed gate address</label>
                    <input id="k1-gate-address" value={gateAddress} onChange={(e) => setGateAddress(e.target.value)} placeholder="0x… (SecureGate contract)" autoComplete="off" spellCheck={false} style={inputStyle} />
                  </div>
                  <div>
                    <label style={label} htmlFor="k1-action-kind">Asset standard</label>
                    <select id="k1-action-kind" value={actionKind} onChange={(e) => setActionKind(e.target.value as 'ERC20' | 'ERC721' | 'ERC1155')} style={inputStyle}>
                      <option value="ERC20">ERC-20</option>
                      <option value="ERC721">ERC-721</option>
                      <option value="ERC1155">ERC-1155</option>
                    </select>
                  </div>
                  <div>
                    <label style={label} htmlFor="k1-action-token">Token address</label>
                    <input id="k1-action-token" value={actionToken} onChange={(e) => setActionToken(e.target.value)} placeholder="0x… (token contract)" autoComplete="off" spellCheck={false} style={inputStyle} />
                  </div>
                  {actionKind !== 'ERC20' ? (
                    <div>
                      <label style={label} htmlFor="k1-action-tokenid">Token ID</label>
                      <input id="k1-action-tokenid" value={actionTokenId} onChange={(e) => setActionTokenId(e.target.value)} placeholder="e.g. 1234" autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                  ) : null}
                  {actionKind !== 'ERC721' ? (
                    <div>
                      <label style={label} htmlFor="k1-action-amount">Amount (base units)</label>
                      <input id="k1-action-amount" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="e.g. 1000000000000000000" autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: 14 }}>
                  <Btn id="k1-action-build" tone="gold" onClick={handleK1Action}>Build &amp; broadcast K1 intent</Btn>
                </div>
                <div id="k1-action-status" style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-secondary)', wordBreak: 'break-all' }} aria-live="polite">
                  {actionStatus}
                </div>
              </div>

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>K2 authorization (EIP-712)</h2>
                <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Compute the intent hash locally (mirrors the contract's <code>computeIntentHash</code>),
                  have the <strong>K2 wallet</strong> sign the EIP-712 typed data <em>in its own wallet</em>,
                  then paste the signature here to verify it recovers K2 before building{' '}
                  <code>authorizeIntent</code>. The K2 private key is <strong>never entered</strong> here.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={label} htmlFor="k3-address-auth">K3 forced-recovery address</label>
                    <input id="k3-address-auth" value={k3Address} onChange={(e) => setK3Address(e.target.value)} placeholder="0x… (immutable K3 destination)" autoComplete="off" spellCheck={false} style={inputStyle} />
                  </div>
                  <div>
                    <label style={label} htmlFor="k2-expected">Expected K2 address</label>
                    <input id="k2-expected" value={authK2Expected} onChange={(e) => setAuthK2Expected(e.target.value)} placeholder="0x… (K2 authorizer)" autoComplete="off" spellCheck={false} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <Btn id="k2-compute-hash" tone="gold" onClick={handleComputeIntentHash}>Compute intent hash</Btn>
                </div>
                {authIntentHash ? (
                  <div style={{ marginTop: 12 }}>
                    <label style={label}>Intent hash</label>
                    <div id="k2-intent-hash" style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--accent-secondary)' }}>{authIntentHash}</div>
                    <label style={{ ...label, marginTop: 10 }}>EIP-712 typed data for K2 to sign</label>
                    <textarea id="k2-typed-data" readOnly value={authTypedData} style={{ ...inputStyle, minHeight: 150, fontFamily: 'monospace', fontSize: 11 }} />
                  </div>
                ) : null}
                <div style={{ marginTop: 12 }}>
                  <label style={label} htmlFor="k2-signature">Paste K2 signature (65-byte 0x…)</label>
                  <input id="k2-signature" value={authK2Signature} onChange={(e) => setAuthK2Signature(e.target.value)} placeholder="0x… (signature from the K2 wallet)" autoComplete="off" spellCheck={false} style={inputStyle} />
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Prefer signing in-wallet: connect the <strong>K2 wallet</strong> below to sign the typed
                    data with <code>eth_signTypedData_v4</code>. The K2 key never enters this app. Pasting a
                    signature stays available as a fallback.
                  </p>
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Btn id="k2-wallet-sign" tone="cyan" onClick={handleSignWithK2Wallet}>Sign with K2 wallet</Btn>
                  <Btn id="k2-verify" tone="gold" onClick={handleVerifyK2Signature}>Verify recovers K2</Btn>
                  <Btn id="k2-authorize" tone={authVerified ? 'gold' : 'plain'} onClick={handleAuthorizeIntent}>Build &amp; broadcast authorizeIntent</Btn>
                  <Btn id="k1-execute" tone="plain" onClick={handleExecuteIntent}>Build &amp; broadcast executeIntent</Btn>
                </div>
                {k2WalletAddress ? (
                  <div id="k2-wallet-addr" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Connected K2 wallet: <code>{k2WalletAddress}</code>
                  </div>
                ) : null}
                <div id="k2-auth-status" style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-secondary)', wordBreak: 'break-all' }} aria-live="polite">
                  {authStatus}
                </div>
              </div>
            </section>
          ) : null}

          {/* ---------- PROTECTION TAB ---------- */}
          {activeTab === 'protection' ? (
            <section style={card} aria-label="Proactive protection">
              <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>2FA / Proactive Protection</h2>
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                {twoFactorStatus().message} It never asks for a private key and never limits recovery.
              </p>
              <div className="sg-statusrow">
                <span className="sg-statusdot off" />
                <span className="sg-statuslabel">Proactive 2FA guard</span>
                <span className="sg-statustag">NOT ACTIVE YET</span>
              </div>
              <div className="sg-statusrow">
                <span className="sg-statusdot off" />
                <span className="sg-statuslabel">Automatic threat monitoring</span>
                <span className="sg-statustag">NOT ACTIVE YET</span>
              </div>
            </section>
          ) : null}

          {/* ---------- ADMIN TAB ---------- */}
          {activeTab === 'admin' ? (
            <section style={card} aria-label="Admin passkey generation">
              <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Admin · K1-bound passkey</h2>
              <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                Generate a K1-bound passkey from an admin key. This is an <strong>honest placeholder</strong> —
                no credential is generated and the admin key is never transmitted.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <label style={label} htmlFor="admin-key">Admin key</label>
                  <input id="admin-key" type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Session-only, never sent" autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
                <div>
                  <label style={label} htmlFor="admin-k1-address">K1 address to bind</label>
                  <input id="admin-k1-address" value={adminK1} onChange={(e) => setAdminK1(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <Btn id="admin-generate-passkey" tone="cyan" onClick={generatePasskey}>Generate K1-bound passkey</Btn>
              </div>
              <div id="admin-status" style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-secondary)' }} aria-live="polite">
                {adminStatus}
              </div>
            </section>
          ) : null}

          {/* ---------- STATUS TAB ---------- */}
          {activeTab === 'status' ? (
            <section id="verification-panel" style={card} aria-label="Verification status">
              <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Verification status</h2>
              <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 13 }}>
                What is connected in this build versus what is still an honest placeholder.
              </p>
              <div style={{ marginBottom: 10, fontSize: 11, letterSpacing: '0.12em', color: 'var(--success)' }}>CONNECTED</div>
              {CONNECTED_LAYERS.map((l) => (
                <div className="sg-statusrow" key={l}>
                  <span className="sg-statusdot on" />
                  <span className="sg-statuslabel">{l}</span>
                  <span className="sg-statustag">CONNECTED</span>
                </div>
              ))}
              <div style={{ margin: '16px 0 10px', fontSize: 11, letterSpacing: '0.12em', color: 'var(--warning)' }}>NOT CONNECTED YET</div>
              {PENDING_LAYERS.map((l) => (
                <div className="sg-statusrow" key={l}>
                  <span className="sg-statusdot off" />
                  <span className="sg-statuslabel">{l}</span>
                  <span className="sg-statustag">PENDING</span>
                </div>
              ))}
            </section>
          ) : null}

          {/* ==================== THANK-YOU ENVELOPE (always visible) ==================== */}
          </>
          ) : null}

{dashboardUnlocked && (
                  <section id="thanks-panel" style={{ ...card, display: 'grid', gap: 10, maxWidth: 460 }} aria-label="Thank-you envelope">
            <a id="thanks-handle" href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sg-pink)', fontWeight: 600, textDecoration: 'none' }}>
              {thanksHandle}
            </a>
            {thanksAddress ? (
              <>
                <div id="thanks-address-label" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-secondary)' }}>EVM ADDRESS</div>
                <div id="thanks-address-box" onClick={copyThanksAddress} title="Click to copy address" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, padding: 10, background: 'var(--sg-panel-2)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer', wordBreak: 'break-all' }}>
                  {thanksAddress}
                </div>
                <Btn id="thanks-copy-address" tone="gold" onClick={copyThanksAddress}>CLICK COPY ADDRESS</Btn>
              </>
            ) : null}
            {dashboardUnlocked && (<><textarea id="thanks-message" maxLength={280} value={thanksMessage} onChange={(e) => setThanksMessage(e.target.value)} placeholder="Optional thank-you note" style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }} />
            <Btn id="thanks-send" onClick={sendThanks}>Send thank-you</Btn>
            <div id="thanks-status" style={{ fontSize: 12, color: 'var(--text-secondary)' }} aria-live="polite">{thanksStatus}</div></>)}
          </section>
        )}
        </main>

        {/* ==================== FOOTER IDENTITY ==================== */}
        <footer className="sg-footer">
          <div className="sg-footer-thanks">THANK YOU</div>
          <div className="sg-footer-built">BUILT BY EMP</div>
          {dashboardUnlocked ? (
            <a
              className="sg-footer-handle"
              href="https://x.com/hope_ology"
              target="_blank"
              rel="noopener noreferrer"
            >
              @hope_ology
            </a>
          ) : (
            <span className="sg-footer-handle">@hope_ology</span>
          )}
          {dashboardUnlocked && (
            <a
              id="deliverables-link"
              href={`${import.meta.env.BASE_URL}api/deliverables`}
              target="_blank"
              rel="noopener noreferrer"
              className="sg-footer-deliverables"
            >
              Build deliverables — docs, verifier code &amp; ZIPs ↗
            </a>
          )}
        </footer>
      </div>

      {/* ============================ TOASTS ============================== */}
      <div className="sg-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`sg-toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  )
}
