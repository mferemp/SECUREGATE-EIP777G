# SecureGate / EIP-777G - Finalization Master Prompt

## TL;DR

**Use the prompt below.** It is stricter than the last one because it resolves the final delivery-format problem: the decoded `securegate-eip777g-final.zip` passed the source gate, but the workspace wrapper ZIP failed, and stale handoff files still remained. This prompt forces the builder to deliver the actual final source ZIP directly, plus a separate proof bundle/handoff, with no base64-only artifact, no failed workspace wrapper, no stale `HANDOFF.md`, and no circular hash claims inside the source ZIP.

---

## What This Prompt Fixes

The last package showed a real breakthrough:

```txt
decoded securegate-eip777g-final.zip:
PASS dotfiles
PASS content gate
PASS no forbidden roots
PASS canonical ABI
```

But the handoff was still messy:

```txt
workspace ZIP failed content gate
actual final ZIP was embedded in Markdown/base64 instead of attached directly
root HANDOFF.md still had missing-log placeholders
proof logs were not self-contained inside the clean source ZIP
```

So the final ask should split the deliverable cleanly:

```txt
1. Final source ZIP: securegate-eip777g-final.zip
   - active repo root source
   - passes verify-zip-contents.cjs
   - no proof-wrapper junk
   - no stale handoff placeholders

2. Final proof bundle/handoff:
   - exact Node 24 / Foundry / frontend / backend / verifier outputs
   - exact SHA256 of the source ZIP
   - raw drift scan + classification
   - no-added-guardrails ledger
```

That avoids circular hash problems and makes acceptance binary.

---

## Paste-Ready Master Prompt

