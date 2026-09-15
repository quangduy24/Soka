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
  usdValue?: number;
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
  routeSummary: {
    inputAmount: string;
    inputToken: string;
    expectedOutput: string;
    outputToken: string;
    priceImpact: string;
  };
}

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

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
      throw new Error(`Failed to fetch balances: ${res.statusText}`);
    }

    const data = await res.json();
    if (Array.isArray(data.balances)) {
      return data.balances.map((b: any) => ({
        tokenAddress: b.tokenAddress,
        symbol: b.symbol,
        decimals: b.decimals,
        rawBalance: b.rawBalance,
        formattedBalance: b.formattedBalance,
        usdValue: estimateTokenUsd(b.symbol, parseFloat(b.formattedBalance)),
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
      throw new Error(`Failed to fetch bridge info: ${res.statusText}`);
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

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.details || err.error || 'Failed to build bridge transaction');
    }

    return res.json();
  },

  /**
   * Processes a natural language trading or bridging intent.
   */
  async processIntent(params: {
    prompt: string;
    senderAddress: string;
    slippage?: number;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/api/process-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.details || err.error || 'Failed to process intent');
    }

    return res.json();
  },

  /**
   * Executes a direct swap by building the unsigned transaction payload.
   */
  async executeSwap(params: {
    senderAddress: string;
    sourceSymbol: string;
    destSymbol: string;
    amount: string;
    slippage?: number;
  }): Promise<ExecuteTxResult> {
    const res = await fetch(`${API_BASE}/api/execute-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.details || err.error || 'Failed to build swap transaction');
    }

    return res.json();
  },
};

function estimateTokenUsd(symbol: string, balance: number): number {
  const s = symbol.toUpperCase();
  if (s.includes('BTC')) return balance * 95_000;
  if (s === 'MEZO') return balance * 2.5;
  if (s.includes('USD') || s.includes('DAI')) return balance * 1.0;
  return balance * 1.0;
}
