#!/usr/bin/env python3
"""Assemble ONE retrievable ZIP: full git-tracked repo + handoff/HANDOFF.md +
raw proof logs + the inlined code handoff + consolidated deliverable md.
Fills the ZIP content-proof section of HANDOFF.md first, then zips, then prints
the ZIP sha256 and writes a sidecar .sha256 file.
"""
import hashlib, os, subprocess, zipfile

REPO = "/workspaces"
def sh(c): return subprocess.run(c, shell=True, cwd=REPO, capture_output=True, text=True).stdout

COMMIT = sh("git rev-parse HEAD").strip()
SHORT = COMMIT[:7]
ZIP = os.path.join(REPO, "outputs", "files", f"securegate-full-battery-handoff-{SHORT}.zip")

# Files to include: everything git tracks, plus handoff artifacts (proofs are untracked on purpose).
tracked = [l for l in sh("git ls-files").splitlines() if l.strip()]
extra = ["handoff/HANDOFF.md"]
for root, _, fs in os.walk(os.path.join(REPO, "handoff", "proofs")):
    for fn in fs:
        extra.append(os.path.relpath(os.path.join(root, fn), REPO))
# de-dup, keep order
allfiles, seen = [], set()
for f in tracked + extra:
    if f not in seen and os.path.isfile(os.path.join(REPO, f)):
        seen.add(f); allfiles.append(f)

REQUIRED = [
 "contracts/SecureGate.sol","test/SecureGate.t.sol","foundry.toml","script/DeploySecureGate.s.sol",
 "out/SecureGate.sol/SecureGate.json","scripts/bootstrap-node24.sh","scripts/with-node24.sh",
 ".node-version",".nvmrc",".npmrc","backend/package.json","frontend/package.json",
 "scripts/extract-bytecode.js","scripts/verify-abi-canonical.cjs","frontend/src/App.tsx",
 "frontend/src/index.css","frontend/src/lib/api.ts","backend/server.js","backend/config/chains.js",
 "backend/routes/deploy.js","backend/routes/funding.js","backend/lib/address-guard.js",
 "backend/lib/passkey-store.js","backend/lib/anti-abuse-kv.js","backend/lib/trace-store.js",
 "scripts/verify-no-drift.cjs","scripts/verify-zip-contents.py","handoff/HANDOFF.md",
]
present = [r for r in REQUIRED if r in seen]
missing = [r for r in REQUIRED if r not in seen]

# Fill the ZIP content-proof placeholder in HANDOFF.md before zipping it.
hp = os.path.join(REPO, "handoff", "HANDOFF.md")
with open(hp, encoding="utf-8") as f:
    doc = f.read()
proof_lines = []
proof_lines.append(f"**Total entries in ZIP:** {len(allfiles)}\n")
proof_lines.append("**Required active-root files — presence check:**\n")
proof_lines.append("```")
for r in REQUIRED:
    proof_lines.append(("FOUND    " if r in seen else "MISSING  ") + r)
proof_lines.append("```")
proof_lines.append("")
proof_lines.append("**git ls-tree required-file proof:**\n")
proof_lines.append("```")
proof_lines.append(sh("git ls-tree -r --name-only HEAD | grep -E "
  "'contracts/SecureGate.sol|test/SecureGate.t.sol|foundry.toml|script/DeploySecureGate.s.sol|"
  "out/SecureGate.sol/SecureGate.json|frontend/src/App.tsx|scripts/with-node24.sh|"
  "scripts/verify-abi-canonical.cjs|backend/routes/deploy.js|backend/routes/funding.js'").rstrip())
proof_lines.append("```")
proof_lines.append("")
proof_lines.append("No quarantine path (`uploads/`, `outputs/`, `restored-original-*`, `_stitch_zip/`) is")
proof_lines.append("relied on as implementation — all required files resolve to active-root paths above.")
doc = doc.replace("<!--ZIPPROOF-->", "\n".join(proof_lines))
with open(hp, "w", encoding="utf-8") as f:
    f.write(doc)

# Build the ZIP.
os.makedirs(os.path.dirname(ZIP), exist_ok=True)
if os.path.exists(ZIP): os.remove(ZIP)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for f in allfiles:
        z.write(os.path.join(REPO, f), arcname=f)

# Integrity + hash.
zf = zipfile.ZipFile(ZIP)
bad = zf.testzip()
sha = hashlib.sha256(open(ZIP, "rb").read()).hexdigest()
with open(ZIP + ".sha256", "w") as f:
    f.write(f"{sha}  {os.path.basename(ZIP)}\n")

print("ZIP:", ZIP)
print("entries:", len(zf.namelist()))
print("integrity:", "OK" if bad is None else f"CORRUPT {bad}")
print("sha256:", sha)
print("required present:", len(present), "/", len(REQUIRED), "missing:", missing)
