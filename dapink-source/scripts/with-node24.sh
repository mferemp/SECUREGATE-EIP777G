#!/usr/bin/env bash
# with-node24.sh — run a command with project-local Node 24 on PATH.
# Ensures .tools/node24 exists (bootstraps if needed), asserts node major 24,
# then execs the passed command. Also puts ~/.foundry/bin on PATH if present.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/.tools/node24"

if [ ! -x "$DEST/bin/node" ]; then
  echo "[with-node24] Node 24 not present — bootstrapping"
  "$ROOT/scripts/bootstrap-node24.sh"
fi

export PATH="$DEST/bin:$PATH"
# Make Foundry visible if it was installed to the default location.
[ -d "$HOME/.foundry/bin" ] && export PATH="$HOME/.foundry/bin:$PATH"

MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$MAJOR" != "24" ]; then
  echo "[with-node24][BLOCKER] node on PATH is not major 24 (got $(node -v 2>/dev/null || echo none))" >&2
  exit 5
fi

if [ "$#" -eq 0 ]; then
  echo "[with-node24] node $(node -v) ready; no command given"
  exit 0
fi

exec "$@"
