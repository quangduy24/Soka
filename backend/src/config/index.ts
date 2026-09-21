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
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash';
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
      danger: parseNumberEnv('RISK_LIQ_HEALTH_STABLE_DANGER', 50_000),
      warn: parseNumberEnv('RISK_LIQ_HEALTH_STABLE_WARN', 100_000),
      neutral: parseNumberEnv('RISK_LIQ_HEALTH_STABLE_NEUTRAL', 200_000),
    },
    volatilePair: {
      danger: parseNumberEnv('RISK_LIQ_HEALTH_VOLATILE_DANGER', 10_000),
      warn: parseNumberEnv('RISK_LIQ_HEALTH_VOLATILE_WARN', 20_000),
      neutral: parseNumberEnv('RISK_LIQ_HEALTH_VOLATILE_NEUTRAL', 50_000),
    },
  },
  /** Pool age thresholds (days) */
  poolAge: {
    danger: parseNumberEnv('RISK_POOL_AGE_DANGER_DAYS', 7),
    warn: parseNumberEnv('RISK_POOL_AGE_WARN_DAYS', 3),
  },
  poolMinAge: parseNumberEnv('RISK_POOL_MIN_AGE_DAYS', 7),
  /** Top holder concentration threshold (%) */
  holderConcentration: {
    warn: parseNumberEnv('RISK_HOLDER_CONC_WARN', 50),
    reject: parseNumberEnv('RISK_HOLDER_CONC_REJECT', 80),
  },
  /** Liquidity risk (trade impact ratio) */
  liquidityImpact: {
    danger: parseNumberEnv('RISK_LIQ_IMPACT_DANGER', 0.20),
    warn: parseNumberEnv('RISK_LIQ_IMPACT_WARN', 0.05),
  },
  /** Supply concentration (% of total supply in pool) */
  supplyConcentration: {
    danger: parseNumberEnv('RISK_SUPPLY_CONC_DANGER', 0.05),
    warn: parseNumberEnv('RISK_SUPPLY_CONC_WARN', 1.0),
  },
  /** Liquidity depth thresholds */
  liquidityDepth: {
    maxHops: Math.max(1, Math.floor(parseNumberEnv('RISK_MAX_HOPS', 3))),
    poolUtilizationWarn: parseNumberEnv('RISK_POOL_UTIL_WARN', 0.3),
  },
  /** Risk score deductions per check status */
  scoreDeductions: {
    DANGER: parseNumberEnv('RISK_SCORE_DEDUCT_DANGER', 25),
    WARNING: parseNumberEnv('RISK_SCORE_DEDUCT_WARNING', 10),
  },
  /** Risk level boundaries */
  riskLevel: {
    low: parseNumberEnv('RISK_LEVEL_LOW', 80),
    medium: parseNumberEnv('RISK_LEVEL_MEDIUM', 60),
    high: parseNumberEnv('RISK_LEVEL_HIGH', 30),
  },
  /** Minimum score for safe execution */
  minSafeScore: parseNumberEnv('RISK_MIN_SAFE_SCORE', 30),
  /** Optimal slippage calculation params */
  slippage: {
    base: parseNumberEnv('SLIPPAGE_BASE', 0.1),                 // Minimum buffer for normal price movement (%)
    impactMultiplier: parseNumberEnv('SLIPPAGE_IMPACT_MULT', 1.5), // Buffer above simulated price impact
    liquidityFactor: parseNumberEnv('SLIPPAGE_LIQ_FACTOR', 2.0),   // Multiplier for shallow pools
    hopCost: parseNumberEnv('SLIPPAGE_HOP_COST', 0.15),            // Slippage added per route hop (%)
    min: parseNumberEnv('SLIPPAGE_MIN', 0.1),                   // Floor (%)
    max: parseNumberEnv('SLIPPAGE_MAX', 15),                    // Ceiling (%)
  },
  /** Router estimation params */
  router: {
    tvlCapUsd: parseNumberEnv('ROUTER_TVL_CAP_USD', 10_000_000),
    gasReserveBtc: parseNumberEnv('GAS_RESERVE_BTC', 0.0005), // BTC reserved for gas when swapping full native balance
    gasEstimateUnits: BigInt(Math.max(21_000, Math.floor(parseNumberEnv('GAS_ESTIMATE_UNITS', 250_000)))), // Estimated gas units for swap
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
  windowMs: parseNumberEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  maxRequests: Math.max(1, Math.floor(parseNumberEnv('RATE_LIMIT_MAX_REQUESTS', 60))),
  cleanupIntervalMs: parseNumberEnv('RATE_LIMIT_CLEANUP_MS', 60_000),
};

