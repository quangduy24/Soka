/**
 * Soka Intent Engine — Mezo EVM Client
 * Provides viem public client singleton, chain definition, contract helpers,
 * retry mechanisms, and a secured JSON-RPC proxy for Mezo Testnet.
 */

import {
  createPublicClient,
  http,
  defineChain,
  type PublicClient,
  type Address,
  type Abi,
  type BlockNumber,
  type TransactionReceipt,
} from 'viem';
import {
  MEZO_TESTNET_RPC,
  MEZO_CHAIN_ID,
  MEZO_EXPLORER_URL,
  MEZO_WS_RPC,
  RPC_CONFIG,
  TX_CONFIG,
  RISK_THRESHOLDS,
} from '../config/index.js';
import { logger } from './logger.js';

// ─── Mezo Chain Definition ─────────────────────────────────────

export const mezoTestnet = defineChain({
  id: MEZO_CHAIN_ID,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MEZO_TESTNET_RPC],
      webSocket: MEZO_WS_RPC ? [MEZO_WS_RPC] : undefined,
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Explorer',
      url: MEZO_EXPLORER_URL,
    },
  },
  testnet: true,
});

// ─── Public Client Singleton ───────────────────────────────────

let clientInstance: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!clientInstance) {
    clientInstance = createPublicClient({
      chain: mezoTestnet,
      transport: http(MEZO_TESTNET_RPC, {
        timeout: RPC_CONFIG.timeoutMs,
        retryCount: RPC_CONFIG.retryCount,
        retryDelay: RPC_CONFIG.retryDelayMs,
      }),
    }) as unknown as PublicClient;
  }
  return clientInstance;
}

// ─── Helper Functions ──────────────────────────────────────────

/**
 * Execute an async operation with exponential backoff retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = RPC_CONFIG.retryCount,
  delayMs = RPC_CONFIG.retryDelayMs
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      logger.warn(`RPC call attempt ${attempt}/${retries} failed: ${(err as Error).message}`);
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs * Math.pow(RPC_CONFIG.retryBackoffBase, attempt - 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Read native BTC balance in wei for a given address.
 */
export async function getNativeBalance(address: Address): Promise<bigint> {
  const client = getPublicClient();
  return withRetry(() => client.getBalance({ address }));
}

/**
 * Read latest block number from Mezo Testnet.
 */
export async function getLatestBlockNumber(): Promise<bigint> {
  const client = getPublicClient();
  return withRetry(() => client.getBlockNumber());
}

/**
 * Execute a read-only smart contract call.
 */
export async function readContract<T = unknown>(params: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): Promise<T> {
  const client = getPublicClient();
  return withRetry(() =>
    client.readContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args as readonly unknown[],
    } as any) as Promise<T>
  );
}

/**
 * Estimate gas for a transaction on Mezo.
 */
export async function estimateGas(params: {
  account?: Address;
  to: Address;
  data?: `0x${string}`;
  value?: bigint;
}): Promise<bigint> {
  const client = getPublicClient();
  return withRetry(() => client.estimateGas(params));
}

/**
 * Wait for a transaction receipt on Mezo.
 */
export async function waitForReceipt(hash: `0x${string}`): Promise<TransactionReceipt> {
  const client = getPublicClient();
  return withRetry(() => client.waitForTransactionReceipt({ hash, timeout: TX_CONFIG.receiptTimeoutMs }));
}

// ─── JSON-RPC Proxy Allowlist ──────────────────────────────────

// Read-only proxy boundary: users sign in their own wallets, so the server
// never needs to broadcast raw transactions on anyone's behalf.
// eth_simulateV1 is included: it executes against synthetic state and never
// broadcasts, making dry-runs safe to expose.
const ALLOWED_RPC_METHODS = new Set([
  'eth_blockNumber',
  'eth_getBalance',
  'eth_call',
  'eth_simulateV1',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_chainId',
  'net_version',
  'web3_clientVersion',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
]);

export interface SimulateCall {
  to: Address;
  data?: `0x${string}`;
  value?: bigint;
  gas?: bigint;
}

export interface SimulateResult {
  /** True only when every chained call reported status 0x1 */
  success: boolean;
  /** Total gas across calls, or null when it could not be determined */
  gasUsed: string | null;
  /** Set when the simulation itself failed or any call reverted */
  error?: string;
  /** True when a real eth_simulateV1 run happened (false = eth_call fallback/estimate) */
  simulated: boolean;
}

function toQuantity(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}`;
}

/**
 * Dry-runs an ordered call chain with shared state via eth_simulateV1
 * (approve → swap semantics), falling back to per-call eth_call when the
 * node lacks simulate support. Never broadcasts. Never funds accounts.
 */
export async function simulateCalls(
  from: Address,
  calls: SimulateCall[],
  gasLimit?: bigint
): Promise<SimulateResult> {
  if (calls.length === 0) {
    return { success: true, gasUsed: '0', simulated: false };
  }
  const estimate = gasLimit ?? RISK_THRESHOLDS.router.gasEstimateUnits;
  try {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_simulateV1',
      params: [
        {
          blockStateCalls: [
            {
              calls: calls.map((c) => ({
                from,
                to: c.to,
                ...(c.data ? { data: c.data } : {}),
                value: toQuantity(c.value ?? 0n),
                ...(c.gas != null ? { gas: toQuantity(c.gas) } : {}),
              })),
            },
          ],
        },
        'latest',
      ],
    };
    const response = await fetch(MEZO_TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`simulate HTTP ${response.status}`);
    const json = (await response.json()) as {
      result?: Array<{ calls?: Array<{ status?: string; gasUsed?: string; error?: unknown }> }>;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message);
    const simCalls = json.result?.[0]?.calls ?? [];
    if (simCalls.length !== calls.length) {
      throw new Error(`simulate returned ${simCalls.length} results for ${calls.length} calls`);
    }
    let total = 0n;
    for (const [i, r] of simCalls.entries()) {
      if (r.status !== '0x1') {
        return {
          success: false,
          gasUsed: null,
          error: `Simulation reverts at call ${i + 1} (status ${r.status ?? 'unknown'})`,
          simulated: true,
        };
      }
      total += BigInt(r.gasUsed ?? '0x0');
    }
    return { success: true, gasUsed: total.toString(), simulated: true };
  } catch (err) {
    logger.warn(`eth_simulateV1 failed, falling back to eth_call: ${(err as Error).message}`);
  }
  // Fallback: per-call eth_call proves executability but yields no gas total.
  try {
    const client = getPublicClient();
    for (const [i, c] of calls.entries()) {
      await client.call({ account: from, to: c.to, data: c.data, value: c.value });
    }
    return { success: true, gasUsed: estimate.toString(), simulated: false };
  } catch (err) {
    return { success: false, gasUsed: null, error: `Dry-run reverts: ${(err as Error).message}`, simulated: false };
  }
}

/**
 * Proxies safe JSON-RPC methods to the Mezo Testnet RPC endpoint.
 */
export async function mezoRpcProxy(method: string, params: unknown[] = []): Promise<unknown> {
  if (!ALLOWED_RPC_METHODS.has(method)) {
    throw new Error(`RPC method "${method}" is not permitted by Mezo proxy allowlist.`);
  }

  const response = await fetch(MEZO_TESTNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mezo RPC HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as { result?: unknown; error?: { message: string } };
  if (json.error) {
    throw new Error(`Mezo RPC returned error: ${json.error.message}`);
  }

  return json.result;
}
