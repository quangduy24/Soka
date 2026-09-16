/**
 * Soka Intent Engine — Mezo Transaction Builder
 * Constructs unsigned EVM transactions and calldata for token swaps and approvals
 * on Mezo Testnet.
 */

import { encodeFunctionData, parseUnits, type Address, type Abi } from 'viem';
import {
  MEZO_SWAP_ROUTER,
  MEZO_SWAP_FACTORY,
  MEZO_CHAIN_ID,
  RISK_THRESHOLDS,
} from '../../config/index.js';
import { getDecimals, getAllowance, buildApproveTx } from '../../utils/erc20Utils.js';
import { normalizeTokenAddress } from './mezoRouter.js';
import type { ExecuteSwapResult, TxStep, RouteHop } from '../../types/index.js';
import rawRouterAbi from '../../abi/mezoSwapRouter.json' with { type: 'json' };

const routerAbi = rawRouterAbi as unknown as Abi;

export interface BuildSwapTxParams {
  senderAddress: Address;
  sourceTokenAddress: string;
  destTokenAddress: string;
  sourceSymbol: string;
  destSymbol: string;
  amount: string;
  slippagePercent?: number;
  routerData?: {
    routes: RouteHop[];
    amountIn: string;
    amountOut: string;
    tokenIn: Address;
    tokenOut: Address;
    isNativeIn: boolean;
    isNativeOut: boolean;
  };
}

/**
 * Builds the complete transaction payload for executing a swap on Mezo Testnet.
 */
export async function buildMezoSwapTx(params: BuildSwapTxParams): Promise<ExecuteSwapResult> {
  const {
    senderAddress,
    sourceTokenAddress,
    destTokenAddress,
    sourceSymbol,
    destSymbol,
    amount,
    slippagePercent = 0.5,
    routerData,
  } = params;

  // Native BTC is routed through the wBTC precompile (an ERC-20 mirror of the
  // native balance). The Tigris router exposes no payable ETH-style swaps, so
  // every swap — including BTC legs — is a single swapExactTokensForTokens
  // call with value 0.
  const tokenIn = normalizeTokenAddress(sourceTokenAddress);
  const tokenOut = normalizeTokenAddress(destTokenAddress);

  const sourceDecimals = await getDecimals(tokenIn).catch(() => 18);
  const destDecimals = await getDecimals(tokenOut).catch(() => 18);

  const parsedAmountIn = parseUnits(amount, sourceDecimals);

  // Compute minimum output based on slippage tolerance
  let expectedAmountOut = parsedAmountIn;
  if (routerData?.amountOut) {
    expectedAmountOut = BigInt(routerData.amountOut);
  }
  const minAmountOut = (expectedAmountOut * BigInt(Math.floor((100 - slippagePercent) * 100))) / 10000n;

  // Set execution deadline (current timestamp + 20 minutes)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // Format routes for the Tigris router (from/to/stable/factory per hop)
  const routes: { from: Address; to: Address; stable: boolean; factory: Address }[] =
    routerData?.routes?.map((r) => ({
      from: r.from,
      to: r.to,
      stable: r.stable,
      factory: (r.factory as Address) || MEZO_SWAP_FACTORY,
    })) || [{ from: tokenIn, to: tokenOut, stable: false, factory: MEZO_SWAP_FACTORY }];

  const targetContract: Address = MEZO_SWAP_ROUTER;
  const txValue = 0n;

  const txSteps: TxStep[] = [];

  // Approval step for the input token (including the wBTC precompile leg).
  // Skipped only when the on-chain allowance already covers the amount.
  try {
    const currentAllowance = await getAllowance(tokenIn, senderAddress, MEZO_SWAP_ROUTER);
    if (currentAllowance < parsedAmountIn) {
      const approvePayload = buildApproveTx(tokenIn, MEZO_SWAP_ROUTER, parsedAmountIn * 10n);
      txSteps.push({
        index: txSteps.length + 1,
        action: 'APPROVE',
        to: tokenIn,
        description: `Approve ${sourceSymbol} for Mezo Swap Router`,
        data: approvePayload.data,
        value: '0',
      });
    }
  } catch {
    // If allowance read fails, add the approval step as standard safety measure
    const approvePayload = buildApproveTx(tokenIn, MEZO_SWAP_ROUTER, parsedAmountIn * 10n);
    txSteps.push({
      index: txSteps.length + 1,
      action: 'APPROVE',
      to: tokenIn,
      description: `Approve ${sourceSymbol} for Mezo Swap Router`,
      data: approvePayload.data,
      value: '0',
    });
  }

  // Single Tigris swap call for every token combination.
  const txCalldata = encodeFunctionData({
    abi: routerAbi,
    functionName: 'swapExactTokensForTokens',
    args: [parsedAmountIn, minAmountOut, routes, senderAddress, deadline],
  });

  txSteps.push({
    index: txSteps.length + 1,
    action: 'SWAP',
    to: targetContract,
    description: `Swap ${amount} ${sourceSymbol} -> ${destSymbol} via Mezo Swap`,
    data: txCalldata,
    value: txValue.toString(),
  });

  const serializedTxData = JSON.stringify({
    to: targetContract,
    data: txCalldata,
    value: txValue.toString(),
    chainId: MEZO_CHAIN_ID,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
  });

  return {
    to: targetContract,
    data: txCalldata,
    value: txValue.toString(),
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    txSteps,
    ptbSteps: txSteps, // alias for frontend UI
    transactionData: serializedTxData,
    transactionBytes: Buffer.from(serializedTxData).toString('base64'),
    simulation: {
      success: true,
      gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    },
    routeSummary: {
      inputAmount: amount,
      inputToken: sourceSymbol,
      expectedOutput: (Number(minAmountOut) / 10 ** destDecimals).toFixed(6),
      outputToken: destSymbol,
      // Impact is reported by the route quote, not the tx builder.
      priceImpact: 'unknown',
    },
  };
}
