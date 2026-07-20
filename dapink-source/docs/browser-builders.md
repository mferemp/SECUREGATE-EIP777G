# Browser deploy builder + browser K1 action builder

This layer lets the browser construct and sign SecureGate / EIP-777G transactions
locally, sending only a signed transaction to the backend. No private key and no RPC
URL ever crosses its trust boundary.

> **Provenance:** SecureGate / EIP-777G and its K1/K2/K3 model are the project owner's
> design. EIP-712 (used later in the K2 layer) is only a typed-data signature mechanism
> and does not originate or define SecureGate / EIP-777G. See `docs/provenance.md`.

## Trust boundaries

| Concern | Where it lives | Never |
|---|---|---|
| Contract ABI + bytecode | `GET /api/artifact/securegate` (from Foundry `out/SecureGate.sol/SecureGate.json`) | hardcoded in the frontend |
| Deployer / K1 private key | browser session state only, signed in-page with ethers | sent to backend, stored, or logged |
| RPC endpoint URL | backend env only (`RPC_*`) | exposed to the browser |
| Nonce / gas / chainId | read via `POST /api/rpc/:chain` (whitelisted read methods) | fetched with a client-side URL |
| Signed transaction | `POST /api/deploy/:chain` body `{ signedTx }` | accompanied by any key field |

## Flow

### Deploy builder
1. `fetchArtifact()` → `GET /api/artifact/securegate`; strict-validates 0x-hex bytecode + non-empty ABI. Honest error if the route 503s.
2. `buildDeployData(artifact, {k1,k2,k3})` → asserts the canonical ABI, validates K1/K2/K3 (valid, non-zero, distinct), returns `bytecode ++ encodeDeploy([k1,k2,k3])` with `to: null`.
3. `buildTxCommon` reads nonce (`eth_getTransactionCount`), gas price (`eth_gasPrice`), gas (`eth_estimateGas`) via `/api/rpc/:chain`.
4. `signLocally(deployerBurnerKey, txReq)` signs in-browser (ethers Wallet); returns `{ from, signedTx }` only.
5. `broadcast(slug, signedTx)` → `POST /api/deploy/:chain` with `{ signedTx }`; returns the real upstream `txHash`.
6. The deployer key is scrubbed from state immediately after use.

### K1 action builder
Same shape, but builds calldata for the canonical K1 methods and signs with the
session-only K1 key:
- `queueERC20(token, amount, nonce, deadline)`
- `queueERC721(token, tokenId, nonce, deadline)`
- `queueERC1155(token, tokenId, amount, nonce, deadline)`
- `authorizeIntent(intentHash, sig)` / `executeIntent(intentHash)` (encoders available)

Nonces are 32-byte random hex generated client-side; deadlines must be in the future.

## Canonical ABI only

The builder rejects the forbidden old ABI at construction time:
`queueIntent`, `forwardERC20`, `computeEIP712Digest`, `domainSeparator`. It asserts
the canonical methods exist before encoding anything.

## Files

- `frontend/src/lib/securegateArtifact.ts` — artifact fetcher.
- `frontend/src/lib/securegateTxBuilder.ts` — pure encoders, key/nonce/deadline validation, broadcast body. Imports only `ethers`.
- `frontend/src/lib/securegateSessionKeys.ts` — local signer boundary.
- `frontend/src/App.tsx` — Recovery tab deploy builder + K1 action builder UI.
- `backend/routes/deploy.js` — signedTx-only broadcast; rejects key-shaped fields.
- `scripts/verify-browser-builders.cjs` — Node 24 verifier for the above.
- `scripts/verify-k2-intent-builders.cjs` — Node 24 on-chain parity verifier for the K2 layer (see `docs/k2-authorization.md`).

## Current missing pieces (honest)

- No testnet end-to-end proof (requires funded keys + configured RPC).
- K2 EIP-712 authorization is now implemented: the UI computes the intent hash
  client-side, shows the typed data for the K2 wallet to sign, and verifies the
  pasted signature recovers K2 before building `authorizeIntent`
  (`frontend/src/lib/securegateIntentHash.ts`, `securegateK2Authorization.ts`).
  The K2 private key is never entered; wallet-injected `signTypedData` is not wired yet.
- Auth-Gate / USB LINK / WebAuthn / Admin passkey remain honest placeholders.

**No production-ready claim.**
