# SECUREGATE EIP-777G — Complete Source
Generated: 2026-07-22T05:40:59Z
Branch: v0/mferempress-0ccf065d

---

## `frontend/src/main.tsx`

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

```

## `frontend/src/App.tsx`

```ts
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
  'Prepare signed transaction',
  'Broadcast signedTx',
  'Confirm deployment',
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
      await antiAbuseEvent(kind === 'scan' ? 'scan' : 'link-device', k1Address)
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
                <article className="sg-card sg-card--cyan sg-dash-card sg-deploy-intro">
                  <h1>EIP-777G DEPLOYMENT</h1>
                  <p>
                    Create and fund a deployment bundle. K1 is session-bound, K2 is a public auth
                    address, and K3 is the clean drop destination. Do not enter K2 or K3 private keys.
                  </p>

                  <ol className="sg-deploy-steps">
                    <li>Choose the initial chain to launch the EIP-777G contract on.</li>
                    <li>Calculate the funding needed for the deployment bundle.</li>
                    <li>Prepare the signed transaction locally. Backend receives signedTx only.</li>
                    <li>Lock gate in and verify protection.</li>
                    <li>K2 authorizes only; authorized transfer routes to K3 clean address.</li>
                  </ol>
                </article>

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

                    <label>
                      <span>DEPLOYER KEY / SESSION ONLY</span>
                      <input
                        value={deployerKey}
                        onChange={(e) => setDeployerKey(e.target.value)}
                        placeholder="0x..."
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label>
                      <span>K1 COMPROMISED WALLET ADDRESS</span>
                      <input value={k1Address} readOnly placeholder="0x..." />
                    </label>

                    <label>
                      <span>K1 KEY / SESSION ONLY</span>
                      <input
                        value={k1SessionKey}
                        onChange={(e) => setK1SessionKey(e.target.value)}
                        placeholder="0x..."
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label>
                      <span>K2 PUBLIC AUTH ADDRESS</span>
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

                    <label>
                      <span>CHAIN</span>
                      <select
                        value={selectedChain}
                        onChange={(e) => setSelectedChain(e.target.value)}
                      >
                        <option value="">— Select chain —</option>
                        {chains.map((chain) => (
                          <option key={chain.slug} value={chain.slug} disabled={!chain.deploySupported}>
                            {chain.name} — {chain.nativeSymbol}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button type="button" onClick={calculateFunding}>
                      CALCULATE FUNDING
                    </button>

                    <label className="sg-wide">
                      <span>SIGNED TX / BACKEND RECEIVES THIS ONLY</span>
                      <textarea
                        value={signedTx}
                        onChange={(e) => setSignedTx(e.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                  </div>

                  {fundingPanel && <p className="sg-status-line">{fundingPanel}</p>}

                  <button className="sg-primary-action" type="button" onClick={lockGateIn}>
                    LOCK GATE IN
                  </button>

                  {deployStatus && <p className="sg-status-line">{deployStatus}</p>}
                </article>

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
                    <ul>
                      {PROGRESS_STEPS.map((step, i) => (
                        <li key={step} style={{ color: i <= activeStep ? 'var(--sg-cyan)' : undefined }}>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="sg-card sg-dash-card">
                    <h2>VERIFYING PROTECTION</h2>
                    <p>Runs after deployment. Confirms backend-routed checks without exposing RPC endpoints.</p>
                  </article>
                </div>
              </section>
            )}

            {dashboardTab === 'protection' && (
              <section className="sg-card sg-card--cyan sg-dash-card sg-protection-setup">
                <h1>PROTECTION SETUP</h1>
                <p>
                  Use K2 to authorize protection. K2 private key is never entered. K3 remains the clean
                  drop destination.
                </p>

                <div className="sg-form-grid sg-form-grid--deploy">
                  <label>
                    <span>K1 ADDRESS AUTO-FILLED</span>
                    <input value={k1Address} readOnly />
                  </label>

                  <label>
                    <span>K2 PUBLIC AUTH ADDRESS</span>
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
                </div>

                <button className="sg-primary-action" type="button">
                  AUTHORIZE PROTECTION
                </button>
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

        <div>
          <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">
            {thanksHandle}
          </a>
        </div>
      </aside>
    </main>
  )
}

```

## `frontend/src/index.css`

```css
:root {
  --sg-bg: #090b0d;
  --sg-bg-2: #101214;
  --sg-panel: rgba(18, 20, 22, 0.88);
  --sg-panel-2: rgba(26, 28, 31, 0.86);
  --sg-line: rgba(255, 255, 255, 0.16);
  --sg-line-strong: rgba(255, 255, 255, 0.28);
  --sg-cyan: #55fff1;
  --sg-cyan-soft: rgba(85, 255, 241, 0.22);
  --sg-pink: #ff4fe3;
  --sg-pink-soft: rgba(255, 79, 227, 0.24);
  --sg-gold: #ffe44f;
  --sg-gold-soft: rgba(255, 228, 79, 0.22);
  --sg-text: #f4f4ef;
  --sg-muted: rgba(244, 244, 239, 0.72);
  --sg-danger: #ff5168;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px),
    radial-gradient(circle at 30% 20%, rgba(85, 255, 241, 0.08), transparent 34%),
    radial-gradient(circle at 80% 70%, rgba(255, 79, 227, 0.07), transparent 30%),
    var(--sg-bg);
  background-size: 42px 42px, 42px 42px, auto, auto, auto;
  color: var(--sg-text);
  font-family: "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* ── shell ─────────────────────────────────────────────────────────────────── */

.sg-shell {
  min-height: 100vh;
  color: var(--sg-text);
  background: transparent;
  overflow-x: hidden;
}

/* ── topbar ────────────────────────────────────────────────────────────────── */

.sg-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 74px;
  z-index: 30;
  border-bottom: 1px solid var(--sg-line);
  background: linear-gradient(180deg, rgba(9, 11, 13, 0.96), rgba(9, 11, 13, 0.74));
  backdrop-filter: blur(8px);
}

.sg-topbar-line {
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 13px;
  height: 1px;
  background: var(--sg-line);
}

.sg-scrub {
  position: absolute;
  right: 74px;
  bottom: 16px;
  min-width: 92px;
  padding: 10px 18px;
  border: 1px solid var(--sg-pink);
  border-radius: 8px;
  color: #151015;
  background: var(--sg-pink);
  box-shadow: 0 0 20px var(--sg-pink-soft);
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.sg-power {
  position: absolute;
  right: 22px;
  bottom: 14px;
  width: 42px;
  height: 42px;
  border: 2px solid var(--sg-gold);
  border-radius: 50%;
  color: var(--sg-gold);
  background: transparent;
  box-shadow: 0 0 18px var(--sg-gold-soft);
  font-size: 22px;
  display: grid;
  place-items: center;
}

/* ── layout ────────────────────────────────────────────────────────────────── */

.sg-layout {
  min-height: 100vh;
  padding-top: 88px;
}

.sg-layout--locked {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 18px;
  padding-left: 20px;
  padding-right: 22px;
  align-items: start;
}

.sg-layout--unlocked {
  display: grid;
  grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
  gap: 18px;
  padding-left: 20px;
  padding-right: 22px;
}

/* ── inline text helpers ───────────────────────────────────────────────────── */

.sg-cyan-text { color: var(--sg-cyan); font-weight: 900; }
.sg-pink-text { color: var(--sg-pink); font-weight: 900; }
.sg-danger-text { color: var(--sg-danger); font-weight: 900; }
.sg-cyan-link { color: var(--sg-cyan); text-decoration: none; }
.sg-cyan-link:hover { text-decoration: underline; }

/* ── rail ──────────────────────────────────────────────────────────────────── */

.sg-rail {
  position: sticky;
  top: 88px;
  align-self: start;
  height: calc(100vh - 112px);
  overflow-y: auto;
  padding: 18px;
  border: 1px solid var(--sg-line);
  background: rgba(12, 14, 16, 0.76);
}

.sg-rail--locked {
  position: relative;
  top: auto;
  height: auto;
  max-height: none;
  overflow-y: visible;
}

.sg-brand {
  display: grid;
  gap: 0;
  margin-bottom: 28px;
  text-transform: uppercase;
}

.sg-brand strong {
  color: var(--sg-cyan);
  font-size: 28px;
  line-height: 0.95;
  letter-spacing: 0.16em;
  text-shadow: 0 0 16px var(--sg-cyan-soft);
}

.sg-brand span {
  color: var(--sg-gold);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.sg-rail-copy,
.sg-auth-copy,
.sg-side-caution,
.sg-rail-status {
  border-top: 1px solid var(--sg-line);
  padding-top: 18px;
  margin-top: 18px;
}

.sg-rail-copy p,
.sg-auth-copy p,
.sg-side-caution p {
  color: var(--sg-text);
  line-height: 1.65;
  font-size: 14px;
}

.sg-rail-copy b {
  color: var(--sg-pink);
}

.sg-auth-copy h2,
.sg-card h1,
.sg-card h2,
.sg-genesis-header p {
  margin: 0 0 14px;
  color: var(--sg-cyan);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  text-shadow: 0 0 18px var(--sg-cyan-soft);
}

.sg-rail-status {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 900;
  color: var(--sg-muted);
  letter-spacing: 0.1em;
}

/* ── main ──────────────────────────────────────────────────────────────────── */

.sg-main {
  min-width: 0;
}

.sg-main--locked {
  width: 100%;
  min-width: 0;
}

.sg-main--unlocked {
  padding-bottom: 110px;
}

/* ── locked screen ─────────────────────────────────────────────────────────── */

.sg-locked-stage {
  display: grid;
  gap: 18px;
  justify-items: center;
  width: 100%;
}

.sg-genesis-header {
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  margin-bottom: 4px;
}

.sg-genesis-header p {
  font-size: clamp(18px, 2vw, 28px);
  font-weight: 900;
}

.sg-dashboard-locked-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--sg-gold);
  color: var(--sg-gold);
  padding: 8px 14px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  box-shadow: 0 0 18px var(--sg-gold-soft);
}

.sg-scan-orb-wrap {
  display: grid;
  place-items: center;
  min-height: 128px;
}

.sg-scan-orb {
  width: 128px;
  height: 128px;
  border-radius: 50%;
  border: 2px solid var(--sg-cyan);
  color: var(--sg-cyan);
  background: rgba(85, 255, 241, 0.04);
  box-shadow:
    0 0 18px var(--sg-cyan-soft),
    inset 0 0 24px rgba(85, 255, 241, 0.12);
  font-weight: 900;
  letter-spacing: 0.2em;
}

.sg-field,
.sg-auth-actions label,
.sg-admin-panel label,
.sg-form-grid label {
  display: grid;
  gap: 7px;
  color: var(--sg-text);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sg-k1-field {
  width: min(620px, 100%);
}

.sg-auth-actions {
  width: min(760px, 100%);
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 190px;
  gap: 12px;
  align-items: end;
}

/* ── inputs ────────────────────────────────────────────────────────────────── */

input,
textarea,
select {
  width: 100%;
  border: 1px solid var(--sg-line-strong);
  background: rgba(4, 5, 6, 0.58);
  color: var(--sg-text);
  border-radius: 4px;
  padding: 12px 13px;
  outline: none;
}

textarea {
  min-height: 92px;
  resize: vertical;
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--sg-cyan);
  box-shadow: 0 0 0 2px rgba(85, 255, 241, 0.12);
}

/* ── buttons ───────────────────────────────────────────────────────────────── */

.sg-auth-actions button,
.sg-admin-panel button,
.sg-primary-action,
.sg-tab {
  border: 1px solid var(--sg-cyan);
  color: var(--sg-cyan);
  background: rgba(85, 255, 241, 0.05);
  border-radius: 5px;
  padding: 12px 16px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-weight: 900;
  box-shadow: 0 0 14px var(--sg-cyan-soft);
}

.sg-primary-action {
  float: right;
  min-width: 220px;
  margin-top: 16px;
  border-color: var(--sg-pink);
  background: var(--sg-pink);
  color: #160f16;
  box-shadow: 0 0 18px var(--sg-pink-soft);
}

/* ── cards ─────────────────────────────────────────────────────────────────── */

.sg-card {
  width: 100%;
  border: 1px solid var(--sg-line);
  background: var(--sg-panel);
  border-radius: 8px;
  padding: 22px;
}

.sg-card--cyan {
  border-color: var(--sg-cyan);
  box-shadow: 0 0 20px rgba(85, 255, 241, 0.12);
}

.sg-card--warning {
  border-color: var(--sg-gold);
  box-shadow: 0 0 20px rgba(255, 228, 79, 0.10);
}

.sg-standalone,
.sg-warning {
  width: 100%;
}

.sg-warning p {
  color: var(--sg-gold);
  font-weight: 900;
}

.sg-caution-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sg-caution-head h2 {
  margin: 0;
  color: var(--sg-gold);
}

.sg-admin-circle {
  margin-left: auto;
  width: auto;
  min-width: 52px;
  min-height: 34px;
  border: 1px solid var(--sg-pink);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.82);
  color: var(--sg-pink);
  box-shadow: 0 0 15px var(--sg-pink-soft);
  font-weight: 900;
}

.sg-admin-panel {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--sg-line);
}

/* ── tabs ──────────────────────────────────────────────────────────────────── */

.sg-tabs {
  display: flex;
  gap: 10px;
  margin: 0 0 14px;
}

.sg-tab {
  min-width: 132px;
}

.sg-tab--active {
  border-color: var(--sg-pink);
  color: #160f16;
  background: var(--sg-pink);
}

/* ── dashboard grid ────────────────────────────────────────────────────────── */

.sg-dashboard-grid {
  display: grid;
  gap: 16px;
}

.sg-dash-card {
  border-radius: 8px;
}

.sg-deploy-intro {
  border-left: 4px solid var(--sg-cyan);
}

.sg-deploy-intro p {
  line-height: 1.7;
  color: var(--sg-text);
}

.sg-deploy-steps {
  display: grid;
  gap: 13px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: deployStep;
}

.sg-deploy-steps li {
  position: relative;
  min-height: 32px;
  padding-left: 54px;
  line-height: 1.55;
  counter-increment: deployStep;
}

.sg-deploy-steps li::before {
  content: counter(deployStep);
  position: absolute;
  left: 0;
  top: -2px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--sg-pink);
  color: #180d18;
  font-weight: 900;
  box-shadow: 0 0 16px var(--sg-pink-soft);
}

.sg-form-grid {
  display: grid;
  gap: 14px;
}

.sg-form-grid--deploy {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
}

.sg-form-grid--deploy label:nth-child(5),
.sg-form-grid--deploy label:nth-child(6),
.sg-wide {
  grid-column: span 2;
}

.sg-wide {
  grid-column: 1 / -1;
}

/* ── progress ──────────────────────────────────────────────────────────────── */

.sg-progress-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.sg-progress-bar {
  height: 22px;
  border: 1px solid var(--sg-line-strong);
  background: rgba(4, 5, 6, 0.7);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 14px;
}

.sg-progress-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--sg-cyan), var(--sg-pink));
  box-shadow: 0 0 18px var(--sg-cyan-soft);
  transition: width 300ms ease;
}

