/**
 * DIEPS Intent Engine — Token Resolver
 * Resolves token symbols/names to full on-chain addresses.
 *
 * Primary source: /src/cetus-tokens.json  (921 tokens, loaded once at startup)
 * Decimals override: TOKEN_WHITELIST in constant.ts (only for non-9-decimal tokens)
 */

import fs from 'fs';
import path from 'path';

import { TOKEN_WHITELIST } from '../../config/index.js';
import type { WhitelistToken } from '../../config/index.js';
import { getCoinMetadata } from '../../utils/suiClient.js';
import { logger } from '../../utils/logger.js';

// ─── Load cetus-tokens.json once at startup ───────────────────────────────────

interface CetusToken {
  symbol: string;
  name: string;
  coinType: string;
  logoUrl?: string;
  decimals?: number;
}

let _cetusRegistry: CetusToken[] = [];

function loadCetusRegistry(): CetusToken[] {
  if (_cetusRegistry.length > 0) return _cetusRegistry;
  try {
    const tokensPath = path.join(process.cwd(), 'src', 'cetus-tokens.json');
    if (fs.existsSync(tokensPath)) {
      _cetusRegistry = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      logger.info(`Loaded cetus token registry: ${_cetusRegistry.length} tokens`);
    }
  } catch (e) {
    logger.error('Failed to load cetus-tokens.json', e);
  }
  return _cetusRegistry;
}

// Load immediately at module init
loadCetusRegistry();

// ─── Runtime cache for on-chain metadata (decimals fetch) ────────────────────

const metaCache = new Map<string, { decimals: number; expiresAt: number }>();
const META_CACHE_TTL = 600_000; // 10 min

export async function getDecimalsForCoinType(coinType: string): Promise<number> {
  // 1. Check whitelist for override (USDC=6, USDT=6, DEEP=6, BLUB=2 etc.)
  const override = TOKEN_WHITELIST.find(t => t.address === coinType);
  if (override) return override.decimals;

  // 2. Check runtime cache
  const cached = metaCache.get(coinType);
  if (cached && cached.expiresAt > Date.now()) return cached.decimals;

  // 3. Fetch on-chain
  try {
    const meta = await getCoinMetadata(coinType);
    if (meta?.decimals !== undefined && meta.decimals !== null) {
      metaCache.set(coinType, { decimals: meta.decimals, expiresAt: Date.now() + META_CACHE_TTL });
      return meta.decimals;
    }
    // Metadata returned but no decimals field — warn before falling back
    logger.warn('Token metadata missing decimals field, defaulting to 9', { coinType });
    return 9;
  } catch (err) {
    logger.warn('Failed to fetch token metadata for decimals, defaulting to 9', { coinType, error: (err as Error).message });
    return 9;
  }
}

// ─── Primary lookup from cetus-tokens.json ───────────────────────────────────

function findInRegistry(input: string): CetusToken | undefined {
  const registry = loadCetusRegistry();
  const upper = input.trim().toUpperCase();

  // Exact symbol match (fast path)
  const bySymbol = registry.find(t => t.symbol.toUpperCase() === upper);
  if (bySymbol) return bySymbol;

  // Coin type match (if caller passes a full type)
  if (input.includes('::')) {
    return registry.find(t => t.coinType === input.trim());
  }

  return undefined;
}

// ─── Public: resolveToken (whitelist entry, for backward compat) ──────────────

export function resolveToken(symbolOrName: string): WhitelistToken | null {
  const input = symbolOrName.trim().toUpperCase();

  // Direct symbol match in whitelist
  const bySymbol = TOKEN_WHITELIST.find(t => t.symbol === input);
  if (bySymbol) return bySymbol;

  // Alias match
  const lower = symbolOrName.trim().toLowerCase();
  const byAlias = TOKEN_WHITELIST.find(t =>
    t.aliases.some(a => a.toLowerCase() === lower)
  );
  if (byAlias) return byAlias;

  // Fuzzy map
  const fuzzyMap: Record<string, string> = {
    'ethereum': 'WETH', 'ether': 'WETH',
    'bitcoin': 'WBTC',
    'dollar': 'USDC', 'usd': 'USDC',
    'tether': 'USDT',
    'deepbook': 'DEEP',
    'scallop': 'SCA',
    'navi': 'NAVX',
    'bucket': 'BUCK',
    'walrus': 'WAL',
  };
  const fuzzyResult = fuzzyMap[lower];
  if (fuzzyResult) {
    return TOKEN_WHITELIST.find(t => t.symbol === fuzzyResult) || null;
  }

  return null;
}

