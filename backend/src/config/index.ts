/**
 * Soka Intent Engine — Configuration
 * All constants, endpoints, thresholds, and token whitelist for Mezo Testnet.
 * All values are configurable via environment variables without hardcoded restrictions.
 */

import dotenv from 'dotenv';
import { getAddress } from 'viem';

// Ensure the dev server runs in development mode regardless of host shell environment.
if (process.env.NODE_ENV === 'production' && process.argv[1]?.includes('server.ts')) {
  process.env.NODE_ENV = 'development';
}
dotenv.config();

// ─── Network Configuration (Mezo Testnet) ──────────────────────

export const MEZO_TESTNET_RPC = process.env.MEZO_RPC_ENDPOINT || process.env.MEZO_RPC_URL || 'https://rpc.test.mezo.org';
export const MEZO_WS_RPC = process.env.MEZO_WS_RPC || 'wss://rpc-ws.test.mezo.org';
export const MEZO_CHAIN_ID = parseInt(process.env.MEZO_CHAIN_ID || '31611', 10);
export const MEZO_EXPLORER_URL = process.env.MEZO_EXPLORER_URL || 'https://explorer.test.mezo.org';

// Mezo Swap DEX (Tigris Aerodrome fork). Defaults are the verified Mezo
// testnet contracts (https://mezo.org/docs/developers/features/mezo-pools/);
// override via environment when networks change.
export const MEZO_SWAP_ROUTER = getAddress(process.env.MEZO_ROUTER_ADDRESS || '0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9');
export const MEZO_SWAP_FACTORY = getAddress(process.env.MEZO_FACTORY_ADDRESS || '0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A');

// ─── LLM Configuration (OpenRouter) ───────────────────────────

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

/**
 * Ordered fallback models tried when the primary model is unavailable.
 */
