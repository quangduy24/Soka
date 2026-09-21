/**
 * Soka Intent Engine — System Capability Registry
 * Single source of truth describing what the system can execute, what is
 * advisory-only, and what is unsupported. Consumed by:
 * - the LLM system prompt (capability-aware parsing + fallback advise),
 * - GET /api/capabilities (frontend menus, quick prompts, help),
 * - backend pipeline guards (reject out-of-scope intents instead of faking them).
 *
 * Adding a feature = updating this registry first, then wiring the executor.
 */

import { TOKEN_WHITELIST, BridgeDestinationChain } from './constant.js';
import { LENDING_CONFIG } from './index.js';

export type CapabilityStatus = 'executable' | 'advisory' | 'unsupported';

export interface CapabilityExample {
  /** Example prompt the user can tap or copy (English, executable as-is) */
  prompt: string;
  description: string;
}

export interface SystemCapability {
  action: string;
  status: CapabilityStatus;
  /** Short operator-facing summary */
  summary: string;
  /** What the user must provide for this action to succeed */
  requires: string[];
  /** Ready-to-use example prompts */
  examples: CapabilityExample[];
  /** Shown when the user asks for this but it cannot run */
  unavailableReason?: string;
}

function borrowSummary(): { summary: string; unavailableReason: string } {
  if (LENDING_CONFIG.lendingPoolAddress) {
    return {
      summary: 'Borrow quotes against BTC collateral. Execution builds an unsigned lending transaction.',
      unavailableReason: '',
    };
  }
  return {
    summary: 'Borrow quotes (max borrow, liquidation price, LTV) are estimates only.',
    unavailableReason:
      'Borrow execution is unavailable: no lending pool contract is configured ' +
      '(LENDING_POOL_ADDRESS is empty). Quotes are read-only advisories, not loan offers.',
  };
}