// ─── Public: resolveTokenAddress ─────────────────────────────────────────────

export async function resolveTokenAddress(symbol: string): Promise<string> {
  // 1. Whitelist override (for aliases and fuzzy)
  const whitelisted = resolveToken(symbol);
  if (whitelisted) return whitelisted.address;

  // 2. cetus-tokens.json registry (primary)
  const inRegistry = findInRegistry(symbol);
  if (inRegistry) return inRegistry.coinType;

  // 3. If it already looks like a coin type, verify on-chain
  if (symbol.includes('::')) {
    try {
      const meta = await getCoinMetadata(symbol);
      if (meta) {
        logger.info(`On-chain verified raw coin type: ${symbol}`);
        return symbol;
      }
    } catch {
      logger.warn(`Could not verify coin type on-chain: ${symbol}`);
    }
  }

  // 4. Fall back to original symbol (caller handles failure)
  return symbol;
}

// ─── Public: resolveTokenDynamic (legacy async, kept for compat) ─────────────

export async function resolveTokenDynamic(symbolOrAddress: string): Promise<string | null> {
  const address = await resolveTokenAddress(symbolOrAddress);
  return address !== symbolOrAddress ? address : null;
}

// ─── Public: getTokenDecimals ─────────────────────────────────────────────────

export function getTokenDecimals(symbol: string): number {
  // 1. Whitelist has exact decimals (USDC=6, USDT=6, WETH=8, etc.)
  const whitelisted = resolveToken(symbol);
  if (whitelisted) return whitelisted.decimals;

  // 2. Registry token — decimals field may be present (future-proof)
  const inRegistry = findInRegistry(symbol);
  if (inRegistry?.decimals !== undefined) return inRegistry.decimals;

  // 3. Default to 9 (most Sui tokens)
  // The caller (cetusRouter) will get accurate decimals asynchronously via
  // getDecimalsForCoinType() if needed — but for the synchronous path, 9 is
  // correct for SUI, WAL, CETUS, NAVX, SCA, TURBOS, BUCK, and most others.
  return 9;
}

/**
 * Async version of getTokenDecimals — fetches on-chain if needed.
 * Use this when accuracy is critical (e.g. PTB amount calculation).
 */
export async function getTokenDecimalsAsync(symbol: string): Promise<number> {
  const whitelisted = resolveToken(symbol);
  if (whitelisted) return whitelisted.decimals;

  const inRegistry = findInRegistry(symbol);
  if (inRegistry) {
    if (inRegistry.decimals !== undefined) return inRegistry.decimals;
    return getDecimalsForCoinType(inRegistry.coinType);
  }

  if (symbol.includes('::')) {
    return getDecimalsForCoinType(symbol);
  }

  return 9;
}

// ─── Public: utility helpers ─────────────────────────────────────────────────

export function isWhitelistedToken(symbol: string): boolean {
  return resolveToken(symbol) !== null;
}

export function isStablePair(sourceSymbol: string, destSymbol: string): boolean {
  const source = resolveToken(sourceSymbol);
  const dest = resolveToken(destSymbol);
  return (source?.isStable && dest?.isStable) || false;
}

export function getAllWhitelistedTokens(): WhitelistToken[] {
  return [...TOKEN_WHITELIST];
}

/**
 * Return all tokens from the full Cetus registry (for autocomplete / UI).
 */
export function getAllRegistryTokens(): CetusToken[] {
  return loadCetusRegistry();
}

// ─── Public: token candidate search (for auto-suggesting contracts) ──────────

export interface TokenCandidate {
  symbol: string;
  name: string;
  coinType: string;
  decimals?: number;
  logoUrl?: string;
  /**
   * True for recognised/listed tokens on Sui — i.e. those carrying a curated
   * logo in the Cetus registry. On-chain metadata alone is NOT enough (every
   * deployed coin, including copies, has metadata), so we use curation instead.
   */
  verified?: boolean;
}