```txt
You are finalizing SecureGate / EIP-777G.

This is the final artifact handoff. Do not return prose-only status, old markdown packs, partial snippets, work records, base64-only artifacts, failed workspace exports, or claims that are not proven by the exact delivered file.

The previous package showed that the embedded `securegate-eip777g-final.zip` source payload can pass the strict source gate, but the directly attached workspace ZIP failed and stale handoff files remained.

Your job now is to produce the final clean deliverable set:

  1. securegate-eip777g-final.zip
     The actual source ZIP, attached directly as a real ZIP file.

  2. securegate-eip777g-final-proof.zip or SECUREGATE-EIP777G-FINAL-HANDOFF.md
     A proof bundle/handoff containing exact raw outputs and classifications.

Do not submit a workspace wrapper ZIP as the final source artifact unless that exact ZIP itself passes the source ZIP gate.

Do not submit only a base64 Markdown carrier. Base64 may be provided only as an optional fallback after the real ZIP is attached.

Final status must remain:

  No production-ready claim.

================================================================
0. ABSOLUTE ACCEPTANCE RULE
================================================================

The only accepted source artifact is:

  securegate-eip777g-final.zip

That exact ZIP must pass:

  scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip

It must print:

  [PASS] ZIP content gate satisfied

If the exact delivered source ZIP fails that command, the project is not final.

Markdown claims do not count.
A verifier run on a different ZIP does not count.
A workspace wrapper ZIP does not count.
A base64 carrier does not count unless decoded bytes match the declared SHA256 and the decoded ZIP passes the gate.
A sidecar hash for a different ZIP does not count.
A clean git status before later proof generation does not count.

================================================================
1. DELIVERABLE SHAPE
================================================================

Return exactly this deliverable set:

A. Final source ZIP:

  securegate-eip777g-final.zip

This ZIP must be active-root source only. It must contain the repo source at root, not under a nested folder.

B. Final proof handoff:

  SECUREGATE-EIP777G-FINAL-HANDOFF.md

or

  securegate-eip777g-final-proof.zip

The proof handoff may contain logs, raw outputs, drift classifications, and the source ZIP hash.

C. Optional fallback only:

  securegate-eip777g-final.zip.b64.txt

Only provide this if the platform blocks direct ZIP transfer. If provided, it must use a robust decode command that skips comment lines:

  awk '!/^#/' securegate-eip777g-final.zip.b64.txt | base64 -d > securegate-eip777g-final.zip

Then verify:

  sha256sum securegate-eip777g-final.zip
  scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip

Do not make the base64 file the primary artifact.

================================================================
2. FINAL SOURCE ZIP CONTENT RULES
================================================================

The final source ZIP must contain these files at active repo root:

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

Canonical contract/artifact:

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

Verifier scripts:

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
3. FINAL SOURCE ZIP EXCLUSIONS
================================================================

The final source ZIP must not contain:

  uploads/
  outputs/
  restored-original-*
  _stitch_zip/
  node_modules/
  .git/
  nested stale ZIPs
  stale .sha256 sidecars for another ZIP
  base64 ZIP carriers
  old generated proof packs as active source
  stale root HANDOFF.md with "(missing log: ...)" placeholders
  stale "Total entries in ZIP: 669" or other mismatched archive claims
  old production-ready manuals
  old operator/revoke/QR/Flashbots public material

If `HANDOFF.md` remains in the source ZIP, it must be current, must have no missing-log placeholders, and must not claim a different ZIP/hash/entry count.

Safer option:

  Remove stale root HANDOFF.md from the source ZIP.
  Put final proof text in the separate proof handoff instead.

================================================================
4. CLEAN PACKAGING COMMAND
================================================================

Do not use a packaging command that drops dotfiles.

Use an explicit packaging script or Python zip builder that includes:

  .node-version
  .nvmrc
  .npmrc

and excludes forbidden paths.

Before delivery, prove the exact source ZIP contains the dotfiles:

  python3 - <<'PY'
  import zipfile
  p = "securegate-eip777g-final.zip"
  with zipfile.ZipFile(p) as z:
      names = set(z.namelist())
      for f in [".node-version", ".nvmrc", ".npmrc"]:
          assert f in names, f"missing {f}"
      assert z.read(".node-version").decode().strip() == "24"
      assert z.read(".nvmrc").decode().strip() == "24"
      assert "engine-strict=true" in z.read(".npmrc").decode()
      print("dotfiles verified in exact ZIP")
  PY

Then run:

  scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip

Required result:

  [PASS] ZIP content gate satisfied

================================================================
5. ARCHITECTURE THAT MUST BE PRESERVED
================================================================

Preserve the current SecureGate / EIP-777G security model:

  K1 initiates / proves ownership / binds session.
  K2 authorizes only via scoped typed-data signature.
  K3 is immutable forced destination.
  Backend receives signedTx only.
  Backend never receives private keys.
  RPC URLs are backend-env only.
  Thank-you address is separate from K3 and cannot affect routing.

Do not add backend K1 private-key custody.
Do not add backend deployer private-key custody.
Do not add K2/K3 private-key fields.
Do not add server-side K2 signing.
Do not allow K3 override parameters.
Do not accept fake signedTx or pending txHash placeholders as successful.

================================================================
6. CANONICAL ABI GATE
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

The proof handoff must show:

  abi_entries: 37
  bytecode_bytes: 7030
  missing_required: []
  bad_present: []

================================================================
7. NODE 24 / FOUNDRY PROOF COMMANDS
================================================================

Run and capture exact outputs.

Repository proof:

  git rev-parse HEAD
  git branch --show-current
  git status --short
  git ls-tree -r --name-only HEAD | wc -l

Required:

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

Expected minimum:

  forge build --via-ir exits 0
  forge test -vvv exits 0
  4 tests passed / 0 failed
  bytecode 7030 bytes
  ABI 37 entries
  verify-abi-canonical 22 passed / 0 failed

================================================================
8. FRONTEND / BACKEND PROOF COMMANDS
================================================================

Run and capture exact outputs:

  cd frontend
  ../scripts/with-node24.sh npm run type-check
  ../scripts/with-node24.sh npm run build
  cd ../backend
  ../scripts/with-node24.sh npm run selftest
  ../scripts/with-node24.sh npm run drift:scan
  ../scripts/with-node24.sh npm run verify:artifact
  cd ..

Expected minimum:

  frontend type-check exits 0
  frontend build exits 0
  backend selftest exits 0
  backend drift:scan exits 0
  backend verify:artifact exits 0

================================================================
9. VERIFIER BATTERY
================================================================

Run and capture exact outputs:

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

Every verifier must exit 0, except obfuscation may honestly skip if no obfuscated build exists.

If obfuscation is not configured, say exactly:

  SKIPPED: no obfuscated build configured
  Contract/dashboard obfuscation is NOT complete.

Do not claim obfuscation complete unless there is a real obfuscated build and equivalence proof.

================================================================
10. PUBLIC UI COPY GATE
================================================================

Public recovery progress labels must be exactly:

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

Technical terms may exist only in:

  internal code
  verifier assertions
  docs warnings
  redaction/blocklists
  hidden developer-only contexts

They must not be public product copy.

================================================================
11. /api/rpc RULE
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
12. FORBIDDEN DRIFT
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
13. SOURCE HIERARCHY
================================================================

Use this source hierarchy:

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
14. NO-ADDED-GUARDRAILS LEDGER
================================================================

The proof handoff must include a pass/fail ledger for:

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
15. FINAL SOURCE ZIP VERIFICATION
================================================================

After creating `securegate-eip777g-final.zip`, run:

  sha256sum securegate-eip777g-final.zip

Then run:

  scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip

Required output:

  [PASS] standard ZIP central directory parsed (...)
  [PASS] all 70 required active-root files present
  [PASS] no uploads/, outputs/, restored-original-*, _stitch_zip/, node_modules/, or .git paths
  [PASS] ZIP content gate satisfied

Also run:

  python3 - <<'PY'
  import zipfile
  p = "securegate-eip777g-final.zip"
  with zipfile.ZipFile(p) as z:
      names = set(z.namelist())
      for f in [".node-version", ".nvmrc", ".npmrc"]:
          assert f in names, f"missing {f}"
      assert z.read(".node-version").decode().strip() == "24"
      assert z.read(".nvmrc").decode().strip() == "24"
      assert "engine-strict=true" in z.read(".npmrc").decode()
      print("dotfiles verified in exact ZIP")
  PY

Required output:

  dotfiles verified in exact ZIP

================================================================
16. FINAL RESPONSE FORMAT
================================================================

Return only:

  1. Branch
  2. Commit
  3. `git status --short` output
  4. Final source ZIP filename
  5. Final source ZIP SHA256
  6. Proof bundle/handoff filename
  7. Exact proof that the source ZIP was built from the clean commit
  8. Exact output of `scripts/with-node24.sh node -v`
  9. Exact output of Node 24 assert
  10. Exact output of `forge --version`
  11. Exact output of `forge build --via-ir`
  12. Exact output of `forge test -vvv`
  13. Exact output of `node scripts/extract-bytecode.js`
  14. Exact output of `node scripts/verify-abi-canonical.cjs`
  15. Exact output of frontend/backend checks
  16. Exact output of verifier battery
  17. Exact output of `scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip`
  18. Exact dotfile verification output
  19. Raw drift scan + classification
  20. No-added-guardrails ledger
  21. Remaining missing pieces

Do not include:
  - a failed workspace wrapper as the final artifact
  - only a base64 Markdown carrier
  - stale `HANDOFF.md` with missing-log placeholders
  - old restored/upload/output roots
  - nested stale ZIPs
  - stale `.sha256` for another ZIP
  - production-ready wording

Final line must be exactly:

  No production-ready claim.
```

---

## Acceptance Logic

Use this rule when the builder returns the next package:

| Item | Accept only if |
|---|---|
| Source ZIP | The actual `securegate-eip777g-final.zip` is directly attached and passes `verify-zip-contents.cjs`. |
| Dotfiles | `.node-version`, `.nvmrc`, `.npmrc` are inside that exact ZIP with correct contents. |
| Proof bundle | Contains exact raw Node 24, Foundry, frontend, backend, verifier, drift, and ledger outputs. |
| Handoff text | No stale missing-log placeholders or mismatched ZIP entry/hash claims. |
| Workspace ZIP | Ignored unless it also passes the same source gate. |
| Base64 Markdown | Fallback only; decoded ZIP must match hash and pass the gate. |
| Production readiness | No production-ready claim allowed. |

---

## Conclusion

This is the clean finalization prompt: it preserves the passing source artifact path, prevents another failed workspace-wrapper submission, and separates source ZIP acceptance from proof-bundle evidence so the builder cannot hide behind Markdown claims.

**Bottom line.** Send this prompt and accept only a directly attached `securegate-eip777g-final.zip` that passes the source gate, plus a separate proof handoff with exact logs.

No production-ready claim.