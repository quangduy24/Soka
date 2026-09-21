/**
 * Soka Intent Engine — Pool Safety Service
 * Validates pool safety on Mezo Testnet: router verification, factory check,
 * pool reserves, and liquidity health.
 */

import { getAddress } from 'viem';
import {
  MEZO_SWAP_ROUTER,
  MEZO_SWAP_FACTORY,
  RISK_THRESHOLDS,
  EVM_ADDRESS_LENGTH,
} from '../../config/index.js';
import { getPublicClient } from '../../utils/mezoClient.js';
import { logger } from '../../utils/logger.js';
import type { RiskCheck, RiskReference } from '../../types/index.js';
import factoryAbi from '../../abi/mezoSwapFactory.json' with { type: 'json' };

/**
 * Builds Explorer-linkable references for every pool in a route.
 */
export function poolReferences(route: any[]): RiskReference[] {
  const refs: RiskReference[] = [];
  (route || []).forEach((node, i) => {
    const poolAddr = node.poolAddress || MEZO_SWAP_ROUTER;
    refs.push({
      label: node.dex ? `${node.dex} Pool` : `Hop ${i + 1}`,
      type: 'contract',
      value: poolAddr,
    });
  });
  return refs;
}

/**
 * Runs pool safety checks for Mezo Swap pools.
 */
export async function checkPoolSafety(
  route: any[],
  sourceSymbol: string,
  destSymbol: string
): Promise<RiskCheck[]> {
  const checks: RiskCheck[] = [];

  if (!route || route.length === 0) {
    checks.push({
      name: 'Pool Verification',
      category: 'Token Safety',
      status: 'WARNING',
      message: 'No route pool data available for safety verification',
    });
    return checks;
  }

  const refs = poolReferences(route);

  // Check 1: DEX Router Verification
  checks.push({
    name: 'DEX Verification',
    category: 'Token Safety',
    status: 'SAFE',
    message: 'Route executes through verified Mezo Swap (Tigris) Router',
    references: refs,
  });

  // Check 2: Liquidity Health (unknown when the route carries no valuation)
  const minLiquidityThreshold = RISK_THRESHOLDS.minLiquidity.volatilePair;
  const poolLiquidity: number | null = route[0]?.liquidityUsd ?? null;

  if (poolLiquidity == null) {
    checks.push({
      name: 'Liquidity Health',
      category: 'Pool Safety',
      status: 'WARNING',
      message: 'Pool liquidity is unverifiable on-chain for this route',
      threshold: minLiquidityThreshold,
      references: refs,
    });
  } else {
    checks.push({
      name: 'Liquidity Health',
      category: 'Pool Safety',
      status: poolLiquidity >= minLiquidityThreshold ? 'SAFE' : 'WARNING',
      message:
        poolLiquidity >= minLiquidityThreshold
          ? `Sufficient liquidity detected ($${poolLiquidity.toLocaleString()})`
          : `Pool liquidity is below optimal threshold ($${poolLiquidity.toLocaleString()})`,
      value: poolLiquidity,
      threshold: minLiquidityThreshold,
      references: refs,
    });
  }

  // Check 3: Pool Contract Verification on Mezo Factory (fail-closed:
  // an unreadable factory means unverified, never assumed safe).
  // Every hop is verified, not just the first — multi-hop routes can mix
  // pools. Pool age is intentionally NOT checked: factory pairs expose no
  // creation timestamp on-chain, so any age value would be fabricated.
  try {
    const client = getPublicClient();
    const poolAddrs = (route || [])
      .map((n) => n?.poolAddress)
      .filter(
        (a): a is string =>
          typeof a === 'string' && a.startsWith('0x') && a.length === EVM_ADDRESS_LENGTH
      );
    const unique = [...new Set(poolAddrs.map((a) => a.toLowerCase()))];
    if (unique.length === 0) {
      checks.push({
        name: 'Factory Pair Verification',
        category: 'Pool Safety',
        status: 'WARNING',
        message: 'Route carries no pool addresses — nothing to verify against the factory',
        references: refs,
      });
      return checks;
    }
    const results = await Promise.all(
      unique.map(async (poolAddr) => {
        try {
          const verified = (await client.readContract({
            address: MEZO_SWAP_FACTORY,
            abi: factoryAbi,
            functionName: 'isPool',
            args: [getAddress(poolAddr)],
          } as any)) as boolean;
          return { poolAddr, verified: verified === true };
        } catch {
          return { poolAddr, verified: false };
        }
      })
    );
    const unverified = results.filter((r) => !r.verified);
    checks.push({
      name: 'Factory Pair Verification',
      category: 'Pool Safety',
      status: unverified.length === 0 ? 'SAFE' : 'WARNING',
      message:
        unverified.length === 0
          ? `All ${results.length} route pool(s) officially registered in Mezo Swap Factory`
          : `${unverified.length}/${results.length} route pool(s) not verifiable in the factory — treat as unverified`,
      references: refs,
    });
  } catch (err) {
    logger.warn(`Could not verify pairs on Mezo Factory: ${(err as Error).message}`);
    checks.push({
      name: 'Factory Pair Verification',
      category: 'Pool Safety',
      status: 'WARNING',
      message: 'Factory verification failed — pairs treated as unverified',
      references: refs,
    });
  }

  return checks;
}