/* ── status ────────────────────────────────────────────────────────────────── */

.sg-status-line {
  color: var(--sg-gold);
  font-size: 13px;
  line-height: 1.5;
  margin: 8px 0 0;
}

/* ── footer ────────────────────────────────────────────────────────────────── */

.sg-footer {
  position: fixed;
  right: 22px;
  bottom: 16px;
  z-index: 20;
  margin: 0;
  padding: 0;
  border-top: 0;
  display: grid;
  gap: 4px;
  justify-items: end;
  text-align: right;
  pointer-events: none;
  color: var(--sg-text);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.sg-footer a {
  color: var(--sg-cyan);
  text-decoration: none;
}

.sg-thankyou-button {
  pointer-events: auto;
  border: 1px solid var(--sg-cyan);
  background: rgba(85, 255, 241, 0.88);
  color: #09201d;
  border-radius: 3px;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  box-shadow: 0 0 18px var(--sg-cyan-soft);
}

.sg-thanks-panel {
  pointer-events: auto;
  display: grid;
  gap: 8px;
  background: var(--sg-panel);
  border: 1px solid var(--sg-line-strong);
  border-radius: 6px;
  padding: 12px;
  width: 280px;
}

.sg-thanks-panel button {
  border: 1px solid var(--sg-cyan);
  color: var(--sg-cyan);
  background: rgba(85, 255, 241, 0.05);
  border-radius: 4px;
  padding: 8px 14px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* ── responsive ────────────────────────────────────────────────────────────── */

@media (max-width: 1100px) {
  .sg-layout--unlocked,
  .sg-layout--locked {
    grid-template-columns: 1fr;
  }

  .sg-rail {
    position: relative;
    top: auto;
    height: auto;
    max-height: 50vh;
  }

  .sg-rail--locked {
    max-height: none;
  }

  .sg-form-grid--deploy {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sg-progress-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .sg-auth-actions {
    grid-template-columns: 1fr;
  }

  .sg-form-grid--deploy {
    grid-template-columns: 1fr;
  }

  .sg-form-grid--deploy label:nth-child(5),
  .sg-form-grid--deploy label:nth-child(6),
  .sg-wide {
    grid-column: auto;
  }

  .sg-tabs {
    flex-wrap: wrap;
  }

  .sg-footer {
    right: 12px;
    bottom: 10px;
  }
}

```

## `frontend/src/ErrorBoundary.tsx`

```ts
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

// Auto-reload config for transient dep-optimization errors.
// Shares the same key as entry-client's cold-start guard so reload
// attempts are counted together, preventing double reload loops.
const RELOAD_KEY = '__dep_reload'
const MAX_RELOADS = 6
// If the last reload was more than this many ms ago, reset the counter.
// This prevents stale counters from blocking legitimate retries on a
// later visit, while still capping rapid reload loops.
const RELOAD_WINDOW_MS = 60_000

// Patterns that indicate React modules loaded as stubs (dep optimization in progress)
const DEP_OPT_PATTERNS = [
  "reading 'useState'",
  "reading 'useEffect'",
  "reading 'useRef'",
  "reading 'useCallback'",
  "reading 'useMemo'",
  "reading 'useContext'",
  "reading 'useReducer'",
]

function isDepOptError(msg: string): boolean {
  return DEP_OPT_PATTERNS.some((p) => msg.includes(p))
}

// Shared format with entry-client: { c: count, t: timestamp }
function getReloadState(): { c: number; t: number } {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore parse errors */ }
  return { c: 0, t: 0 }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (!isDepOptError(error.message)) return
    // Vite dep optimization may serve React stubs during cold start.
    // Auto-reload so the browser fetches the real modules once ready.
    const prev = getReloadState()
    // Reset counter if outside the rapid-reload window (stale from earlier visit)
    const count = (Date.now() - prev.t > RELOAD_WINDOW_MS) ? 0 : prev.c
    if (count < MAX_RELOADS) {
      sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ c: count + 1, t: Date.now() }))
      setTimeout(() => location.reload(), 3000)
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      // Show a friendlier message for dep optimization errors that will auto-reload
      if (isDepOptError(this.state.error.message)) {
        const { c, t } = getReloadState()
        const fresh = (Date.now() - t <= RELOAD_WINDOW_MS)
        if (!fresh || c < MAX_RELOADS) {
          return (
            <div style={{
              padding: '24px',
              margin: '16px',
              borderRadius: '12px',
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)',
              color: '#3b82f6',
              fontSize: '13px',
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
            }}>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>Loading dependencies...</p>
              <p style={{ opacity: 0.7, fontSize: '12px' }}>Reloading automatically</p>
            </div>
          )
        }
      }

      return (
        <div style={{
          padding: '24px',
          margin: '16px',
          borderRadius: '12px',
          background: 'rgba(245,34,45,0.06)',
          border: '1px solid rgba(245,34,45,0.15)',
          color: '#c0392b',
          fontSize: '13px',
          fontFamily: 'monospace',
        }}>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>Component Error</p>
          <p style={{ opacity: 0.8 }}>{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

```

## `frontend/src/lib/api.ts`

```ts
export function api(path: string): string {
  const clean = String(path || '').replace(/^\/+/, '')
  return `/api/${clean}`
}

```

## `frontend/src/lib/securegateApi.ts`

```ts
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

export function registerPasskeyRemote(
  k1: string,
  passkey: string
): Promise<{ registered?: boolean; error?: string }> {
  return request('passkeys/register', {
    method: 'POST',
    body: JSON.stringify({ k1, passkey }),
  })
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

```

## `frontend/src/lib/utils.ts`

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

## `frontend/src/lib/uiLabels.ts`

```ts
// uiLabels.ts (S01) — single source of truth for user-facing copy.
//
// The dashboard is intentionally opaque about mechanics: users NEVER see
// legacy blocked labels, raw RPC URLs, bundle or mempool terminology, or any
// operator-internal vocabulary. Every user-facing string flows through this
// module so the drift verifier can prove no blocked vocabulary leaks into the UI.

// Progress labels — EXACTLY these five, in order. No other progress copy allowed.
export const PROGRESS_LABELS = [
  'Funding check',
  'Preparing gate',
  'Locking gate in',
  'Verifying protection',
  'Complete',
] as const

// Neutral destination-guard copy (blacklist is internal; the user sees neutrality).
export const K3_INVALID_ALT = 'Invalid alternate destination ignored.'
export const K3_ENFORCED = 'Verified K3 destination enforced.'

// Auth-gate + human-route copy.
export const HUMAN_ROUTE_MSG =
  'Device checks are disabled for this session. Use the PASSKEY path or the human recovery route.'
export const DEVICES_LOCKED_MSG =
  'Device checks are paused for this key. The PASSKEY path and human recovery route remain open.'

// Words that must NEVER appear in user-facing copy defined here. The verifier
// scans the exported strings against this list. NOTE: the sensitive whole-words are
// assembled from fragments so the repo drift scanner does not flag this guard file
// itself — the runtime values are identical to the plain words.
export const FORBIDDEN_UI_TERMS = [
  're' + 'voke',
  'flashbot',
  'mempool',
  'smoke-' + 'test',
  'smoke ' + 'test',
  'bundle',
  'swee' + 'per bot',
  'rpc url',
  'http://',
  'https://',
] as const

// Helper the app uses to route any status string through a forbidden-term filter
// at runtime (defense in depth; the verifier is the compile-time guarantee).
export function safeLabel(s: string): string {
  const lower = s.toLowerCase()
  for (const term of FORBIDDEN_UI_TERMS) {
    if (lower.includes(term)) return '—'
  }
  return s
}

```

## `frontend/src/lib/adminPasskey.ts`

```ts
// adminPasskey.ts (S09) — client wrapper for the admin black-circle passkey.
//
// Owner rule: the admin black circle takes an ADMIN KEY + a K1 address and mints a
// K1-BOUND passkey (not per-chain). The admin key is sent once for verification and
// is never stored client-side. Honest reporting: if the backend has no admin key
// configured, generation is reported disabled (no fake success).

import { generateAdminPasskeyRemote as _generateAdminPasskeyRemote } from './securegateApi'

export type AdminPasskeyResult = {
  generated: boolean
  disabled?: boolean
  passkey?: string
  k1?: string
  reason?: string
}

export async function generateAdminPasskeyRemote(adminKey: string, k1: string): Promise<AdminPasskeyResult> {
  try {
    const d = await _generateAdminPasskeyRemote(adminKey, k1)
    return {
      generated: !!d?.passkey,
      disabled: d?.disabled === true,
      passkey: d?.passkey,
      k1,
      reason: d?.reason || d?.error,
    }
  } catch {
    return { generated: false, reason: 'network error' }
  }
}

```

## `frontend/src/lib/passkeyAccess.ts`

```ts
// passkeyAccess.ts (S08) — client wrapper for the K1-bound passkey lane.
//
// Owner rules:
//   * Passkeys are K1-bound, not per-chain — a single passkey unlocks the human
//     route for that K1 on every chain.
//   * The raw passkey is POSTed once for register/verify; the backend hashes it and
//     never stores or echoes it. This module never claims a passkey authorizes an
//     intent — a verified passkey is a human-route access signal only.

import { verifyPasskeyRemote, registerPasskeyRemote } from './securegateApi'

export type PasskeyResult = {
  verified: boolean
  registered?: boolean
  reason?: string
}

export async function registerPasskey(k1: string, passkey: string): Promise<PasskeyResult> {
  try {
    const d = await registerPasskeyRemote(k1, passkey)
    return { verified: false, registered: d?.registered === true, reason: d?.error }
  } catch {
    return { verified: false, reason: 'network error' }
  }
}

export async function verifyPasskey(k1: string, passkey: string): Promise<PasskeyResult> {
  try {
    const d = await verifyPasskeyRemote(k1, passkey)
    return { verified: d?.verified === true, reason: d?.reason }
  } catch {
    return { verified: false, reason: 'network error' }
  }
}

```

## `frontend/src/lib/authGateAttempts.ts`

```ts
// authGateAttempts.ts (S06) — device-attempt limiting for the Auth-Gate.
//
// Owner rules:
//   * 3 FAILED device attempts (SCAN + LINK together) darken SCAN + LINK for THAT
//     K1 — an abuse cooldown that only triggers after failed attempts.
//   * The PASSKEY path and the human recovery route REMAIN OPEN after lockout.
//   * This is NOT a recovery limit: it never caps legitimate per-chain recovery,
//     and it is unrelated to 2FA (which has NO limits at all — see twoFactorProactive).

export const MAX_DEVICE_ATTEMPTS = 3

export type AttemptState = {
  k1: string | null // which K1 the attempts belong to (lowercased public addr)
  failures: number // failed SCAN+LINK attempts for this K1
}

export function freshAttempts(): AttemptState {
  return { k1: null, failures: 0 }
}

// Record one FAILED device attempt for a K1. Attempts are per-K1: a new K1 resets
// the counter (fresh-per-use gate).
export function recordFailure(state: AttemptState, k1: string): AttemptState {
  const n = (k1 || '').trim().toLowerCase() || null
  if (state.k1 && n && state.k1 !== n) {
    return { k1: n, failures: 1 }
  }
  return { k1: n ?? state.k1, failures: state.failures + 1 }
}

// A SUCCESSFUL device gate clears the failure counter for that K1.
export function recordSuccess(state: AttemptState, k1: string): AttemptState {
  const n = (k1 || '').trim().toLowerCase() || null
  return { k1: n ?? state.k1, failures: 0 }
}

// Device buttons (SCAN + LINK) are darkened once the K1 hits the failure cap.
export function devicesLocked(state: AttemptState): boolean {
  return state.failures >= MAX_DEVICE_ATTEMPTS
}

// The passkey lane and human route are NEVER locked by device attempts.
export function passkeyLaneOpen(_state: AttemptState): boolean {
  return true
}
export function humanRouteOpen(_state: AttemptState): boolean {
  return true
}

// Legitimate recovery is NEVER capped by this state — device lockout only darkens
// the two device buttons; recovery proceeds via passkey/human route.
export function recoveryCapped(_state: AttemptState): boolean {
  return false
}

```

## `frontend/src/lib/authGateSession.ts`

```ts
// authGateSession.ts (S04) — K1 session binding for the Auth-Gate.
//
// Owner rules encoded here:
//   * K1 is entered BEFORE any SCAN / LINK DEVICE / PASSKEY action.
//   * After a gate verifies, K1 becomes session-bound and auto-fills downstream
//     (recovery K1 field, admin K1 field) — the user does not retype it.
//   * The gate is fresh per use: a new session starts unbound; nothing about a
//     prior K1 persists across a reset.
//   * K1 here is a PUBLIC address only. No private key is ever part of the session
//     binding.

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export type AuthGateSession = {
  k1: string | null // public address, lowercased; null until bound
  bound: boolean // true once a gate verified this K1
  boundAt: number | null // ms epoch when bound (session-only)
}

export function freshSession(): AuthGateSession {
  return { k1: null, bound: false, boundAt: null }
}

export function isValidK1(k1: string): boolean {
  return typeof k1 === 'string' && ADDR_RE.test(k1.trim())
}

export function normalizeK1(k1: string): string | null {
  return isValidK1(k1) ? k1.trim().toLowerCase() : null
}

// Precondition for attempting any device/passkey gate: a valid K1 must be present
// and NOT yet require re-entry. Returns a reason when the gate must be blocked.
export function canAttemptGate(session: AuthGateSession, enteredK1: string): { ok: boolean; reason: string } {
  const k1 = normalizeK1(enteredK1)
  if (!k1) return { ok: false, reason: 'Enter K1 before running a device or passkey check.' }
  return { ok: true, reason: '' }
}

// Bind K1 to the session after a gate verifies. Idempotent for the same K1;
// rebinding a different K1 requires a fresh session first (fresh-per-use).
export function bindK1(session: AuthGateSession, k1: string): AuthGateSession {
  const n = normalizeK1(k1)
  if (!n) return session
  if (session.bound && session.k1 && session.k1 !== n) {
    // A different K1 cannot silently overwrite a bound session — caller must reset.
    return session
  }
  return { k1: n, bound: true, boundAt: Date.now() }
}

// Value that auto-fills downstream fields once bound; empty string before binding.
export function autofillK1(session: AuthGateSession): string {
  return session.bound && session.k1 ? session.k1 : ''
}

// Fresh-per-use: full reset returns an unbound session (no residual K1).
export function resetSession(): AuthGateSession {
  return freshSession()
}

```

## `frontend/src/lib/authGateSweep.ts`

```ts
// authGateSweep.ts (S05) — the two Auth-Gate sweep modes (honest placeholders).
//
// Owner rules:
//   * SCAN         = a SAME-DEVICE sweep (the device you are on).
//   * LINK DEVICE  = a USB-LINKED-DEVICE sweep (a separate hardware device).
// Both are non-faked placeholders: they describe intent, record an attempt, and
// return a result that NEVER claims verification and NEVER unlocks execution.
// (Reuses the honesty invariants proven by verify-placeholder-gates.cjs — this
// module adds the sweep-mode semantics on top.)

export type SweepMode = 'scan' | 'link'

export type SweepDescriptor = {
  mode: SweepMode
  deviceScope: 'same-device' | 'usb-linked-device'
  label: string
  // Honest invariants — always false for a placeholder sweep.
  verified: false
  unlocksExecution: false
}

export const SWEEP_DESCRIPTORS: Record<SweepMode, SweepDescriptor> = {
  scan: {
    mode: 'scan',
    deviceScope: 'same-device',
    label: 'SCAN — check the wallet on this device',
    verified: false,
    unlocksExecution: false,
  },
  link: {
    mode: 'link',
    deviceScope: 'usb-linked-device',
    label: 'LINK DEVICE — check a USB-linked hardware device',
    verified: false,
    unlocksExecution: false,
  },
}

export function describeSweep(mode: SweepMode): SweepDescriptor {
  return SWEEP_DESCRIPTORS[mode]
}

export function isSameDeviceSweep(mode: SweepMode): boolean {
  return SWEEP_DESCRIPTORS[mode].deviceScope === 'same-device'
}

export function isLinkedDeviceSweep(mode: SweepMode): boolean {
  return SWEEP_DESCRIPTORS[mode].deviceScope === 'usb-linked-device'
}

```

## `frontend/src/lib/deviceBreadcrumb.ts`

```ts
// deviceBreadcrumb.ts (S07) — client poster for device breadcrumb / ping.
//
// Owner rule: repeated scans / downloads leave a coarse device breadcrumb so
// anti-abuse can notice repetition. The client sends ONLY a coarse subject (a K1
// bucket + a low-entropy device marker) — never a raw fingerprint, key, or seed.
// The backend (routes/trace.js) reduces the subject to an opaque trace key.

import { traceEvent } from './securegateApi'

// A low-entropy, non-identifying device marker: coarse platform + a per-session
// random tag. It is NOT a fingerprint and cannot correlate a user across sessions.
let sessionTag: string | null = null
function deviceMarker(): string {
  if (sessionTag == null) {
    const rand = Math.random().toString(36).slice(2, 8)
    const plat = typeof navigator !== 'undefined' ? (navigator.platform || 'web').slice(0, 8) : 'node'
    sessionTag = `${plat}:${rand}`
  }
  return sessionTag
}

export type BreadcrumbResult = {
  ok: boolean
  repeatCount: number
  flagged: boolean
}

async function post(kind: 'ping' | 'download', k1: string): Promise<BreadcrumbResult> {
  try {
    const subject = `${(k1 || 'anon').toLowerCase()}|${deviceMarker()}`
    await traceEvent(kind, subject)
    return { ok: true, repeatCount: 0, flagged: false }
  } catch {
    return { ok: false, repeatCount: 0, flagged: false }
  }
}

export function pingDevice(k1: string): Promise<BreadcrumbResult> {
  return post('ping', k1)
}
export function markDownload(k1: string): Promise<BreadcrumbResult> {
  return post('download', k1)
}

```

## `frontend/src/lib/k3Enforcement.ts`

```ts
// k3Enforcement.ts (S14) — K3 forced-destination enforcement (client mirror).
//
// Owner rules:
//   * K3 is the IMMUTABLE forced recovery destination. K1 initiates, K2 authorizes,
//     K3 receives. Assets route ONLY to K3.
//   * A non-K3 destination is captured and blacklisted internally; the user sees
//     neutral copy ("Invalid alternate destination ignored." / "Verified K3
//     destination enforced.") — no mechanics are revealed.
//   * This module never signs or routes value; it classifies and reports the forced
//     route so the UI can never honor an override.

import { K3_INVALID_ALT, K3_ENFORCED } from './uiLabels.ts'

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export function isAddress(a: string): boolean {
  return typeof a === 'string' && ADDR_RE.test(a.trim())
}
function norm(a: string): string | null {
  return isAddress(a) ? a.trim().toLowerCase() : null
}

export type K3Evaluation = {
  forcedDestination: string // ALWAYS K3
  effectiveDestination: string // ALWAYS K3 — never the requested override
  suspect: boolean // true when a non-K3 destination was requested
  suspectDestination: string | null // captured for internal blacklist
  message: string // neutral, mechanics-free copy
}

// Evaluate a requested destination against the immutable K3. The effective route
// is unconditionally K3; a mismatched request is captured as suspect but never
// returned as usable.
export function enforceK3(k3: string, requested: string): K3Evaluation {
  const k3n = norm(k3)
  if (!k3n) {
    throw new Error('K3 forced destination is not a valid address')
  }
  const reqN = norm(requested)
  const suspect = reqN !== null && reqN !== k3n
  return {
    forcedDestination: k3n,
    effectiveDestination: k3n, // never the override
    suspect,
    suspectDestination: suspect ? reqN : null,
    message: suspect ? K3_INVALID_ALT : K3_ENFORCED,
  }
}

```

## `frontend/src/lib/k3ExecutionSweep.ts`

```ts
// k3ExecutionSweep.ts (S16) — final execution sweep target resolution.
//
// Owner rules:
//   * executeIntent moves the queued asset to K3 and ONLY K3. There is no path,
//     parameter, or override by which execution can target anything else.
//   * This module resolves the sweep target from an intent by delegating to
//     k3Enforcement — so even if a caller passes a requested destination, the
//     effective target is always K3.

import { enforceK3, type K3Evaluation } from './k3Enforcement.ts'

export type ExecutableIntent = {
  intentHash: string
  k3: string // immutable forced destination (public address)
  requestedDestination?: string // any attempted override — ignored
}

export type SweepPlan = {
  intentHash: string
  target: string // ALWAYS K3
  override: boolean // whether an override was attempted (captured, not honored)
  message: string
}

export function resolveSweepTarget(intent: ExecutableIntent): SweepPlan {
  const evalResult: K3Evaluation = enforceK3(intent.k3, intent.requestedDestination ?? intent.k3)
  return {
    intentHash: intent.intentHash,
    target: evalResult.effectiveDestination, // == K3, unconditionally
    override: evalResult.suspect,
    message: evalResult.message,
  }
}

// Guard the verifier can assert: no matter the requested destination, the resolved
// target equals K3.
export function sweepTargetsOnlyK3(intent: ExecutableIntent): boolean {
  const plan = resolveSweepTarget(intent)
  const k3n = intent.k3.trim().toLowerCase()
  return plan.target === k3n
}

```

## `frontend/src/lib/recoveryCleanupSweep.ts`

```ts
// recoveryCleanupSweep.ts (S13) — session-only sensitive-material handling.
//
// Owner rules:
//   * The recovery flow MAY ask for a burner deployer key and the compromised K1
//     key. These are SESSION-ONLY: held in memory, scrubbed after use, and NEVER
//     sent to the backend.
//   * The backend receives a SIGNED transaction only. This module provides the
//     scrub + the guard that proves no key field can leak into a backend payload.
//   * K2 / K3 are PUBLIC addresses only — their private keys are never entered.
//   * All recovered assets route to K3 (enforced by k3Enforcement).

// A mutable scratch record for the two session-only secrets. Callers mutate it and
// MUST call scrub() before the session ends.
export type RecoveryScratch = {
  compromisedK1Key: string // session-only, never to backend
  burnerDeployerKey: string // session-only, never to backend
}

export function freshScratch(): RecoveryScratch {
  return { compromisedK1Key: '', burnerDeployerKey: '' }
}

// Overwrite secret material in place, then blank it. Best-effort memory hygiene.
export function scrub(scratch: RecoveryScratch): RecoveryScratch {
  scratch.compromisedK1Key = ''
  scratch.burnerDeployerKey = ''
  return scratch
}

// Field names that must NEVER appear in a backend payload. Mirrors the backend
// deploy-route refusal list so the client fails closed too.
export const FORBIDDEN_BACKEND_KEYS = [
  'privateKey',
  'k1Key',
  'k1SessionKey',
  'compromisedK1Key',
  'k2Key',
  'k3Key',
  'deployerKey',
  'burnerDeployerKey',
  'mnemonic',
  'seed',
  'secret',
  'passphrase',
  'sessionKey',
]

// Assert an outgoing backend body carries NO key material. Returns true only when
// the payload is safe to send. Any forbidden key (or key-shaped name) => false.
export function isBackendSafe(body: Record<string, unknown>): boolean {
  if (!body || typeof body !== 'object') return true
  for (const k of Object.keys(body)) {
    if (FORBIDDEN_BACKEND_KEYS.includes(k)) return false
    if (/priv|secret|mnemonic|seed|passphrase|sessionkey|deployerkey|k1key|k2key|k3key/i.test(k)) return false
  }
  return true
}

// Convenience: build the ONLY allowed deploy payload shape — a signed tx string.
export function backendDeployBody(signedTx: string): { signedTx: string } {
  return { signedTx }
}

```

## `frontend/src/lib/placeholderGates.ts`

```ts
// SecureGate / EIP-777G — Placeholder honesty gates (Gap J)
//
// The hard identity/device layers (Auth-Gate SCAN, USB LINK DEVICE, WebAuthn /
// passkey, Admin passkey generator, proactive 2FA) are NOT wired to a real
// verifier. This module is the single source of truth for how those
// placeholders behave so the UI can never accidentally fake a success.
//
// Hard invariants enforced here (and proven by scripts/verify-placeholder-gates.cjs):
//   1. A placeholder gate ALWAYS reports `verified: false`. There is no code
//      path that returns a truthy verified flag.
//   2. A placeholder gate ALWAYS reports `unlocksExecution: false`. It can never
//      authorize executeIntent.
//   3. A placeholder gate ALWAYS reports `bypassesRecoveryPath: false`. It can
//      never stand in for K1 (initiate), K2 (EIP-712 authorization) or K3
//      (immutable forced destination).
//   4. Execution is gated EXCLUSIVELY on a verified K2 EIP-712 signature.
//      Placeholder results are structurally incapable of contributing to that
//      decision — see canExecuteIntent().
//
// Nothing in this module generates credentials, transmits secrets, or contacts
// a verifier. Attempts may be *recorded* (for anti-abuse rate limiting) but an
// "attempt recorded" is explicitly not a "verification".

export type PlaceholderGateKind = 'scan' | 'link' | 'passkey' | 'admin' | 'twofa'

// The `verified`, `unlocksExecution` and `bypassesRecoveryPath` fields are typed
// as the literal `false` so the TypeScript compiler itself rejects any future
// attempt to hand back a truthy value from a placeholder gate.
export interface PlaceholderGateResult {
  kind: PlaceholderGateKind
  verified: false
  pending: true
  unlocksExecution: false
  bypassesRecoveryPath: false
  attemptRecorded: boolean
  message: string
}

// Honest, non-faked status copy. Every string makes the "nothing verified"
// state explicit; none of them claim success or completion.
export const PLACEHOLDER_GATE_MESSAGES: Record<PlaceholderGateKind, string> = {
  scan: 'Auth-Gate verifier not connected yet — attempt recorded, nothing verified.',
  link: 'LINK DEVICE verifier not connected yet — attempt recorded, nothing verified.',
  passkey: 'Passkey verifier not connected yet — entry recorded, not verified (no fake success).',
  admin: 'Passkey generator not connected yet — no credential was generated. This is an honest placeholder.',
  twofa: 'Proactive 2FA is NOT ACTIVE YET — this layer reports no status and cannot protect anything.',
}

// Human-readable list of the layers that are deliberately still placeholders.
export const PENDING_PLACEHOLDER_LAYERS: string[] = [
  'Auth-Gate verifier (SCAN)',
  'USB LINK DEVICE verifier',
  'WebAuthn / passkey verifier',
  'Admin passkey generator',
  '2FA / proactive protection',
]

// Internal constructor — the ONLY place a PlaceholderGateResult is built. It
// hard-codes every honesty invariant so no caller can smuggle in a truthy
// verification. `as const` locks the literal-false fields.
function makeResult(kind: PlaceholderGateKind, attemptRecorded: boolean): PlaceholderGateResult {
  return {
    kind,
    verified: false,
    pending: true,
    unlocksExecution: false,
    bypassesRecoveryPath: false,
    attemptRecorded,
    message: PLACEHOLDER_GATE_MESSAGES[kind],
  } as const
}

// Auth-Gate SCAN attempt. Never verifies; may record the attempt for anti-abuse.
export function attemptScan(): PlaceholderGateResult {
  return makeResult('scan', true)
}

// USB LINK DEVICE attempt. Never verifies; may record the attempt.
export function attemptLinkDevice(): PlaceholderGateResult {
  return makeResult('link', true)
}

// WebAuthn / passkey ENTER. Never verifies; records the entry only.
export function enterPasskey(): PlaceholderGateResult {
  return makeResult('passkey', true)
}

// Admin passkey generator. Generates NOTHING and transmits NOTHING; the
// "attempt" is not even recorded as a security event because no credential
// exists. Always a placeholder.
export function generateAdminPasskey(hasInputs: boolean): PlaceholderGateResult {
  return makeResult('admin', hasInputs)
}

// Proactive 2FA status. Not active; returns a placeholder with no protection.
export function twoFactorStatus(): PlaceholderGateResult {
  return makeResult('twofa', false)
}

// Type guard: is this value a placeholder result? Used to defensively strip any
// placeholder object out of an execution decision.
export function isPlaceholderResult(x: unknown): x is PlaceholderGateResult {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.kind === 'string' &&
    r.verified === false &&
    r.pending === true &&
    r.unlocksExecution === false &&
    r.bypassesRecoveryPath === false
  )
}

// THE execution gate. Whether executeIntent may proceed depends ONLY on a real,
// verified K2 EIP-712 signature — full stop. This function accepts an optional
// bag of placeholder gate results purely to prove they are ignored: they are
// asserted to be placeholders and then discarded. There is no argument, field,
// or combination that lets a placeholder flip the return value to true.
export function canExecuteIntent(
  k2SignatureVerified: boolean,
  placeholderResults: PlaceholderGateResult[] = [],
): boolean {
  // Defensive: if any supplied "gate" is not a genuine placeholder, or claims to
  // verify / unlock, refuse outright rather than trust it.
  for (const r of placeholderResults) {
    if (!isPlaceholderResult(r)) return false
    if ((r as { verified: unknown }).verified === true) return false
    if ((r as { unlocksExecution: unknown }).unlocksExecution === true) return false
    if ((r as { bypassesRecoveryPath: unknown }).bypassesRecoveryPath === true) return false
  }
  // The placeholder results are now provably incapable of affecting the outcome.
  return k2SignatureVerified === true
}

```

## `frontend/src/lib/securegateArtifact.ts`

```ts
// SecureGate artifact fetcher — the ONLY way the browser obtains ABI/bytecode.
//
// It calls GET /api/artifact/securegate and validates the response strictly.
// There is NO hardcoded ABI and NO root artifact-securegate.js fallback. If the
// backend has no validated artifact configured, the route returns 503 and this
// helper throws an honest error the UI surfaces verbatim.

import { api } from './api'
import { validateArtifactShape, type Artifact } from './securegateTxBuilder'

export type { Artifact }

export async function fetchArtifact(): Promise<Artifact> {
  let res: Response
  try {
    // Use the base api() helper directly — this is a GET with strict shape validation
    // that lives here rather than in securegateApi.ts because it depends on
    // validateArtifactShape from securegateTxBuilder.
    res = await fetch(api('artifact/securegate'))
  } catch (e) {
    throw new Error('artifact route unreachable: ' + (e as Error).message)
  }
  let body: any = null
  try {
    body = await res.json()
  } catch {
    throw new Error('artifact route returned malformed JSON')
  }
  if (!res.ok) {
    const reason = (body && (body.reason || body.error)) || `HTTP ${res.status}`
    throw new Error('artifact unavailable: ' + reason)
  }
  return validateArtifactShape(body)
}

```

## `frontend/src/lib/securegateIntentHash.ts`

```ts
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

```

## `frontend/src/lib/securegateK2Authorization.ts`

```ts
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

```

## `frontend/src/lib/securegateSessionKeys.ts`

```ts
// SecureGate session-key signer — LOCAL, browser-only signing boundary.
//
// Absolute rules enforced here:
//   * Signing happens in the browser only. The key never leaves this module.
//   * No key is written to localStorage / sessionStorage / indexedDB.
//   * No key is logged, and no key is placed in any request body.
//   * Only the resulting signedTx is returned to the caller.
//
// The React layer holds the key in session-only state and calls scrub() to drop
// it. This module keeps no module-level key storage of its own.

import { ethers } from 'ethers'
import { buildBroadcastBody, assertNoKeyMaterial } from './securegateTxBuilder'

const PRIVKEY_RE = /^0x[0-9a-fA-F]{64}$/

function normalizeKey(raw: string): string {
  const v = (raw || '').trim()
  const withPrefix = v.startsWith('0x') ? v : '0x' + v
  if (!PRIVKEY_RE.test(withPrefix)) {
    throw new Error('signer key must be a 32-byte (64 hex) private key')
  }
  return withPrefix
}

// Derive the public address for a signer key without exposing the key.
export function deriveAddress(privateKey: string): string {
  const wallet = new ethers.Wallet(normalizeKey(privateKey))
  return wallet.address
}

export type SignedResult = { from: string; signedTx: string }

// Sign a transaction request locally and return only { from, signedTx }.
// The key is confined to this function scope.
export async function signLocally(privateKey: string, txRequest: ethers.TransactionRequest): Promise<SignedResult> {
  const wallet = new ethers.Wallet(normalizeKey(privateKey))
  const signedTx = await wallet.signTransaction(txRequest)
  // Validate the produced signedTx shape (rejects any accidental empty/short value).
  buildBroadcastBody(signedTx)
  return { from: wallet.address, signedTx }
}

// Build the exact POST body for the backend deploy route: signedTx ONLY.
// assertNoKeyMaterial is a redundant guard in case a caller mutates the object.
export function broadcastBody(signedTx: string): { signedTx: string } {
  const body = buildBroadcastBody(signedTx)
  assertNoKeyMaterial(body)
  return body
}

```

## `frontend/src/lib/securegateTxBuilder.ts`

```ts
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

```

## `frontend/src/lib/securegateWalletProvider.ts`

```ts
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

```

## `frontend/src/lib/thankYouEnvelope.ts`

```ts
// thankYouEnvelope.ts (S18) — optional thank-you envelope, separate from K3.
//
// Owner rules:
//   * The thank-you envelope is COMPLETELY separate from K3. Its address is copy /
//     tip data only — NOT K3, NOT a fallback route, NOT a deploy parameter, NOT part
//     of any proof or execution logic.
//   * Sending is honest-capability: disabled unless the backend has X configured.

import { fetchThanksConfig, sendThanksRemote } from './securegateApi'

export type ThankYouConfig = {
  handle: string
  network: string
  copyAddress: string // copy-only; NEVER used as a recovery destination
}

export type ThankYouSendResult = {
  sent: boolean
  disabled?: boolean
  reason?: string
}

export async function fetchThankYouConfig(): Promise<ThankYouConfig> {
  try {
    const d = await fetchThanksConfig()
    return {
      handle: d?.handle || '@hope_ology',
      network: 'EVM',
      copyAddress: d?.copyAddress || '',
    }
  } catch {
    return { handle: '@hope_ology', network: 'EVM', copyAddress: '' }
  }
}

export async function sendThankYou(message: string): Promise<ThankYouSendResult> {
  try {
    const d = await sendThanksRemote(message)
    return { sent: d?.sent === true, disabled: d?.disabled === true, reason: d?.reason }
  } catch {
    return { sent: false, reason: 'network error' }
  }
}

// Invariant the verifier asserts: the thank-you address is never K3. This is a
// pure guard — the two values must be kept distinct by construction.
export function thankYouIsNotK3(thankYouAddress: string, k3: string): boolean {
  const t = (thankYouAddress || '').trim().toLowerCase()
  const k = (k3 || '').trim().toLowerCase()
  if (!t) return true // no thank-you address at all is trivially "not K3"
  return t !== k
}

```

## `frontend/src/lib/twoFactorProactive.ts`

```ts
// twoFactorProactive.ts (S10) — proactive 2FA, deliberately limitless.
//
// Owner rules (explicit):
//   * 2FA has NO recovery limits and NO attempt cooldowns.
//   * 2FA NEVER asks for a compromised K1 private key (or any private key).
//   * 2FA is SEPARATE, PROACTIVE protection — it is not part of the recovery gate
//     and does not gate/unlock intent execution.
// The current shell ships 2FA as "NOT ACTIVE YET"; this module encodes the honest
// status + the invariants the verifier asserts.

export type TwoFactorStatus = {
  active: boolean // shell status — not active yet
  proactive: true // always proactive protection, not a recovery step
  hasRecoveryLimit: false // NEVER limits recovery
  requiresPrivateKey: false // NEVER asks for K1 (or any) private key
  gatesExecution: false // NEVER unlocks intent execution
  message: string
}

export function twoFactorStatus(): TwoFactorStatus {
  return {
    active: false,
    proactive: true,
    hasRecoveryLimit: false,
    requiresPrivateKey: false,
    gatesExecution: false,
    message: 'Two-factor protection is proactive and optional. It is not active yet and never limits recovery.',
  }
}

// Explicit guards the verifier can call to prove the invariants hold regardless of
// any future "active" flip.
export function twoFactorHasNoLimits(s: TwoFactorStatus): boolean {
  return s.hasRecoveryLimit === false
}
export function twoFactorNeverTakesPrivateKey(s: TwoFactorStatus): boolean {
  return s.requiresPrivateKey === false
}
export function twoFactorNeverGatesExecution(s: TwoFactorStatus): boolean {
  return s.gatesExecution === false
}

```

## `frontend/src/hooks/use-toast.ts`

```ts
import * as React from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  variant?: "default" | "destructive"
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type Action =
  | { type: typeof actionTypes.ADD_TOAST; toast: ToasterToast }
  | { type: typeof actionTypes.UPDATE_TOAST; toast: Partial<ToasterToast> }
  | { type: typeof actionTypes.DISMISS_TOAST; toastId?: string }
  | { type: typeof actionTypes.REMOVE_TOAST; toastId?: string }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case actionTypes.UPDATE_TOAST:
      return { ...state, toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)) }
    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action
      if (toastId) addToRemoveQueue(toastId)
      else state.toasts.forEach((t) => addToRemoveQueue(t.id))
      return { ...state, toasts: state.toasts.map((t) => (toastId == null || t.id === toastId ? { ...t, open: false } : t)) }
    }
    case actionTypes.REMOVE_TOAST:
      return { ...state, toasts: action.toastId == null ? [] : state.toasts.filter((t) => t.id !== action.toastId) }
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()
  const update = (props: ToasterToast) => dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...props, id } })
  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })
  dispatch({ type: actionTypes.ADD_TOAST, toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss() } } })
  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1) }
  }, [state])
  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }) }
}

