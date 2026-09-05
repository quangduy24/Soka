/**
 * DIEPS Intent Engine — Core Token Whitelist
 *
 * Purpose of this file:
 *   - Provide verified on-chain addresses + correct decimals for the 5 most
 *     important tokens: SUI, USDC, USDT, DEEP, WAL.
 *   - All other tokens (900+ coins) are resolved from /src/cetus-tokens.json
 *     at runtime by tokenResolver.ts.
 *
 * Rules for adding a token here:
 *   1. It has a non-standard decimal count (≠ 9), OR
 *   2. It needs a stable fuzzy alias that LLM intent parsing must recognise, OR
 *   3. Its address in cetus-tokens.json is known to be wrong/outdated.
 */

export interface WhitelistToken {
  symbol: string;
  name: string;
  /** Full Sui coin type, e.g. 0x2::sui::SUI */
  address: string;
  decimals: number;
  isStable: boolean;
  /** Lower-case strings the LLM or user might say instead of the symbol */
  aliases: string[];
}

export const TOKEN_WHITELIST: WhitelistToken[] = [
  // ─── Native gas token ────────────────────────────────────────────────────
  {
    symbol: 'SUI',
    name: 'Sui',
    address: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    decimals: 9,
    isStable: false,
    aliases: ['sui'],
  },

  // ─── Stablecoins (decimals = 6) ──────────────────────────────────────────
  {
    symbol: 'USDC',
    name: 'USD Coin',
    // Native Sui USDC (Circle bridge)
    address: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
    decimals: 6,
    isStable: true,
    aliases: ['usdc', 'usd coin', 'dollar', 'usd'],
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
    decimals: 6,
    isStable: true,
    aliases: ['usdt', 'tether'],
  },

  // ─── DeepBook governance token (decimals = 6) ───────────────────────────
  {
    symbol: 'DEEP',
    name: 'DeepBook',
    address: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
    decimals: 6,
    isStable: false,
    aliases: ['deep', 'deepbook'],
  },

  // ─── Walrus storage token (decimals = 9, verified address) ───────────────
  // cetus-tokens.json may contain an older WAL address — this entry takes
  // priority because TOKEN_WHITELIST is checked first in tokenResolver.ts.
  {
    symbol: 'WAL',
    name: 'WAL Token',
    address: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
    decimals: 9,
    isStable: false,
    aliases: ['wal', 'walrus'],
  },

  // ─── Non-standard decimal tokens (must be here for correct amount math) ──
  {
    symbol: 'BLUB',
    name: 'BLUB',
    address: '0xfa7ac3951fdca92c5200d468d31a365eb03b2be9936fde615e69f0c1274ad3a0::BLUB::BLUB',
    decimals: 2,
    isStable: false,
    aliases: ['blub'],
  },
  {
    symbol: 'CETUS',
    name: 'Cetus Protocol',
    address: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
    decimals: 9,
    isStable: false,
    aliases: ['cetus'],
  },
  
  // ─── Community Whitelisted Tokens ──────────────────────────────────────────
  {
    symbol: 'HIPPO',
    name: 'Sudeng',
    address: '0x8993129d72e733985f7f1a00396cbd055bad6f817fee36576ce483c8bbb8b87b::sudeng::SUDENG',
    decimals: 9,
    isStable: false,
    aliases: ['hippo', 'sudeng'],
  },
  {
    symbol: 'LOFI',
    name: 'LOFI Yeti',
    address: '0xf22da9a24ad027cccb5f2d496cbe91de953d363513db08a3a734d361c7c17503::LOFI::LOFI',
    decimals: 9,
    isStable: false,
    aliases: ['lofi', 'yeti'],
  },
];
