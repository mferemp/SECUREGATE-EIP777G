# SecureGate / EIP-777G - Finalization Master Prompt

## TL;DR

**Use the prompt below.** It is stricter than the previous one because ZIP 33 proved the source artifact can pass, but the wrapper ZIP still failed. This prompt forces the builder to stop sending failed workspace wrappers and instead deliver the real `securegate-eip777g-final.zip` directly, plus a separate proof bundle.

The target source artifact from ZIP 33 is:

```txt
securegate-eip777g-final.zip
sha256: 198f0637d476848040b108e367551b8a071ed23d3e0cc1c9c0da98c3535f39a3
```

That decoded ZIP passed the strict content gate. The next/final delivery should attach that real ZIP directly.

---

## Current State

The project is essentially at **final-source-artifact pass**, but not **clean direct-delivery pass**.

What passed:

```txt
Decoded securegate-eip777g-final.zip from ZIP 33:
sha256 198f0637d476848040b108e367551b8a071ed23d3e0cc1c9c0da98c3535f39a3
entries 204
dotfiles present
verify-zip-contents.cjs passes
canonical ABI passes
```

What still failed:

```txt
workspace-c30e... (33).zip:
missing .node-version / .nvmrc / .npmrc at wrapper root
contains uploads/
contains prompt markdown under uploads/
fails verify-zip-contents.cjs
```

So the final ask is simple: **deliver the real final ZIP directly, not inside a failed wrapper.**

---

## Paste-Ready Master Prompt

```txt
You are finalizing SecureGate / EIP-777G.

This is the final artifact handoff. Do not return prose-only status, old markdown packs, partial snippets, work records, failed workspace wrapper ZIPs, or base64-only artifacts.

The previous package proved the source artifact can pass:

  securegate-eip777g-final.zip
  sha256: 198f0637d476848040b108e367551b8a071ed23d3e0cc1c9c0da98c3535f39a3

That decoded ZIP passed:

  [PASS] standard ZIP central directory parsed (204 entries)
  [PASS] all 70 required active-root files present
  [PASS] no uploads/, outputs/, restored-original-*, _stitch_zip/, node_modules/, or .git paths
  [PASS] ZIP content gate satisfied

But the workspace wrapper ZIP failed because it was missing root dotfiles and contained uploads/.

Your final job is not to invent new architecture. Your final job is to deliver the clean final source ZIP directly and provide a separate proof handoff.

================================================================
0. ABSOLUTE FINAL ACCEPTANCE RULE
================================================================

The only accepted source artifact is the actual file:

  securegate-eip777g-final.zip

It must be attached directly as a real ZIP file.

The final source ZIP itself must pass:

  scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip

Required output:

  [PASS] ZIP content gate satisfied

Nothing else counts.

Markdown claims do not count.
A verifier run on a different ZIP does not count.
A failed workspace wrapper ZIP does not count.
A base64-only carrier does not count.
A sidecar hash for another ZIP does not count.
A clean git status before later generated changes does not count.

If you cannot attach the real ZIP directly, say that explicitly and provide the exact blocker. Do not disguise a wrapper as the final source artifact.

================================================================
1. DELIVERABLES REQUIRED
================================================================

Return exactly these deliverables:

A. Final source ZIP:

  securegate-eip777g-final.zip

This is the active-root source artifact.

B. Final proof handoff:

  SECUREGATE-EIP777G-FINAL-HANDOFF.md

or:

  securegate-eip777g-final-proof.zip

This proof handoff may contain logs, raw outputs, drift classifications, and the source ZIP hash.

C. Optional fallback only if direct ZIP upload is blocked:

  securegate-eip777g-final.zip.b64.txt

If provided, it must decode with:

  awk '!/^#/' securegate-eip777g-final.zip.b64.txt | base64 -d > securegate-eip777g-final.zip

Then the decoded ZIP must match the declared SHA256 and pass:

  scripts/with-node24.sh node scripts/verify-zip-contents.cjs securegate-eip777g-final.zip

Base64 is fallback only. It is not the primary artifact.

================================================================
2. SOURCE ZIP CONTENT REQUIREMENTS
================================================================

The final source ZIP must contain active repo files at root, not under a nested directory.

Required Node 24 files:

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
3. SOURCE ZIP EXCLUSIONS
================================================================

The final source ZIP must not contain:

  uploads/
  outputs/
  restored-original-*
  _stitch_zip/
  node_modules/
  .git/
  nested stale ZIPs
  stale .sha256 files for another ZIP
  base64 ZIP carriers
  old generated proof packs as active source
  stale root HANDOFF.md with "(missing log: ...)" placeholders
  stale "Total entries in ZIP: 669" archive claims
  old production-ready manuals
  old operator/revoke/QR/Flashbots public material

The source ZIP should be clean source only.

If a handoff document is included inside the source ZIP, it must be current and must not contain missing-log placeholders or mismatched ZIP/hash/entry-count claims.

Safer rule:

  Keep proof handoff separate from the source ZIP.

================================================================
4. PRESERVE SECURITY ARCHITECTURE
================================================================

Preserve the current SecureGate / EIP-777G security model:

  K1 initiates / proves ownership / binds session.
  K2 authorizes only via scoped typed-data signature.
  K3 is immutable forced destination.
  Backend receives signedTx only.
  Backend never receives private keys.
  RPC URLs are backend-env only.
  Thank-you address is separate from K3 and cannot affect routing.

Do not add:

  backend K1 private-key custody
  backend deployer private-key custody
  K2 private-key field
  K3 private-key field
  server-side K2 signing
  K3 override parameters
  fake signedTx success
  pending txHash success
  all-zero 65-byte placeholder signatures as valid

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

The proof handoff must show:

  abi_entries: 37
  bytecode_bytes: 7030
  missing_required: []
  bad_present: []

================================================================
6. NODE 24 / FOUNDRY / ARTIFACT PROOF
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

Minimum expected proof:

  forge build --via-ir exits 0
  forge test -vvv exits 0
  4 tests passed / 0 failed
  bytecode 7030 bytes
  ABI 37 entries
  verify-abi-canonical 22 passed / 0 failed

================================================================
7. FRONTEND / BACKEND PROOF
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

Minimum expected proof:

  frontend type-check exits 0
  frontend build exits 0
  backend selftest exits 0
  backend drift:scan exits 0
  backend verify:artifact exits 0

================================================================
8. VERIFIER BATTERY
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

Do not claim obfuscation is complete unless there is a real obfuscated build and equivalence proof.

================================================================
9. SOURCE ZIP FINAL VERIFICATION
================================================================

After creating or attaching `securegate-eip777g-final.zip`, run:

  sha256sum securegate-eip777g-final.zip

If using the previously passing source artifact, expected hash:

  198f0637d476848040b108e367551b8a071ed23d3e0cc1c9c0da98c3535f39a3  securegate-eip777g-final.zip

If the source ZIP is rebuilt, the hash may change, but the new hash must be reported and the exact rebuilt ZIP must pass all checks.

Run:

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
15. FINAL RESPONSE FORMAT
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

  failed workspace wrapper ZIP as the final source artifact
  only a base64 Markdown carrier
  uploads/
  outputs/
  restored-original-*
  _stitch_zip/
  node_modules/
  .git/
  stale root HANDOFF.md with missing-log placeholders
  old restored/upload/output roots
  nested stale ZIPs
  stale .sha256 for another ZIP
  production-ready wording

Final line must be exactly:

  No production-ready claim.
```

