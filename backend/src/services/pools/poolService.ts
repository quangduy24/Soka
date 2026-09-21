/**
 * Soka Intent Engine — Pool Service
 * Real liquidity-pool discovery on Mezo Testnet with no hardcoded pool data.
 *
 * Sources (all on-chain):
 * - Pair enumeration: Mezo Swap Factory `allPairsLength` / `allPairs`
 * - Pair composition: pair `token0` / `token1` / `getReserves`
 * - Pool valuation: PriceOracle (BTC) + router quotes (see priceService)
 * - User position: pair ERC-20 `balanceOf` / `totalSupply`
 *
 * Unavailable values resolve to null (unknown) instead of estimates.
 * Liquidity quotes pair with the unsigned add/remove builders below for
 * real on-chain execution through the Tigris router.
 */

import { formatUnits, parseUnits, isAddress, encodeFunctionData, type Address, type Abi } from 'viem';
import {
  MEZO_SWAP_ROUTER,
  MEZO_SWAP_FACTORY,
  MEZO_CHAIN_ID,
  MARKET_CONFIG,
  RISK_THRESHOLDS,
  TX_CONFIG,
  ZERO_ADDRESS,
  DEFAULT_DECIMALS,
  DEFAULT_SLIPPAGE_PCT,
  API_PAGINATION,
} from '../../config/index.js';
import { readContract, simulateCalls } from '../../utils/mezoClient.js';
import { getDecimals, getSymbol, getName, getBalanceOf, getAllowance, buildApproveTx } from '../../utils/erc20Utils.js';
import { getTokenUsdPrice, type TokenPrice } from '../prices/priceService.js';
import { resolveToken } from '../coin/tokenResolver.js';
import { noteMusdLeg, ensureMusdRegistered } from '../tokens/musdDiscovery.js';
import { logger } from '../../utils/logger.js';
import type { ExecuteSwapResult, TxStep } from '../../types/index.js';
import rawFactoryAbi from '../../abi/mezoSwapFactory.json' with { type: 'json' };
import rawRouterAbi from '../../abi/mezoSwapRouter.json' with { type: 'json' };
import rawPairAbi from '../../abi/mezoSwapPair.json' with { type: 'json' };
import rawErc20Abi from '../../abi/erc20.json' with { type: 'json' };

const factoryAbi = rawFactoryAbi as unknown as Abi;
const routerAbi = rawRouterAbi as unknown as Abi;
const pairAbi = rawPairAbi as unknown as Abi;
const erc20Abi = rawErc20Abi as unknown as Abi;

export interface PoolTokenLeg {
  address: string;
  symbol: string;
  decimals: number;
  reserve: string;
  priceUsd: number | null;
  priceSource: TokenPrice['source'];
}

export interface PoolInfo {
  address: string;
  token0: PoolTokenLeg;
  token1: PoolTokenLeg;
  /** Solidly stable flag, or null when it cannot be resolved on-chain */
  stable: boolean | null;
  /** Real pool fee in percent from factory.getFee, or null when unreadable */
  feePct: number | null;
  /** Total value locked in USD, or null when any leg price is unknown */
  tvlUsd: number | null;
  /** Share of pool LP tokens held by the requested wallet (percent), if asked */
  userSharePct: number | null;
  /** User LP token balance (formatted), if asked */
  userLpBalance: string | null;
  /** 24h volume is not observable on-chain; always null (unknown) */
  volume24h: null;
}

export interface PoolListResult {
  totalPairs: number;
  offset: number;
  limit: number;
  pools: PoolInfo[];
  cachedAt: number;
}

export interface AddLiquidityQuote {
  poolAddress: string;
  amountADesired: string;
  amountBDesired: string;
  quotedAmountA: string;
  quotedAmountB: string;
  liquidityTokens: string;
  executable: true;
}

export interface RemoveLiquidityQuote {
  poolAddress: string;
  liquidity: string;
  quotedAmountA: string;
  quotedAmountB: string;
  executable: true;
}

interface ListCacheEntry {
  value: PoolListResult;
  expiresAt: number;
}

const listCache = new Map<string, ListCacheEntry>();

