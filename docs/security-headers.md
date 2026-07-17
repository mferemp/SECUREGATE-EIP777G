# Security headers / CSP

The production Content-Security-Policy and companion hardening headers have a
single source of truth: `frontend/security-headers.cjs`.

## Policy

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'none';
script-src 'self' <sha256 hashes of inline bootstrap scripts>;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
worker-src 'self';
manifest-src 'self';
```

Companion headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Permissions-Policy` (geolocation/mic/camera/usb
disabled), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.

## Key properties

- **No external script CDN.** `script-src` is `'self'` plus per-build **sha256
  hashes** of the same-origin inline bootstrap scripts — no `'unsafe-inline'`, no
  third-party host.
- **No public RPC URL in the frontend.** `connect-src` is `'self'`. The browser
  only ever calls its own backend origin (`/api/*`); all chain RPC goes through the
  backend (env-only, see `config/chains.js`). No RPC endpoint appears in any
  frontend CSP.
- **No tracking / no operator / no QR drift** — verified against the header source.

## Delivery

`frontend/scripts/apply-security-headers.cjs` runs as the `postbuild` step. It:

1. hashes every inline `<script>` in `dist/client/index.html`,
2. writes `dist/client/_headers` with the **full** policy (including
   `frame-ancestors`, which only works via an HTTP header),
3. injects a `<meta http-equiv="Content-Security-Policy">` (meta-safe subset) into
   the built `index.html`.

`frame-ancestors 'none'` is delivered via the `_headers` HTTP header (browsers
ignore it in `<meta>`).

## Proof

```
scripts/with-node24.sh node scripts/verify-csp.cjs
```

Expected: `21/21 passed`.

No production-ready claim.
