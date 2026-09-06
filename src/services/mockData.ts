// Mock Data for Mezo Features
// This is temporary data for UX testing - will be removed when connecting to real APIs

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

// Mock Tokens
export const mockTokens: MockToken[] = [
  { symbol: 'SUI', name: 'Sui', balance: 1250.50, usdPrice: 0.65, icon: '🔷' },
  { symbol: 'USDC', name: 'USD Coin', balance: 500.00, usdPrice: 1.00, icon: '💲' },
  { symbol: 'CETUS', name: 'Cetus Protocol', balance: 25000, usdPrice: 0.005, icon: '🐙' },
  { symbol: 'DEEP', name: 'DeepBook', balance: 15000, usdPrice: 0.04, icon: '📚' },
  { symbol: 'WETH', name: 'Wrapped ETH', balance: 0.45, usdPrice: 3200, icon: '💎' },
];

// Mock Recent Transactions
export const mockTransactions: MockTransaction[] = [
  { id: '1', type: 'deposit', amount: '100', token: 'SUI', status: 'completed', timestamp: Date.now() - 120000, txHash: '0x8f3a2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b' },
  { id: '2', type: 'send', amount: '50', token: 'USDC', status: 'completed', timestamp: Date.now() - 300000, txHash: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091', recipient: '0x1234...abcd' },
  { id: '3', type: 'claim_link', amount: '500', token: 'CETUS', status: 'completed', timestamp: Date.now() - 600000, txHash: '0x9e55f8ab2c3d4e5f6a7b8c9d0e1f2a3b4', claimLink: 'https://mezo.claim/abc123' },
  { id: '4', type: 'withdraw', amount: '25', token: 'SUI', status: 'pending', timestamp: Date.now() - 900000, txHash: '0x7c44a9f2b3c4d5e6f7a8b9c0d1e2f3a4b5' },
];

// Mock Contacts
export const mockContacts: MockContact[] = [
  { name: 'Alice', address: '0x1234567890abcdef1234567890abcdef12345678', avatar: '👩' },
  { name: 'Bob', address: '0xabcdef1234567890abcdef1234567890abcdef12', avatar: '👨' },
  { name: 'Charlie', address: '0x9876543210fedcba9876543210fedcba98765432', avatar: '🧑' },
  { name: 'Diana', address: '0xfedcba9876543210fedcba9876543210fedcba98', avatar: '👩‍💼' },
];

// Mock Claim Links
export const mockClaimLinks = [
  { id: 'abc123', amount: '500', token: 'CETUS', createdAt: Date.now() - 3600000, claimed: false, link: 'https://mezo.claim/abc123' },
  { id: 'def456', amount: '100', token: 'SUI', createdAt: Date.now() - 7200000, claimed: true, claimer: '0x1234...abcd', link: 'https://mezo.claim/def456' },
  { id: 'ghi789', amount: '50', token: 'USDC', createdAt: Date.now() - 86400000, claimed: false, link: 'https://mezo.claim/ghi789' },
];

// Helper functions
export const formatAmount = (amount: string | number, decimals: number = 2) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const formatUsd = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const formatTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

export const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const generateTxHash = () => {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

export const generateClaimId = () => {
  return Math.random().toString(36).substring(2, 10);
};
