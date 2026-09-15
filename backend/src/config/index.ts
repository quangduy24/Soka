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

// Mezo Swap DEX (Solidly / Aerodrome fork)
export const MEZO_SWAP_ROUTER = getAddress(process.env.MEZO_ROUTER_ADDRESS || '0x16a76d3cd3c1e3ce843c6680d6b37e9116b5c706');
export const MEZO_SWAP_FACTORY = getAddress(process.env.MEZO_FACTORY_ADDRESS || '0xf07474472d8e54a18d1612eb5711c29665b62bec');

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