export function getCapabilities(): SystemCapability[] {
  const symbols = [...TOKEN_WHITELIST.map((t) => t.symbol), 'MUSD'];
  const borrow = borrowSummary();
  return [
    {
      action: 'SWAP',
      status: 'executable',
      summary: `Swap between supported tokens on Mezo Testnet: ${symbols.join(', ')}.`,
      requires: ['source token', 'destination token', 'amount (number, ALL, MAX, or N%)'],
      examples: [
        { prompt: 'Swap 0.05 BTC to MUSD', description: 'Basic swap with default slippage' },
        { prompt: 'Swap ALL BTC to mUSDC with slippage 1%', description: 'Full-balance swap with explicit slippage' },
        { prompt: 'Trade 50% mUSDC for wBTC, safest route', description: 'Percentage swap with SAFE priority' },
      ],
    },
    {
      action: 'BRIDGE_OUT',
      status: 'executable',
      summary: 'Bridge assets out of Mezo to Ethereum (chain 0) or Bitcoin (chain 1) via the AssetsBridge precompile.',
      requires: ['token', 'amount', 'destination chain (Ethereum or Bitcoin)', 'recipient address'],
      examples: [
        { prompt: 'Bridge 0.1 wBTC to Ethereum 0x0000000000000000000000000000000000000000', description: 'Bridge to an Ethereum address' },
      ],
    },
    {
      action: 'ADD_LIQUIDITY',
      status: 'executable',
      summary: 'Quote and add liquidity to a live Mezo Swap pool discovered from the on-chain factory.',
      requires: ['pool (token pair)', 'amount of the input token'],
      examples: [{ prompt: 'Show MUSD pools', description: 'List live pools, then pick one to supply' }],
    },
    {
      action: 'REMOVE_LIQUIDITY',
      status: 'executable',
      summary: 'Quote and remove liquidity (burn LP tokens) from a pool where the wallet holds LP balance.',
      requires: ['pool', 'LP token amount'],
      examples: [{ prompt: 'Remove liquidity from the BTC/MUSD pool', description: 'Starts the remove-liquidity flow' }],
    },
    {
      action: 'BORROW',
      status: LENDING_CONFIG.lendingPoolAddress ? 'executable' : 'advisory',
      summary: borrow.summary,
      requires: ['collateral token (BTC)', 'collateral amount', 'debt token (MUSD or MUSDC)'],
      examples: [{ prompt: 'Borrow MUSD with 0.1 BTC collateral', description: 'Read-only borrow quote (estimate, not a loan offer)' }],
      unavailableReason: borrow.unavailableReason || undefined,
    },
    {
      action: 'TRANSFER',
      status: 'executable',
      summary: 'Builds an unsigned transfer for your wallet to sign. EVM recipients only (0x address). Soka never moves funds itself.',
      requires: ['token', 'amount', 'recipient EVM address (0x + 40 hex chars)'],
      examples: [{ prompt: 'Send 10 MUSD to 0x0000000000000000000000000000000000000000', description: 'Unsigned transfer preview for wallet signing' }],
    },
    {
      action: 'INCENTIVE',
      status: 'unsupported',
      summary: 'Pool incentive gauges are not wired.',
      requires: [],
      examples: [],
      unavailableReason:
        'Incentive gauges are not wired to any contract. To earn fees, add liquidity to a live pool instead.',
    },
    {
      action: 'DEPOSIT',
      status: 'unsupported',
      summary: 'Direct deposits / vault staking are not executed by Soka.',
      requires: [],
      examples: [],
      unavailableReason:
        'Vault deposits are unavailable (VAULT_ADDRESS is not configured). Supported on-chain actions: Swap, Bridge-Out, Add/Remove Liquidity.',
    },
    {
      action: 'ASK_PRICE',
      status: 'executable',
      summary: 'Answer price questions from the on-chain PriceOracle precompile.',
      requires: ['token symbol'],
      examples: [{ prompt: 'What is the price of BTC?', description: 'Live oracle price with staleness check' }],
    },
    {
      action: 'ASK_POOLS',
      status: 'executable',
      summary: 'List live Mezo Swap pools by TVL from the on-chain factory.',
      requires: [],
      examples: [{ prompt: 'Show MUSD pools', description: 'Top live pools with TVL and fees' }],
    },
    {
      action: 'ASK_RISK',
      status: 'executable',
      summary: 'Report live chain risk posture (lockdown flags, gas) plus how to get a full route assessment.',
      requires: [],
      examples: [{ prompt: 'Is it safe to trade right now?', description: 'Chain-state risk snapshot' }],
    },
    {
      action: 'ASK_BRIDGE_STATUS',
      status: 'executable',
      summary: 'Report bridge-out chains, outflow capacity, and minimums from the AssetsBridge precompile.',
      requires: [],
      examples: [{ prompt: 'What is the bridge status?', description: 'Live bridge capacity and chains' }],
    },
    {
      action: 'ASK_GAS',
      status: 'executable',
      summary: 'Report the live network gas price with the operator warning threshold.',
      requires: [],
      examples: [{ prompt: 'What is the gas price?', description: 'Live gas in gwei' }],
    },
    {
      action: 'ASK_HELP',
      status: 'executable',
      summary: 'Explain what Soka can and cannot do, with runnable examples.',
      requires: [],
      examples: [{ prompt: 'What can you do?', description: 'Capability overview' }],
    },
  ];
}

/** Chains the bridge currently supports, with display names. */
export const BRIDGE_CHAIN_NAMES: Record<number, string> = {
  [BridgeDestinationChain.ETHEREUM]: 'Ethereum',
  [BridgeDestinationChain.BITCOIN]: 'Bitcoin',
};

/**
 * Structured fallback advise returned whenever an intent is unknown,
 * ambiguous, or outside system capabilities. Never fabricate pairs, amounts,
 * routes, or scores — describe, ask, and exemplify.
 */
export interface FallbackAdvise {
  error: 'unclear_intent' | 'unsupported_action' | 'unknown_token' | 'missing_field';
  message: string;
  missing: string[];
  supportedActions: string[];
  examples: CapabilityExample[];
}

export function buildFallbackAdvise(params: {
  error: FallbackAdvise['error'];
  detail: string;
  missing?: string[];
  actions?: SystemCapability[];
}): FallbackAdvise {
  const actions = params.actions ?? getCapabilities();
  const runnable = actions.filter((a) => a.status !== 'unsupported');
  const examples: CapabilityExample[] = runnable.flatMap((a) => a.examples).slice(0, 3);
  const supportedActions = runnable.map((a) => a.action);
  return {
    error: params.error,
    message: params.detail,
    missing: params.missing ?? [],
    supportedActions,
    examples,
  };
}
