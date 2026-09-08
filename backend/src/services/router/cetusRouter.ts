/**
 * DIEPS Intent Engine — Cetus Aggregator V3 Router
 * Routes swaps through the Cetus Aggregator V3 API for optimal pricing.
 * Falls back to DexScreener-based estimation when aggregator is unavailable.
 */

import { RISK_THRESHOLDS, TOKEN_WHITELIST } from '../../config/index.js';
import { resolveTokenAddress, getTokenDecimalsAsync, resolveToken, getDecimalsForCoinType } from '../coin/tokenResolver.js';
import { logger, createTimer } from '../../utils/logger.js';
import type { RouteResult, RouteNode, PoolDetails } from '../../types/index.js';
import { suiRpcCall, getCoinMetadata } from '../../utils/suiClient.js';
import { AggregatorClient, Env } from '@cetusprotocol/aggregator-sdk';
import BN from 'bn.js';

const CETUS_ENDPOINT = RISK_THRESHOLDS.cetusEndpoint;

/**
 * Reusable read-only routing/pricing client. `signer: '0x2'` is a placeholder
 * (route + price queries don't sign), so a single instance is shared across all
 * route and getUsdPriceOnChain calls instead of constructing a new client on
 * every invocation — a major cost when pricing every hop/pool of a route.
 */
let _pricingClient: AggregatorClient | null = null;
function getPricingClient(): AggregatorClient {
  if (!_pricingClient) {
    _pricingClient = new AggregatorClient({
      endpoint: CETUS_ENDPOINT,
      signer: '0x2',
      env: Env.Mainnet,
    });
  }
  return _pricingClient;
}

/**
 * Find the optimal swap route using Cetus Aggregator V3.
 * Returns route data compatible with the frontend's expected format.
 */
