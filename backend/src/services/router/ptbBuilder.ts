/**
 * DIEPS Intent Engine — PTB Builder
 * Builds Programmable Transaction Blocks for swap execution on Sui Mainnet.
 * Integrates with Cetus Aggregator V3 route data.
 */

import { resolveToken, getTokenDecimalsAsync } from '../coin/tokenResolver.js';
import { getCoinsForSelection, selectCoinsForAmount } from '../coin/coinService.js';
import { suiRpcCall, SUI_MAINNET_RPC } from '../../utils/suiClient.js';
import { logger, createTimer } from '../../utils/logger.js';
import { AggregatorClient, Env } from '@cetusprotocol/aggregator-sdk';
import BN from 'bn.js';
import type { ExecuteSwapResult, PtbStep, RouteResult } from '../../types/index.js';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { RISK_THRESHOLDS } from '../../config/index.js';

/**
 * Build a serialized PTB for wallet signing.
 * Uses Cetus Aggregator route data when available, otherwise builds a basic swap PTB.
 */
export async function buildSwapPTB(params: {
  senderAddress: string;
  sourceSymbol: string;
  destSymbol: string;
  sourceAddress: string;
  destAddress: string;
  amount: string;
  slippage: number;
  routeData: RouteResult;
}): Promise<ExecuteSwapResult> {
  const timer = createTimer('buildSwapPTB');

  const {
    senderAddress,
    sourceSymbol,
    destSymbol,
    sourceAddress,
    destAddress,
    amount,
    slippage,
    routeData,
  } = params;

  const sourceToken = resolveToken(sourceSymbol);
  const destToken = resolveToken(destSymbol);
  let sourceDecimals = sourceToken?.decimals ?? 9;
  if (!sourceToken) {
    // Token not in whitelist — try async resolution for accurate decimals
    sourceDecimals = await getTokenDecimalsAsync(sourceSymbol);
  }
  const amountInMist = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, sourceDecimals)));
  const isSuiSource = sourceSymbol.toUpperCase() === 'SUI' || sourceSymbol.includes('::sui::SUI');

  // Human-readable token label for display steps (coin type → ticker).
  const shortSym = (s: string) => (s.includes('::') ? s.split('::').pop() || s : s);
  const sourceLabel = shortSym(sourceSymbol);
  const destLabel = shortSym(destSymbol);

  // Build PTB steps for display
  const ptbSteps: PtbStep[] = [];
  let stepIndex = 1;

  // Step 1: Split coins / get input coin
  if (isSuiSource) {
    ptbSteps.push({
      index: stepIndex++,
      command: 'SplitCoins',
      description: `Split ${amount} ${sourceLabel} from gas coin`,
    });
  } else {
    ptbSteps.push({
      index: stepIndex++,
      command: 'MergeCoins',
      description: `Select and merge ${sourceLabel} coins for ${amount}`,
    });
  }

  // Step 2+: Swap through each route hop
  if (routeData.route && routeData.route.length > 0) {
    for (const node of routeData.route) {
      ptbSteps.push({
        index: stepIndex++,
        command: 'MoveCall',
        target: `${node.dex.toLowerCase()}::swap::exact_in`,
        description: `Swap via ${node.dex} Pool (${node.ratio}%, ${node.fee}% fee)`,
      });
    }
  }

  // Final step: Transfer output to sender
  ptbSteps.push({
    index: stepIndex++,
    command: 'TransferObjects',
    description: `Transfer ${destLabel} output to sender`,
  });

  // Build the actual transaction using Sui SDK
  let transactionBytes = '';
  let simulation = {
    success: false,
    gasUsed: '0',
    balanceChanges: [] as any[],
    error: undefined as string | undefined,
  };

  try {
    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();
    tx.setSender(senderAddress);

    // Initialize Cetus Aggregator Client
    const clientSDK = new AggregatorClient({
    endpoint: RISK_THRESHOLDS.cetusEndpoint,
    signer: senderAddress,
    env: Env.Mainnet
  });

    // Reuse the exact router result already computed by findOptimalRoute. This
    // avoids a redundant aggregator round-trip and guarantees the executed swap
    // matches the route shown in the UI. Only re-query if it wasn't provided.
    let routers: any = routeData.routerData;
    if (!routers || !routers.paths) {
      const providers = routeData.dex_sequence.map(dex => dex.toUpperCase());
      routers = await clientSDK.findRouters({
        from: sourceAddress,
        target: destAddress,
        amount: new BN(amountInMist),
        byAmountIn: true,
        splitCount: 20,
        depth: 3,
        providers: providers.length > 0 ? providers : undefined,
      });
    }

    if (!routers || !routers.paths) {
      throw new Error('No viable swap route found for PTB Builder.');
    }

    // Determine target slippage
    const maxSlippage = slippage / 100;

    // Build the swap PTB ONCE and reuse the same transaction for both the wallet
    // payload and the simulation. Previously the entire swap was built twice
    // (two fastRouterSwap calls on two Transaction objects), doubling latency.
    await clientSDK.fastRouterSwap({
      router: routers,
      txb: tx,
      slippage: maxSlippage,
    });

    // Cap gas budget (unused gas is refunded). 0.05 SUI = 10× the typical swap cost.
    tx.setGasBudget(RISK_THRESHOLDS.router.gasEstimateMist * 10);

    const client = new SuiJsonRpcClient({
      transport: new JsonRpcHTTPTransport({ url: SUI_MAINNET_RPC }),
      network: 'mainnet' as any
    });

    // Serialize the wallet payload FIRST — this is the critical output the
    // frontend signs, so it must be secured before the best-effort simulation.
    // (client resolves CoinWithBalance intents.)
    transactionBytes = await tx.toJSON({ client });

    // Best-effort simulation on the same tx: any failure here must not clobber
    // the already-serialized wallet payload above.
    try {
      const builtBytes = await tx.build({ client });
      const simBytes = Buffer.from(builtBytes).toString('base64');
      const simResult = await suiRpcCall('sui_dryRunTransactionBlock', [simBytes]);
      if (simResult) {
        const gasCost = simResult.effects?.gasUsed;
        let totalGas = '0';
        if (gasCost) {
          const computation = BigInt(gasCost.computationCost || '0');
          const storage = BigInt(gasCost.storageCost || '0');
          const rebate = BigInt(gasCost.storageRebate || '0');
          const nonRefundable = BigInt(gasCost.nonRefundableStorageFee || '0');
          const calculatedGas = computation + storage - rebate + nonRefundable;
          totalGas = calculatedGas > 0n ? calculatedGas.toString() : computation.toString();
        }

        simulation = {
          success: simResult.effects?.status?.status === 'success',
          gasUsed: totalGas,
          balanceChanges: simResult.balanceChanges || [],
          error: simResult.effects?.status?.error,
        };
      }
    } catch (simErr: any) {
      logger.warn('Transaction simulation failed', { error: simErr.message });
      simulation.error = simErr.message;
    }

  } catch (err: any) {
    logger.error('PTB build failed', { error: err.message });
    simulation.error = err.message;
  }

  const result: ExecuteSwapResult = {
    transactionBytes,
    ptbSteps,
    simulation,
    routeSummary: {
      inputAmount: amount,
      inputToken: sourceSymbol,
      expectedOutput: routeData.expected_output?.toString() || '0',
      outputToken: destSymbol,
      priceImpact: routeData.execution_impact || '0%',
    },
  };

  timer.end({ success: simulation.success });
  return result;
}
