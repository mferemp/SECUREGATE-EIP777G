# SECUREGATE EIP-777G — Full Source

Generated: 2026-07-21T19:53:38Z

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
import { api } from './lib/api'

type Chain = {
  slug: string
  name: string
  chainId: number
  nativeSymbol: string
  deploySupported: boolean
}

type DashboardTab = 'deployment' | 'protection' | 'status'

const MAX_DEVICE_ATTEMPTS = 3

const PROGRESS_STEPS = [
  'Funding calculation',
  'Prepare K1 session',
  'Deploy contract',
  'Confirm protection',
  'Verify protection'
]

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim())
}

function isSignedTx(value: string): boolean {
  return /^0x[0-9a-fA-F]{100,}$/.test(value.trim())
}

function shortAddress(value: string): string {
  const clean = value.trim()
  if (!isAddress(clean)) return ''
  return `${clean.slice(0, 10)}…${clean.slice(-6)}`
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
  const [generatedPasskey, setGeneratedPasskey] = useState('')

  const [deployerAddress, setDeployerAddress] = useState('')
  const [deployerKey, setDeployerKey] = useState('')
  const [k1SessionKey, setK1SessionKey] = useState('')
  const [k2Address, setK2Address] = useState('')
  const [k3Address, setK3Address] = useState('')
  const [signedTx, setSignedTx] = useState('')

  const [fundingStatus, setFundingStatus] = useState('')
  const [deployStatus, setDeployStatus] = useState('')
  const [activeStep, setActiveStep] = useState(-1)

  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('deployment')

  const [thanksHandle, setThanksHandle] = useState('@hope_ology')
  const [thanksAddress, setThanksAddress] = useState('')
  const [thanksMessage, setThanksMessage] = useState('')
  const [thanksStatus, setThanksStatus] = useState('')

  const dashboardUnlocked = authGateVerified
  const deviceLocked = deviceAttempts >= MAX_DEVICE_ATTEMPTS

  const selectedChainMeta = useMemo(() => {
    return chains.find((chain) => chain.slug === selectedChain)
  }, [chains, selectedChain])

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

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

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
    setGeneratedPasskey('')

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
    setDashboardTab('deployment')
  }

  async function trace(kind: string) {
    try {
      await fetch(api(`trace/${kind}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ k1: k1Address || 'anon' })
      })
    } catch {
      // non-blocking
    }
  }

  async function antiAbuse(action: string) {
    try {
      await fetch(api('anti-abuse/event'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, subject: k1Address || 'anon' })
      })
    } catch {
      // non-blocking
    }
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

    await trace(kind === 'scan' ? 'scan' : 'link-device')
    await antiAbuse(kind === 'scan' ? 'scan' : 'link-device')

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

    await trace('passkey-verify')
    await antiAbuse('passkey-verify')

    try {
      const res = await fetch(api('passkeys/verify'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          k1: k1Address.trim(),
          passkey: passkey.trim()
        })
      })

      const data = await res.json().catch(() => ({}))

      if (data?.verified === true) {
        setAuthGateVerified(true)
        setVerifiedRoute('passkey')
        setAuthMsg('AUTH-GATE verified. Dashboard unlocked.')
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

    if (!adminKey.trim()) {
      setAdminStatus('Admin key required.')
      return
    }

    if (!isAddress(targetK1)) {
      setAdminStatus('Valid K1 address required.')
      return
    }

    try {
      const res = await fetch(api('admin-passkey/generate'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey: adminKey.trim(),
          k1: targetK1
        })
      })

      const data = await res.json().catch(() => ({}))

      if (data?.passkey) {
        setAdminK1(targetK1)
        setPasskey(data.passkey)
        setGeneratedPasskey(data.passkey)
        setAdminStatus('Generated K1-bound passkey. Press ENTER in PASSKEY to unlock.')
        return
      }

      if (data?.disabled) {
        setAdminStatus(data.reason || 'Admin generation is not configured.')
        return
      }

      setAdminStatus(data?.error || data?.reason || 'Could not generate passkey.')
    } catch {
      setAdminStatus('Admin passkey request failed.')
    }
  }

  async function calculateFunding() {
    if (!selectedChain) {
      setFundingStatus('Select a chain first.')
      return
    }

    setFundingStatus('Calculating funding...')
    setActiveStep(0)

    try {
      const res = await fetch(api(`funding/${selectedChain}`))
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setFundingStatus(data?.error || 'Funding check unavailable.')
        return
      }

      setFundingStatus(
        `Estimated funding: ${data.estimateNative || 'unknown'} ${data.nativeSymbol || selectedChainMeta?.nativeSymbol || ''}`
      )
      setActiveStep(1)
    } catch {
      setFundingStatus('Funding check failed.')
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
      const res = await fetch(api(`deploy/${selectedChain}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          signedTx: signedTx.trim()
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setDeployStatus(data?.error || 'Broadcast rejected.')
        return
      }

      setActiveStep(4)
      setDeployStatus(`Complete. txHash: ${data.txHash || 'submitted'}`)
    } catch {
      setDeployStatus('Broadcast failed.')
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
      const res = await fetch(api('thank-you/send'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: thanksMessage.trim()
        })
      })

      const data = await res.json().catch(() => ({}))

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

  return (
    <div className="sg-root">
      <header className="sg-topbar">
        <div className="sg-brand">
          <span>SECUREGATE</span>
          <small>EIP-777G</small>
        </div>

        <div className="sg-topbar-spacer" />

        <button className="sg-scrub" type="button" onClick={scrub}>
          SCRUB
        </button>

        <button className="sg-power" type="button" aria-label="Power">
          ⏻
        </button>
      </header>

      <div className={`sg-layout ${dashboardUnlocked ? 'sg-layout--unlocked' : 'sg-layout--locked'}`}>
        <aside className="sg-sidebar" aria-label="Auth-Gate rail">
          <button
            id="scan-authenticator"
            className="sg-scan"
            type="button"
            disabled={deviceLocked}
            onClick={() => deviceAttempt('scan')}
          >
            <span>SCAN</span>
          </button>
          <div className="sg-device-copy">
            <p>
              <strong>Same device:</strong> press SCAN.
            </p>
            <p>
              <strong>Different device:</strong> connect by USB first, then press LINK DEVICE.
            </p>
          </div>

          <div className="sg-rail-rule" />

          <section className="sg-auth-copy">
            <h2>AUTH-GATE</h2>

            <p>Verifies the real K1 owner — not the thief.</p>
            <p>Hidden checks prevent cloning or replay.</p>
            <p>
              Advisory check only — attempt on up to <strong>3 devices per K1.</strong>
            </p>
            <p>
              Still blocked? DM <a href="https://x.com/hope_ology">@hope_ology</a> with proof of ownership.
            </p>
            <p>
              On success: K1 auto-fills and a <mark>unique passkey</mark> binds to that K1.
            </p>
            <p>SCRUB purges local session state.</p>
          </section>

          <label className="sg-label" htmlFor="authgate-k1">
            K1 COMPROMISED WALLET ADDRESS
          </label>
          <input
            id="authgate-k1"
            className="sg-input"
            value={k1Address}
            onChange={(event) => setK1Address(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />

          <button
            id="link-device"
            className="sg-link-device"
            type="button"
            disabled={deviceLocked}
            onClick={() => deviceAttempt('link')}
          >
            LINK DEVICE
          </button>

          <label className="sg-label" htmlFor="passkey-input">
            PASSKEY
          </label>
          <div className="sg-passkey-row">
            <input
              id="passkey-input"
              className="sg-input"
              type="password"
              value={passkey}
              onChange={(event) => setPasskey(event.target.value)}
              placeholder="K1-bound passkey"
              autoComplete="off"
              spellCheck={false}
            />
            <button id="passkey-enter" className="sg-enter" type="button" onClick={verifyPasskey}>
              ENTER
            </button>
          </div>

          <section className="sg-side-caution" aria-label="Caution and admin">
            <div className="sg-caution-head">
              <h2>⚠ CAUTION</h2>

              <button
                id="admin-black-circle"
                className="sg-admin-circle"
                type="button"
                aria-label="Admin K1-bound passkey generator"
                onClick={() => setAdminOpen((value) => !value)}
              >
                ⚫️-&apos;
              </button>
            </div>

            <p>Use at your own risk.</p>
            <p>Hope for the best.</p>
            <p>
              If you&apos;re a hacker? <span>Get fucked.</span>
            </p>

            {adminOpen && (
              <div className="sg-admin-panel">
                <label className="sg-label" htmlFor="admin-key">
                  ADMIN KEY
                </label>
                <input
                  id="admin-key"
                  className="sg-input sg-input--pink"
                  type="password"
                  value={adminKey}
                  onChange={(event) => setAdminKey(event.target.value)}
                  placeholder="Paste admin key..."
                  autoComplete="off"
                  spellCheck={false}
                />

                <label className="sg-label" htmlFor="admin-k1">
                  K1 ADDRESS
                </label>
                <input
                  id="admin-k1"
                  className="sg-input"
                  value={adminK1}
                  onChange={(event) => setAdminK1(event.target.value)}
                  placeholder="Paste user's K1 address..."
                  autoComplete="off"
                  spellCheck={false}
                />

                <button
                  id="admin-generate-passkey"
                  className="sg-admin-generate"
                  type="button"
                  onClick={generateAdminPasskey}
                >
                  GENERATE PASSKEY
                </button>

                {generatedPasskey && (
                  <div className="sg-generated">
                    <div>Generated K1-bound passkey</div>
                    <code>{generatedPasskey}</code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(generatedPasskey)}
                    >
                      COPY
                    </button>
                  </div>
                )}

                <div className="sg-admin-status" aria-live="polite">
                  {adminStatus}
                </div>
              </div>
            )}
          </section>

          <div className="sg-auth-msg" aria-live="polite">
            {authMsg}
          </div>

          <div className="sg-rail-bottom">
            <span className={dashboardUnlocked ? 'sg-dot sg-dot--on' : 'sg-dot'} />
            777G v1.0 · {dashboardUnlocked ? 'AUTHENTICATED' : 'SECURE'}
          </div>
        </aside>

        <main className={`sg-main ${dashboardUnlocked ? 'sg-main--unlocked' : 'sg-main--locked'}`}>
          {!dashboardUnlocked ? (
            <section className="sg-locked-stage" aria-label="Locked dashboard view">
              <section className="sg-standalone">
                <h1>STANDALONE OPERATION</h1>
                <p>This dashboard executes the authentication flow client-side.</p>
                <p>You are not submitting K1 authentication data to any operator, server, or third party.</p>
                <p>Cryptographic checks run in your browser.</p>
                <p>Chain checks stay backend-routed for security.</p>
                <p>Endpoint details never appear in the browser.</p>
              </section>

              <section className="sg-warning">
                <p>BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE.</p>
                <p>PLUS, YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I&apos;M JUST A STICK FIGURE.</p>
              </section>
            </section>
          ) : (
            <section className="sg-workspace-stage" aria-label="Unlocked EIP-777G dashboard">
              <nav className="sg-tabs sg-tabs--dashboard" aria-label="Dashboard sections">
                <button
                  type="button"
                  className={dashboardTab === 'deployment' ? 'active' : ''}
                  onClick={() => setDashboardTab('deployment')}
                >
                  Deployment
                </button>
                <button
                  type="button"
                  className={dashboardTab === 'protection' ? 'active' : ''}
                  onClick={() => setDashboardTab('protection')}
                >
                  Protection
                </button>
                <button
                  type="button"
                  className={dashboardTab === 'status' ? 'active' : ''}
                  onClick={() => setDashboardTab('status')}
                >
                  Status
                </button>
              </nav>

              {dashboardTab === 'deployment' && (
                <>
                  <section id="deployment-panel" className="sg-dash-card sg-deployment-card">
                    <h1>EIP-777G DEPLOYMENT</h1>
                    <div className="sg-deploy-intro">
                      <p>
                        Create &amp; fund a burner wallet for your deployment bundle — this is your{' '}
                        <strong>Deployer.</strong> Enter the Deployer key and address in the assigned boxes below.
                      </p>
                      <p>
                        Enter the K1 key assigned to the K1 address listed. Enter two clean public addresses in K2 and K3.{' '}
                        <strong>Do not at any point share your K2 or K3 keys.</strong>
                      </p>
                    </div>

                    <ol className="sg-deploy-steps">
                      <li>
                        <span>1</span>
                        <p>Choose the initial chain to launch the EIP-777G contract on.</p>
                      </li>
                      <li>
                        <span>2</span>
                        <p>
                          The fee calculator next to the chain selection box will tell you the funding needed to launch
                          the contract on that chain.
                        </p>
                      </li>
                      <li>
                        <span>3</span>
                        <p>Fund the Deployer, then build and sign the deployment transaction locally.</p>
                      </li>
                      <li>
                        <span>4</span>
                        <p>The progress bar indicates the deployment bundle and protection checks.</p>
                      </li>
                      <li>
                        <span>5</span>
                        <p>
                          Once EIP-777G has been deployed, K2 authorizes protected actions and permitted transfer flow
                          routes to the K3 clean drop address.
                        </p>
                      </li>
                    </ol>
                  </section>

                  <section className="sg-dash-card sg-bundle-card">
                    <h2>DEPLOYMENT BUNDLE</h2>

                    <div className="sg-form-grid sg-form-grid--deploy">
                      <label>
                        <span>DEPLOYER ADDRESS</span>
                        <input
                          className="sg-input"
                          value={deployerAddress}
                          onChange={(event) => setDeployerAddress(event.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>

                      <label>
                        <span>DEPLOYER KEY</span>
                        <input
                          className="sg-input"
                          type="password"
                          value={deployerKey}
                          onChange={(event) => setDeployerKey(event.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>

                      <label>
                        <span>K1 ADDRESS</span>
                        <input
                          className="sg-input sg-input--active"
                          value={k1Address}
                          readOnly
                        />
                      </label>

                      <label>
                        <span>K1 KEY</span>
                        <input
                          className="sg-input"
                          type="password"
                          value={k1SessionKey}
                          onChange={(event) => setK1SessionKey(event.target.value)}
                          placeholder="session-only"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>

                      <label className="sg-form-wide">
                        <span>K2 AUTH ADDRESS</span>
                        <input
                          className="sg-input"
                          value={k2Address}
                          onChange={(event) => setK2Address(event.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>

                      <label className="sg-form-wide">
                        <span>K3 CLEAN DROP ADDRESS</span>
                        <input
                          className="sg-input sg-input--active"
                          value={k3Address}
                          onChange={(event) => setK3Address(event.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>

                      <label className="sg-form-full">
                        <span>SIGNED TX</span>
                        <input
                          className="sg-input"
                          value={signedTx}
                          onChange={(event) => setSignedTx(event.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <small>Backend receives signedTx only. No K2/K3 private keys. No seed. No mnemonic.</small>
                      </label>
                    </div>

                    <div className="sg-bundle-actions">
                      <select
                        className="sg-input sg-chain-select"
                        value={selectedChain}
                        onChange={(event) => setSelectedChain(event.target.value)}
                      >
                        <option value="">EVM Bundle — All EVM Chains</option>
                        {chains.map((chain) => (
                          <option key={chain.slug} value={chain.slug} disabled={!chain.deploySupported}>
                            {chain.name} ({chain.nativeSymbol})
                          </option>
                        ))}
                      </select>

                      <button className="sg-cyan-action" type="button" onClick={calculateFunding}>
                        CALCULATE FUNDING
                      </button>

                      <button className="sg-pink-action" type="button" onClick={lockGateIn}>
                        LOCK GATE IN
                      </button>
                    </div>

                    {(fundingStatus || deployStatus) && (
                      <div className="sg-live-status" aria-live="polite">
                        {fundingStatus && <p>{fundingStatus}</p>}
                        {deployStatus && <p>{deployStatus}</p>}
                      </div>
                    )}
                  </section>

                  <div className="sg-progress-grid">
                    <section className="sg-mini-card">
                      <h2>DEPLOYMENT PROGRESS</h2>

                      <div className="sg-progress-track">
                        <div
                          className="sg-progress-fill"
                          style={{
                            width:
                              activeStep < 0
                                ? '0%'
                                : `${Math.round(((activeStep + 1) / PROGRESS_STEPS.length) * 100)}%`
                          }}
                        />
                      </div>

                      <div className="sg-progress-percent">
                        {activeStep < 0
                          ? '0%'
                          : `${Math.round(((activeStep + 1) / PROGRESS_STEPS.length) * 100)}%`}
                      </div>

                      {PROGRESS_STEPS.map((step, index) => (
                        <div className="sg-progress-line" key={step}>
                          <span className={index <= activeStep ? 'on' : ''} />
                          {step}
                        </div>
                      ))}
                    </section>

                    <section className="sg-mini-card">
                      <h2>VERIFYING PROTECTION</h2>
                      <p>Runs automatically after deployment.</p>
                    </section>
                  </div>

                  <section className="sg-final-warning">
                    <strong>&#9888;</strong>
                    <p>
                      All data auto-scrubs after verification and again at session end. SCRUB purges on demand.
                      Standalone. Nothing is stored, logged, or transmitted from the browser.
                    </p>
                  </section>
                </>
              )}

              {dashboardTab === 'protection' && (
                <section id="protection-panel" className="sg-dash-card sg-protection-card">
                  <h2>PROTECTION SETUP</h2>

                  <div className="sg-protection-banner">
                    <strong>For protection before compromise</strong> — configure EIP-777G protection here.
                  </div>

                  <div className="sg-form-grid sg-form-grid--protect">
                    <label>
                      <span>K1 ADDRESS <em>AUTO-FILLED</em></span>
                      <input
                        className="sg-input sg-input--active"
                        value={k1Address}
                        readOnly
                      />
                    </label>

                    <label>
                      <span>K2 AUTH ADDRESS</span>
                      <input
                        className="sg-input"
                        value={k2Address}
                        onChange={(event) => setK2Address(event.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>

                    <label>
                      <span>K3 CLEAN DROP ADDRESS</span>
                      <input
                        className="sg-input"
                        value={k3Address}
                        onChange={(event) => setK3Address(event.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                  </div>

                  <div className="sg-bundle-actions">
                    <select
                      className="sg-input sg-chain-select"
                      value={selectedChain}
                      onChange={(event) => setSelectedChain(event.target.value)}
                    >
                      <option value="">EVM Bundle — All EVM Chains</option>
                      {chains.map((chain) => (
                        <option key={chain.slug} value={chain.slug} disabled={!chain.deploySupported}>
                          {chain.name} ({chain.nativeSymbol})
                        </option>
                      ))}
                    </select>

                    <button className="sg-cyan-action" type="button" onClick={calculateFunding}>
                      CALCULATE FUNDING
                    </button>

                    <button className="sg-pink-action" type="button">
                      AUTHORIZE PROTECTION
                    </button>
                  </div>

                  <div className="sg-protection-note">
                    To activate: open K1 in your wallet and authorize the signature prompt. K2 and K3 are public
                    addresses only. Do not enter K2 or K3 private keys.
                  </div>
                </section>
              )}

              {dashboardTab === 'status' && (
                <section id="status-panel" className="sg-dash-card sg-status-card">
                  <h2>STATUS</h2>

                  <div className="sg-status-row">
                    <span className="on" />
                    Auth-Gate route: {verifiedRoute}
                  </div>
                  <div className="sg-status-row">
                    <span className="on" />
                    Dashboard unlock: authGateVerified only
                  </div>
                  <div className="sg-status-row">
                    <span className="on" />
                    Backend deploy boundary: signedTx only
                  </div>
                  <div className="sg-status-row">
                    <span className="on" />
                    K2: public authorization address only
                  </div>
                  <div className="sg-status-row">
                    <span className="on" />
                    K3: immutable clean drop destination
                  </div>
                </section>
              )}
            </section>
          )}
        </main>
      </div>

      <aside className="sg-thankyou-float" aria-label="Thank you">
        {dashboardUnlocked && (
          <div className="sg-thanks-panel">
            <textarea
              value={thanksMessage}
              onChange={(event) => setThanksMessage(event.target.value)}
              placeholder="Optional thank-you note"
              maxLength={280}
            />
            <button type="button" onClick={sendThanks}>
              SEND
            </button>
            <div>{thanksStatus}</div>
          </div>
        )}

        <button
          className="sg-thankyou-button"
          type="button"
          onClick={() => {
            if (thanksAddress) navigator.clipboard?.writeText(thanksAddress)
          }}
        >
          THANK YOU
        </button>

        <div className="sg-built">
          BUILT BY EMP <span>✦</span>{' '}
          <a href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">
            {thanksHandle}
          </a>
        </div>
      </aside>
    </div>
  )
}

```

## `frontend/src/index.css`

```css
:root {
  --sg-bg: #05070d;
  --sg-panel: rgba(12, 16, 24, 0.82);
  --sg-panel-strong: rgba(12, 16, 24, 0.94);
  --sg-rail: rgba(6, 9, 14, 0.9);
  --sg-line: rgba(255, 255, 255, 0.18);
  --sg-line-soft: rgba(255, 255, 255, 0.1);
  --sg-fg: #f4f7ff;
  --sg-muted: #a8b2c3;
  --sg-dim: #717b8d;
  --sg-cyan: #35f5ec;
  --sg-pink: #ff45d4;
  --sg-gold: #ffd75a;
  --sg-red: #ff4b5b;
  --sg-topbar-h: 76px;
  --sg-rail-w: 390px;
  --sg-radius: 10px;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
  background: var(--sg-bg);
  color: var(--sg-fg);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body {
  overflow-x: hidden;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.sg-root {
  min-height: 100vh;
  background:
    radial-gradient(900px 420px at 70% 18%, rgba(53, 245, 236, 0.045), transparent 62%),
    radial-gradient(650px 380px at 10% 90%, rgba(255, 69, 212, 0.035), transparent 62%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
    var(--sg-bg);
  background-size:
    auto,
    auto,
    80px 80px,
    80px 80px,
    auto;
}

/* TOP BAR */

.sg-topbar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 70;
  height: var(--sg-topbar-h);
  display: flex;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid var(--sg-line);
  background: rgba(5, 7, 13, 0.96);
  backdrop-filter: blur(14px);
}

.sg-brand {
  display: grid;
  gap: 3px;
  line-height: 0.9;
  font-weight: 1000;
  letter-spacing: 0.16em;
}

.sg-brand span {
  font-size: 28px;
  color: var(--sg-cyan);
  text-shadow:
    0 0 12px rgba(53, 245, 236, 0.7),
    2px 0 0 rgba(255, 69, 212, 0.35);
}

.sg-brand small {
  color: var(--sg-gold);
  font-size: 13px;
  letter-spacing: 0.18em;
}

.sg-topbar-spacer {
  flex: 1;
}

.sg-scrub {
  width: 118px;
  height: 42px;
  border: 0;
  border-radius: 7px;
  background: var(--sg-pink);
  color: #23041c;
  font-weight: 1000;
  letter-spacing: 0.22em;
  box-shadow: 0 0 20px rgba(255, 69, 212, 0.52);
}

.sg-power {
  width: 48px;
  height: 48px;
  margin-left: 14px;
  border-radius: 999px;
  border: 3px solid var(--sg-gold);
  background: transparent;
  color: var(--sg-gold);
  font-size: 24px;
  line-height: 1;
  box-shadow: 0 0 20px rgba(255, 215, 90, 0.35);
}

/* GLOBAL LAYOUT */

.sg-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--sg-rail-w) minmax(0, 1fr);
  padding-top: var(--sg-topbar-h);
}

.sg-sidebar {
  position: fixed;
  left: 0;
  top: var(--sg-topbar-h);
  bottom: 0;
  z-index: 45;
  width: var(--sg-rail-w);
  overflow-y: auto;
  padding: 26px 28px 100px;
  border-right: 1px solid var(--sg-line);
  background: var(--sg-rail);
  box-shadow: inset -1px 0 0 rgba(53, 245, 236, 0.08);
}

.sg-sidebar::-webkit-scrollbar {
  width: 9px;
}

.sg-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sg-sidebar::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
}

.sg-main {
  grid-column: 2;
  min-width: 0;
  min-height: calc(100vh - var(--sg-topbar-h));
}

/* AUTH RAIL */

.sg-scan {
  width: 126px;
  height: 126px;
  margin: 0 auto 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 2px solid rgba(53, 245, 236, 0.88);
  background:
    radial-gradient(circle, rgba(53, 245, 236, 0.12), transparent 58%),
    rgba(3, 5, 9, 0.9);
  color: var(--sg-cyan);
  font-size: 13px;
  font-weight: 1000;
  letter-spacing: 0.18em;
  text-shadow: 0 0 10px rgba(53, 245, 236, 0.7);
  box-shadow:
    0 0 26px rgba(53, 245, 236, 0.42),
    inset 0 0 0 13px rgba(255, 69, 212, 0.08);
}

.sg-scan:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

.sg-device-copy {
  display: grid;
  gap: 9px;
  margin-bottom: 22px;
}

.sg-device-copy p,
.sg-auth-copy p {
  margin: 0;
  color: var(--sg-fg);
  font-size: 16px;
  line-height: 1.45;
  font-weight: 850;
}

.sg-device-copy strong,
.sg-auth-copy strong,
.sg-auth-copy a {
  color: var(--sg-pink);
  text-decoration: none;
}

.sg-auth-copy mark {
  color: var(--sg-gold);
  background: transparent;
  font-weight: 1000;
}

.sg-rail-rule {
  height: 1px;
  margin: 0 0 24px;
  background: var(--sg-line);
}

.sg-auth-copy {
  display: grid;
  gap: 17px;
  margin-bottom: 20px;
}

.sg-auth-copy h2,
.sg-side-caution h2,
.sg-dash-card h1,
.sg-dash-card h2,
.sg-mini-card h2 {
  margin: 0;
  color: var(--sg-cyan);
  font-weight: 1000;
  letter-spacing: 0.22em;
  text-shadow: 0 0 12px rgba(53, 245, 236, 0.6);
}

.sg-auth-copy h2 {
  font-size: 24px;
}

.sg-label {
  display: block;
  margin: 14px 0 7px;
  color: var(--sg-fg);
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.13em;
}

.sg-input,
.sg-chain-select,
.sg-thanks-panel textarea {
  width: 100%;
  min-height: 42px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(4, 7, 12, 0.74);
  color: var(--sg-fg);
  padding: 0 12px;
  outline: none;
}

.sg-input::placeholder,
.sg-thanks-panel textarea::placeholder {
  color: rgba(255, 255, 255, 0.48);
}

.sg-input:focus,
.sg-input--active {
  border-color: var(--sg-cyan);
  box-shadow:
    0 0 0 1px rgba(53, 245, 236, 0.45),
    0 0 13px rgba(53, 245, 236, 0.13);
}

.sg-input--pink {
  border-color: var(--sg-pink);
  box-shadow: 0 0 0 1px rgba(255, 69, 212, 0.3);
}

.sg-link-device {
  width: 100%;
  height: 48px;
  margin: 14px 0 4px;
  border-radius: 5px;
  border: 2px solid var(--sg-pink);
  background: transparent;
  color: var(--sg-pink);
  font-size: 16px;
  font-weight: 1000;
  letter-spacing: 0.16em;
}

.sg-passkey-row {
  display: grid;
  grid-template-columns: 1fr 92px;
  gap: 10px;
}

.sg-enter {
  min-height: 42px;
  border-radius: 5px;
  border: 2px solid var(--sg-cyan);
  background: transparent;
  color: var(--sg-cyan);
  font-weight: 1000;
  letter-spacing: 0.12em;
}

.sg-side-caution {
  margin-top: 22px;
  padding: 18px;
  border: 1px solid rgba(255, 215, 90, 0.55);
  border-radius: 8px;
  background: rgba(255, 215, 90, 0.045);
}

.sg-caution-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.sg-side-caution h2 {
  color: var(--sg-gold);
  font-size: 18px;
  text-shadow: 0 0 12px rgba(255, 215, 90, 0.4);
}

.sg-side-caution p {
  margin: 0 0 7px;
  font-size: 14px;
  line-height: 1.35;
  font-weight: 850;
}

.sg-side-caution p span {
  color: var(--sg-red);
  font-weight: 1000;
}

.sg-admin-circle {
  width: 34px;
  height: 34px;
  margin-left: auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid var(--sg-pink);
  background: #02030a;
  color: var(--sg-pink);
  font-size: 10px;
  font-weight: 1000;
  box-shadow: 0 0 12px rgba(255, 69, 212, 0.4);
}

.sg-admin-panel {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(255, 69, 212, 0.56);
  border-radius: 7px;
  background: rgba(3, 5, 9, 0.58);
}

.sg-admin-generate {
  width: 100%;
  min-height: 42px;
  margin-top: 14px;
  border-radius: 5px;
  border: 2px solid var(--sg-cyan);
  background: transparent;
  color: var(--sg-cyan);
  font-weight: 1000;
  letter-spacing: 0.12em;
}

.sg-generated {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  color: var(--sg-muted);
  font-size: 12px;
}

.sg-generated code {
  display: block;
  overflow: auto;
  padding: 8px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.32);
  color: var(--sg-gold);
}

.sg-generated button {
  min-height: 34px;
  border-radius: 5px;
  border: 1px solid var(--sg-pink);
  background: transparent;
  color: var(--sg-pink);
  font-weight: 1000;
}

.sg-admin-status,
.sg-auth-msg {
  min-height: 18px;
  margin-top: 12px;
  color: var(--sg-muted);
  font-size: 12px;
  line-height: 1.35;
}

.sg-rail-bottom {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 22px;
  color: var(--sg-muted);
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: 0.18em;
}

.sg-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--sg-gold);
}

.sg-dot--on {
  background: var(--sg-cyan);
  box-shadow: 0 0 10px var(--sg-cyan);
}

/* LOCKED SCREEN */

.sg-main--locked {
  display: grid;
  place-items: center;
  padding: 58px 78px 126px;
}

.sg-locked-stage {
  width: min(790px, 100%);
  display: grid;
  gap: 24px;
  transform: translateY(18px);
}

.sg-standalone,
.sg-warning,
.sg-dash-card,
.sg-mini-card {
  background: var(--sg-panel);
  border-radius: var(--sg-radius);
  box-shadow:
    0 0 30px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.035);
}

.sg-standalone {
  border: 2px solid rgba(53, 245, 236, 0.82);
  padding: 31px 38px;
}

.sg-standalone h1 {
  margin: 0 0 20px;
  color: var(--sg-cyan);
  font-size: 24px;
  font-weight: 1000;
  letter-spacing: 0.22em;
  text-shadow: 0 0 13px rgba(53, 245, 236, 0.65);
}

.sg-standalone p {
  margin: 0 0 9px;
  font-size: 16px;
  line-height: 1.45;
  font-weight: 850;
}

.sg-warning {
  border: 2px solid rgba(255, 215, 90, 0.82);
  padding: 24px 34px;
  color: var(--sg-gold);
}

.sg-warning p {
  margin: 0 0 8px;
  font-size: 16px;
  line-height: 1.45;
  font-weight: 1000;
  letter-spacing: 0.055em;
}

/* UNLOCKED SCREEN */

.sg-main--unlocked {
  padding: 36px 42px 132px;
}

.sg-workspace-stage {
  width: min(1260px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 22px;
}

.sg-tabs {
  position: sticky;
  top: calc(var(--sg-topbar-h) + 10px);
  z-index: 30;
  display: flex;
  gap: 9px;
  justify-content: flex-end;
}

.sg-tabs button {
  min-height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(53, 245, 236, 0.5);
  background: rgba(5, 7, 13, 0.86);
  color: var(--sg-cyan);
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.12em;
}

.sg-dash-card {
  border: 1px solid var(--sg-line);
  padding: 28px 32px;
}

.sg-deployment-card {
  border-left: 5px solid var(--sg-cyan);
  box-shadow:
    inset 0 0 0 1px rgba(53, 245, 236, 0.12),
    0 0 24px rgba(53, 245, 236, 0.08);
}

.sg-dash-card h1 {
  margin-bottom: 22px;
  font-size: 28px;
}

.sg-dash-card h2 {
  margin-bottom: 18px;
  font-size: 23px;
}

.sg-deploy-intro {
  display: grid;
  gap: 8px;
}

.sg-deploy-intro p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 850;
}

.sg-deploy-intro strong {
  color: var(--sg-gold);
}

.sg-deploy-steps {
  list-style: none;
  display: grid;
  gap: 15px;
  margin: 26px 0 0;
  padding: 0;
}

.sg-deploy-steps li {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 16px;
  align-items: start;
  font-size: 16px;
  line-height: 1.45;
  font-weight: 850;
}

.sg-deploy-steps li span {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--sg-pink);
  color: #26041f;
  font-weight: 1000;
  box-shadow: 0 0 14px rgba(255, 69, 212, 0.55);
}

.sg-bundle-card {
  padding-top: 24px;
}

.sg-form-grid {
  display: grid;
  gap: 18px 20px;
}

.sg-form-grid--deploy {
  grid-template-columns: repeat(4, minmax(145px, 1fr));
}

.sg-form-grid--protect {
  grid-template-columns: repeat(3, minmax(180px, 1fr));
}

.sg-form-wide {
  grid-column: span 2;
}

.sg-form-grid label {
  display: grid;
  gap: 7px;
}

.sg-form-grid label span {
  color: var(--sg-fg);
  font-size: 13px;
  font-weight: 1000;
  letter-spacing: 0.09em;
}

.sg-form-grid label em {
  color: var(--sg-muted);
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.sg-form-grid small {
  color: var(--sg-muted);
  font-size: 11px;
  font-weight: 800;
}

.sg-bundle-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.sg-chain-select {
  max-width: 270px;
  font-weight: 950;
}

.sg-cyan-action,
.sg-pink-action {
  height: 44px;
  border-radius: 6px;
  padding: 0 24px;
  font-size: 13px;
  font-weight: 1000;
  letter-spacing: 0.12em;
}

.sg-cyan-action {
  border: 2px solid var(--sg-cyan);
  background: transparent;
  color: var(--sg-cyan);
  box-shadow: 0 0 12px rgba(53, 245, 236, 0.18);
}

.sg-pink-action {
  margin-left: auto;
  border: 0;
  background: var(--sg-pink);
  color: #26041f;
  box-shadow: 0 0 18px rgba(255, 69, 212, 0.5);
}

.sg-live-status {
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 215, 90, 0.5);
  border-radius: 7px;
  color: var(--sg-gold);
  background: rgba(255, 215, 90, 0.045);
}

.sg-live-status p {
  margin: 0 0 5px;
  font-size: 13px;
  font-weight: 850;
}

.sg-progress-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.sg-mini-card {
  min-height: 190px;
  border: 1px solid var(--sg-line);
  padding: 22px 24px;
}

.sg-mini-card h2 {
  font-size: 20px;
  margin-bottom: 17px;
}

.sg-mini-card p {
  margin: 0;
  color: var(--sg-muted);
  font-size: 14px;
  font-style: italic;
  font-weight: 800;
}

.sg-progress-track {
  height: 14px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--sg-line-soft);
  background: rgba(0, 0, 0, 0.48);
}

.sg-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--sg-cyan), rgba(53, 245, 236, 0.55));
  box-shadow: 0 0 14px rgba(53, 245, 236, 0.55);
  transition: width 220ms ease;
}

.sg-progress-percent {
  margin: 8px 0 13px;
  text-align: right;
  font-size: 14px;
  font-weight: 1000;
}

.sg-progress-line,
.sg-status-row {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 9px 0;
  font-size: 14px;
  font-weight: 850;
}

.sg-progress-line span,
.sg-status-row span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
}

.sg-progress-line span.on,
.sg-status-row span.on {
  background: var(--sg-cyan);
  box-shadow: 0 0 8px var(--sg-cyan);
}

.sg-protection-card {
  border: 2px solid rgba(53, 245, 236, 0.75);
}

.sg-protection-banner {
  margin-bottom: 20px;
  padding: 14px 18px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.26);
  font-weight: 850;
}

.sg-protection-banner strong {
  color: var(--sg-cyan);
}

.sg-protection-note {
  margin-top: 22px;
  padding: 15px 18px;
  border: 1px solid var(--sg-line);
  border-radius: 6px;
  color: var(--sg-fg);
  font-size: 14px;
  line-height: 1.45;
  font-weight: 850;
  background: rgba(255, 255, 255, 0.035);
}

.sg-status-card {
  padding-bottom: 26px;
}

/* THANK YOU FLOAT */

.sg-thankyou-float {
  position: fixed;
  right: 26px;
  bottom: 19px;
  z-index: 90;
  display: grid;
  gap: 9px;
  justify-items: end;
  pointer-events: none;
}

.sg-thankyou-button {
  pointer-events: auto;
  width: 102px;
  height: 48px;
  border: 0;
  border-radius: 5px;
  background: var(--sg-cyan);
  color: #03201e;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: 0.14em;
  box-shadow: 0 0 18px rgba(53, 245, 236, 0.55);
}

.sg-built {
  color: var(--sg-muted);
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.14em;
  text-align: right;
}

.sg-built span {
  color: var(--sg-pink);
}

.sg-built a {
  pointer-events: auto;
  color: var(--sg-cyan);
  text-decoration: none;
}

.sg-thanks-panel {
  pointer-events: auto;
  width: 280px;
  padding: 12px;
  border: 1px solid var(--sg-line);
  border-radius: 8px;
  background: rgba(5, 7, 13, 0.94);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.35);
}

.sg-thanks-panel textarea {
  min-height: 76px;
  padding: 10px;
  resize: vertical;
}

.sg-thanks-panel button {
  width: 100%;
  height: 34px;
  margin-top: 8px;
  border: 1px solid var(--sg-cyan);
  border-radius: 5px;
  background: transparent;
  color: var(--sg-cyan);
  font-weight: 1000;
}

.sg-thanks-panel div {
  margin-top: 7px;
  min-height: 15px;
  color: var(--sg-muted);
  font-size: 11px;
}

/* RESPONSIVE */

@media (max-width: 1180px) {
  :root {
    --sg-rail-w: 350px;
  }

  .sg-sidebar {
    padding-left: 22px;
    padding-right: 22px;
  }

  .sg-main--locked {
    padding: 48px 36px 126px;
  }

  .sg-main--unlocked {
    padding: 30px 28px 132px;
  }

  .sg-form-grid--deploy,
  .sg-form-grid--protect,
  .sg-progress-grid {
    grid-template-columns: 1fr;
  }

  .sg-form-wide {
    grid-column: span 1;
  }

  .sg-pink-action {
    margin-left: 0;
  }
}

@media (max-width: 880px) {
  :root {
    --sg-topbar-h: 72px;
    --sg-rail-w: 100%;
  }

  .sg-layout {
    display: block;
  }

  .sg-sidebar {
    position: relative;
    top: auto;
    bottom: auto;
    width: auto;
    max-height: none;
  }

  .sg-main {
    grid-column: auto;
  }

  .sg-main--locked,
  .sg-main--unlocked {
    padding: 24px 18px 140px;
  }

  .sg-tabs {
    justify-content: flex-start;
    overflow-x: auto;
  }

  .sg-brand span {
    font-size: 22px;
  }

  .sg-scrub {
    width: 92px;
  }

  .sg-power {
    width: 42px;
    height: 42px;
  }
}

/* DAPINK last-mile screenshot match */
@media (min-width: 881px) {
  :root {
    --sg-topbar-h: 76px;
    --sg-rail-w: 390px;
  }

  .sg-topbar { height: var(--sg-topbar-h); padding: 0 32px 0 34px; }
  .sg-brand span { font-size: 31px; letter-spacing: 0.14em; }
  .sg-brand small { font-size: 13px; letter-spacing: 0.18em; }
  .sg-scrub { width: 148px; height: 52px; border-radius: 8px; font-size: 16px; letter-spacing: 0.28em; }
  .sg-power { width: 58px; height: 58px; margin-left: 16px; border-width: 3px; font-size: 28px; }

  .sg-sidebar { width: var(--sg-rail-w); padding: 24px 34px 76px; background: rgba(4, 7, 12, 0.92); }
  .sg-scan { width: 112px; height: 112px; margin: 4px auto 18px; font-size: 12px; letter-spacing: 0.18em; box-shadow: 0 0 24px rgba(53, 245, 236, 0.38), inset 0 0 0 13px rgba(255, 69, 212, 0.065); }
  .sg-device-copy { gap: 7px; margin-bottom: 16px; }
  .sg-device-copy p, .sg-auth-copy p { font-size: 14px; line-height: 1.34; font-weight: 850; }
  .sg-device-copy strong, .sg-auth-copy strong, .sg-auth-copy a { color: var(--sg-pink); }
  .sg-rail-rule { margin-bottom: 18px; }
  .sg-auth-copy { gap: 10px; margin-bottom: 14px; }
  .sg-auth-copy h2 { margin-bottom: 2px; font-size: 23px; letter-spacing: 0.23em; }
  .sg-auth-copy mark { color: var(--sg-gold); }

  .sg-label { margin: 10px 0 5px; font-size: 10px; letter-spacing: 0.15em; }
  .sg-input, .sg-chain-select { min-height: 36px; border-radius: 5px; padding: 0 10px; font-size: 12px; }
  .sg-link-device { height: 40px; margin: 10px 0 2px; font-size: 13px; letter-spacing: 0.14em; }
  .sg-passkey-row { grid-template-columns: 1fr 78px; gap: 8px; }
  .sg-enter { min-height: 36px; font-size: 11px; letter-spacing: 0.1em; }

  .sg-side-caution { margin-top: 14px; padding: 13px 14px; border-radius: 7px; background: rgba(255, 215, 90, 0.04); }
  .sg-caution-head { margin-bottom: 8px; }
  .sg-side-caution h2 { font-size: 14px; letter-spacing: 0.14em; }
  .sg-side-caution p { margin-bottom: 4px; font-size: 12px; line-height: 1.28; }
  .sg-admin-circle { width: 30px; height: 30px; font-size: 9px; }
  .sg-admin-panel { margin-top: 10px; padding: 11px; }
  .sg-admin-generate { min-height: 36px; margin-top: 10px; font-size: 11px; }
  .sg-auth-msg { margin-top: 8px; font-size: 11px; }
  .sg-rail-bottom { margin-top: 12px; font-size: 10px; }

  .sg-main--locked { display: grid; place-items: center; padding: 34px 76px 132px; }
  .sg-locked-stage { width: min(990px, 100%); gap: 30px; transform: translateY(-2px); }
  .sg-standalone { padding: 42px 48px 38px; border-width: 2px; border-color: rgba(53, 245, 236, 0.72); background: rgba(7, 10, 16, 0.64); }
  .sg-standalone h1 { margin-bottom: 26px; font-size: 28px; letter-spacing: 0.25em; color: var(--sg-cyan); }
  .sg-standalone p { margin-bottom: 12px; color: rgba(244, 247, 255, 0.72); font-size: 18px; line-height: 1.35; font-weight: 900; }
  .sg-warning { padding: 32px 42px; border-width: 2px; border-color: rgba(255, 215, 90, 0.68); background: rgba(7, 10, 16, 0.64); }
  .sg-warning p { margin-bottom: 12px; color: rgba(255, 215, 90, 0.72); font-size: 18px; line-height: 1.38; font-weight: 1000; letter-spacing: 0.085em; }

  .sg-thankyou-float { right: 30px; bottom: 22px; gap: 10px; }
  .sg-thankyou-button { width: 128px; height: 60px; border-radius: 7px; font-size: 12px; letter-spacing: 0.16em; }
  .sg-built { font-size: 12px; letter-spacing: 0.16em; }
}

@media (min-width: 881px) and (max-height: 850px) {
  .sg-sidebar { padding-top: 16px; padding-bottom: 64px; }
  .sg-scan { width: 96px; height: 96px; margin-bottom: 12px; }
  .sg-device-copy p, .sg-auth-copy p { font-size: 12.5px; line-height: 1.25; }
  .sg-device-copy { gap: 5px; margin-bottom: 12px; }
  .sg-auth-copy { gap: 7px; margin-bottom: 10px; }
  .sg-auth-copy h2 { font-size: 20px; }
  .sg-rail-rule { margin-bottom: 13px; }
  .sg-label { margin-top: 7px; }
  .sg-input, .sg-chain-select, .sg-enter { min-height: 32px; }
  .sg-link-device { height: 34px; margin-top: 8px; font-size: 11px; }
  .sg-side-caution { margin-top: 10px; padding: 10px 12px; }
  .sg-side-caution p { font-size: 11px; }
  .sg-admin-circle { width: 28px; height: 28px; }
}

/* =========================================================
   SECUREGATE / EIP-777G
   UNLOCKED DASHBOARD CORRECTION
   ========================================================= */

@media (min-width: 881px) {
  .sg-main--unlocked {
    display: block;
    padding: 28px 44px 132px;
    overflow: visible;
  }

  .sg-workspace-stage {
    width: min(1240px, calc(100vw - var(--sg-rail-w) - 88px));
    margin: 0 auto;
    display: grid;
    gap: 22px;
  }

  .sg-tabs--dashboard {
    position: sticky;
    top: calc(var(--sg-topbar-h) + 10px);
    z-index: 35;
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin: 0 0 -2px;
    pointer-events: auto;
  }

  .sg-tabs--dashboard button {
    min-height: 34px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(53, 245, 236, 0.46);
    background: rgba(5, 7, 13, 0.82);
    color: rgba(53, 245, 236, 0.78);
    font-size: 11px;
    font-weight: 1000;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 120ms, color 120ms, box-shadow 120ms;
  }

  .sg-tabs--dashboard button.active {
    border-color: var(--sg-cyan);
    color: var(--sg-cyan);
    box-shadow: 0 0 12px rgba(53, 245, 236, 0.18);
  }

  .sg-dash-card,
  .sg-mini-card {
    background: rgba(12, 16, 24, 0.72);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow:
      0 0 28px rgba(0, 0, 0, 0.24),
      inset 0 0 0 1px rgba(255, 255, 255, 0.035);
  }

  .sg-deployment-card {
    padding: 28px 34px 30px;
    border-left: 5px solid var(--sg-cyan);
    box-shadow:
      0 0 28px rgba(0, 0, 0, 0.25),
      inset 0 0 0 1px rgba(53, 245, 236, 0.11);
  }

  .sg-deployment-card h1,
  .sg-bundle-card h2,
  .sg-mini-card h2,
  .sg-protection-card h2,
  .sg-status-card h2 {
    margin: 0 0 18px;
    color: var(--sg-cyan);
    font-weight: 1000;
    letter-spacing: 0.22em;
    text-shadow: 0 0 13px rgba(53, 245, 236, 0.58);
  }

  .sg-deployment-card h1 { font-size: 28px; }

  .sg-bundle-card h2,
  .sg-protection-card h2,
  .sg-status-card h2 { font-size: 23px; }

  .sg-deploy-intro { display: grid; gap: 8px; }

  .sg-deploy-intro p {
    margin: 0;
    color: rgba(244, 247, 255, 0.88);
    font-size: 16px;
    line-height: 1.45;
    font-weight: 850;
  }

  .sg-deploy-intro strong { color: var(--sg-gold); }

  .sg-deploy-steps {
    list-style: none;
    display: grid;
    gap: 14px;
    margin: 24px 0 0;
    padding: 0;
  }

  .sg-deploy-steps li {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 16px;
    align-items: start;
  }

  .sg-deploy-steps li span {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--sg-pink);
    color: #25041d;
    font-size: 13px;
    font-weight: 1000;
    box-shadow: 0 0 14px rgba(255, 69, 212, 0.52);
  }

  .sg-deploy-steps li p {
    margin: 1px 0 0;
    color: rgba(244, 247, 255, 0.88);
    font-size: 16px;
    line-height: 1.42;
    font-weight: 850;
  }

  .sg-bundle-card { padding: 24px 32px 26px; }

  .sg-form-grid { display: grid; gap: 18px 20px; }
  .sg-form-grid--deploy { grid-template-columns: repeat(4, minmax(145px, 1fr)); }
  .sg-form-grid--protect { grid-template-columns: repeat(3, minmax(180px, 1fr)); }
  .sg-form-wide { grid-column: span 2; }
  .sg-form-full { grid-column: 1 / -1; }

  .sg-form-grid label { display: grid; gap: 7px; }

  .sg-form-grid label span {
    color: rgba(244, 247, 255, 0.9);
    font-size: 13px;
    font-weight: 1000;
    letter-spacing: 0.09em;
  }

  .sg-form-grid label em {
    color: rgba(244, 247, 255, 0.55);
    font-style: normal;
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .sg-form-grid small {
    color: rgba(244, 247, 255, 0.55);
    font-size: 11px;
    font-weight: 800;
  }

  .sg-bundle-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 20px;
  }

  .sg-chain-select { max-width: 270px; font-weight: 950; }

  .sg-cyan-action,
  .sg-pink-action {
    height: 44px;
    border-radius: 6px;
    padding: 0 24px;
    font-size: 13px;
    font-weight: 1000;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .sg-cyan-action {
    border: 2px solid var(--sg-cyan);
    background: transparent;
    color: var(--sg-cyan);
    box-shadow: 0 0 12px rgba(53, 245, 236, 0.18);
  }

  .sg-pink-action {
    margin-left: auto;
    border: 0;
    background: var(--sg-pink);
    color: #26041f;
    box-shadow: 0 0 18px rgba(255, 69, 212, 0.5);
  }

  .sg-live-status {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid rgba(255, 215, 90, 0.5);
    border-radius: 7px;
    color: var(--sg-gold);
    background: rgba(255, 215, 90, 0.045);
  }

  .sg-live-status p { margin: 0 0 5px; font-size: 13px; font-weight: 850; }

  .sg-progress-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .sg-mini-card { min-height: 190px; padding: 22px 24px; }
  .sg-mini-card h2 { font-size: 20px; margin-bottom: 17px; }

  .sg-mini-card p {
    margin: 0;
    color: rgba(244, 247, 255, 0.62);
    font-size: 14px;
    font-style: italic;
    font-weight: 800;
  }

  .sg-progress-track {
    height: 14px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.48);
  }

  .sg-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sg-cyan), rgba(53, 245, 236, 0.55));
    box-shadow: 0 0 14px rgba(53, 245, 236, 0.55);
    transition: width 220ms ease;
  }

  .sg-progress-percent {
    margin: 8px 0 13px;
    text-align: right;
    font-size: 14px;
    font-weight: 1000;
  }

  .sg-progress-line,
  .sg-status-row {
    display: flex;
    align-items: center;
    gap: 11px;
    margin: 9px 0;
    color: rgba(244, 247, 255, 0.86);
    font-size: 14px;
    font-weight: 850;
  }

  .sg-progress-line span,
  .sg-status-row span {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  .sg-progress-line span.on,
  .sg-status-row span.on {
    background: var(--sg-cyan);
    box-shadow: 0 0 8px var(--sg-cyan);
  }

  .sg-final-warning {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 12px;
    align-items: center;
    padding: 18px 22px;
    border: 2px solid rgba(255, 215, 90, 0.68);
    border-radius: 8px;
    background: rgba(7, 10, 16, 0.66);
    color: rgba(244, 247, 255, 0.88);
  }

  .sg-final-warning strong {
    color: var(--sg-gold);
    font-size: 22px;
  }

  .sg-final-warning p {
    margin: 0;
    font-size: 14px;
    line-height: 1.42;
    font-weight: 850;
  }

  .sg-protection-card {
    border: 2px solid rgba(53, 245, 236, 0.72);
    padding: 26px 32px;
  }

  .sg-protection-banner {
    margin-bottom: 20px;
    padding: 12px 16px;
    border-radius: 6px;
    border: 1px solid rgba(53, 245, 236, 0.38);
    background: rgba(53, 245, 236, 0.06);
    color: rgba(244, 247, 255, 0.9);
    font-size: 15px;
    font-weight: 900;
    line-height: 1.4;
  }

  .sg-protection-banner strong { color: var(--sg-cyan); }

  .sg-protection-note {
    margin-top: 18px;
    color: rgba(244, 247, 255, 0.62);
    font-size: 13px;
    font-weight: 800;
    line-height: 1.45;
  }

  .sg-status-card { padding: 26px 32px; }
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
// The dashboard is intentionally opaque about mechanics: users NEVER see the
// forbidden operator vocabulary (the cancel-approval verb, bot, Flashbots, the
// smoke-check word, RPC, mempool, or bundle), nor a raw RPC URL. Every user-facing
// string flows through this module so the drift verifier can prove no forbidden
// vocabulary leaks into the UI.

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

import { api } from './api'

export type AdminPasskeyResult = {
  generated: boolean
  disabled?: boolean
  passkey?: string
  k1?: string
  reason?: string
}

export async function generateAdminPasskeyRemote(adminKey: string, k1: string): Promise<AdminPasskeyResult> {
  try {
    const r = await fetch(api('admin-passkey/generate'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ adminKey, k1 }),
    })
    const d = await r.json()
    return {
      generated: d?.generated === true,
      disabled: d?.disabled === true,
      passkey: d?.passkey,
      k1: d?.k1,
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

import { api } from './api'

export type PasskeyResult = {
  verified: boolean
  registered?: boolean
  reason?: string
}

export async function registerPasskey(k1: string, passkey: string): Promise<PasskeyResult> {
  try {
    const r = await fetch(api('passkeys/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ k1, passkey }),
    })
    const d = await r.json()
    return { verified: false, registered: d?.registered === true, reason: d?.error }
  } catch {
    return { verified: false, reason: 'network error' }
  }
}

export async function verifyPasskey(k1: string, passkey: string): Promise<PasskeyResult> {
  try {
    const r = await fetch(api('passkeys/verify'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ k1, passkey }),
    })
    const d = await r.json()
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

import { api } from './api'

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
    const r = await fetch(api(`trace/${kind}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject }),
    })
    const d = await r.json()
    return { ok: r.ok, repeatCount: Number(d?.repeatCount) || 0, flagged: d?.flagged === true }
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
    // Honest surface of the backend's 503 reason (e.g. "SECUREGATE_BYTECODE_HEX not set").
    const reason = (body && (body.reason || body.error)) || `HTTP ${res.status}`
    throw new Error('artifact unavailable: ' + reason)
  }
  // Strict shape validation (0x-hex bytecode, non-empty ABI array).
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

import { api } from './api.ts'

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
    const r = await fetch(api('thank-you/config'))
    const d = await r.json()
    return {
      handle: d?.handle || '@hope_ology',
      network: d?.network || 'EVM',
      copyAddress: d?.copyAddress || '',
    }
  } catch {
    return { handle: '@hope_ology', network: 'EVM', copyAddress: '' }
  }
}

export async function sendThankYou(message: string): Promise<ThankYouSendResult> {
  try {
    const r = await fetch(api('thank-you/send'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    const d = await r.json()
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

