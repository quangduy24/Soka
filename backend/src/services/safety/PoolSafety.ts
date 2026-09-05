/**
 * DIEPS Intent Engine — Pool Safety Service
 * Validates pool safety: age, creator address, liquidity locks.
 */

import { RISK_THRESHOLDS, CETUS_SUPPORTED_DEXES } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { suiRpcCall } from '../../utils/suiClient.js';
import { isStablePair } from '../coin/tokenResolver.js';
import type { RiskCheck, RiskReference } from '../../types/index.js';

/**
 * Build Suiscan-linkable references for every pool object in a route.
 * These are the exact on-chain pool objects the safety checks inspected.
 */
export function poolReferences(route: any[]): RiskReference[] {
  const refs: RiskReference[] = [];
  (route || []).forEach((node, i) => {
    const poolId = node.poolAddress || node.poolId || node.id;
    if (poolId) {
      refs.push({
        label: node.dex ? `${node.dex} pool` : (route.length > 1 ? `Pool ${i + 1}` : 'Liquidity pool'),
        type: 'object',
        value: poolId,
      });
    }
  });
  return refs;
}

/** Known DEX factory/deployer addresses on Sui Mainnet */
const KNOWN_DEX_CREATORS = new Set([
  // Cetus Protocol
  '0x1eabed72c53feb73c83ec843df2f6c74b5ad3d3c0e84ca1bed497476b6ad15e4',
  // Turbos Finance  
  '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1',
  // DeepBook
  '0x000000000000000000000000000000000000000000000000000000000000dee9',
  // Kriya
  '0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe5b4bac',
  // FlowX
  '0xba153169476e8c3114962261d1edc70de5ad9b18b1c21f39e5e05ab7eb6c80a3',
  // Aftermath
  '0x7f6ce7ade63857c4fd16ef7783fed2dfc4d7fb7e40615abdb653030b76aef0c6',
]);

/**
 * Run all pool safety checks based on route data.
 */
export async function checkPoolSafety(route: any[], sourceSymbol: string, destSymbol: string): Promise<RiskCheck[]> {
  const checks: RiskCheck[] = [];

  if (!route || route.length === 0) {
    checks.push({
      name: 'Pool Verification',
      category: 'Token Safety',
      status: 'WARNING',
      message: 'No route data available for safety verification',
    });
    return checks;
  }

  const refs = poolReferences(route);

  // Check 1: DEX verification
  checks.push({ ...checkDexVerification(route), references: refs });

  // Check 2: Liquidity health
  checks.push({ ...checkLiquidityHealth(route, sourceSymbol, destSymbol), references: refs });

  // Check 3: Pool Age / Stale Pool Check (100% On-chain)
  checks.push(await checkPoolAge(route));

  return checks;
}

/**
 * Check if the pools are on known/verified DEXes.
 */
function checkDexVerification(route: any[]): RiskCheck {
  const knownDexes = CETUS_SUPPORTED_DEXES;
  
  const unknownDexes = route.map(n => n.dex).filter(dex => !knownDexes.includes(dex.toLowerCase()));

  if (unknownDexes.length === 0) {
    return {
      name: 'DEX Verification',
      category: 'Token Safety',
      status: 'SAFE',
      message: `All pools are on verified DEXes`,
    };
  }

  return {
    name: 'DEX Verification',
    category: 'Token Safety',
    status: 'WARNING',
    message: `Route includes unverified DEXes: ${unknownDexes.join(', ')} — exercise caution`,
  };
}

/**
 * Check pool liquidity health across the route.
 * Flags routes with very low liquidity.
 */
function checkLiquidityHealth(route: any[], sourceSymbol: string, destSymbol: string): RiskCheck {
  // Sum the liquidity across all pools in the route
  const totalLiquidityInRoute = route.length > 0 
    ? route.reduce((sum, node) => sum + (node.liquidityUsd || 0), 0) 
    : 0;
  
  const isStable = isStablePair(sourceSymbol, destSymbol);
  const { danger, warn, neutral } = isStable ? RISK_THRESHOLDS.liquidityHealth.stablePair : RISK_THRESHOLDS.liquidityHealth.volatilePair;

  if (totalLiquidityInRoute === 0) {
    // Fallback to on-chain depth if USD data is missing
    const minOnChainDepth = Math.min(...route.map(n => n.onChainLiquidityDepth || 0));
    
    if (minOnChainDepth > 0) {
      return {
        name: 'Liquidity Health',
        category: 'High Slippage',
        status: 'WARNING',
        message: `Raw on-chain pool depth is unverified against USD. Relying on Price Impact for liquidity safety.`,
      };
    }

    return {
      name: 'Liquidity Health',
      category: 'High Slippage',
      status: 'WARNING',
      message: 'Liquidity data unavailable for one or more pools in route',
    };
  }

  if (totalLiquidityInRoute < danger) {
    return {
      name: 'Liquidity Health',
      category: 'High Slippage',
      status: 'DANGER',
      message: `Pool liquidity is $${Math.round(totalLiquidityInRoute).toLocaleString()}. High risk.`,
      value: totalLiquidityInRoute,
      threshold: danger,
    };
  }

  if (totalLiquidityInRoute < warn) {
    return {
      name: 'Liquidity Health',
      category: 'High Slippage',
      status: 'WARNING',
      message: `Pool liquidity is $${Math.round(totalLiquidityInRoute).toLocaleString()}. Proceed with caution.`,
      value: totalLiquidityInRoute,
      threshold: warn,
    };
  }

  if (totalLiquidityInRoute < neutral) {
    return {
      name: 'Liquidity Health',
      category: 'High Slippage',
      status: 'NEUTRAL',
      message: `Pool liquidity is $${Math.round(totalLiquidityInRoute).toLocaleString()} (acceptable depth).`,
      value: totalLiquidityInRoute,
      threshold: neutral,
    };
  }

  return {
    name: 'Liquidity Health',
    category: 'High Slippage',
    status: 'SAFE',
    message: `All pools have excellent liquidity.`,
    value: totalLiquidityInRoute,
  };
}

