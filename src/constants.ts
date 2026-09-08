export interface TokenInfo {
  symbol: string;
  name: string;
  coinType: string;
  logoUrl?: string;
}

import cetusTokens from './cetus-tokens.json';

const POPULAR_SYMBOLS = [
  'SUI', 'USDC', 'USDT', 'WBTC', 'WETH', 'BUCK', 'FUD', 'SCA', 
  'CETUS', 'TURBOS', 'DEEP', 'NAVX', 'HASUI', 'AFSUI', 'BLUB', 
  'NS', 'SEND', 'SUIA', 'KRIYA', 'LIQ'
];

export const TOKENS = POPULAR_SYMBOLS.map(symbol => {
  const found = cetusTokens.find((t: any) => t.symbol.toUpperCase() === symbol);
  if (found) {
    return {
      symbol: found.symbol,
      name: found.name,
      coinType: found.coinType,
      logoUrl: found.logoUrl || undefined,
    };
  }
  return null;
}).filter(Boolean) as TokenInfo[];

export function getTokenInfo(symbol: string): TokenInfo | undefined {
  const found = cetusTokens.find((t: any) => t.symbol.toUpperCase() === symbol.toUpperCase());
  if (found) {
    return {
      symbol: found.symbol,
      name: found.name,
      coinType: found.coinType,
      logoUrl: found.logoUrl || undefined,
    };
  }
  return undefined;
}

/** Shorten a coin type's address to `0x123456...abcdefgh` (16 chars) for display. */
export const shortContract = (coinType: string): string => {
  const addr = (coinType || '').split('::')[0];
  return addr.length <= 16 ? addr : `${addr.slice(0, 8)}...${addr.slice(-8)}`;
};
