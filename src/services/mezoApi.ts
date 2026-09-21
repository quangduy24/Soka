/**
 * Soka Intent Engine — Mezo API Service
 * Real client API communicating with the Soka backend for Mezo Testnet.
 * Provides real balances, swap execution, and bridge-out operations.
 */

export interface MezoBalance {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  rawBalance: string;
  formattedBalance: string;
  /** USD value from on-chain pricing; absent when the price is unknown. */
  usdValue?: number;
  priceSource?: 'oracle' | 'router-quote';
}

export interface BridgeTokenMapping {
  sourceToken: string;
  mezoToken: string;
}

export interface BridgeInfo {
  enabledChains: number[];
  tokenMappings: BridgeTokenMapping[];
  outflowCapacities: Record<string, string>;
  minBridgeOutAmounts: Record<string, string>;
}

export interface MezoTransaction {
  id: string;
  type: string;
  hash?: string;
  amount: string;
  token: string;
  recipient?: string;
  sender?: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
}

export interface ExecuteTxResult {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  gasLimit?: string;
  txSteps: Array<{
    index: number;
    action: string;
    to: string;
    description: string;
    data?: string;
    value?: string;
  }>;
  transactionData: string;
  guardian?: GuardianResult | null;
  simulation?: {
    success: boolean;
    gasUsed: string;
    simulated: boolean;
    error?: string;
  };
  routeSummary: {
    inputAmount: string;
    inputToken: string;
    expectedOutput: string;
    outputToken: string;
    priceImpact: string | null;
  };
}

export interface AdviseExample {
  prompt: string;
  description: string;
}

export interface FallbackAdvise {
  error: 'unclear_intent' | 'unsupported_action' | 'unknown_token' | 'missing_field';
  message: string;
  missing: string[];
  supportedActions: string[];
  examples: AdviseExample[];
}

export interface GuardianResult {
  safe: boolean;
  score: number;
  riskLevel: string;
  checks: Array<{
    name: string;
    status: 'SAFE' | 'NEUTRAL' | 'WARNING' | 'DANGER';
    message: string;
    value?: number;
    threshold?: number;
    category?: string;
  }>;
}

/** Rejection from the backend pipeline — always carries user-facing advise. */
export class ApiRejectError extends Error {
  readonly status: number;
  readonly advise: FallbackAdvise | null;
  readonly tokenSuggestion: { missingSymbol: string; candidates: unknown[] } | null;
  readonly guardian: GuardianResult | null;
  readonly payload: any;

  constructor(status: number, body: any, fallback: string) {
    super((body as any)?.error || fallback);
    this.name = 'ApiRejectError';
    this.status = status;
    this.advise = (body as any)?.advise ?? null;
    this.tokenSuggestion = (body as any)?.tokenSuggestion ?? null;
    this.guardian = (body as any)?.guardian ?? null;
    this.payload = body;
  }
}

// Static member access so Vite inlines the value at transform time.
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

async function parseError(res: Response, fallback: string): Promise<Error> {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  if ((err as any)?.advise || (err as any)?.guardian || (err as any)?.tokenSuggestion || (err as any)?.llmMessage) {
    return new ApiRejectError(res.status, err, fallback);
  }
  const details = Array.isArray((err as any)?.details)
    ? (err as any).details.map((d: any) => d?.message || d?.field).filter(Boolean).join('; ')
    : typeof (err as any)?.details === 'string'
      ? (err as any).details
      : '';
  const message = (err as any)?.error || fallback;
  return new Error(details ? `${message}: ${details}` : message);
}

