/**
 * Soka Intent Engine — Token Resolver
 * Resolves token symbols, aliases, and addresses to verified EVM tokens on Mezo Testnet.
 */

import type { Address } from 'viem';
import { TOKEN_WHITELIST, ZERO_ADDRESS, type WhitelistToken } from '../../config/constant.js';
import {
  API_PAGINATION,
  DEFAULT_DECIMALS,
  EVM_ADDRESS_LENGTH,
  NATIVE_ALIASES,
  NATIVE_SYMBOL,
  UNKNOWN_TOKEN_NAME,
  UNKNOWN_TOKEN_SYMBOL,
} from '../../config/index.js';
import { getDecimals, getSymbol, getName } from '../../utils/erc20Utils.js';
import { logger } from '../../utils/logger.js';
import type { TokenInfo } from '../../types/index.js';

/** Shared EVM address check (0x + 40 hex chars). */
export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export interface TokenCandidate {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

/**
 * Runtime registry for tokens discovered on-chain (e.g. MUSD found as a pool
 * leg). Entries are verified by direct contract reads at discovery time, never
 * hardcoded. Consulted after the static whitelist in resolveToken.
 */
const discoveredTokens = new Map<string, WhitelistToken>();

export function registerDiscoveredToken(token: WhitelistToken): void {
  discoveredTokens.set(token.symbol.toLowerCase(), token);
  discoveredTokens.set(token.address.toLowerCase(), token);
  for (const alias of token.aliases) {
    if (!discoveredTokens.has(alias.toLowerCase())) {
      discoveredTokens.set(alias.toLowerCase(), token);
    }
  }
  logger.info(`Registered on-chain discovered token ${token.symbol}`, { address: token.address });
}

function lookupDiscovered(input: string): WhitelistToken | null {
  return discoveredTokens.get(input) || null;
}

/**
 * Resolves a token symbol, alias, or address to a WhitelistToken entry.
 */
export function resolveToken(symbolOrAddress: string): WhitelistToken | null {
  if (!symbolOrAddress) return null;
  const input = symbolOrAddress.trim().toLowerCase();

  // 1. Direct address match
  const byAddress = TOKEN_WHITELIST.find(
    (t) => t.address.toLowerCase() === input
  );
  if (byAddress) return byAddress;

  // 2. Direct symbol match
  const bySymbol = TOKEN_WHITELIST.find(
    (t) => t.symbol.toLowerCase() === input
  );
  if (bySymbol) return bySymbol;

  // 3. Alias match
  const byAlias = TOKEN_WHITELIST.find((t) =>
    t.aliases.some((alias) => alias.toLowerCase() === input)
  );
  if (byAlias) return byAlias;

  // 4. Native BTC alias fallback (never assume list order)
  if (NATIVE_ALIASES.includes(input)) {
    return TOKEN_WHITELIST.find((t) => t.symbol === NATIVE_SYMBOL) ?? null;
  }

  // 5. On-chain discovered tokens (verified at discovery time)
  return lookupDiscovered(input);
}

/**
 * Resolves a token symbol, name, or address to an EVM contract address.
 * @deprecated Prefer resolveTokenAddressStrict: this fallback maps unknown
 * symbols to the zero address, which previously caused misdirected BTC swaps.
 */
export function resolveTokenAddress(symbolOrAddress: string): string {
  return resolveTokenAddressStrict(symbolOrAddress) ?? ZERO_ADDRESS;
}

/**
 * Strict address resolution. Returns null for unknown symbols instead of the
 * zero address so callers can reject with a fallback advise (unknown_token).
 * Raw EVM addresses pass through after format validation.
 */
export function resolveTokenAddressStrict(symbolOrAddress: string): string | null {
  if (!symbolOrAddress) return null;
  const token = resolveToken(symbolOrAddress);
  if (token) return token.address;

  if (isEvmAddress(symbolOrAddress)) {
    return symbolOrAddress.trim();
  }

  return null;
}

/**
 * Asynchronously fetches token decimals from whitelist or ERC-20 contract.
 */
export async function getTokenDecimalsAsync(symbolOrAddress: string): Promise<number> {
  const token = resolveToken(symbolOrAddress);
  if (token) return token.decimals;

  if (isEvmAddress(symbolOrAddress)) {
    try {
      return await getDecimals(symbolOrAddress.trim() as Address);
    } catch {
      logger.warn(`Failed to fetch decimals for ${symbolOrAddress}, defaulting to ${DEFAULT_DECIMALS}`);
      return DEFAULT_DECIMALS;
    }
  }

  return DEFAULT_DECIMALS;
}

/**
 * Checks whether a token is in the verified Mezo whitelist.
 */
export function isWhitelistedToken(symbolOrAddress: string): boolean {
  return resolveToken(symbolOrAddress) !== null;
}

/**
 * Full token info lookup.
 */
export async function resolveTokenInfo(symbolOrAddress: string): Promise<TokenInfo | null> {
  const token = resolveToken(symbolOrAddress);
  if (token) {
    return {
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals,
      logoUrl: token.logoUrl,
      isWhitelisted: true,
    };
  }

  // Fallback for unwhitelisted on-chain ERC-20 address
  if (isEvmAddress(symbolOrAddress)) {
    const addr = symbolOrAddress.trim() as Address;
    try {
      const [symbol, name, decimals] = await Promise.all([
        getSymbol(addr).catch(() => UNKNOWN_TOKEN_SYMBOL),
        getName(addr).catch(() => UNKNOWN_TOKEN_NAME),
        getDecimals(addr).catch(() => DEFAULT_DECIMALS),
      ]);
      return {
        symbol,
        name,
        address: symbolOrAddress,
        decimals,
        isWhitelisted: false,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves token logo URL.
 */
export function resolveTokenLogo(addressOrSymbol: string): string | undefined {
  const token = resolveToken(addressOrSymbol);
  return token?.logoUrl;
}

/**
 * Searches for similar tokens when a user query does not yield an exact match.
 */
export function searchTokenCandidates(query: string, limit = API_PAGINATION.tokenSearchLimit): TokenCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = TOKEN_WHITELIST.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.aliases.some((a) => a.toLowerCase().includes(q))
  );

  return matches.slice(0, limit).map((t) => ({
    symbol: t.symbol,
    name: t.name,
    address: t.address,
    decimals: t.decimals,
  }));
}