async function readPairLegs(pair: Address): Promise<{
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
} | null> {
  try {
    const [token0, token1, reserves] = await Promise.all([
      readContract<Address>({ address: pair, abi: pairAbi, functionName: 'token0' }),
      readContract<Address>({ address: pair, abi: pairAbi, functionName: 'token1' }),
      readContract<readonly [bigint, bigint, number]>({ address: pair, abi: pairAbi, functionName: 'getReserves' }),
    ]);
    return { token0, token1, reserve0: reserves[0], reserve1: reserves[1] };
  } catch (err) {
    logger.warn(`Failed to read pair ${pair}: ${(err as Error).message}`);
    return null;
  }
}

async function resolveStableFlag(token0: Address, token1: Address, pair: Address): Promise<boolean | null> {
  try {
    const [stablePool, volatilePool] = await Promise.all([
      readContract<Address>({
        address: MEZO_SWAP_FACTORY,
        abi: factoryAbi,
        functionName: 'getPool',
        args: [token0, token1, true],
      }).catch(() => null),
      readContract<Address>({
        address: MEZO_SWAP_FACTORY,
        abi: factoryAbi,
        functionName: 'getPool',
        args: [token0, token1, false],
      }).catch(() => null),
    ]);
    const target = pair.toLowerCase();
    if (stablePool && String(stablePool).toLowerCase() === target) return true;
    if (volatilePool && String(volatilePool).toLowerCase() === target) return false;
    return null;
  } catch {
    return null;
  }
}

async function readPoolFee(pair: Address, stable: boolean | null): Promise<number | null> {
  if (stable == null) return null;
  try {
    const raw = await readContract<bigint | number>({
      address: MEZO_SWAP_FACTORY,
      abi: factoryAbi,
      functionName: 'getFee',
      args: [pair, stable],
    });
    const bps = Number(raw);
    // Tigris fees are expressed in basis points (e.g. 30 = 0.3%).
    return Number.isFinite(bps) && bps >= 0 ? bps / TX_CONFIG.bpsToPctDivisor : null;
  } catch {
    return null;
  }
}

async function buildLeg(address: Address, reserveRaw: bigint): Promise<PoolTokenLeg> {
  const [decimals, symbol, price] = await Promise.all([
    getDecimals(address).catch(() => DEFAULT_DECIMALS),
    getSymbol(address)
      .catch(() => resolveToken(address)?.symbol || 'UNKNOWN'),
    getTokenUsdPrice(address),
  ]);
  // Opportunistically register MUSD (the documented Mezo stablecoin) when it
  // appears as a pool leg, so intents can reference it without hardcoding.
  if (symbol.toUpperCase() === 'MUSD' && !resolveToken('MUSD')) {
    await noteMusdLeg(address, symbol, decimals).catch(() => undefined);
  }
  return {
    address,
    symbol,
    decimals,
    reserve: formatUnits(reserveRaw, decimals),
    priceUsd: price.priceUsd,
    priceSource: price.source,
  };
}

/**
 * Ensures MUSD is resolvable (env override or on-chain pool scan).
 * Re-exported here so intent processing keeps a single import surface.
 */
export { ensureMusdRegistered };

async function buildPoolInfo(pair: Address, wallet?: Address): Promise<PoolInfo | null> {
  const legs = await readPairLegs(pair);
  if (!legs) return null;

  const [leg0, leg1, stable] = await Promise.all([
    buildLeg(legs.token0, legs.reserve0),
    buildLeg(legs.token1, legs.reserve1),
    resolveStableFlag(legs.token0, legs.token1, pair),
  ]);
  const feePct = await readPoolFee(pair, stable);

  let tvlUsd: number | null = null;
  if (leg0.priceUsd != null && leg1.priceUsd != null) {
    const v0 = Number(leg0.reserve) * leg0.priceUsd;
    const v1 = Number(leg1.reserve) * leg1.priceUsd;
    if (Number.isFinite(v0) && Number.isFinite(v1)) tvlUsd = v0 + v1;
  }

  let userSharePct: number | null = null;
  let userLpBalance: string | null = null;
  if (wallet && isAddress(wallet)) {
    try {
      const [bal, supply, lpDecimals] = await Promise.all([
        getBalanceOf(pair, wallet),
        readContract<bigint>({ address: pair, abi: erc20Abi, functionName: 'totalSupply' }),
        getDecimals(pair).catch(() => DEFAULT_DECIMALS),
      ]);
      userLpBalance = formatUnits(bal, lpDecimals);
      if (supply > 0n) {
        const pct = (Number(bal) / Number(supply)) * 100;
        userSharePct = Number.isFinite(pct) ? pct : null;
      } else {
        userSharePct = 0;
      }
    } catch (err) {
      logger.warn(`Failed to read LP position for ${wallet} in ${pair}: ${(err as Error).message}`);
    }
  }

  return {
    address: pair,
    token0: leg0,
    token1: leg1,
    stable,
    feePct,
    tvlUsd,
    userSharePct,
    userLpBalance,
    volume24h: null,
  };
}