// ─── Server Configuration ──────────────────────────────────────

export const SERVER_PORT = parseInt(process.env.PORT || '3000', 10);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Transaction Building (no hardcoded slippage / deadline / gas / approval) ─

export const DEFAULT_SLIPPAGE_PCT = parseNumberEnv('DEFAULT_SLIPPAGE_PCT', 0.5);
export const MAX_SLIPPAGE_PCT = parseNumberEnv('MAX_SLIPPAGE_PCT', 50);

export const TX_CONFIG = {
  /** Seconds added to now for router deadlines */
  deadlineSec: Math.max(60, Math.floor(parseNumberEnv('TX_DEADLINE_SEC', 1200))),
  /** Approval buffer multiplier applied to the exact input amount */
  approveMultiplier: (() => {
    const raw = parseNumberEnv('APPROVE_MULTIPLIER', 10);
    return BigInt(Math.max(1, Math.floor(raw)));
  })(),
  /** Basis-points denominator for slippage math */
  slippageBpsDenominator: 10_000n,
  /** Percent-to-basis-points scale */
  pctToBpsScale: 100,
  /** Fee basis-points to percent divisor */
  bpsToPctDivisor: 100,
  /** Single-route share (%) */
  singleRouteRatio: 100,
  /** Timeout waiting for a transaction receipt (ms) */
  receiptTimeoutMs: parseNumberEnv('TX_RECEIPT_TIMEOUT_MS', 60_000),
  /** Gas price (gwei) above which the guardian warns about expensive execution */
  gasWarnGwei: parseNumberEnv('GAS_WARN_GWEI', 50),
};

// ─── Bridge Defaults (operator-configured, never silently assumed) ─

export const BRIDGE_CONFIG = {
  /** Default destination chain when the prompt names none (0=Ethereum, 1=Bitcoin) */
  defaultChain: (() => {
    const raw = Math.floor(parseNumberEnv('BRIDGE_DEFAULT_CHAIN', 0));
    return raw === 1 ? 1 : 0;
  })(),
  /** Chains advertised when getBridgeOutChains() cannot be read (fail-open list) */
  defaultChains: (process.env.BRIDGE_DEFAULT_CHAINS || '0,1')
    .split(',')
    .map((c) => Number(c.trim()))
    .filter((c) => c === 0 || c === 1),
  /** Fallback outflow capacity (wei) when the precompile read fails; null blocks */
  defaultCapacity: (() => {
    const raw = (process.env.BRIDGE_DEFAULT_CAPACITY || '').trim();
    if (!raw) return null as bigint | null;
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  })(),
  /** Fallback min bridge-out amount (wei) when the precompile read fails; null blocks */
  defaultMinAmount: (() => {
    const raw = (process.env.BRIDGE_DEFAULT_MIN_AMOUNT || '').trim();
    if (!raw) return null as bigint | null;
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  })(),
  /** TTL for cached bridge info (ms) — previously reused the pools TTL */
  infoTtlMs: parseNumberEnv('BRIDGE_INFO_TTL_MS', 30_000),
};

// ─── Intent Parsing & Confidence ─────────────────────────────────

