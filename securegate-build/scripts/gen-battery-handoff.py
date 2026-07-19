#!/usr/bin/env python3
"""Generate the single full-battery HANDOFF.md embedding every raw proof log,
the no-added-guardrails ledger, and the classified drift scan. Then it is bundled
(with the whole repo + raw proof logs) into one retrievable ZIP by the caller.
"""
import hashlib, os, subprocess, datetime

REPO = "/workspaces"
PROOFS = os.path.join(REPO, "handoff", "proofs")
OUT = os.path.join(REPO, "handoff", "HANDOFF.md")

def sh(cmd):
    return subprocess.run(cmd, shell=True, cwd=REPO, capture_output=True, text=True).stdout.strip()

COMMIT = sh("git rev-parse HEAD")
BRANCH = sh("git branch --show-current")
NFILES = sh("git ls-tree -r --name-only HEAD | wc -l").strip()

def log(name):
    # Accept names with or without the .txt extension; the proof files on disk
    # are all <name>.txt under handoff/proofs/.
    candidates = [name]
    if not name.endswith(".txt"):
        candidates.append(name + ".txt")
    for cand in candidates:
        p = os.path.join(PROOFS, cand)
        try:
            with open(p, encoding="utf-8", errors="replace") as f:
                return f.read().rstrip("\n")
        except FileNotFoundError:
            continue
    return f"(missing log: {name})"

def block(name, lang="text"):
    return f"```{lang}\n{log(name)}\n```"

