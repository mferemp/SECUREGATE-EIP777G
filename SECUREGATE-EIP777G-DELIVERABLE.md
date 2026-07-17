# SecureGate / EIP-777G — Final Build Deliverable

> Single consolidated record. Active source lives at the repo root and in the
> branch/ZIP below. This file is documentation only — it is not the implementation.

**Status:** `No production-ready claim.`

---

## 1. Repo / ZIP / branch

| Field | Value |
|-------|-------|
| Branch | `securegate/eip-777g-final-build` |
| Commit | `4dea6ead7607104f597cdfff4accbadbe7a96b92` |
| ZIP | `outputs/files/securegate-eip777g-final-build-4dea6ea.zip` |
| ZIP sha256 | `61b655d4e673b4359a238d168c28df3df7d3523d1602965a3e23053556f5b50f` |
| Proof ZIP == commit | `git archive HEAD` reproduces the identical sha256 |
| Active-root files | 62 / 62 required present (168 tracked files total) |
| Working tree | clean |
| Node | v24.18.0 · Foundry forge 1.7.1 (via_ir) |
| Artifact | `out/SecureGate.sol/SecureGate.json` — 7030 bytes / 37 ABI entries |
| Artifact sha256 | `e957af0b477d8f49aa283c725ca45179fbf8e159c8522d10cdaf3aaa543e2404` |

Supersedes the earlier incomplete claim (commit `084bcf8`, zip `d51b4b9…`), which
omitted `.node-version` / `.nvmrc` / `.npmrc`, the canonical artifact, and the
`verify-authgate-passkey.cjs` + `verify-zip-contents.py` verifiers. Hash changed
because those required files were added.

---

## 2. Product model (source of truth)

- **K1** initiates / queues intents; entered before SCAN/LINK/PASSKEY; session-bound after verify.
- **K2** authorizes via EIP-712 signature **only** (never a private key).
- **K3** is the **immutable forced destination**; assets route to K3 and only K3.
- Non-K3 destination is captured/blacklisted internally, never routed.
- Backend receives a **signed transaction only** — never a private key, mnemonic, seed, session key, or destination override. RPC URLs are backend-env only.
- Progress labels (exactly 5): `Funding check`, `Preparing gate`, `Locking gate in`, `Verifying protection`, `Complete`.
- 2FA is separate proactive protection with **no** recovery limits and is never gated by Auth-Gate attempts, downloads, passkey failures, or anti-abuse counters.
- No 900s normal K1→K2 cooldown; abuse cooldown only after failed/abusive attempts.

---

## 3. Section → file → verifier map (16 sections)

| Sec | Concern | Source of truth | Verifier | Result |
|-----|---------|-----------------|----------|--------|
| 01 | UI baseline / labels | `frontend/src/App.tsx`, `index.css`, `lib/uiLabels.ts` | `verify-ui-baseline.cjs` | 6/0 |
| 02 | Canonical ABI / artifact | `contracts/SecureGate.sol`, `test/…`, `out/…json` | `verify-abi-canonical.cjs` | 22/0 |
| 03 | Auth-Gate session + sweep | `lib/authGateSession.ts`, `authGateSweep.ts`, `authGateAttempts.ts` | `verify-authgate-session/sweep/attempt-limits.cjs` | 10/0, 4/0, 4/0 |
| 04 | Device breadcrumb / trace | `lib/deviceBreadcrumb.ts`, `routes/trace.js`, `lib/trace-store.js` | `verify-device-breadcrumb.cjs`, `verify-anti-abuse-downloads.cjs` | 9/0, 7/0 |
| 05 | Passkey lane | `lib/passkeyAccess.ts`, `lib/passkey-store.js`, `routes/passkeys.js` | `verify-authgate-passkey.cjs`, `verify-passkey-lane.cjs` | 6/0, 6/0 |
| 06 | Admin black-circle passkey | `lib/adminPasskey.ts`, `routes/admin-passkey.js` | `verify-admin-passkey.cjs` | 7/0 |
| 07 | 2FA proactive no-limits | `lib/twoFactorProactive.ts` | `verify-2fa-no-limits.cjs` | 5/0 |
| 08 | Recovery flow + funding | `lib/recoveryCleanupSweep.ts`, `securegateTxBuilder.ts`, `api.ts`, `routes/funding.js` | `verify-recovery-flow-ui.cjs`, `verify-funding-gas.cjs` | 7/0, 7/0 |
| 09 | Recovery cleanup sweep | `lib/recoveryCleanupSweep.ts` | `verify-recovery-cleanup-sweep.cjs` | 5/0 |
| 10 | K3 enforce / blacklist / sweep | `lib/k3Enforcement.ts`, `k3ExecutionSweep.ts`, `lib/address-guard.js`, `routes/deploy.js` | `verify-blacklist-k3.cjs`, `verify-k3-execution-sweep.cjs` | 6/0, 5/0 |
| 11 | K2 authorization + intent hash | `lib/securegateIntentHash.ts`, `securegateK2Authorization.ts`, `securegateWalletProvider.ts` | `verify-k2-intent-builders.cjs`, `verify-wallet-k2-flow.cjs` | 32/32, 13/13 |
| 12 | Frontend ↔ backend wiring | `lib/api.ts`, `routes/{artifact,funding,deploy,runtime,trace,thank-you}.js` | `verify-front-back-wiring.cjs` | 20/0 |
| 13 | Thank-you envelope | `lib/thankYouEnvelope.ts`, `routes/thank-you.js` | `verify-thank-you-envelope.cjs` | 5/0 |
| 14 | Obfuscation / anti-clone | `verify-contract-obfuscation-layers.cjs`, `verify-obfuscation-ci.cjs` | (both) | SKIPPED |
| 15 | Anti-abuse (no extra guardrails) | `backend/lib/anti-abuse-kv.js` | `verify-anti-abuse-downloads.cjs` | 7/0 |
| 16 | Placeholder honesty | `lib/placeholderGates.ts` | `verify-placeholder-gates.cjs` | 21/0 |

