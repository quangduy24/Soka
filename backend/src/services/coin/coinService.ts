/**
 * Soka Intent Engine — Coin & Balance Service
 * Handles native Bitcoin and ERC-20 token balance queries for Mezo Testnet.
 */

import { formatUnits, type Address } from 'viem';
import { ZERO_ADDRESS, TOKEN_WHITELIST } from '../../config/constant.js';
import { getNativeBalance } from '../../utils/mezoClient.js';
import { getBalanceOf } from '../../utils/erc20Utils.js';
import { resolveToken, getTokenDecimalsAsync } from './tokenResolver.js';
import { logger } from '../../utils/logger.js';
import type { BalanceResult } from '../../types/index.js';

/**
 * Retrieves the formatted balance of a token for a given wallet address.
 */
export async function getFormattedBalance(
  walletAddress: string,
  symbolOrAddress: string
): Promise<string> {
  const token = resolveToken(symbolOrAddress);
  const isNative =
    !token ||
    token.symbol.toUpperCase() === 'BTC' ||
    token.address.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  try {
    const addr = walletAddress as Address;
    if (isNative) {
      const rawBalance = await getNativeBalance(addr);
      return formatUnits(rawBalance, 18);
    }

    const tokenAddress = token.address as Address;
    const decimals = token.decimals ?? (await getTokenDecimalsAsync(tokenAddress));
    const rawBalance = await getBalanceOf(tokenAddress, addr);
    return formatUnits(rawBalance, decimals);
  } catch (err) {
    logger.error(`Failed to fetch balance for ${symbolOrAddress}`, {
      address: walletAddress.slice(0, 10) + '...',
      error: (err as Error).message,
    });
    return '0';
  }
}

/**
 * Retrieves detailed balance information for a specific token.
 */
export async function getDetailedBalance(
  walletAddress: string,
  tokenAddress: string
): Promise<BalanceResult> {
  const token = resolveToken(tokenAddress);
  const isNative =
    !token ||
    token.symbol.toUpperCase() === 'BTC' ||
    token.address.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  try {
    const addr = walletAddress as Address;
    const decimals = isNative ? 18 : token?.decimals ?? 18;
    const rawBalance = isNative
      ? await getNativeBalance(addr)
      : await getBalanceOf(token!.address as Address, addr);

    return {
      tokenAddress: token?.address || tokenAddress,
      symbol: token?.symbol || 'UNKNOWN',
      decimals,
      rawBalance: rawBalance.toString(),
      formattedBalance: formatUnits(rawBalance, decimals),
    };
  } catch (err) {
    logger.error('Failed to get detailed balance', { error: (err as Error).message });
    return {
      tokenAddress,
      symbol: token?.symbol || 'UNKNOWN',
      decimals: 18,
      rawBalance: '0',
      formattedBalance: '0',
    };
  }
}

/**
 * Fetches balances for all verified Mezo Testnet whitelist tokens for a wallet.
 */
export async function getAllBalances(walletAddress: string): Promise<BalanceResult[]> {
  const addr = walletAddress as Address;
  const balancePromises = TOKEN_WHITELIST.map(async (token) => {
    try {
      const isNative =
        token.symbol.toUpperCase() === 'BTC' ||
        token.address.toLowerCase() === ZERO_ADDRESS.toLowerCase();

      const rawBalance = isNative
        ? await getNativeBalance(addr)
        : await getBalanceOf(token.address as Address, addr);

      return {
        tokenAddress: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        rawBalance: rawBalance.toString(),
        formattedBalance: formatUnits(rawBalance, token.decimals),
      };
    } catch {
      return {
        tokenAddress: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        rawBalance: '0',
        formattedBalance: '0',
      };
    }
  });

  return Promise.all(balancePromises);
}
