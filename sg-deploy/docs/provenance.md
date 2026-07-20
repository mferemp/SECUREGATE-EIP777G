# SecureGate / EIP-777G — provenance & naming

## Origin

SecureGate / EIP-777G, including the K1/K2/K3 recovery architecture, forced
immutable K3 destination model, signedTx-only backend boundary, no-backend-private-key
rule, backend-only RPC rule, and thank-you-address-separate-from-K3 rule, originated
as the project owner's SecureGate / EIP-777G design.

EIP-712 was not part of the original project framing and was not known to or used by
the project owner during the original SecureGate / EIP-777G build concept. EIP-712 was
introduced later only as a standard typed-data signature mechanism for formatting and
verifying K2 authorization signatures. EIP-712 does not rename, replace, originate, or define SecureGate / EIP-777G.

## Correct wording

- **SecureGate / EIP-777G** is the project. The K1/K2/K3 model, immutable K3
  destination, signedTx-only backend, backend-only RPC, and separate thank-you address
  are all part of the owner's SecureGate / EIP-777G design.
- **K2 authorization** uses EIP-712 typed-data signing purely as a later implementation
  detail — a standard mechanism to format and verify the K2 authorization signature.

## Forbidden wording (must never appear as active naming)

Do not describe SecureGate / EIP-777G as any of the following — these are incorrect and
rejected:

- `EIP-712 SecureGate`
- `EIP-712 recovery protocol`
- `EIP-712 project`
- `EIP-712 architecture`
- `EIP-712 invention`
- an EIP-712-originated K1/K2/K3 model

EIP-712 is a signature-encoding standard, not the origin, name, invention, or core
protocol of SecureGate / EIP-777G.

## Trust boundaries (owner's design)

- **K1** — initiates, proves ownership/binds session, queues intents, signs txs in the
  browser/local signer; its key never reaches the backend.
- **K2** — authorizes only, signs the authorization locally (browser wallet or
  externally); the backend never requests or performs K2 signing.
- **K3** — immutable forced destination; no override; the thank-you address is separate
  and must never become K3 or a route override.
- **Backend** — receives `signedTx` only; holds no private keys/mnemonic/seed; RPC URLs
  are backend-env only; never emits a fake txHash, fake `verified:true`, or fake pending.

**No production-ready claim.**
