# Local end-to-end (E2E) proof

`scripts/e2e-local-securegate.cjs` runs a deterministic full SecureGate flow on a
live local **anvil** chain, using the **real** shipped frontend helpers (imported
directly under Node 24 type-stripping) and the **canonical** Foundry artifact
`out/SecureGate.sol/SecureGate.json`. `scripts/verify-e2e-local.cjs` asserts every
invariant and prints `PASS`/`FAIL`.

## What it proves

For each of ERC20 / ERC721 / ERC1155:

1. Canonical SecureGate bytecode deploys (real deployment tx).
2. `K1`, `K2`, `K3` are distinct addresses.
3. The client helper `computeClientIntentHash()` equals the on-chain
   `IntentQueued` hash (byte-for-byte parity with `computeIntentHash`).
4. `K2` signs the canonical EIP-712 typed data; `verifyK2AuthorizationSignature`
   recovers `K2`.
5. `K1` queues the intent (real tx).
6. `authorizeIntent(intentHash, sig)` is accepted (real tx) — the authorization is
   K2's signature; no server-side signing.
7. `K1` executes; the asset is **forced to K3** (verified by reading the mock
   token balance / owner after execution).

Plus:

- A non-K3 attempted destination is **captured** (`NonK3DestinationCaptured` +
  `suspectDestination[attacker] == true`) and never routed — K3 stays immutable.
- The backend-bound broadcast payload is proven to carry **`signedTx` only** — no
  `privateKey`/`mnemonic`/key material, and no raw key bytes appear in the body.
- Every `txHash` is a real anvil receipt; there is no `pending`, no all-zero, and
  no fabricated hash.

## Mock assets

Execution transfers the real asset to K3, so the harness deploys minimal mock
tokens compiled by Foundry from `test/support/MockAssets.sol`
(`MockERC20E2E`, `MockERC721E2E`, `MockERC1155E2E`). These implement only the
surface `executeIntent` calls and are **not** production token contracts.

## Run

```
scripts/with-node24.sh node scripts/verify-e2e-local.cjs
```

Expected: `23/23 passed`.

No production-ready claim.
