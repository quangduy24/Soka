/**
 * Soka Intent Engine — Price Service
 * Real USD price discovery on Mezo Testnet with no hardcoded prices.
 *
 * Sources (in order):
 * 1. BTC / wBTC: Mezo PriceOracle precompile (Chainlink AggregatorV3 interface)
 *    at 0x7b7c...0015, with on-chain staleness validation.
 * 2. Other tokens: on-chain router quote of 1 unit -> wBTC (getAmountsOut),
 *    converted with the oracle BTC/USD price.
 *
 * Any token without an on-chain price resolves to null (unknown) instead of
 * an estimated value. Callers must handle null explicitly.
 */

import { formatUnits, parseUnits, type Address, type Abi } from 'viem';
import {
  MEZO_PRECOMPILES,
  MARKET_CONFIG,
  ZERO_ADDRESS,
  MEZO_SWAP_ROUTER,
  MEZO_SWAP_FACTORY,
} from '../../config/index.js';
import { readContract } from '../../utils/mezoClient.js';
import { getDecimals } from '../../utils/erc20Utils.js';
import { resolveToken } from '../coin/tokenResolver.js';
import { ensureMusdRegistered } from '../tokens/musdDiscovery.js';
import { logger } from '../../utils/logger.js';
import rawPriceOracleAbi from '../../abi/priceOracle.json' with { type: 'json' };
import rawRouterAbi from '../../abi/mezoSwapRouter.json' with { type: 'json' };

const priceOracleAbi = rawPriceOracleAbi as unknown as Abi;
const routerAbi = rawRouterAbi as unknown as Abi;

export interface TokenPrice {
  symbol: string;
  address: string;
  /** USD price, or null when no on-chain source is available */
  priceUsd: number | null;
  /** Where the price came from: oracle | router-quote | null */
  source: 'oracle' | 'router-quote' | null;
  /** Oracle round timestamp (seconds) when sourced from the oracle */
  updatedAt: number | null;
}

interface CacheEntry {
  value: TokenPrice;
  expiresAt: number;
}

const priceCache = new Map<string, CacheEntry>();

function readCache(key: string): TokenPrice | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    priceCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: TokenPrice): void {
  priceCache.set(key, { value, expiresAt: Date.now() + MARKET_CONFIG.priceCacheTtlMs });
}

function isBtcAsset(address: string, symbol: string): boolean {
  const lower = address.toLowerCase();
  const upper = symbol.toUpperCase();
  return (
    lower === ZERO_ADDRESS.toLowerCase() ||
    lower === MEZO_PRECOMPILES.btcToken.toLowerCase() ||
    upper === 'BTC' ||
    upper === 'WBTC'
  );
}

/**
 * Reads the BTC/USD price from the Mezo PriceOracle precompile.
 * Returns null when the round is missing, non-positive, or stale.
 */