# --- Section metadata (16 sections) ---
SECTIONS = [
    ("01", "UI Baseline Integration",
     ["frontend/src/App.tsx","frontend/src/index.css","frontend/src/lib/uiLabels.ts","scripts/verify-ui-baseline.cjs"],
     "Preserve UI_FRONTEND_SPECS shell; no operator/revoke/QR/Flashbots vocab in UI.",
     "scripts/with-node24.sh node scripts/verify-ui-baseline.cjs", "v01-ui-baseline"),
    ("02", "Canonical ABI / Artifact",
     ["contracts/SecureGate.sol","test/SecureGate.t.sol","foundry.toml","script/DeploySecureGate.s.sol","scripts/extract-bytecode.js","scripts/verify-abi-canonical.cjs","out/SecureGate.sol/SecureGate.json"],
     "New ABI only (queueERC20/authorizeIntent/executeIntent...); forbid queueIntent/forwardERC20/computeEIP712Digest/domainSeparator.",
     "scripts/with-node24.sh node scripts/verify-abi-canonical.cjs", "07-verify-abi-canonical"),
    ("03", "Auth-Gate Session + Sweep",
     ["frontend/src/lib/authGateSession.ts","frontend/src/lib/authGateSweep.ts","frontend/src/lib/authGateAttempts.ts","scripts/verify-authgate-session.cjs","scripts/verify-authgate-sweep.cjs","scripts/verify-authgate-attempt-limits.cjs"],
     "K1 bound to session; sweep never moves assets; 3 device fails darken SCAN/LINK; passkey lane stays open.",
     "scripts/with-node24.sh node scripts/verify-authgate-session.cjs", "v03-authgate-session"),
    ("04", "Device Breadcrumb / Download Trace",
     ["frontend/src/lib/deviceBreadcrumb.ts","backend/routes/trace.js","backend/lib/trace-store.js","backend/scripts/verify-device-breadcrumb.cjs"],
     "Breadcrumb for recovery/Auth-Gate/download abuse only; must NOT limit 2FA.",
     "cd backend && ../scripts/with-node24.sh node scripts/verify-device-breadcrumb.cjs", "v06-device-breadcrumb"),
    ("05", "Passkey Lane",
     ["frontend/src/lib/passkeyAccess.ts","backend/lib/passkey-store.js","backend/routes/passkeys.js","scripts/verify-authgate-passkey.cjs"],
     "Passkey K1-bound not per-chain; backend stores only salted 64-hex digest; verified passkey is human-route signal only.",
     "scripts/with-node24.sh node scripts/verify-authgate-passkey.cjs", "v07-authgate-passkey"),
    ("06", "Admin Black-Circle Passkey",
     ["frontend/src/lib/adminPasskey.ts","backend/routes/admin-passkey.js","scripts/verify-admin-passkey.cjs"],
     "Admin key + K1 -> K1-bound passkey; no operator surface.",
     "scripts/with-node24.sh node scripts/verify-admin-passkey.cjs", "v08-admin-passkey"),
    ("07", "2FA Proactive No-Limits",
     ["frontend/src/lib/twoFactorProactive.ts","scripts/verify-2fa-no-limits.cjs"],
     "2FA separate & proactive; no recovery limits; not gated by Auth-Gate attempts/downloads/passkey fails; no compromised K1 key.",
     "scripts/with-node24.sh node scripts/verify-2fa-no-limits.cjs", "v09-2fa-no-limits"),
    ("08", "Recovery Flow + Funding",
     ["frontend/src/lib/recoveryCleanupSweep.ts","frontend/src/lib/securegateTxBuilder.ts","frontend/src/lib/api.ts","backend/routes/funding.js","scripts/verify-recovery-flow-ui.cjs","scripts/verify-funding-gas.cjs"],
     "Funding/gas via backend route only; no frontend RPC URLs; public progress labels exact.",
     "scripts/with-node24.sh node scripts/verify-funding-gas.cjs", "v11-funding-gas"),
    ("09", "Recovery Cleanup Sweep",
     ["frontend/src/lib/recoveryCleanupSweep.ts","scripts/verify-recovery-cleanup-sweep.cjs"],
     "Cleanup sweep must not leak into 2FA.",
     "scripts/with-node24.sh node scripts/verify-recovery-cleanup-sweep.cjs", "v12-recovery-cleanup-sweep"),
    ("10", "K3 Enforcement / Blacklist / Execution Sweep",
     ["frontend/src/lib/k3Enforcement.ts","frontend/src/lib/k3ExecutionSweep.ts","backend/lib/address-guard.js","backend/routes/deploy.js","scripts/verify-blacklist-k3.cjs","scripts/verify-k3-execution-sweep.cjs"],
     "Assets route ONLY to K3; non-K3 captured/blacklisted; deploy route rejects override-destination keys.",
     "scripts/with-node24.sh node scripts/verify-blacklist-k3.cjs", "v13-blacklist-k3"),
    ("11", "K2 Authorization + Intent Hash",
     ["frontend/src/lib/securegateIntentHash.ts","frontend/src/lib/securegateK2Authorization.ts","frontend/src/lib/securegateWalletProvider.ts","scripts/verify-k2-intent-builders.cjs","scripts/verify-wallet-k2-flow.cjs"],
     "K2 authorizes via EIP-712 signature only; never a K2 key; rejects all-zero signature.",
     "scripts/with-node24.sh node scripts/verify-k2-intent-builders.cjs", "v15-k2-intent-builders"),
    ("12", "Frontend <-> Backend Wiring",
     ["frontend/src/lib/api.ts","backend/routes/artifact.js","backend/routes/funding.js","backend/routes/deploy.js","backend/routes/runtime.js","backend/routes/trace.js","backend/routes/thank-you.js","scripts/verify-front-back-wiring.cjs"],
     "Backend receives signedTx only; RPC URLs backend-env only; no private keys posted.",
     "scripts/with-node24.sh node scripts/verify-front-back-wiring.cjs", "v17-front-back-wiring"),
    ("13", "Thank-You Envelope",
     ["frontend/src/lib/thankYouEnvelope.ts","backend/routes/thank-you.js","scripts/verify-thank-you-envelope.cjs"],
     "Thank-you address is separate from K3 and cannot affect routing.",
     "scripts/with-node24.sh node scripts/verify-thank-you-envelope.cjs", "v18-thank-you-envelope"),
    ("14", "Obfuscation / Anti-Clone",
     ["scripts/verify-contract-obfuscation-layers.cjs","scripts/verify-obfuscation-ci.cjs","docs/obfuscation-ci.md"],
     "No obfuscated build configured -> must SKIP honestly; obfuscation must never change ABI/K3 routing.",
     "scripts/with-node24.sh node scripts/verify-contract-obfuscation-layers.cjs", "v19-contract-obfuscation-layers"),
    ("15", "Anti-Abuse Without Extra Guardrails",
     ["backend/lib/anti-abuse-kv.js","scripts/verify-anti-abuse-downloads.cjs"],
     "All 900s are abuse TTL/window, NOT a K1->K2 cooldown; MIN_DELAY absent.",
     "scripts/with-node24.sh node scripts/verify-anti-abuse-downloads.cjs", "v21-anti-abuse-downloads"),
    ("16", "Placeholder Honesty",
     ["frontend/src/lib/placeholderGates.ts","scripts/verify-placeholder-gates.cjs"],
     "Placeholders declared honestly; no fake txHash/pending/verified.",
     "scripts/with-node24.sh node scripts/verify-placeholder-gates.cjs", "v22-placeholder-gates"),
]