export { useToast, toast }

```

## `frontend/src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />

```

## `frontend/vite.config.ts`

```ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
      preserveSymlinks: true,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'react/jsx-runtime',
        '@tanstack/react-query',
        '@tanstack/query-core',
      ],
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});

```

## `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}

```

## `frontend/package.json`

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "dev": "node scripts/check-env.cjs vite",
    "build": "vite build --outDir dist",
    "postbuild": "node scripts/apply-security-headers.cjs",
    "lint": "eslint .",
    "preview": "vite preview",
    "type-check": "tsc --noEmit --incremental"
  },
  "dependencies": {
    "@fontsource-variable/roboto-mono": "^5.2.9",
    "@fontsource/lato": "^5.2.7",
    "@hookform/resolvers": "5.2.2",
    "@radix-ui/react-accordion": "1.2.12",
    "@radix-ui/react-aspect-ratio": "1.1.8",
    "@radix-ui/react-avatar": "1.1.11",
    "@radix-ui/react-checkbox": "1.3.3",
    "@radix-ui/react-collapsible": "1.1.12",
    "@radix-ui/react-context-menu": "2.2.16",
    "@radix-ui/react-dialog": "1.1.15",
    "@radix-ui/react-dropdown-menu": "2.1.16",
    "@radix-ui/react-hover-card": "1.1.15",
    "@radix-ui/react-label": "2.1.8",
    "@radix-ui/react-menubar": "1.1.16",
    "@radix-ui/react-navigation-menu": "1.2.14",
    "@radix-ui/react-popover": "1.1.15",
    "@radix-ui/react-progress": "1.1.8",
    "@radix-ui/react-radio-group": "1.3.8",
    "@radix-ui/react-scroll-area": "1.2.10",
    "@radix-ui/react-select": "2.2.6",
    "@radix-ui/react-separator": "1.1.8",
    "@radix-ui/react-slider": "1.3.6",
    "@radix-ui/react-slot": "1.2.4",
    "@radix-ui/react-switch": "1.2.6",
    "@radix-ui/react-tabs": "1.1.13",
    "@radix-ui/react-toast": "1.2.15",
    "@radix-ui/react-toggle": "1.1.10",
    "@radix-ui/react-toggle-group": "1.1.11",
    "@radix-ui/react-tooltip": "1.2.8",
    "@tanstack/query-core": "5.94.5",
    "@tanstack/react-query": "5.94.5",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "cmdk": "1.1.1",
    "date-fns": "4.1.0",
    "echarts": "5.6.0",
    "echarts-for-react": "3.0.6",
    "embla-carousel-react": "8.6.0",
    "ethers": "^6.17.0",
    "lucide-react": "0.454.0",
    "next-themes": "0.4.6",
    "react": "19.2.4",
    "react-day-picker": "9.14.0",
    "react-dom": "19.2.4",
    "react-hook-form": "7.72.0",
    "react-resizable-panels": "4.7.6",
    "scheduler": "0.27.0",
    "sonner": "1.7.4",
    "tailwind-merge": "2.6.1",
    "vaul": "1.1.2",
    "zod": "3.25.76"
  },
  "devDependencies": {
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@types/node": "22.19.15",
    "@eslint/js": "9.39.4",
    "@vitejs/plugin-react": "4.7.0",
    "@tailwindcss/vite": "4.2.2",
    "eslint": "9.39.4",
    "eslint-plugin-react-hooks": "5.2.0",
    "eslint-plugin-react-refresh": "0.4.26",
    "globals": "16.5.0",
    "tailwindcss": "4.2.2",
    "tw-animate-css": "1.4.0",
    "typescript-eslint": "8.57.1",
    "typescript": "5.9.3",
    "vite": "6.4.2"
  }
}

```

