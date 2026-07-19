# SecureGate / EIP-777G — Real-Build Handoff (READ FIRST)

This single ZIP contains **everything a fresh builder needs to take SecureGate
into a real build / production-hardening pass.** Dashboard and spec work are
already accepted under **Option B** (no source changes required). Do **not**
rebuild the dashboard.

---

## 0. What is in this ZIP

| File | Purpose |
|------|---------|
| `securegate-eip777g-dapink-final.zip` | **Authoritative source of truth** (current, DAPINK-fixed). Extract and build from this. |
| `securegate-eip777g-dapink-final.zip.sha256` | Expected hash of the source ZIP. |
| `securegate-eip777g-dapink-final.zip.b64.txt` | Base64 carrier of the source ZIP (survives text-only channels). |
| `SECUREGATE-BUILD-CODE-HANDOFF.md` | Every source file inlined verbatim (code reference). |
| `SECUREGATE-EIP777G-FINAL-HANDOFF.md` | Proof / source-verification truth (raw verifier + Foundry logs). |
| `GIT-DIFF-CONFIRMATION.md` | Confirms backend/contracts untouched; frontend/design-only diff. |
| `README-HANDOFF.md` | This file. |

> DEPRECATED / not current: `securegate-eip777g-final.zip` (`198f0637…`) and
> `securegate-eip777g-handoff.zip` (`be5073…`) are stale for DAPINK — do not build from them.

**Source SHA256 (must match):**
```
ae82ea4f649b29fff20553b157bbcfc0ca509595e59a0efef210834468e8c66b
```

---

## 1. Verify the source before you build

```bash
# If you only have the base64 carrier:
awk '!/^#/' securegate-eip777g-dapink-final.zip.b64.txt | base64 -d > securegate-eip777g-dapink-final.zip

sha256sum securegate-eip777g-dapink-final.zip
# expected: ae82ea4f649b29fff20553b157bbcfc0ca509595e59a0efef210834468e8c66b

# Extract clean:
rm -rf securegate-final && mkdir securegate-final
unzip securegate-eip777g-dapink-final.zip -d securegate-final   # (or: python3 -m zipfile -e ...)
cd securegate-final

# Source content gate + design fidelity:
node scripts/verify-zip-contents.cjs ../securegate-eip777g-dapink-final.zip
# expected: [PASS] ZIP content gate satisfied
node scripts/verify-design-fidelity.cjs
# expected: verify-design-fidelity: 29 passed, 0 failed
```

---

## 2. Do NOT do these

- Do not rebuild the dashboard or redesign the UI.
- Do not change K1 / K2 / K3 semantics.
- Do not change `contracts/SecureGate.sol` or the canonical artifact.
- Do not revive operator / revoke / QR / Flashbots / public-RPC / production-ready material.
- Do not use any workspace wrapper ZIP, `uploads/`, `outputs/`, or restored folders as source.

---

## 3. Your task = production hardening only

1. **Deploy** verified source to a staging / testnet environment.
2. **Backend env:** configure real RPC URLs via backend env vars only; never expose
   RPC URLs to the frontend; never accept user-supplied RPC URLs. `/api/rpc` stays
   read/estimate only; raw broadcast stays `signedTx`-only in `backend/routes/deploy.js`.
3. **Durable storage:** replace memory/local stores with production KV/storage so
   passkey bindings, anti-abuse counters, trace/breadcrumb state, and attempt limits
   survive restarts. Never store private keys, seeds, or K2/K3/deployer secrets.
4. **Passkey/WebAuthn:** prove the real verifier works in the deployed environment;
   K1-bound passkeys cannot unlock another K1; mismatch fails generically; 3 failed
   SCAN/LINK attempts darken only SCAN/LINK — passkey and human fallback stay open.
5. **USB/LINK device path:** test the real verifier if ready; otherwise disable/label
   it unavailable in production. Never fake device proof or expose marker recipes.
6. **Funded testnet E2E:** Auth-Gate unlock → K1 session binding → K2/K3 public
   addresses → funding/gas estimate → local `signedTx` creation → `signedTx`-only
   backend broadcast → K3-only destination validation → confirm no private keys in
   backend logs → confirm no public RPC URL leakage.
7. **Security review:** `contracts/SecureGate.sol`, canonical `out/SecureGate.sol/SecureGate.json`,
   `backend/routes/deploy.js` (signedTx-only), `backend/routes/rpc.js` (read-only),
   frontend key handling, passkey/admin fallback, logs for secrets, K3 override impossibility.
8. **Operations:** health checks, error/abuse alerts, failed Auth-Gate/passkey
   monitoring, deploy rollback plan, incident response plan, admin passkey issuance
   log, env-var rotation plan.
9. **Obfuscation:** either configure and prove it, or state exactly:
   `SKIPPED: no obfuscated build configured. Contract/dashboard obfuscation is NOT complete.`

---

## 4. Environment invariants

- Node 24 only. Respect `.node-version`, `.nvmrc`, `.npmrc` (engine-strict).
- `backend/package.json` and `frontend/package.json` engines stay `>=24 <25`.
- No root `package.json` — build inside `frontend/` and `backend/` separately.
- Use `scripts/with-node24.sh` to pin the toolchain.

---

## 5. Verification battery already passing on the source

From the source root (see `SECUREGATE-EIP777G-FINAL-HANDOFF.md` for raw logs):

- Frontend `type-check` 0 errors, `build` OK.
- Backend `selftest` 6/6, `drift:scan` clean, `verify:artifact` clean.
- ABI canonical 22/22 (37 ABI entries, 7030 bytecode bytes).
- `forge build --via-ir` OK, `forge test -vvv` 4/4.
- 24 static verifiers pass; anvil-backed K2 path pending an anvil environment.
- Obfuscation: SKIPPED (not configured).

---

## 6. Final proof the next engineer must return

Deployment/staging URL · source ZIP hash used · env checklist (secrets redacted) ·
funded testnet tx proof · no-private-key-log proof · route classification · frontend
build output · backend selftest/drift/artifact output · Foundry build/test output ·
verifier battery output · security review notes · remaining risks.

Do not claim production-ready until those hardening items are complete.

No production-ready claim.
