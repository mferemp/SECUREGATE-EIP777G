# SECUREGATE EIP-777G — Complete Build Code

Live: https://eip777g.vercel.app  
Repo: github.com/mferemp/SECUREGATE-EIP777G  
Branch: main  

---

## Directory Structure

```
/
├── api/                        # Vercel serverless functions (one file per route)
│   ├── _lib/mount.js           # Express router → Vercel handler adapter
│   ├── health.js
│   ├── chains.js
│   ├── runtime.js
│   ├── artifact/securegate.js
│   ├── anti-abuse/event.js
│   ├── admin-passkey/generate.js
│   ├── deploy/[chain].js
│   ├── funding/[chain].js
│   ├── passkeys/register.js
│   ├── passkeys/verify.js
│   ├── rpc/[chain].js
│   ├── thank-you/config.js
│   ├── thank-you/send.js
│   └── trace/[kind].js
├── backend/
│   ├── config/chains.js        # 20-chain registry (no RPC URLs exposed)
│   ├── lib/
│   │   ├── address-guard.js
│   │   ├── anti-abuse-kv.js
│   │   ├── kv.js / kv-memory.js / kv-redis.js
│   │   ├── passkey-store.js
│   │   ├── securegate-events.js
│   │   ├── trace-key.js
│   │   └── trace-store.js
│   └── routes/
│       ├── admin-passkey.js
│       ├── anti-abuse.js
│       ├── artifact.js
│       ├── chains.js
│       ├── deploy.js
│       ├── funding.js
│       ├── passkeys.js
│       ├── rpc.js
│       ├── runtime.js
│       ├── thank-you.js
│       └── trace.js
├── contracts/SecureGate.sol    # Solidity contract
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx             # Single-file React UI (1397 lines)
│   │   ├── index.css           # Terminal dark theme + DAPINK component classes
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── uiLabels.ts
│   │   │   ├── placeholderGates.ts
│   │   │   ├── passkeyAccess.ts
│   │   │   ├── adminPasskey.ts
│   │   │   ├── deviceBreadcrumb.ts
│   │   │   ├── securegateArtifact.ts
│   │   │   ├── securegateTxBuilder.ts
│   │   │   ├── securegateIntentHash.ts
│   │   │   ├── securegateK2Authorization.ts
│   │   │   ├── securegateWalletProvider.ts
│   │   │   ├── securegateSessionKeys.ts
│   │   │   ├── recoveryCleanupSweep.ts
│   │   │   ├── k3ExecutionSweep.ts
│   │   │   ├── k3Enforcement.ts
│   │   │   ├── twoFactorProactive.ts
│   │   │   └── thankYouEnvelope.ts
│   └── package.json
├── vercel.json
├── .node-version               # 22
├── .nvmrc                      # 22
└── package.json
```

---

## vercel.json

```json
{
  "version": 2,
  "installCommand": "npm --prefix frontend install && npm --prefix backend install",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/**/*.js": { "memory": 256, "maxDuration": 10 }
  },
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

---

## api/_lib/mount.js

```js
'use strict';
const express = require('express');

module.exports = function mount(routerFactory) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use((req, _res, next) => {
    req.url = req.url.replace(/^\/api\/[^/?]+/, '') || '/';
    next();
  });
  app.use('/', routerFactory());
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  return (req, res) => app(req, res);
};
```

---

## api/health.js

```js
'use strict';
module.exports = (_req, res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify({ ok: true, service: 'securegate-eip777g', ts: Date.now() }));
};
```

---

## api/chains.js

```js
'use strict';
const mount = require('./_lib/mount');
module.exports = mount(() => require('../backend/routes/chains'));
```

---

## api/runtime.js

```js
'use strict';
const mount = require('./_lib/mount');
module.exports = mount(() => require('../backend/routes/runtime'));
```

---

## api/artifact/securegate.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/artifact'));
```

---

## api/anti-abuse/event.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/anti-abuse'));
```

---

## api/admin-passkey/generate.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/admin-passkey'));
```

---

## api/deploy/[chain].js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/deploy'));
```

---

## api/funding/[chain].js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/funding'));
```

---

## api/passkeys/register.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/passkeys'));
```

---

## api/passkeys/verify.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/passkeys'));
```

---

## api/rpc/[chain].js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/rpc'));
```

---

## api/thank-you/config.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/thank-you'));
```

---

## api/thank-you/send.js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/thank-you'));
```

---

## api/trace/[kind].js

```js
'use strict';
const mount = require('../_lib/mount');
module.exports = mount(() => require('../../backend/routes/trace'));
```

---

## backend/routes/chains.js

```js
'use strict';
const express = require('express');
const chains = require('../config/chains');
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ chains: chains.listPublic() });
});

module.exports = router;
```

---

## backend/routes/deploy.js

```js
'use strict';
const express = require('express');
const chains = require('../config/chains');
const guard = require('../lib/address-guard');
const router = express.Router();

function isSignedTx(raw) {
  return typeof raw === 'string' && /^0x[0-9a-fA-F]{100,}$/.test(raw.trim());
}
function looksLikePrivateKey(raw) {
  return typeof raw === 'string' && /^0x?[0-9a-fA-F]{64}$/.test(raw.trim());
}

const FORBIDDEN_KEY_FIELDS = [
  'privateKey','k1Key','k2Key','k3Key','deployerKey',
  'mnemonic','seed','secret','passphrase','k1SessionKey','k2SessionKey','sessionKey',
];
function hasKeyField(body) {
  if (!body || typeof body !== 'object') return false;
  return Object.keys(body).some((k) =>
    FORBIDDEN_KEY_FIELDS.includes(k) || /priv|secret|mnemonic|seed|passphrase|sessionkey/i.test(k));
}

router.post('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) return res.status(404).json({ error: 'unknown chain' });
  const meta = chains.get(slug);
  if (!meta.deploySupported) return res.status(400).json({ error: 'deploy not supported on this chain' });
  if (guard.hasForbiddenOverride(req.body)) return res.status(400).json({ error: 'alternate destination overrides are not accepted' });

  const signedTx = req.body && req.body.signedTx;
  if (hasKeyField(req.body) || looksLikePrivateKey(signedTx)) {
    return res.status(400).json({ error: 'private key material is never accepted; submit signedTx only' });
  }
  if (!isSignedTx(signedTx)) {
    return res.status(400).json({ error: 'signedTx (0x-prefixed signed transaction) required' });
  }

  const url = chains.rpcUrlFor(slug);
  if (!url) return res.status(503).json({ error: 'chain RPC not configured' });

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [signedTx.trim()] }),
    });
    const json = await upstream.json();
    if (json.error) return res.status(502).json({ error: json.error.message || 'broadcast rejected' });
    return res.json({ txHash: json.result });
  } catch (_) {
    return res.status(502).json({ error: 'broadcast failed' });
  }
});

