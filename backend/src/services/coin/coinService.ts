/**
 * DIEPS Intent Engine — Coin Service
 * Handles balance queries, coin selection, and merge logic for Sui Mainnet.
 */

import { getBalance as rpcGetBalance, getAllCoins, getCoinMetadata } from '../../utils/suiClient.js';
import { resolveToken, getTokenDecimalsAsync } from './tokenResolver.js';
import { logger } from '../../utils/logger.js';
import type { CoinData, BalanceResult } from '../../types/index.js';

/**
 * Get the formatted balance of a token for an address.
 * Returns balance as a human-readable string (divided by decimals).
 */
export async function getFormattedBalance(
  address: string,
  symbol: string
): Promise<string> {
  const token = resolveToken(symbol);
  const coinType = token?.address || symbol;
  const decimals = token?.decimals ?? await getTokenDecimalsAsync(symbol);

  try {
    const result = await rpcGetBalance(address, coinType);
    const balance = Number(result.totalBalance) / Math.pow(10, decimals);
    return balance.toString();
  } catch (err: any) {
    logger.error(`Failed to get balance for ${symbol}`, {
      address: address.slice(0, 10) + '...',
      error: err.message,
    });
    return '0';
  }
}

/**
 * Get detailed balance info including coin count.
 */
export async function getDetailedBalance(
  address: string,
  coinType: string
): Promise<BalanceResult> {
  try {
    const result = await rpcGetBalance(address, coinType);
    return {
      coinType,
      totalBalance: result.totalBalance,
      coinObjectCount: result.coinObjectCount,
    };
  } catch (err: any) {
    logger.error('Failed to get detailed balance', { error: err.message });
    return { coinType, totalBalance: '0', coinObjectCount: 0 };
  }
}

/**
 * Get all coin objects for dynamic coin selection.
 * Used when building PTBs to select and merge coins.
 */
export async function getCoinsForSelection(
  address: string,
  coinType: string
): Promise<CoinData[]> {
  try {
    const coins = await getAllCoins(address, coinType);
    return coins.map(c => ({
      coinObjectId: c.coinObjectId,
      version: c.version,
      digest: c.digest,
      balance: c.balance,
      coinType: c.coinType,
    }));
  } catch (err: any) {
    logger.error('Failed to get coins for selection', { error: err.message });
    return [];
  }
}

/**
 * Select coins that cover the required amount.
 * Returns the coin IDs to use and whether merging is needed.
 */
export function selectCoinsForAmount(
  coins: CoinData[],
  requiredAmountMist: bigint
): {
  selectedCoins: CoinData[];
  needsMerge: boolean;
  totalSelected: bigint;
  surplus: bigint;
} {
  // Sort coins by balance descending — prefer using fewer coins
  const sorted = [...coins].sort((a, b) => {
    const balA = BigInt(a.balance);
    const balB = BigInt(b.balance);
    return balB > balA ? 1 : balB < balA ? -1 : 0;
  });

  // Check if a single coin covers the amount
  const singleCoin = sorted.find(c => BigInt(c.balance) >= requiredAmountMist);
  if (singleCoin) {
    return {
      selectedCoins: [singleCoin],
      needsMerge: false,
      totalSelected: BigInt(singleCoin.balance),
      surplus: BigInt(singleCoin.balance) - requiredAmountMist,
    };
  }

  // Need to merge multiple coins
  const selected: CoinData[] = [];
  let total = 0n;

  for (const coin of sorted) {
    selected.push(coin);
    total += BigInt(coin.balance);
    if (total >= requiredAmountMist) break;
  }

  return {
    selectedCoins: selected,
    needsMerge: selected.length > 1,
    totalSelected: total,
    surplus: total >= requiredAmountMist ? total - requiredAmountMist : 0n,
  };
}

/**
 * Get token metadata from chain (decimals, symbol, name).
 */
export async function getTokenMetadata(coinType: string): Promise<{
  decimals: number;
  symbol: string;
  name: string;
} | null> {
  return getCoinMetadata(coinType);
}