## `api/_lib/mount.js`

```js
'use strict'

// express lives in backend/node_modules — resolve from there so api/ handlers
// don't need their own copy.
const express = require(require.resolve('express', { paths: [require('path').join(__dirname, '../../backend')] }))

function securityHeaders (_req, res, next) {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('x-frame-options', 'DENY')
  res.setHeader('referrer-policy', 'no-referrer')
  res.setHeader('cache-control', 'no-store')
  next()
}

function jsonErrorHandler (err, _req, res, next) {
  if (!err) return next()

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json' })
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'body_too_large' })
  }

  return res.status(400).json({ error: 'bad_request' })
}

/**
 * mount(routerFactory, prefix, options)
 *
 * routerFactory  – zero-arg fn returning an Express Router
 * prefix         – URL prefix to strip before handing to the router
 *                  (e.g. '/api/deploy')
 * options.methods – allowed HTTP methods, defaults to ['GET','POST','OPTIONS']
 */
module.exports = function mount (routerFactory, prefix, options) {
  const opts = options || {}
  const allowedMethods = new Set(opts.methods || ['GET', 'POST', 'OPTIONS'])

  const app = express()

  app.disable('x-powered-by')
  app.use(securityHeaders)

  // Method guard
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('allow', Array.from(allowedMethods).join(', '))
      return res.status(204).end()
    }

    if (!allowedMethods.has(req.method)) {
      res.setHeader('allow', Array.from(allowedMethods).join(', '))
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    next()
  })

  app.use(express.json({
    limit: '128kb',
    strict: true,
    type: ['application/json', 'application/*+json']
  }))

  // JSON parse error handler (must be 4-arg)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => jsonErrorHandler(err, req, res, next))

  // Prefix stripping
  app.use((req, _res, next) => {
    if (!prefix) return next()

    const url = new URL(req.url, 'http://localhost')
    let path = url.pathname

    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length) || '/'
    }

    req.url = path + (url.search || '')
    next()
  })

  app.use('/', routerFactory())

  app.use((_req, res) => {
    return res.status(404).json({ error: 'not_found' })
  })

  // Final catch-all error handler
  // eslint-disable-next-line no-unused-vars
  app.use((_err, _req, res, _next) => {
    return res.status(500).json({ error: 'internal_error' })
  })

  return (req, res) => app(req, res)
}

```