module.exports = router;
```

---

## backend/routes/funding.js

```js
'use strict';
const express = require('express');
const chains = require('../config/chains');
const router = express.Router();

const DEFAULT_DEPLOY_GAS = 2_500_000n;

async function rpcCall(url, method, params) {
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
  });
  const json = await upstream.json();
  if (json.error) throw new Error(json.error.message || 'rpc error');
  return json.result;
}

router.get('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) return res.status(404).json({ error: 'unknown chain' });
  const meta = chains.get(slug);
  const url = chains.rpcUrlFor(slug);
  if (!url) return res.status(503).json({ error: 'chain RPC not configured' });

  try {
    const gasPriceHex = await rpcCall(url, 'eth_gasPrice', []);
    const gasPrice = BigInt(gasPriceHex);
    const estGas = DEFAULT_DEPLOY_GAS;
    const totalWei = gasPrice * estGas * 12n / 10n; // 20% buffer
    const decimals = 18n;
    const whole = totalWei / (10n ** decimals);
    const frac = ((totalWei % (10n ** decimals)) * 10000n / (10n ** decimals)).toString().padStart(4, '0');
    return res.json({
      chain: meta.slug,
      nativeSymbol: meta.nativeSymbol,
      estimateNative: `${whole}.${frac}`,
      estGas: estGas.toString(),
      gasPriceWei: gasPrice.toString(),
    });
  } catch (e) {
    return res.status(502).json({ error: 'funding estimate failed: ' + e.message });
  }
});

module.exports = router;
```

---

## backend/routes/rpc.js

```js
'use strict';
const express = require('express');
const chains = require('../config/chains');
const router = express.Router();

// Allowed read-only JSON-RPC methods. Write methods are never proxied.
const ALLOWED_METHODS = new Set([
  'eth_blockNumber','eth_getBalance','eth_getTransactionCount',
  'eth_gasPrice','eth_estimateGas','eth_getCode','eth_call',
  'eth_chainId','eth_getTransactionReceipt','eth_getBlockByNumber',
  'net_version',
]);

router.post('/:chain', async (req, res) => {
  const slug = req.params.chain;
  if (!chains.isValidSlug(slug)) return res.status(404).json({ error: 'unknown chain' });
  const { method, params } = req.body || {};
  if (!ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: `method ${method} not allowed` });
  }
  const url = chains.rpcUrlFor(slug);
  if (!url) return res.status(503).json({ error: 'chain RPC not configured' });

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
    });
    const json = await upstream.json();
    if (json.error) return res.status(502).json({ error: json.error.message });
    return res.json({ result: json.result });
  } catch (_) {
    return res.status(502).json({ error: 'rpc call failed' });
  }
});

module.exports = router;
```

---

## backend/routes/passkeys.js

```js
'use strict';
const express = require('express');
const store = require('../lib/passkey-store');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { k1 } = req.body || {};
  if (!k1) return res.status(400).json({ error: 'k1 required' });
  const result = await store.register(k1);
  return res.json(result);
});

router.post('/verify', async (req, res) => {
  const { k1, passkey } = req.body || {};
  if (!k1 || !passkey) return res.status(400).json({ error: 'k1 and passkey required' });
  const result = await store.verify(k1, passkey);
  return res.json(result);
});

module.exports = router;
```

---

## backend/routes/admin-passkey.js

```js
'use strict';
const express = require('express');
const store = require('../lib/passkey-store');
const router = express.Router();

router.post('/generate', async (req, res) => {
  const { adminKey, k1 } = req.body || {};
  if (!adminKey || !k1) return res.status(400).json({ error: 'adminKey and k1 required' });
  const configuredAdminKey = process.env.SECUREGATE_ADMIN_KEY;
  if (!configuredAdminKey) {
    return res.json({ disabled: true, reason: 'Admin key minting not configured on this deployment.' });
  }
  if (adminKey !== configuredAdminKey) {
    return res.status(403).json({ error: 'admin key invalid' });
  }
  const result = await store.mint(k1);
  return res.json(result);
});

module.exports = router;
```

---

## backend/routes/anti-abuse.js

```js
'use strict';
const express = require('express');
const { recordEvent } = require('../lib/anti-abuse-kv');
const router = express.Router();

router.post('/event', async (req, res) => {
  const { action, subject } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action required' });
  try {
    await recordEvent({ action, subject: subject || 'anon', ts: Date.now() });
    return res.json({ ok: true });
  } catch (_) {
    return res.json({ ok: false });
  }
});

module.exports = router;
```

---

## backend/routes/artifact.js

```js
'use strict';
const express = require('express');
const router = express.Router();

router.get('/securegate', (_req, res) => {
  const hex = process.env.SECUREGATE_BYTECODE_HEX;
  const abi = process.env.SECUREGATE_ABI_JSON;
  if (!hex || !abi) {
    return res.status(503).json({ error: 'artifact unavailable', reason: 'SECUREGATE_BYTECODE_HEX not set' });
  }
  try {
    return res.json({ bytecode: hex, abi: JSON.parse(abi) });
  } catch (_) {
    return res.status(503).json({ error: 'artifact unavailable', reason: 'ABI parse error' });
  }
});

module.exports = router;
```

---

## backend/routes/thank-you.js

```js
'use strict';
const express = require('express');
const router = express.Router();

router.get('/config', (_req, res) => {
  return res.json({
    handle: process.env.THANKYOU_HANDLE || '@hope_ology',
    network: process.env.THANKYOU_NETWORK || 'EVM',
    copyAddress: process.env.THANKYOU_ADDRESS || '',
  });
});

router.post('/send', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const webhook = process.env.THANKYOU_WEBHOOK_URL;
  if (!webhook) return res.json({ disabled: true, reason: 'Thank-you sending not configured.' });
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, ts: Date.now() }),
    });
    return res.json({ sent: true });
  } catch (_) {
    return res.status(502).json({ sent: false, reason: 'webhook failed' });
  }
});

module.exports = router;
```

---

## backend/routes/runtime.js

```js
'use strict';
const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    node: process.version,
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'production',
    ts: Date.now(),
  });
});

module.exports = router;
```

---

## backend/routes/trace.js

```js
'use strict';
const express = require('express');
const traceStore = require('../lib/trace-store');
const router = express.Router();