---

## 4. No-Added-Guardrails ledger (26/26 PASS)

| Guardrail check | Required | Result | Evidence |
|---|---|---|---|
| UI spec used as frontend baseline | yes | PASS | verify-ui-baseline.cjs |
| stale operator/revoke/QR copied | no | PASS | verify-csp.cjs, verify-mobile-ci.cjs |
| 2FA blocked by Auth-Gate attempts | no | PASS | verify-2fa-no-limits.cjs |
| 2FA blocked by dashboard downloads | no | PASS | twoFactorProactive.ts |
| 2FA requires compromised K1 private key | no | PASS | verify-2fa-no-limits.cjs |
| 900s K1→K2 cooldown added | no | PASS | no MIN_DELAY exists |
| passkey route remains after SCAN/LINK disabled | yes | PASS | verify-authgate-passkey.cjs |
| normal multi-chain recovery for same K1 allowed | yes | PASS | verify-anti-abuse-downloads.cjs |
| download throttling only recovery/download abuse | yes | PASS | trace-store.js |
| K2 private key requested | no | PASS | verify-wallet-k2-flow.cjs |
| K3 private key requested | no | PASS | verify-recovery-flow-ui.cjs |
| public frontend RPC URL | no | PASS | verify-funding-gas.cjs |
| operator/revoke/QR flow | no | PASS | verify-mobile-ci.cjs |
| old ABI active | no | PASS | verify-abi-canonical.cjs |
| SecureGate-Canonical (2)/(3).sol used | no | PASS | only contracts/SecureGate.sol in tree |
| thank-you address affects K3 | no | PASS | verify-thank-you-envelope.cjs |
| fake txHash/pending/verified | no | PASS | verify-e2e-local.cjs, verify-placeholder-gates.cjs |
| Auth-Gate sweep moves assets | no | PASS | verify-authgate-sweep.cjs |
| recovery cleanup sweep leaks into 2FA | no | PASS | verify-recovery-cleanup-sweep.cjs |
| K3 execution sweep can route non-K3 | no | PASS | verify-k3-execution-sweep.cjs |
| obfuscation changes ABI/K3 routing | no | PASS | SKIPPED; ABI unchanged |
| backend receives private keys | no | PASS | routes/deploy.js |
| backend receives signedTx only | yes | PASS | verify-front-back-wiring.cjs |
| backend exposes RPC URL to frontend | no | PASS | backend selftest |
| active source depends on uploads/outputs/restored-original | no | PASS | verify-zip-contents.py |
| production-ready claim | no | PASS | verify-no-drift.cjs |

---

## 5. Build proofs (Node 24 — exact)

```
node -v                         → v24.18.0   (major===24 asserted)
forge --version                 → forge 1.7.1 (commit 4072e487)
forge build --via-ir            → EXIT 0 (3 block-timestamp lint warnings only)
forge test -vvv                 → 4 passed, 0 failed
  test_constructor_sets_keys / test_k2_authorizes_and_k1_executes_to_k3
  test_non_k3_destination_is_captured_not_routed / test_only_k1_can_queue
node scripts/extract-bytecode.js→ 7030 bytes, 37 ABI entries, sha256 e957af0b…
frontend npm run type-check     → tsc --noEmit  EXIT 0
frontend npm run build          → client + server + CSP hashes  EXIT 0
backend  npm run selftest       → 6/6 passed
backend  npm run drift:scan     → clean (100 source files)
backend  npm run verify:artifact→ clean and build agree (27 tokens preserved)
```

