/**
 * DIEPS Intent Engine — Core Type Definitions & Zod Schemas
 * All domain types for the Sui Mainnet Intent Engine backend.
 */

import { z } from 'zod';

// ─── Intent Types ──────────────────────────────────────────────

/** Priority modes for swap execution */
export type PriorityMode = 'SAFE' | 'FAST' | 'MAX_OUTPUT';

/** Supported action types */
export type ActionType = 'SWAP' | 'TRANSFER' | 'BRIDGE';

/** User constraint extracted from natural language */
export interface UserConstraint {
  type: 'slippage' | 'deadline' | 'minOutput' | 'maxGas' | 'priority';
  value: string;
  raw: string; // original text fragment
}

/** Parsed intent from user prompt */
export interface ParsedIntent {
  action_type: ActionType;
  trade_amount: string;
  source_token_symbol: string;
  source_token_address: string;
  destination_token_symbol: string;
  destination_token_address: string;
  priority_mode: PriorityMode;
  user_constraints: UserConstraint[];
}

/** Full parse result returned to frontend */
export interface IntentParseResult {
  intent: ParsedIntent;
  confidence_score: number;
  validation_status: 'VALID' | 'INVALID_FORMAT' | 'AMBIGUOUS';
}

// ─── Token & Coin Types ────────────────────────────────────────

/** Token metadata from whitelist or on-chain */
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;       // Full coin type (e.g., "0x2::sui::SUI")
  decimals: number;
  logoUrl?: string;
  isWhitelisted: boolean;
}

/** Individual coin object from suix_getCoins */
export interface CoinData {
  coinObjectId: string;
  version: string;
  digest: string;
  balance: string;       // in MIST / smallest unit
  coinType: string;
}

/** Balance result */
export interface BalanceResult {
  coinType: string;
  totalBalance: string;  // raw MIST
  coinObjectCount: number;
}

// ─── Route Types ───────────────────────────────────────────────

/** Single route node (DEX pool hop) */
export interface RouteNode {
  dex: string;
  ratio: number;        // % of trade routed through this path
  fee: number;          // fee in %
  weight: number;       // graph weight for Bellman-Ford
  poolAddress?: string;
  liquidityUsd?: number;
  onChainLiquidityDepth?: number;
}

/** Full route result returned to frontend */
export interface RouteResult {
  route: RouteNode[];
  dex_sequence: string[];
  expected_output: number;
  minimum_output: number;
  execution_impact: string;
  route_confidence: number;
  dynamicPoolUsed: boolean;
  poolDetails: PoolDetails | null;
  /** Cetus aggregator raw route data for PTB building */
  routerData?: any;
}

/** Pool details from DexScreener or Cetus */
export interface PoolDetails {
  dex: string;
  address: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  priceUsd: string;
  liquidity: number;
  volume24h: number;
  pairCreatedAt?: number; // Unix timestamp
}

// ─── Risk Types ────────────────────────────────────────────────

/** Risk severity level */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * On-chain proof reference — points a risk check at the exact object,
 * coin type, transaction, or account it was derived from, so the frontend
 * can link out to Suiscan for independent verification.
 */
export interface RiskReference {
  label: string;
  type: 'coin' | 'object' | 'tx' | 'account';
  value: string;
}

/** Individual risk check result */
export interface RiskCheck {
  name: string;
  status: 'SAFE' | 'NEUTRAL' | 'WARNING' | 'DANGER';
  message: string;
  value?: number;
  threshold?: number;
  category?: string;
  references?: RiskReference[];
}

/** Complete risk assessment for a route */
export interface RiskAssessment {
  safe: boolean;
  score: number;                    // 0-100 (100 = safest)
  riskLevel: RiskLevel;
  slippagePercent: number;
  priceDeviationPercent: number;
  depthRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  checks: RiskCheck[];
}

/** Guardian response to frontend (backward-compatible) */
export interface GuardianRiskResponse {
  risk_probability: number;
  risk_level: RiskLevel;
  execution_blocked: boolean;
  checks: {
    slippage_risk: 'SAFE' | 'WARNING' | 'DANGER';
    concentration_risk: 'SAFE' | 'WARNING' | 'DANGER';
    stale_pool: 'SAFE' | 'WARNING' | 'DANGER';
    black_swan: 'SAFE' | 'WARNING' | 'DANGER';
  };
  /** Enhanced risk assessment data */
  riskAssessment?: RiskAssessment;
}

// ─── PTB / Execution Types ─────────────────────────────────────

/** Serialized PTB for wallet signing */
export interface ExecuteSwapResult {
  /** Base64-encoded transaction bytes for wallet signing */
  transactionBytes: string;
  /** Human-readable PTB steps */
  ptbSteps: PtbStep[];
  /** Simulation result */
  simulation: {
    success: boolean;
    gasUsed: string;
    balanceChanges: any[];
    error?: string;
  };
  /** Route summary */
  routeSummary: {
    inputAmount: string;
    inputToken: string;
    expectedOutput: string;
    outputToken: string;
    priceImpact: string;
  };
}

/** Individual PTB command step */
export interface PtbStep {
  index: number;
  command: string;      // SplitCoins, MoveCall, TransferObjects
  target?: string;      // Move function target
  description: string;
}


// ─── Zod Schemas for Request Validation ────────────────────────

export const ParseIntentSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500),
});

export const CalculateRouteSchema = z.object({
  sourceAddress: z.string().min(1),
  destAddress: z.string().min(1),
  sourceSymbol: z.string().min(1),
  destSymbol: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(v => String(v)),
});

export const EvaluateGuardianSchema = z.object({
  sourceSymbol: z.string().min(1),
  destSymbol: z.string().min(1),
  route: z.array(z.any()).optional(),
  execution_impact: z.union([z.string(), z.number()]).optional(),
});

export const RiskAdviceSchema = z.object({
  sourceToken: z.string().min(1),
  destToken: z.string().min(1),
  risks: z.array(z.any()),
});

export const BalanceSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  symbol: z.string().min(1, 'Symbol is required'),
});

export const ExecuteSwapSchema = z.object({
  senderAddress: z.string().min(1, 'Sender address is required'),
  sourceSymbol: z.string().min(1),
  destSymbol: z.string().min(1),
  sourceAddress: z.string().optional(),
  destAddress: z.string().optional(),
  amount: z.union([z.string(), z.number()]).transform(v => String(v)),
  slippage: z.number().min(0).max(50).optional().default(0.5),
  routerData: z.any().optional(),
});

export const RiskSummarySchema = z.object({
  sourceToken: z.string().min(1),
  destToken: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform(v => String(v)),
  guardianChecks: z.array(z.any()),
  routeNodes: z.array(z.any()).optional().default([]),
});

export const ProcessIntentSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  senderAddress: z.string().min(1, 'Sender address is required'),
  slippage: z.number().min(0).max(50).optional().default(0.5),
});

export interface ProcessIntentResult {
  intent: ParsedIntent;
  route: RouteResult;
  guardian: {
    safe: boolean;
    score: number;
    riskLevel: RiskLevel;
    checks: RiskCheck[];
  };
  ptb: ExecuteSwapResult;
}
