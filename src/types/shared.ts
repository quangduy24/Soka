/**
 * Shared types — mirror of backend/src/types/index.ts interfaces.
 * Used by frontend components to get compile-time field checking,
 * preventing mismatches like step.type vs step.command.
 */

/**
 * On-chain proof reference — points a risk check at the exact object,
 * coin type, transaction, or account it was derived from, so the UI can
 * link out to Suiscan for independent verification.
 */
export interface RiskReference {
  label: string;
  type: 'coin' | 'object' | 'tx' | 'account';
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

export interface RouteNode {
  dex: string;
  ratio: number;
  fee: number;
  weight: number;
  poolAddress?: string;
  liquidityUsd?: number;
  onChainLiquidityDepth?: number;
}

export interface PtbStep {
  index: number;
  command: string;
  target?: string;
  description: string;
}

/** One executed swap stored in history — the full result snapshot of a prompt. */
export interface SwapSnapshot {
  id: string;
  prompt: string;
  status: 'SIMULATED' | 'CONFIRMED' | 'FAILED';
  createdAt: number;
  txDigest?: string;
  // Intent / trade params
  amount?: string;
  sourceSymbol?: string;
  destSymbol?: string;
  // Result metrics
  expectedOutput?: string;
  executionImpact?: string;
  slippage?: string;
  gasEstimate?: string;
  guardianScore?: number;
  guardianRiskLevel?: string;
  guardianSafe?: boolean;
  // Detail blocks
  routeNodes: RouteNode[];
  checks: RiskCheck[];
  ptbSteps: PtbStep[];
}
