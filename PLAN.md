# PLAN — SecureGate EIP-777G: Narrow Frontend Spec Alignment + Backend Route-Mount / Registry Proof

**Scope statement (corrected):** Only two concrete defects remain **in this narrow frontend/backend-scaffold alignment pass**: the CDN font import and the incomplete chain registry. **This does not mean SecureGate is production complete.** No production-readiness or "all gaps filled" claim will be made.

> Scope guard: targets the **clean React repo only**. The retired single-file HTML monolith and the verbatim UI spec (Doc A) are **quarantined reference/history** — never a copy source. Nothing retired is re-injected.

---

## 0. Verified starting state (already true)

- `GET /api/chains` → 200, public metadata only (no RPC URLs). Route mounting works.
- `GET /api/health` → `{"status":"ok"}`. SDK auto-mounts `backend/routes/*`.
- `backend/config/chains.js` `listPublic()` strips `rpcEnv` — RPC URLs stay backend-env-only.
- React source: 0 drift hits.
- **Two real gaps in THIS pass:** (a) `frontend/src/index.css:1` Google Fonts CDN import; (b) `chains.js` has 6 slugs vs canonical ~18–20.

---

## 1. Files to MODIFY (allowed edits, after approval)

| File | Change |
|---|---|
| `frontend/src/index.css` | Remove `@import url('https://fonts.googleapis.com…')`; replace with self-hosted font-face or system font stack. |
| `backend/config/chains.js` | Extend `CHAINS` 6 → canonical set (eth, opt, polygon, arb, plasma, base, ink, avax, bnb, abstract, robinhood, zora, lens, apechain, degen, unichain, monad, hyperliquid mainnets; `hyperliquid-core` + `solana-mainnet` with `deploySupported:false`). Keep backend-only `rpcEnv` pattern; `listPublic()` unchanged. |
| `frontend/src/App.tsx` | Design-system alignment ONLY (spacing/typography/color tokens, section labels, honest placeholder copy). Preserve every SecureGate surface + K1/K2/K3 model. No new flows, no revoke/bundle language. |
| `backend/.env.example` (if present) | Add new chains' `RPC_*` env var names. |
| `backend/scripts/check-env.js` (if it validates env) | Add new `rpcEnv` names to expected set. |
| `backend/scripts/selftest.cjs` (if it assumes chain count / rpcEnv names) | Sync expectations to expanded registry. |

## 2. Files NOT to touch (hard boundary)

- `backend/server.js` — generic SDK bootstrap, proven. Leave as-is.
- `backend/routes/*.js` — mounted + responding. No signature changes this pass.
- `backend/lib/*` (address-guard, anti-abuse-kv, trace-key) — out of scope.
- `backend/db/*` — no schema change.
- `/workspaces/uploads/*` — canonical/reference inputs, read-only.
- `outputs/files/*.md` — prior deliverables, history only.
- The old monolith HTML — retired, never copied.

## 3. Drift terms to SCAN (must stay at zero in active source)

`operator-proof-input | submitRevokeBundle | getOperatorProof | /api/recovery/execute | OPERATOR_VEIL_PHRASE | X-Operator-Proof | Flashbots | smoke test / SMOKE TEST | sweeper | overrideDestination | overrideDest | k2OverrideDest | DEPLOYMENT BUNDLE | signedTx:"0x00" | txHash:"pending" | verified:true (hardcoded) | QR | visible Revoke | public/hardcoded RPC URL | connect-src 3rd-party RPC | external Google Fonts | server-side K2 signing | browser process.env RPC`

Any real source hit = stop and fix before completion.

## 4. Verification commands (run after edits — honest failures OK, fake success NOT OK)

**4.1 Prove all relevant routes (not just health/chains):**
```bash
curl -i http://localhost:3001/api/health
curl -i http://localhost:3001/api/chains
curl -i http://localhost:3001/api/thank-you/config
curl -i http://localhost:3001/api/artifact/securegate
curl -i http://localhost:3001/api/funding/eth-mainnet
```
Expected honest failures acceptable (missing RPC env, missing artifact bytecode). Fake success not acceptable.

**4.2 Prove no RPC data leaks to frontend:**
```bash
curl -s http://localhost:3001/api/chains
grep -RIn "https://.*rpc\|RPC URL\|process.env.REACT_APP\|process.env.RPC" frontend/src frontend/index.html --exclude-dir=node_modules || true
```

**4.3 Prove no external CDN/font dependency remains:**
```bash
grep -RIn "fonts.googleapis\|fonts.gstatic\|cdn.jsdelivr\|unpkg\|cdnjs" frontend backend --exclude-dir=node_modules || true
```

**4.4 Prove stale drift stays out of active source:**
```bash
grep -RIn \
  "operator-proof-input\|submitRevokeBundle\|getOperatorProof\|/api/recovery/execute\|OPERATOR_VEIL_PHRASE\|X-Operator-Proof\|Flashbots\|smoke test\|SMOKE TEST\|sweeper\|overrideDestination\|overrideDest\|k2OverrideDest\|DEPLOYMENT BUNDLE\|signedTx:[[:space:]]*[\"']0x00[\"']\|txHash:[[:space:]]*[\"']pending[\"']\|verified:[[:space:]]*true\|QR\|server-side K2 signing\|browser process.env RPC" \
  frontend/src backend \
  --exclude-dir=node_modules --exclude="bun.lock" --exclude="package-lock.json" || true
```
Any real source hit must be fixed before completion.

**4.5 Full backend + frontend checks:**
```bash
find backend -type f \( -name "*.js" -o -name "*.cjs" \) ! -path "*/node_modules/*" -print0 | xargs -0 -n1 node --check

cd backend
npm install
npm run selftest
npm run drift:scan
npm run verify:artifact

cd ../frontend
npm install
BACKEND_PORT=3001 BASE_PATH=/ npm run type-check
BACKEND_PORT=3001 BASE_PATH=/ npm run build
```
Then confirm `.vulcan/build.json` shows `dev.status=ok` AND `prod.status=ok`.

> Note: if any listed npm script (`selftest`, `drift:scan`, `verify:artifact`, `type-check`) is absent, I will report that honestly rather than fake a pass, and fall back to the equivalent direct script under `backend/scripts/`.

## 5. Registry + env sync (part of §1, called out explicitly)

Restore canonical expanded registry and sync every related file:
- `backend/config/chains.js`
- `backend/.env.example` (if present)
- `backend/scripts/check-env.js` (if it validates env)
- `backend/scripts/selftest.cjs` (if it assumes chain count / rpcEnv names)

## 6. Explicit REMAINING-MISSING checklist after this pass (NOT a ship claim)

This narrow pass leaves the following open — SecureGate is **not** production complete:
- [ ] final production-safe `SecureGate.sol`
- [ ] Foundry tests
- [ ] `forge build`
- [ ] `forge test -vvv`
- [ ] real Auth-Gate
- [ ] real USB LINK DEVICE verifier
- [ ] real WebAuthn/passkey verifier
- [ ] browser deploy builder
- [ ] browser K1 action builder
- [ ] end-to-end deploy / K1 / K2 / K3 proof
- [ ] production CSP/header proof
- [ ] mobile/DOM acceptance proof

No "verified: true", no fake tx hashes, no "production ready" / "all gaps filled" wording will be emitted.

---

**Approved scope (once wording above is accepted):** FRONTEND SPEC ALIGNMENT + BACKEND ROUTE-MOUNT / REGISTRY PROOF — nothing more.

**Approval gate:** no source file is touched until this PLAN.md is approved.