export const OPENROUTER_FALLBACK_MODELS: string[] = (
  process.env.OPENROUTER_FALLBACK_MODELS ||
  'poolside/laguna-s-2.1:free, inclusionai/ling-3.0-flash-fin:free'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Full candidate list (primary first, de-duplicated). */
export const OPENROUTER_MODEL_CANDIDATES: string[] = [
  ...new Set([OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS].filter(Boolean)),
];

/** Per-model request timeout for LLM calls (ms). */
export const LLM_TIMEOUT_MS = (() => {
  const raw = Number(process.env.LLM_TIMEOUT_MS || 20_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 20_000;
})();

// ─── Risk Thresholds ───────────────────────────────────────────

export const RISK_THRESHOLDS = {
  /** Price impact thresholds (%) */
  priceImpact: {
    warn: parseFloat(process.env.RISK_PRICE_IMPACT_WARN || '1.0'),
    recommendSplit: parseFloat(process.env.RISK_PRICE_IMPACT_SPLIT || '3.0'),
    reject: parseFloat(process.env.RISK_PRICE_IMPACT_REJECT || '5.0'),
  },
  /** Minimum pool liquidity in USD */
  minLiquidity: {
    stablePair: parseFloat(process.env.RISK_MIN_LIQUIDITY_STABLE || '50000'),
    volatilePair: parseFloat(process.env.RISK_MIN_LIQUIDITY_VOLATILE || '10000'),
  },
  /** Liquidity health tiers (USD) */
  liquidityHealth: {
    stablePair: {
      danger: 50_000,
      warn: 100_000,
      neutral: 200_000,
    },
    volatilePair: {
      danger: 10_000,
      warn: 20_000,
      neutral: 50_000,
    },
  },
  /** Pool age thresholds (days) */
  poolAge: {
    danger: 7,
    warn: 3,
  },
  poolMinAge: 7,
  /** Top holder concentration threshold (%) */
  holderConcentration: {
    warn: 50,
    reject: 80,
  },
  /** Liquidity risk (trade impact ratio) */
  liquidityImpact: {
    danger: 0.20,
    warn: 0.05,
  },
  /** Supply concentration (% of total supply in pool) */
  supplyConcentration: {
    danger: 0.05,
    warn: 1.0,
  },
  /** Liquidity depth thresholds */
  liquidityDepth: {
    maxHops: 3,
    poolUtilizationWarn: 0.3,
  },
  /** Risk score deductions per check status */
  scoreDeductions: {
    DANGER: 25,
    WARNING: 10,
  },
  /** Risk level boundaries */
  riskLevel: {
    low: 80,
    medium: 60,
    high: 30,
  },
  /** Minimum score for safe execution */
  minSafeScore: 30,
  /** Optimal slippage calculation params */
  slippage: {
    base: 0.1,             // Minimum buffer for normal price movement (%)
    impactMultiplier: 1.5, // Buffer above simulated price impact
    liquidityFactor: 2.0,  // Multiplier for shallow pools
    hopCost: 0.15,         // Slippage added per route hop (%)
    min: 0.1,              // Floor (%)
    max: 15,               // Ceiling (%)
  },
  /** Router estimation params */
  router: {
    tvlCapUsd: 10_000_000,
    defaultFeeRate: 0.003,      // 0.3% fee rate
    gasReserveBtc: 0.0005,      // BTC reserved for gas when swapping full native balance
    gasEstimateUnits: 250_000n, // Estimated gas units for swap
  },
  /** Explorer base URL */
  explorerUrl: process.env.MEZO_EXPLORER_URL || 'https://explorer.test.mezo.org/tx',
};

export * from './constant.js';

// ─── Market Data (all values configurable via environment) ──────

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const MARKET_CONFIG = {
  /** TTL for cached USD price lookups (ms) */
  priceCacheTtlMs: parseNumberEnv('PRICE_CACHE_TTL_MS', 60_000),
  /** Max age of an oracle round before it is treated as stale (seconds) */
  priceMaxStalenessSec: parseNumberEnv('PRICE_MAX_STALENESS_SEC', 3_600),
  /** TTL for cached pool listings (ms) */
  poolsCacheTtlMs: parseNumberEnv('POOLS_CACHE_TTL_MS', 30_000),
  /** Max number of factory pairs scanned per pool listing request */
  poolsMaxScan: Math.max(1, Math.floor(parseNumberEnv('POOLS_MAX_SCAN', 50))),
};

// ─── Lending Risk Parameters (operator-configured, no on-chain source on testnet) ─

export const LENDING_CONFIG = {
  /** Max loan-to-value ratio applied to borrow quotes (fraction, e.g. 0.75) */
  maxLtv: parseNumberEnv('BORROW_MAX_LTV', 0.75),
  /** Liquidation loan-to-value threshold (fraction, e.g. 0.85) */
  liquidationLtv: parseNumberEnv('BORROW_LIQ_LTV', 0.85),
  /** Per-debt-symbol APR lookup: BORROW_APR_<SYMBOL>, plus BORROW_APR_DEFAULT */
  aprForSymbol(symbol: string): number | null {
    const key = `BORROW_APR_${symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    const raw = process.env[key] ?? process.env.BORROW_APR_DEFAULT;
    if (raw === undefined || raw.trim() === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  },
  /** Optional lending pool contract; empty means borrow execution is unavailable */
  lendingPoolAddress: (process.env.LENDING_POOL_ADDRESS || '') as `0x${string}` | '',
  /** Optional vault contract; empty means vault deposits are unavailable */
  vaultAddress: (process.env.VAULT_ADDRESS || '') as `0x${string}` | '',
};

// ─── CORS ────────────────────────────────────────────────────────

/** Allowed origins for cross-origin API access (comma-separated). Empty = same-origin only. */
export const CORS_ORIGINS: string[] = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ─── Rate Limiting ─────────────────────────────────────────────

export const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
};

// ─── Server Configuration ──────────────────────────────────────

export const SERVER_PORT = parseInt(process.env.PORT || '3000', 10);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Startup Validation ────────────────────────────────────────

/**
 * Validate required environment configuration at startup.
 */
export function validateConfig(): void {
  const hasAiKey = Boolean(OPENROUTER_API_KEY);
  if (!hasAiKey && NODE_ENV === 'production') {
    console.warn(
      'Warning: OPENROUTER_API_KEY is not configured. Deterministic intent parsing will be used.'
    );
  }
}