export const mezoApi = {
  /**
   * Fetches real token balances for a wallet address from Mezo Testnet.
   */
  async getBalances(address: string): Promise<MezoBalance[]> {
    const res = await fetch(`${API_BASE}/api/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });

    if (!res.ok) {
      throw await parseError(res, 'Failed to fetch balances');
    }

    const data = await res.json();
    if (Array.isArray(data.balances)) {
      return data.balances.map((b: any) => ({
        tokenAddress: b.tokenAddress,
        symbol: b.symbol,
        decimals: b.decimals,
        rawBalance: b.rawBalance,
        formattedBalance: b.formattedBalance,
        // Backend-computed USD value; stays undefined when the price is unknown.
        usdValue: b.usdValue !== undefined ? parseFloat(b.usdValue) : undefined,
        priceSource: b.priceSource,
      }));
    }
    return [];
  },

  /**
   * Fetches bridge metadata and capacities from the Mezo Assets Bridge precompile.
   */
  async getBridgeInfo(): Promise<BridgeInfo> {
    const res = await fetch(`${API_BASE}/api/bridge-info`);
    if (!res.ok) {
      throw await parseError(res, 'Failed to fetch bridge info');
    }
    return res.json();
  },

  /**
   * Builds an unsigned bridge-out transaction to Ethereum or Bitcoin.
   */
  async bridgeOut(params: {
    senderAddress: string;
    tokenAddress: string;
    amount: string;
    destinationChain: number;
    recipient: string;
  }): Promise<ExecuteTxResult> {
    const res = await fetch(`${API_BASE}/api/bridge-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw await parseError(res, 'Failed to build bridge transaction');

    return res.json();
  },

  /**
   * Processes a natural language intent. Rejections throw ApiRejectError with
   * structured advise (422) or guardian results (403) — never a fake quote.
   */
  async processIntent(params: {
    prompt: string;
    senderAddress: string;
    slippage?: number;
    acknowledgeRisk?: boolean;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/api/process-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw await parseError(res, 'Failed to process intent');

    return res.json();
  },

  /**
   * Builds the unsigned swap payload (fresh on-chain quote + guardian gate).
   */
  async executeSwap(params: {
    senderAddress: string;
    sourceSymbol: string;
    destSymbol: string;
    amount: string;
    slippage?: number;
    acknowledgeRisk?: boolean;
  }): Promise<ExecuteTxResult> {
    const res = await fetch(`${API_BASE}/api/execute-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw await parseError(res, 'Failed to build swap transaction');

    return res.json();
  },

  /**
   * Builds an unsigned direct transfer (never a swap).
   */
  async transfer(params: {
    senderAddress: string;
    tokenSymbol?: string;
    tokenAddress?: string;
    amount: string;
    recipient: string;
  }): Promise<ExecuteTxResult> {
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw await parseError(res, 'Failed to build transfer');

    return res.json();
  },

  /**
   * System capability registry: executable / advisory / unsupported actions.
   */
  async getCapabilities(): Promise<{ capabilities: Array<{ action: string; status: string; summary: string; requires: string[]; examples: AdviseExample[]; unavailableReason?: string }> }> {
    return getJson('/api/capabilities');
  },

  /**
   * Supported token list: backend whitelist plus on-chain discovered tokens.
   */
  async getTokens(): Promise<{ tokens: Array<{ symbol: string; name: string; address: string; decimals: number; isStable: boolean; aliases: string[]; source: string }> }> {
    return getJson('/api/tokens');
  },

  /**
   * Live network gas price with the operator warning threshold.
   */
  async getGasPrice(): Promise<{ gasPriceWei: string; gasPriceGwei: number | null; warnAboveGwei: number; elevated: boolean | null }> {
    return getJson('/api/gas-price');
  },

  /**
   * LLM-generated risk summary for a set of guardian checks.
   */
  async getRiskSummary(body: { sourceToken: string; destToken: string; amount: string; guardianChecks: unknown[]; routeNodes?: unknown[] }): Promise<any> {
    return getJson('/api/risk-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

export interface PoolLegDto {
  address: string;
  symbol: string;
  decimals: number;
  reserve: string;
  priceUsd: number | null;
  priceSource: 'oracle' | 'router-quote' | null;
}

export interface PoolDto {
  address: string;
  token0: PoolLegDto;
  token1: PoolLegDto;
  stable: boolean | null;
  feePct: number | null;
  tvlUsd: number | null;
  userSharePct: number | null;
  userLpBalance: string | null;
  volume24h: null;
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw await parseError(res, `Request failed: ${path}`);
  return res.json() as Promise<T>;
}

export const marketApi = {
  getPrices(symbols?: string[]): Promise<{ prices: Array<{ symbol: string; address: string; priceUsd: number | null; source: string | null; updatedAt: number | null }> }> {
    const qs = symbols && symbols.length > 0 ? `?symbols=${encodeURIComponent(symbols.join(','))}` : '';
    return getJson(`/api/prices${qs}`);
  },
  getPools(params?: { limit?: number; offset?: number; wallet?: string }): Promise<{ totalPairs: number; offset: number; limit: number; pools: PoolDto[] }> {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    if (params?.wallet) qs.set('wallet', params.wallet);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return getJson(`/api/pools${suffix}`);
  },
  getPoolDetail(address: string, wallet?: string): Promise<PoolDto> {
    const suffix = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
    return getJson(`/api/pools/${address}${suffix}`);
  },
  quoteAddLiquidity(body: { tokenA: string; tokenB: string; stable: boolean; amountADesired: string; amountBDesired: string }): Promise<any> {
    return getJson('/api/pools/quote-liquidity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  quoteRemoveLiquidity(body: { poolAddress: string; liquidity: string }): Promise<any> {
    return getJson('/api/pools/quote-remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  quotePaired(body: { tokenA: string; tokenB: string; stable: boolean; amountA: string }): Promise<{ amountB: string; reserveA: string; reserveB: string; poolAddress: string }> {
    return getJson('/api/pools/quote-paired', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  addLiquidity(body: { senderAddress: string; tokenA: string; tokenB: string; stable: boolean; amountADesired: string; amountBDesired: string }): Promise<ExecuteTxResult> {
    return getJson('/api/pools/add-liquidity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  removeLiquidity(body: { senderAddress: string; poolAddress: string; liquidity: string }): Promise<ExecuteTxResult> {
    return getJson('/api/pools/remove-liquidity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  borrowQuote(body: { walletAddress?: string; collateralSymbol: string; collateralAmount: string; debtSymbol: string }): Promise<any> {
    return getJson('/api/borrow-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  borrowReverseQuote(body: { walletAddress?: string; collateralSymbol: string; desiredDebtAmount: string; debtSymbol: string }): Promise<any> {
    return getJson('/api/borrow-reverse-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  borrowExecute(body: { senderAddress: string; collateralSymbol: string; collateralAmount: string; debtSymbol: string }): Promise<any> {
    return getJson('/api/borrow-execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};
