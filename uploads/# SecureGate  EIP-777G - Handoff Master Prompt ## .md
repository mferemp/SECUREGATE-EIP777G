# SecureGate / EIP-777G - Handoff Master Prompt

## TL;DR

**The last handoff prompt was strong, but not the strictest possible.** The strictest version should make the acceptance gate binary: the builder must deliver the **exact final ZIP**, the **exact ZIP must include dotfiles**, and `scripts/verify-zip-contents.cjs <FINAL_ZIP>` must pass on that same file. No claims, handoff text, sidecars, or “workspace export behavior” can override the actual ZIP contents.

Use the master prompt below.

---

## Verdict

**No — the previous prompt was clear, but this version is stricter.** The key improvement is that it removes every loophole the builder just used:

```txt
"dotfiles present" in markdown does not count.
"studio export strips dotfiles" does not count.
"verifier passed on another ZIP" does not count.
"git proof clean before handoff changed" does not count.
"sidecar references another ZIP" does not count.
```

Acceptance must depend only on the **actual delivered ZIP**.

---

## Why This Version Is Stricter

The current blocker is not architecture anymore; it is artifact integrity. ZIP 27 fixed several things, but the actual ZIP still failed because:

```txt
.node-version missing
.nvmrc missing
.npmrc missing
```

So the strictest prompt must force the builder to package dotfiles and prove the verifier passes on the final attached ZIP, not on a different local/export-equivalent archive.

The master prompt also needs to prevent three recurring failure modes:

| Failure mode | Strict fix |
|---|---|
| Markdown says fixed, ZIP says not fixed | ZIP wins; markdown claims ignored unless exact ZIP proves them |
| Verifier run on another archive | Must run on final delivered ZIP path |
| Dotfiles lost by packaging/export | Packaging command must explicitly include dotfiles |

---

## Paste-Ready Master Prompt