/**
 * Lists real pools from the Mezo Swap factory with pagination.
 * Results are cached briefly (env POOLS_CACHE_TTL_MS); at most
 * POOLS_MAX_SCAN pairs are scanned per request.
 */
export async function listPools(params: {
  limit?: number;
  offset?: number;
  walletAddress?: string;
}): Promise<PoolListResult> {
  const limit = Math.min(Math.max(params.limit ?? API_PAGINATION.poolsDefaultLimit, 1), MARKET_CONFIG.poolsMaxScan);
  const offset = Math.max(params.offset ?? 0, 0);
  const wallet =
    params.walletAddress && isAddress(params.walletAddress)
      ? (params.walletAddress as Address)
      : undefined;

  const cacheKey = `pools:${limit}:${offset}:${wallet ?? '-'}`;
  const cached = listCache.get(cacheKey);
  if (cached && Date.now() <= cached.expiresAt) return cached.value;

  const totalRaw = await readContract<bigint>({
    address: MEZO_SWAP_FACTORY,
    abi: factoryAbi,
    functionName: 'allPoolsLength',
  }).catch((err) => {
    throw new Error(`Failed to read factory pool count: ${(err as Error).message}`);
  });
  const totalPairs = Number(totalRaw);
  const end = Math.min(offset + limit, totalPairs, offset + MARKET_CONFIG.poolsMaxScan);

  const pairPromises: Promise<Address | null>[] = [];
  for (let i = offset; i < end; i++) {
    pairPromises.push(
      readContract<Address>({
        address: MEZO_SWAP_FACTORY,
        abi: factoryAbi,
        functionName: 'allPools',
        args: [BigInt(i)],
      }).catch((err) => {
        logger.warn(`Failed to read allPools(${i}): ${(err as Error).message}`);
        return null;
      })
    );
  }
  const resolvedPairs = await Promise.all(pairPromises);
  const pairs: Address[] = resolvedPairs.filter((p): p is Address => p !== null && isAddress(p));

  const poolPromises = pairs.map((pair) => buildPoolInfo(pair, wallet));
  const resolvedPools = await Promise.all(poolPromises);
  const pools: PoolInfo[] = resolvedPools.filter((info): info is PoolInfo => info !== null);

  const result: PoolListResult = { totalPairs, offset, limit, pools, cachedAt: Date.now() };
  listCache.set(cacheKey, { value: result, expiresAt: Date.now() + MARKET_CONFIG.poolsCacheTtlMs });
  return result;
}

/** Reads a single real pool by pair address. */
export async function getPoolDetail(pairAddress: string, walletAddress?: string): Promise<PoolInfo> {
  if (!isAddress(pairAddress)) throw new Error(`Invalid pool address: ${pairAddress}`);
  const pair = pairAddress as Address;
  const wallet =
    walletAddress && isAddress(walletAddress) ? (walletAddress as Address) : undefined;

  const isPair = await readContract<boolean>({
    address: MEZO_SWAP_FACTORY,
    abi: factoryAbi,
    functionName: 'isPool',
    args: [pair],
  }).catch(() => false);
  if (!isPair) throw new Error(`Address is not a registered Mezo Swap pair: ${pairAddress}`);

  const info = await buildPoolInfo(pair, wallet);
  if (!info) throw new Error(`Failed to read pool reserves: ${pairAddress}`);
  return info;
}

/**
 * Read-only add-liquidity preview via router.quoteAddLiquidity.
 * Pair with buildAddLiquidityTx for execution.
 */
/**
 * Reserve-proportional paired amount: given amountA of tokenA, returns the
 * matching amountB of tokenB at live reserves. Lets callers quote a single
 * input leg instead of guessing a 1:1 ratio across different decimals/prices.
 */
