# SecureGate · EIP-777G — Single Handoff Source

**One document. Everything a fresh engineer needs to take this over, run it, verify it, and harden it for production.**

- Repo root: `/workspaces`
- Stack: Foundry/Solidity contract · React + Vite (SSR) frontend · Express + @surf-ai backend
- Runtime: Node 24 (`scripts/with-node24.sh`), Foundry forge 1.7.1
- Status snapshot: `dev: ok · prod: ok` — all 30 verifiers passing, design-fidelity 29/29
- **This is NOT a production-ready claim.** It is a working reference build + hardening runbook.

---

## 0. What this product is

A **compromised-wallet recovery dashboard**. A user whose wallet (K1) is drained or at risk uses SecureGate to
authorize a controlled, pre-committed sweep of assets to a single immutable safe destination (K3), without ever
exposing a private key to the backend.

The whole security model reduces to three keys:

| Key | Role | Trust boundary |
|-----|------|----------------|
| **K1** | Genesis owner / compromised wallet. Initiates recovery, proves ownership, binds the session. | Client-side only. |
| **K2** | Authorizer. Signs a **scoped EIP-712 typed-data intent** (never a raw private key) that permits a specific sweep. | Client-side signing only. |
| **K3** | Forced destination. **Immutable** safe address that assets can only ever be swept to. | Set once, on-chain. |

**Backend never sees a private key.** It only ever receives a `signedTx` (or a signed intent) and relays it. RPC
URLs live in backend env only and are never shipped to the client.

---

## 1. Repository layout

```
/workspaces
├── contracts/SecureGate.sol      # the recovery contract (queue + authorize + execute)
├── src/ , script/ , test/        # Foundry sources, deploy scripts, tests
├── out/                          # forge build artifacts (ABI + bytecode)
├── foundry.toml
├── frontend/                     # React + Vite SSR app  ← the DAPINK dashboard
│   ├── index.html                # shell (Surf badge REMOVED, title = SecureGate · EIP-777G)
│   └── src/
│       ├── App.tsx               # the entire dashboard UI (Auth-Gate + 4 gated tabs)
│       ├── index.css             # DAPINK palette + layout
│       ├── entry-client.tsx / entry-server.tsx   # SSR entry points
│       ├── components/ hooks/ lib/
│       └── ErrorBoundary.tsx
├── backend/                      # Express + @surf-ai
│   ├── server.js
│   ├── routes/                   # see §4
│   ├── config/ lib/ db/
│   └── package.json
├── scripts/                      # verify-*.cjs battery + with-node24.sh
└── HANDOFF.md                    # ← you are here
```

---

## 2. Quick start

```bash
# Node 24 is mandatory. All node/npm/forge commands go through the wrapper:
bash scripts/with-node24.sh node -v      # must print v24.x

# Frontend
cd frontend && bun install
# (dev server is managed by the studio; do NOT run `bun run dev` yourself)
bun run build                            # prod SSR build → frontend/dist/

# Backend
cd ../backend && bun install
bun run start                            # serves on BACKEND_PORT (default 3001)

# Contract
cd /workspaces
bash scripts/with-node24.sh forge build  # ABI+bytecode → out/SecureGate.sol/
bash scripts/with-node24.sh forge test
```

- Frontend dev URL: `http://localhost:5173/` (SSR — bare `/` 302s, needs base-path prefix).
- Backend API: `http://localhost:3001/api/<route>` — test with `curl -s` against port 3001 directly.

---

## 3. Contract — `contracts/SecureGate.sol`

Public/queue surface (from source):

```
queueERC20(...)          queueERC721(...)          queueERC1155(...)
authorizeIntent(...)     executeIntent(...)
computeIntentHash(...)   computeAuthorizationDigest(...)
recordAttemptedDestination(...)
onERC721Received / onERC1155Received / onERC1155BatchReceived  (receiver hooks)
supportsInterface(...)   safeTransferFrom(...) / transfer(...)  (guarded)
internal: _queue(...) _recover(...)
```

Flow:
1. **Queue** — assets to be recovered are enumerated on-chain (`queueERC20/721/1155`).
2. **Authorize** — K2 signs the EIP-712 digest from `computeAuthorizationDigest`; `authorizeIntent` records it.
   The intent hash (`computeIntentHash`) binds destination = K3, so the signature cannot be replayed to any other
   address.
3. **Execute** — `executeIntent` sweeps queued assets to the immutable K3. `recordAttemptedDestination` blacklists
   any attempt to redirect elsewhere.