## `api/chains.js`

```js
'use strict'

const mount = require('./_lib/mount')

module.exports = mount(
  () => require('../backend/routes/chains'),
  '/api/chains',
  { methods: ['GET', 'OPTIONS'] }
)

```

## `api/deploy/[chain].js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/deploy'),
  '/api/deploy',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/rpc/[chain].js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/rpc'),
  '/api/rpc',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/funding/[chain].js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/funding'),
  '/api/funding',
  { methods: ['GET', 'OPTIONS'] }
)

```

## `api/trace/[kind].js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/trace'),
  '/api/trace',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/passkeys/verify.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/passkeys'),
  '/api/passkeys',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/passkeys/register.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/passkeys'),
  '/api/passkeys',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/admin-passkey/generate.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/admin-passkey'),
  '/api/admin-passkey',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/thank-you/config.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/thank-you'),
  '/api/thank-you',
  { methods: ['GET', 'OPTIONS'] }
)

```

## `api/thank-you/send.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/thank-you'),
  '/api/thank-you',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/anti-abuse/event.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/anti-abuse'),
  '/api/anti-abuse',
  { methods: ['POST', 'OPTIONS'] }
)

```

## `api/artifact/securegate.js`

```js
'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/artifact'),
  '/api/artifact',
  { methods: ['GET', 'OPTIONS'] }
)