---

## Acceptance Gate

Use this table to judge the next delivery.

| Item | Accept only if |
|---|---|
| Final source ZIP | Actual `securegate-eip777g-final.zip` is attached directly and passes `verify-zip-contents.cjs`. |
| Dotfiles | `.node-version`, `.nvmrc`, and `.npmrc` are inside that exact ZIP with correct contents. |
| Hash | SHA256 is declared for the exact delivered source ZIP. |
| Proof handoff | Contains exact raw Node 24, Foundry, frontend, backend, verifier, drift, and ledger outputs. |
| Wrapper ZIP | Ignored unless it also passes the exact same source gate. |
| Base64 fallback | Accepted only if direct ZIP transfer is blocked and decoded bytes match SHA256 + pass verifier. |
| Handoff text | No missing-log placeholders, no stale ZIP count, no mismatched hash claims. |
| Production readiness | No production-ready claim allowed. |

---

## Final Rejection Conditions

Reject if any of these happen again:

```txt
workspace wrapper is submitted as final source ZIP
source ZIP is only provided as base64 despite direct ZIP being possible
source ZIP lacks dotfiles
source ZIP contains uploads/
source ZIP contains stale HANDOFF.md with missing-log placeholders
proof bundle claims a ZIP/hash different from delivered artifact
git status proof is dirty
canonical ABI drifts
/api/rpc allows user RPC URLs or raw tx broadcast
public UI exposes technical recovery mechanics
production-ready claim appears
```

## Conclusion

This prompt closes the last loophole: **the source artifact has already passed when decoded; now it must be delivered directly as the final ZIP, with proof kept separate.**

**Bottom line.** Send this prompt and accept only the direct `securegate-eip777g-final.zip` source artifact plus a separate proof handoff.

No production-ready claim.