export async function quotePairedAmount(params: {
  tokenA: string;
  tokenB: string;
  stable: boolean;
  amountA: string;
}): Promise<{ amountB: string; reserveA: string; reserveB: string; poolAddress: string }> {
  const { tokenA, tokenB, stable, amountA } = params;
  if (!isAddress(tokenA) || !isAddress(tokenB)) {
    throw new Error('quotePairedAmount requires valid tokenA/tokenB addresses');
  }
  const [decA, decB] = await Promise.all([
    getDecimals(tokenA as Address),
    getDecimals(tokenB as Address),
  ]);
  const parsedA = parseUnits(amountA, decA);
  if (parsedA <= 0n) throw new Error('quotePairedAmount requires a positive amountA');
  const pair = await readContract<Address>({
    address: MEZO_SWAP_FACTORY,
    abi: factoryAbi,
    functionName: 'getPool',
    args: [tokenA, tokenB, stable],
  }).catch((err) => {
    throw new Error(`Failed to resolve pool: ${(err as Error).message}`);
  });
  if (!pair || pair === ZERO_ADDRESS) {
    throw new Error('No registered pool exists for these tokens and pool type');
  }
  const legs = await readPairLegs(pair);
  if (!legs || legs.reserve0 <= 0n || legs.reserve1 <= 0n) {
    throw new Error('Pool reserves are empty or unreadable — cannot proportion the paired leg');
  }
  const aIsTok0 = (tokenA as string).toLowerCase() === legs.token0.toLowerCase();
  const reserveA = aIsTok0 ? legs.reserve0 : legs.reserve1;
  const reserveB = aIsTok0 ? legs.reserve1 : legs.reserve0;
  // Scale across decimals: amountB = amountA * reserveB/reserveA * 10^(decB-decA).
  const scaled = (parsedA * reserveB) / reserveA;
  const decShift = decB - decA;
  const amountB = decShift >= 0 ? scaled * 10n ** BigInt(decShift) : scaled / 10n ** BigInt(-decShift);
  if (amountB <= 0n) throw new Error('Paired amount rounds to zero — increase amountA');
  return {
    amountB: formatUnits(amountB, decB),
    reserveA: formatUnits(reserveA, decA),
    reserveB: formatUnits(reserveB, decB),
    poolAddress: pair,
  };
}

export async function quoteAddLiquidity(params: {
  tokenA: string;
  tokenB: string;
  stable: boolean;
  amountADesired: string;
  amountBDesired: string;
}): Promise<AddLiquidityQuote> {
  const { tokenA, tokenB, stable, amountADesired, amountBDesired } = params;
  if (!isAddress(tokenA) || !isAddress(tokenB)) {
    throw new Error('quoteAddLiquidity requires valid tokenA/tokenB addresses');
  }
  const [decA, decB] = await Promise.all([
    getDecimals(tokenA as Address),
    getDecimals(tokenB as Address),
  ]);
  const parsedA = parseUnits(amountADesired, decA);
  const parsedB = parseUnits(amountBDesired, decB);

  const pair = await readContract<Address>({
    address: MEZO_SWAP_FACTORY,
    abi: factoryAbi,
    functionName: 'getPool',
    args: [tokenA, tokenB, stable],
  }).catch((err) => {
    throw new Error(`Failed to resolve pool: ${(err as Error).message}`);
  });
  if (!pair || pair === ZERO_ADDRESS) {
    throw new Error('No registered pool exists for these tokens and pool type');
  }

  const [quotedA, quotedB, liquidity] = (await readContract<readonly [bigint, bigint, bigint]>({
    address: MEZO_SWAP_ROUTER,
    abi: routerAbi,
    functionName: 'quoteAddLiquidity',
    args: [tokenA, tokenB, stable, MEZO_SWAP_FACTORY, parsedA, parsedB],
  } as any).catch((err) => {
    throw new Error(`quoteAddLiquidity failed: ${(err as Error).message}`);
  })) as readonly [bigint, bigint, bigint];

  return {
    poolAddress: pair,
    amountADesired,
    amountBDesired,
    quotedAmountA: formatUnits(quotedA, decA),
    quotedAmountB: formatUnits(quotedB, decB),
    liquidityTokens: liquidity.toString(),
    executable: true,
  };
}

/**
 * Read-only remove-liquidity preview via router.quoteRemoveLiquidity.
 * Pair with buildRemoveLiquidityTx for execution.
 */
