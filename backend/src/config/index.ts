/**
 * DIEPS Intent Engine — Configuration
 * All constants, endpoints, thresholds, and token whitelist for Sui Mainnet.
 */

import dotenv from 'dotenv';

// The dev server (tsx watch server.ts) must always boot in development mode
// regardless of a stray NODE_ENV=production inherited from the host shell —
// production mode expects built dist assets and would refuse to start without
// OPENROUTER_API_KEY. Override happens BEFORE dotenv.config() so .env can
// still override it explicitly (dotenv never overwrites existing vars).
if (process.env.NODE_ENV === 'production' && process.argv[1]?.includes('server.ts')) {
  process.env.NODE_ENV = 'development';
}
dotenv.config();

// ─── Network Configuration ────────────────────────────────────

export const SUI_MAINNET_RPC = process.env.SUI_RPC_ENDPOINT || 'https://fullnode.mainnet.sui.io:443';
export const SUI_MAINNET_GRAPHQL = 'https://graphql.mainnet.sui.io/graphql';
export const SUI_API_KEY = process.env.SUI_API_KEY || '';

// ─── Cetus Aggregator V3 ──────────────────────────────────────

export const CETUS_SUPPORTED_DEXES = [
  'cetus', 'deepbook', 'deepbookv3', 'kriya', 'flowx', 'aftermath', 'turbos', 'bluefin',
];

// ─── LLM Configuration (Gemini & OpenRouter) ───────────────────────────

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Ordered fallback models tried (after OPENROUTER_MODEL) when the primary model
 * is rate-limited, unavailable, or returns unparseable output. Paid but cheap
 * and JSON-reliable — chosen so intent parsing does not fail during demos.
 * Override via OPENROUTER_FALLBACK_MODELS (comma-separated).
 */
export const OPENROUTER_FALLBACK_MODELS: string[] = (
  process.env.OPENROUTER_FALLBACK_MODELS ||
  'nvidia/nemotron-3.5-content-safety:free, nvidia/nemotron-3-ultra-550b-a55b:free'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Full ordered candidate list (primary first, de-duplicated). */
export const OPENROUTER_MODEL_CANDIDATES: string[] = [
  ...new Set([OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS].filter(Boolean)),
];


// ─── Risk Thresholds ───────────────────────────────────────────

export const RISK_THRESHOLDS = {
  /** Price impact thresholds (%) */
  priceImpact: {
    warn: 1.0,
    recommendSplit: 3.0,
    reject: 5.0,
  },
  /** Minimum pool liquidity in USD */
  minLiquidity: {
    stablePair: 50_000,
    volatilePair: 10_000,
  },
  /** Liquidity health tiers (USD) — used by PoolSafety.checkLiquidityHealth */
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
  /** Pool age thresholds (days) — used by PoolSafety.checkPoolAge */
  poolAge: {
    danger: 7,
    warn: 3,
  },
  /** Pool age minimum (days) — legacy alias for poolAge.danger */
  poolMinAge: 7,
  /** Top holder concentration threshold (%) */
  holderConcentration: {
    warn: 50,
    reject: 80,
  },
  /** Liquidity risk (trade impact ratio) — used by LiquidityRiskGuardian.checkLiquidityRisk */
  liquidityImpact: {
    danger: 0.20,
    warn: 0.05,
  },
  /** Supply concentration (% of total supply in pool) — used by LiquidityRiskGuardian.checkSupplyConcentration */
  supplyConcentration: {
    danger: 0.05,
    warn: 1.0,
  },
  /** Liquidity depth thresholds — used by LiquidityRiskGuardian.checkLiquidityDepth */
  liquidityDepth: {
    maxHops: 3,
    poolUtilizationWarn: 0.3,
  },
  /** Risk score deductions per check status — used by calculateFinalAssessment */
  scoreDeductions: {
    DANGER: 25,
    WARNING: 10,
  },
  /** Risk level boundaries (score thresholds) — used by calculateFinalAssessment */
  riskLevel: {
    low: 80,
    medium: 60,
    high: 30,
  },
  /** Minimum score for safe execution — used by calculateFinalAssessment */
  minSafeScore: 30,
  /** Cetus Aggregator V3 endpoint */
  cetusEndpoint: process.env.CETUS_AGGREGATOR_ENDPOINT || 'https://api-sui.cetus.zone/router_v3',
  /** Optimal slippage calculation params — used by calculateOptimalSlippage() */
  slippage: {
    base: 0.1,             // minimum buffer for normal price movement (%)
    impactMultiplier: 1.5, // buffer above simulated price impact (× impact%)
    liquidityFactor: 2.0,  // tradeUsd/minLiquidity multiplier for shallow pools
    hopCost: 0.15,         // slippage added per route hop (%)
    min: 0.1,              // floor (%)
    max: 15,               // ceiling (%)
  },
  /** Router estimation params — used by cetusRouter */
  router: {
    tvlCapUsd: 10_000_000,   // cap effective TVL to avoid inflating deep-pool estimates
    defaultFeeRate: 0.003,   // fallback fee rate when SDK omits it (0.3%)
    gasReserveSui: 0.1,      // SUI reserved for gas when swapping ALL SUI
    gasEstimateMist: 5_000_000, // gas estimate in MIST for swap transactions
  },
  /** Suiscan explorer base URL */
  explorerUrl: 'https://suiscan.xyz/mainnet/tx',
};

export * from './constant.js';

// ─── Rate Limiting ─────────────────────────────────────────────

export const RATE_LIMIT = {
  windowMs: 60_000,       // 1 minute window
  maxRequests: 60,        // max 60 requests per window per IP
};

// ─── Server Configuration ──────────────────────────────────────

export const SERVER_PORT = 3000;
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Startup Validation ────────────────────────────────────────

/**
 * Validate required environment configuration at startup.
 * Uses GEMINI_API_KEY or OPENROUTER_API_KEY for LLM parsing, with deterministic fallbacks.
 */
export function validateConfig(): void {
  const hasAiKey = Boolean(GEMINI_API_KEY || OPENROUTER_API_KEY);
  if (!hasAiKey && NODE_ENV === 'production') {
    // Log a warning if no API key is set, but permit deterministic parser fallbacks
    console.warn(
      'Warning: Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured. Deterministic intent parsing will be used.'
    );
  }
}