Artifacts consumed by the backend are the canonical forge outputs in `out/` (ABI + bytecode). Keep them in sync via
the `verify-abi-canonical` verifier.

---

## 4. Backend — Express routes (`backend/routes/`)

| File | Purpose |
|------|---------|
| `passkeys.js` | Passkey register / verify (Auth-Gate K1 binding). |
| `admin-passkey.js` | Admin-scoped passkey gate. |
| `rpc.js` | Relays signed transactions to chain RPC. **RPC URLs are backend-env only.** |
| `chains.js` | Supported-chain config (mainnet, base, polygon). |
| `funding.js` | Gas / funding checks for the sweep. |
| `deploy.js` | Contract deploy helper (returns bytecode/ABI, does not hold keys). |
| `artifact.js` | Serves canonical ABI + artifact sha256. |
| `anti-abuse.js` | Rate/abuse tracing (peppered). |
| `deliverables.js` | Deliverables download endpoint (anti-abuse gated). |
| `thank-you.js` | Thank-you envelope (X handle / copy address). |
| `trace.js`, `runtime.js` | Diagnostics / runtime probes. |

Route verbs observed: `POST /register`, `POST /verify`, `POST /generate`, `POST /send`, `POST /download`,
`POST /event`, `POST /ping`, `GET /config`, `GET /:chain`, `GET /securegate`, `GET /file`.

**Never** add a route that accepts a raw private key or seed phrase. The only secret material crossing the wire is a
`signedTx` / signed intent produced client-side.

---

## 5. Environment variables (backend only)

Referenced in backend source — provide real values in production, never commit them:

```
ADMIN_KEY                     # admin passkey gate
PASSKEY_PEPPER                # passkey hashing pepper
ABUSE_TRACE_PEPPER            # anti-abuse trace pepper
KV_REST_API_URL              # KV store (Upstash/Vercel KV)
KV_REST_API_TOKEN
SECUREGATE_ABI_JSON           # canonical ABI
SECUREGATE_BYTECODE_HEX       # canonical bytecode
SECUREGATE_ARTIFACT_SHA256    # artifact integrity check
SECUREGATE_ARTIFACT_VERSION
THANK_YOU_HANDLE              # X handle for thank-you envelope
THANK_YOU_COPY_ADDRESS
THANK_YOU_NETWORK
X_OAUTH2_ACCESS_TOKEN         # X API (thank-you send)
X_THANK_YOU_RECIPIENT_ID
BACKEND_PORT                  # default 3001
# RPC URLs: inject per-chain in backend env — NEVER in frontend bundle.
```

---

## 6. Frontend — the DAPINK dashboard (`frontend/src/App.tsx`)

The landing view is the **Auth-Gate**, styled to the DAPINK terminal reference:

- **Topbar**: `SECUREGATE` wordmark + `EIP-777G` badge, `GATE LOCKED` status pill, `SCRUB` (pink) + power `⏻`.
- **Sidebar (Auth-Gate)**: neon circular **SCAN** authenticator (gated by `devicesLocked`), `GENESIS OWNER
  AUTHENTICATION`, `DASHBOARD LOCKED` card, `K1 COMPROMISED WALLET ADDRESS` input, `LINK DEVICE` (pink), `PASSKEY`
  input + `ENTER`, and the AUTH-GATE note (same-device SCAN / different-device USB→LINK DEVICE / passkey issuance /
  `@hope_ology` human fallback / SCRUB copy).
- **Main landing (always visible)**: `STANDALONE OPERATION` (client-side operation copy) + `CAUTION` acknowledgement
  block.
- **Gated workspace**: the four tabs — **Recovery / Protection / Admin / Status** — are wrapped in
  `{dashboardUnlocked ? (…) : null}` and only appear after Auth-Gate succeeds (`humanRoute` is set on passkey-verify
  or human-fallback). A `sg-gate-hint` shows while locked.
- **Footer**: `THANK YOU · BUILT BY EMP · @hope_ology` + deliverables link.

Palette (`index.css` `:root`): bg `#05070d`, cyan `#35e0d8`, pink `#ff3fb4`, gold `#d9b25a`, monospace brand feel.

**Branding rule (enforced by verifier):** no "Made by Surf" / SurfAI / surf-badge / plaza-badge anywhere in the
public frontend. `frontend/index.html` had the studio badge `<style>/<a>/<script>` removed and the title set to
`SecureGate · EIP-777G`.