export async function quoteRemoveLiquidity(params: {
  poolAddress: string;
  liquidity: string;
}): Promise<RemoveLiquidityQuote> {
  const { poolAddress, liquidity } = params;
  if (!isAddress(poolAddress)) throw new Error('quoteRemoveLiquidity requires a valid pool address');
  const pair = poolAddress as Address;

  const [token0, token1, stable] = await Promise.all([
    readContract<Address>({ address: pair, abi: pairAbi, functionName: 'token0' }),
    readContract<Address>({ address: pair, abi: pairAbi, functionName: 'token1' }),
    readContract<boolean>({ address: pair, abi: pairAbi, functionName: 'stable' }).catch(() => null),
  ]);
  if (stable == null) throw new Error('Failed to read pool type');
  const [decA, decB] = await Promise.all([getDecimals(token0), getDecimals(token1)]);
  const lpDecimals = await getDecimals(pair).catch(() => DEFAULT_DECIMALS);
  const parsedLiquidity = parseUnits(liquidity, lpDecimals);

  const [amountA, amountB] = (await readContract<readonly [bigint, bigint]>({
    address: MEZO_SWAP_ROUTER,
    abi: routerAbi,
    functionName: 'quoteRemoveLiquidity',
    args: [token0, token1, stable, MEZO_SWAP_FACTORY, parsedLiquidity],
  } as any).catch((err) => {
    throw new Error(`quoteRemoveLiquidity failed: ${(err as Error).message}`);
  })) as readonly [bigint, bigint];

  return {
    poolAddress: pair,
    liquidity,
    quotedAmountA: formatUnits(amountA, decA),
    quotedAmountB: formatUnits(amountB, decB),
    executable: true,
  };
}

function deadlineTs(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + TX_CONFIG.deadlineSec);
}

async function envelope(
  to: Address,
  data: `0x${string}`,
  value: string,
  txSteps: TxStep[],
  sender: Address
): Promise<ExecuteSwapResult> {
  const serializedData = JSON.stringify({
    to,
    data,
    value,
    chainId: MEZO_CHAIN_ID,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
  });
  let simulation: ExecuteSwapResult['simulation'] = {
    success: true,
    gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    simulated: false,
  };
  try {
    const sim = await simulateCalls(
      sender,
      txSteps
        .filter((s) => s.data)
        .map((s) => ({ to: s.to as Address, data: s.data as `0x${string}`, value: BigInt(s.value || '0') }))
    );
    simulation = {
      success: sim.success,
      gasUsed: sim.gasUsed ?? RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
      simulated: sim.simulated,
      ...(sim.error ? { error: sim.error } : {}),
    };
  } catch (err) {
    simulation = {
      success: false,
      gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
      simulated: false,
      error: `Simulation failed: ${(err as Error).message}`,
    };
  }
  return {
    to,
    data,
    value,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    txSteps,
    ptbSteps: txSteps,
    transactionData: serializedData,
    transactionBytes: Buffer.from(serializedData).toString('base64'),
    simulation,
    routeSummary: {
      inputAmount: '',
      inputToken: '',
      expectedOutput: '',
      outputToken: '',
      priceImpact: 'unknown',
    },
  };
}

async function approveStep(
  token: Address,
  owner: Address,
  amount: bigint,
  label: string,
  txSteps: TxStep[]
): Promise<void> {
  try {
    const allowance = await getAllowance(token, owner, MEZO_SWAP_ROUTER);
    if (allowance >= amount) return;
  } catch {
    // Fall through and include the approval step when unreadable.
  }
  const approvePayload = buildApproveTx(token, MEZO_SWAP_ROUTER, amount * TX_CONFIG.approveMultiplier);
  txSteps.push({
    index: txSteps.length + 1,
    action: 'APPROVE',
    to: token,
    description: `Approve ${label} for Mezo Swap Router`,
    data: approvePayload.data,
    value: '0',
  });
}

/** Applies a slippage haircut to a raw amount (basis-points math, no floats). */
function applySlippage(raw: bigint, slippagePct: number): bigint {
  const bps = BigInt(Math.round(slippagePct * TX_CONFIG.pctToBpsScale));
  const denom = BigInt(TX_CONFIG.pctToBpsScale) * BigInt(TX_CONFIG.pctToBpsScale);
  return (raw * (denom - bps)) / denom;
}

/**
 * Builds unsigned addLiquidity calldata (with approvals) for real execution.
 * Minimums are derived from the desired amounts with a slippage haircut —
 * never zero-protection and never desired-as-minimum.
 */