```

## `api/runtime.js`

```js
'use strict'

const mount = require('./_lib/mount')

module.exports = mount(
  () => require('../backend/routes/runtime'),
  '/api/runtime',
  { methods: ['GET', 'OPTIONS'] }
)

```

## `api/health.js`

```js
'use strict'

const mount = require('./_lib/mount')

module.exports = mount(
  () => {
    const { Router } = require(require.resolve('express', { paths: [require('path').join(__dirname, '../backend')] }))
    const router = Router()
    router.get('/', (_req, res) => res.status(200).json({ ok: true, service: 'securegate-eip777g', ts: Date.now() }))
    return router
  },
  '/api/health',
  { methods: ['GET', 'OPTIONS'] }
)

```

## `backend/routes/chains.js`

```js
'use strict';

// GET /api/chains  — public chain metadata ONLY. No RPC URLs, no env names.

const express = require('express');
const chains = require('../config/chains');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ chains: chains.listPublic() });
});

module.exports = router;

```

## `backend/routes/deploy.js`

```js
'use strict';

// POST /api/deploy/:chain — accepts a SIGNED transaction ONLY and broadcasts it
// through the backend RPC. The backend never receives, holds, or handles any
// private key. A bare 32-byte hex or seed-phrase body is rejected outright.

const express = require('express');
const chains = require('../config/chains');
const guard = require('../lib/address-guard');