/**
 * Search the Cetus registry (and on-chain, for raw coin types) for tokens
 * matching a free-form symbol/name. Used to auto-suggest a contract address
 * when a token is not resolvable via the exact-match path, so the user does not
 * have to hunt for the coin type manually.
 *
 * Results are ranked: exact symbol > symbol prefix > symbol substring >
 * exact name > name substring, with a small boost for tokens that carry a logo
 * (usually the more established listing when a symbol collides).
 */
export async function searchTokenCandidates(query: string, limit = 5): Promise<TokenCandidate[]> {
  const q = query.trim();
  if (!q) return [];

  // If the user already provided a full coin type, verify it on-chain.
  if (q.includes('::')) {
    try {
      const meta = await getCoinMetadata(q);
      if (meta) {
        return [{
          symbol: meta.symbol || q.split('::').pop() || q,
          name: meta.name || '',
          coinType: q,
          decimals: meta.decimals,
          logoUrl: normalizeIconUrl(meta.iconUrl),
          verified: !!findInRegistry(q)?.logoUrl, // curated listing on Sui
        }];
      }
    } catch {
      // fall through — nothing else to search for a raw type
    }
    return [];
  }

  const registry = loadCetusRegistry();
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  const scored: Array<{ t: CetusToken; score: number }> = [];
  for (const t of registry) {
    const sym = t.symbol.toUpperCase();
    const name = (t.name || '').toLowerCase();

    let score = 0;
    if (sym === upper) score = 100;
    else if (sym.startsWith(upper)) score = 80;
    else if (sym.includes(upper)) score = 60;
    else if (name === lower) score = 55;
    else if (name.includes(lower)) score = 35;

    if (score > 0) {
      if (t.logoUrl) score += 5;
      scored.push({ t, score });
    }
  }

  // Recognised/listed tokens (those carrying a curated Cetus registry logo) are
  // surfaced FIRST and flagged for highlighting; obscure copies fall below.
  scored.sort((a, b) => {
    const av = a.t.logoUrl ? 1 : 0;
    const bv = b.t.logoUrl ? 1 : 0;
    if (av !== bv) return bv - av;
    return b.score - a.score;
  });

  const top: TokenCandidate[] = scored.slice(0, limit).map(({ t }) => ({
    symbol: t.symbol,
    name: t.name,
    coinType: t.coinType,
    decimals: t.decimals,
    logoUrl: t.logoUrl,
    verified: !!t.logoUrl, // curated registry listing = recognised on Sui
  }));

  // Best-effort: fill a DISPLAY logo from on-chain iconUrl for non-curated
  // tokens (in parallel). This does not change their verified status.
  await Promise.all(
    top.map(async (c) => {
      if (c.logoUrl) return;
      try {
        const meta = await getCoinMetadata(c.coinType);
        const icon = normalizeIconUrl(meta?.iconUrl);
        if (icon) c.logoUrl = icon;
      } catch {
        // keep letter-avatar fallback
      }
    })
  );

  return top;
}

/**
 * Resolve the best logo for a token (symbol or coin type): curated registry
 * logo first, then on-chain CoinMetadata iconUrl. Returns undefined if neither
 * is available (caller shows a letter-avatar fallback).
 */
export async function resolveTokenLogo(symbolOrCoinType: string): Promise<string | undefined> {
  const input = (symbolOrCoinType || '').trim();
  if (!input) return undefined;

  const coinType = input.includes('::') ? input : await resolveTokenAddress(input);

  // 1. Curated registry logo.
  const reg = findInRegistry(coinType.includes('::') ? coinType : input);
  if (reg?.logoUrl) return reg.logoUrl;

  // 2. On-chain CoinMetadata iconUrl.
  if (coinType.includes('::')) {
    try {
      const meta = await getCoinMetadata(coinType);
      const icon = normalizeIconUrl(meta?.iconUrl);
      if (icon) return icon;
    } catch {
      // fall through to no logo
    }
  }
  return undefined;
}

/**
 * Normalize a coin icon URL for browser display. Rewrites ipfs:// to a public
 * gateway; passes through http(s) and data URIs; drops anything else.
 */
function normalizeIconUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (u.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${u.slice('ipfs://'.length)}`;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  return undefined;
}
