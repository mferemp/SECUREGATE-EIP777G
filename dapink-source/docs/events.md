# On-chain event listener

`backend/lib/securegate-events.js` indexes SecureGate's canonical events using the
canonical ABI (`out/SecureGate.sol/SecureGate.json`).

## Behavior

- **RPC from backend env only.** `resolveRpc()` reads the URL from
  `config/chains.rpcUrlFor(slug)` (backend env). The RPC URL is never exposed to
  the frontend — the module surface returns no URL. A `directUrl` option exists
  solely for the local anvil verifier (still a backend-side value).
- **Fail-closed.** If no RPC is configured for the requested chain,
  `createListener` throws a `503` error (`code: RPC_NOT_CONFIGURED`).
- **Canonical parsing.** Parses `IntentQueued`, `IntentAuthorized`,
  `IntentExecuted`, and `NonK3DestinationCaptured` via `ethers.Interface`. Args
  are normalized (bigint → string).
- **Checkpoints + resume.** `poll({fromBlock,toBlock})` reads logs by block range,
  stores the last processed block in the durable-first KV
  (`sg:events:checkpoint:<chain>:<address>`), and resumes from `checkpoint+1` so
  events are never reprocessed.

## Proof

`backend/scripts/verify-event-listener.cjs` spins up anvil, deploys the canonical
gate + a mock ERC20, runs queue → authorize → execute → recordAttemptedDestination
to emit the full event set, then:

- fail-closes (503) when backend RPC env is unset,
- confirms the module exposes no RPC URL,
- parses all four canonical events and matches their args,
- proves the KV checkpoint is written and that resume reprocesses nothing.

```
cd backend && ../scripts/with-node24.sh node scripts/verify-event-listener.cjs
```

Expected: `10/10 passed`.

## Current status (honest)

The listener is proven against a **local anvil** chain. Running it against a live
network requires a configured backend RPC env var (e.g. `RPC_ETH_MAINNET`) and a
durable KV for production-grade checkpointing (see `docs/kv.md`).

No production-ready claim.
