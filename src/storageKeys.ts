/**
 * Soka Intent Engine — localStorage key registry.
 * All persistence keys live here. Legacy keys are migrated once, then removed.
 */

export const STORAGE_KEYS = {
  swapHistory: 'soka:swap-history',
  /** Pre-rebrand key, migrated on load */
  legacySwapHistory: 'adidahood:swap-history',
  hiddenMarketCoins: 'adidahood:hidden-market-coins',
  hideBalance: 'soka:hide-balance',
} as const;
