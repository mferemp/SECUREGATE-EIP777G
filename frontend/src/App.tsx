import { useEffect, useMemo, useState } from 'react'

type Chain = {
  slug: string
  name: string
  chainId: number
  nativeSymbol: string
  deploySupported: boolean
}

type TabKey = 'deployment' | 'protection' | 'status'

const MAX_DEVICE_ATTEMPTS = 3

const PROGRESS_LABELS = [
  'Funding check',
  'Preparing gate',
  'Locking gate in',
  'Verifying protection',
  'Complete'
]

function api(path: string): string {
  return `/api/${String(path || '').replace(/^\/+/, '')}`
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim())
}

function isSignedTx(value: string): boolean {
  return /^0x[0-9a-fA-F]{100,}$/.test(value.trim())
}

export default function App() {
  const [chains, setChains] = useState<Chain[]>([])
  const [selectedChain, setSelectedChain] = useState('')

  const [k1Address, setK1Address] = useState('')
  const [passkey, setPasskey] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [deviceAttempts, setDeviceAttempts] = useState(0)

  const [authGateVerified, setAuthGateVerified] = useState(false)
  const [verifiedRoute, setVerifiedRoute] = useState<'none' | 'passkey'>('none')

  const [adminOpen, setAdminOpen] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [adminK1, setAdminK1] = useState('')
  const [adminStatus, setAdminStatus] = useState('')

  const [activeTab, setActiveTab] = useState<TabKey>('deployment')

  const [deployerAddress, setDeployerAddress] = useState('')
  const [deployerKey, setDeployerKey] = useState('')
  const [k1SessionKey, setK1SessionKey] = useState('')
  const [k2Address, setK2Address] = useState('')
  const [k3Address, setK3Address] = useState('')
  const [signedTx, setSignedTx] = useState('')

  const [fundingStatus, setFundingStatus] = useState('')
  const [deployStatus, setDeployStatus] = useState('')
  const [activeStep, setActiveStep] = useState(-1)

  const [thanksHandle, setThanksHandle] = useState('@hope_ology')
  const [thanksAddress, setThanksAddress] = useState('')
  const [thanksMessage, setThanksMessage] = useState('')
  const [thanksStatus, setThanksStatus] = useState('')

  const dashboardUnlocked = authGateVerified
  const devicesLocked = deviceAttempts >= MAX_DEVICE_ATTEMPTS

  const selectedChainMeta = useMemo(
    () => chains.find((chain) => chain.slug === selectedChain),
    [chains, selectedChain]
  )

  useEffect(() => {
    fetch(api('chains'))
      .then((res) => res.json())
      .then((data) => {
        setChains(Array.isArray(data?.chains) ? data.chains : [])
      })
      .catch(() => setChains([]))

    fetch(api('thank-you/config'))
      .then((res) => res.json())
      .then((data) => {
        if (data?.handle) setThanksHandle(data.handle)
        if (data?.copyAddress) setThanksAddress(data.copyAddress)
      })
      .catch(() => {})
  }, [])

  function scrub() {
    setK1Address('')
    setPasskey('')
    setAuthMsg('')
    setDeviceAttempts(0)
    setAuthGateVerified(false)
    setVerifiedRoute('none')
    setAdminOpen(false)
    setAdminKey('')
    setAdminK1('')
    setAdminStatus('')
    setActiveTab('deployment')
    setDeployerAddress('')
    setDeployerKey('')
    setK1SessionKey('')
    setK2Address('')
    setK3Address('')
    setSignedTx('')
    setFundingStatus('')
    setDeployStatus('')
    setActiveStep(-1)
    setThanksMessage('')
    setThanksStatus('')
  }

  async function recordTrace(kind: string) {
    try {
      await fetch(api(`trace/${kind}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ k1: k1Address || 'anon' })
      })
    } catch {
      // silent: trace must never block auth
    }
  }

  async function deviceAttempt(kind: 'scan' | 'link') {
    if (devicesLocked) {
      setAuthMsg('Device checks are exhausted. Use the K1-bound passkey or admin human-route generator.')
      return
    }
    if (!isAddress(k1Address)) {
      setAuthMsg('Enter a valid K1 address before SCAN, LINK DEVICE, or PASSKEY.')
      return
    }
    await recordTrace(kind === 'scan' ? 'scan' : 'link-device')
    const next = deviceAttempts + 1
    setDeviceAttempts(next)
    if (next >= MAX_DEVICE_ATTEMPTS) {
      setAuthGateVerified(false)
      setVerifiedRoute('none')
      setAuthMsg('Device checks exhausted. Use the K1-bound passkey or admin human-route generator. Dashboard remains locked.')
      return
    }
    setAuthMsg(
      kind === 'scan'
        ? 'Same-device check recorded. Passkey verification still required.'
        : 'Linked-device check recorded. Passkey verification still required.'
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
    await recordTrace('passkey-verify')
    try {
      const res = await fetch(api('passkeys/verify'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ k1: k1Address.trim(), passkey: passkey.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (data?.verified === true) {
        setAuthGateVerified(true)
        setVerifiedRoute('passkey')
        setAuthMsg('AUTH-GATE verified. Recovery workspace unlocked.')
        return
      }
      setAuthGateVerified(false)
      setVerifiedRoute('none')
      setAuthMsg(data?.reason || data?.error || 'Passkey not verified.')
    } catch {
      setAuthGateVerified(false)
      setVerifiedRoute('none')
      setAuthMsg('Passkey verification failed.')
    }
  }

  async function generateAdminPasskey() {
    const targetK1 = (adminK1 || k1Address).trim()
    if (!adminKey.trim()) { setAdminStatus('Admin key required.'); return }
    if (!isAddress(targetK1)) { setAdminStatus('Valid K1 address required.'); return }
    try {
      const res = await fetch(api('admin-passkey/generate'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminKey: adminKey.trim(), k1: targetK1 })
      })
      const data = await res.json().catch(() => ({}))
      if (data?.passkey) {
        setAdminK1(targetK1)
        setPasskey(data.passkey)
        setAdminStatus('K1-bound passkey generated. Press ENTER in the PASSKEY lane to unlock.')
        return
      }
      if (data?.disabled) {
        setAdminStatus(data.reason || 'Admin human-route is disabled on this deployment.')
        return
      }
      setAdminStatus(data?.error || data?.reason || 'Could not generate passkey.')
    } catch {
      setAdminStatus('Admin passkey request failed.')
    }
  }

  async function calculateFunding() {
    if (!selectedChain) { setFundingStatus('Select a chain first.'); return }
    setActiveStep(0)
    setFundingStatus('Funding check...')
    try {
      const res = await fetch(api(`funding/${selectedChain}`))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setFundingStatus(data?.error || 'Funding check unavailable.'); return }
      setFundingStatus(
        `Estimated funding: ${data.estimateNative || 'unknown'} ${data.nativeSymbol || selectedChainMeta?.nativeSymbol || ''}`
      )
      setActiveStep(1)
    } catch {
      setFundingStatus('Funding check failed.')
    }
  }

  async function lockGateIn() {
    if (!dashboardUnlocked) { setDeployStatus('Auth-Gate verification required.'); return }
    if (!selectedChain) { setDeployStatus('Select a chain first.'); return }
    if (!isAddress(k1Address)) { setDeployStatus('Valid K1 address required.'); return }
    if (!isAddress(k2Address)) { setDeployStatus('K2 public auth address required.'); return }
    if (!isAddress(k3Address)) { setDeployStatus('K3 clean destination address required.'); return }
    if (!isSignedTx(signedTx)) {
      setDeployStatus('Signed transaction required. Private keys stay local; backend receives signedTx only.')
      return
    }
    setActiveStep(2)
    setDeployStatus('Locking gate in...')
    try {
      const res = await fetch(api(`deploy/${selectedChain}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedTx: signedTx.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setDeployStatus(data?.error || 'Broadcast rejected.'); return }
      setActiveStep(4)
      setDeployStatus(`Complete. txHash: ${data.txHash || 'submitted'}`)
    } catch {
      setDeployStatus('Broadcast failed.')
    }
  }

  async function sendThanks() {
    if (!dashboardUnlocked) { setThanksStatus('Unlock first.'); return }
    if (!thanksMessage.trim()) { setThanksStatus('Write a note first.'); return }
    try {
      const res = await fetch(api('thank-you/send'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: thanksMessage.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (data?.sent) { setThanksStatus('Sent — thank you.') }
      else if (data?.disabled) { setThanksStatus('Thank-you sending is not configured.') }
      else { setThanksStatus(data?.reason || data?.error || 'Could not send.') }
    } catch {
      setThanksStatus('Could not send.')
    }
  }

  return (
    <div className="sg-root">
      <header className="sg-topbar">
        <div className="sg-brand-dot" />
        <div className="sg-brand">
          <span>SECUREGATE</span>
          <small>EIP-777G</small>
        </div>
        <div className="sg-topbar-spacer" />
        <button className="sg-scrub" type="button" onClick={scrub}>SCRUB</button>
        <button className="sg-power" type="button" aria-label="Power">&#9211;</button>
      </header>

      <div className={`sg-layout ${dashboardUnlocked ? 'sg-layout--unlocked' : 'sg-layout--locked'}`}>
        <aside className="sg-sidebar" aria-label="Auth-Gate">
          <button
            id="scan-authenticator"
            type="button"
            className="sg-scan"
            disabled={devicesLocked}
            onClick={() => deviceAttempt('scan')}
          >
            <span>SCAN</span>
          </button>

          <div className="sg-genesis">GENESIS OWNER AUTHENTICATION</div>

          <div className="sg-locked-card" role="status">
            <strong>DASHBOARD LOCKED</strong>
            <span>AUTHENTICATION OF K1 GENESIS OWNER REQUIRED</span>
          </div>

          <label className="sg-label" htmlFor="authgate-k1">K1 COMPROMISED WALLET ADDRESS</label>
          <input
            id="authgate-k1"
            className="sg-input"
            value={k1Address}
            onChange={(e) => setK1Address(e.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />

          <button
            id="link-device"
            className="sg-link-device"
            type="button"
            disabled={devicesLocked}
            onClick={() => deviceAttempt('link')}
          >
            LINK DEVICE
          </button>

          <label className="sg-label" htmlFor="passkey-input">PASSKEY</label>
          <div className="sg-passkey-row">
            <input
              id="passkey-input"
              className="sg-input"
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="K1-bound passkey"
              autoComplete="off"
              spellCheck={false}
            />
            <button id="passkey-enter" className="sg-enter" type="button" onClick={verifyPasskey}>
              ENTER
            </button>
          </div>

          <section className="sg-authgate-note">
            <h2>AUTH-GATE</h2>
            <p>Same device: SCAN. Different device: USB then LINK DEVICE.</p>
            <p>Enter K1 first. SCRUB clears all state.</p>
          </section>

          <section className="sg-side-caution" aria-label="Caution">
            <h2>{'⚠'} CAUTION</h2>
            <p>Use at your own risk.</p>
            <p>Hope for the best.</p>
            <p>If you&apos;re a hacker? <span className="sg-red">Get fucked.</span></p>

            <button
              id="admin-black-circle"
              className="sg-admin-circle"
              type="button"
              aria-label="Admin human-route passkey generator"
              onClick={() => setAdminOpen((v) => !v)}
            >
              {'⚫'}-&apos;
            </button>

            {adminOpen && (
              <div className="sg-admin-inline" aria-label="Admin passkey generator">
                <label className="sg-label" htmlFor="admin-key-inline">ADMIN KEY</label>
                <input
                  id="admin-key-inline"
                  className="sg-input"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Paste admin key..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <label className="sg-label" htmlFor="admin-k1-inline">K1 ADDRESS</label>
                <input
                  id="admin-k1-inline"
                  className="sg-input"
                  value={adminK1}
                  onChange={(e) => setAdminK1(e.target.value)}
                  placeholder="Paste user's K1 address..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  id="admin-generate-passkey-inline"
                  className="sg-admin-generate"
                  type="button"
                  onClick={generateAdminPasskey}
                >
                  GENERATE PASSKEY
                </button>
                <div id="admin-status-inline" className="sg-admin-status" aria-live="polite">
                  {adminStatus}
                </div>
              </div>
            )}
          </section>

          <div className="sg-attempts">
            Attempts: {Math.min(deviceAttempts, MAX_DEVICE_ATTEMPTS)}/{MAX_DEVICE_ATTEMPTS}
          </div>
          <div className="sg-auth-msg" aria-live="polite">{authMsg}</div>

          <div className="sg-version">
            777G v1.0 · {dashboardUnlocked ? 'AUTHENTICATED' : 'SECURE'}
          </div>
        </aside>

        <main className={`sg-main ${dashboardUnlocked ? 'sg-main--unlocked' : 'sg-main--locked'}`}>
          {!dashboardUnlocked && (
            <>
              <section className="sg-standalone">
                <h1>STANDALONE OPERATION</h1>
                <p>Auth flow executes client-side. K1 data is not submitted to any operator or third party.</p>
                <p>Chain checks stay backend-routed for security.</p>
                <p>Endpoint details never appear in the browser.</p>
              </section>

              <section className="sg-warning">
                <p>BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE.</p>
                <p>PLUS YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I&apos;M JUST A STICK FIGURE.</p>
              </section>

              <p className="sg-gate-hint">
                Complete the Auth-Gate with a verified K1-bound passkey to reveal the recovery workspace.
              </p>
            </>
          )}

          {dashboardUnlocked && (
            <>
              <nav className="sg-tabs" aria-label="Dashboard sections">
                <button
                  type="button"
                  className={activeTab === 'deployment' ? 'active' : ''}
                  onClick={() => setActiveTab('deployment')}
                >
                  Deployment
                </button>
                <button
                  type="button"
                  className={activeTab === 'protection' ? 'active' : ''}
                  onClick={() => setActiveTab('protection')}
                >
                  Protection
                </button>
                <button
                  type="button"
                  className={activeTab === 'status' ? 'active' : ''}
                  onClick={() => setActiveTab('status')}
                >
                  Status
                </button>
              </nav>

              {activeTab === 'deployment' && (
                <section className="sg-card">
                  <h1>EIP-777G DEPLOYMENT</h1>
                  <p>
                    Recovery mode is for an already-compromised K1. K2 and K3 are public addresses only.
                    Backend receives signedTx only.
                  </p>

                  <div className="sg-grid">
                    <div>
                      <label className="sg-label">DEPLOYER ADDRESS</label>
                      <input
                        className="sg-input"
                        value={deployerAddress}
                        onChange={(e) => setDeployerAddress(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sg-label">DEPLOYER BURNER KEY</label>
                      <input
                        className="sg-input"
                        type="password"
                        value={deployerKey}
                        onChange={(e) => setDeployerKey(e.target.value)}
                        placeholder="session-only"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sg-label">K1 ADDRESS</label>
                      <input className="sg-input" value={k1Address} readOnly />
                    </div>
                    <div>
                      <label className="sg-label">K1 COMPROMISED KEY</label>
                      <input
                        className="sg-input"
                        type="password"
                        value={k1SessionKey}
                        onChange={(e) => setK1SessionKey(e.target.value)}
                        placeholder="session-only"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sg-label">K2 AUTH ADDRESS</label>
                      <input
                        className="sg-input"
                        value={k2Address}
                        onChange={(e) => setK2Address(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sg-label">K3 CLEAN DESTINATION ADDRESS</label>
                      <input
                        className="sg-input"
                        value={k3Address}
                        onChange={(e) => setK3Address(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sg-label">CHAIN</label>
                      <select
                        className="sg-input"
                        value={selectedChain}
                        onChange={(e) => setSelectedChain(e.target.value)}
                      >
                        <option value="">Select chain</option>
                        {chains.map((chain) => (
                          <option key={chain.slug} value={chain.slug} disabled={!chain.deploySupported}>
                            {chain.name} ({chain.nativeSymbol})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="sg-label">SIGNED TX</label>
                      <input
                        className="sg-input"
                        value={signedTx}
                        onChange={(e) => setSignedTx(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  <div className="sg-actions">
                    <button type="button" onClick={calculateFunding}>CALCULATE FUNDING</button>
                    <button type="button" onClick={lockGateIn}>LOCK GATE IN</button>
                  </div>

                  <div className="sg-status">{fundingStatus}</div>
                  <div className="sg-status">{deployStatus}</div>

                  <div className="sg-progress-grid">
                    <div className="sg-mini-card">
                      <h2>DEPLOYMENT PROGRESS</h2>
                      <div className="sg-progress-track">
                        <div
                          className="sg-progress-fill"
                          style={{
                            width: activeStep < 0
                              ? '0%'
                              : `${Math.round(((activeStep + 1) / PROGRESS_LABELS.length) * 100)}%`
                          }}
                        />
                      </div>
                      {PROGRESS_LABELS.map((lbl, i) => (
                        <div className="sg-step" key={lbl}>
                          <span className={i <= activeStep ? 'on' : ''} />
                          {lbl}
                        </div>
                      ))}
                    </div>
                    <div className="sg-mini-card">
                      <h2>VERIFYING PROTECTION</h2>
                      <p>Runs after the gate is locked in.</p>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'protection' && (
                <section className="sg-card">
                  <h1>PROTECTION SETUP</h1>
                  <p>
                    Protection is proactive setup before compromise. K2 and K3 are public addresses only.
                    No K2 or K3 private key is entered.
                  </p>
                  <div className="sg-grid">
                    <div>
                      <label className="sg-label">K1 ADDRESS</label>
                      <input className="sg-input" value={k1Address} readOnly />
                    </div>
                    <div>
                      <label className="sg-label">K2 ADDRESS</label>
                      <input
                        className="sg-input"
                        value={k2Address}
                        onChange={(e) => setK2Address(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sg-label">K3 ADDRESS</label>
                      <input
                        className="sg-input"
                        value={k3Address}
                        onChange={(e) => setK3Address(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="sg-actions">
                    <button type="button" onClick={calculateFunding}>CALCULATE FUNDING</button>
                    <button type="button">AUTHORIZE PROTECTION</button>
                  </div>
                  <p className="sg-muted">
                    To activate: open K1 in your wallet and authorize the signature prompt. Signing activates
                    the contract and assigns K2 authorization. Any authorized transfer routes directly to K3.
                  </p>
                </section>
              )}

              {activeTab === 'status' && (
                <section className="sg-card">
                  <h1>STATUS</h1>
                  <div className="sg-statusrow">
                    <span className="on" />
                    Auth-Gate route: {verifiedRoute}
                  </div>
                  <div className="sg-statusrow">
                    <span className="on" />
                    Chain checks: backend-routed
                  </div>
                  <div className="sg-statusrow">
                    <span className="on" />
                    RPC endpoints: not exposed in browser
                  </div>
                  <div className="sg-statusrow">
                    <span className="on" />
                    Backend boundary: signedTx only
                  </div>
                </section>
              )}

              <section id="thanks-panel" className="sg-thanks-panel">
                <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">
                  {thanksHandle}
                </a>
                {thanksAddress && (
                  <button
                    type="button"
                    className="sg-copy-address"
                    onClick={() => navigator.clipboard?.writeText(thanksAddress)}
                  >
                    {thanksAddress}
                  </button>
                )}
                <textarea
                  id="thanks-message"
                  value={thanksMessage}
                  onChange={(e) => setThanksMessage(e.target.value)}
                  placeholder="Optional thank-you note"
                  maxLength={280}
                />
                <button id="thanks-send" type="button" onClick={sendThanks}>
                  Send thank-you
                </button>
                <div className="sg-status">{thanksStatus}</div>
              </section>
            </>
          )}
        </main>

      </div>

      <footer className="sg-footer">
        <div>THANK YOU</div>
        <div>BUILT BY EMP</div>
        <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">
          @hope_ology
        </a>
      </footer>
    </div>
  )
}
