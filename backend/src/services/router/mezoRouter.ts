/**
 * Soka Intent Engine — Mezo Swap Router
 * Route discovery and price estimation for Mezo Swap (Solidly / Aerodrome fork).
 * Evaluates both volatile and stable pools, multi-hop routes, and price impact.
 */

import { parseUnits, formatUnits, type Address } from 'viem';
import {
  MEZO_SWAP_ROUTER,
  MEZO_SWAP_FACTORY,
  MEZO_PRECOMPILES,
  ZERO_ADDRESS,
  TOKEN_WHITELIST,
  DEFAULT_DECIMALS,
  DEFAULT_SLIPPAGE_PCT,
  EVM_ADDRESS_LENGTH,
  INTENT_CONFIG,
  TX_CONFIG,
  DISPLAY_DECIMALS,
} from '../../config/index.js';
import { getPublicClient } from '../../utils/mezoClient.js';
import { getDecimals, getSymbol } from '../../utils/erc20Utils.js';
import { getTokenUsdPrice } from '../prices/priceService.js';
import { resolveToken } from '../coin/tokenResolver.js';
import { logger } from '../../utils/logger.js';
import type { RouteResult, RouteNode, PoolDetails, RouteHop } from '../../types/index.js';
import routerAbi from '../../abi/mezoSwapRouter.json' with { type: 'json' };
import factoryAbi from '../../abi/mezoSwapFactory.json' with { type: 'json' };

/**
 * Route candidate with simulated or on-chain return amounts.
 */
interface RouteCandidate {
  hops: RouteHop[];
  amountOut: bigint;
  executionImpact: number;
  poolDetails: PoolDetails | null;
}

/**
 * Intermediate hub tokens for multi-hop routes, resolved from the live
 * whitelist (plus on-chain discovered MUSD) instead of hardcoded addresses.
 */
function getHubTokens(): Address[] {
  const hubs: Address[] = [MEZO_PRECOMPILES.btcToken];
  for (const symbol of ['mUSDC', 'mUSDT', 'MUSD']) {
    const token = resolveToken(symbol) ?? TOKEN_WHITELIST.find((t) => t.symbol === symbol);
    if (token && !hubs.some((h) => h.toLowerCase() === token.address.toLowerCase())) {
      hubs.push(token.address);
    }
  }
  return hubs;
}

/**
 * Resolves zero address (native BTC) to wrapped BTC for contract interaction.
 */
export function normalizeTokenAddress(address: string): Address {
  const lower = address.toLowerCase();
  if (lower === ZERO_ADDRESS.toLowerCase() || lower === 'btc') {
    return MEZO_PRECOMPILES.btcToken;
  }
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new Error(`Unresolved or invalid token address: ${address}`);
  }
  return address as Address;
}

/**
 * Finds the optimal swap route between source and destination tokens on Mezo Swap.
 */