export const INTENT_CONFIG = {
  /** Minimum confidence for a VALID intent */
  validThreshold: parseNumberEnv('INTENT_VALID_THRESHOLD', 0.5),
  /** Confidence weights */
  weights: {
    start: 1.0,
    missingToken: parseNumberEnv('INTENT_W_MISSING_TOKEN', 0.15),
    missingAddress: parseNumberEnv('INTENT_W_MISSING_ADDRESS', 0.25),
    missingAmount: parseNumberEnv('INTENT_W_MISSING_AMOUNT', 0.2),
  },
  /** Confidence clamp bounds */
  minScore: 0.1,
  maxScore: 1.0,
  /** Placeholder used when no amount was parsed */
  missingAmount: 'MISSING',
  /** Default priority when none is detected */
  defaultPriority: 'SAFE' as const,
  /** Price impact heuristic per route hop (%), capped — replace with oracle-anchored math */
  impactPerHopPct: parseNumberEnv('PRICE_IMPACT_PER_HOP', 0.05),
  impactCapPct: parseNumberEnv('PRICE_IMPACT_CAP', 1.5),
  /** Danger ratio: pool liquidity below minLiquidity * ratio is DANGER */
  liquidityDangerRatio: parseNumberEnv('LIQUIDITY_DANGER_RATIO', 0.5),
  /** Risk score scale */
  scoreStart: 100,
  scoreMin: 0,
  scoreMax: 100,
  scoreScale: 100,
};

// ─── RPC Client ──────────────────────────────────────────────────

export const RPC_CONFIG = {
  timeoutMs: parseNumberEnv('MEZO_RPC_TIMEOUT_MS', 15_000),
  retryCount: Math.max(0, Math.floor(parseNumberEnv('MEZO_RPC_RETRY_COUNT', 3))),
  retryDelayMs: parseNumberEnv('MEZO_RPC_RETRY_DELAY_MS', 1_000),
  retryBackoffBase: 2,
};

// ─── LLM Defaults ────────────────────────────────────────────────

export const LLM_DEFAULTS = {
  temperature: parseNumberEnv('LLM_DEFAULT_TEMP', 0.2),
  maxTokens: Math.max(16, Math.floor(parseNumberEnv('LLM_DEFAULT_MAX_TOKENS', 1024))),
  parserTemperature: parseNumberEnv('LLM_TEMP_PARSER', 0.1),
  advisorTemperature: parseNumberEnv('LLM_TEMP_ADVISOR', 0.3),
  advisorShortMaxTokens: Math.max(16, Math.floor(parseNumberEnv('LLM_ADVISOR_SHORT_TOKENS', 150))),
  chatPath: '/chat/completions',
  appTitle: process.env.APP_TITLE || 'Soka Intent Engine',
  refererUrl: process.env.APP_REFERER_URL || 'https://soka-intent-engine.app',
};

// ─── API Pagination & Search ─────────────────────────────────────

export const API_PAGINATION = {
  poolsDefaultLimit: Math.max(1, Math.floor(parseNumberEnv('POOLS_DEFAULT_LIMIT', 20))),
  poolsMaxLimit: Math.max(1, Math.floor(parseNumberEnv('POOLS_MAX_LIMIT', 100))),
  tokenSearchLimit: Math.max(1, Math.floor(parseNumberEnv('TOKEN_SEARCH_LIMIT', 5))),
};

// ─── Server Runtime ──────────────────────────────────────────────

export const API_BODY_LIMIT = process.env.API_BODY_LIMIT || '1mb';
export const SERVER_HOST = process.env.HOST || '0.0.0.0';

// ─── Display & Math Helpers ──────────────────────────────────────

export const DISPLAY_DECIMALS = {
  amount: 6,
  usd: 2,
  pool: 4,
};
export const EVM_ADDRESS_LENGTH = 42;
export const HEX_BYTE_DIVISOR = 2;
export const MS_TO_SEC = 1_000;
export const DEFAULT_DECIMALS = 18;
export const NATIVE_DECIMALS = 18;
export const NATIVE_ALIASES = ['btc', 'bitcoin', 'sat', 'sats'];
export const NATIVE_SYMBOL = 'BTC';
export const UNKNOWN_TOKEN_SYMBOL = 'UNKNOWN';
export const UNKNOWN_TOKEN_NAME = 'Unknown Token';
export const ZERO_BALANCE = '0';
export const LOG_BODY_MAX_LEN = parseNumberEnv('LOG_BODY_MAX_LEN', 200);
export const ALT_SOURCE_MIN_USD = parseNumberEnv('ALT_SOURCE_MIN_USD', 1);
export const ALT_SOURCE_RATIO = parseNumberEnv('ALT_SOURCE_RATIO', 0.1);

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
