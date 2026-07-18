#!/usr/bin/env python3
"""verify-zip-contents.py — prove a build ZIP is a valid standard ZIP whose ACTIVE
implementation lives at the repo root, not inside quarantine dirs.

Checks:
  1. the file opens as a normal ZIP (central directory intact);
  2. every REQUIRED active-root file is present as a real entry;
  3. the ZIP does NOT rely on uploads/, outputs/, restored-original-*, or
     _stitch_zip/ for any REQUIRED active-root file;
  4. prints the sha256 of the ZIP and the active-root file count.

Usage:  python3 scripts/verify-zip-contents.py <ZIP_FILE>
Exit 0 only if all required active-root files are present as active source.
"""

import sys
import os
import hashlib
import zipfile

REQUIRED_ACTIVE_ROOT = [
    "contracts/SecureGate.sol",
    "test/SecureGate.t.sol",
    "foundry.toml",
    "script/DeploySecureGate.s.sol",
    "out/SecureGate.sol/SecureGate.json",
    "scripts/bootstrap-node24.sh",
    "scripts/with-node24.sh",
    "scripts/extract-bytecode.js",
    "scripts/verify-abi-canonical.cjs",
    "frontend/src/App.tsx",
    "frontend/src/index.css",
    "frontend/src/lib/uiLabels.ts",
    "frontend/src/lib/authGateSession.ts",
    "frontend/src/lib/authGateSweep.ts",
    "frontend/src/lib/authGateAttempts.ts",
    "frontend/src/lib/deviceBreadcrumb.ts",
    "frontend/src/lib/passkeyAccess.ts",
    "frontend/src/lib/adminPasskey.ts",
    "frontend/src/lib/twoFactorProactive.ts",
    "frontend/src/lib/recoveryCleanupSweep.ts",
    "frontend/src/lib/securegateTxBuilder.ts",
    "frontend/src/lib/securegateIntentHash.ts",
    "frontend/src/lib/securegateK2Authorization.ts",
    "frontend/src/lib/securegateWalletProvider.ts",
    "frontend/src/lib/k3Enforcement.ts",
    "frontend/src/lib/k3ExecutionSweep.ts",
    "frontend/src/lib/thankYouEnvelope.ts",
    "frontend/src/lib/placeholderGates.ts",
    "frontend/src/lib/api.ts",
    "backend/routes/artifact.js",
    "backend/routes/funding.js",
    "backend/routes/deploy.js",
    "backend/routes/runtime.js",
    "backend/routes/trace.js",
    "backend/routes/thank-you.js",
    "backend/routes/passkeys.js",
    "backend/routes/admin-passkey.js",
    "backend/lib/address-guard.js",
    "backend/lib/trace-store.js",
    "backend/lib/passkey-store.js",
    "backend/lib/anti-abuse-kv.js",
    "scripts/verify-ui-baseline.cjs",
    "scripts/verify-no-drift.cjs",
    "scripts/verify-authgate-session.cjs",
    "scripts/verify-authgate-sweep.cjs",
    "scripts/verify-authgate-attempt-limits.cjs",
    "scripts/verify-authgate-passkey.cjs",
    "scripts/verify-admin-passkey.cjs",
    "scripts/verify-2fa-no-limits.cjs",
    "scripts/verify-recovery-flow-ui.cjs",
    "scripts/verify-funding-gas.cjs",
    "scripts/verify-recovery-cleanup-sweep.cjs",
    "scripts/verify-blacklist-k3.cjs",
    "scripts/verify-k3-execution-sweep.cjs",
    "scripts/verify-k2-intent-builders.cjs",
    "scripts/verify-wallet-k2-flow.cjs",
    "scripts/verify-front-back-wiring.cjs",
    "scripts/verify-thank-you-envelope.cjs",
    "scripts/verify-contract-obfuscation-layers.cjs",
    "scripts/verify-obfuscation-ci.cjs",
    "scripts/verify-anti-abuse-downloads.cjs",
    "scripts/verify-placeholder-gates.cjs",
]

QUARANTINE_PREFIXES = ("uploads/", "outputs/", "restored-original-", "_stitch_zip/")


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    if len(sys.argv) != 2:
        print("usage: python3 scripts/verify-zip-contents.py <ZIP_FILE>")
        return 2
    zip_path = sys.argv[1]
    if not os.path.exists(zip_path):
        print("BLOCKER: ZIP not found: " + zip_path)
        return 2

    print("ZIP: " + zip_path)
    print("sha256: " + sha256_of(zip_path))

    if not zipfile.is_zipfile(zip_path):
        print("FAIL: not a valid standard ZIP (no central directory)")
        return 1

    with zipfile.ZipFile(zip_path) as zf:
        bad = zf.testzip()
        if bad is not None:
            print("FAIL: corrupt entry in ZIP: " + bad)
            return 1
        names = set(zf.namelist())

    print("total ZIP entries: %d" % len(names))

    missing = [f for f in REQUIRED_ACTIVE_ROOT if f not in names]
    quarantined_required = [
        f for f in REQUIRED_ACTIVE_ROOT
        if f in names and f.startswith(QUARANTINE_PREFIXES)
    ]

    present = [f for f in REQUIRED_ACTIVE_ROOT if f in names]
    for f in present:
        print("  ACTIVE-ROOT OK   " + f)
    for f in missing:
        print("  ACTIVE-ROOT MISS " + f)

    active_root_count = len(present)
    print("active-root required files present: %d / %d" % (active_root_count, len(REQUIRED_ACTIVE_ROOT)))

    ok = True
    if missing:
        print("FAIL: %d required active-root file(s) missing from ZIP" % len(missing))
        ok = False
    if quarantined_required:
        print("FAIL: required files resolved to quarantine dirs: " + ", ".join(quarantined_required))
        ok = False

    # A ZIP that is ONLY quarantine material is a hard failure.
    non_quarantine = [n for n in names if not n.startswith(QUARANTINE_PREFIXES) and not n.endswith("/")]
    if not non_quarantine:
        print("FAIL: ZIP contains only quarantine material (uploads/outputs/restored-original/_stitch_zip)")
        ok = False

    if ok:
        print("PASS: ZIP is a valid standard archive with all required active-root files as active source")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