export async function buildAddLiquidityTx(params: {
  senderAddress: string;
  tokenA: string;
  tokenB: string;
  stable: boolean;
  amountADesired: string;
  amountBDesired: string;
  slippagePercent?: number;
}): Promise<ExecuteSwapResult> {
  const { senderAddress, tokenA, tokenB, stable, amountADesired, amountBDesired, slippagePercent = DEFAULT_SLIPPAGE_PCT } = params;
  if (!isAddress(senderAddress) || !isAddress(tokenA) || !isAddress(tokenB)) {
    throw new Error('buildAddLiquidityTx requires valid sender/token addresses');
  }
  const [decA, decB] = await Promise.all([
    getDecimals(tokenA as Address),
    getDecimals(tokenB as Address),
  ]);
  const parsedA = parseUnits(amountADesired, decA);
  const parsedB = parseUnits(amountBDesired, decB);
  if (parsedA <= 0n || parsedB <= 0n) throw new Error('Liquidity amounts must be positive');
  const minA = applySlippage(parsedA, slippagePercent);
  const minB = applySlippage(parsedB, slippagePercent);

  const txSteps: TxStep[] = [];
  await approveStep(tokenA as Address, senderAddress as Address, parsedA, 'token A', txSteps);
  await approveStep(tokenB as Address, senderAddress as Address, parsedB, 'token B', txSteps);

  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: 'addLiquidity',
    args: [tokenA, tokenB, stable, parsedA, parsedB, minA, minB, senderAddress, deadlineTs()],
  });

  txSteps.push({
    index: txSteps.length + 1,
    action: 'ADD_LIQUIDITY',
    to: MEZO_SWAP_ROUTER,
    description: `Add liquidity ${amountADesired}/${amountBDesired} via Mezo Swap Router`,
    data,
    value: '0',
  });

  return envelope(MEZO_SWAP_ROUTER, data, '0', txSteps, senderAddress as Address);
}

/**
 * Builds unsigned removeLiquidity calldata for real execution.
 */
export async function buildRemoveLiquidityTx(params: {
  senderAddress: string;
  poolAddress: string;
  liquidity: string;
  slippagePercent?: number;
}): Promise<ExecuteSwapResult> {
  const { senderAddress, poolAddress, liquidity, slippagePercent = DEFAULT_SLIPPAGE_PCT } = params;
  if (!isAddress(senderAddress) || !isAddress(poolAddress)) {
    throw new Error('buildRemoveLiquidityTx requires valid sender/pool addresses');
  }
  const pair = poolAddress as Address;
  const [token0, token1, stable] = await Promise.all([
    readContract<Address>({ address: pair, abi: pairAbi, functionName: 'token0' }),
    readContract<Address>({ address: pair, abi: pairAbi, functionName: 'token1' }),
    readContract<boolean>({ address: pair, abi: pairAbi, functionName: 'stable' }),
  ]);
  const lpDecimals = await getDecimals(pair).catch(() => DEFAULT_DECIMALS);
  const parsedLiquidity = parseUnits(liquidity, lpDecimals);
  if (parsedLiquidity <= 0n) throw new Error('Liquidity amount must be positive');

  // Quote the expected output legs on-chain, then haircut with slippage —
  // minimums of zero would accept any sandwich outcome.
  const [quotedA, quotedB] = await quoteRemoveLiquidity({ poolAddress: pair, liquidity }).then(
    async (q) => {
      const [d0, d1] = await Promise.all([getDecimals(token0).catch(() => DEFAULT_DECIMALS), getDecimals(token1).catch(() => DEFAULT_DECIMALS)]);
      return [parseUnits(q.quotedAmountA, d0), parseUnits(q.quotedAmountB, d1)];
    }
  );
  const minA = applySlippage(quotedA, slippagePercent);
  const minB = applySlippage(quotedB, slippagePercent);

  const txSteps: TxStep[] = [];
  await approveStep(pair, senderAddress as Address, parsedLiquidity, 'LP token', txSteps);

  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: 'removeLiquidity',
    args: [token0, token1, stable, parsedLiquidity, minA, minB, senderAddress, deadlineTs()],
  });

  txSteps.push({
    index: txSteps.length + 1,
    action: 'REMOVE_LIQUIDITY',
    to: MEZO_SWAP_ROUTER,
    description: `Remove ${liquidity} LP from ${pair}`,
    data,
    value: '0',
  });

  return envelope(MEZO_SWAP_ROUTER, data, '0', txSteps, senderAddress as Address);
}