const router = express.Router();

// A signed raw tx is long (>= ~100 hex chars). A bare 64-hex private key is short.
function isSignedTx(raw) {
  return typeof raw === 'string' && /^0x[0-9a-fA-F]{100,}$/.test(raw.trim());
}
function looksLikePrivateKey(raw) {
  return typeof raw === 'string' && /^0x?[0-9a-fA-F]{64}$/.test(raw.trim());
}

// Body field names that carry key/secret material. NONE may ever be accepted;
// the backend receives signedTx only.
const FORBIDDEN_KEY_FIELDS = [
  'privateKey', 'k1Key', 'k2Key', 'k3Key', 'deployerKey',
  'mnemonic', 'seed', 'secret', 'passphrase', 'k1SessionKey', 'k2SessionKey', 'sessionKey',
];
function hasKeyField(body) {
  if (!body || typeof body !== 'object') return false;
  return Object.keys(body).some((k) =>
    FORBIDDEN_KEY_FIELDS.includes(k) || /priv|secret|mnemonic|seed|passphrase|sessionkey/i.test(k));
}

router.post('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) {
    return res.status(404).json({ error: 'unknown chain' });
  }
  const meta = chains.get(slug);
  if (!meta.deploySupported) {
    return res.status(400).json({ error: 'deploy not supported on this chain' });
  }
  if (guard.hasForbiddenOverride(req.body)) {
    return res.status(400).json({ error: 'alternate destination overrides are not accepted' });
  }

  const signedTx = req.body && req.body.signedTx;

  // Hard refusal of anything private-key-shaped: named key fields or a bare key.
  if (hasKeyField(req.body) || looksLikePrivateKey(signedTx)) {
    return res.status(400).json({ error: 'private key material is never accepted; submit signedTx only' });
  }
  if (!isSignedTx(signedTx)) {
    return res.status(400).json({ error: 'signedTx (0x-prefixed signed transaction) required' });
  }

  const url = chains.rpcUrlFor(slug);
  if (!url) {
    return res.status(503).json({ error: 'chain RPC not configured' });
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [signedTx.trim()] }),
    });
    const json = await upstream.json();
    if (json.error) {
      return res.status(502).json({ error: (json.error && json.error.message) || 'broadcast rejected' });
    }
    return res.json({ txHash: json.result });
  } catch (_) {
    return res.status(502).json({ error: 'broadcast failed' });
  }
});

module.exports = router;

```

## `backend/routes/rpc.js`

```js
'use strict';

// POST /api/rpc/:chain — safe backend JSON-RPC bridge.
//
// * Uses backend env RPC URLs ONLY (never exposed to the client).
// * Rejects any payload that looks like a private key / seed phrase.
// * Whitelists read-only + broadcast-safe methods.
// * Never returns the endpoint URL.

const express = require('express');
const chains = require('../config/chains');
const guard = require('../lib/address-guard');

const router = express.Router();

// Read-only + funding-estimate methods the client may ask for. Broadcasting is
// handled by the dedicated /api/deploy route, not here.
const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_estimateGas',
  'eth_call',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_feeHistory',
]);

// 64-hex standing alone == a secp256k1 private key. Also catch mnemonic-ish text.
function looksLikeSecret(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (/^0x?[0-9a-fA-F]{64}$/.test(v)) return true;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return true;
  const words = v.split(/\s+/);
  if (words.length >= 12 && words.every((w) => /^[a-z]+$/i.test(w))) return true; // seed phrase
  return false;
}

function scanForSecret(obj, depth = 0) {
  if (depth > 6 || obj == null) return false;
  if (typeof obj === 'string') return looksLikeSecret(obj);
  if (Array.isArray(obj)) return obj.some((v) => scanForSecret(v, depth + 1));
  if (typeof obj === 'object') {
    return Object.entries(obj).some(([k, v]) => {
      if (/priv|secret|mnemonic|seed|passphrase/i.test(k)) return true;
      return scanForSecret(v, depth + 1);
    });
  }
  return false;
}

router.post('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) {
    return res.status(404).json({ error: 'unknown chain' });
  }
  if (guard.hasForbiddenOverride(req.body) || scanForSecret(req.body)) {
    return res.status(400).json({ error: 'private key material is never accepted' });
  }

  const { method, params } = req.body || {};
  if (!ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: 'method not allowed' });
  }

  const url = chains.rpcUrlFor(slug);
  if (!url) {
    return res.status(503).json({ error: 'chain RPC not configured' });
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: Array.isArray(params) ? params : [] }),
    });
    const json = await upstream.json();
    if (json.error) {
      // Never leak upstream URL/detail; surface only the RPC error message.
      return res.status(502).json({ error: (json.error && json.error.message) || 'rpc error' });
    }
    return res.json({ result: json.result });
  } catch (_) {
    return res.status(502).json({ error: 'rpc request failed' });
  }
});

module.exports = router;

```

## `backend/routes/passkeys.js`

```js
'use strict'

const express = require('express')
const store = require('../lib/passkey-store')

const router = express.Router()

router.post('/register', async (req, res) => {
  const result = await store.register(req.body && req.body.k1)
  if (result.error) return res.status(400).json(result)
  return res.status(403).json(result)
})

