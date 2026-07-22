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

type Toast = { id: number; kind: 'info' | 'warn' | 'error'; text: string }
type TabKey = 'recovery' | 'protection' | 'admin' | 'status'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recovery', label: 'Recovery' },
  { key: 'protection', label: 'Protection' },
  { key: 'admin', label: 'Admin' },
  { key: 'status', label: 'Status' },
]

const PROGRESS_LABELS = UI_PROGRESS_LABELS
const MAX_DEVICE_ATTEMPTS = 3
const HUMAN_ROUTE_MSG = UI_HUMAN_ROUTE_MSG

const CONNECTED_LAYERS = ['Chain registry (/api/chains)', 'Funding estimate (/api/funding)', 'Anti-abuse events (/api/anti-abuse)', 'Thank-you envelope (/api/thank-you)', 'Browser deploy builder (signedTx)', 'Browser K1 action builder (signedTx)', 'Browser K2 authorization builder (EIP-712, signedTx)']
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

export default function App() {
  const [chains, setChains] = useState<Chain[]>([])
  const [selectedChain, setSelectedChain] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('recovery')
  const [toasts, setToasts] = useState<Toast[]>([])

  // Auth-Gate state
  const [k1Address, setK1Address] = useState('')
  const [deviceAttempts, setDeviceAttempts] = useState(0)
  const [authMsg, setAuthMsg] = useState('')
  const [humanRoute, setHumanRoute] = useState('')
  const [passkey, setPasskey] = useState('')
  const [passkeyLaneReady, setPasskeyLaneReady] = useState(false)
  const [passkeyLaneReason, setPasskeyLaneReason] = useState('')
  const [authGateVerified, setAuthGateVerified] = useState(false)
  const [verifiedRoute, setVerifiedRoute] = useState('none')

  // Recovery form
  const [k1SessionKey, setK1SessionKey] = useState('')
  const [deployerBurnerKey, setDeployerBurnerKey] = useState('')
  const [k2Address, setK2Address] = useState('')
  const [k3Address, setK3Address] = useState('')
  const [fundingPanel, setFundingPanel] = useState('')
  const [deployStatus, setDeployStatus] = useState('')
  const [activeStep, setActiveStep] = useState(-1)

  // K1 action builder
  const [gateAddress, setGateAddress] = useState('')
  const [actionKind, setActionKind] = useState<'ERC20' | 'ERC721' | 'ERC1155'>('ERC20')
  const [actionToken, setActionToken] = useState('')
  const [actionAmount, setActionAmount] = useState('')
  const [actionTokenId, setActionTokenId] = useState('')
  const [actionStatus, setActionStatus] = useState('')

  // K2 authorization
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
  const [k2WalletAddress, setK2WalletAddress] = useState('')

  // Admin passkey generation
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [adminK1, setAdminK1] = useState('')
  const [adminStatus, setAdminStatus] = useState('')
  const [adminPasskeyOut, setAdminPasskeyOut] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)

  // Thank-you envelope
  const [thanksAddress, setThanksAddress] = useState('')
  const [thanksHandle, setThanksHandle] = useState('@hope_ology')
  const [thanksMessage, setThanksMessage] = useState('')
  const [thanksStatus, setThanksStatus] = useState('')
  const [thanksOpen, setThanksOpen] = useState(false)
  const [thanksSending, setThanksSending] = useState(false)

  const thanksTextareaRef = useRef<HTMLTextAreaElement>(null)

  const devicesLocked = deviceAttempts >= MAX_DEVICE_ATTEMPTS
  const dashboardUnlocked = authGateVerified
  const hasThankYouEvmAddress = Boolean(thanksAddress)
  const sessionScratch = useRef<Record<string, string>>({})
  const toastId = useRef(0)
  const selectedChainMeta = chains.find((c) => c.slug === selectedChain)

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

  async function traceEvent(kind: string, k1: string) {
    try {
      await fetch(api(`trace/${kind}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ k1 }),
      })
    } catch {
      // non-blocking
    }
  }

  // ── SCRUB: clears all user-entered info except K1 ──────────────────────
  function scrubInputsKeepK1() {
    const keepK1 = k1Address

    setPasskey('')
    setAuthMsg('Scrub complete. K1 retained.')
    setPasskeyLaneReady(false)
    setPasskeyLaneReason('')

    setAdminKey('')
    setAdminK1('')
    setAdminStatus('')
    setAdminPasskeyOut('')
    setAdminBusy(false)

    setSelectedChain('')
    setDeployerBurnerKey('')
    setK1SessionKey('')
    setK2Address('')
    setK3Address('')
    setSignedTx('')
    setShowDeployerKey(false)
    setShowK1Key(false)

    setDeployStatus('')
    setFundingPanel('')
    setActiveStep(-1)
    setGateAddress('')
    setDeploymentTxHash('')
    setProtectionSignedTx('')
    setProtectionStatus('')
    setRuntimeStatus('')
    setArtifactStatus('')

    setThanksMessage('')
    setThanksStatus('')
    setThanksOpen(false)
    setThanksSending(false)

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
    sessionScratch.current = {}

    setK1Address(keepK1)
    pushToast('info', 'Session-only fields scrubbed. K1 retained.')
  }

  // ── POWER: clears everything including K1, locks to Auth-Gate ──────────
  function powerReset() {
    setAuthGateVerified(false)
    setVerifiedRoute('none')
    setHumanRoute('')
    setActiveTab('recovery')

    setK1Address('')
    setPasskey('')
    setAuthMsg('')
    setDeviceAttempts(0)
    setPasskeyLaneReady(false)
    setPasskeyLaneReason('')

    setAdminPanelOpen(false)
    setAdminKey('')
    setAdminK1('')
    setAdminStatus('')
    setAdminPasskeyOut('')
    setAdminBusy(false)

    setSelectedChain('')
    setDeployerBurnerKey('')
    setK1SessionKey('')
    setK2Address('')
    setK3Address('')

    setDeployStatus('')
    setFundingPanel('')
    setActiveStep(-1)
    setGateAddress('')

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

    setThanksMessage('')
    setThanksStatus('')
    setThanksOpen(false)
    setThanksSending(false)
    sessionScratch.current = {}
    pushToast('info', 'Power reset. Dashboard locked to Auth-Gate.')
  }

  // Stub setters for fields that may not exist yet — kept for scrub safety
  function setSignedTx(_v: string) {}
  function setShowDeployerKey(_v: boolean) {}
  function setShowK1Key(_v: boolean) {}
  function setDeploymentTxHash(_v: string) {}
  function setProtectionSignedTx(_v: string) {}
  function setProtectionStatus(_v: string) {}
  function setRuntimeStatus(_v: string) {}
  function setArtifactStatus(_v: string) {}

  // ── DEVICE ATTEMPT (honest WebUSB) ─────────────────────────────────────
  async function deviceAttempt(kind: 'scan' | 'link') {
    if (!ethers.isAddress(k1Address)) {
      setAuthMsg('Enter a valid K1 address before using SCAN, LINK DEVICE, or PASSKEY.')
      return
    }

    if (devicesLocked) {
      setAuthMsg('Device checks are exhausted. PASSKEY remains open. Dashboard remains locked.')
      return
    }

    setAuthGateVerified(false)
    setVerifiedRoute('none')

    if (kind === 'link') {
      const usb = (
        navigator as Navigator & {
          usb?: {
            requestDevice: (options: { filters: unknown[] }) => Promise<unknown>
          }
        }
      ).usb

      if (!usb || typeof usb.requestDevice !== 'function') {
        setAuthMsg('USB link is not supported in this browser. Use SCAN or admin-generated passkey.')
        try {
          await traceEvent('link-device-unsupported', k1Address)
          await recordAbuse('auth_gate_link_device_unsupported', k1Address)
        } catch {
          // non-blocking
        }
        return
      }

      try {
        await usb.requestDevice({ filters: [] })
      } catch {
        setAuthMsg('USB link was cancelled or unavailable. Dashboard remains locked.')
        try {
          await traceEvent('link-device-cancelled', k1Address)
          await recordAbuse('auth_gate_link_device_cancelled', k1Address)
        } catch {
          // non-blocking
        }
        return
      }
    }

    if (kind === 'scan') {
      const result = attemptScan()
      void pingDevice(k1Address)
      setAuthMsg(result.message)
      pushToast('warn', result.message)
    }

    try {
      await traceEvent(kind === 'scan' ? 'scan' : 'link-device', k1Address)
      await recordAbuse(kind === 'scan' ? 'auth_gate_scan' : 'auth_gate_link_device', k1Address)
    } catch {
      // non-blocking
    }

    const next = deviceAttempts + 1
    setDeviceAttempts(next)

    setPasskeyLaneReady(true)
    setPasskeyLaneReason(kind === 'scan' ? 'scan' : 'link-device')

    if (next >= MAX_DEVICE_ATTEMPTS) {
      setAuthMsg('Device checks exhausted. Passkey lane remains open for this K1.')
      setHumanRoute(HUMAN_ROUTE_MSG)
      pushToast('warn', 'Device checks disabled for this session.')
      return
    }

    setAuthMsg(
      kind === 'scan'
        ? 'K1 scan breadcrumb recorded. Passkey lane opened. PASSKEY + ENTER is still required.'
        : 'USB link breadcrumb recorded. Passkey lane opened. PASSKEY + ENTER is still required.',
    )
  }

  async function passkeyEnter() {
    await recordAbuse('passkey_verify', k1Address || 'anon')
    if (passkey.trim() && k1Address.trim()) {
      const remote = await verifyPasskey(k1Address, passkey)
      if (remote.verified) {
        setAuthGateVerified(true)
        setVerifiedRoute('passkey')
        setHumanRoute('Passkey verified for this K1 — dashboard unlocked.')
        pushToast('info', 'Passkey verified for this K1.')
      } else {
        setAuthMsg('Passkey not verified. Dashboard remains locked.')
        pushToast('warn', 'Passkey check failed.')
      }
    } else {
      setAuthMsg('Enter K1 address and passkey before pressing ENTER.')
    }
  }

  // ── ADMIN PASSKEY GENERATION ────────────────────────────────────────────
  async function generateAdminPasskeyAction() {
    const targetK1 = (adminK1 || k1Address).trim().toLowerCase()

    if (!adminKey.trim()) {
      setAdminStatus('Admin pass phrase required.')
      return
    }

    if (!ethers.isAddress(targetK1)) {
      setAdminStatus('Valid K1 address required.')
      return
    }

    setAdminBusy(true)
    setAdminStatus('Checking admin pass phrase...')

    try {
      const result = await generateAdminPasskeyRemote(adminKey.trim(), targetK1)

      if (result.passkey) {
        setK1Address(targetK1)
        setAdminK1(targetK1)
        setPasskey(result.passkey)
        setAdminPasskeyOut(result.passkey)
        setPasskeyLaneReady(true)
        setPasskeyLaneReason('admin-generated')
        setAuthGateVerified(false)
        setVerifiedRoute('none')
        setAdminStatus('K1-bound passkey generated. Press PASSKEY + ENTER to unlock.')
        setAuthMsg('Admin passkey generated for this K1. Press PASSKEY + ENTER to verify Auth-Gate.')
        return
      }

      if (result.disabled) {
        setAdminStatus(result.reason || 'Admin generation is not configured.')
        return
      }

      setAdminStatus(result.error || result.reason || 'Could not generate passkey.')
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Admin passkey request failed.')
    } finally {
      setAdminBusy(false)
    }
  }

  function AdminPanel() {
    return (
      <form
        className="sg-admin-panel"
        onSubmit={(event) => {
          event.preventDefault()
          void generateAdminPasskeyAction()
        }}
        onPointerDownCapture={(event) => event.stopPropagation()}
        onMouseDownCapture={(event) => event.stopPropagation()}
        onClickCapture={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => event.stopPropagation()}
      >
        <label>
          <span>Admin pass phrase</span>
          <input
            name="securegate-admin-passphrase"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Paste admin pass phrase..."
            type="password"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={adminBusy}
          />
        </label>

        <label>
          <span>K1 address</span>
          <input
            name="securegate-admin-k1"
            value={adminK1}
            onChange={(event) => setAdminK1(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={adminBusy}
          />
        </label>

        <button type="submit" disabled={adminBusy}>
          {adminBusy ? 'CHECKING...' : 'GENERATE K1 PASSKEY'}
        </button>

        {adminPasskeyOut && (
          <label>
            <span>Generated K1-bound passkey</span>
            <input
              value={adminPasskeyOut}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}

        {adminPasskeyOut && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(adminPasskeyOut)}
          >
            COPY PASSKEY
          </button>
        )}

        {adminStatus && <p className="sg-status-line">{adminStatus}</p>}
      </form>
    )
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
      pushToast('info', 'Funding estimate updated.')
    } catch (e) {
      setFundingPanel('Funding check unavailable: ' + (e as Error).message)
      pushToast('error', 'Funding check unavailable.')
    }
  }

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

  async function broadcast(slug: string, signedTx: string): Promise<string> {
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

  async function buildTxCommon(slug: string, from: string, to: string | null, data: string) {
    const nonceHex = await rpcRead(slug, 'eth_getTransactionCount', [from, 'pending'])
    const gasPriceHex = await rpcRead(slug, 'eth_gasPrice', [])
    let gasHex: string
    try {
      const estParams = to ? [{ from, to, data }] : [{ from, data }]
      gasHex = await rpcRead(slug, 'eth_estimateGas', estParams)
    } catch {
      gasHex = to ? '0x30d40' : '0x2625a0'
    }
    const gasPrice = BigInt(gasPriceHex)
    return {
      nonce: Number(BigInt(nonceHex)),
      gasLimit: BigInt(gasHex),
      maxFeePerGas: gasPrice * 2n,
      maxPriorityFeePerGas: gasPrice,
    }
  }

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
      setDeployerBurnerKey('')
      await recordAbuse('deploy_broadcast', from)
      pushToast('info', 'Deployment broadcast.')
    } catch (e) {
      setDeployStatus('Deploy failed: ' + (e as Error).message)
      pushToast('error', 'Deploy failed.')
    }
  }

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
      setK1SessionKey('')
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

  async function handleExecuteIntent() {
    setAuthStatus('')
    if (!authIntentHash) {
      setAuthStatus('Compute + authorize the intent first.')
      return
    }
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

  async function sendThanks() {
    if (!thanksMessage.trim()) {
      setThanksStatus('Write a note first.')
      return
    }
    setThanksSending(true)
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
    } finally {
      setThanksSending(false)
    }
  }

  function copyThankYouAddress() {
    if (thanksAddress && thankYouIsNotK3(thanksAddress, k3Address)) {
      navigator.clipboard?.writeText(thanksAddress).catch(() => {})
      pushToast('info', 'Address copied.')
    }
  }

  function shortAddress(addr: string) {
    if (!addr) return ''
    return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
  }

  return (
    <div className="sg-root">
      {/* ── TOPBAR with upper-left SECUREGATE / EIP-777G brand ── */}
      <header className="sg-topbar">
        <a className="sg-topbar-brand" href="/" aria-label="SecureGate EIP-777G home">
          <strong>SECUREGATE</strong>
          <span>EIP-777G</span>
        </a>

        <div className="sg-topbar-line" />

        <div className="sg-topbar-actions">
          <button className="sg-scrub-btn" type="button" onClick={scrubInputsKeepK1}>
            SCRUB
          </button>
          <button
            className="sg-power-btn"
            type="button"
            onClick={powerReset}
            aria-label="Power reset and lock dashboard"
          >
            <span aria-hidden="true">⏻</span>
          </button>
        </div>
      </header>

      <div className="sg-shell">
        {/* ── SIDEBAR ── */}
        <aside className="sg-sidebar" aria-label="Auth-Gate">
          <div className="sg-scan-wrap">
            <button
              id="scan-authenticator"
              type="button"
              className="sg-scan-circle"
              disabled={devicesLocked}
              onClick={() => void deviceAttempt('scan')}
              aria-label="SCAN — same-device ownership check"
            >
              <span className="sg-scan-ring" aria-hidden="true" />
              <span className="sg-scan-label">SCAN</span>
            </button>
          </div>

          <div className="sg-genesis">GENESIS OWNER AUTHENTICATION</div>

          <div className="sg-locked-card" role="status">
            <strong>{dashboardUnlocked ? 'DASHBOARD UNLOCKED' : 'DASHBOARD LOCKED'}</strong>
            <span>{dashboardUnlocked ? 'K1 GENESIS OWNER VERIFIED' : 'AUTHENTICATION OF K1 GENESIS OWNER REQUIRED'}</span>
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
            <Btn id="link-device" tone="pink" disabled={devicesLocked} onClick={() => void deviceAttempt('link')}>
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
              <Btn id="passkey-enter" onClick={() => void passkeyEnter()}>ENTER</Btn>
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

          <div className="sg-authgate-note">
            <div className="sg-authgate-title">AUTH-GATE</div>
            <p>Same device: SCAN. Different device: USB first, then LINK DEVICE.</p>
            <p>Enter K1 before SCAN, LINK DEVICE, or PASSKEY.</p>
            <p>SCRUB clears all local state at any time.</p>
          </div>

          {passkeyLaneReady && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--sg-cyan)' }}>
              Passkey lane open ({passkeyLaneReason}). PASSKEY + ENTER required.
            </div>
          )}

          <div className="sg-side-caution" role="note" aria-label="Caution">
            <div className="sg-side-caution-title">&#9888; CAUTION</div>
            <p data-sg-caution-text="true">This wallet is in recovery mode. Unauthorized access attempts are logged.</p>
            <p data-sg-caution-text="true">Proceed only if you are the K1 genesis owner.</p>
            <button
              id="admin-black-circle"
              className="sg-admin-circle"
              type="button"
              aria-label="Admin K1-bound passkey generator"
              aria-expanded={adminPanelOpen}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setAdminPanelOpen((value) => !value)
              }}
            >
              <span aria-hidden="true">ADM</span>
            </button>
            {adminPanelOpen && <AdminPanel />}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="sg-main" style={{ display: 'grid', gap: 20 }}>
          <section className="sg-standalone" aria-label="Standalone operation">
            <h1 className="sg-standalone-title">STANDALONE OPERATION</h1>
            <p>This dashboard executes the authentication flow client-side.</p>
            <p>You are not submitting K1 authentication data to any operator, server, or third party.</p>
            <p>Cryptographic checks run in your browser.</p>
            <p>Chain checks stay backend-routed for security.</p>
            <p>Endpoint details never appear in the browser.</p>
          </section>

          <section className="sg-caution" role="note" aria-label="Caution">
            <p>BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE.</p>
            <p>PLUS YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I'M JUST A STICK FIGURE.</p>
          </section>

          {!dashboardUnlocked ? (
            <p className="sg-gate-hint" aria-live="polite">
              Complete the Auth-Gate (verified passkey) to reveal the recovery workspace.
            </p>
          ) : null}

          {dashboardUnlocked ? (
            <>
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
                      <select id="network-select" aria-label="Network" value={selectedChain} onChange={(e) => setSelectedChain(e.target.value)} style={inputStyle}>
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
                    <Btn id="funding-check" tone="plain" onClick={() => void handleFundingCheck()}>Calculate funding</Btn>
                    <Btn id="deploy-gate" tone="cyan" onClick={() => void handleDeployGate()}>Deploy gate</Btn>
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
                      <span key={s} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 999, border: '1px solid', borderColor: i <= activeStep ? 'var(--accent-primary)' : 'var(--border-primary)', color: i <= activeStep ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-primary)' }}>
                    <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>K1 action builder</h2>
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
                      <Btn id="k1-action-build" tone="gold" onClick={() => void handleK1Action()}>Build &amp; broadcast K1 intent</Btn>
                    </div>
                    <div id="k1-action-status" style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-secondary)', wordBreak: 'break-all' }} aria-live="polite">
                      {actionStatus}
                    </div>
                  </div>
                  <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                    <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>K2 authorization (EIP-712)</h2>
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
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn id="k2-wallet-sign" tone="cyan" onClick={() => void handleSignWithK2Wallet()}>Sign with K2 wallet</Btn>
                      <Btn id="k2-verify" tone="gold" onClick={handleVerifyK2Signature}>Verify recovers K2</Btn>
                      <Btn id="k2-authorize" tone={authVerified ? 'gold' : 'plain'} onClick={() => void handleAuthorizeIntent()}>Build &amp; broadcast authorizeIntent</Btn>
                      <Btn id="k1-execute" tone="plain" onClick={() => void handleExecuteIntent()}>Build &amp; broadcast executeIntent</Btn>
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

              {activeTab === 'admin' ? (
                <section style={card} aria-label="Admin passkey generation">
                  <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Admin · K1-bound passkey</h2>
                  <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Generate a K1-bound passkey from an admin key.
                  </p>
                  <AdminPanel />
                </section>
              ) : null}

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
            </>
          ) : null}
        </main>
      </div>

      {/* ── FOOTER: fixed bottom-right, always visible ── */}
      <aside className="sg-footer" aria-label="Thank-you and creator links">
        <button
          className="sg-thankyou-button"
          type="button"
          onClick={() => setThanksOpen((value) => !value)}
        >
          THANK YOU
        </button>

        {thanksOpen && (
          <div className="sg-thanks-panel" role="dialog" aria-label="Send thank-you note">
            <label className="sg-thanks-compose">
              <span>THANK-YOU NOTE</span>
              <textarea
                ref={thanksTextareaRef}
                value={thanksMessage}
                onChange={(event) => setThanksMessage(event.target.value)}
                placeholder=""
                aria-label="Write a thank-you note"
                autoComplete="off"
                spellCheck={true}
              />
            </label>

            <button
              type="button"
              onClick={() => void sendThanks()}
              disabled={thanksSending}
            >
              {thanksSending ? 'SENDING...' : 'SEND NOTE'}
            </button>

            <button
              type="button"
              onClick={copyThankYouAddress}
              disabled={!hasThankYouEvmAddress}
            >
              COPY EVM ADDRESS
            </button>

            {hasThankYouEvmAddress && (
              <code className="sg-thanks-address">{shortAddress(thanksAddress)}</code>
            )}

            <a
              className="sg-thanks-link-button"
              href="https://x.com/hope_ology"
              target="_blank"
              rel="noopener noreferrer"
            >
              OPEN @hope_ology
            </a>

            {thanksStatus && <div className="sg-status-line">{thanksStatus}</div>}
          </div>
        )}

        <div className="sg-built-by">BUILT BY EMP</div>

        <a
          className="sg-twitter-link"
          href="https://x.com/hope_ology"
          target="_blank"
          rel="noopener noreferrer"
        >
          {thanksHandle || '@hope_ology'}
        </a>
      </aside>

      {/* ── TOASTS ── */}
      <div className="sg-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`sg-toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  )
}
