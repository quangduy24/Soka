/**
 * DIEPS Intent Engine — Sui RPC Client
 * Singleton JSON-RPC client for Sui Mainnet with retry logic.
 * Uses raw fetch for maximum compatibility with Cetus Aggregator SDK.
 */

import { SUI_MAINNET_RPC, SUI_MAINNET_GRAPHQL, SUI_API_KEY } from '../config/index.js';
import { logger } from './logger.js';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const gqlClient = new SuiGraphQLClient({
  network: 'mainnet',
  url: SUI_MAINNET_GRAPHQL,
});

/** JSON-RPC request ID counter */
let rpcIdCounter = 1;

/** Per-attempt network timeout for RPC calls (ms) to avoid hanging forever. */
const RPC_TIMEOUT_MS = 15_000;

/** Build standard headers for Sui RPC calls */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (SUI_API_KEY) {
    headers['x-api-key'] = SUI_API_KEY;
    headers['Authorization'] = `Bearer ${SUI_API_KEY}`;
  }
  return headers;
}

/**
 * Execute a JSON-RPC call to the Sui fullnode.
 * Includes retry logic for transient failures.
 */
export async function suiRpcCall(
  method: string,
  params: any[] = [],
  retries = 2
): Promise<any> {
  const id = rpcIdCounter++;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(SUI_MAINNET_RPC, {
        method: 'POST',
        headers: buildHeaders(),
        body,
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.error) {
        logger.warn(`RPC error on ${method}`, { error: data.error });
        throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      return data.result;
    } catch (err: any) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500;
        logger.warn(`RPC call ${method} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`, {
          error: err.message,
        });
        await new Promise(r => setTimeout(r, delay));
      } else {
        logger.error(`RPC call ${method} failed after ${retries + 1} attempts`, { error: err.message });
        throw err;
      }
    }
  }
}

/**
 * Read-only JSON-RPC methods permitted through the public /api/sui-rpc proxy.
 * The proxy attaches the server's API key, so it must never forward mutating
 * or arbitrary methods (e.g. sui_executeTransactionBlock).
 */
const RPC_PROXY_ALLOWLIST = new Set<string>([
  'suix_getReferenceGasPrice',
  'suix_getBalance',
  'suix_getAllBalances',
  'suix_getCoins',
  'suix_getAllCoins',
  'suix_getTotalSupply',
  'suix_getCoinMetadata',
  'sui_getObject',
  'sui_multiGetObjects',
  'sui_getTransactionBlock',
  'sui_dryRunTransactionBlock',
]);

/** Thrown when a proxied JSON-RPC method is not on the allowlist. */
export class RpcMethodNotAllowedError extends Error {
  readonly statusCode = 403;
  constructor(method: string) {
    super(`JSON-RPC method not allowed via proxy: ${method}`);
    this.name = 'RpcMethodNotAllowedError';
  }
}

/**
 * Validate a proxy request body (single call or JSON-RPC batch array) against
 * the allowlist, throwing RpcMethodNotAllowedError on the first bad method.
 */
function assertProxyMethodAllowed(body: any): void {
  const entries = Array.isArray(body) ? body : [body];
  if (entries.length === 0) {
    throw new RpcMethodNotAllowedError('(empty request)');
  }
  for (const entry of entries) {
    const method = entry?.method;
    if (typeof method !== 'string' || !RPC_PROXY_ALLOWLIST.has(method)) {
      throw new RpcMethodNotAllowedError(String(method));
    }
  }
}

/**
 * Proxy a raw JSON-RPC request body to the Sui fullnode.
 * Used by the /api/sui-rpc endpoint to keep API keys server-side.
 * Only read-only methods on RPC_PROXY_ALLOWLIST are forwarded.
 */
