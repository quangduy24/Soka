/**
 * Soka Intent Engine — Token Resolver
 * Resolves token symbols, aliases, and addresses to verified EVM tokens on Mezo Testnet.
 */

import type { Address } from 'viem';
import { TOKEN_WHITELIST, ZERO_ADDRESS, type WhitelistToken } from '../../config/constant.js';
import { getDecimals, getSymbol, getName } from '../../utils/erc20Utils.js';
import { logger } from '../../utils/logger.js';
import type { TokenInfo } from '../../types/index.js';

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

  // 4. Native BTC alias fallback
  if (input === 'btc' || input === 'bitcoin' || input === 'sat' || input === 'sats') {
    return TOKEN_WHITELIST[0];
  }

  // 5. On-chain discovered tokens (verified at discovery time)
  return lookupDiscovered(input);
}

/**
 * Resolves a token symbol, name, or address to an EVM contract address.
 */
export function resolveTokenAddress(symbolOrAddress: string): string {
  const token = resolveToken(symbolOrAddress);
  if (token) return token.address;

  // If already a valid hex address, return as-is
  if (symbolOrAddress.startsWith('0x') && symbolOrAddress.length === 42) {
    return symbolOrAddress;
  }

  return ZERO_ADDRESS;
}

/**
 * Asynchronously fetches token decimals from whitelist or ERC-20 contract.
 */
export async function getTokenDecimalsAsync(symbolOrAddress: string): Promise<number> {
  const token = resolveToken(symbolOrAddress);
  if (token) return token.decimals;

  if (symbolOrAddress.startsWith('0x') && symbolOrAddress.length === 42) {
    try {
      return await getDecimals(symbolOrAddress as Address);
    } catch {
      logger.warn(`Failed to fetch decimals for ${symbolOrAddress}, defaulting to 18`);
      return 18;
    }
  }

  return 18;
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
  if (symbolOrAddress.startsWith('0x') && symbolOrAddress.length === 42) {
    const addr = symbolOrAddress as Address;
    try {
      const [symbol, name, decimals] = await Promise.all([
        getSymbol(addr).catch(() => 'UNKNOWN'),
        getName(addr).catch(() => 'Unknown Token'),
        getDecimals(addr).catch(() => 18),
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
export function searchTokenCandidates(query: string, limit = 5): TokenCandidate[] {
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
