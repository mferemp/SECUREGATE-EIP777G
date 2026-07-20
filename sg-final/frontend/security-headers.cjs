'use strict';

// security-headers.js — the single source of truth for SecureGate's production
// Content-Security-Policy and companion security headers.
//
// Consumed by:
//   * frontend/scripts/apply-security-headers.cjs (writes the CSP <meta> into the
//     built dist/client/index.html and emits dist/client/_headers for static
//     hosts that support header files),
//   * scripts/verify-csp.cjs (asserts the policy is complete and drift-free).
//
// Rationale for `connect-src`: the browser talks to its OWN backend origin
// (same-origin '/api/*') only. It NEVER connects to a public RPC URL directly —
// all RPC goes through the backend (config/chains.js, env-only). So connect-src
// stays 'self' and contains NO public RPC endpoints.

// Ordered directives. 'none'/'self' only — no external CDN, no RPC hosts.
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'none'"],
  "script-src": ["'self'"],
  // Inline styles are used for the app's CSS-in-JS; no external style CDN.
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'", "data:"],
  // Same-origin API + websocket for Vite HMR in dev. NO public RPC URLs.
  "connect-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
};

function buildCsp() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

// Full production security header set (header name -> value).
function securityHeaders() {
  return {
    'Content-Security-Policy': buildCsp(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

module.exports = { CSP_DIRECTIVES, buildCsp, securityHeaders };
