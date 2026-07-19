# Testnet end-to-end harness

`scripts/e2e-testnet-securegate.cjs` runs a **real** SecureGate flow against a
public testnet, but only when the required env is configured. With no env it
prints exactly:

```
SKIPPED: missing funded testnet env
```

and exits 0 — an honest skip, never a fabricated pass.

## Required env (never committed)

| Variable | Meaning |
| --- | --- |
| `TESTNET_CHAIN_ID` | numeric chain id of the target testnet |
| `TESTNET_RPC_URL` | testnet RPC endpoint (used by the script process only) |
| `TESTNET_K1_PRIVATE_KEY` | funded K1 key — **local script use only** |
| `TESTNET_K2_PRIVATE_KEY` | K2 key, or set `TESTNET_K2_SIGNER_MODE=external` |
| `TESTNET_K3_ADDRESS` | K3 forced-destination address (public) |
| `TESTNET_TOKEN_MODE` | `mock` — deploy mock assets for the flow |

## Boundary rules

- Private keys are used **locally inside this script process only**, purely to
  sign testnet transactions. They are **never** sent to the backend and **never**
  committed. The backend broadcast path (if used) receives `signedTx` only.
- A `txHash` is printed **only** when the upstream RPC actually returns one. There
  is no fake `pending` and no fabricated hash. If K1 has zero balance the script
  fails honestly rather than pretending.

## Run

```
scripts/with-node24.sh node scripts/e2e-testnet-securegate.cjs
```

## Current status (honest)

No funded testnet env is configured in this environment, so the harness reports
`SKIPPED: missing funded testnet env`. The **external dependency** required to
close this gap is a funded testnet account + RPC endpoint. Local E2E (`docs/e2e.md`)
proves the same flow deterministically on anvil.

No production-ready claim.
