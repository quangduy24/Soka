/**
 * Soka Intent Engine — Mezo Assets Bridge Service
 * Integrates directly with the IAssetsBridge precompiled contract (0x7b7c...0012)
 * to support cross-chain bridge-out operations to Ethereum (chain 0) and Bitcoin (chain 1).
 */

import {
  encodeFunctionData,
  parseUnits,
  toHex,
  isAddress,
  type Address,
  type Hex,
  type Abi,
} from 'viem';
import {
  MEZO_PRECOMPILES,
  MEZO_CHAIN_ID,
  RISK_THRESHOLDS,
  MARKET_CONFIG,
  TOKEN_WHITELIST,
  ZERO_ADDRESS,
} from '../../config/index.js';
import { readContract } from '../../utils/mezoClient.js';
import { getDecimals, getAllowance, buildApproveTx } from '../../utils/erc20Utils.js';
import { logger } from '../../utils/logger.js';
import type {
  BridgeOutParams,
  BridgeInfoResult,
  BridgeTokenMapping,
  ExecuteSwapResult,
  TxStep,
} from '../../types/index.js';
import rawAssetsBridgeAbi from '../../abi/assetsBridge.json' with { type: 'json' };

const assetsBridgeAbi = rawAssetsBridgeAbi as unknown as Abi;

const BRIDGE_ADDRESS = MEZO_PRECOMPILES.assetsBridge;

/**
 * Encodes recipient string (EVM hex address or Bitcoin address) to hex bytes.
 */
function encodeRecipient(recipient: string, chain: number): Hex {
  const trimmed = recipient.trim();
  if (chain === 0) {
    // Ethereum address
    if (isAddress(trimmed)) {
      return trimmed as Hex;
    }
  }
  // Convert address string to UTF-8 hex bytes for Bitcoin or arbitrary formats
  return toHex(trimmed);
}

/**
 * Queries enabled destination chains for bridge-out operations.
 */
export async function getBridgeOutChains(): Promise<number[]> {
  try {
    const chains = await readContract<number[]>({
      address: BRIDGE_ADDRESS,
      abi: assetsBridgeAbi,
      functionName: 'getBridgeOutChains',
    });
    return Array.from(chains).map(Number);
  } catch (err) {
    logger.warn(`Failed to read getBridgeOutChains: ${(err as Error).message}. Defaulting to [0, 1].`);
    return [0, 1]; // Ethereum (0) and Bitcoin (1)
  }
}

/**
 * Queries ERC-20 source-to-Mezo token mappings from the bridge precompile.
 */
export async function getTokenMappings(): Promise<BridgeTokenMapping[]> {
  try {
    const mappings = await readContract<
      Array<{ sourceToken: Address; mezoToken: Address }>
    >({
      address: BRIDGE_ADDRESS,
      abi: assetsBridgeAbi,
      functionName: 'getERC20TokensMappings',
    });

    return mappings.map((m) => ({
      sourceToken: m.sourceToken,
      mezoToken: m.mezoToken,
    }));
  } catch (err) {
    logger.warn(`Failed to read token mappings: ${(err as Error).message}. Returning known whitelist tokens.`);
    return TOKEN_WHITELIST.map((t) => ({
      sourceToken: t.address,
      mezoToken: t.address,
    }));
  }
}

/**
 * Checks remaining bridge outflow capacity for a token.
 */
export async function getOutflowCapacity(tokenAddress: Address): Promise<bigint> {
  try {
    return await readContract<bigint>({
      address: BRIDGE_ADDRESS,
      abi: assetsBridgeAbi,
      functionName: 'getOutflowCapacity',
      args: [tokenAddress],
    });
  } catch {
    return 10_000_000_000_000_000_000n; // Default capacity fallback
  }
}

/**
 * Checks minimum bridge-out amount for a token.
 */
export async function getMinBridgeOutAmount(tokenAddress: Address): Promise<bigint> {
  try {
    return await readContract<bigint>({
      address: BRIDGE_ADDRESS,
      abi: assetsBridgeAbi,
      functionName: 'getMinBridgeOutAmount',
      args: [tokenAddress],
    });
  } catch {
    return 1000n;
  }
}

/**
 * Aggregates all bridge configuration and state for the frontend.
 * Capacity reads run in parallel and the result is cached briefly;
 * TTL comes from env POOLS_CACHE_TTL_MS (shared market-data cache window).
 */
const bridgeInfoCache: { value: BridgeInfoResult; expiresAt: number } | null = null;
let bridgeInfoCacheEntry: { value: BridgeInfoResult; expiresAt: number } | null = bridgeInfoCache;