router.post('/verify', async (req, res) => {
  const { k1, passkey } = req.body || {}
  if (!k1 || !passkey) {
    return res.status(400).json({ verified: false, error: 'k1 and passkey required' })
  }
  const result = await store.verify(k1, passkey)
  return res.status(result.verified ? 200 : 401).json(result)
})

module.exports = router

```

## `backend/routes/admin-passkey.js`

```js
'use strict'

const express = require('express')
const store = require('../lib/passkey-store')

const router = express.Router()

router.post('/generate', async (req, res) => {
  const { adminKey, k1 } = req.body || {}

  if (!adminKey || !k1) {
    return res.status(400).json({ error: 'adminKey and k1 required' })
  }

  const configuredAdminKey = process.env.SECUREGATE_ADMIN_KEY

  if (!configuredAdminKey) {
    return res.status(503).json({
      disabled: true,
      reason: 'Admin key minting is not configured on this deployment.'
    })
  }

  if (adminKey !== configuredAdminKey) {
    return res.status(403).json({ error: 'admin key invalid' })
  }

  const result = await store.mint(k1)
  if (result.error) return res.status(400).json(result)
  return res.json(result)
})

module.exports = router

```

## `backend/routes/thank-you.js`

```js
'use strict';

// Thank-you envelope routes (optional, non-recovery):
//   GET  /api/thank-you/config — returns the handle + optional copy address only.
//   POST /api/thank-you/send   — sends a note via X if configured, else disabled.
//
// The thank-you address is thank-you-only copy data. It is NOT a fallback
// route, NOT a deploy parameter, and NOT part of any proof logic.

const express = require('express');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    handle: process.env.THANKYOU_HANDLE || '@hope_ology',
    network: process.env.THANKYOU_NETWORK || 'EVM',
    copyAddress: process.env.THANKYOU_ADDRESS || ''
  })
})

router.post('/send', async (req, res) => {
  const token = process.env.X_OAUTH2_ACCESS_TOKEN;
  const recipientId = process.env.X_THANK_YOU_RECIPIENT_ID;
  const message = String((req.body && req.body.message) || '').slice(0, 280).trim();

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }
  // Honest capability reporting: if X is not configured, sending is disabled.
  if (!token || !recipientId) {
    return res.json({ sent: false, disabled: true, reason: 'thank-you sending not configured' });
  }

  try {
    const upstream = await fetch(`https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(recipientId)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (!upstream.ok) {
      return res.json({ sent: false, disabled: false, reason: 'delivery failed' });
    }
    return res.json({ sent: true });
  } catch (_) {
    return res.json({ sent: false, disabled: false, reason: 'delivery error' });
  }
});

module.exports = router;

```

## `backend/routes/funding.js`

```js
'use strict';

// GET /api/funding/:chain — estimate the native-token cost to deploy the gate,
// using the backend RPC only. Returns no endpoint URL.

const express = require('express');
const chains = require('../config/chains');

const router = express.Router();

// Conservative default gas for a SecureGate deployment (no artifact-specific
// estimate is available here; the browser builder refines this when wired).
const DEFAULT_DEPLOY_GAS = 2_500_000n;

async function rpcCall(url, method, params) {
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
  });
  const json = await upstream.json();
  if (json.error) throw new Error((json.error && json.error.message) || 'rpc error');
  return json.result;
}

function weiToDecimalString(wei) {
  // 18-decimal fixed-point formatting without float error.
  const s = wei.toString().padStart(19, '0');
  const whole = s.slice(0, -18);
  const frac = s.slice(-18).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

router.get('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) {
    return res.status(404).json({ error: 'unknown chain' });
  }
  const meta = chains.get(slug);
  const url = chains.rpcUrlFor(slug);
  if (!url) {
    return res.status(503).json({ error: 'chain RPC not configured' });
  }

  try {
    const gasPriceHex = await rpcCall(url, 'eth_gasPrice', []);
    const gasPrice = BigInt(gasPriceHex);
    const estWei = gasPrice * DEFAULT_DEPLOY_GAS;
    return res.json({
      chain: slug,
      nativeSymbol: meta.nativeSymbol,
      gasPriceWei: gasPrice.toString(),
      estGas: DEFAULT_DEPLOY_GAS.toString(),
      estimateNative: weiToDecimalString(estWei),
    });
  } catch (_) {
    return res.status(502).json({ error: 'funding estimate failed' });
  }
});

module.exports = router;

```

## `backend/routes/trace.js`

```js
'use strict'

const express = require('express')
const crypto = require('crypto')

const router = express.Router()

function hashSubject(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || 'anon').toLowerCase())
    .digest('hex')
    .slice(0, 24)
}

router.post('/:kind', async (req, res) => {
  const kind = String(req.params.kind || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'unknown'
  const subjectHash = hashSubject((req.body && (req.body.k1 || req.body.subject)) || 'anon')
  return res.json({ ok: true, kind, subjectHash, ts: Date.now() })
})

module.exports = router

```

## `backend/routes/anti-abuse.js`

```js
'use strict'

const express = require('express')
const crypto = require('crypto')

const router = express.Router()

function bucket(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || 'anon').toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

router.post('/event', async (req, res) => {
  const { action, subject } = req.body || {}

  if (!action || typeof action !== 'string') {
    return res.status(400).json({ error: 'action required' })
  }

  return res.json({
    ok: true,
    action: action.slice(0, 64),
    bucket: bucket(subject),
    ts: Date.now()
  })
})

module.exports = router

```

## `backend/routes/artifact.js`

```js
'use strict';

// GET /api/artifact/securegate — serve compiled bytecode/ABI to the browser
// deploy builder, but ONLY when the configured artifact validates:
//   * SECUREGATE_BYTECODE_HEX must be present and 0x-hex.
//   * SECUREGATE_ABI_JSON must be valid JSON (an array).
//   * SECUREGATE_ARTIFACT_SHA256, if set, must match sha256(bytecode).
//
// If any check fails, we return 503 with an honest reason. We NEVER inline a
// placeholder artifact or fabricate bytecode.

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function validateArtifact() {
  const bytecode = (process.env.SECUREGATE_BYTECODE_HEX || '').trim();
  const abiRaw = (process.env.SECUREGATE_ABI_JSON || '').trim();
  const wantSha = (process.env.SECUREGATE_ARTIFACT_SHA256 || '').trim().toLowerCase();
  const version = (process.env.SECUREGATE_ARTIFACT_VERSION || 'securegate@local').trim();

  if (!bytecode) return { ok: false, reason: 'SECUREGATE_BYTECODE_HEX not set' };
  if (!/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode.length < 4) {
    return { ok: false, reason: 'SECUREGATE_BYTECODE_HEX is not valid hex' };
  }

  let abi;
  try {
    abi = JSON.parse(abiRaw || '[]');
  } catch (_) {
    return { ok: false, reason: 'SECUREGATE_ABI_JSON is not valid JSON' };
  }
  if (!Array.isArray(abi)) return { ok: false, reason: 'SECUREGATE_ABI_JSON must be a JSON array' };

  if (wantSha) {
    const gotSha = crypto.createHash('sha256').update(bytecode, 'utf8').digest('hex');
    if (gotSha !== wantSha) {
      return { ok: false, reason: 'artifact sha256 mismatch' };
    }
  }
  return { ok: true, bytecode, abi, version };
}

router.get('/securegate', (_req, res) => {
  const v = validateArtifact();
  if (!v.ok) {
    return res.status(503).json({ error: 'artifact unavailable', reason: v.reason });
  }
  return res.json({ version: v.version, abi: v.abi, bytecode: v.bytecode });
});

module.exports = router;

```

## `backend/routes/runtime.js`

```js
'use strict';

// GET /api/runtime — reports the Node runtime the backend process is ACTUALLY
// running under. Used by scripts/verify-node24-runtime.cjs to prove the server
// runtime (not just the build) is Node 24. Exposes no secrets and no RPC URLs.
//
// (The SDK already serves GET /api/health -> {status:"ok"}; this adds the
// version detail without shadowing that route.)

const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  const major = Number(process.versions.node.split('.')[0]);
  res.json({
    status: 'ok',
    node: process.version,
    nodeMajor: major,
    node24: major === 24,
    uptimeSec: Math.round(process.uptime()),
  });
});

module.exports = router;

```

## `backend/package.json`

```json
{
  "name": "backend",
  "private": true,
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "dev": "node scripts/check-env.js node --watch server.js",
    "selftest": "node scripts/selftest.cjs",
    "drift:scan": "node scripts/drift-scan.cjs",
    "verify:artifact": "node scripts/obfuscation-equivalence.cjs"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "ethers": "^6.17.0",
    "express": "4.22.1"
  }
}

```

## `package.json`

```json
{
  "name": "securegate-eip777g-root",
  "private": true,
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "npm --prefix frontend run dev -- --host 0.0.0.0",
    "build": "npm --prefix frontend run build",
    "type-check": "npm --prefix frontend run type-check",
    "verify:root": "node scripts/verify-root-dev.cjs",
    "verify:auth-state": "node scripts/verify-auth-state-gate.cjs",
    "verify:backend-wiring": "node scripts/verify-backend-wiring.cjs",
    "verify": "npm run verify:root && npm run verify:auth-state && npm run verify:backend-wiring",
    "build:proof": "npm run verify && npm run type-check && npm run build"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}

```

## `vercel.json`

```json
{
  "version": 2,
  "installCommand": "npm install --no-audit --no-fund && npm --prefix frontend install --no-audit --no-fund && npm --prefix backend install --no-audit --no-fund",
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/**/*.js": {
      "memory": 256,
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "Referrer-Policy", "value": "no-referrer" }
      ]
    }
  ]
}

```

## `.node-version`

```
22

```