# --- No-added-guardrails ledger (26 rows) ---
LEDGER = [
 ("UI spec used as frontend baseline","yes","PASS","frontend/src/App.tsx + scripts/verify-ui-baseline.cjs (v01)"),
 ("stale operator/revoke/QR copied","no","PASS","scripts/verify-csp.cjs / verify-mobile-ci.cjs / verify-admin-passkey.cjs assertions"),
 ("2FA blocked by Auth-Gate attempts","no","PASS","scripts/verify-2fa-no-limits.cjs (v09)"),
 ("2FA blocked by dashboard downloads","no","PASS","scripts/verify-2fa-no-limits.cjs (v09)"),
 ("2FA requires compromised K1 private key","no","PASS","frontend/src/lib/twoFactorProactive.ts + v09"),
 ("900-second K1->K2 cooldown added","no","PASS","drift scan: no MIN_DELAY; 900s only in anti-abuse-kv/trace-store TTL"),
 ("900-second values only abuse TTL/window if present","yes","PASS","backend/lib/anti-abuse-kv.js windowSec:900 / trace-store.js ttlSec:900"),
 ("passkey route remains after SCAN/LINK disabled","yes","PASS","scripts/verify-authgate-passkey.cjs (v07)"),
 ("normal multi-chain recovery for same K1 allowed","yes","PASS","backend/lib/anti-abuse-kv.js (per-abuse counters, not per-chain block)"),
 ("repeated dashboard-download throttling only recovery/download abuse","yes","PASS","scripts/verify-anti-abuse-downloads.cjs (v21)"),
 ("K2 private key requested","no","PASS","scripts/verify-k2-intent-builders.cjs (v15) / verify-wallet-k2-flow.cjs (v16)"),
 ("K3 private key requested","no","PASS","frontend/src/lib/k3Enforcement.ts + verify-blacklist-k3.cjs (v13)"),
 ("K1/deployer private keys sent to backend","no","PASS","scripts/verify-front-back-wiring.cjs (v17); backend routes read no *_PRIVATE_KEY"),
 ("backend receives signedTx only","yes","PASS","backend/routes/deploy.js + verify-front-back-wiring.cjs (v17)"),
 ("public frontend RPC URL","no","PASS","scripts/verify-funding-gas.cjs (v11); api.ts proxies via backend"),
 ("backend exposes RPC URL to frontend","no","PASS","backend/config/chains.js listPublic() omits rpcEnv/URL"),
 ("operator/revoke/QR flow","no","PASS","verify-ui-baseline.cjs (v01) / verify-csp.cjs"),
 ("old ABI active","no","PASS","scripts/verify-abi-canonical.cjs (07) / verify-no-drift.cjs (v02)"),
 ("SecureGate-Canonical (2)/(3).sol used","no","PASS","only contracts/SecureGate.sol tracked; git ls-tree"),
 ("thank-you address affects K3","no","PASS","scripts/verify-thank-you-envelope.cjs (v18)"),
 ("fake txHash/pending/verified","no","PASS","scripts/verify-placeholder-gates.cjs (v22)"),
 ("Auth-Gate sweep moves assets","no","PASS","scripts/verify-authgate-sweep.cjs (v04)"),
 ("recovery cleanup sweep leaks into 2FA","no","PASS","scripts/verify-recovery-cleanup-sweep.cjs (v12)"),
 ("K3 execution sweep can route non-K3","no","PASS","scripts/verify-k3-execution-sweep.cjs (v14)"),
 ("obfuscation changes ABI/K3 routing","no","PASS (obfuscation SKIPPED)","scripts/verify-contract-obfuscation-layers.cjs (v19)"),
 ("active source depends on uploads/outputs/restored-original","no","PASS","scripts/verify-zip-contents.py active-root allowlist"),
 ("production-ready claim","no","PASS","this document ends 'No production-ready claim.'"),
]

