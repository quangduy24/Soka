/**
 * Soka Intent Engine — Frontend Constants & Verified Tokens
 * Token definitions and utility helpers for Mezo Testnet.
 */

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  coinType?: string; // legacy alias
  decimals: number;
  logoUrl?: string;
}

export const MEZO_TOKENS: TokenInfo[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin (Native Gas)',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    logoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=035',
  },
  {
    symbol: 'wBTC',
    name: 'Wrapped BTC (Precompile)',
    address: '0x7b7c000000000000000000000000000000000000',
    decimals: 18,
    logoUrl: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.svg?v=035',
  },
  {
    symbol: 'MEZO',
    name: 'Mezo Governance Token',
    address: '0x7b7c000000000000000000000000000000000001',
    decimals: 18,
    logoUrl: 'https://mezo.org/favicon.ico',
  },
  {
    symbol: 'mUSDC',
    name: 'Mezo USD Coin',
    address: '0xe1a26db653708A2AD8F824E92Db9852410e33A59',
    decimals: 6,
    logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=035',
  },
  {
    symbol: 'mUSDT',
    name: 'Mezo Tether USD',
    address: '0x629320719a6190bd145C277226fd45e7648F950A',
    decimals: 6,
    logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.svg?v=035',
  },
  {
    symbol: 'mDAI',
    name: 'Mezo DAI',
    address: '0x367c502008004dCc0c08a55aD46670248EA9Ab76',
    decimals: 18,
    logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg?v=035',
  },
  {
    symbol: 'mUSDe',
    name: 'Mezo USDe',
    address: '0x32BE1eAb30cCF66779CB67B92cD275F25870A925',
    decimals: 18,
  },
  {
    symbol: 'mcbBTC',
    name: 'Mezo Coinbase BTC',
    address: '0x2278CAAE0009E8a325a346feA573eF23C5756DbF',
    decimals: 18,
  },
  {
    symbol: 'mFBTC',
    name: 'Mezo Firelight BTC',
    address: '0x88aa5b66211177b499206968a4ab5E44635D3533',
    decimals: 18,
  },
  {
    symbol: 'mSolvBTC',
    name: 'Mezo Solv BTC',
    address: '0xCE7b4CfA6060Fd4B8d5E200CE3F3144E3036E3D2',
    decimals: 18,
  },
  {
    symbol: 'mswBTC',
    name: 'Mezo Swell BTC',
    address: '0x438e2A4D97916DBF86882a17b4Eb5b71E73988d9',
    decimals: 18,
  },
  {
    symbol: 'mT',
    name: 'Mezo Threshold T',
    address: '0xdd8Bf5ACa0579bEE7e6cd20AC7683E279a5f7d48',
    decimals: 18,
  },
];

export const TOKENS = MEZO_TOKENS;

/** Canonical zero address shared by all frontend flows (20 bytes). */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getTokenInfo(symbolOrAddress: string): TokenInfo | undefined {
  const query = symbolOrAddress.trim().toLowerCase();
  return MEZO_TOKENS.find(
    (t) => t.symbol.toLowerCase() === query || t.address.toLowerCase() === query
  );
}

/** Shorten an EVM address to `0x1234...5678` for display. */
export const shortContract = (address: string): string => {
  if (!address) return '';
  const clean = address.includes('::') ? address.split('::')[0] : address;
  return clean.length <= 14 ? clean : `${clean.slice(0, 6)}...${clean.slice(-4)}`;
};
