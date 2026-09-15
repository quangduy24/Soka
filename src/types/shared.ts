/**
 * Shared types — mirror of backend/src/types/index.ts interfaces.
 * Used by frontend components for compile-time safety on Mezo Testnet.
 */

export interface RiskReference {
  label: string;
  type: 'token' | 'coin' | 'object' | 'tx' | 'account' | 'contract' | 'pool';
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
  stable?: boolean;
}

export interface TxStep {
  index: number;
  action?: 'APPROVE' | 'SWAP' | 'BRIDGE_OUT' | string;
  to?: string;
  description: string;
  data?: string;
  value?: string;
  command?: string; // legacy alias
  target?: string;
}

export type PtbStep = TxStep;

/** One executed swap or bridge operation stored in history. */
export interface SwapSnapshot {
  id: string;
  prompt: string;
  status: 'SIMULATED' | 'CONFIRMED' | 'FAILED';
  createdAt: number;
  txHash?: string;
  txDigest?: string; // legacy alias
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
  txSteps?: TxStep[];
  ptbSteps: PtbStep[];
}
