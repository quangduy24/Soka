/**
 * Mezo explorer helpers.
 *
 * Guardian risk checks carry `references` — the exact on-chain artifacts
 * (token address, pool contract, transaction hash, or wallet address) they were derived from.
 * These builders turn those references into verifiable Mezo Explorer links so the
 * risk assessment is backed by independent on-chain proof.
 */

import type { RiskReference } from '../types/shared';

const MEZO_EXPLORER_BASE = 'https://explorer.mezo.org';

export const mezoExplorerUrl = (ref: RiskReference): string => {
  switch (ref.type) {
    case 'coin':
      return `${MEZO_EXPLORER_BASE}/token/${encodeURIComponent(ref.value)}`;
    case 'object':
      return `${MEZO_EXPLORER_BASE}/address/${ref.value}`;
    case 'tx':
      return `${MEZO_EXPLORER_BASE}/tx/${ref.value}`;
    case 'account':
      return `${MEZO_EXPLORER_BASE}/address/${ref.value}`;
    default:
      return `${MEZO_EXPLORER_BASE}/address/${ref.value}`;
  }
};

// Backwards-compatible alias
export const suiscanUrl = mezoExplorerUrl;

/** Short, human-readable form of an on-chain identifier (0x1234…abcd). */
export const shortenRef = (value: string): string => {
  const tail = value.includes('::') ? value.split('::').pop() || value : value;
  if (tail.length <= 14) return tail;
  return `${tail.slice(0, 6)}…${tail.slice(-4)}`;
};

/** Compact unique id for history entries (timestamp + random). */
export const makeHistoryId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Fuzzy relative time, e.g. "just now", "3m ago", "2h ago", "5d ago". */
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
