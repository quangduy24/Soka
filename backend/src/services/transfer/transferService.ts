/**
 * Soka Intent Engine — Transfer Service
 * Builds unsigned EVM transactions for direct token transfers on Mezo Testnet.
 * - ERC-20 transfers: `transfer(recipient, amount)` calldata (no approval needed).
 * - Native BTC transfers: plain value transfer to the recipient.
 * Users sign in their own wallets; the backend never holds keys.
 */

import { encodeFunctionData, parseUnits, isAddress, type Address, type Abi } from 'viem';
import { MEZO_CHAIN_ID, RISK_THRESHOLDS, ZERO_ADDRESS, DEFAULT_DECIMALS } from '../../config/index.js';
import { getDecimals } from '../../utils/erc20Utils.js';
import { simulateCalls } from '../../utils/mezoClient.js';
import { resolveToken } from '../coin/tokenResolver.js';
import type { ExecuteSwapResult, TxStep } from '../../types/index.js';
import rawErc20Abi from '../../abi/erc20.json' with { type: 'json' };

const erc20Abi = rawErc20Abi as unknown as Abi;

export interface BuildTransferParams {
  senderAddress: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  amount: string;
  recipient: string;
  /** Dry-run the transfer (default true; unit tests pass false to stay offline) */
  simulate?: boolean;
}

async function envelope(
  sender: Address,
  to: Address,
  data: `0x${string}`,
  value: string,
  txSteps: TxStep[],
  simulate: boolean
): Promise<ExecuteSwapResult> {
  const serializedData = JSON.stringify({
    to,
    data,
    value,
    chainId: MEZO_CHAIN_ID,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
  });
  let simulation: ExecuteSwapResult['simulation'] = {
    success: true,
    gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    simulated: false,
  };
  if (simulate) {
    try {
      const sim = await simulateCalls(sender, [{ to, data, value: BigInt(value) }]);
      simulation = {
        success: sim.success,
        gasUsed: sim.gasUsed ?? RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
        simulated: sim.simulated,
        ...(sim.error ? { error: sim.error } : {}),
      };
    } catch (err) {
      simulation = {
        success: false,
        gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
        simulated: false,
        error: `Simulation failed: ${(err as Error).message}`,
      };
    }
  }
  return {
    to,
    data,
    value,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    txSteps,
    ptbSteps: txSteps,
    transactionData: serializedData,
    transactionBytes: Buffer.from(serializedData).toString('base64'),
    simulation,
    routeSummary: {
      inputAmount: '',
      inputToken: '',
      expectedOutput: '',
      outputToken: '',
      priceImpact: null,
    },
  };
}

export async function buildTransferTx(params: BuildTransferParams): Promise<ExecuteSwapResult> {
  const { senderAddress, tokenSymbol, tokenAddress, amount, recipient, simulate = true } = params;

  if (!isAddress(senderAddress)) throw new Error('A connected wallet address is required to build a transfer.');
  const to = recipient.trim();
  if (!isAddress(to)) throw new Error('Recipient must be a valid EVM address (0x + 40 hex chars).');

  const token = tokenAddress
    ? resolveToken(tokenAddress) ?? (isAddress(tokenAddress) ? { symbol: tokenSymbol ?? 'TOKEN', address: tokenAddress, decimals: DEFAULT_DECIMALS } : null)
    : tokenSymbol
      ? resolveToken(tokenSymbol)
      : null;
  if (!token || !isAddress(token.address)) {
    throw new Error(`Unknown token: ${tokenSymbol ?? tokenAddress ?? '(none)'}. Pick a supported token first.`);
  }

  const isNative = token.address.toLowerCase() === ZERO_ADDRESS.toLowerCase();
  const decimals = isNative
    ? DEFAULT_DECIMALS
    : await getDecimals(token.address as Address).catch(() => DEFAULT_DECIMALS);
  const parsed = parseUnits(amount, decimals);
  if (parsed <= 0n) throw new Error('Transfer amount must be positive.');

  if (isNative) {
    const txSteps: TxStep[] = [
      {
        index: 1,
        action: 'TRANSFER',
        to,
        description: `Transfer ${amount} BTC to ${to}`,
        value: parsed.toString(),
      },
    ];
    return await envelope(senderAddress as Address, to as Address, '0x' as `0x${string}`, parsed.toString(), txSteps, simulate);
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parsed],
  });
  const txSteps: TxStep[] = [
    {
      index: 1,
      action: 'TRANSFER',
      to: token.address,
      description: `Transfer ${amount} ${token.symbol} to ${to}`,
      data,
      value: '0',
    },
  ];
  const result = await envelope(senderAddress as Address, token.address as Address, data, '0', txSteps, simulate);
  result.routeSummary = {
    inputAmount: amount,
    inputToken: token.symbol,
    expectedOutput: amount,
    outputToken: token.symbol,
    priceImpact: null,
  };
  return result;
}
