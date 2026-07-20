'use strict';

// Canonical chain registry.
// PUBLIC metadata only is ever sent to the frontend (name, chainId, nativeSymbol,
// deploySupported). The `rpcEnv` field names a backend environment variable that
// holds the actual RPC URL — the URL itself is NEVER exposed to the frontend.

const CHAINS = {
  'eth-mainnet':       { name: 'Ethereum',         chainId: 1,          nativeSymbol: 'ETH',  rpcEnv: 'RPC_ETH_MAINNET',       deploySupported: true },
  'opt-mainnet':       { name: 'Optimism',         chainId: 10,         nativeSymbol: 'ETH',  rpcEnv: 'RPC_OPT_MAINNET',       deploySupported: true },
  'polygon-mainnet':   { name: 'Polygon',          chainId: 137,        nativeSymbol: 'POL',  rpcEnv: 'RPC_POLYGON_MAINNET',   deploySupported: true },
  'arb-mainnet':       { name: 'Arbitrum One',     chainId: 42161,      nativeSymbol: 'ETH',  rpcEnv: 'RPC_ARB_MAINNET',       deploySupported: true },
  'base-mainnet':      { name: 'Base',             chainId: 8453,       nativeSymbol: 'ETH',  rpcEnv: 'RPC_BASE_MAINNET',      deploySupported: true },
  'bnb-mainnet':       { name: 'BNB Smart Chain',  chainId: 56,         nativeSymbol: 'BNB',  rpcEnv: 'RPC_BNB_MAINNET',       deploySupported: true },
  'avax-mainnet':      { name: 'Avalanche C-Chain',chainId: 43114,      nativeSymbol: 'AVAX', rpcEnv: 'RPC_AVAX_MAINNET',      deploySupported: true },
  'plasma-mainnet':    { name: 'Plasma',           chainId: 9745,       nativeSymbol: 'XPL',  rpcEnv: 'RPC_PLASMA_MAINNET',    deploySupported: true },
  'ink-mainnet':       { name: 'Ink',              chainId: 57073,      nativeSymbol: 'ETH',  rpcEnv: 'RPC_INK_MAINNET',       deploySupported: true },
  'abstract-mainnet':  { name: 'Abstract',         chainId: 2741,       nativeSymbol: 'ETH',  rpcEnv: 'RPC_ABSTRACT_MAINNET',  deploySupported: true },
  'robinhood-mainnet': { name: 'Robinhood Chain',  chainId: 55555,      nativeSymbol: 'ETH',  rpcEnv: 'RPC_ROBINHOOD_MAINNET', deploySupported: true },
  'zora-mainnet':      { name: 'Zora',             chainId: 7777777,    nativeSymbol: 'ETH',  rpcEnv: 'RPC_ZORA_MAINNET',      deploySupported: true },
  'lens-mainnet':      { name: 'Lens',             chainId: 232,        nativeSymbol: 'GHO',  rpcEnv: 'RPC_LENS_MAINNET',      deploySupported: true },
  'apechain-mainnet':  { name: 'ApeChain',         chainId: 33139,      nativeSymbol: 'APE',  rpcEnv: 'RPC_APECHAIN_MAINNET',  deploySupported: true },
  'degen-mainnet':     { name: 'Degen',            chainId: 666666666,  nativeSymbol: 'DEGEN',rpcEnv: 'RPC_DEGEN_MAINNET',     deploySupported: true },
  'unichain-mainnet':  { name: 'Unichain',         chainId: 130,        nativeSymbol: 'ETH',  rpcEnv: 'RPC_UNICHAIN_MAINNET',  deploySupported: true },
  'monad-mainnet':     { name: 'Monad',            chainId: 143,        nativeSymbol: 'MON',  rpcEnv: 'RPC_MONAD_MAINNET',     deploySupported: true },
  'hyperliquid-mainnet':{ name: 'HyperEVM',        chainId: 999,        nativeSymbol: 'HYPE', rpcEnv: 'RPC_HYPERLIQUID_MAINNET', deploySupported: true },
  // Deploy-disabled: EVM contract deploy not applicable on these venues.
  'hyperliquid-core':  { name: 'Hyperliquid Core', chainId: 1337,      nativeSymbol: 'HYPE', rpcEnv: 'RPC_HYPERLIQUID_CORE',  deploySupported: false },
  'solana-mainnet':    { name: 'Solana',           chainId: 101,        nativeSymbol: 'SOL',  rpcEnv: 'RPC_SOLANA_MAINNET',    deploySupported: false },
};

const SLUGS = Object.keys(CHAINS);

// Frontend-safe view: slug + display fields only. No rpcEnv, no URL.
function listPublic() {
  return SLUGS.map((slug) => {
    const c = CHAINS[slug];
    return {
      slug,
      name: c.name,
      chainId: c.chainId,
      nativeSymbol: c.nativeSymbol,
      deploySupported: c.deploySupported === true,
    };
  });
}

function get(slug) {
  return Object.prototype.hasOwnProperty.call(CHAINS, slug) ? CHAINS[slug] : null;
}

function isValidSlug(slug) {
  return typeof slug === 'string' && Object.prototype.hasOwnProperty.call(CHAINS, slug);
}

// Resolve the backend RPC URL for a slug from env. Returns null when unset so
// callers can respond with a clean "chain not configured" error.
function rpcUrlFor(slug) {
  const c = get(slug);
  if (!c) return null;
  const url = process.env[c.rpcEnv];
  return url && String(url).trim() ? String(url).trim() : null;
}

// Names of every RPC env var this registry expects (used by .env docs / selftest).
function rpcEnvNames() {
  return SLUGS.map((s) => CHAINS[s].rpcEnv);
}

module.exports = { CHAINS, SLUGS, listPublic, get, isValidSlug, rpcUrlFor, rpcEnvNames };