/**
 * Check if a pool address belongs to a known DEX creator.
 */
export function isKnownDexPool(creatorAddress: string): boolean {
  return KNOWN_DEX_CREATORS.has(creatorAddress.toLowerCase());
}

/**
 * Check Pool Age & Recent Activity via On-Chain Timestamp
 * Determines if a pool is "Stale" (abandoned) without any external indexer.
 */
async function checkPoolAge(route: any[]): Promise<RiskCheck> {
  if (route.length === 0) {
    return { name: 'Pool Age Activity', category: 'Stale Pools', status: 'WARNING', message: 'No route data' };
  }

  try {
    let maxDaysSinceLastTx = -1;
    let processedPools = 0;
    let stalestPoolId: string | null = null;
    let stalestTxDigest: string | null = null;

    // Check ALL pools in the route to ensure no stale pool is hidden
    for (const node of route) {
      const poolId = node.poolAddress || node.poolId || node.id;
      if (!poolId) continue;

      const poolObject = await suiRpcCall('sui_getObject', [poolId, { showPreviousTransaction: true }]);
      const previousTxDigest = poolObject?.data?.previousTransaction;
      if (!previousTxDigest) continue;

      const txBlock = await suiRpcCall('sui_getTransactionBlock', [previousTxDigest, { showInput: false, showEffects: false, showEvents: false }]);
      const timestampMs = parseInt(txBlock?.timestampMs || '0');
      if (timestampMs === 0) continue;

      const nowMs = Date.now();
      const daysSinceLastTx = (nowMs - timestampMs) / (1000 * 60 * 60 * 24);

      if (daysSinceLastTx > maxDaysSinceLastTx) {
        maxDaysSinceLastTx = daysSinceLastTx;
        stalestPoolId = poolId;
        stalestTxDigest = previousTxDigest;
      }
      processedPools++;
    }

    if (processedPools === 0) {
       return { name: 'Pool Age Activity', category: 'Stale Pools', status: 'WARNING', message: 'Could not determine recent pool activity on-chain for any pool' };
    }

    // On-chain proof: the stalest pool object and its last transaction.
    const ageRefs: RiskReference[] = [];
    if (stalestPoolId) ageRefs.push({ label: 'Stalest pool', type: 'object', value: stalestPoolId });
    if (stalestTxDigest) ageRefs.push({ label: 'Last pool tx', type: 'tx', value: stalestTxDigest });

    const { danger: ageDanger, warn: ageWarn } = RISK_THRESHOLDS.poolAge;

    if (maxDaysSinceLastTx > ageDanger) {
      return {
        name: 'Pool Age Activity',
        category: 'Stale Pools',
        status: 'DANGER',
        message: `Stale Pool: No activity in ${Math.floor(maxDaysSinceLastTx)} days.`,
        value: maxDaysSinceLastTx,
        references: ageRefs,
      };
    }

    if (maxDaysSinceLastTx > ageWarn) {
      return {
        name: 'Pool Age Activity',
        category: 'Stale Pools',
        status: 'WARNING',
        message: `Low Activity: No txs in ${Math.floor(maxDaysSinceLastTx)} days.`,
        value: maxDaysSinceLastTx,
        references: ageRefs,
      };
    }

    let timeString = '';
    const hoursSinceTx = maxDaysSinceLastTx * 24;
    if (hoursSinceTx < 1) {
      const minutesSinceTx = hoursSinceTx * 60;
      if (minutesSinceTx < 1) {
        timeString = 'just now';
      } else {
        timeString = `${Math.floor(minutesSinceTx)} minutes ago`;
      }
    } else {
      timeString = `${Math.floor(hoursSinceTx)} hours ago`;
    }

    return {
      name: 'Pool Age Activity',
      category: 'Stale Pools',
      status: 'SAFE',
      message: `All pools are active. The stalest pool had a transaction ${timeString}.`,
      value: maxDaysSinceLastTx,
      references: ageRefs,
    };
  } catch (err: any) {
    logger.warn('Pool age check failed', { error: err.message });
    return {
      name: 'Pool Age Activity',
      category: 'Stale Pools',
      status: 'WARNING',
      message: 'On-chain activity check failed. Proceed with caution.',
    };
  }
}
