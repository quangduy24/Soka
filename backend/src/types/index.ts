/**
 * Soka Intent Engine — Core Type Definitions & Zod Schemas
 * All domain types for the Mezo Testnet Intent Engine backend.
 * Uses standard EVM types and English terminology.
 */

import { z } from 'zod';
import type { Address } from 'viem';
import { DEFAULT_SLIPPAGE_PCT, MAX_SLIPPAGE_PCT, API_PAGINATION } from '../config/index.js';

// ─── Intent Types ──────────────────────────────────────────────

/** Priority modes for swap execution */
export type PriorityMode = 'SAFE' | 'FAST' | 'MAX_OUTPUT';

/** Supported action types: executable/advisory flows plus conversational intents */
export type ActionType =
  | 'SWAP'
  | 'TRANSFER'
  | 'BRIDGE'
  | 'BRIDGE_OUT'
  | 'BRIDGE_IN'
  | 'ASK_PRICE'
  | 'ASK_POOLS'
  | 'ASK_RISK'
  | 'ASK_BRIDGE_STATUS'
  | 'ASK_GAS'
  | 'ASK_HELP';

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
  /** TRANSFER / BRIDGE_OUT recipient (EVM hex or BTC script per bridge spec) */
  recipient?: string;
  /** BRIDGE_OUT destination chain: 0=Ethereum, 1=Bitcoin */
  destination_chain?: number;
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
  address: string; // EVM address hex
  decimals: number;
  logoUrl?: string;
  isWhitelisted: boolean;
}

/** Balance query result */
export interface BalanceResult {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  rawBalance: string;
  formattedBalance: string;
  usdValue?: string;
  /** Price source: oracle | router-quote. Absent when price is unknown. */
  priceSource?: 'oracle' | 'router-quote';
}

// ─── Route Types ───────────────────────────────────────────────

/** Single route hop in a swap path (Tigris router route: from/to/stable/factory) */
export interface RouteHop {
  from: Address;
  to: Address;
  stable: boolean;
  factory: Address;
  poolAddress?: Address;
}

/** Single route node (DEX pool hop) */
export interface RouteNode {
  dex: string;
  ratio: number;        // % of trade routed through this path
  /** fee in %. Absent when not resolvable on-chain. */
  fee?: number;
  weight: number;       // graph weight
  poolAddress?: string;
  liquidityUsd?: number;
  onChainLiquidityDepth?: number;
  stable?: boolean;
}

/** Pool details */
export interface PoolDetails {
  dex: string;
  address: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  /** USD price when resolvable on-chain; null means unknown (never an empty string) */
  priceUsd: string | null;
  /** TVL in USD, or null when it cannot be valued on-chain */
  liquidity: number | null;
  /** 24h volume is not observable on-chain; null means unknown */
  volume24h: number | null;
  stable: boolean;
  pairCreatedAt?: number;
}

/** Full route result returned to frontend */
export interface RouteResult {
  route: RouteNode[];
  dex_sequence: string[];
  expected_output: number;
  minimum_output: number;
  /** Price impact as "x.xx%" string, or null when it cannot be computed (never fake it) */
  execution_impact: string | null;
  route_confidence: number;
  dynamicPoolUsed: boolean;
  poolDetails: PoolDetails | null;
  /** Router data for EVM transaction building */
  routerData?: {
    routes: RouteHop[];
    amountIn: string;
    amountOut: string;
    tokenIn: Address;
    tokenOut: Address;
    isNativeIn: boolean;
    isNativeOut: boolean;
  };
}

// ─── Risk Types ────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskReference {
  label: string;
  type: 'token' | 'contract' | 'tx' | 'account' | 'pool';
  value: string;
}

export interface RiskCheck {
  name: string;
  status: 'SAFE' | 'NEUTRAL' | 'WARNING' | 'DANGER';
  message: string;
  value?: number;
  threshold?: number;
  category?: string;
  references?: RiskReference[];
}

export interface RiskAssessment {
  safe: boolean;
  score: number; // 0-100
  riskLevel: RiskLevel;
  slippagePercent: number;
  priceDeviationPercent: number;
  depthRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  checks: RiskCheck[];
}

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
  riskAssessment?: RiskAssessment;
}

// ─── EVM Transaction Execution Types ───────────────────────────

export interface TxStep {
  index: number;
  action: 'APPROVE' | 'SWAP' | 'TRANSFER' | 'BRIDGE_OUT' | 'ADD_LIQUIDITY' | 'REMOVE_LIQUIDITY';
  to: string;
  description: string;
  data?: string;
  value?: string;
}

export interface ExecuteSwapResult {
  /** Target contract address */
  to: `0x${string}`;
  /** Calldata in hex format */
  data: `0x${string}`;
  /** Native currency value in wei */
  value: string;
  /** Gas limit estimation */
  gasLimit?: string;
  /** Transaction execution steps */
  txSteps: TxStep[];
  /** Legacy alias for UI */
  ptbSteps?: TxStep[];
  /** Serialized transaction data */
  transactionData: string;
  /** Legacy alias */
  transactionBytes?: string;
  /** Dry-run result: real eth_simulateV1 when simulated=true, else a conservative estimate */
  simulation: {
    success: boolean;
    gasUsed: string;
    /** True only when an actual eth_simulateV1/eth_call dry-run executed */
    simulated: boolean;
    balanceChanges?: any[];
    error?: string;
  };
  /** Route summary */
  routeSummary: {
    inputAmount: string;
    inputToken: string;
    expectedOutput: string;
    outputToken: string;
    /** Null when impact is not computable (e.g. bridge-out) — never faked */
    priceImpact: string | null;
  };
}

