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
        timeout: 15_000,
        retryCount: 3,
        retryDelay: 1_000,
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
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      logger.warn(`RPC call attempt ${attempt}/${retries} failed: ${(err as Error).message}`);
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
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
  return withRetry(() => client.waitForTransactionReceipt({ hash, timeout: 60_000 }));
}

// ─── JSON-RPC Proxy Allowlist ──────────────────────────────────

const ALLOWED_RPC_METHODS = new Set([
  'eth_blockNumber',
  'eth_getBalance',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_sendRawTransaction',
  'eth_chainId',
  'net_version',
  'web3_clientVersion',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
]);

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
