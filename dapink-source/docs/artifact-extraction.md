# SecureGate artifact extraction

How the browser deploy builder gets **real** compiled bytecode/ABI — never a
placeholder, never fabricated.

## Canonical sources

| Thing | Path |
|-------|------|
| Contract source | `contracts/SecureGate.sol` (promoted from `uploads/_layer1/SecureGate.sol`) |
| Foundry config | `foundry.toml` (`src=contracts`, `via_ir=true`, `solc 0.8.24`) |
| Generated artifact | `out/SecureGate.sol/SecureGate.json` (produced by `forge build --via-ir`) |
| Extractor | `scripts/extract-bytecode.js` |
| Serving route | `backend/routes/artifact.js` → `GET /api/artifact/securegate` |

The **only** canonical ABI is the Foundry-generated `out/SecureGate.sol/SecureGate.json`.
No handwritten ABI, Markdown ABI, standalone Vercel handler, or frontend hardcoded ABI is
canonical.

## Flow

```
forge build --via-ir
        │  writes
        ▼
out/SecureGate.sol/SecureGate.json   (abi + bytecode.object)
        │  read by
        ▼
scripts/extract-bytecode.js  →  backend/.env.securegate
        │  provides env
        ▼
backend/routes/artifact.js   →  GET /api/artifact/securegate
```

## Canonical env names (the only four written)

| Env | Meaning |
|-----|---------|
| `SECUREGATE_BYTECODE_HEX` | 0x-prefixed creation bytecode from the artifact |
| `SECUREGATE_ABI_JSON` | compact JSON array of the ABI |
| `SECUREGATE_ARTIFACT_SHA256` | `sha256(utf8 of the 0x bytecode string)` — identical hash the route re-checks |
| `SECUREGATE_ARTIFACT_VERSION` | `securegate@<sha12>` |

Old names `SECUREGATE_BYTECODE` and `SECUREGATE_ABI` are **not** written and must not be used.

## Run it (Node 24 gated)

Node 24 is required. Everything runs through the project-local Node 24:

```bash
# one-time: install project-local Node 24 under .tools/node24
scripts/bootstrap-node24.sh

# full gated proof: node24 check → forge build → forge test → extract
scripts/compile-and-extract.sh
```

`scripts/with-node24.sh <cmd>` runs any single command under Node 24.

## Honest failure modes (no faking)

- nodejs.org unreachable / bootstrap yields non-24 → **stop**, network/toolchain blocker.
- `forge` not installed → **stop**, Foundry blocker (install via `foundryup`).
- `out/SecureGate.sol/SecureGate.json` missing after build → **stop**, extraction blocker.
- `backend/routes/artifact.js` returns `503` until the four env values are present and the
  sha256 matches. It never inlines a placeholder artifact.