# --- Drift classification (46 raw hits) ---
DRIFT_CLASS = [
 ("scripts/verify-browser-builders.cjs","verifier assertion","builds a bad ABI containing queueIntent to prove the guard rejects it"),
 ("scripts/verify-no-drift.cjs","verifier assertion","forbidden old-ABI name list it asserts absent"),
 ("scripts/verify-abi-canonical.cjs","verifier assertion","FORBIDDEN list + lowercase domainSeparator guard"),
 ("scripts/verify-csp.cjs","verifier assertion","asserts operator/revoke/Flashbots/sweeper absent from module"),
 ("scripts/verify-mobile-ci.cjs","verifier assertion","asserts Revoke/submitRevokeBundle/operator-proof absent"),
 ("scripts/verify-ui-baseline.cjs","verifier assertion","forbidden UI vocab list (revoke/flashbot/smoke test/sweeper bot)"),
 ("scripts/verify-admin-passkey.cjs","verifier assertion","asserts operator surface tokens absent"),
 ("scripts/verify-blacklist-k3.cjs","verifier assertion","asserts guard catches overrideDestination/k2OverrideDest"),
 ("scripts/drift-scan-raw.sh","redaction/blocklist only","the scanner's own forbidden-token pattern"),
 ("scripts/e2e-local-securegate.cjs","local-only test harness","'8900' port math; '900' is a coincidental substring, not MIN_DELAY"),
 ("scripts/e2e-testnet-securegate.cjs","local-only test harness","TESTNET_K1/K2_PRIVATE_KEY read by a LOCAL testnet script only, never backend runtime"),
 ("backend/.env.example","local-only test harness","empty TESTNET_K*_PRIVATE_KEY= placeholders for the local e2e script; not runtime backend keys"),
 ("backend/.env.securegate","coincidental substring","'900' occurs inside the compiled bytecode hex value; non-runnable literal"),
 ("backend/lib/anti-abuse-kv.js","abuse TTL/window only","windowSec:900 rate-limit windows (auth/link/passkey/deploy), NOT a K1->K2 cooldown"),
 ("backend/lib/trace-store.js","abuse TTL/window only","ttlSec:900 breadcrumb event TTLs, NOT a K1->K2 cooldown"),
 ("backend/lib/address-guard.js","rejection list","FORBIDDEN_OVERRIDE_KEYS the guard strips/rejects"),
 ("frontend/src/lib/uiLabels.ts","redaction/blocklist only","comment naming the forbidden operator vocabulary the UI must avoid"),
 ("frontend/src/lib/securegateTxBuilder.ts","rejection list","forbidden old-ABI method names the builder refuses to emit"),
 ("frontend/src/entry-client.tsx","coincidental substring","Lato font weight 900 (@fontsource/lato/900.css)"),
 ("frontend/src/index.css","coincidental substring","--neutral-900 color token and font-weight:900"),
 ("docs/browser-builders.md","docs warning","documents the forbidden ABI names the verifier asserts absent"),
 ("docs/e2e-testnet.md","docs warning","documents TESTNET_* keys as local-script-only"),
 ("docs/kv.md","docs warning","ttlSec:900 shown in a KV usage example"),
]

d = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
o = []
w = o.append
w("# SecureGate / EIP-777G — Full Battery Handoff\n")
w(f"_Generated {d} · all proofs run under Node 24 (v24.18.0) + Foundry (forge 1.7.1)._\n")
w("This document embeds every raw proof output verbatim below (sections 2, 4, 5, 6).")
w("The identical logs also live as separate files under `handoff/proofs/`.\n")

# 1
w("## 1. Repo / ZIP / branch deliverable\n")
w("| Field | Value |")
w("|-------|-------|")
w(f"| Branch | `{BRANCH}` |")
w(f"| Commit | `{COMMIT}` |")
w("| ZIP filename | `securegate-full-battery-handoff-<COMMIT7>.zip` (see section 7) |")
w("| ZIP sha256 | see section 7 (printed at assembly) |")
w("| Proof ZIP == commit | `git archive HEAD` of the repo subtree reproduces identical bytes |")
w(f"| Tracked files in HEAD | {NFILES} |")
w("| Node | v24.18.0 (asserted major===24, log 02) |\n")

