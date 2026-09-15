/**
 * Soka Intent Engine — Mezo Testnet Constants & Token Whitelist
 * Defines verified precompile addresses, testnet tokens, and configuration.
 * All addresses and options are configurable via environment variables.
 */

export interface WhitelistToken {
  symbol: string;
  name: string;
  /** EVM contract address in hex (0x...) */
  address: `0x${string}`;
  decimals: number;
  isStable: boolean;
  /** Lower-case aliases recognized by user prompts and intent parsers */
  aliases: string[];
  /** Optional logo URL or icon path */
  logoUrl?: string;
}

export const ZERO_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000000000';

// ─── Mezo Precompiled Contract Addresses ───────────────────────

export const MEZO_PRECOMPILES = {
  btcToken: (process.env.MEZO_PRECOMPILE_BTC || '0x7b7c000000000000000000000000000000000000') as `0x${string}`,
  mezoToken: (process.env.MEZO_PRECOMPILE_MEZO || '0x7b7c000000000000000000000000000000000001') as `0x${string}`,
  validatorPool: (process.env.MEZO_PRECOMPILE_VALIDATOR_POOL || '0x7b7c000000000000000000000000000000000011') as `0x${string}`,
  assetsBridge: (process.env.MEZO_PRECOMPILE_ASSETS_BRIDGE || '0x7b7c000000000000000000000000000000000012') as `0x${string}`,
  maintenance: (process.env.MEZO_PRECOMPILE_MAINTENANCE || '0x7b7c000000000000000000000000000000000013') as `0x${string}`,
  upgrade: (process.env.MEZO_PRECOMPILE_UPGRADE || '0x7b7c000000000000000000000000000000000014') as `0x${string}`,
  priceOracle: (process.env.MEZO_PRECOMPILE_PRICE_ORACLE || '0x7b7c000000000000000000000000000000000015') as `0x${string}`,
};

// ─── Bridge Destination Chains ─────────────────────────────────

export enum BridgeDestinationChain {
  ETHEREUM = 0,
  BITCOIN = 1,
}

// ─── Verified Token Whitelist ──────────────────────────────────

export const TOKEN_WHITELIST: WhitelistToken[] = [
  // Native Gas Token (Bitcoin on Mezo)
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    address: (process.env.TOKEN_BTC_ADDRESS || ZERO_ADDRESS) as `0x${string}`,
    decimals: 18,
    isStable: false,
    aliases: ['btc', 'bitcoin', 'sat', 'sats'],
  },
  // BTC ERC-20 Precompiled Wrapper
  {
    symbol: 'wBTC',
    name: 'Wrapped BTC (Precompile)',
    address: MEZO_PRECOMPILES.btcToken,
    decimals: 18,
    isStable: false,
    aliases: ['wbtc', 'wrapped btc', 'btc token'],
  },
  // MEZO Governance Token
  {
    symbol: 'MEZO',
    name: 'Mezo Token',
    address: MEZO_PRECOMPILES.mezoToken,
    decimals: 18,
    isStable: false,
    aliases: ['mezo', 'mzo'],
  },
  // Stablecoins
  {
    symbol: 'mUSDC',
    name: 'Mezo USD Coin',
    address: (process.env.TOKEN_MUSDC_ADDRESS || '0xe1a26db653708A2AD8F824E92Db9852410e33A59') as `0x${string}`,
    decimals: 6,
    isStable: true,
    aliases: ['musdc', 'usdc', 'usd coin', 'dollar', 'usd'],
  },
  {
    symbol: 'mUSDT',
    name: 'Mezo Tether USD',
    address: (process.env.TOKEN_MUSDT_ADDRESS || '0x629320719a6190bd145C277226fd45e7648F950A') as `0x${string}`,
    decimals: 6,
    isStable: true,
    aliases: ['musdt', 'usdt', 'tether'],
  },
  {
    symbol: 'mDAI',
    name: 'Mezo DAI',
    address: (process.env.TOKEN_MDAI_ADDRESS || '0x367c502008004dCc0c08a55aD46670248EA9Ab76') as `0x${string}`,
    decimals: 18,
    isStable: true,
    aliases: ['mdai', 'dai'],
  },
  {
    symbol: 'mUSDe',
    name: 'Mezo USDe',
    address: (process.env.TOKEN_MUSDE_ADDRESS || '0x32BE1eAb30cCF66779CB67B92cD275F25870A925') as `0x${string}`,
    decimals: 18,
    isStable: true,
    aliases: ['musde', 'usde', 'ethena'],
  },
  // Bitcoin Variants
  {
    symbol: 'mcbBTC',
    name: 'Mezo Coinbase BTC',
    address: (process.env.TOKEN_MCBBTC_ADDRESS || '0x2278CAAE0009E8a325a346feA573eF23C5756DbF') as `0x${string}`,
    decimals: 18,
    isStable: false,
    aliases: ['mcbbtc', 'cbbtc', 'coinbase btc'],
  },
  {
    symbol: 'mFBTC',
    name: 'Mezo Firelight BTC',
    address: (process.env.TOKEN_MFBTC_ADDRESS || '0x88aa5b66211177b499206968a4ab5E44635D3533') as `0x${string}`,
    decimals: 18,
    isStable: false,
    aliases: ['mfbtc', 'fbtc'],
  },
  {
    symbol: 'mSolvBTC',
    name: 'Mezo Solv BTC',
    address: (process.env.TOKEN_MSOLVBTC_ADDRESS || '0xCE7b4CfA6060Fd4B8d5E200CE3F3144E3036E3D2') as `0x${string}`,
    decimals: 18,
    isStable: false,
    aliases: ['msolvbtc', 'solvbtc'],
  },
  {
    symbol: 'mswBTC',
    name: 'Mezo Swell BTC',
    address: (process.env.TOKEN_MSWBTC_ADDRESS || '0x438e2A4D97916DBF86882a17b4Eb5b71E73988d9') as `0x${string}`,
    decimals: 18,
    isStable: false,
    aliases: ['mswbtc', 'swbtc', 'swell btc'],
  },
  {
    symbol: 'mT',
    name: 'Mezo Threshold T',
    address: (process.env.TOKEN_MT_ADDRESS || '0xdd8Bf5ACa0579bEE7e6cd20AC7683E279a5f7d48') as `0x${string}`,
    decimals: 18,
    isStable: false,
    aliases: ['mt', 'threshold', 't token'],
  },
];
