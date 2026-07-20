# Obfuscation CI

`scripts/verify-obfuscation-ci.cjs` is the obfuscation-equivalence CI gate.

## Behavior

- **If an obfuscation build is configured** (an obfuscation tool such as
  `javascript-obfuscator` is a dependency **and** an obfuscation script/output
  exists), it runs the token-equivalence guard
  (`backend/scripts/obfuscation-equivalence.cjs`) under Node 24 and asserts:
  - protected tokens (DOM ids, API paths, chain slugs, progress strings) survive,
  - no fake `verified:true`, `signedTx:"0x00"`, or `txHash:"pending"` were
    introduced by the obfuscated output.
- **If no obfuscated build exists**, it prints exactly:

  ```
  SKIPPED: no obfuscated build configured
  ```

  and does **not** claim obfuscation CI complete.

## Current status (honest)

This project ships a **clean, un-obfuscated** build. No obfuscation tool or
obfuscated output is configured, so the gate reports the honest skip above. A
token-equivalence guard (`backend/scripts/obfuscation-equivalence.cjs`, run via
`npm run verify:artifact`) already protects the clean source tokens; it is not an
obfuscated build and is not claimed as one.

## Run

```
scripts/with-node24.sh node scripts/verify-obfuscation-ci.cjs
```

No production-ready claim.