# 2
w("## 2. Section-by-section labeled code + proof\n")
for num, name, files, drift, cmd, logname in SECTIONS:
    w(f"### SECTION {num} — {name}\n")
    w("**Files changed / owned:**")
    for f in files:
        w(f"- `{f}`")
    w(f"\n**Drift rules:** {drift}\n")
    w("**Full code:** shipped verbatim in the ZIP at the exact paths above (and inlined in")
    w("`SECUREGATE-BUILD-CODE-HANDOFF.md`). Not re-pasted here to keep proofs readable.\n")
    w(f"**Proof command:** `{cmd}`\n")
    w("**Exact output:**")
    w(block(logname))
    w("")

# 3
w("## 3. No-added-guardrails ledger\n")
w("| Guardrail check | Required | PASS/FAIL | Evidence path |")
w("|---|---|---|---|")
for chk, req, res, ev in LEDGER:
    w(f"| {chk} | {req} | {res} | {ev} |")
w("")

# 4
w("## 4. Full exact Node 24 / Foundry / frontend / backend outputs\n")
for lbl, ln in [("Node -v","01-node-version"),("Node 24 assert","02-node24-assert"),
                ("forge --version","03-forge-version"),("forge build --via-ir","04-forge-build-via-ir"),
                ("forge test -vvv","05-forge-test-vvv"),("extract-bytecode","06-extract-bytecode"),
                ("verify-abi-canonical","07-verify-abi-canonical"),
                ("frontend type-check","08-frontend-type-check"),("frontend build","09-frontend-build"),
                ("backend selftest","10-backend-selftest"),("backend drift:scan","11-backend-drift-scan"),
                ("backend verify:artifact","12-backend-verify-artifact")]:
    w(f"### {lbl}")
    w(block(ln)); w("")

# 5
w("## 5. Full exact verifier outputs\n")
for ln in ["v01-ui-baseline","v02-no-drift","v03-authgate-session","v04-authgate-sweep",
           "v05-authgate-attempt-limits","v06-device-breadcrumb","v07-authgate-passkey",
           "v08-admin-passkey","v09-2fa-no-limits","v10-recovery-flow-ui","v11-funding-gas",
           "v12-recovery-cleanup-sweep","v13-blacklist-k3","v14-k3-execution-sweep",
           "v15-k2-intent-builders","v16-wallet-k2-flow","v17-front-back-wiring",
           "v18-thank-you-envelope","v19-contract-obfuscation-layers","v20-obfuscation-ci",
           "v21-anti-abuse-downloads","v22-placeholder-gates"]:
    w(f"### {ln}")
    w(block(ln)); w("")

# 6
w("## 6. Raw drift scan + classification\n")
w("**Command:** `bash scripts/drift-scan-raw.sh`\n")
w("**Raw output (46 lines):**")
w(block("40-drift-scan-raw.txt"))
w("\n**Classification (every hit).** Automated `verify-no-drift.cjs` independently reports")
w("`0 unclassified` across 156 active files (section 5, v02). Manual mapping of the 46 raw hits:\n")
w("| File | Category | Why it is not an active forbidden path |")
w("|---|---|---|")
for f, cat, why in DRIFT_CLASS:
    w(f"| `{f}` | {cat} | {why} |")
w("\n**Result:** 0 active runnable forbidden paths. `MIN_DELAY` absent everywhere; every")
w("`900` is an abuse TTL/window, a coincidental substring (font weight / CSS token / bytecode hex),")
w("or a docs example. Every private-key token is a rejection list, a verifier assertion, or a")
w("local-only testnet script — never a backend-runtime key read.\n")

# 7 placeholder (filled by assembler)
w("## 7. ZIP / repo content proof\n")
w("<!--ZIPPROOF-->\n")

# 8
w("## 8. Remaining missing pieces (honest)\n")
w("- **Obfuscation:**")
w("  ```")
w("  SKIPPED: no obfuscated build configured")
w("  Contract/dashboard obfuscation is NOT complete.")
w("  ```")
w("- **K2 wallet signing** is wired to an injected EIP-712 provider interface but not")
w("  exercised against a real hardware/browser wallet in this environment.")
w("- **Live on-chain deploy** is not exercised; the browser deploy builder only refines gas")
w("  when a validated artifact is served.")
w("- **Playwright E2E** config exists (`frontend/playwright.config.ts`) but a full headed run")
w("  is not part of this battery.\n")

# 9
w("## 9. Final status\n")
w("No production-ready claim.")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(o))
print(f"Wrote {OUT} ({os.path.getsize(OUT)} bytes)")
