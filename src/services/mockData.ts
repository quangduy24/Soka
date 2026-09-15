/**
 * Soka Intent Engine — Mezo Display Data & Formatters
 * Formatter utilities and fallback contacts for Mezo Testnet.
 */

export interface MockToken {
  symbol: string;
  name: string;
  balance: number;
  usdPrice: number;
  icon: string;
}

export interface MockTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'send' | 'claim_link';
  amount: string;
  token: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  txHash: string;
  recipient?: string;
  claimLink?: string;
}

export interface MockContact {
  name: string;
  address: string;
  avatar: string;
}

export const mockTokens: MockToken[] = [
  { symbol: 'BTC', name: 'Bitcoin (Native)', balance: 0.15, usdPrice: 95000, icon: '₿' },
  { symbol: 'MEZO', name: 'Mezo Token', balance: 2500, usdPrice: 2.5, icon: '⚡' },
  { symbol: 'mUSDC', name: 'Mezo USD Coin', balance: 1500, usdPrice: 1.0, icon: '💲' },
  { symbol: 'mUSDT', name: 'Mezo Tether USD', balance: 1000, usdPrice: 1.0, icon: '💵' },
  { symbol: 'mcbBTC', name: 'Mezo Coinbase BTC', balance: 0.05, usdPrice: 95000, icon: '🟠' },
];

export const mockTransactions: MockTransaction[] = [
  { id: '1', type: 'deposit', amount: '0.05', token: 'BTC', status: 'completed', timestamp: Date.now() - 120000, txHash: '0x8f3a2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b' },
  { id: '2', type: 'withdraw', amount: '500', token: 'mUSDC', status: 'completed', timestamp: Date.now() - 300000, txHash: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091', recipient: '0x1234...abcd' },
  { id: '3', type: 'send', amount: '100', token: 'MEZO', status: 'completed', timestamp: Date.now() - 600000, txHash: '0x9e55f8ab2c3d4e5f6a7b8c9d0e1f2a3b4', recipient: '0x9876...fedc' },
];

export const mockContacts: MockContact[] = [
  { name: 'Alice', address: '0x1234567890abcdef1234567890abcdef12345678', avatar: '👩' },
  { name: 'Bob', address: '0xabcdef1234567890abcdef1234567890abcdef12', avatar: '👨' },
  { name: 'Charlie', address: '0x9876543210fedcba9876543210fedcba98765432', avatar: '🧑' },
];

export function formatAmount(amount: string | number, decimals = 4): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!isFinite(n) || n === 0) return '0.00';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function formatUsd(amount: number): string {
  if (!isFinite(amount) || amount === 0) return '$0.00';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortenAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
