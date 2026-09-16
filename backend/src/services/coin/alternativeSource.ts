/**
 * Soka Intent Engine — Alternative Source Finder
 * When the user's wallet lacks sufficient funds for an intended token swap,
 * this service scans other held tokens on Mezo Testnet and suggests viable alternatives.
 */

import { getAllBalances } from './coinService.js';
import { resolveTokenLogo } from './tokenResolver.js';
import { getTokenUsdPrice } from '../prices/priceService.js';
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
 * Discovers alternative tokens held in the user's wallet that can fund the swap.
 * Valuations use real on-chain prices; tokens without a known price are skipped
 * instead of being estimated.
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

  // Target approximate USD value from the real on-chain price (unknown -> no suggestions)
  const intendedSymbol = TOKEN_WHITELIST.find(
    (t) => t.address.toLowerCase() === intendedSourceAddress.toLowerCase()
  )?.symbol || 'BTC';
  const intendedPrice = await getTokenUsdPrice(intendedSymbol);
  if (intendedPrice.priceUsd == null) return [];
  const targetUsd = parseFloat(intendedAmount) * intendedPrice.priceUsd;
  if (!Number.isFinite(targetUsd) || targetUsd <= 0) return [];

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

    const tokenPrice = await getTokenUsdPrice(b.symbol);
    if (tokenPrice.priceUsd == null || tokenPrice.priceUsd <= 0) continue;
    const usdValue = balanceNum * tokenPrice.priceUsd;

    if (usdValue >= Math.max(1, targetUsd * 0.1)) {
      const neededAmount = (targetUsd / (tokenPrice.priceUsd as number)).toFixed(4);
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
