import { useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'

type Chain = {
  slug: string
  name: string
  chainId: number
  nativeSymbol: string
  deploySupported: boolean
}

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
            <p>Exact checks are hidden so they can&apos;t be cloned or gamed.</p>
            <p>
              Advisory check, not a final ruling. May miss valid ownership — attempt on up to{' '}
              <strong>3 devices per K1.</strong>
            </p>
            <p>
              Still can&apos;t clear? DM <a href="https://x.com/hope_ology">@hope_ology</a> on X with proof of ownership.
            </p>
            <p>
              On success: K1 auto-fills, a <mark>unique passkey</mark> is issued for that K1.
            </p>
            <p>All data auto-scrubs after verification and again at session end.</p>
            <p>Standalone. Nothing is stored, logged, or transmitted. Runs in your browser.</p>
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
              <nav className="sg-tabs" aria-label="Dashboard sections">
                <button type="button" onClick={() => jumpTo('deployment-panel')}>
                  Deployment
                </button>
                <button type="button" onClick={() => jumpTo('protection-panel')}>
                  Protection
                </button>
                <button type="button" onClick={() => jumpTo('status-panel')}>
                  Status
                </button>
              </nav>

              <section id="deployment-panel" className="sg-dash-card sg-deployment-card">
                <h1>EIP-777G DEPLOYMENT</h1>
                <div className="sg-deploy-intro">
                  <p>
                    Create &amp; fund a burner wallet for your deployment bundle — this is your{' '}
                    <strong>Deployer.</strong> Enter the Deployer key and address in the assigned boxes below.
                  </p>
                  <p>
                    Enter the K1 key assigned to the K1 address listed. Enter two clean public addresses in K2 and K3.{' '}
                    <strong>Do not at any point share K2 or K3 keys.</strong>
                  </p>
                </div>

                <ol className="sg-deploy-steps">
                  <li>
                    <span>1</span>
                    Choose the initial chain to launch the EIP-777G contract on.
                  </li>
                  <li>
                    <span>2</span>
                    The fee calculator next to the chain selection box will tell you the funding needed to launch.
                  </li>
                  <li>
                    <span>3</span>
                    Once funded, build and sign the deployment transaction locally.
                  </li>
                  <li>
                    <span>4</span>
                    The progress bar will indicate the bundle was deployed and protection checks completed.
                  </li>
                  <li>
                    <span>5</span>
                    K2 authorizes transactions initiated by K1. Authorized transfer flow routes to K3 clean drop.
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
                      value={shortAddress(k1Address) || k1Address}
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
                      placeholder="0x..."
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

                  <label className="sg-form-wide">
                    <span>SIGNED TX</span>
                    <input
                      className="sg-input"
                      value={signedTx}
                      onChange={(event) => setSignedTx(event.target.value)}
                      placeholder="0x..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <small>Backend receives signedTx only.</small>
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
                  <p>Runs automatically after deploy.</p>
                </section>
              </div>

              <section id="protection-panel" className="sg-dash-card sg-protection-card">
                <h2>PROTECTION SETUP</h2>
                <div className="sg-protection-banner">
                  <strong>For protection before compromise</strong> — deploy EIP-777G here.
                </div>

                <div className="sg-form-grid sg-form-grid--protect">
                  <label>
                    <span>K1 ADDRESS <em>AUTO-FILLED</em></span>
                    <input className="sg-input sg-input--active" value={shortAddress(k1Address) || k1Address} readOnly />
                  </label>

                  <label>
                    <span>K2 ADDRESS</span>
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
                    <span>K3 ADDRESS</span>
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
                  To activate: open K1 in your wallet and authorize the signature prompt. No K2 or K3 private key entry is required.
                </div>
              </section>

              <section id="status-panel" className="sg-dash-card sg-status-card">
                <h2>STATUS</h2>

                <div className="sg-status-row">
                  <span className="on" />
                  Auth-Gate route: {verifiedRoute}
                </div>
                <div className="sg-status-row">
                  <span className="on" />
                  Backend boundary: signedTx only
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