export async function getBtcUsdPrice(): Promise<{ price: number; updatedAt: number } | null> {
  const cached = readCache('__btc__');
  if (cached?.priceUsd != null) {
    return { price: cached.priceUsd, updatedAt: cached.updatedAt ?? 0 };
  }

  try {
    const [decimals, round] = await Promise.all([
      readContract<number>({
        address: MEZO_PRECOMPILES.priceOracle,
        abi: priceOracleAbi,
        functionName: 'decimals',
      }),
      readContract<readonly [bigint, bigint, bigint, bigint, bigint]>({
        address: MEZO_PRECOMPILES.priceOracle,
        abi: priceOracleAbi,
        functionName: 'latestRoundData',
      }),
    ]);

    const answer = round[1];
    const updatedAt = Number(round[3]);
    if (answer <= 0n) {
      logger.warn('PriceOracle returned non-positive BTC price');
      return null;
    }
    const ageSec = Date.now() / 1000 - updatedAt;
    if (!Number.isFinite(updatedAt) || updatedAt <= 0 || ageSec > MARKET_CONFIG.priceMaxStalenessSec) {
      logger.warn('PriceOracle BTC round is stale or missing timestamp', { updatedAt, ageSec });
      return null;
    }

    const price = Number(formatUnits(answer, Number(decimals)));
    if (!Number.isFinite(price) || price <= 0) return null;

    writeCache('__btc__', {
      symbol: 'BTC',
      address: MEZO_PRECOMPILES.btcToken,
      priceUsd: price,
      source: 'oracle',
      updatedAt,
    });
    return { price, updatedAt };
  } catch (err) {
    logger.warn(`Failed to read BTC price from PriceOracle: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Resolves the USD price for any token symbol or address.
 * BTC/wBTC come from the oracle; everything else is quoted on-chain
 * against wBTC through the Mezo Swap router.
 */
export async function getTokenUsdPrice(symbolOrAddress: string): Promise<TokenPrice> {
  let token = resolveToken(symbolOrAddress);
  let symbol = token?.symbol || String(symbolOrAddress);
  let address = (token?.address || symbolOrAddress) as string;
  let cacheKey = `token:${address.toLowerCase()}`;

  const cached = readCache(cacheKey);
  if (cached) return cached;

  let miss: TokenPrice = { symbol, address, priceUsd: null, source: null, updatedAt: null };

  // 1. BTC / wBTC / native: direct oracle read
  if (isBtcAsset(address, symbol)) {
    const btc = await getBtcUsdPrice();
    if (!btc) {
      writeCache(cacheKey, miss);
      return miss;
    }
    const hit: TokenPrice = {
      symbol,
      address,
      priceUsd: btc.price,
      source: 'oracle',
      updatedAt: btc.updatedAt,
    };
    writeCache(cacheKey, hit);
    return hit;
  }

  // 2. Other tokens: on-chain router quote of exactly 1 unit -> wBTC.
  // Falls back to a two-hop quote via MUSD when no direct pool exists.
  try {
    const btc = await getBtcUsdPrice();
    if (!btc) {
      writeCache(cacheKey, miss);
      return miss;
    }

    // A bare symbol (e.g. MUSD before discovery) is not an address yet:
    // run discovery once, then re-resolve before giving up.
    if (!address.startsWith('0x')) {
      await ensureMusdRegistered().catch(() => undefined);
      const rediscovered = resolveToken(symbolOrAddress);
      if (rediscovered) {
        token = rediscovered;
        symbol = rediscovered.symbol;
        address = rediscovered.address;
        cacheKey = `token:${address.toLowerCase()}`;
        miss = { symbol, address, priceUsd: null, source: null, updatedAt: null };
        const rediscoveredCache = readCache(cacheKey);
        if (rediscoveredCache) return rediscoveredCache;
      }
    }

    const normalized = address.startsWith('0x') ? (address as Address) : null;
    if (!normalized || normalized.length !== 42) {
      writeCache(cacheKey, miss);
      return miss;
    }

    const direct = await quoteToBtc(normalized);
    let btcPerToken = direct;
    if (btcPerToken == null) {
      await ensureMusdRegistered().catch(() => undefined);
      const refreshed = resolveToken(symbolOrAddress) || resolveToken('MUSD');
      if (refreshed && refreshed.symbol.toUpperCase() === 'MUSD') {
        symbol = 'MUSD';
        address = refreshed.address;
      }
      const musd = resolveToken('MUSD');
      if (musd && musd.address.toLowerCase() !== normalized.toLowerCase()) {
        btcPerToken = await quoteTwoHop(normalized, musd.address as Address);
      }
    }
    if (btcPerToken == null) {
      writeCache(cacheKey, miss);
      return miss;
    }

    const priceUsd = btcPerToken * btc.price;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      writeCache(cacheKey, miss);
      return miss;
    }

    const hit: TokenPrice = { symbol, address, priceUsd, source: 'router-quote', updatedAt: btc.updatedAt };
    writeCache(cacheKey, hit);
    return hit;
  } catch (err) {
    logger.warn(`No on-chain USD price for ${symbol}: ${(err as Error).message}`);
    writeCache(cacheKey, miss);
    return miss;
  }
}

/** Batch helper used by balance and market endpoints. */
export async function getPricesForSymbols(symbols: string[]): Promise<TokenPrice[]> {
  return Promise.all(symbols.map((s) => getTokenUsdPrice(s)));
}

/** Quotes exactly 1 unit of `token` in wBTC through a direct volatile pool. */
async function quoteToBtc(token: Address): Promise<number | null> {
  try {
    const decimals = await getDecimals(token);
    const oneUnit = parseUnits('1', decimals);
    const amounts = (await readContract<bigint[]>({
      address: MEZO_SWAP_ROUTER,
      abi: routerAbi,
      functionName: 'getAmountsOut',
      args: [
        oneUnit,
        [{ from: token, to: MEZO_PRECOMPILES.btcToken, stable: false, factory: MEZO_SWAP_FACTORY }],
      ],
    } as any)) as bigint[];
    const outBtc = amounts?.[amounts.length - 1];
    if (outBtc === undefined || outBtc <= 0n) return null;
    const perToken = Number(formatUnits(outBtc, 18));
    return Number.isFinite(perToken) && perToken > 0 ? perToken : null;
  } catch {
    return null;
  }
}

/** Quotes 1 unit of `token` in wBTC via MUSD (stable leg, then MUSD/BTC pool). */
async function quoteTwoHop(token: Address, musd: Address): Promise<number | null> {
  try {
    const [decToken, decMusd] = await Promise.all([getDecimals(token), getDecimals(musd)]);
    const first = (await readContract<bigint[]>({
      address: MEZO_SWAP_ROUTER,
      abi: routerAbi,
      functionName: 'getAmountsOut',
      args: [
        parseUnits('1', decToken),
        [{ from: token, to: musd, stable: true, factory: MEZO_SWAP_FACTORY }],
      ],
    } as any)) as bigint[];
    const musdOut = first?.[first.length - 1];
    if (musdOut === undefined || musdOut <= 0n) return null;

    const second = (await readContract<bigint[]>({
      address: MEZO_SWAP_ROUTER,
      abi: routerAbi,
      functionName: 'getAmountsOut',
      args: [
        musdOut,
        [{ from: musd, to: MEZO_PRECOMPILES.btcToken, stable: false, factory: MEZO_SWAP_FACTORY }],
      ],
    } as any)) as bigint[];
    const outBtc = second?.[second.length - 1];
    if (outBtc === undefined || outBtc <= 0n) return null;
    const perToken = Number(formatUnits(outBtc, 18));
    return Number.isFinite(perToken) && perToken > 0 ? perToken : null;
  } catch {
    return null;
  }
}
