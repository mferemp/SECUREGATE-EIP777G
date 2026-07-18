# SecureGate EIP-777G

## Project Overview

SecureGate EIP-777G is a security-focused smart contract system for wallet recovery and key management.
This dashboard provides operators with a dark-terminal UI to manage deployments, chains, passkeys, and funding.

## Identity Constraints

- Dark terminal aesthetic with monospace fonts
- Pink (#FF2D78) SCRUB button
- Yellow power icon
- SecureGate branding ONLY — no third-party scaffold branding
- Footer: canonical thank-you text

## Architecture

```
frontend/src/App.tsx         - Main dashboard UI
frontend/src/main.tsx        - React entry point
frontend/src/components/     - UI components
frontend/src/lib/api.ts      - Frontend API helper
backend/server.js            - Express server
backend/routes/*.js          - API routes (auto-mounted at /api/{name})
backend/db/schema.js         - Database schema
```

## Frontend API Calls

Use the `frontend/src/lib/api.ts` helper for all API requests.
Routes are relative (e.g., `/api/chains`, `/api/deploy`, `/api/passkeys`).

## Backend Routes

All backend routes in `backend/routes/` are mounted at `/api/{name}`:
- `/api/chains` - Chain configuration
- `/api/deploy` - Contract deployment
- `/api/passkeys` - Passkey management
- `/api/admin-passkey` - Admin passkey operations
- `/api/rpc` - RPC endpoint management
- `/api/artifact` - Contract artifacts
- `/api/runtime` - Runtime status
- `/api/funding` - Funding operations
- `/api/deliverables` - Deliverable tracking
- `/api/thank-you` - Thank you / completion flow
- `/api/trace` - Trace logging
- `/api/anti-abuse` - Anti-abuse controls

## Build

```bash
cd frontend && npm install && npm run build
cd backend && npm install && node server.js
```

## Canonical Source

Authoritative artifact: `securegate-eip777g-final.zip`
SHA256: 198f0637d476848040b108e367551b8a071ed23d3e0cc1c9c0da98c3535f39a3

DO NOT introduce Surf SDK, SurfAI, or any third-party scaffold references.
