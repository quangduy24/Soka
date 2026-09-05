import { useState } from 'react';

/* Shared wallet/token helpers used by the header WalletMenu. */

export const DECIMALS: Record<string, number> = {
  SUI: 9, USDC: 6, USDT: 6, DEEP: 6, BLUB: 2, WAL: 9, CETUS: 9, ETH: 8, WBTC: 8,
};

export const HIDE_KEY = 'adidahood:hide-balance';

/** Static USD estimate for well-known tokens (client has no oracle). */
export const USD_EST: Record<string, number> = {
  SUI: 3.4, USDC: 1, USDT: 1, DEEP: 0.28, WAL: 0.35, CETUS: 0.22,
  ETH: 2600, WBTC: 61000, BLUB: 0.000005, HIPPO: 0.00002, LOFI: 0.0003,
};

export function symbolOf(coinType: string): string {
  const tail = (coinType || '').split('::').pop() || 'TOKEN';
  return tail.toUpperCase();
}

export function decimalsOf(coinType: string, symbol: string): number {
  if (coinType.includes('::sui::SUI') || symbol === 'SUI') return 9;
  return DECIMALS[symbol] ?? 9;
}

export function loadHidden(): boolean {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
}

export function saveHidden(v: boolean) {
  try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
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

export async function fetchWalletTokens(client: any, walletAddress: string): Promise<WalletToken[]> {
  const res: any = await (client as any).listBalances({ owner: walletAddress });
  const list: any[] = Array.isArray(res) ? res : (res?.balances || res?.data || []);
  return list
    .map((b) => {
      const sym = symbolOf(b.coinType || '');
      const dec = decimalsOf(b.coinType || '', sym);
      const human = Number(b.totalBalance || b.balance || '0') / Math.pow(10, dec);
      const price = USD_EST[sym];
      return { sym, coinType: b.coinType, human, decimals: dec, usd: price ? human * price : undefined };
    })
    .filter((x) => x.human > 0)
    .sort((a, b) => (b.usd ?? b.human) - (a.usd ?? a.human));
}

/** Hides overflow with a mask — used when the user toggles hidden balances. */
export const useHiddenPref = (): [boolean, () => void] => {
  const [hidden, setHidden] = useState<boolean>(loadHidden);
  const toggle = () => {
    setHidden((h) => {
      saveHidden(!h);
      return !h;
    });
  };
  return [hidden, toggle];
};
