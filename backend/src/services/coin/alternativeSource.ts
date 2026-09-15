/**
 * Soka Intent Engine — Alternative Source Finder
 * When the user's wallet lacks sufficient funds for an intended token swap,
 * this service scans other held tokens on Mezo Testnet and suggests viable alternatives.
 */

import { getAllBalances } from './coinService.js';
import { resolveTokenLogo } from './tokenResolver.js';
import { TOKEN_WHITELIST } from '../../config/constant.js';

export interface AlternativeSource {
  symbol: string;
  tokenAddress: string;
  balance: string;
  usdValue: number;
  logoUrl?: string;
  suggestedAmount: string;
}

/**
 * Estimates USD exchange rate for a token symbol.
 */
function getEstimatedPriceUsd(symbol: string): number {
  const upper = symbol.toUpperCase();
  if (upper.includes('BTC')) return 95_000;
  if (upper === 'MEZO') return 2.5;
  if (upper.includes('USD') || upper.includes('DAI')) return 1.0;
  return 1.0;
}

/**
 * Discovers alternative tokens held in the user's wallet that can fund the swap.
 */
export async function findAlternativeSources(params: {
  walletAddress: string;
  destAddress: string;
  intendedSourceAddress: string;
  intendedAmount: string;
  limit?: number;
}): Promise<AlternativeSource[]> {
  const { walletAddress, destAddress, intendedSourceAddress, intendedAmount, limit = 5 } = params;

  const balances = await getAllBalances(walletAddress);

  // Target approximate USD value
  const intendedSymbol = TOKEN_WHITELIST.find(
    (t) => t.address.toLowerCase() === intendedSourceAddress.toLowerCase()
  )?.symbol || 'BTC';
  const targetUsd = parseFloat(intendedAmount) * getEstimatedPriceUsd(intendedSymbol);

  const candidates: AlternativeSource[] = [];

  for (const b of balances) {
    if (
      b.tokenAddress.toLowerCase() === destAddress.toLowerCase() ||
      b.tokenAddress.toLowerCase() === intendedSourceAddress.toLowerCase()
    ) {
      continue;
    }

    const balanceNum = parseFloat(b.formattedBalance);
    if (balanceNum <= 0) continue;

    const tokenPrice = getEstimatedPriceUsd(b.symbol);
    const usdValue = balanceNum * tokenPrice;

    if (usdValue >= Math.max(1, targetUsd * 0.1)) {
      const neededAmount = tokenPrice > 0 ? (targetUsd / tokenPrice).toFixed(4) : '0';
      candidates.push({
        symbol: b.symbol,
        tokenAddress: b.tokenAddress,
        balance: b.formattedBalance,
        usdValue,
        logoUrl: resolveTokenLogo(b.symbol),
        suggestedAmount: parseFloat(neededAmount) > balanceNum ? b.formattedBalance : neededAmount,
      });
    }
  }

  candidates.sort((a, b) => b.usdValue - a.usdValue);
  return candidates.slice(0, limit);
}