---

## 7. Verification battery (`scripts/verify-*.cjs`)

All are dependency-free Node scripts. Run the full set through the Node-24 wrapper:

```bash
for v in scripts/verify-*.cjs; do bash scripts/with-node24.sh node "$v" || echo "FAIL: $v"; done
```

Key gates (30 total):

- `verify-design-fidelity.cjs` — **29/29**: no Surf branding + all 13 DAPINK labels present + STANDALONE landing is
  before the tabs + `dashboardUnlocked` gate wraps the tab workspace + neon SCAN circle gated by `devicesLocked`.
- `verify-ui-baseline` (6/6), `verify-no-drift` (13/13), `verify-authgate-passkey` (6/6),
  `verify-recovery-flow-ui` (7/7), `verify-front-back-wiring` (20/20).
- Security/logic: `verify-authgate-session`, `verify-authgate-sweep`, `verify-authgate-attempt-limits`,
  `verify-blacklist-k3`, `verify-k2-intent-builders`, `verify-k3-execution-sweep`, `verify-recovery-k3`,
  `verify-wallet-k2-flow`, `verify-2fa-no-limits`, `verify-admin-passkey`.
- Integrity/infra: `verify-abi-canonical`, `verify-contract-obfuscation-layers`, `verify-csp`,
  `verify-anti-abuse-downloads`, `verify-node24-runtime`, `verify-mobile-ci`, `verify-e2e-local`,
  `verify-zip-contents`, `verify-thank-you-envelope`, `verify-placeholder-gates`, `verify-funding-gas`,
  `verify-browser-builders`, `verify-obfuscation-ci`, `verify-recovery-cleanup-sweep`.

Verifiers scan **source text** of `App.tsx`/`index.html`/`index.css` — conditionally-rendered elements still pass as
long as their IDs/strings remain in source.

---

## 8. Deploy

1. `forge build` → confirm `out/SecureGate.sol/SecureGate.json` sha256 matches `SECUREGATE_ARTIFACT_SHA256`.
2. Deploy the contract; capture address + the immutable K3 destination.
3. Frontend: `cd frontend && bun run build` → deploy `frontend/dist/` (SSR). Host must serve the base path.
4. Backend: deploy `backend/` with all §5 env vars set (RPC URLs, peppers, KV, X tokens).
5. Post-deploy: run the full verifier battery in CI; confirm `.vulcan/build.json` shows `dev.status` and
   `prod.status` = `ok`.

---

## 9. Production hardening checklist (NOT yet done)

- [ ] Real secrets management (peppers, ADMIN_KEY, X token) via a vault — nothing in source/`.env` committed.
- [ ] Independent security audit of `SecureGate.sol` (reentrancy, intent replay, K3 immutability, receiver hooks).
- [ ] Signed-intent EIP-712 domain pinning (chainId + verifyingContract) reviewed against the deploy target.
- [ ] Rate-limiting + abuse tracing tuned for real traffic; KV backing store provisioned.
- [ ] CSP reviewed (currently 3 inline hashes after Surf-script removal); tighten `connect-src` to real RPC/API.
- [ ] Passkey/WebAuthn flow tested on real devices (same-device SCAN + cross-device USB LINK DEVICE).
- [ ] Gas/funding path tested against each supported chain (mainnet, base, polygon).
- [ ] Full E2E on testnet: queue → K2 authorize → execute sweep to K3 → blacklist a wrong destination.
- [ ] Live rendering screenshot captured from the deployed host (cannot be produced in this sandbox).

---

## 10. Artifacts in this repo

| File | sha256 | Notes |
|------|--------|-------|
| `securegate-eip777g-dapink-final.zip` | `ae82ea4f649b…e8c66b` | **Current** DAPINK-fixed source bundle. Build from this. |
| `securegate-eip777g-dapink-handoff.zip` | see `.sha256` sidecar | **Current** handoff bundle (docs + DAPINK source zip + carriers). |
| ~~`securegate-eip777g-final.zip`~~ | ~~`198f0637…5f39a3`~~ | DEPRECATED / stale for DAPINK — do not use. |
| ~~`securegate-eip777g-handoff.zip`~~ | ~~`be5073…ffce85`~~ | DEPRECATED / stale for DAPINK — do not use. |

Base64 carriers (`*.zip.b64.txt`) accompany each zip for survivable delivery:
`awk '!/^#/' <file>.b64.txt | base64 -d > <file>.zip`.

---

**No production-ready claim.**