export async function suiRpcProxy(body: any): Promise<any> {
  assertProxyMethodAllowed(body);

  const res = await fetch(SUI_MAINNET_RPC, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  return res.json();
}

/**
 * Get the reference gas price from the network.
 */
export async function getReferenceGasPrice(): Promise<string> {
  return suiRpcCall('suix_getReferenceGasPrice');
}

/**
 * Get balance for a specific coin type.
 */
export async function getBalance(owner: string, coinType: string): Promise<{
  totalBalance: string;
  coinObjectCount: number;
}> {
  const result = await suiRpcCall('suix_getBalance', [owner, coinType]);
  return {
    totalBalance: result.totalBalance || '0',
    coinObjectCount: result.coinObjectCount || 0,
  };
}

/**
 * Get all non-zero coin balances owned by an address (every coin type).
 */
export async function getAllBalances(owner: string): Promise<Array<{
  coinType: string;
  totalBalance: string;
}>> {
  const result = await suiRpcCall('suix_getAllBalances', [owner]);
  return (result || [])
    .map((b: any) => ({ coinType: b.coinType, totalBalance: b.totalBalance || '0' }))
    .filter((b: any) => b.coinType && BigInt(b.totalBalance) > 0n);
}

/**
 * Get all coins of a specific type owned by an address.
 * Paginates automatically to collect all coins.
 */
export async function getAllCoins(
  owner: string,
  coinType: string,
  limit = 50
): Promise<Array<{
  coinObjectId: string;
  version: string;
  digest: string;
  balance: string;
  coinType: string;
}>> {
  const allCoins: any[] = [];
  let cursor: string | null = null;

  do {
    const params: any[] = [owner, coinType, cursor, limit];
    const result = await suiRpcCall('suix_getCoins', params);

    if (result.data) {
      allCoins.push(...result.data);
    }

    cursor = result.nextCursor || null;
    // Stop if there are no more pages
    if (!result.hasNextPage) break;
  } while (cursor);

  return allCoins.map((c: any) => ({
    coinObjectId: c.coinObjectId,
    version: c.version,
    digest: c.digest,
    balance: c.balance,
    coinType: c.coinType,
  }));
}

/**
 * Get coin metadata (symbol, decimals, etc.)
 */
type CoinMeta = { decimals: number; symbol: string; name: string; iconUrl?: string };

/** Cache coin metadata (rarely changes) to avoid repeated GraphQL calls for the
 *  same coin type during a single route computation. */
const coinMetaCache = new Map<string, { meta: CoinMeta | null; expiresAt: number }>();
const COIN_META_TTL = 600_000; // 10 min

export async function getCoinMetadata(coinType: string): Promise<CoinMeta | null> {
  const cached = coinMetaCache.get(coinType);
  if (cached && cached.expiresAt > Date.now()) return cached.meta;

  try {
    const query = `
      query getMeta($coinType: String!) {
        coinMetadata(coinType: $coinType) {
          decimals
          symbol
          name
          iconUrl
        }
      }
    `;
    const result = await gqlClient.query({
      query,
      variables: { coinType },
    });

    const meta = result.data?.coinMetadata as {
      decimals?: number; symbol?: string; name?: string; iconUrl?: string | null;
    } | undefined;

    if (!meta) {
      coinMetaCache.set(coinType, { meta: null, expiresAt: Date.now() + COIN_META_TTL });
      return null;
    }

    const decimals = meta.decimals ?? 9;
    if (meta.decimals === undefined || meta.decimals === null) {
      logger.warn('Coin metadata returned without decimals, defaulting to 9', { coinType });
    }

    const normalized: CoinMeta = {
      decimals,
      symbol: meta.symbol ?? '',
      name: meta.name ?? '',
      iconUrl: meta.iconUrl ?? undefined,
    };
    coinMetaCache.set(coinType, { meta: normalized, expiresAt: Date.now() + COIN_META_TTL });
    return normalized;
  } catch (err) {
    logger.warn(`GraphQL getCoinMetadata failed for ${coinType}`, { error: (err as Error).message });
    return null;
  }
}

/**
 * Get object data by ID
 */
export async function getObject(objectId: string): Promise<any> {
  return suiRpcCall('sui_getObject', [objectId, {
    showContent: true,
    showOwner: true,
    showType: true,
  }]);
}

/** Export the RPC endpoint for external use */
export { SUI_MAINNET_RPC };
