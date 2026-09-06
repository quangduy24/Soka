// Mezo API Service - Replaces Sui API
// Handles: Deposit, Withdraw, Send, Create Claim Link

export interface MezoTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'send' | 'claim_link';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount?: string;
  token?: string;
  recipient?: string;
  claimLink?: string;
  createdAt: number;
  txHash?: string;
}

export interface MezoBalance {
  token: string;
  symbol: string;
  balance: number;
  usdValue?: number;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mezo API
export const mezoApi = {
  // Deposit tokens
  async deposit(amount: string, token: string): Promise<MezoTransaction> {
    await delay(1500);
    return {
      id: generateId(),
      type: 'deposit',
      status: 'completed',
      amount,
      token,
      createdAt: Date.now(),
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
    };
  },

  // Withdraw tokens
  async withdraw(amount: string, token: string, recipient?: string): Promise<MezoTransaction> {
    await delay(1500);
    return {
      id: generateId(),
      type: 'withdraw',
      status: 'completed',
      amount,
      token,
      recipient,
      createdAt: Date.now(),
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
    };
  },

  // Send tokens to address
  async send(amount: string, token: string, recipient: string): Promise<MezoTransaction> {
    await delay(1500);
    return {
      id: generateId(),
      type: 'send',
      status: 'completed',
      amount,
      token,
      recipient,
      createdAt: Date.now(),
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
    };
  },

  // Create claim link
  async createClaimLink(amount: string, token: string): Promise<MezoTransaction> {
    await delay(2000);
    const claimId = generateId();
    return {
      id: claimId,
      type: 'claim_link',
      status: 'completed',
      amount,
      token,
      claimLink: `https://mezo.claim/${claimId}`,
      createdAt: Date.now(),
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
    };
  },

  // Get balances
  async getBalances(): Promise<MezoBalance[]> {
    await delay(500);
    return [
      { token: '0x2::sui::SUI', symbol: 'SUI', balance: 1250.50, usdValue: 812.83 },
      { token: '0x::usdc::USDC', symbol: 'USDC', balance: 500.00, usdValue: 500.00 },
      { token: '0x::cetus::CETUS', symbol: 'CETUS', balance: 25000, usdValue: 125.00 },
    ];
  },
};