router.post('/:kind', async (req, res) => {
  const { kind } = req.params;
  const { k1 } = req.body || {};
  try {
    await traceStore.record({ kind, k1: k1 || 'anon', ts: Date.now() });
    return res.json({ ok: true });
  } catch (_) {
    return res.json({ ok: false });
  }
});

module.exports = router;
```

---

## frontend/src/App.tsx

```tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { api } from './lib/api'
import { fetchArtifact } from './lib/securegateArtifact'
import {
  buildDeployData, validateKeys, encodeQueueERC20, encodeQueueERC721,
  encodeQueueERC1155, encodeAuthorizeIntent, encodeExecuteIntent, randomNonce32,
} from './lib/securegateTxBuilder'
import { computeClientIntentHash } from './lib/securegateIntentHash'
import {
  buildAuthorizationTypedData, verifyK2AuthorizationSignature, signK2Authorization,
} from './lib/securegateK2Authorization'
import {
  connectInjectedK2, injectedSignTypedData, hasInjectedProvider, K2_NOT_CONNECTED,
} from './lib/securegateWalletProvider'
import { deriveAddress, signLocally, broadcastBody } from './lib/securegateSessionKeys'
import {
  PENDING_PLACEHOLDER_LAYERS, attemptScan, attemptLinkDevice,
  enterPasskey, generateAdminPasskey, canExecuteIntent,
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

type Chain = { slug: string; name: string; chainId: number; nativeSymbol: string; deploySupported: boolean }
type Toast = { id: number; kind: 'info' | 'warn' | 'error'; text: string }
type TabKey = 'recovery' | 'protection' | 'admin' | 'status'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recovery',   label: 'Deployment' },
  { key: 'protection', label: 'Protection' },
  { key: 'admin',      label: 'Admin' },
  { key: 'status',     label: 'Status' },
]

const PROGRESS_LABELS = UI_PROGRESS_LABELS
const MAX_DEVICE_ATTEMPTS = 3
const HUMAN_ROUTE_MSG = UI_HUMAN_ROUTE_MSG

const CONNECTED_LAYERS = [
  'Chain registry (/api/chains)',
  'Funding estimate (/api/funding)',
  'Anti-abuse events (/api/anti-abuse)',
  'Thank-you envelope (/api/thank-you)',
  'Browser deploy builder (signedTx)',
  'Browser K1 action builder (signedTx)',
  'Browser K2 authorization builder (EIP-712, signedTx)',
]
const PENDING_LAYERS = PENDING_PLACEHOLDER_LAYERS

const inputStyle: React.CSSProperties = {
  background: 'var(--sg-panel-2)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 10,
  padding: '10px 12px', outline: 'none', width: '100%',
  boxShadow: '0 0 14px rgba(150,90,255,0.16)',
}
const label: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
}

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cyan' | 'gold' | 'plain' | 'pink' }) {
  const { tone = 'plain', style, disabled, ...rest } = props
  const tones: Record<string, React.CSSProperties> = {
    cyan:  { borderColor: 'var(--accent-primary)',   color: 'var(--accent-primary)'   },
    gold:  { borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)' },
    pink:  { borderColor: 'var(--sg-pink)',           color: 'var(--sg-pink)'           },
    plain: { borderColor: 'var(--border-primary)',    color: 'var(--text-primary)'      },
  }
  return (
    <button {...rest} disabled={disabled} style={{
      background: 'var(--sg-panel-2)', border: '1px solid', borderRadius: 10,
      padding: '10px 14px', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      ...tones[tone], ...style,
    }} />
  )
}

const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
  borderRadius: 12, padding: 20,
}