// ─── Bridge Types ──────────────────────────────────────────────

export interface BridgeOutParams {
  tokenAddress: `0x${string}`;
  amount: string;
  destinationChain: number;
  recipient: string;
  senderAddress: `0x${string}`;
}

export interface BridgeTokenMapping {
  sourceToken: `0x${string}`;
  mezoToken: `0x${string}`;
}

export interface BridgeInfoResult {
  enabledChains: number[];
  tokenMappings: BridgeTokenMapping[];
  outflowCapacities: Record<string, string>;
  minBridgeOutAmounts: Record<string, string>;
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
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const EvaluateGuardianSchema = z.object({
  sourceSymbol: z.string().min(1),
  destSymbol: z.string().min(1),
  /** Real trade size — the endpoint previously evaluated a hardcoded amount of 1 */
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
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
  symbol: z.string().optional(),
});

export const ExecuteSwapSchema = z.object({
  senderAddress: z.string().min(1, 'Sender address is required'),
  sourceSymbol: z.string().min(1),
  destSymbol: z.string().min(1),
  sourceAddress: z.string().optional(),
  destAddress: z.string().optional(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  slippage: z.number().min(0).max(MAX_SLIPPAGE_PCT).optional().default(DEFAULT_SLIPPAGE_PCT),
  routerData: z.any().optional(),
  /** Explicit user override after reviewing guardian warnings (required when unsafe) */
  acknowledgeRisk: z.boolean().optional().default(false),
});

export const RiskSummarySchema = z.object({
  sourceToken: z.string().min(1),
  destToken: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  guardianChecks: z.array(z.any()),
  routeNodes: z.array(z.any()).optional().default([]),
});

export const ProcessIntentSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  /** Empty when the wallet is not connected — quote-only mode, no tx for a zero address */
  senderAddress: z.string().optional().default(''),
  slippage: z.number().min(0).max(MAX_SLIPPAGE_PCT).optional().default(DEFAULT_SLIPPAGE_PCT),
});

export const TransferSchema = z.object({
  senderAddress: z.string().min(1, 'Sender address is required'),
  tokenSymbol: z.string().min(1).optional(),
  tokenAddress: z.string().min(1).optional(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  recipient: z.string().min(1, 'Recipient address is required'),
});

export const BridgeOutSchema = z.object({
  senderAddress: z.string().min(1, 'Sender address is required'),
  tokenAddress: z.string().min(1, 'Token address is required'),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  destinationChain: z.number().int().min(0).max(1),
  recipient: z.string().min(1, 'Recipient address is required'),
});

export const PricesQuerySchema = z.object({
  /** Optional comma-separated symbols. Defaults to the verified whitelist. */
  symbols: z.string().min(1).optional(),
});

export const PoolsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(API_PAGINATION.poolsMaxLimit).optional().default(API_PAGINATION.poolsDefaultLimit),
  offset: z.coerce.number().int().min(0).optional().default(0),
  wallet: z.string().min(1).optional(),
});

export const PoolAddressParamSchema = z.object({
  address: z.string().min(1, 'Pool address is required'),
});

export const BorrowQuoteSchema = z.object({
  walletAddress: z.string().min(1).optional(),
  collateralSymbol: z.string().min(1, 'Collateral symbol is required'),
  collateralAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  debtSymbol: z.string().min(1, 'Debt symbol is required'),
});

export const BorrowReverseQuoteSchema = z.object({
  walletAddress: z.string().min(1).optional(),
  collateralSymbol: z.string().min(1, 'Collateral symbol is required'),
  desiredDebtAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  debtSymbol: z.string().min(1, 'Debt symbol is required'),
});

export const BorrowMockExecuteSchema = z.object({
  senderAddress: z.string().min(1, 'senderAddress is required'),
  collateralSymbol: z.string().min(1, 'Collateral symbol is required'),
  collateralAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  debtSymbol: z.string().min(1, 'Debt symbol is required'),
});

export const QuoteLiquiditySchema = z.object({
  tokenA: z.string().min(1, 'tokenA address is required'),
  tokenB: z.string().min(1, 'tokenB address is required'),
  stable: z.coerce.boolean().optional().default(false),
  amountADesired: z.union([z.string(), z.number()]).transform((v) => String(v)),
  amountBDesired: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const QuotePairedSchema = z.object({
  tokenA: z.string().min(1, 'tokenA address is required'),
  tokenB: z.string().min(1, 'tokenB address is required'),
  stable: z.coerce.boolean().optional().default(false),
  amountA: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export const AddLiquiditySchema = QuoteLiquiditySchema.extend({
  senderAddress: z.string().min(1, 'Sender address is required'),
  slippagePercent: z.number().min(0).max(MAX_SLIPPAGE_PCT).optional().default(DEFAULT_SLIPPAGE_PCT),
});

export const RemoveLiquiditySchema = z.object({
  senderAddress: z.string().min(1, 'Sender address is required'),
  poolAddress: z.string().min(1, 'Pool address is required'),
  liquidity: z.union([z.string(), z.number()]).transform((v) => String(v)),
  slippagePercent: z.number().min(0).max(MAX_SLIPPAGE_PCT).optional().default(DEFAULT_SLIPPAGE_PCT),
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
  ptb: ExecuteSwapResult; // named ptb for backward compatibility with frontend
  /** Structured fallback advise — present when the intent needed operator guidance */
  advise?: {
    error: 'unclear_intent' | 'unsupported_action' | 'unknown_token' | 'missing_field';
    message: string;
    missing: string[];
    supportedActions: string[];
    examples: { prompt: string; description: string }[];
  } | null;
}
