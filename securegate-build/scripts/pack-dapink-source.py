#!/usr/bin/env python3
"""Build securegate-eip777g-dapink-final.zip — a clean SOURCE zip built from the
working tree (so the DAPINK frontend edits are captured), git-tracked files plus
the untracked required verifier, with hard excludes. No stale reuse."""
import hashlib, os, subprocess, zipfile, sys

REPO = "/workspaces"
OUT = os.path.join(REPO, "securegate-eip777g-dapink-final.zip")

def sh(c):
    return subprocess.run(c, shell=True, cwd=REPO, capture_output=True, text=True).stdout

EXCLUDE_PREFIXES = (
    ".git/", "node_modules/", "uploads/", "outputs/", "restored-original",
    "_stitch_zip/", "cache/", "handoff/",
)
EXCLUDE_SUFFIXES = (".zip", ".b64.txt")

def excluded(p):
    if any(p == e.rstrip("/") or p.startswith(e) for e in EXCLUDE_PREFIXES):
        return True
    if "/node_modules/" in p or "/.git/" in p:
        return True
    if p.endswith(EXCLUDE_SUFFIXES):
        return True
    return False

tracked = [l for l in sh("git ls-files").splitlines() if l.strip()]
extra = ["scripts/verify-design-fidelity.cjs"]

files, seen = [], set()
for f in tracked + extra:
    if f in seen or excluded(f):
        continue
    if os.path.isfile(os.path.join(REPO, f)):
        seen.add(f); files.append(f)
files.sort()

REQUIRED = [
    ".node-version", ".nvmrc", ".npmrc",
    "contracts/SecureGate.sol", "out/SecureGate.sol/SecureGate.json",
    "frontend/index.html", "frontend/src/App.tsx", "frontend/src/index.css",
    "backend/package.json", "frontend/package.json",
    "scripts/with-node24.sh", "scripts/verify-zip-contents.cjs",
    "scripts/verify-design-fidelity.cjs",
]
missing = [r for r in REQUIRED if r not in seen]
if missing:
    print("ABORT — required file(s) missing from staged set:", missing); sys.exit(1)

# Guard: nothing excluded slipped in.
bad = [f for f in files if excluded(f)]
if bad:
    print("ABORT — excluded path staged:", bad[:5]); sys.exit(1)

if os.path.exists(OUT):
    os.remove(OUT)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(REPO, f), arcname=f)

data = open(OUT, "rb").read()
sha = hashlib.sha256(data).hexdigest()
print(f"filename: {os.path.basename(OUT)}")
print(f"sha256:   {sha}")
print(f"size:     {len(data)} bytes")
print(f"entries:  {len(files)}")
open(OUT + ".sha256", "w").write(f"{sha}  securegate-eip777g-dapink-final.zip\n")
