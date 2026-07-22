import { useEffect, useMemo, useState } from 'react'
import {
  type Chain,
  antiAbuseEvent,
  deploySignedTx,
  fetchChains,
  fetchFunding,
  fetchThanksConfig,
  generateAdminPasskeyRemote,
  sendThanksRemote,
  traceEvent,
  verifyPasskeyRemote,
} from './lib/securegateApi'

type DashboardTab = 'deployment' | 'protection' | 'status'

const MAX_DEVICE_ATTEMPTS = 3

const PROGRESS_STEPS = [
  'Funding calculation',
  'Repo K1',
  'Deploy contract',
  'Confirm K1 repo',
  'Verification check',
]

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim())
}

function isSignedTx(value: string): boolean {
  return /^0x[0-9a-fA-F]{100,}$/.test(value.trim())
}

export default function App() {
  const [chains, setChains] = useState<Chain[]>([])
  const setChainsSafe = (val: unknown) =>
    setChains(Array.isArray(val) ? (val as Chain[]) : [])
  const [selectedChain, setSelectedChain] = useState('')

  const [k1Address, setK1Address] = useState('')
  const [passkey, setPasskey] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [deviceAttempts, setDeviceAttempts] = useState(0)

  const [authGateVerified, setAuthGateVerified] = useState(false)
  const [verifiedRoute, setVerifiedRoute] = useState<'none' | 'passkey'>('none')

  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('deployment')

  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [adminK1, setAdminK1] = useState('')
  const [adminStatus, setAdminStatus] = useState('')
  const [adminPasskeyOut, setAdminPasskeyOut] = useState('')

  const [deployerAddress, setDeployerAddress] = useState('')
  const [deployerKey, setDeployerKey] = useState('')
  const [k1SessionKey, setK1SessionKey] = useState('')
  const [k2Address, setK2Address] = useState('')
  const [k3Address, setK3Address] = useState('')
  const [signedTx, setSignedTx] = useState('')

  const [operatorProof, setOperatorProof] = useState('')
  const [showDeployerKey, setShowDeployerKey] = useState(false)
  const [showK1Key, setShowK1Key] = useState(false)
  const [fundingPanel, setFundingPanel] = useState('')
  const [deployStatus, setDeployStatus] = useState('')
  const [activeStep, setActiveStep] = useState(-1)

  const [thanksHandle, setThanksHandle] = useState('@hope_ology')
  const [thanksAddress, setThanksAddress] = useState('')
  const [thanksMessage, setThanksMessage] = useState('')
  const [thanksStatus, setThanksStatus] = useState('')
  const [thanksOpen, setThanksOpen] = useState(false)

  const dashboardUnlocked = authGateVerified
  const deviceLocked = deviceAttempts >= MAX_DEVICE_ATTEMPTS

  const selectedChainMeta = useMemo(
    () => (Array.isArray(chains) ? chains.find((c) => c.slug === selectedChain) : undefined),
    [chains, selectedChain]
  )

  useEffect(() => {
    fetchChains()
      .then((data) => setChainsSafe(data?.chains ?? data))
      .catch(() => setChains([]))
    fetchThanksConfig()
      .then((data) => {
        if (data?.handle) setThanksHandle(data.handle)
        if (data?.copyAddress) setThanksAddress(data.copyAddress)
      })
      .catch(() => {})
  }, [])

  function scrub() {
    setAuthGateVerified(false)
    setVerifiedRoute('none')
    setDashboardTab('deployment')
    setPasskey('')
    setAuthMsg('')
    setAdminStatus('')
    setAdminPasskeyOut('')
    setDeployStatus('')
    setFundingPanel('')
    setActiveStep(-1)
    setK1Address('')
    setDeviceAttempts(0)
    setAdminPanelOpen(false)
    setAdminKey('')
    setAdminK1('')
    setDeployerAddress('')
    setDeployerKey('')
    setK1SessionKey('')
    setK2Address('')
    setK3Address('')
    setSignedTx('')
    setOperatorProof('')
    setShowDeployerKey(false)
    setShowK1Key(false)
    setThanksMessage('')
    setThanksStatus('')
    setThanksOpen(false)
  }

  async function deviceAttempt(kind: 'scan' | 'link') {
    if (!isAddress(k1Address)) {
      setAuthMsg('Enter a valid K1 address before using SCAN, LINK DEVICE, or PASSKEY.')
      return
    }

    if (deviceLocked) {
      setAuthMsg('Device checks are exhausted. PASSKEY remains open. Dashboard remains locked.')
      return
    }

    try {
      await traceEvent(kind === 'scan' ? 'scan' : 'link-device', k1Address)
      await antiAbuseEvent(kind === 'scan' ? 'auth_gate_scan' : 'auth_gate_link_device', k1Address)
    } catch {
      // non-blocking
    }

    const next = deviceAttempts + 1
    setDeviceAttempts(next)
    setAuthGateVerified(false)
    setVerifiedRoute('none')

    if (next >= MAX_DEVICE_ATTEMPTS) {
      setAuthMsg('Device checks exhausted. Use the K1-bound PASSKEY route.')
      return
    }

    setAuthMsg(
      kind === 'scan'
        ? 'Same-device marker recorded. PASSKEY verification is still required.'
        : 'Linked-device marker recorded. PASSKEY verification is still required.'
    )
  }

  async function verifyPasskey() {
    if (!isAddress(k1Address)) {
      setAuthMsg('Enter a valid K1 address before PASSKEY.')
      return
    }

    if (!passkey.trim()) {
      setAuthMsg('Enter the K1-bound passkey.')
      return
    }

    try {
      const result = await verifyPasskeyRemote(k1Address.trim(), passkey.trim())

      if (result.verified === true) {
        setAuthGateVerified(true)
        setVerifiedRoute('passkey')
        setDashboardTab('deployment')
        setAuthMsg('AUTH-GATE verified. Dashboard unlocked.')
        return
      }

      setAuthGateVerified(false)
      setVerifiedRoute('none')
      setAuthMsg(result.reason || result.error || 'Passkey not verified.')
    } catch (error) {
      setAuthGateVerified(false)
      setVerifiedRoute('none')
      setAuthMsg(error instanceof Error ? error.message : 'Passkey verification failed.')
    }
  }

  async function generateAdminPasskey() {
    const targetK1 = (adminK1 || k1Address).trim()

    if (!adminKey.trim()) {
      setAdminStatus('Admin key required.')
      return
    }

    if (!isAddress(targetK1)) {
      setAdminStatus('Valid K1 address required.')
      return
    }

    try {
      const result = await generateAdminPasskeyRemote(adminKey.trim(), targetK1)

      if (result.passkey) {
        setAdminK1(targetK1)
        setPasskey(result.passkey)
        setAdminPasskeyOut(result.passkey)
        setAdminStatus('Generated K1-bound passkey. Press PASSKEY + ENTER to unlock.')
        return
      }

      if (result.disabled) {
        setAdminStatus(result.reason || 'Admin generation is not configured.')
        return
      }

      setAdminStatus(result.error || result.reason || 'Could not generate passkey.')
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : 'Admin passkey request failed.')
    }

    // DO NOT add setAuthGateVerified(true) here.
  }

  async function calculateFunding() {
    if (!selectedChain) {
      setFundingPanel('Select a chain first.')
      return
    }

    setFundingPanel('Calculating...')
    setActiveStep(0)

    try {
      const data = await fetchFunding(selectedChain)
      setFundingPanel(
        `Estimated: ${data.estimateNative || 'unknown'} ${data.nativeSymbol || selectedChainMeta?.nativeSymbol || ''}`
      )
      setActiveStep(1)
    } catch (error) {
      setFundingPanel(error instanceof Error ? error.message : 'Funding check failed.')
    }
  }

  async function lockGateIn() {
    if (!dashboardUnlocked) {
      setDeployStatus('Auth-Gate verification required.')
      return
    }

    if (!selectedChain) {
      setDeployStatus('Select a chain first.')
      return
    }

    if (!isAddress(k2Address)) {
      setDeployStatus('K2 public auth address required.')
      return
    }

    if (!isAddress(k3Address)) {
      setDeployStatus('K3 clean drop address required.')
      return
    }

    if (!isSignedTx(signedTx)) {
      setDeployStatus('Signed transaction required. Backend receives signedTx only.')
      return
    }

    setDeployStatus('Locking gate in...')
    setActiveStep(2)

    try {
      const result = await deploySignedTx(selectedChain, signedTx.trim())
      setActiveStep(4)
      setDeployStatus(`Complete. txHash: ${result.txHash || 'submitted'}`)
    } catch (error) {
      setDeployStatus(error instanceof Error ? error.message : 'Broadcast failed.')
    }
  }

  async function sendThanks() {
    if (!dashboardUnlocked) {
      setThanksStatus('Unlock first.')
      return
    }

    if (!thanksMessage.trim()) {
      setThanksStatus('Write a short note first.')
      return
    }

    try {
      const data = await sendThanksRemote(thanksMessage.trim())

      if (data?.sent) {
        setThanksStatus('Sent.')
      } else if (data?.disabled) {
        setThanksStatus('Thank-you sending is not configured.')
      } else {
        setThanksStatus(data?.reason || data?.error || 'Could not send.')
      }
    } catch {
      setThanksStatus('Could not send.')
    }
  }

  // shared admin panel markup (used in both locked + unlocked rail)
  function AdminPanel() {
    return (
      <div className="sg-admin-panel">
        <label>
          <span>Admin key</span>
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Paste admin key..."
            type="password"
          />
        </label>

        <label>
          <span>K1 address</span>
          <input
            value={adminK1}
            onChange={(e) => setAdminK1(e.target.value)}
            placeholder="0x..."
          />
        </label>

        <button type="button" onClick={generateAdminPasskey}>
          GENERATE PASSKEY
        </button>

        {adminPasskeyOut && (
          <label>
            <span>Generated K1-bound passkey</span>
            <input value={adminPasskeyOut} readOnly />
          </label>
        )}

        {adminPasskeyOut && (
          <button type="button" onClick={() => navigator.clipboard?.writeText(adminPasskeyOut)}>
            COPY
          </button>
        )}

        {adminStatus && <p className="sg-status-line">{adminStatus}</p>}
      </div>
    )
  }

  return (
    <main className={`sg-shell ${dashboardUnlocked ? 'sg-shell--unlocked' : 'sg-shell--locked'}`}>
      <header className="sg-topbar">
        <div className="sg-topbar-line" />
        <button className="sg-scrub" type="button" onClick={scrub}>
          SCRUB
        </button>
        <button className="sg-power" type="button" onClick={scrub} aria-label="Power / scrub session">
          ⏻
        </button>
      </header>

      <section className={`sg-layout ${dashboardUnlocked ? 'sg-layout--unlocked' : 'sg-layout--locked'}`}>
        {dashboardUnlocked && (
          <aside className="sg-rail">
            <div className="sg-brand">
              <strong>SECUREGATE</strong>
              <span>EIP-777G</span>
            </div>

            <div className="sg-rail-copy">
              <p><b>Same device:</b> press SCAN.</p>
              <p><b>Different device:</b> connect by USB first, then press LINK DEVICE.</p>
            </div>

            <section className="sg-auth-copy">
              <h2>AUTH-GATE</h2>
              <p>Verifies the likely original K1 owner — not the thief.</p>
              <p>Checks are session-bound and cannot unlock the dashboard without a K1-bound passkey.</p>
              <p>Device checks are advisory only. PASSKEY + ENTER is required.</p>
              <p>Chain checks stay backend-routed for security. Endpoint details never appear in the browser.</p>
            </section>

            <section className="sg-card sg-card--warning sg-side-caution">
              <div className="sg-caution-head">
                <span>⚠</span>
                <h2>CAUTION</h2>
                <button
                  id="admin-black-circle"
                  className="sg-admin-circle"
                  type="button"
                  aria-label="Admin K1-bound passkey generator"
                  onClick={() => setAdminPanelOpen((v) => !v)}
                >
                  ⚫️-&apos;
                </button>
              </div>

              <p>Use at your own risk. No K2 or K3 private key is ever entered.</p>

              {adminPanelOpen && <AdminPanel />}
            </section>

            <div className="sg-rail-status">
              <span>777G V1.0</span>
              <span>{verifiedRoute === 'passkey' ? 'AUTHENTICATED' : 'SECURE'}</span>
            </div>
          </aside>
        )}

        {!dashboardUnlocked && (
          <>
            {/* Locked left rail */}
            <aside className="sg-rail sg-rail--locked">
              <div className="sg-brand">
                <strong>SECUREGATE</strong>
                <span>EIP-777G</span>
              </div>

              <div className="sg-rail-copy">
                <p><b>Same device:</b> press SCAN.</p>
                <p><b>Different device:</b> connect by USB first, then press LINK DEVICE.</p>
              </div>

              <section className="sg-auth-copy">
                <h2>AUTH-GATE</h2>
                <p>Verifies the likely original K1 owner — not the thief.</p>
                <p>Exact checks are hidden so they cannot be cloned or gamed.</p>
                <p>Advisory check, not a final ruling. May miss valid ownership — attempt on up to <span className="sg-pink-text">3 devices per K1</span>. Markers can span all three.</p>
                <p>Still unclear? DM <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer" className="sg-cyan-link">@hope_ology</a> on X with proof of ownership.</p>
                <p>On success: K1 auto-fills, a <span className="sg-cyan-text">unique passkey</span> is issued for that K1. No further scans needed once issued.</p>
                <p>All data auto-scrubs after verification <em>and</em> again at session end. <span className="sg-cyan-text">SCRUB</span> purges on demand.</p>
                <p>Standalone. Nothing is stored, logged, or transmitted.</p>
              </section>

              <section className="sg-card sg-card--warning sg-side-caution">
                <div className="sg-caution-head">
                  <span>⚠</span>
                  <h2>CAUTION</h2>
                  <button
                    id="admin-black-circle"
                    className="sg-admin-circle"
                    type="button"
                    aria-label="Admin K1-bound passkey generator"
                    onClick={() => setAdminPanelOpen((v) => !v)}
                  >
                    ⚫️-&apos;
                  </button>
                </div>
                <p>Use at your own risk.<br />Hope for the best.<br />If you&apos;re a hacker? <span className="sg-danger-text">Get fucked.</span></p>
                {adminPanelOpen && <AdminPanel />}
              </section>

              <div className="sg-rail-status">
                <span>777G V1.0</span>
                <span>SECURE</span>
              </div>
            </aside>

            {/* Locked main */}
            <section className="sg-main sg-main--locked">
              <div className="sg-locked-stage">
                <div className="sg-genesis-header">
                  <p>GENESIS OWNER AUTHENTICATION</p>
                  <span className="sg-dashboard-locked-label">DASHBOARD LOCKED</span>
                </div>

                <div className="sg-scan-orb-wrap">
                  <button
                    className="sg-scan-orb"
                    type="button"
                    disabled={deviceLocked}
                    onClick={() => deviceAttempt('scan')}
                  >
                    SCAN
                  </button>
                </div>

                <label className="sg-field sg-k1-field">
                  <span>K1 COMPROMISED WALLET ADDRESS</span>
                  <input
                    value={k1Address}
                    onChange={(e) => setK1Address(e.target.value)}
                    placeholder="0x..."
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>

                <div className="sg-auth-actions">
                  <button type="button" onClick={() => deviceAttempt('link')}>
                    LINK DEVICE
                  </button>

                  <label>
                    <span>PASSKEY</span>
                    <input
                      value={passkey}
                      onChange={(e) => setPasskey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) verifyPasskey()
                      }}
                      placeholder="Enter K1-bound passkey..."
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>

                  <button type="button" onClick={verifyPasskey}>
                    PASSKEY + ENTER
                  </button>
                </div>

                {authMsg && <p className="sg-status-line">{authMsg}</p>}

                <section className="sg-card sg-card--cyan sg-standalone">
                  <h2>STANDALONE OPERATION</h2>
                  <p>This dashboard executes the authentication flow client-side.</p>
                  <p>You are not submitting K1 authentication data to any operator, server, or third party. Cryptographic checks run in your browser.</p>
                  <p>Chain checks stay backend-routed for security. Endpoint details never appear in the browser.</p>
                </section>

                <section className="sg-card sg-card--warning sg-warning">
                  <p>BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE.</p>
                  <p>PLUS, YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I&apos;M JUST A STICK FIGURE.</p>
                </section>
              </div>
            </section>
          </>
        )}

        {dashboardUnlocked && (
          <section className="sg-main sg-main--unlocked">
            <nav className="sg-tabs" aria-label="Dashboard tabs">
              <button
                className={`sg-tab ${dashboardTab === 'deployment' ? 'sg-tab--active' : ''}`}
                type="button"
                onClick={() => setDashboardTab('deployment')}
              >
                Deployment
              </button>
              <button
                className={`sg-tab ${dashboardTab === 'protection' ? 'sg-tab--active' : ''}`}
                type="button"
                onClick={() => setDashboardTab('protection')}
              >
                Protection
              </button>
              <button
                className={`sg-tab ${dashboardTab === 'status' ? 'sg-tab--active' : ''}`}
                type="button"
                onClick={() => setDashboardTab('status')}
              >
                Status
              </button>
            </nav>

            {dashboardTab === 'deployment' && (
              <section className="sg-dashboard-grid">
                {/* ── Deployment intro ──────────────────────────────────── */}
                <article className="sg-card sg-card--cyan sg-dash-card sg-deploy-intro">
                  <h1>EIP-777G DEPLOYMENT</h1>
                  <p>
                    Create &amp; fund a burner wallet for your deployment bundle — this is your{' '}
                    <span className="sg-cyan-text">Deployer</span>. Enter the Deployer key and
                    address in the assigned boxes below. Enter the K1 key assigned to the K1
                    address listed. Enter two clean addresses in K2 and K3.{' '}
                    <span className="sg-gold-text">
                      Do not at any point share your K2 or K3 keys.
                    </span>
                  </p>
                  <ol className="sg-deploy-steps">
                    <li>Choose the initial chain to launch the EIP-777G contract on.</li>
                    <li>
                      The fee calculator next to the chain selection box will tell you the funding
                      needed to launch the contract on that chain. Fund the Deployer with that amount.
                    </li>
                    <li>
                      Once you&apos;ve selected the chain and funded your Deployer, deploy the
                      EIP-777G bundle.
                    </li>
                    <li>
                      The progress bar will indicate the bundle was fully deployed &amp; the
                      verification check will indicate if the deployment was a success.
                    </li>
                    <li>
                      Once EIP-777G has been successfully deployed, you will use K2 to authorize any
                      and all transactions initiated by K1. Any asset you authorize the transfer of
                      will be routed directly to your K3 clean address.
                    </li>
                  </ol>
                </article>

                {/* ── Deployment bundle form ───────────────────────────── */}
                <article className="sg-card sg-dash-card sg-deploy-bundle">
                  <h2>DEPLOYMENT BUNDLE</h2>

                  <div className="sg-form-grid sg-form-grid--deploy">
                    <label>
                      <span>DEPLOYER ADDRESS</span>
                      <input
                        value={deployerAddress}
                        onChange={(e) => setDeployerAddress(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label className="sg-field-with-eye">
                      <span>DEPLOYER KEY</span>
                      <div className="sg-eye-wrap">
                        <input
                          value={deployerKey}
                          onChange={(e) => setDeployerKey(e.target.value)}
                          placeholder="0x..."
                          type={showDeployerKey ? 'text' : 'password'}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="sg-eye-btn"
                          onClick={() => setShowDeployerKey((v) => !v)}
                          aria-label={showDeployerKey ? 'Hide deployer key' : 'Show deployer key'}
                        >
                          {showDeployerKey ? '◉' : '○'}
                        </button>
                      </div>
                    </label>

                    <label>
                      <span>K1 ADDRESS</span>
                      <input value={k1Address} readOnly placeholder="0x..." />
                    </label>

                    <label className="sg-field-with-eye">
                      <span>K1 KEY</span>
                      <div className="sg-eye-wrap">
                        <input
                          value={k1SessionKey}
                          onChange={(e) => setK1SessionKey(e.target.value)}
                          placeholder="0x..."
                          type={showK1Key ? 'text' : 'password'}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="sg-eye-btn"
                          onClick={() => setShowK1Key((v) => !v)}
                          aria-label={showK1Key ? 'Hide K1 key' : 'Show K1 key'}
                        >
                          {showK1Key ? '◉' : '○'}
                        </button>
                      </div>
                    </label>

                    <label>
                      <span>K2 AUTH ADDRESS</span>
                      <input
                        value={k2Address}
                        onChange={(e) => setK2Address(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label>
                      <span>K3 CLEAN DROP ADDRESS</span>
                      <input
                        value={k3Address}
                        onChange={(e) => setK3Address(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label className="sg-wide">
                      <span>OPERATOR PROOF</span>
                      <input
                        value={operatorProof}
                        onChange={(e) => setOperatorProof(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <small>Optional: if not provided, uses backend default from environment</small>
                    </label>
                  </div>

                  <div className="sg-bundle-actions">
                    <select
                      className="sg-chain-select"
                      value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)}
                    >
                      <option value="">
                        {chains.length === 0
                          ? 'EVM Bundle — All EVM Chains'
                          : '— Select chain —'}
                      </option>
                      {chains.map((chain) => (
                        <option key={chain.slug} value={chain.slug} disabled={!chain.deploySupported}>
                          {chain.name} — {chain.nativeSymbol}
                        </option>
                      ))}
                    </select>

                    <button type="button" className="sg-calc-btn" onClick={calculateFunding}>
                      CALCULATE FUNDING
                    </button>
                  </div>

                  {fundingPanel && <p className="sg-status-line">{fundingPanel}</p>}

                  <button className="sg-primary-action" type="button" onClick={lockGateIn}>
                    DEPLOY EIP-777G BUNDLE
                  </button>

                  {deployStatus && <p className="sg-status-line">{deployStatus}</p>}
                </article>

                {/* ── Progress + verification ──────────────────────────── */}
                <div className="sg-progress-grid">
                  <article className="sg-card sg-dash-card">
                    <h2>DEPLOYMENT PROGRESS</h2>
                    <div className="sg-progress-bar">
                      <span
                        style={{
                          width:
                            activeStep < 0
                              ? '0%'
                              : `${Math.round(((activeStep + 1) / PROGRESS_STEPS.length) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="sg-progress-pct">
                      {activeStep < 0 ? '0' : Math.round(((activeStep + 1) / PROGRESS_STEPS.length) * 100)}%
                    </p>
                    <ul className="sg-steps-list">
                      {PROGRESS_STEPS.map((step, i) => (
                        <li
                          key={step}
                          className={i <= activeStep ? 'sg-step--done' : ''}
                        >
                          {step}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="sg-card sg-dash-card">
                    <h2>VERIFICATION CHECK</h2>
                    <p className="sg-verify-sub">Runs automatically after deploy</p>
                  </article>
                </div>
              </section>
            )}

            {dashboardTab === 'protection' && (
              <section className="sg-card sg-card--cyan sg-dash-card sg-protection-setup">
                <h1>PROTECTION DEPLOYER</h1>
                <p>
                  <span className="sg-cyan-text">For protection before compromise</span> — deploy
                  EIP-777G here.
                </p>

                <div className="sg-form-grid sg-form-grid--protection">
                  <label>
                    <span>K1 ADDRESS <small>(AUTO-FILLED)</small></span>
                    <input value={k1Address} readOnly placeholder="0x..." />
                  </label>

                  <label>
                    <span>K2 ADDRESS</span>
                    <input
                      value={k2Address}
                      onChange={(e) => setK2Address(e.target.value)}
                      placeholder="0x..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>

                  <label>
                    <span>K3 ADDRESS</span>
                    <input
                      value={k3Address}
                      onChange={(e) => setK3Address(e.target.value)}
                      placeholder="0x..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                </div>

                <div className="sg-bundle-actions sg-bundle-actions--protection">
                  <select
                    className="sg-chain-select"
                    value={selectedChain}
                    onChange={(e) => setSelectedChain(e.target.value)}
                  >
                    <option value="">
                      {chains.length === 0 ? 'EVM Bundle — All EVM Chains' : '— Select chain —'}
                    </option>
                    {chains.map((chain) => (
                      <option key={chain.slug} value={chain.slug} disabled={!chain.deploySupported}>
                        {chain.name} — {chain.nativeSymbol}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="sg-calc-btn" onClick={calculateFunding}>
                    CALCULATE FUNDING
                  </button>
                </div>

                <button className="sg-primary-action sg-primary-action--magenta" type="button">
                  AUTHORIZE &amp; DEPLOY PROTECTION
                </button>

                <p className="sg-protection-note">
                  To activate: open K1 in your wallet and authorize the signature prompt. No private
                  key entry required — signing activates the contract and assigns K2 authorization.
                  Any authorized transfer will route directly to your K3 address.
                </p>

                <div className="sg-card sg-card--warning sg-protection-footer">
                  <span>&#x26A0;</span> All data auto-scrubs after verification and again at session
                  end. SCRUB purges on demand.{' '}
                  <span className="sg-cyan-text">Standalone.</span> Nothing is stored, logged, or
                  transmitted. Runs entirely in your browser.
                </div>
              </section>
            )}

            {dashboardTab === 'status' && (
              <section className="sg-card sg-dash-card sg-status-panel">
                <h1>STATUS</h1>
                <p>Auth-Gate route: {verifiedRoute}</p>
                <p>Chain checks stay backend-routed for security.</p>
                <p>Endpoint details never appear in the browser.</p>
                <p>Thank-you routing is separate from K3.</p>
              </section>
            )}
          </section>
        )}
      </section>

      <aside className="sg-footer">
        <button
          className="sg-thankyou-button"
          type="button"
          disabled={!dashboardUnlocked}
          onClick={() => dashboardUnlocked && setThanksOpen((v) => !v)}
        >
          THANK YOU
        </button>

        {thanksOpen && dashboardUnlocked && (
          <div className="sg-thanks-panel">
            <textarea
              value={thanksMessage}
              onChange={(e) => setThanksMessage(e.target.value)}
              placeholder="Optional thank-you note"
              maxLength={280}
            />
            <button type="button" onClick={sendThanks}>
              SEND
            </button>
            {thanksStatus && <div className="sg-status-line">{thanksStatus}</div>}
          </div>
        )}

        <div className="sg-built-by">BUILT BY EMP</div>

        <div>
          <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">
            {thanksHandle}
          </a>
        </div>
      </aside>
    </main>
  )
}
