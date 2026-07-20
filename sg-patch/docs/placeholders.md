# Placeholder honesty gates (Gap J)

SecureGate / EIP-777G ships several hard identity/device layers that are **not
wired to a real verifier**:

- **Auth-Gate `SCAN`** — authenticator scan
- **USB `LINK DEVICE`** — hardware device link
- **`PASSKEY` / WebAuthn** — passkey entry
- **Admin passkey generator** — K1-bound credential minting
- **2FA / proactive protection**

Rather than fake success, every one of these routes through a single honesty
library, `frontend/src/lib/placeholderGates.ts`, which makes it *structurally
impossible* for a placeholder to report a verification or unlock recovery.

## Guarantees

Each gate returns a `PlaceholderGateResult` whose honesty fields are typed as the
literal `false`, so the TypeScript compiler rejects any future attempt to hand
back a truthy value:

```ts
interface PlaceholderGateResult {
  kind: PlaceholderGateKind
  verified: false            // never true
  pending: true
  unlocksExecution: false    // never unlocks executeIntent
  bypassesRecoveryPath: false// never stands in for K1/K2/K3
  attemptRecorded: boolean
  message: string            // honest, no fake-success copy
}
```

- **`verified` is always `false`.** There is no code path that returns
  `verified: true`.
- **`unlocksExecution` is always `false`.** A placeholder can never authorize
  `executeIntent`.
- **`bypassesRecoveryPath` is always `false`.** A placeholder can never replace
  K1 (initiate), K2 (EIP-712 authorization) or K3 (immutable forced destination).
- **Attempts may be *recorded*** (for anti-abuse rate limiting) but "attempt
  recorded" is explicitly not "verified".
- **No gate** performs a network call, generates a credential, or touches key
  material.

## The one execution gate

`canExecuteIntent(k2SignatureVerified, placeholderResults[])` is the single
decision function for whether `executeIntent` may proceed. It depends **only** on
a verified K2 EIP-712 signature. The optional `placeholderResults` bag exists
purely to *prove* placeholders are ignored: each is asserted to be a genuine,
non-verifying placeholder and then discarded. A forged object claiming
`verified: true` or `unlocksExecution: true` makes the call **fail closed**
(returns `false`), it is never trusted.

`frontend/src/App.tsx` guards its execute handler with
`canExecuteIntent(authVerified, [])`, where `authVerified` is set **only** by a
real client-side K2 signature recovery check.

## Proof

```
scripts/with-node24.sh node scripts/verify-placeholder-gates.cjs
```

Runs under Node 24 (native TS type-stripping) so it imports the **actual shipped
`.ts` module**, not a re-implementation. It asserts (21 checks):

- every gate returns `verified:false` / `unlocksExecution:false` /
  `bypassesRecoveryPath:false`
- no gate message claims success/verified/unlocked/complete
- `canExecuteIntent` is false without a verified K2 signature, true only with one
- no pile of honest placeholders can unlock when K2 is unverified
- forged `verified:true` / `unlocksExecution:true` placeholders are rejected
- the shipped `App.tsx` imports and uses these gates, has no private `MSG` map,
  and gates `executeIntent` through `canExecuteIntent(authVerified, …)`

## What would make these real

Each placeholder becomes a real layer only when a genuine verifier is connected
(WebAuthn assertion verification, hardware attestation, TOTP/second-factor
checks). Until then the UI states plainly that the layer is **not connected /
not active**, and the gate library guarantees no code can pretend otherwise.
