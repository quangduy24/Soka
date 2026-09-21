/**
 * Soka Intent Engine — Mezo Explorer Helpers
 * Turns on-chain risk references into verifiable links on Mezo Testnet Explorer.
 */

import type { RiskReference } from '../types/shared';

// Static member access so Vite inlines the value at transform time
// (dynamic/optional-chained import.meta access is left undefined in browsers).
const MEZO_EXPLORER_BASE =
  import.meta.env.VITE_MEZO_EXPLORER_URL || 'https://explorer.test.mezo.org';

export const mezoExplorerUrl = (ref: RiskReference): string => {
  switch (ref.type) {
    case 'token':
    case 'coin':
      return `${MEZO_EXPLORER_BASE}/token/${encodeURIComponent(ref.value)}`;
    case 'contract':
    case 'pool':
    case 'object':
    case 'account':
      return `${MEZO_EXPLORER_BASE}/address/${ref.value}`;
    case 'tx':
      return `${MEZO_EXPLORER_BASE}/tx/${ref.value}`;
    default:
      return `${MEZO_EXPLORER_BASE}/address/${ref.value}`;
  }
};

export const txExplorerUrl = (txHash: string): string => {
  return `${MEZO_EXPLORER_BASE}/tx/${txHash}`;
};

export const addressExplorerUrl = (address: string): string => {
  return `${MEZO_EXPLORER_BASE}/address/${address}`;
};

// Backward-compatible alias
export const suiscanUrl = mezoExplorerUrl;

/** Short, human-readable form of an on-chain identifier (0x1234…abcd). */
export const shortenRef = (value: string): string => {
  if (!value) return '';
  const tail = value.includes('::') ? value.split('::').pop() || value : value;
  if (tail.length <= 14) return tail;
  return `${tail.slice(0, 6)}…${tail.slice(-4)}`;
};

/** Compact unique id for history entries. */
export const makeHistoryId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Relative time formatting. */
export const timeAgo = (ts: number): string => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};
