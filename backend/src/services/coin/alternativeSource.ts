/**
 * DIEPS Intent Engine — Alternative Source Finder
 * When the user asks to swap A → C but their wallet does not hold enough A, we
 * scan the wallet for other tokens (B) that ARE held and worth enough to buy C,
 * so the AI can suggest swapping B → C instead.
 */

import { getAllBalances, getCoinMetadata } from '../../utils/suiClient.js';
import { getUsdPriceOnChain } from '../router/cetusRouter.js';
import { resolveTokenLogo, getDecimalsForCoinType } from './tokenResolver.js';
import { logger } from '../../utils/logger.js';

export interface AlternativeSource {
  symbol: string;
  coinType: string;
  /** Human-readable wallet balance of this token. */
  balance: string;
  /** USD value of the full balance. */
  usdValue: number;
  logoUrl?: string;
  /** Amount of this token to swap so the output ≈ the user's intended trade. */
  suggestedAmount: string;
}

/** Only scan this many non-zero balances to bound pricing calls. */
const MAX_SCAN = 15;

function trimAmount(n: number): string {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 1) return n.toFixed(4).replace(/\.?0+$/, '');
  return n.toPrecision(4).replace(/\.?0+$/, '');
}

/**
 * Find wallet-held tokens worth enough to swap into the destination token.
 * "Enough" = the token's USD value covers the intended trade's USD value
 * (amount × price of the intended source). If that price is unknown, any token
 * worth at least $1 qualifies.
 */
export async function findAlternativeSources(params: {
  walletAddress: string;
  destAddress: string;            // C coin type
  intendedSourceAddress: string;  // A coin type (insufficient)
  intendedAmount: string;         // amount of A the user asked for
  limit?: number;
}): Promise<AlternativeSource[]> {
  const { walletAddress, destAddress, intendedSourceAddress, intendedAmount, limit = 5 } = params;

  // Target USD value the user intended to spend.
  let targetUsd = 0;
  try {
    const priceA = await getUsdPriceOnChain(intendedSourceAddress);
    if (priceA > 0) targetUsd = parseFloat(intendedAmount) * priceA;
  } catch {
    // leave targetUsd = 0 → fall back to a $1 floor below
  }

  let balances = await getAllBalances(walletAddress);
  balances = balances
    .filter((b) => b.coinType !== destAddress && b.coinType !== intendedSourceAddress)
    .slice(0, MAX_SCAN);

  const results: AlternativeSource[] = [];

  await Promise.all(
    balances.map(async (b) => {
      try {
        const decimals = await getDecimalsForCoinType(b.coinType);
        const human = Number(b.totalBalance) / Math.pow(10, decimals);
        if (human <= 0) return;

        const price = await getUsdPriceOnChain(b.coinType);
        if (price <= 0) return; // untradeable / no route → skip

        const usdValue = human * price;
        const enough = targetUsd > 0 ? usdValue >= targetUsd : usdValue >= 1;
        if (!enough) return;

        // Amount of B to swap so the output roughly matches the intended trade.
        const suggested = targetUsd > 0 ? Math.min(human, targetUsd / price) : human;

        results.push({
          symbol: b.coinType.split('::').pop() || 'TOKEN',
          coinType: b.coinType,
          balance: trimAmount(human),
          usdValue,
          logoUrl: await resolveTokenLogo(b.coinType),
          suggestedAmount: trimAmount(suggested),
        });
      } catch (err: any) {
        logger.warn('Failed to evaluate alternative source token', { coinType: b.coinType, error: err.message });
      }
    })
  );

  results.sort((a, b) => b.usdValue - a.usdValue);
  return results.slice(0, limit);
}