```txt
You are finalizing SecureGate / EIP-777G.

This is a strict artifact handoff, not a narrative handoff. Do not return prose-only status, summaries, partial snippets, old markdown packs, work records, or claims that are not proven by the exact delivered ZIP.

The previous ZIP was close but rejected because the actual delivered ZIP failed its own verifier:

  [FAIL] missing required active-root file: .node-version
  [FAIL] missing required active-root file: .nvmrc
  [FAIL] missing required active-root file: .npmrc

Your job is to produce one final clean ZIP/branch that passes the exact acceptance gate below.

================================================================
0. ABSOLUTE ACCEPTANCE RULE
================================================================

The only artifact that matters is the exact final ZIP you deliver.

Claims in markdown do not count unless they match the exact ZIP.
A verifier run on another local ZIP does not count.
A sidecar hash for another ZIP does not count.
A "studio export equivalent" does not count unless it is the exact delivered ZIP.
A clean git status before later generated files does not count.

The final delivered ZIP itself must pass:

  scripts/with-node24.sh node scripts/verify-zip-contents.cjs <FINAL_ZIP>

It must print:

  [PASS] ZIP content gate satisfied

If it does not, the handoff is rejected.

================================================================
1. STARTING POINT
================================================================

Start from the current near-final SecureGate / EIP-777G repo/ZIP, preserving the accepted architecture:

- K1 initiates / proves ownership / binds session.
- K2 authorizes only via scoped typed-data signature.
- K3 is immutable forced destination.
- Backend receives signedTx only.
- Backend never receives private keys.
- RPC URLs are backend-env only.
- Thank-you address is separate from K3 and cannot affect routing.
- contracts/SecureGate.sol is canonical.
- out/SecureGate.sol/SecureGate.json is canonical ABI/artifact.
- Node 24 is mandatory.
- No production-ready claim.

Do not replace the current SecureGate architecture with old queue/operator/revoke/Flashbots/manual material.

================================================================
2. REQUIRED ACTIVE-ROOT FILES
================================================================

The final ZIP must contain these files at active repo root paths.

Node 24 enforcement:

  .node-version
  .nvmrc
  .npmrc
  scripts/bootstrap-node24.sh
  scripts/with-node24.sh

Exact contents:

  .node-version:
  24

  .nvmrc:
  24

  .npmrc:
  engine-strict=true

Package engines:

  backend/package.json engines.node = ">=24 <25"
  frontend/package.json engines.node = ">=24 <25"

Contract/artifact:

  contracts/SecureGate.sol
  test/SecureGate.t.sol
  foundry.toml
  script/DeploySecureGate.s.sol
  out/SecureGate.sol/SecureGate.json
  scripts/extract-bytecode.js
  scripts/verify-abi-canonical.cjs

ZIP verifier:

  scripts/verify-zip-contents.cjs

Frontend/backend core:

  frontend/src/App.tsx
  frontend/src/index.css
  frontend/src/lib/uiLabels.ts
  frontend/src/lib/authGateSession.ts
  frontend/src/lib/authGateSweep.ts
  frontend/src/lib/authGateAttempts.ts
  frontend/src/lib/deviceBreadcrumb.ts
  frontend/src/lib/passkeyAccess.ts
  frontend/src/lib/adminPasskey.ts
  frontend/src/lib/twoFactorProactive.ts
  frontend/src/lib/recoveryCleanupSweep.ts
  frontend/src/lib/securegateTxBuilder.ts
  frontend/src/lib/securegateIntentHash.ts
  frontend/src/lib/securegateK2Authorization.ts
  frontend/src/lib/securegateWalletProvider.ts
  frontend/src/lib/k3Enforcement.ts
  frontend/src/lib/k3ExecutionSweep.ts
  frontend/src/lib/thankYouEnvelope.ts
  frontend/src/lib/placeholderGates.ts
  frontend/src/lib/api.ts

  backend/server.js
  backend/config/chains.js
  backend/routes/artifact.js
  backend/routes/funding.js
  backend/routes/deploy.js
  backend/routes/runtime.js
  backend/routes/trace.js
  backend/routes/thank-you.js
  backend/routes/passkeys.js
  backend/routes/admin-passkey.js
  backend/lib/address-guard.js
  backend/lib/trace-store.js
  backend/lib/passkey-store.js
  backend/lib/anti-abuse-kv.js

Verifier battery:

  scripts/verify-ui-baseline.cjs
  scripts/verify-no-drift.cjs
  scripts/verify-authgate-session.cjs
  scripts/verify-authgate-sweep.cjs
  scripts/verify-authgate-attempt-limits.cjs
  scripts/verify-authgate-passkey.cjs
  scripts/verify-admin-passkey.cjs
  scripts/verify-2fa-no-limits.cjs
  scripts/verify-recovery-flow-ui.cjs
  scripts/verify-funding-gas.cjs
  scripts/verify-recovery-cleanup-sweep.cjs
  scripts/verify-blacklist-k3.cjs
  scripts/verify-k3-execution-sweep.cjs
  scripts/verify-k2-intent-builders.cjs
  scripts/verify-wallet-k2-flow.cjs
  scripts/verify-front-back-wiring.cjs
  scripts/verify-thank-you-envelope.cjs
  scripts/verify-contract-obfuscation-layers.cjs
  scripts/verify-obfuscation-ci.cjs
  scripts/verify-anti-abuse-downloads.cjs
  scripts/verify-placeholder-gates.cjs

================================================================
3. REQUIRED ZIP RULES
================================================================

The final delivered ZIP must be a standard valid ZIP.

It must not contain:

  uploads/
  outputs/
  restored-original-*
  _stitch_zip/
  node_modules/
  .git/
  old markdown proof packs as active source
  nested stale ZIPs
  stale .sha256 sidecars for another ZIP

Important: dotfiles must be included. Do not use a packaging command that drops:

  .node-version
  .nvmrc
  .npmrc

Before delivery, prove the actual final ZIP contains them:

  python3 - <<'PY'
  import zipfile, sys
  p = sys.argv[1]
  with zipfile.ZipFile(p) as z:
      names = set(z.namelist())
      for f in [".node-version", ".nvmrc", ".npmrc"]:
          assert f in names, f"missing {f}"
      assert z.read(".node-version").decode().strip() == "24"
      assert z.read(".nvmrc").decode().strip() == "24"
      assert "engine-strict=true" in z.read(".npmrc").decode()
      print("dotfiles verified in exact ZIP")
  PY <FINAL_ZIP>

================================================================
4. REQUIRED COMMANDS
================================================================

Run every command under Node 24 where applicable.

Repository proof:

  git rev-parse HEAD
  git branch --show-current
  git status --short
  git ls-tree -r --name-only HEAD | wc -l

Required result:

  git status --short

must print nothing.

Node proof:

  scripts/with-node24.sh node -v

Must print Node 24, for example:

  v24.18.0

Node assert:

  scripts/with-node24.sh node - <<'NODE'
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 24) {
    console.error(`Wrong Node: ${process.version}`);
    process.exit(1);
  }
  console.log(`Node 24 verified: ${process.version}`);
  NODE

Foundry/artifact proof:

  scripts/with-node24.sh forge --version
  scripts/with-node24.sh forge build --via-ir
  scripts/with-node24.sh forge test -vvv
  scripts/with-node24.sh node scripts/extract-bytecode.js
  scripts/with-node24.sh node scripts/verify-abi-canonical.cjs

Frontend/backend proof:

  cd frontend
  ../scripts/with-node24.sh npm run type-check
  ../scripts/with-node24.sh npm run build
  cd ../backend
  ../scripts/with-node24.sh npm run selftest
  ../scripts/with-node24.sh npm run drift:scan
  ../scripts/with-node24.sh npm run verify:artifact
  cd ..

Verifier battery:

  scripts/with-node24.sh node scripts/verify-ui-baseline.cjs
  scripts/with-node24.sh node scripts/verify-no-drift.cjs
  scripts/with-node24.sh node scripts/verify-authgate-session.cjs
  scripts/with-node24.sh node scripts/verify-authgate-sweep.cjs
  scripts/with-node24.sh node scripts/verify-authgate-attempt-limits.cjs
  cd backend && ../scripts/with-node24.sh node scripts/verify-device-breadcrumb.cjs && cd ..
  scripts/with-node24.sh node scripts/verify-authgate-passkey.cjs || scripts/with-node24.sh node backend/scripts/verify-passkey-lane.cjs
  scripts/with-node24.sh node scripts/verify-admin-passkey.cjs
  scripts/with-node24.sh node scripts/verify-2fa-no-limits.cjs
  scripts/with-node24.sh node scripts/verify-recovery-flow-ui.cjs
  scripts/with-node24.sh node scripts/verify-funding-gas.cjs
  scripts/with-node24.sh node scripts/verify-recovery-cleanup-sweep.cjs
  scripts/with-node24.sh node scripts/verify-blacklist-k3.cjs
  scripts/with-node24.sh node scripts/verify-k3-execution-sweep.cjs
  scripts/with-node24.sh node scripts/verify-k2-intent-builders.cjs
  scripts/with-node24.sh node scripts/verify-wallet-k2-flow.cjs
  scripts/with-node24.sh node scripts/verify-front-back-wiring.cjs
  scripts/with-node24.sh node scripts/verify-thank-you-envelope.cjs
  scripts/with-node24.sh node scripts/verify-contract-obfuscation-layers.cjs
  scripts/with-node24.sh node scripts/verify-obfuscation-ci.cjs
  scripts/with-node24.sh node scripts/verify-anti-abuse-downloads.cjs
  scripts/with-node24.sh node scripts/verify-placeholder-gates.cjs

Final ZIP proof:

  sha256sum <FINAL_ZIP>
  scripts/with-node24.sh node scripts/verify-zip-contents.cjs <FINAL_ZIP>

The ZIP verifier must pass on the exact final ZIP you deliver.

================================================================
5. CANONICAL ABI GATE
================================================================

The canonical artifact is:

  out/SecureGate.sol/SecureGate.json

Required ABI signatures:

  DOMAIN_SEPARATOR()
  GATE_CHAIN_ID()
  K1()
  K2()
  K3()
  authorizeIntent(bytes32,bytes)
  computeAuthorizationDigest(bytes32)
  computeIntentHash(uint8,address,uint256,uint256,bytes32,uint256)
  executeIntent(bytes32)
  intents(bytes32)
  queueERC1155(address,uint256,uint256,bytes32,uint256)
  queueERC20(address,uint256,bytes32,uint256)
  queueERC721(address,uint256,bytes32,uint256)
  recordAttemptedDestination(address)
  suspectDestination(address)
  usedNonces(bytes32)

Forbidden old ABI:

  queueIntent
  forwardERC20
  computeEIP712Digest
  domainSeparator

The final proof must show:

  abi entries: 37
  bytecode bytes: 7030
  required ABI present
  forbidden old ABI absent

================================================================
6. PUBLIC UI COPY GATE
================================================================

The public recovery progress labels must be exactly:

  Funding check
  Preparing gate
  Locking gate in
  Verifying protection
  Complete

No other public progress labels are allowed.

Public frontend copy must not expose:

  artifact
  queue
  authorizeIntent
  executeIntent
  txHash
  broadcast
  Flashbots
  smoke test
  sweeper bot
  DEPLOYMENT BUNDLE
  public RPC URLs
  browser process.env RPC
  visible Revoke flow
  QR flow

Technical terms may exist only in internal code, verifier assertions, docs warnings, redaction/blocklists, or hidden developer-only contexts. They must not be public product copy.

================================================================
7. /api/rpc RULE
================================================================

/api/rpc is allowed only if it is explicitly a backend-env read-only RPC bridge.

It must prove:

  no user-supplied RPC URLs
  no returned RPC URLs
  no private keys
  no seed phrases
  no override destination keys
  read/estimate methods only
  no raw tx broadcast
  broadcast remains backend/routes/deploy.js signedTx-only

If any of those are false, remove /api/rpc.

================================================================
8. FORBIDDEN DRIFT
================================================================

Reject the build if any active runnable source enables:

  queueIntent
  forwardERC20
  computeEIP712Digest
  domainSeparator
  operator-proof-input
  submitRevokeBundle
  submit-revoke-bundle
  getOperatorProof
  /api/recovery/execute
  /api/credentials
  /api/revoke
  /api/queue
  /api/authorize
  /api/execute
  OPERATOR_VEIL_PHRASE
  X-Operator-Proof
  visible Revoke flow
  QR flow
  Flashbots public wording
  smoke test public wording
  sweeper bot public wording
  DEPLOYMENT BUNDLE public wording
  public frontend RPC URLs
  browser process.env RPC
  server-side K2 signing
  backend K1 private-key custody
  backend deployer private-key custody
  K2 private-key field
  K3 private-key field
  overrideDestination acceptance
  overrideDest acceptance
  k2OverrideDest acceptance
  signedTx: "0x00"
  txHash: "pending"
  fake verified:true
  all-zero 65-byte placeholder signature accepted as valid
  EIP-712 project/architecture/invention naming drift
  production-ready claim

Every raw drift hit must be classified as exactly one of:

  rejection list
  verifier assertion
  docs warning
  redaction/blocklist only
  abuse TTL/window only
  backend-env read-only RPC bridge
  local-only test harness
  coincidental substring
  generated Foundry output

Unclassified active runnable drift is rejection.

================================================================
9. SOURCE HIERARCHY
================================================================

Use this hierarchy:

  UI_FRONTEND_SPECS = frontend shell/baseline
  securegate-dashboard = corrected product/dashboard behavior
  owner corrections = binding overrides

Quarantine:

  old operator material
  old revoke material
  old QR material
  old public-RPC material
  old production-ready claims
  old Flashbots/smoke/sweeper wording
  old backend private-key custody material
  old deployment-bundle public wording

Do not import stale manuals into active source.

================================================================
10. NO-ADDED-GUARDRAILS LEDGER
================================================================

Final handoff must include a pass/fail ledger for:

  UI_FRONTEND_SPECS shell preserved = yes
  securegate-dashboard behavior preserved = yes
  stale operator/revoke/QR copied = no
  2FA blocked by Auth-Gate/downloads/recovery counters = no
  900-second K1->K2 cooldown = no
  900 values only abuse TTL/window if present = yes
  K2/K3 private keys requested = no
  backend receives signedTx only = yes
  public frontend RPC URL = no
  /api/rpc if present is backend-env read-only bridge only = yes
  public progress labels are five canonical labels = yes
  production-ready claim = no

================================================================
11. OBFUSCATION HONESTY
================================================================

If no real obfuscated build is configured, say exactly:

  SKIPPED: no obfuscated build configured
  Contract/dashboard obfuscation is NOT complete.

Do not claim obfuscation is complete unless a real obfuscated build exists and passes equivalence checks without changing ABI, K3 routing, signedTx boundary, artifact extraction, or core execution.

================================================================
12. FINAL RESPONSE FORMAT
================================================================

Return only:

  branch
  commit
  git status --short output
  final ZIP filename
  final ZIP sha256
  exact proof that the ZIP was built from the clean commit
  exact output of scripts/with-node24.sh node -v
  exact output of forge build --via-ir
  exact output of forge test -vvv
  exact output of node scripts/extract-bytecode.js
  exact output of node scripts/verify-abi-canonical.cjs
  exact output of frontend/backend checks
  exact output of verifier battery
  exact output of scripts/with-node24.sh node scripts/verify-zip-contents.cjs <FINAL_ZIP>
  raw drift scan + classification
  no-added-guardrails ledger
  remaining missing pieces

Final line must be exactly:

  No production-ready claim.
```

---

## Acceptance Standard

This is the cleanest acceptance rule:

```txt
If the exact delivered ZIP fails verify-zip-contents.cjs, reject.
If the exact delivered ZIP lacks dotfiles, reject.
If git proof shows dirty status, reject.
If the handoff describes a different ZIP than the delivered ZIP, reject.
If any active source enables forbidden behavior, reject.
If there is any production-ready claim, reject.
```

Everything else is secondary.

---

## Conclusion

**Yes, this is now the strictest and clearest handoff prompt I would use.** It removes ambiguity, forces exact-artifact verification, blocks dotfile-loss packaging, and prevents markdown claims from substituting for source proof.

**Bottom line.** Send the paste-ready prompt above; the only acceptable next response is a corrected ZIP whose own verifier passes on the exact delivered file.

No production-ready claim.