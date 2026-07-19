# Durable KV

`backend/lib/kv.js` is a durable-first KV facade with namespaced keys and an
**honest durability signal**.

## Adapters

| File | Backend | Durable? |
| --- | --- | --- |
| `backend/lib/kv-redis.js` | `@vercel/kv` (Upstash Redis REST) | **yes** — only when the dependency is installed AND `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set |
| `backend/lib/kv-memory.js` | in-process `Map` | **no** — dev fallback, `durable === false` |

`kv.js` selects the durable adapter when configured, otherwise falls back to
memory. It never pretends memory is durable:

- `isDurable()` returns the true value.
- `describe()` returns `{ backend, durable, note }` where the memory note reads
  `in-memory fallback — NOT production durable (data lost on restart)`.

## API

```js
const { createKv } = require('./lib/kv');
const kv = createKv('anti-abuse'); // namespace -> keys become sg:anti-abuse:<key>
await kv.set('k', value, { ttlSec: 900 });
await kv.get('k');
await kv.delete('k');
await kv.incr('count', { ttlSec: 900 });
await kv.ttl('k'); // seconds remaining, -1 no expiry, -2 missing
```

Keys are namespaced `sg:<namespace>:<key>` so different subsystems never collide.
Secrets (the KV URL/token) are read from env only and are never logged.

## Proof

`backend/scripts/verify-kv.cjs` proves set/get/delete, TTL expiry, namespace
isolation, `incr` windows, the non-production label on the memory fallback, that
the durable backend engages only when env is configured, and that no adapter logs
the KV secret.

```
cd backend && ../scripts/with-node24.sh node scripts/verify-kv.cjs
```

Expected: `15/15 passed`.

## Current status (honest)

No durable KV backend is configured in this environment, so the facade runs on the
**non-production memory fallback**. Closing this gap fully requires provisioning an
Upstash/Vercel KV instance and setting `KV_REST_API_URL` + `KV_REST_API_TOKEN`.

No production-ready claim.
