import { useState } from 'react';
import { mezoApi } from '../../services/mezoApi.js';

export const HIDE_KEY = 'soka:hide-balance';

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

/** Normalized wallet token row (USD value present only when priced on-chain). */
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
  // Errors propagate to the caller's query error state (never masked as empty).
  const balances = await mezoApi.getBalances(walletAddress);
  return balances.map((b) => {
    const human = parseFloat(b.formattedBalance) || 0;
    return {
      sym: b.symbol,
      coinType: b.tokenAddress,
      human,
      decimals: b.decimals,
      // Backend-computed from the PriceOracle / router quotes; undefined = unknown.
      usd: b.usdValue,
    };
  });
}