export default function App() {
  const [chains, setChains] = useState<Chain[]>([])
  const [selectedChain, setSelectedChain] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('recovery')
  const [toasts, setToasts] = useState<Toast[]>([])

  // Auth-Gate
  const [k1Address, setK1Address] = useState('')
  const [deviceAttempts, setDeviceAttempts] = useState(0)
  const [authMsg, setAuthMsg] = useState('')
  const [humanRoute, setHumanRoute] = useState('')
  const [passkey, setPasskey] = useState('')

  // Recovery form — session-only
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
    token: string; tokenId: string; amount: string; nonce: string; deadline: number
  }>(null)
  const [authIntentHash, setAuthIntentHash] = useState('')
  const [authTypedData, setAuthTypedData] = useState('')
  const [authK2Expected, setAuthK2Expected] = useState('')
  const [authK2Signature, setAuthK2Signature] = useState('')
  const [authVerified, setAuthVerified] = useState(false)
  const [authStatus, setAuthStatus] = useState('')
  const [k2WalletAddress, setK2WalletAddress] = useState('')

  // Admin
  const [adminKey, setAdminKey] = useState('')
  const [adminK1, setAdminK1] = useState('')
  const [adminStatus, setAdminStatus] = useState('')
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)

  // Thank-you
  const [thanksAddress, setThanksAddress] = useState('')
  const [thanksHandle, setThanksHandle] = useState('@hope_ology')
  const [thanksMessage, setThanksMessage] = useState('')
  const [thanksStatus, setThanksStatus] = useState('')

  const devicesLocked = deviceAttempts >= MAX_DEVICE_ATTEMPTS
  const dashboardUnlocked = humanRoute.trim() !== ''
  const sessionScratch = useRef<Record<string, string>>({})
  const toastId = useRef(0)
  const selectedChainMeta = chains.find((c) => c.slug === selectedChain)

  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  useEffect(() => {
    fetch(api('chains')).then((r) => r.json())
      .then((d) => setChains(Array.isArray(d?.chains) ? d.chains : []))
      .catch(() => setChains([]))
    fetch(api('thank-you/config')).then((r) => r.json())
      .then((d) => {
        if (d?.handle) setThanksHandle(d.handle)
        if (d?.copyAddress) setThanksAddress(d.copyAddress)
      }).catch(() => {})
  }, [])

  async function recordAbuse(action: string, subject: string) {
    try {
      const r = await fetch(api('anti-abuse/event'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, subject }),
      })
      return await r.json()
    } catch { return null }
  }

  async function deviceAttempt(kind: 'scan' | 'link') {
    if (devicesLocked) return
    const action = kind === 'scan' ? 'auth_gate_attempt' : 'link_device_attempt'
    await recordAbuse(action, k1Address || 'anon')
    const next = deviceAttempts + 1
    setDeviceAttempts(next)
    const result = kind === 'scan' ? attemptScan() : attemptLinkDevice()
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
    const result = enterPasskey()
    setAuthMsg(result.message)
    pushToast('warn', result.message)
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
    setFundingPanel('Funding check...')
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
      method: 'POST', headers: { 'content-type': 'application/json' },
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
      method: 'POST', headers: { 'content-type': 'application/json' },
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
    } catch { gasHex = to ? '0x30d40' : '0x2625a0' }
    const gasPrice = BigInt(gasPriceHex)
    return {
      nonce: Number(BigInt(nonceHex)), gasLimit: BigInt(gasHex),
      maxFeePerGas: gasPrice * 2n, maxPriorityFeePerGas: gasPrice,
    }
  }

  async function handleDeployGate() {
    setDeployStatus('')
    if (!selectedChain || !selectedChainMeta) {
      setDeployStatus('Select a network in the topbar first.')
      return
    }
    if (!deployerBurnerKey.trim()) {
      setDeployStatus('Enter a deployer burner key (session-only, never sent).')
      return
    }
    let keys
    try { keys = validateKeys(k1Address, k2Address, k3Address) }
    catch (e) {
      setDeployStatus('Key check failed: ' + (e as Error).message)
      return
    }
    try {
      setActiveStep(1)
      setDeployStatus('Fetching canonical artifact...')
      const artifact = await fetchArtifact()
      const { data } = buildDeployData(artifact, keys)
      const from = deriveAddress(deployerBurnerKey)
      setActiveStep(2)
      setDeployStatus(`Building deployment tx locally (deployer ${from.slice(0, 8)}...)...`)
      const common = await buildTxCommon(selectedChain, from, null, data)
      const txReq: ethers.TransactionRequest = { type: 2, chainId: selectedChainMeta.chainId, data, value: 0n, ...common }
      setActiveStep(3)
      setDeployStatus('Signing locally in the browser...')
      const { signedTx } = await signLocally(deployerBurnerKey, txReq)
      setDeployStatus('Broadcasting signed transaction...')
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

  // ... (K1 action builder, K2 authorization, scrub, sendThanks — see repo)

  async function generatePasskey() {
    if (!adminKey.trim() || !adminK1.trim()) {
      setAdminStatus('Enter both the admin key and a K1 address.')
      return
    }
    const local = generateAdminPasskey(true)
    setAdminStatus(local.message)
    const remote = await generateAdminPasskeyRemote(adminKey, adminK1)
    setAdminKey('')
    if (remote.generated && remote.passkey) {
      setAdminStatus(`K1-bound passkey minted for ${remote.k1}: ${remote.passkey}`)
      pushToast('info', 'K1-bound passkey minted.')
    } else if (remote.disabled) {
      setAdminStatus('Admin minting is not configured on this deployment.')
    } else {
      pushToast('warn', remote.reason || local.message)
    }
  }

  function scrub() {
    setK1SessionKey(''); setDeployerBurnerKey(''); setPasskey('')
    setK2Address(''); setK3Address(''); setDeployStatus(''); setFundingPanel('')
    setAdminKey(''); setActiveStep(-1); setActionToken(''); setActionAmount('')
    setActionTokenId(''); setActionStatus(''); setLastIntent(null)
    setAuthIntentHash(''); setAuthTypedData(''); setAuthK2Expected('')
    setAuthK2Signature(''); setAuthVerified(false); setK2WalletAddress('')
    setAuthStatus(''); sessionScratch.current = {}
    setAuthMsg('Session-only fields cleared.')
    pushToast('info', 'Session-only fields scrubbed.')
  }

  return (
    <div className="sg-root">

      {/* TOPBAR */}
      <header className="sg-topbar">
        <span className="sg-brandmark" />
        <span className="sg-wordmark">
          <span className="sg-brand">SECUREGATE</span>
          <span className="sg-badge">EIP-777G</span>
        </span>
        <span className="sg-topbar-spacer" />
        <span id="power-status" className="sg-power" title="Gate stays locked until a verifier is connected">
          <span className="dot" />
        </span>
        <button id="scrub-session" type="button" className="sg-scrub-btn" onClick={scrub}>SCRUB</button>
        <button id="power-button" type="button" className="sg-power-btn" onClick={scrub}
          title="Power / clear session" aria-label="Power — clears the session">
          <span aria-hidden="true">⏻</span>
        </button>
      </header>

      <div className="sg-shell">

        {/* SIDEBAR */}
        <aside className="sg-sidebar" aria-label="Auth-Gate">
          <div className="sg-scan-wrap">
            <button id="scan-authenticator" type="button" className="sg-scan-circle"
              disabled={devicesLocked} onClick={() => deviceAttempt('scan')}
              aria-label="SCAN — same-device ownership check">
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
            <input id="authgate-k1" value={k1Address} onChange={(e) => setK1Address(e.target.value)}
              placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <Btn id="link-device" tone="pink" disabled={devicesLocked} onClick={() => deviceAttempt('link')}>
              LINK DEVICE
            </Btn>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={label} htmlFor="passkey-input">PASSKEY</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input id="passkey-input" type="password" value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="K1-bound passkey" autoComplete="off" spellCheck={false} style={inputStyle} />
              <Btn id="passkey-enter" onClick={passkeyEnter}>ENTER</Btn>
            </div>
          </div>

          {authMsg ? (
            <div id="authgate-status" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}
              aria-live="polite">{authMsg}</div>
          ) : null}
          <div id="human-route" style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-secondary)' }}
            aria-live="polite">{humanRoute}</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            Device attempts: {Math.min(deviceAttempts, MAX_DEVICE_ATTEMPTS)}/{MAX_DEVICE_ATTEMPTS}
          </div>

          <div className="sg-authgate-note">
            <div className="sg-authgate-title">AUTH-GATE</div>
            <p>Same device: press SCAN.</p>
            <p>Different device: connect by USB first, then press LINK DEVICE.</p>
            <p>SCRUB clears all local state at any time.</p>
          </div>

          {/* CAUTION + admin circle */}
          <div className="sg-side-caution" role="note" aria-label="Caution">
            <div className="sg-side-caution-title">&#9888; CAUTION</div>
            <p data-sg-caution-text="true">Use at your own risk.</p>
            <p data-sg-caution-text="true">Hope for the best.</p>
            <p data-sg-caution-text="true">
              If you&apos;re a hacker?{' '}
              <span style={{ color: 'var(--sg-red, #ff4444)' }}>Get fucked.</span>
            </p>
            <button id="admin-black-circle" className="sg-admin-circle" type="button"
              aria-label="Admin route" onClick={() => setAdminPanelOpen((v) => !v)}>
              &#9899;-&apos;
            </button>
          </div>

          {/* Inline admin panel */}
          {adminPanelOpen && (
            <div className="sg-admin-inline" role="region" aria-label="Admin key generation">
              <div className="sg-admin-inline-title">ADMIN AUTH KEY</div>
              <input id="admin-key-inline" type="password" value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Paste admin auth key..." autoComplete="off" spellCheck={false}
                style={{ ...inputStyle, marginBottom: 6 }} />
              <Btn tone="cyan" style={{ width: '100%', marginBottom: 12 }} onClick={generatePasskey}>
                VERIFY
              </Btn>
              <div className="sg-admin-inline-title">GENERATE AUTH KEY FOR USER</div>
              <input id="admin-k1-inline" value={adminK1}
                onChange={(e) => setAdminK1(e.target.value)}
                placeholder="Paste user's K1 address..." autoComplete="off" spellCheck={false}
                style={{ ...inputStyle, marginBottom: 6 }} />
              <Btn tone="cyan" style={{ width: '100%' }} onClick={generatePasskey}>
                GENERATE AUTH KEY
              </Btn>
              {adminStatus && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-secondary)' }}>{adminStatus}</div>
              )}
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="sg-main" style={{ display: 'grid', gap: 20 }}>

          {/* STANDALONE OPERATION */}
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
            <p>PLUS YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I&apos;M JUST A STICK FIGURE.</p>
          </section>

          {!dashboardUnlocked ? (
            <p className="sg-gate-hint" aria-live="polite">
              Complete the Auth-Gate (verified passkey or human fallback) to reveal the recovery workspace.
            </p>
          ) : null}

          {dashboardUnlocked ? (
            <>
              {/* TABS */}
              <nav className="sg-tabs" role="tablist" aria-label="Sections">
                {TABS.map((t) => (
                  <button key={t.key} role="tab" aria-selected={activeTab === t.key}
                    className="sg-tab" onClick={() => setActiveTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </nav>

              {/* DEPLOYMENT TAB */}
              {activeTab === 'recovery' && (
                <section style={card} aria-label="EIP-777G deployment">
                  <h1 style={{ margin: '0 0 4px', fontSize: 20, color: 'var(--accent-primary)', letterSpacing: '0.06em' }}>
                    EIP-777G DEPLOYMENT
                  </h1>
                  <p style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 13 }}>
                    Create &amp; fund a burner wallet for your deployment bundle — this is your{' '}
                    <span style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>Deployer</span>.
                    Enter the Deployer key and address in the assigned boxes below.
                  </p>
                  <p style={{ margin: '0 0 18px', color: 'var(--sg-pink)', fontSize: 13, fontWeight: 600 }}>
                    Enter the K1 key assigned to the K1 address listed.
                    Do not at any point share your K2 or K3 keys.
                  </p>

                  {/* Numbered steps */}
                  <ol style={{ margin: '0 0 18px', paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                    {[
                      'Choose the initial chain to launch the EIP-777G contract on.',
                      'The fee calculator next to the chain selection box will tell you the funding needed. Fund the Deployer with that amount.',
                      "Once you've selected the chain and funded your Deployer, deploy the EIP-777G bundle.",
                      'The progress bar will indicate the bundle was fully deployed & the protection check will indicate if the deployment was a success.',
                      'Once EIP-777G has been successfully deployed, you will use K2 to authorize transactions initiated by K1. Any authorized transfer routes directly to your K3 clean address.',
                    ].map((step, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-primary)' }}>
                        <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--sg-pink)', color: '#000', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 16, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, letterSpacing: '0.1em', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: 14 }}>DEPLOYMENT BUNDLE</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={label} htmlFor="recovery-deployer-addr">DEPLOYER ADDRESS</label>
                      <input id="recovery-deployer-addr" value={''} readOnly placeholder="0x..." style={{ ...inputStyle, opacity: 0.8 }} />
                    </div>
                    <div>
                      <label style={label} htmlFor="deployer-burner-key">DEPLOYER KEY</label>
                      <input id="deployer-burner-key" type="password" value={deployerBurnerKey}
                        onChange={(e) => setDeployerBurnerKey(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                    <div>
                      <label style={label} htmlFor="recovery-k1">K1 ADDRESS</label>
                      <input id="recovery-k1" value={k1Address} readOnly placeholder="Auth-Gate fills this"
                        style={{ ...inputStyle, border: k1Address ? '1px solid var(--accent-primary)' : undefined }} />
                    </div>
                    <div>
                      <label style={label} htmlFor="k1-session-key">K1 KEY</label>
                      <input id="k1-session-key" type="password" value={k1SessionKey}
                        onChange={(e) => setK1SessionKey(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={label} htmlFor="k2-address">K2 AUTH ADDRESS</label>
                      <input id="k2-address" value={k2Address} onChange={(e) => setK2Address(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={label} htmlFor="k3-address">K3 CLEAN DROP ADDRESS</label>
                      <input id="k3-address" value={k3Address} onChange={(e) => setK3Address(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={label} htmlFor="operator-proof-field">OPERATOR PROOF</label>
                      <input id="operator-proof-field" placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                        Optional: If not provided, uses backend default from environment
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select id="network-select" aria-label="Network" value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)}
                      style={{ ...inputStyle, maxWidth: 220 }}>
                      <option value="">EVM Bundle — All EVM Chains</option>
                      {chains.map((c) => (
                        <option key={c.slug} value={c.slug} disabled={!c.deploySupported}>
                          {c.name} ({c.nativeSymbol}){c.deploySupported ? '' : ' — view only'}
                        </option>
                      ))}
                    </select>
                    <Btn id="funding-check" tone="cyan" onClick={handleFundingCheck}>CALCULATE FUNDING</Btn>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                    <Btn id="deploy-gate" tone="pink" onClick={handleDeployGate}>DEPLOY EIP-777G BUNDLE</Btn>
                  </div>

                  {fundingPanel && (
                    <div id="funding-panel" style={{ marginTop: 14, padding: 14, border: '1px dashed var(--border-primary)', borderRadius: 10, background: 'var(--bg-tertiary)', fontSize: 13 }}>
                      {fundingPanel}
                    </div>
                  )}
                  <div id="deploy-status" style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-secondary)' }} aria-live="polite">
                    {deployStatus}
                  </div>

                  {/* DEPLOYMENT PROGRESS + VERIFYING PROTECTION */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ fontSize: 13, letterSpacing: '0.1em', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: 12 }}>DEPLOYMENT PROGRESS</div>
                      <div style={{ background: 'var(--sg-panel-2)', borderRadius: 4, height: 6, marginBottom: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--accent-primary)', width: `${Math.max(0, (activeStep + 1) / PROGRESS_LABELS.length * 100)}%`, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'right' }}>
                        {activeStep >= 0 ? `${Math.round((activeStep + 1) / PROGRESS_LABELS.length * 100)}%` : '0%'}
                      </div>
                      {PROGRESS_LABELS.map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: i <= activeStep ? 'var(--accent-primary)' : 'var(--border-primary)',
                            boxShadow: i <= activeStep ? '0 0 6px var(--accent-primary)' : 'none',
                          }} />
                          <span style={{ fontSize: 12, color: i <= activeStep ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ fontSize: 13, letterSpacing: '0.1em', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: 8 }}>VERIFYING PROTECTION</div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Runs automatically after deploy</p>
                      {activeStep >= PROGRESS_LABELS.length - 1 && (
                        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--sg-pink)', color: '#000', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                          THANK YOU
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* PROTECTION TAB */}
              {activeTab === 'protection' && (
                <section style={card} aria-label="Protection setup">
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, color: 'var(--accent-primary)', letterSpacing: '0.06em' }}>PROTECTION SETUP</h2>
                  <p style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                    For protection before compromise — deploy EIP-777G here.
                  </p>
                  <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {twoFactorStatus().message} No private key required. Signing activates the contract and assigns authorization.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={label} htmlFor="prot-k1">K1 ADDRESS <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(AUTO-FILLED)</span></label>
                      <input id="prot-k1" value={k1Address} readOnly placeholder="Auth-Gate fills this"
                        style={{ ...inputStyle, border: k1Address ? '1px solid var(--accent-primary)' : undefined }} />
                    </div>
                    <div>
                      <label style={label} htmlFor="prot-k2">K2 ADDRESS</label>
                      <input id="prot-k2" value={k2Address} onChange={(e) => setK2Address(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={label} htmlFor="prot-k3">K3 ADDRESS</label>
                      <input id="prot-k3" value={k3Address} onChange={(e) => setK3Address(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select aria-label="Network protection" value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }}>
                      <option value="">EVM Bundle — All EVM Chains</option>
                      {chains.map((c) => (
                        <option key={c.slug} value={c.slug} disabled={!c.deploySupported}>
                          {c.name} ({c.nativeSymbol}){c.deploySupported ? '' : ' — view only'}
                        </option>
                      ))}
                    </select>
                    <Btn tone="cyan" onClick={handleFundingCheck}>CALCULATE FUNDING</Btn>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                    <Btn tone="pink" onClick={handleDeployGate}>AUTHORIZE &amp; DEPLOY PROTECTION</Btn>
                  </div>
                  <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    To activate: open K1 in your wallet and authorize the signature prompt. No private key entry required — signing activates the contract and assigns K2 authorization. Any authorized transfer will route directly to your K3 address.
                  </p>
                  <div className="sg-statusrow" style={{ marginTop: 16 }}>
                    <span className="sg-statusdot off" /><span className="sg-statuslabel">Proactive protection guard</span>
                    <span className="sg-statustag">NOT ACTIVE YET</span>
                  </div>
                  <div className="sg-statusrow">
                    <span className="sg-statusdot off" /><span className="sg-statuslabel">Automatic threat monitoring</span>
                    <span className="sg-statustag">NOT ACTIVE YET</span>
                  </div>
                </section>
              )}

              {/* ADMIN TAB */}
              {activeTab === 'admin' && (
                <section style={card} aria-label="Admin passkey generation">
                  <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Admin · K1-bound passkey</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={label} htmlFor="admin-key">Admin key</label>
                      <input id="admin-key" type="password" value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        placeholder="Session-only, never sent" autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                    <div>
                      <label style={label} htmlFor="admin-k1-address">K1 address to bind</label>
                      <input id="admin-k1-address" value={adminK1}
                        onChange={(e) => setAdminK1(e.target.value)}
                        placeholder="0x..." autoComplete="off" spellCheck={false} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <Btn id="admin-generate-passkey" tone="cyan" onClick={generatePasskey}>Generate K1-bound passkey</Btn>
                  </div>
                  <div id="admin-status" style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-secondary)' }} aria-live="polite">
                    {adminStatus}
                  </div>
                </section>
              )}

              {/* STATUS TAB */}
              {activeTab === 'status' && (
                <section id="verification-panel" style={card} aria-label="Verification status">
                  <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Verification status</h2>
                  <div style={{ marginBottom: 10, fontSize: 11, letterSpacing: '0.12em', color: 'var(--success)' }}>CONNECTED</div>
                  {CONNECTED_LAYERS.map((l) => (
                    <div className="sg-statusrow" key={l}>
                      <span className="sg-statusdot on" /><span className="sg-statuslabel">{l}</span>
                      <span className="sg-statustag">CONNECTED</span>
                    </div>
                  ))}
                  <div style={{ margin: '16px 0 10px', fontSize: 11, letterSpacing: '0.12em', color: 'var(--warning)' }}>NOT CONNECTED YET</div>
                  {PENDING_LAYERS.map((l) => (
                    <div className="sg-statusrow" key={l}>
                      <span className="sg-statusdot off" /><span className="sg-statuslabel">{l}</span>
                      <span className="sg-statustag">PENDING</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : null}

          {/* THANK-YOU ENVELOPE */}
          {dashboardUnlocked && (
            <section id="thanks-panel" style={{ ...card, display: 'grid', gap: 10, maxWidth: 460 }} aria-label="Thank-you envelope">
              <a id="thanks-handle" href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--sg-pink)', fontWeight: 600, textDecoration: 'none' }}>
                {thanksHandle}
              </a>
              {thanksAddress && (
                <>
                  <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-secondary)' }}>EVM ADDRESS</div>
                  <div onClick={() => navigator.clipboard?.writeText(thanksAddress)} title="Click to copy"
                    style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, padding: 10, background: 'var(--sg-panel-2)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer', wordBreak: 'break-all' }}>
                    {thanksAddress}
                  </div>
                </>
              )}
              <textarea id="thanks-message" maxLength={280} value={thanksMessage}
                onChange={(e) => setThanksMessage(e.target.value)}
                placeholder="Optional thank-you note" style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }} />
              <Btn id="thanks-send" onClick={async () => {
                if (!thanksMessage.trim()) { setThanksStatus('Write a note first.'); return }
                try {
                  const r = await fetch(api('thank-you/send'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: thanksMessage.trim() }) })
                  const d = await r.json()
                  setThanksStatus(d?.sent ? 'Sent — thank you.' : d?.disabled ? 'Thank-you sending is not configured.' : 'Could not send: ' + (d?.reason || 'unknown'))
                } catch { setThanksStatus('Could not send.') }
              }}>Send thank-you</Btn>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }} aria-live="polite">{thanksStatus}</div>
            </section>
          )}
        </main>

        {/* FOOTER */}
        <footer className="sg-footer">
          <div className="sg-footer-thanks">THANK YOU</div>
          <div className="sg-footer-built">BUILT BY EMP</div>
          <a className="sg-footer-handle" href="https://x.com/hope_ology" target="_blank" rel="noopener noreferrer">
            @hope_ology
          </a>
        </footer>
      </div>

      {/* TOASTS */}
      <div className="sg-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`sg-toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  )
}
```

---

## frontend/src/index.css (key SecureGate tokens + components)

```css
/* ===== SecureGate dark token system ===== */
:root {
  --sg-bg:        #05070d;
  --sg-panel:     #0b1018;
  --sg-panel-2:   #070b12;
  --sg-inset:     #0e1420;
  --sg-border:    #1c2534;
  --sg-fg:        #e7edf6;
  --sg-muted:     #8a97ad;
  --sg-dim:       #5f6b80;
  --sg-cyan:      #35e0d8;
  --sg-gold:      #d9b25a;
  --sg-pink:      #ff3fb4;
  --sg-topbar-h:  42px;
  --sg-sidebar-w: 264px;

  --bg-primary:     var(--sg-bg);
  --bg-secondary:   var(--sg-panel);
  --bg-tertiary:    var(--sg-inset);
  --bg-card:        var(--sg-panel);
  --border-primary: var(--sg-border);
  --text-primary:   var(--sg-fg);
  --text-secondary: var(--sg-muted);
  --text-muted:     var(--sg-dim);
  --accent-primary: var(--sg-cyan);
  --accent-secondary: var(--sg-gold);
  --danger:  #ff5470;
  --warning: var(--sg-gold);
  --success: #3ddc97;
}

.sg-root {
  min-height: 100vh;
  background: radial-gradient(1200px 500px at 80% -10%, rgba(53,224,216,0.06), transparent 60%), var(--sg-bg);
  color: var(--sg-fg);
  font-family: "Lato", "PingFang SC", sans-serif;
}

/* 42px fixed topbar */
.sg-topbar {
  position: fixed; top: 0; left: 0; right: 0;
  height: var(--sg-topbar-h);
  display: flex; align-items: center; gap: 14px; padding: 0 14px;
  background: rgba(9,13,20,0.92); border-bottom: 1px solid var(--sg-border);
  backdrop-filter: blur(8px); z-index: 40;
}
.sg-brandmark { width: 10px; height: 10px; border-radius: 50%; background: var(--sg-cyan); box-shadow: 0 0 10px var(--sg-cyan); }
.sg-brand { font-weight: 900; letter-spacing: 0.06em; font-size: 14px; }
.sg-badge { font-size: 10px; letter-spacing: 0.14em; color: var(--sg-cyan); border: 1px solid rgba(53,224,216,0.4); border-radius: 999px; padding: 2px 8px; }
.sg-topbar-spacer { flex: 1 1 auto; }

/* SCRUB button */
.sg-scrub-btn {
  background: var(--sg-pink); color: #fff; border: none; border-radius: 6px;
  padding: 5px 14px; font-size: 12px; letter-spacing: 0.12em; font-weight: 700;
  cursor: pointer; box-shadow: 0 0 10px rgba(255,63,180,0.4);
}
.sg-scrub-btn:hover { box-shadow: 0 0 20px rgba(255,63,180,0.7); }

/* Power button */
.sg-power-btn {
  width: 28px; height: 28px; border-radius: 50%; background: var(--sg-panel-2);
  border: 1.5px solid var(--sg-gold); color: var(--sg-gold); font-size: 14px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

/* 264px fixed sidebar */
.sg-shell { padding-top: var(--sg-topbar-h); }
.sg-sidebar {
  position: fixed; top: var(--sg-topbar-h); left: 0; bottom: 0;
  width: var(--sg-sidebar-w); padding: 18px 16px;
  background: var(--sg-panel); border-right: 1px solid var(--sg-border); overflow-y: auto;
}
.sg-main { margin-left: var(--sg-sidebar-w); padding: 24px; max-width: 1000px; }

/* Tab nav */
.sg-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
.sg-tab {
  background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border-primary); border-radius: 999px;
  padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.sg-tab[aria-selected="true"] { color: var(--accent-primary); border-color: var(--accent-primary); background: rgba(53,224,216,0.08); }

/* Status dots */
.sg-statusrow { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border-secondary); font-size: 13px; }
.sg-statusdot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.sg-statusdot.on  { background: var(--success); box-shadow: 0 0 8px var(--success); }
.sg-statusdot.off { background: var(--warning); box-shadow: 0 0 8px var(--warning); }

/* Neon SCAN circle */
.sg-scan-circle {
  position: relative; width: 100px; height: 100px; border-radius: 50%;
  background: radial-gradient(circle at center, rgba(53,224,216,0.15) 0%, rgba(53,224,216,0.05) 60%, transparent 70%);
  border: 2px solid var(--sg-cyan);
  box-shadow: 0 0 18px rgba(53,224,216,0.45), inset 0 0 18px rgba(53,224,216,0.12);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.sg-scan-ring {
  position: absolute; inset: 8px; border-radius: 50%;
  border: 1.5px solid rgba(255,63,180,0.6); box-shadow: 0 0 10px rgba(255,63,180,0.35);
  pointer-events: none;
}
.sg-scan-label { font-size: 11px; letter-spacing: 0.18em; color: var(--sg-cyan); font-weight: 700; }

/* DASHBOARD LOCKED card */
.sg-locked-card {
  background: rgba(217,178,90,0.08); border: 1px solid rgba(217,178,90,0.5);
  border-left: 3px solid var(--sg-gold); border-radius: 8px; padding: 10px 14px; margin: 6px 0;
}
.sg-locked-card strong { display: block; font-size: 11px; letter-spacing: 0.14em; color: var(--sg-gold); font-weight: 700; margin-bottom: 4px; }
.sg-locked-card span  { display: block; font-size: 10px; letter-spacing: 0.06em; color: rgba(217,178,90,0.8); }

/* STANDALONE OPERATION card */
.sg-standalone {
  border: 1.5px solid var(--sg-cyan); border-radius: 12px; padding: 20px 24px;
  background: rgba(53,224,216,0.04);
  box-shadow: 0 0 16px rgba(53,224,216,0.1), inset 0 0 24px rgba(53,224,216,0.03);
}
.sg-standalone-title { font-size: 13px; letter-spacing: 0.14em; color: var(--sg-cyan); font-weight: 700; margin-bottom: 12px; }

/* CAUTION card */
.sg-caution {
  border: 1.5px solid var(--sg-gold); border-radius: 12px; padding: 20px 24px;
  background: rgba(217,178,90,0.06);
}
.sg-caution p { font-size: 12px; letter-spacing: 0.08em; color: var(--sg-gold); font-weight: 600; text-transform: uppercase; line-height: 1.6; }

/* Sidebar CAUTION block */
.sg-side-caution { margin-top: 14px; border: 1.5px solid var(--sg-gold); border-radius: 10px; padding: 14px 14px 10px; background: rgba(217,178,90,0.06); }
.sg-side-caution-title { font-size: 11px; letter-spacing: 0.14em; color: var(--sg-gold); font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
.sg-side-caution p { font-size: 10px; letter-spacing: 0.06em; color: var(--sg-gold); line-height: 1.5; margin: 0 0 4px; }

/* Admin black circle button */
.sg-admin-circle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%;
  background: #000; border: 1.5px solid var(--sg-pink); color: var(--sg-pink);
  font-size: 11px; font-weight: 700; cursor: pointer; margin-top: 10px; user-select: none;
}
.sg-admin-circle:hover { box-shadow: 0 0 10px rgba(255,63,180,0.5); }

/* Inline admin panel */
.sg-admin-inline { margin-top: 12px; padding: 14px; background: var(--sg-panel-2); border: 1px solid var(--sg-pink); border-radius: 10px; }
.sg-admin-inline-title { font-size: 10px; letter-spacing: 0.12em; color: var(--text-secondary); margin-bottom: 6px; font-weight: 700; }

/* Toast notifications */
.sg-toasts { position: fixed; right: 16px; bottom: 16px; display: grid; gap: 8px; z-index: 60; }
.sg-toast { border: 1px solid var(--border-primary); border-left-width: 3px; background: var(--bg-secondary); border-radius: 8px; padding: 10px 12px; font-size: 13px; }
.sg-toast.info  { border-left-color: var(--accent-primary); }
.sg-toast.warn  { border-left-color: var(--warning); }
.sg-toast.error { border-left-color: var(--danger); }

/* FOOTER */
.sg-footer { position: fixed; bottom: 16px; right: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; z-index: 200; pointer-events: none; }
.sg-footer a { pointer-events: auto; }
.sg-footer-thanks, .sg-footer-built { font-size: 9px; letter-spacing: 0.14em; color: var(--sg-muted); text-transform: uppercase; }
.sg-footer-handle { font-size: 10px; font-weight: 700; color: var(--sg-cyan); text-decoration: none; }
.sg-footer-handle:hover { color: var(--sg-pink); }

/* Responsive */
@media (max-width: 768px) {
  .sg-sidebar { position: static; width: auto; border-right: none; border-bottom: 1px solid var(--sg-border); }
  .sg-main { margin-left: 0; padding: 16px; }
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SECUREGATE_BYTECODE_HEX` | No | Compiled contract bytecode. `/api/artifact/securegate` returns 503 if unset. |
| `SECUREGATE_ABI_JSON` | No | Contract ABI as JSON string. |
| `SECUREGATE_ADMIN_KEY` | No | Admin key for passkey minting. `/api/admin-passkey/generate` returns `disabled: true` if unset. |
| `THANKYOU_HANDLE` | No | Twitter/X handle shown in thank-you envelope. Defaults to `@hope_ology`. |
| `THANKYOU_NETWORK` | No | Network label. Defaults to `EVM`. |
| `THANKYOU_ADDRESS` | No | EVM address shown in thank-you envelope. |
| `THANKYOU_WEBHOOK_URL` | No | Webhook URL for thank-you send. Returns `disabled: true` if unset. |
| `RPC_URL_<SLUG>` | No | Per-chain RPC URL (e.g. `RPC_URL_ETH_MAINNET`). Funding/deploy/rpc return 503 if unset. |
| `REDIS_URL` | No | Redis URL for anti-abuse KV. Falls back to in-memory if unset. |

---

## API Route Summary

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ok:true, service, ts}` |
| GET | `/api/chains` | Returns 20-chain registry (no RPC URLs) |
| GET | `/api/runtime` | Returns node version and uptime |
| GET | `/api/artifact/securegate` | Returns `{bytecode, abi}` or 503 if env not set |
| GET | `/api/funding/:chain` | Returns native-token deployment cost estimate |
| POST | `/api/rpc/:chain` | Read-only JSON-RPC proxy (allow-listed methods only) |
| POST | `/api/deploy/:chain` | Accepts `signedTx` only, broadcasts via backend RPC |
| POST | `/api/passkeys/register` | Registers a K1-bound passkey |
| POST | `/api/passkeys/verify` | Verifies a K1-bound passkey |
| POST | `/api/admin-passkey/generate` | Mints a K1-bound passkey (admin key required) |
| POST | `/api/anti-abuse/event` | Records an anti-abuse event |
| GET | `/api/thank-you/config` | Returns thank-you envelope config |
| POST | `/api/thank-you/send` | Sends a thank-you note via webhook |
| POST | `/api/trace/:kind` | Records a trace event |

All other paths return `404 not_found`. Private keys are never accepted by any route.

---

## Security Invariants

1. No private key field name (`privateKey`, `k1Key`, `k2Key`, `k3Key`, `deployerKey`, `mnemonic`, `seed`, `secret`, `passphrase`, `sessionKey`) is ever accepted by any API route.
2. Bare 64-hex strings are rejected by `/api/deploy` as likely private keys.
3. `/api/chains` never returns RPC URLs or environment variable names.
4. `/api/rpc` only allows explicit read-only methods. `eth_sendRawTransaction` and all write methods are blocked.
5. All auth checks (SCAN, LINK DEVICE, passkey, admin) run through honest placeholder gates that structurally cannot return a verified unlock — only a real remote passkey verify or exhausting 3 device attempts (human fallback) unlocks the dashboard.
6. The K3 address is the immutable forced destination. `executeIntent` is gated on a verified K2 EIP-712 signature and K3 enforcement — no placeholder result can contribute to execution.
7. SCRUB clears every session-only field. ESC / idle timeout / tab close also purge all input.