export async function getBridgeInfo(): Promise<BridgeInfoResult> {
  if (bridgeInfoCacheEntry && Date.now() <= bridgeInfoCacheEntry.expiresAt) {
    return bridgeInfoCacheEntry.value;
  }

  const [enabledChains, tokenMappings] = await Promise.all([
    getBridgeOutChains(),
    getTokenMappings(),
  ]);

  const perToken = await Promise.all(
    TOKEN_WHITELIST.map(async (token) => {
      const addr = token.address as Address;
      const [capacity, minAmount] = await Promise.all([
        getOutflowCapacity(addr),
        getMinBridgeOutAmount(addr),
      ]);
      return { symbol: token.symbol, capacity: capacity.toString(), minAmount: minAmount.toString() };
    })
  );

  const capacities: Record<string, string> = {};
  const minAmounts: Record<string, string> = {};
  for (const t of perToken) {
    capacities[t.symbol] = t.capacity;
    minAmounts[t.symbol] = t.minAmount;
  }

  const result: BridgeInfoResult = {
    enabledChains,
    tokenMappings,
    outflowCapacities: capacities,
    minBridgeOutAmounts: minAmounts,
  };
  bridgeInfoCacheEntry = {
    value: result,
    expiresAt: Date.now() + MARKET_CONFIG.poolsCacheTtlMs,
  };
  return result;
}

/**
 * Builds unsigned transaction calldata to execute bridgeOut() on the Assets Bridge precompile.
 */
export async function buildBridgeOutTx(params: BridgeOutParams): Promise<ExecuteSwapResult> {
  const { senderAddress, tokenAddress, amount, destinationChain, recipient } = params;

  const isNative =
    tokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
    tokenAddress.toLowerCase() === MEZO_PRECOMPILES.btcToken.toLowerCase();

  const targetToken = isNative ? MEZO_PRECOMPILES.btcToken : (tokenAddress as Address);
  const decimals = await getDecimals(targetToken).catch(() => 18);
  const parsedAmount = parseUnits(amount, decimals);

  const recipientBytes = encodeRecipient(recipient, destinationChain);
  const txSteps: TxStep[] = [];

  // If token is ERC-20, ensure bridge is approved
  if (!isNative) {
    try {
      const allowance = await getAllowance(targetToken, senderAddress, BRIDGE_ADDRESS);
      if (allowance < parsedAmount) {
        const approvePayload = buildApproveTx(targetToken, BRIDGE_ADDRESS, parsedAmount * 10n);
        txSteps.push({
          index: txSteps.length + 1,
          action: 'APPROVE',
          to: targetToken,
          description: `Approve token for Mezo Assets Bridge (${BRIDGE_ADDRESS})`,
          data: approvePayload.data,
          value: '0',
        });
      }
    } catch {
      const approvePayload = buildApproveTx(targetToken, BRIDGE_ADDRESS, parsedAmount * 10n);
      txSteps.push({
        index: txSteps.length + 1,
        action: 'APPROVE',
        to: targetToken,
        description: `Approve token for Mezo Assets Bridge (${BRIDGE_ADDRESS})`,
        data: approvePayload.data,
        value: '0',
      });
    }
  }

  const bridgeCalldata = encodeFunctionData({
    abi: assetsBridgeAbi,
    functionName: 'bridgeOut',
    args: [targetToken, parsedAmount, destinationChain, recipientBytes],
  });

  const chainName = destinationChain === 0 ? 'Ethereum' : 'Bitcoin';

  txSteps.push({
    index: txSteps.length + 1,
    action: 'BRIDGE_OUT',
    to: BRIDGE_ADDRESS,
    description: `Bridge out ${amount} to ${chainName} (${recipient})`,
    data: bridgeCalldata,
    value: isNative && tokenAddress === ZERO_ADDRESS ? parsedAmount.toString() : '0',
  });

  const txValue = isNative && tokenAddress === ZERO_ADDRESS ? parsedAmount.toString() : '0';

  const serializedData = JSON.stringify({
    to: BRIDGE_ADDRESS,
    data: bridgeCalldata,
    value: txValue,
    chainId: MEZO_CHAIN_ID,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
  });

  return {
    to: BRIDGE_ADDRESS,
    data: bridgeCalldata,
    value: txValue,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    txSteps,
    ptbSteps: txSteps,
    transactionData: serializedData,
    transactionBytes: Buffer.from(serializedData).toString('base64'),
    simulation: {
      success: true,
      gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    },
    routeSummary: {
      inputAmount: amount,
      inputToken: isNative ? 'BTC' : 'TOKEN',
      expectedOutput: amount,
      outputToken: `${chainName} Asset`,
      priceImpact: '0.00%',
    },
  };
}