## 6. Verifier battery (all Node 24 — all PASS)

```
verify-ui-baseline 6/0 · verify-no-drift 13/13 · verify-authgate-session 10/0
verify-authgate-sweep 4/0 · verify-authgate-attempt-limits 4/0
verify-device-breadcrumb 9/0 · verify-authgate-passkey 6/0 · verify-passkey-lane 6/0
verify-admin-passkey 7/0 · verify-2fa-no-limits 5/0 · verify-recovery-flow-ui 7/0
verify-funding-gas 7/0 · verify-recovery-cleanup-sweep 5/0 · verify-blacklist-k3 6/0
verify-k3-execution-sweep 5/0 · verify-k2-intent-builders 32/32 · verify-wallet-k2-flow 13/13
verify-front-back-wiring 20/0 · verify-thank-you-envelope 5/0
verify-contract-obfuscation-layers 3/0 (SKIPPED build) · verify-obfuscation-ci SKIPPED
verify-anti-abuse-downloads 7/0 · verify-placeholder-gates 21/0 · verify-abi-canonical 22/0
```

---

## 7. Raw drift scan + classification

Spec grep across `contracts test script scripts backend frontend/src docs README.md`
→ **70 hits, 0 active-forbidden runnable paths.** Classes:

- **Rejection lists / blocklists** (cannot execute forbidden path): `verify-abi-canonical.cjs` FORBIDDEN old ABI; `address-guard.js` FORBIDDEN_OVERRIDE_KEYS; `securegateTxBuilder.ts` old-ABI blocklist; `uiLabels.ts` forbidden-vocab comment.
- **Verifier assertions** (assert term ABSENT): verify-no-drift, -mobile-ci, -csp, -admin-passkey, -browser-builders, -placeholder-gates, -obfuscation-ci, -blacklist-k3, -wallet-k2-flow, -ui-baseline.
- **Docs warnings**: docs/provenance, browser-builders, k2-authorization, security-headers, mobile-ci, obfuscation-ci, placeholders, e2e-testnet, kv.
- **Allowed abuse-cooldown / TTL windows (`900`)** — not a K1→K2 cooldown: `anti-abuse-kv.js windowSec:900`, `trace-store.js ttlSec:900`. Confirmed **no `MIN_DELAY` anywhere**.
- **Local test-only env**: `TESTNET_K1/K2_PRIVATE_KEY` only in `scripts/e2e-testnet-securegate.cjs`, docs, `.env.example`. Backend server/routes/lib read **no** `*_PRIVATE_KEY`.
- **Coincidental `900`/`QR`**: `index.css --neutral-900`/`font-weight:900`, `lato/900.css`, `PORT=8900`.
- **Generated (untracked, not in ZIP)**: `backend/.env.securegate` bytecode line; canonical env name `SECUREGATE_BYTECODE_HEX=` (forbidden `SECUREGATE_BYTECODE=` absent).

No unclassified hits. No active runnable source implements a forbidden path.

---

## 8. ZIP / repo content proof

```
git rev-parse HEAD            → 4dea6ead7607104f597cdfff4accbadbe7a96b92
git branch --show-current     → securegate/eip-777g-final-build
git status --short (tracked)  → (clean)
git ls-tree -r HEAD | wc -l   → 168
sha256sum <ZIP>               → 61b655d4e673b4359a238d168c28df3df7d3523d1602965a3e23053556f5b50f
git archive HEAD (reproduce)  → 61b655d4…  (identical → ZIP is from this commit)
verify-zip-contents.py <ZIP>  → valid standard ZIP; 62/62 active-root files; PASS
```

No required file resolves to `uploads/`, `outputs/`, `restored-original-*`, or `_stitch_zip/`.

---

## 9. Remaining missing pieces (honest)

- **Obfuscation:** `SKIPPED: no obfuscated build configured`. **Contract/dashboard obfuscation is NOT complete.** A token-equivalence guard exists but no obfuscation tool + build output is configured.
- **Wallet-injected K2 `signTypedData`:** scaffolded, not wired to a live browser wallet.
- **Playwright mobile E2E:** spec/config present; browser automation not installed (static mobile acceptance passes).
- **Live on-chain deploy:** browser deploy builder refines gas only when an artifact is served; no live public-chain deploy exercised.

---

No production-ready claim.
