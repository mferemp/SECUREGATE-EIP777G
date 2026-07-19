# K2 authorization + client-side intent hash

SecureGate / EIP-777G's K1/K2/K3 recovery architecture is the project owner's
design. **EIP-712 was not part of the original project framing** — it was
**introduced later only as a standard typed-data signature mechanism** for
formatting and verifying the K2 authorization signature, and **does not rename,
replace, originate, or define SecureGate / EIP-777G**. See `docs/provenance.md`.

This layer lets the browser compute a SecureGate / EIP-777G **intent hash** and
collect a **K2 authorization signature** (formatted with EIP-712 typed data) whose
digest is verifiable on-chain — with the K2 private key never leaving the K2 wallet.

## Modules (active source)

- `frontend/src/lib/securegateIntentHash.ts`
  - `computeClientIntentHash({ assetType, token, tokenId, amount, nonce, deadline, k3, chainId, verifyingContract })`
  - Mirrors the contract's `computeIntentHash` **exactly**:
    `keccak256(abi.encode(ACTION_TYPEHASH, kind, token, id, amount, k3, nonce, deadline, chainId, verifyingContract))`
  - Queue normalisation matches the contract: ERC20 → kind 0, id 0; ERC721 → kind 1, amount 1; ERC1155 → kind 2.
  - `ACTION_TYPEHASH` is computed from the canonical type string (not hard-coded).

- `frontend/src/lib/securegateK2Authorization.ts`
  - `buildAuthorizationTypedData(params)` — EIP-712 domain `{name:"SecureGate", version:"1", chainId, verifyingContract}` and type
    `AuthorizeIntent(bytes32 intentHash,uint256 deadline,bytes32 nonce,address k3,uint256 chainId,address verifyingContract)`.
  - `authorizationDigest(params)` — equals the contract's `computeAuthorizationDigest(intentHash)`.
  - `signK2Authorization(params, signTypedData)` — delegates signing to an **injected wallet callback**; the private key stays in the wallet. Throws a clear "K2 signer not connected" if none is provided.
  - `verifyK2AuthorizationSignature(params, signature, expectedK2)` — recovers the signer client-side; rejects empty / all-zero / malformed signatures and reports whether the recovery equals K2.

## Security boundaries

- The K2 (and K3) **private key is never entered** in the UI. The UI collects only
  addresses and a **pasted signature** produced by the K2 wallet.
- No server-side K2 signing. The backend `deploy` route rejects any key-shaped field,
  now including `k2SessionKey`.
- `authorizeIntent` / `executeIntent` are broadcast as **signedTx only** (gas paid by
  the K1 session key); the authorization inside is K2's signature.

## Proof

`scripts/verify-k2-intent-builders.cjs` imports the **real** helpers above (Node 24
type-stripping), spins up anvil, deploys the **canonical** Foundry bytecode, and proves:

- `computeClientIntentHash()` == on-chain `computeIntentHash()` for ERC20/721/1155,
- the ethers EIP-712 digest == on-chain `computeAuthorizationDigest()`,
- the K2 wallet signature recovers K2 and the contract **accepts** `authorizeIntent`,
- wrong signer / chainId / verifyingContract / intentHash / empty / all-zero signatures are rejected.

Run: `scripts/with-node24.sh node scripts/verify-k2-intent-builders.cjs` → 32/32 passed.

## Injected-provider (EIP-1193) signing

`frontend/src/lib/securegateWalletProvider.ts` lets the K2 authorizer sign the
canonical typed data **inside their own wallet** (MetaMask / Rabby / any injected
EIP-1193 provider) instead of pasting a signature:

- `hasInjectedProvider()` / `getInjectedProvider()` detect an injected provider
  without assuming a browser global (so the verifier can inject a mock).
- `connectInjectedK2()` calls `eth_requestAccounts` and returns the K2 address.
- `injectedSignTypedData(from)` returns a `SignTypedDataFn` that serializes the
  canonical EIP-712 envelope and calls **`eth_signTypedData_v4`** — the K2 private
  key never leaves the wallet, is never read, stored, or transmitted.
- If no provider is present the flow surfaces the exact honest error
  **`K2 signer not connected`**.

The pasted-signature flow remains the fallback. In `App.tsx` the "Sign with K2
wallet" button drives `handleSignWithK2Wallet` → `signK2Authorization` with the
injected signer; the resulting signature is then verified client-side exactly like
a pasted one before `authorizeIntent` is built. There is **no server-side K2
signing** — the backend only ever receives a `signedTx`.

Proof: `scripts/verify-wallet-k2-flow.cjs` imports the real helpers under Node 24,
uses a mock EIP-1193 provider backed by a real local wallet, and proves the wallet
signs the canonical digest, the signature recovers K2, every wrong/empty/all-zero
input is rejected, no K2 key field exists in the UI or backend payload, and no
server-side signing occurs.

Run: `scripts/with-node24.sh node scripts/verify-wallet-k2-flow.cjs` → 13/13 passed.

## Still missing (honest)

- WalletConnect *relay* (QR pairing to a remote wallet) is not wired; the injected
  EIP-1193 path above covers browser-extension wallets.
- SCAN / USB / WebAuthn / Admin remain honest placeholders.
- No production-ready claim.
