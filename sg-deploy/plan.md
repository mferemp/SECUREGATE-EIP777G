# 777G / SecureGate — Standalone Compromised-Wallet Recovery (build spec)
## Final consolidated handoff — execution plan

**Summary:** Deliver the 23-section build. Much of the spec already exists from prior
closure work; this plan extracts inline logic into the spec's named library modules,
adds the genuinely-new lanes (device breadcrumb/trace, passkey lane, admin-passkey),
adds the ~15 named verifiers, then runs the full Node 24 proof battery + drift scan +
guardrail ledger. Ends with exactly `No production-ready claim.`

Legend: **[EXISTS]** already built & passing · **[EXTRACT]** logic exists inline in
App.tsx/routes, move into the named module + wire back · **[NEW]** net-new file.

### Sources of truth (locked)
- Frontend baseline = attached UI spec (dark terminal shell already in `App.tsx` + `index.css`).
- Contract/ABI = `contracts/SecureGate.sol` + `out/SecureGate.sol/SecureGate.json` ONLY.
- Reject `SecureGate-Canonical (2)/(3).sol` and old production-ready markdown packs.
- Drift lock honored: no operator/revoke/QR, no 2FA limits, no 900s cooldown, no old ABI,
  no frontend RPC URLs, signedTx-only backend, no fake success, provenance intact.

### Section → work map
1. **Frontend Baseline** — `App.tsx`,`index.css` [EXISTS]; `frontend/src/lib/uiLabels.ts` [NEW]; `scripts/verify-ui-baseline.cjs` [NEW]
2. **Provenance + Drift Lock** — `README.md`,`docs/provenance.md`,`scripts/verify-no-drift.cjs` [EXISTS]
3. **Canonical ABI/Artifact** — `scripts/extract-bytecode.js` [EXISTS]; `scripts/verify-abi-canonical.cjs` [NEW] (formalize inline check)
4. **Auth-Gate Session Binding** — `frontend/src/lib/authGateSession.ts` [NEW]; `App.tsx` [EXTRACT]; `scripts/verify-authgate-session.cjs` [NEW]
5. **Auth-Gate Sweep** — `frontend/src/lib/authGateSweep.ts` [NEW]; `scripts/verify-authgate-sweep.cjs` [NEW]
6. **Attempt Limits (3→darken)** — `frontend/src/lib/authGateAttempts.ts` [NEW/EXTRACT]; `scripts/verify-authgate-attempt-limits.cjs` [NEW]
7. **Device Breadcrumb/Ping** — `frontend/src/lib/deviceBreadcrumb.ts` [NEW]; `backend/routes/trace.js` [NEW]; `backend/lib/trace-store.js` [NEW] (builds on existing `trace-key.js`); `backend/scripts/verify-device-breadcrumb.cjs` [NEW]
8. **Passkey Lane** — `frontend/src/lib/passkeyAccess.ts` [NEW]; `backend/routes/passkeys.js` [NEW]; `backend/lib/passkey-store.js` [NEW]; `App.tsx` [EXTRACT]; `scripts/verify-authgate-passkey.cjs` [NEW]
9. **Admin Black-Circle Passkey** — `frontend/src/lib/adminPasskey.ts` [NEW]; `backend/routes/admin-passkey.js` [NEW]; `App.tsx` [EXTRACT]; `scripts/verify-admin-passkey.cjs` [NEW]
10. **2FA Proactive, No Limits** — `frontend/src/lib/twoFactorProactive.ts` [NEW]; `scripts/verify-2fa-no-limits.cjs` [NEW]
11. **Recovery Flow** — `App.tsx`,`securegateTxBuilder.ts`,`api.ts` [EXISTS]; `scripts/verify-recovery-flow-ui.cjs` [NEW]
12. **Funding/Gas** — `backend/routes/funding.js` [EXISTS, extend estimate breakdown]; `scripts/verify-funding-gas.cjs` [NEW]
13. **Recovery Cleanup Sweep** — `frontend/src/lib/recoveryCleanupSweep.ts` [NEW]; `backend/lib/address-guard.js` [EXISTS]; `scripts/verify-recovery-cleanup-sweep.cjs` [NEW]
14. **K3 Enforcement + Blacklist** — `frontend/src/lib/k3Enforcement.ts` [NEW]; `address-guard.js`,`deploy.js` [EXISTS, extend blacklist]; `scripts/verify-blacklist-k3.cjs` [NEW]
15. **K2 Auth + Client Intent Hash** — `securegateIntentHash.ts`,`securegateK2Authorization.ts`,`securegateWalletProvider.ts`,`verify-k2-intent-builders.cjs`,`verify-wallet-k2-flow.cjs` [ALL EXISTS]
16. **K3 Execution Sweep** — `frontend/src/lib/k3ExecutionSweep.ts` [NEW/EXTRACT]; `scripts/verify-k3-execution-sweep.cjs` [NEW]
17. **Front↔Back Wiring** — `api.ts`,routes [EXISTS]; `scripts/verify-front-back-wiring.cjs` [NEW]
18. **Thank-You Envelope** — `App.tsx`,`backend/routes/thank-you.js` [EXISTS]; `frontend/src/lib/thankYouEnvelope.ts` [NEW/EXTRACT]; `scripts/verify-thank-you-envelope.cjs` [NEW]
19. **Obfuscation Layers** — `backend/scripts/obfuscation-equivalence.cjs`,`scripts/verify-obfuscation-ci.cjs` [EXISTS]; `scripts/obfuscate-dashboard.cjs` [NEW or honest SKIP], `scripts/verify-contract-obfuscation-layers.cjs` [NEW], `docs/obfuscation-layers.md` [NEW]
20. **Anti-Abuse (no extra guardrails)** — `backend/lib/anti-abuse-kv.js` [EXISTS]; `backend/routes/trace.js` [from §7]; `scripts/verify-anti-abuse-downloads.cjs` [NEW]
21. **Placeholder Honesty** — `frontend/src/lib/placeholderGates.ts`,`scripts/verify-placeholder-gates.cjs` [EXISTS]
22. **Node 24 Proof Battery** — run all listed commands, paste exact output
23. **Raw Drift Scan + Classification** — run grep, classify every hit