export async function findOptimalRoute(
  sourceTokenAddress: string,
  destTokenAddress: string,
  amountInFormatted: string,
  slippageTolerancePercent = DEFAULT_SLIPPAGE_PCT
): Promise<RouteResult> {
  const isNativeIn = sourceTokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();
  const isNativeOut = destTokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  const tokenIn = normalizeTokenAddress(sourceTokenAddress);
  const tokenOut = normalizeTokenAddress(destTokenAddress);

  const sourceDecimals = await getDecimals(tokenIn).catch(() => DEFAULT_DECIMALS);
  const destDecimals = await getDecimals(tokenOut).catch(() => DEFAULT_DECIMALS);

  const parsedAmountIn = parseUnits(amountInFormatted, sourceDecimals);

  logger.info(`Calculating Mezo route: ${tokenIn} -> ${tokenOut} (${amountInFormatted})`);

  // Build candidate paths (direct volatile, direct stable, and multi-hop via hubs).
  // Tigris routes carry the factory address on every hop.
  const mkHop = (from: Address, to: Address, stable: boolean): RouteHop => ({
    from,
    to,
    stable,
    factory: MEZO_SWAP_FACTORY,
  });
  const candidatePaths: RouteHop[][] = [
    [mkHop(tokenIn, tokenOut, false)],
    [mkHop(tokenIn, tokenOut, true)],
  ];

  for (const hub of getHubTokens()) {
    if (hub.toLowerCase() !== tokenIn.toLowerCase() && hub.toLowerCase() !== tokenOut.toLowerCase()) {
      candidatePaths.push([
        mkHop(tokenIn, hub, false),
        mkHop(hub, tokenOut, false),
      ]);
      candidatePaths.push([
        mkHop(tokenIn, hub, true),
        mkHop(hub, tokenOut, false),
      ]);
    }
  }

  let bestRoute: RouteCandidate | null = null;
  const client = getPublicClient();

  // Try on-chain route quote from Mezo Router (single attempt per candidate without retry delay)
  for (const hops of candidatePaths) {
    try {
      const amounts = (await client.readContract({
        address: MEZO_SWAP_ROUTER,
        abi: routerAbi,
        functionName: 'getAmountsOut',
        args: [
          parsedAmountIn,
          hops.map((h) => ({
            from: h.from,
            to: h.to,
            stable: h.stable,
            factory: h.factory,
          })),
        ],
      } as any)) as bigint[];

      if (amounts && amounts.length > 0) {
        const outAmount = amounts[amounts.length - 1];
        if (!bestRoute || outAmount > bestRoute.amountOut) {
          bestRoute = {
            hops,
            amountOut: outAmount,
            executionImpact: calculateSimulatedPriceImpact(hops.length, parsedAmountIn),
            poolDetails: {
              dex: 'Mezo Swap',
              address: MEZO_SWAP_ROUTER,
              baseToken: { address: tokenIn, symbol: await getSymbol(tokenIn).catch(() => 'SRC'), name: 'Source Token' },
              quoteToken: { address: tokenOut, symbol: await getSymbol(tokenOut).catch(() => 'DEST'), name: 'Dest Token' },
              // Valued after the best route is selected; null means unknown.
              priceUsd: null,
              liquidity: null,
              // 24h volume is not observable on-chain; null means unknown.
              volume24h: null,
              stable: hops[0].stable,
            },
          };
        }
      }
    } catch {
      // Pool might not exist or lacks liquidity on testnet
      continue;
    }
  }

  // No on-chain quote: fail loudly instead of inventing a route.
  if (!bestRoute || bestRoute.amountOut === 0n) {
    throw new Error(
      'NO_LIQUIDITY: Mezo Swap router returned no active pool quote for this pair. ' +
        'The pools may be undeployed or lack liquidity on testnet.'
    );
  }

  // Resolve the real pair and value its reserves on-chain (null when unknowable)
  const firstHop = bestRoute.hops[0];
  let pairAddress: Address = MEZO_SWAP_ROUTER;
  let liquidityUsd: number | null = null;
  let feePct: number | null = null;
  try {
    const resolved = await client
      .readContract({
        address: MEZO_SWAP_FACTORY,
        abi: factoryAbi,
        functionName: 'getPool',
        args: [tokenIn, tokenOut, firstHop.stable],
      } as any)
      .catch(() => null);
    if (typeof resolved === 'string' && resolved.startsWith('0x') && resolved.length === EVM_ADDRESS_LENGTH) {
      pairAddress = resolved as Address;
    }
    const reserves = (await client
      .readContract({
        address: MEZO_SWAP_ROUTER,
        abi: routerAbi,
        functionName: 'getReserves',
        args: [tokenIn, tokenOut, firstHop.stable, MEZO_SWAP_FACTORY],
      } as any)
      .catch(() => null)) as readonly [bigint, bigint] | null;
    if (reserves) {
      const [priceIn, priceOut] = await Promise.all([
        getTokenUsdPrice(tokenIn),
        getTokenUsdPrice(tokenOut),
      ]);
      const decIn = sourceDecimals;
      const decOut = destDecimals;
      if (priceIn.priceUsd != null && priceOut.priceUsd != null) {
        const vIn = Number(formatUnits(reserves[0], decIn)) * priceIn.priceUsd;
        const vOut = Number(formatUnits(reserves[1], decOut)) * priceOut.priceUsd;
        if (Number.isFinite(vIn) && Number.isFinite(vOut)) liquidityUsd = vIn + vOut;
      }
    }
  } catch (err) {
    logger.warn(`Failed to value route reserves: ${(err as Error).message}`);
  }

  // Real pool fee from the factory (basis points-ish units resolved on-chain)
  try {
    if (pairAddress !== MEZO_SWAP_ROUTER) {
      const feeRaw = (await client
        .readContract({
          address: MEZO_SWAP_FACTORY,
          abi: factoryAbi,
          functionName: 'getFee',
          args: [pairAddress, firstHop.stable],
        } as any)
        .catch(() => null)) as bigint | number | null;
      if (feeRaw != null) {
        const bps = Number(feeRaw);
        if (Number.isFinite(bps) && bps >= 0) feePct = bps / TX_CONFIG.bpsToPctDivisor;
      }
    }
  } catch (err) {
    logger.warn(`Failed to read pool fee: ${(err as Error).message}`);
  }

  const expectedOutputFormatted = Number(formatUnits(bestRoute.amountOut, destDecimals));
  const minOutputFormatted = expectedOutputFormatted * (1 - slippageTolerancePercent / 100);

  const hopShare = TX_CONFIG.singleRouteRatio / bestRoute.hops.length;
  const routeNodes: RouteNode[] = bestRoute.hops.map((hop, index) => ({
    dex: 'Mezo Swap',
    ratio: hopShare,
    // Fee resolved on-chain above; omitted when unknown instead of guessed.
    ...(feePct != null ? { fee: feePct } : {}),
    weight: index + 1,
    poolAddress: index === 0 ? pairAddress : hop.poolAddress,
    ...(liquidityUsd != null ? { liquidityUsd } : {}),
    stable: hop.stable,
  }));

  return {
    route: routeNodes,
    dex_sequence: bestRoute.hops.map(() => 'Mezo Swap'),
    expected_output: expectedOutputFormatted,
    minimum_output: minOutputFormatted,
    execution_impact: `${bestRoute.executionImpact.toFixed(2)}%`,
    // Confidence reflects a live on-chain quote (no synthetic fallback exists).
    route_confidence: 1.0,
    dynamicPoolUsed: false,
    poolDetails: bestRoute.poolDetails
      ? { ...bestRoute.poolDetails, address: pairAddress, liquidity: liquidityUsd }
      : null,
    routerData: {
      routes: bestRoute.hops,
      amountIn: parsedAmountIn.toString(),
      amountOut: bestRoute.amountOut.toString(),
      tokenIn,
      tokenOut,
      isNativeIn,
      isNativeOut,
    },
  };
}

/**
 * Hop-count price-impact heuristic. Trade size is accepted for API stability
 * but the heuristic is intentionally size-independent — callers must treat it
 * as a lower bound and prefer oracle-anchored deviation when available.
 * Tuned via PRICE_IMPACT_PER_HOP / PRICE_IMPACT_CAP, never hardcoded.
 */
function calculateSimulatedPriceImpact(hopsCount: number, _amountIn: bigint): number {
  const baseImpact = INTENT_CONFIG.impactPerHopPct * hopsCount;
  return Math.min(baseImpact, INTENT_CONFIG.impactCapPct);
}