export async function findOptimalRoute(
  sourceSymbol: string,
  destSymbol: string,
  sourceAddress: string,
  destAddress: string,
  amount: string
): Promise<RouteResult> {
  const timer = createTimer('findOptimalRoute');

  // Resolve addresses if needed
  const fromAddress = sourceAddress || await resolveTokenAddress(sourceSymbol);
  const toAddress = destAddress || await resolveTokenAddress(destSymbol);

  // Upgrade Token Discovery: Check if addresses were resolved successfully.
  if (!fromAddress.startsWith('0x')) {
    throw new Error(`UNKNOWN_TOKEN:${sourceSymbol}`);
  }
  if (!toAddress.startsWith('0x')) {
    throw new Error(`UNKNOWN_TOKEN:${destSymbol}`);
  }

  // Use on-chain-accurate decimals (whitelist → registry → on-chain) so the
  // smallest-unit swap amount is correct even for registry tokens that omit a
  // decimals field (which would otherwise default to 9 and mis-size the trade).
  const sourceDecimals = await getTokenDecimalsAsync(sourceSymbol);
  const destDecimals = await getTokenDecimalsAsync(destSymbol);
  const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, sourceDecimals)));

  // Reuse the shared read-only routing client.
  const clientSDK = getPricingClient();
  let routers: any = null;

  try {
    routers = await clientSDK.findRouters({
      from: fromAddress,
      target: toAddress,
      amount: new BN(amountInSmallestUnit.toString()),
      byAmountIn: true,
      splitCount: 20,
      depth: 3,
    });

    if (!routers || !routers.paths || routers.paths.length === 0) {
      throw new Error('No viable swap route found with sufficient liquidity on-chain.');
    }

    timer.end({ method: 'cetus_sdk_v3' });
  } catch (err: any) {
    logger.error('Cetus Aggregator V3 SDK failed', { error: err.message });
    timer.end({ method: 'failed' });
    throw new Error('No viable swap route found with sufficient liquidity on-chain.');
  }

  // ─── Low-liquidity safety filter ─────────────────────────────────────────
  const deviationRatio = routers.deviationRatio || 0;
  const observedPriceImpactPct = Math.abs(deviationRatio) * 100; // e.g. 2.77

  // ─── Effective TVL Calculation (Fix for CLMM & DeepBookV3) ───────────────
  let tradeUsdValue = 0;
  let effectiveTvlUsd = 0;
  try {
    const sourcePrice = await getUsdPriceOnChain(fromAddress);
    // `amount` is already human-readable, so USD value = amount * price.
    // (Previously this divided by 10^decimals again — the same double-conversion
    // bug as B1 — collapsing tradeUsdValue to ~0 and corrupting effectiveTvlUsd.)
    tradeUsdValue = parseFloat(amount) * sourcePrice;

    if (observedPriceImpactPct <= 0.0001) {
      effectiveTvlUsd = RISK_THRESHOLDS.router.tvlCapUsd; // Minimal impact = very deep pool
    } else {
      // Effective TVL ≈ 2 * TradeValue / PriceImpact
      effectiveTvlUsd = (2 * tradeUsdValue) / (observedPriceImpactPct / 100);
      if (effectiveTvlUsd > RISK_THRESHOLDS.router.tvlCapUsd) effectiveTvlUsd = RISK_THRESHOLDS.router.tvlCapUsd;
    }
  } catch (err) {
    logger.warn('Failed to calculate Effective TVL', { error: (err as Error).message });
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (observedPriceImpactPct >= RISK_THRESHOLDS.priceImpact.reject) {
    logger.warn('Skipping low-liquidity route: deviation too high', {
      deviation: deviationRatio,
      impactPct: observedPriceImpactPct.toFixed(2),
      threshold: RISK_THRESHOLDS.priceImpact.reject,
      from: fromAddress,
      target: toAddress,
      amount,
    });
  }

  if (observedPriceImpactPct >= RISK_THRESHOLDS.priceImpact.recommendSplit) {
    logger.warn('Route has high price impact — consider splitting', {
      deviation: deviationRatio,
      impactPct: observedPriceImpactPct.toFixed(2),
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Parse the SDK route paths into frontend-compatible RouteNode format
  const routes: RouteNode[] = [];
  const dexSequence: string[] = [];
  let totalFee = 0;

  for (const path of routers.paths) {
    // M8 fix: warn when SDK omits provider/feeRate instead of silently defaulting
    if (!path.provider) {
      logger.warn('Cetus SDK omitted path.provider, using fallback', { hop: path.id });
    }
    if (!path.feeRate) {
      logger.warn('Cetus SDK omitted path.feeRate, using fallback', { hop: path.id, provider: path.provider });
    }
    const dexName = path.provider || 'Unknown DEX';
    const formattedDex = dexName.charAt(0).toUpperCase() + dexName.slice(1);
    const fee = parseFloat(path.feeRate || String(RISK_THRESHOLDS.router.defaultFeeRate)) * 100;

    if (!dexSequence.includes(formattedDex)) {
      dexSequence.push(formattedDex);
    }

    // ─── Calculate Individual Hop TVL ──────────────────────────────────────
    let hopTvlUsd = effectiveTvlUsd; // Fallback to bottleneck
    try {
      if (path.from && path.target && path.amountIn && path.amountOut) {
        const fromPriceUsd = await getUsdPriceOnChain(path.from);
        const targetPriceUsd = await getUsdPriceOnChain(path.target);

        const fromDecimals = await getDecimalsForCoinType(path.from);
        const targetDecimals = await getDecimalsForCoinType(path.target);

        const amtIn = Number(path.amountIn) / Math.pow(10, fromDecimals);
        const amtOut = Number(path.amountOut) / Math.pow(10, targetDecimals);

        if (fromPriceUsd > 0 && targetPriceUsd > 0 && amtIn > 0 && amtOut > 0) {
          const hopTradeUsd = amtIn * fromPriceUsd;
          const expectedOut = hopTradeUsd / targetPriceUsd;
          const actualOut = amtOut;

          const priceImpact = Math.max(0, 1 - (actualOut / expectedOut));

          const safePriceImpact = Math.max(0.0001, priceImpact);
          hopTvlUsd = (2 * hopTradeUsd) / safePriceImpact;
          if (hopTvlUsd > RISK_THRESHOLDS.router.tvlCapUsd) hopTvlUsd = RISK_THRESHOLDS.router.tvlCapUsd;
        }
      }
    } catch (err) {
      logger.warn('Failed to calc individual hop TVL', { error: (err as Error).message });
    }
    // ───────────────────────────────────────────────────────────────────────

    routes.push({
      dex: formattedDex,
      ratio: 100, // Approximated for UI
      fee: parseFloat(fee.toFixed(2)),
      weight: -Math.log(1 - fee / 100),
      poolAddress: path.id || undefined,
      liquidityUsd: hopTvlUsd,
    });

    totalFee += fee;
  }

  // If no routes parsed, throw an error
  if (routes.length === 0) {
    throw new Error('No viable swap route found with sufficient liquidity on-chain.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH ON-CHAIN POOL DEPTH (To satisfy Risk Guardian without external APIs)
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const poolIds = routes.map(r => r.poolAddress).filter(id => id !== undefined) as string[];
    if (poolIds.length > 0) {
      const poolObjects = await suiRpcCall('sui_multiGetObjects', [
        poolIds,
        { showContent: true }
      ]);

      await Promise.all(poolObjects.map(async (obj: any) => {
        if (obj.data?.content?.dataType === 'moveObject') {
          const poolId = obj.data.objectId;
          const type = obj.data.content.type;
          const fields = (obj.data.content as any).fields;

          const routeNode = routes.find(r => r.poolAddress === poolId);
          if (!routeNode || !fields) return;

          // Extract raw liquidity depth
          const rawDepth = Number(
            fields.liquidity ||
            fields.reserve_x ||
            fields.reserve_y ||
            fields.balance_x ||
            fields.coin_a ||
            fields.base_balance ||
            0
          );

          if (rawDepth > 0) {
            routeNode.onChainLiquidityDepth = rawDepth;
          }

          // Mathematical Active TVL Calculation for CLMMs
          if (fields.liquidity && type) {
            const match = type.match(/<([^,]+),\s*([^,>]+)(?:,\s*[^>]+)*>/);
            if (match) {
              const coinX = match[1];
              const coinY = match[2];

              const L = Number(fields.liquidity);
              if (L > 0) {
                const [metaX, metaY, priceX, priceY] = await Promise.all([
                  getCoinMetadata(coinX),
                  getCoinMetadata(coinY),
                  getUsdPriceOnChain(coinX),
                  getUsdPriceOnChain(coinY)
                ]);

                if (priceX > 0 && priceY > 0 && metaX && metaY) {
                  const decX = metaX.decimals;
                  const decY = metaY.decimals;
                  const avgDec = (decX + decY) / 2;
                  const standardL = L / Math.pow(10, avgDec);

                  const activeTvlUsd = 2 * standardL * Math.sqrt(priceX * priceY);
                  if (activeTvlUsd > 0) {
                    routeNode.liquidityUsd = activeTvlUsd;
                  }
                }
              }
            }
          }
          // TVL Calculation for Orderbook/DeepBookV3 style pools
          else if (type && (fields.base_balance !== undefined || fields.quote_balance !== undefined || fields.balance_x !== undefined || fields.balance_y !== undefined)) {
            const match = type.match(/<([^,]+),\s*([^,>]+)/);
            if (match) {
              const coinX = match[1];
              const coinY = match[2];

              const balX = Number(fields.base_balance || fields.balance_x || 0);
              const balY = Number(fields.quote_balance || fields.balance_y || 0);

              if (balX > 0 || balY > 0) {
                const [metaX, metaY, priceX, priceY] = await Promise.all([
                  getCoinMetadata(coinX),
                  getCoinMetadata(coinY),
                  getUsdPriceOnChain(coinX),
                  getUsdPriceOnChain(coinY)
                ]);

                if (metaX && metaY) {
                  const xUsd = (balX / Math.pow(10, metaX.decimals)) * Math.max(0, priceX);
                  const yUsd = (balY / Math.pow(10, metaY.decimals)) * Math.max(0, priceY);
                  const activeTvlUsd = xUsd + yUsd;

                  if (activeTvlUsd > 0) {
                    routeNode.liquidityUsd = activeTvlUsd;
                  }
                }
              }
            }
          }
        }
      }));
    }
  } catch (err) {
    logger.error('Failed to fetch on-chain liquidity depth', { error: (err as Error).message });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Calculate output amount
  const outputAmount = routers.amountOut
    ? parseFloat(routers.amountOut.toString())
    : 0;

  // Route confidence degrades as price impact increases
  const routeConfidence = Math.max(
    50,
    Math.round(96 - observedPriceImpactPct * 4)
  );

  // Compute optimal slippage from on-chain data — replaces hardcoded 0.995 haircut
  const totalLiquidityUsd = routes.length > 0
    ? routes.reduce((sum, n) => sum + (n.liquidityUsd || 0), 0)
    : 0;
  const optimalSlippage = calculateOptimalSlippage({
    observedPriceImpactPct,
    totalLiquidityUsd: totalLiquidityUsd,
    tradeUsdValue,
    hopCount: routes.length,
  });

  return {
    route: routes,
    dex_sequence: dexSequence,
    expected_output: outputAmount / Math.pow(10, destDecimals),
    minimum_output: (outputAmount / Math.pow(10, destDecimals)) * (1 - optimalSlippage / 100),
    execution_impact: `${observedPriceImpactPct.toFixed(2)}%`,
    route_confidence: routeConfidence,
    dynamicPoolUsed: true,
    poolDetails: null,
    routerData: routers, // Pass the EXACT SDK routers object for PTB Builder!
  };
}

/**
 * Calculate optimal slippage tolerance from on-chain pool data.
 *
 * Formula: base + (priceImpact × multiplier) + liquidityFactor + (hops × hopCost)
 *
 * - base: minimum buffer for normal price movement between simulate & execute
 * - priceImpact: observed price impact from Cetus aggregator simulation, multiplied
 *   by a buffer to account for price movement between simulation and execution
 * - liquidityFactor: when trade size is large relative to pool depth, more slippage
 *   is needed; (tradeUsd / minLiquidity) × liquidityFactor captures this
 * - hopCost: each additional hop in a multi-hop route adds slippage risk
 *
 * Result is clamped to [slippage.min, slippage.max].
 */
export function calculateOptimalSlippage(params: {
  observedPriceImpactPct: number;
  totalLiquidityUsd: number;
  tradeUsdValue: number;
  hopCount: number;
  userSlippage?: number;
}): number {
  const { observedPriceImpactPct, totalLiquidityUsd, tradeUsdValue, hopCount, userSlippage } = params;
  const { base, impactMultiplier, liquidityFactor, hopCost, min, max } = RISK_THRESHOLDS.slippage;

  // If user explicitly set a slippage, respect it (but still apply min/max clamp)
  if (userSlippage !== undefined && userSlippage !== null && userSlippage > 0) {
    return Math.max(min, Math.min(max, userSlippage));
  }

  // Price impact component — buffer above the simulated impact
  const impactComponent = observedPriceImpactPct * impactMultiplier;

  // Liquidity component — higher when trade is large relative to pool depth
  let liquidityComponent = 0;
  if (totalLiquidityUsd > 0 && tradeUsdValue > 0) {
    const tradeToLiquidityRatio = tradeUsdValue / totalLiquidityUsd;
    liquidityComponent = tradeToLiquidityRatio * liquidityFactor * 100;
  }

  // Route complexity — each hop adds slippage risk
  const routeComponent = hopCount * hopCost;

  const raw = base + impactComponent + liquidityComponent + routeComponent;

  return Math.max(min, Math.min(max, raw));
}

// Cache for USD prices to avoid redundant aggregator calls
const usdPriceCache = new Map<string, { price: number; expiresAt: number }>();

export async function getUsdPriceOnChain(coinType: string): Promise<number> {
  const USDC_ADDRESS = TOKEN_WHITELIST.find(t => t.symbol === 'USDC')?.address;
  const USDT_ADDRESS = TOKEN_WHITELIST.find(t => t.symbol === 'USDT')?.address;
  if ((USDC_ADDRESS && coinType === USDC_ADDRESS) || (USDT_ADDRESS && coinType === USDT_ADDRESS)) return 1;

  const cached = usdPriceCache.get(coinType);
  if (cached && cached.expiresAt > Date.now()) return cached.price;

  try {
    const clientSDK = getPricingClient();
    const decimals = await getDecimalsForCoinType(coinType);
    const amountIn = new BN(10).pow(new BN(decimals)); // 1 Token

    const routers = await clientSDK.findRouters({
      from: coinType,
      target: USDC_ADDRESS,
      amount: amountIn,
      byAmountIn: true,
    });

    if (routers && routers.amountOut) {
      // amountOut is in USDC (6 decimals)
      const price = parseFloat(routers.amountOut.toString()) / 1_000_000;
      usdPriceCache.set(coinType, { price, expiresAt: Date.now() + 60_000 }); // Cache for 60s
      return price;
    }
  } catch (err) {
    logger.warn(`Failed to get USD price for ${coinType}`, { error: (err as Error).message });
  }
  return 0;
}


