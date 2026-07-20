#!/usr/bin/env bash
# compile-and-extract.sh — full Node-24-gated Foundry proof + artifact extraction.
# Every Node-sensitive step runs through scripts/with-node24.sh.
# Stops and reports on the first blocker; never fakes forge/artifact output.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
W="$ROOT/scripts/with-node24.sh"

echo "== 1. Node 24 check =="
"$W" node -v
"$W" node -e 'const m=process.versions.node.split(".")[0]; if(m!=="24"){console.error("NOT NODE 24");process.exit(1)} console.log("node major:",m)'

echo "== 2. forge available? =="
if ! "$W" bash -c 'command -v forge >/dev/null 2>&1'; then
  echo "[BLOCKER] Foundry (forge) is not installed / not on PATH. Install with foundryup, then re-run." >&2
  exit 10
fi
"$W" forge --version

echo "== 3. forge build --via-ir =="
"$W" forge build --via-ir

echo "== 4. forge test -vvv =="
"$W" forge test -vvv

echo "== 5. extract bytecode/ABI from Foundry artifact =="
if [ ! -f "$ROOT/out/SecureGate.sol/SecureGate.json" ]; then
  echo "[BLOCKER] out/SecureGate.sol/SecureGate.json missing after build — cannot extract." >&2
  exit 11
fi
"$W" node scripts/extract-bytecode.js

echo "== compile-and-extract complete =="
