# SecureGate / EIP-777G

Compromised-wallet recovery for the **SecureGate / EIP-777G** design: a K1/K2/K3
model that queues asset-recovery intents and forces them to an immutable K3
destination, with a browser-only signing boundary and a signedTx-only backend.

## Provenance & naming (read first)

SecureGate / EIP-777G, including the K1/K2/K3 recovery architecture, forced immutable
K3 destination model, signedTx-only backend boundary, no-backend-private-key rule,
backend-only RPC rule, and thank-you-address-separate-from-K3 rule, originated as the
project owner's SecureGate / EIP-777G design.

EIP-712 was not part of the original project framing and was not known to or used by
the project owner during the original SecureGate / EIP-777G build concept. EIP-712 was
introduced later only as a standard typed-data signature mechanism for formatting and
verifying K2 authorization signatures. EIP-712 does not rename, replace, originate, or define SecureGate / EIP-777G.

Full detail: [`docs/provenance.md`](docs/provenance.md).

## Architecture (owner's design)

- **K1** initiates, proves ownership, queues intents, and signs transactions locally.
  Its key never reaches the backend.
- **K2 authorization** uses EIP-712 typed-data signing only as a later implementation
  detail to format/verify the K2 signature. K2 signs locally; the backend never signs.
- **K3** is the immutable forced recovery destination. The thank-you address is separate
  and is never a destination override.
- **Backend** broadcasts `signedTx` only — no private keys, no mnemonic, no seed; RPC
  URLs are backend-env only.

## Layers

- Canonical ABI / Node 24 / Foundry artifact (`contracts/SecureGate.sol` →
  `out/SecureGate.sol/SecureGate.json`). See [`docs/artifact-extraction.md`](docs/artifact-extraction.md).
- Browser deploy builder + K1 action builder. See [`docs/browser-builders.md`](docs/browser-builders.md).
- K2 authorization + client-side intent hash. See [`docs/k2-authorization.md`](docs/k2-authorization.md).

## Proof

All proofs run under Node 24 via `scripts/with-node24.sh`. Verifiers:
`scripts/verify-browser-builders.cjs`, `scripts/verify-k2-intent-builders.cjs`,
`scripts/verify-no-drift.cjs`, plus `backend` selftest / drift-scan / artifact.

**No production-ready claim.**
