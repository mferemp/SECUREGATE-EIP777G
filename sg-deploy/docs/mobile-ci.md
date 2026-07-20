# Mobile CI

`scripts/verify-mobile-ci.cjs` gates the mobile experience for SecureGate /
EIP-777G.

## What it checks

A **real static acceptance** on the shipped UI source (`frontend/src/App.tsx` +
`index.html` + `src/lib/*`) — the same component that renders on mobile:

- mobile viewport meta present (`width=device-width`),
- `SecureGate` / `EIP-777G` name visible,
- no forbidden `EIP-712 project` / `EIP-712 architecture` misnaming (these
  namings are rejected — SecureGate / EIP-777G is never described this way),
- K1 / K2 / K3 fields accessible,
- K2 provider-unavailable state is honest (`K2 signer not connected`),
- no operator `Revoke` flow, no QR flow,
- no fake `verified:true`,
- no public RPC URL in the frontend.

## Browser automation

A ready-to-run Playwright spec + config live at:

- `frontend/tests/mobile.spec.ts` (Pixel 5 viewport smoke),
- `frontend/playwright.config.ts` (boots `vite preview`, mobile project).

`@playwright/test` and its browsers are **not installed** in this environment, so
the verifier runs the static acceptance and reports the browser-automation step as
an honest skip:

```
SKIPPED: Playwright browser automation not installed (static mobile acceptance above passed).
```

Installing `@playwright/test` + browsers makes the same verifier run the live
mobile smoke automatically.

## Run

```
scripts/with-node24.sh node scripts/verify-mobile-ci.cjs
```

Expected: `12/12 passed` (with the honest Playwright skip note).

## External dependency to fully close

Install `@playwright/test` and browser binaries (`npx playwright install`).

No production-ready claim.