### Execution order (batched to limit rebuilds)
1. Backend first: `trace-store.js`, `passkey-store.js`, routes `trace.js`/`passkeys.js`/`admin-passkey.js`, extend `funding.js`/`deploy.js`/`address-guard.js`.
2. Frontend libs: `uiLabels`, `authGateSession`, `authGateSweep`, `authGateAttempts`, `deviceBreadcrumb`, `passkeyAccess`, `adminPasskey`, `twoFactorProactive`, `recoveryCleanupSweep`, `k3Enforcement`, `k3ExecutionSweep`, `thankYouEnvelope`.
3. Wire libs into `App.tsx` (extract inline logic → import from modules; keep UI shell identical).
4. Add all ~15 new verifiers under Node 24; make each pass or honest-skip.
5. Type-check + build frontend; backend selftest/drift/verify:artifact; full verifier battery; drift scan.
6. Fill No-Added-Guardrails ledger (all PASS) + remaining-missing list + status line.

### Honest blockers expected (implemented as fail-closed, never faked)
- Real SCAN provider / USB hardware / WebAuthn verifier absent → placeholder gates stay honest (never `verified:true`).
- Funded testnet + durable KV + Playwright browser + obfuscation tool absent → honest SKIP strings.
- Burner Twitter for thank-you unconfigured → route fails honestly.

### Definition of done
All verifiers pass or honest-skip; `type-check`+`build` clean; backend selftest/drift/verify:artifact clean; `.vulcan/build.json` dev+prod `ok`; drift scan fully classified; ledger all PASS; ends with `No production-ready claim.`
