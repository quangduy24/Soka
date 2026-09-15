import { useState } from 'react';
import { mezoApi } from '../../services/mezoApi.js';

export const HIDE_KEY = 'soka:hide-balance';

/** Approximate USD estimate for well-known Mezo tokens. */
export const USD_EST: Record<string, number> = {
  BTC: 95000,
  wBTC: 95000,
  MEZO: 2.5,
  mUSDC: 1.0,
  mUSDT: 1.0,
  mDAI: 1.0,
  mUSDe: 1.0,
  mcbBTC: 95000,
  mFBTC: 95000,
  mSolvBTC: 95000,
  mswBTC: 95000,
  mT: 0.025,
};

export function loadHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHidden(v: boolean) {
  try {
    localStorage.setItem(HIDE_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function useHiddenPref(): [boolean, () => void] {
  const [hidden, setHidden] = useState<boolean>(loadHidden);
  const toggle = () => {
    setHidden((prev) => {
      const next = !prev;
      saveHidden(next);
      return next;
    });
  };
  return [hidden, toggle];
}

export function fmt(n: number, maxDec = 4): string {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n < 0.0001 && n > 0) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDec });
}

/** Normalized wallet token row. */
export interface WalletToken {
  sym: string;
  coinType: string;
  human: number;
  decimals: number;
  usd?: number;
}

export async function fetchWalletTokens(
  _client: any,
  walletAddress: string
): Promise<WalletToken[]> {
  try {
    const balances = await mezoApi.getBalances(walletAddress);
    return balances.map((b) => {
      const human = parseFloat(b.formattedBalance) || 0;
      const price = USD_EST[b.symbol] ?? 1.0;
      return {
        sym: b.symbol,
        coinType: b.tokenAddress,
        human,
        decimals: b.decimals,
        usd: human * price,
      };
    });
  } catch {
    return [];
  }
}
