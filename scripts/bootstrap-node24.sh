#!/usr/bin/env bash
# bootstrap-node24.sh — install a project-local Node 24 under .tools/node24.
# No nvm, no sudo. Fails hard unless the installed node is major version 24.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/.tools/node24"
ENVFILE="$ROOT/.node24-env"

# Already installed and valid? Then we're done.
if [ -x "$DEST/bin/node" ]; then
  MAJOR="$("$DEST/bin/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$MAJOR" = "24" ]; then
    echo "[bootstrap] Node 24 already present: $("$DEST/bin/node" -v)"
    printf 'export PATH="%s/bin:$PATH"\n' "$DEST" > "$ENVFILE"
    exit 0
  fi
  echo "[bootstrap] existing .tools/node24 is not major 24 — reinstalling"
  rm -rf "$DEST"
fi

# Detect platform/arch.
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  linux) PLAT="linux" ;;
  darwin) PLAT="darwin" ;;
  *) echo "[bootstrap][BLOCKER] unsupported OS: $OS" >&2; exit 3 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "[bootstrap][BLOCKER] unsupported arch: $(uname -m)" >&2; exit 3 ;;
esac

BASE="https://nodejs.org/dist/latest-v24.x"
SHAS="$BASE/SHASUMS256.txt"

echo "[bootstrap] resolving latest Node v24.x for ${PLAT}-${ARCH}"
if ! SUMS="$(curl -fsSL -m 30 "$SHAS" 2>/dev/null)"; then
  echo "[bootstrap][BLOCKER] cannot reach nodejs.org ($SHAS) — network/toolchain blocker" >&2
  exit 4
fi

# Prefer .tar.xz only when xz is available; otherwise use .tar.gz (tar handles gzip natively).
if command -v xz >/dev/null 2>&1; then
  EXT="tar.xz"; TARFLAG="-xJf"
else
  EXT="tar.gz"; TARFLAG="-xzf"
fi

TARBALL="$(printf '%s\n' "$SUMS" | grep -oE "node-v24\.[0-9.]+-${PLAT}-${ARCH}\.${EXT}" | head -n1 || true)"
if [ -z "$TARBALL" ]; then
  echo "[bootstrap][BLOCKER] no v24 ${PLAT}-${ARCH} ${EXT} tarball found in SHASUMS256.txt" >&2
  exit 4
fi
WANT_SHA="$(printf '%s\n' "$SUMS" | awk -v f="$TARBALL" '$2==f{print $1}')"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "[bootstrap] downloading $TARBALL"
if ! curl -fsSL -m 300 -o "$TMP/$TARBALL" "$BASE/$TARBALL"; then
  echo "[bootstrap][BLOCKER] download failed: $BASE/$TARBALL" >&2
  exit 4
fi

# Verify checksum when sha256sum is available.
if command -v sha256sum >/dev/null 2>&1 && [ -n "$WANT_SHA" ]; then
  GOT_SHA="$(sha256sum "$TMP/$TARBALL" | awk '{print $1}')"
  if [ "$GOT_SHA" != "$WANT_SHA" ]; then
    echo "[bootstrap][BLOCKER] checksum mismatch for $TARBALL" >&2
    echo "  want=$WANT_SHA got=$GOT_SHA" >&2
    exit 4
  fi
  echo "[bootstrap] checksum OK"
fi

mkdir -p "$DEST"
tar $TARFLAG "$TMP/$TARBALL" -C "$DEST" --strip-components=1

# Hard-fail unless installed node is major 24.
MAJOR="$("$DEST/bin/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$MAJOR" != "24" ]; then
  echo "[bootstrap][BLOCKER] installed node is not major 24 (got $("$DEST/bin/node" -v 2>/dev/null || echo none))" >&2
  exit 5
fi

printf 'export PATH="%s/bin:$PATH"\n' "$DEST" > "$ENVFILE"
echo "[bootstrap] installed $("$DEST/bin/node" -v) at $DEST"
echo "[bootstrap] wrote $ENVFILE"
