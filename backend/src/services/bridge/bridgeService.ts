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
  TOKEN_WHITELIST,
  ZERO_ADDRESS,
  BridgeDestinationChain,
  BRIDGE_CONFIG,
  TX_CONFIG,
  DEFAULT_DECIMALS,
} from '../../config/index.js';
import { BRIDGE_CHAIN_NAMES } from '../../config/capabilities.js';
import { readContract, simulateCalls } from '../../utils/mezoClient.js';
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
  if (chain === BridgeDestinationChain.ETHEREUM) {
    // Ethereum address
    if (isAddress(trimmed)) {
      return trimmed as Hex;
    }
  }
  // Convert address string to UTF-8 hex bytes for Bitcoin or arbitrary formats
  return toHex(trimmed);
}

/** Validates a bridge recipient for the target chain before building. */
export function validateBridgeRecipient(recipient: string, chain: number): string | null {
  const trimmed = (recipient || '').trim();
  if (!trimmed) return 'Recipient address is required for bridge-out.';
  if (chain === BridgeDestinationChain.ETHEREUM && !isAddress(trimmed)) {
    return 'Recipient must be a valid EVM address (0x + 40 hex chars) for Ethereum bridge-out.';
  }
  if (chain === BridgeDestinationChain.BITCOIN && trimmed.length < 8) {
    return 'Recipient must be a valid Bitcoin address or script for Bitcoin bridge-out.';
  }
  return null;
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
    logger.warn(`Failed to read getBridgeOutChains: ${(err as Error).message}. Using operator default.`);
    return [...BRIDGE_CONFIG.defaultChains];
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
 * Returns null when unreadable — callers must block, never assume capacity.
 */
export async function getOutflowCapacity(tokenAddress: Address): Promise<bigint | null> {
  try {
    // The precompile returns (capacity, resetHeight) — only capacity matters here.
    const [capacity] = await readContract<readonly [bigint, bigint]>({
      address: BRIDGE_ADDRESS,
      abi: assetsBridgeAbi,
      functionName: 'getOutflowCapacity',
      args: [tokenAddress],
    });
    return typeof capacity === 'bigint' ? capacity : null;
  } catch (err) {
    logger.warn(`Failed to read outflow capacity for ${tokenAddress}: ${(err as Error).message}`);
    return BRIDGE_CONFIG.defaultCapacity;
  }
}

/**
 * Checks minimum bridge-out amount for a token.
 * Returns null when unreadable — callers must block, never assume a minimum.
 */
export async function getMinBridgeOutAmount(tokenAddress: Address): Promise<bigint | null> {
  try {
    return await readContract<bigint>({
      address: BRIDGE_ADDRESS,
      abi: assetsBridgeAbi,
      functionName: 'getMinBridgeOutAmount',
      args: [tokenAddress],
    });
  } catch (err) {
    logger.warn(`Failed to read min bridge-out amount for ${tokenAddress}: ${(err as Error).message}`);
    return BRIDGE_CONFIG.defaultMinAmount;
  }
}

/**
 * Aggregates all bridge configuration and state for the frontend.
 * Capacity reads run in parallel and the result is cached briefly under its
 * own TTL (BRIDGE_INFO_TTL_MS). Unknown values are reported as 'unknown'.
 */
let bridgeInfoCacheEntry: { value: BridgeInfoResult; expiresAt: number } | null = null;

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
      return {
        symbol: token.symbol,
        capacity: capacity != null ? capacity.toString() : 'unknown',
        minAmount: minAmount != null ? minAmount.toString() : 'unknown',
      };
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
    expiresAt: Date.now() + BRIDGE_CONFIG.infoTtlMs,
  };
  return result;
}

/**
 * Builds unsigned transaction calldata to execute bridgeOut() on the Assets Bridge precompile.
 */
export async function buildBridgeOutTx(params: BridgeOutParams): Promise<ExecuteSwapResult> {
  const { senderAddress, tokenAddress, amount, destinationChain, recipient } = params;

  const recipientError = validateBridgeRecipient(recipient, destinationChain);
  if (recipientError) throw new Error(recipientError);

  const isNative =
    tokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
    tokenAddress.toLowerCase() === MEZO_PRECOMPILES.btcToken.toLowerCase();

  const targetToken = isNative ? MEZO_PRECOMPILES.btcToken : (tokenAddress as Address);
  const decimals = await getDecimals(targetToken).catch(() => DEFAULT_DECIMALS);
  const parsedAmount = parseUnits(amount, decimals);

  // Bitcoin chain has a higher on-chain dust minimum (0.01 BTC)
  if (destinationChain === BridgeDestinationChain.BITCOIN && parsedAmount < parseUnits('0.01', decimals)) {
    throw new Error('Bridging to Bitcoin requires a minimum amount of 0.01 BTC.');
  }

  // Pre-flight on-chain checks: capacity and minimum amount. Unknown values
  // block the build instead of assuming arbitrary fallbacks.
  const [capacity, minAmount] = await Promise.all([
    getOutflowCapacity(targetToken),
    getMinBridgeOutAmount(targetToken),
  ]);
  if (capacity == null) {
    throw new Error('Bridge outflow capacity is unreadable on-chain right now. Try again later.');
  }
  if (minAmount == null) {
    throw new Error('Bridge minimum amount is unreadable on-chain right now. Try again later.');
  }
  if (parsedAmount < minAmount) {
    throw new Error(`Amount is below the on-chain minimum bridge-out amount (${minAmount.toString()} wei).`);
  }
  if (parsedAmount > capacity) {
    throw new Error('Amount exceeds the remaining on-chain bridge outflow capacity.');
  }

  const recipientBytes = encodeRecipient(recipient, destinationChain);
  const txSteps: TxStep[] = [];

  // On Mezo, the AssetsBridge precompile burns tokens (both native BTC via btcToken precompile
  // and ERC-20s) directly from msg.sender. Therefore, the caller MUST approve the bridge precompile
  // address (0x7b7c...0012) on targetToken before calling bridgeOut.
  const shouldCheckAllowance = senderAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
  if (shouldCheckAllowance) {
    try {
      const allowance = await getAllowance(targetToken, senderAddress, BRIDGE_ADDRESS);
      if (allowance < parsedAmount) {
        const approvePayload = buildApproveTx(targetToken, BRIDGE_ADDRESS, parsedAmount * TX_CONFIG.approveMultiplier);
        txSteps.push({
          index: txSteps.length + 1,
          action: 'APPROVE',
          to: targetToken,
          description: `Approve ${isNative ? 'BTC' : 'token'} for Mezo Assets Bridge (${BRIDGE_ADDRESS})`,
          data: approvePayload.data,
          value: '0',
        });
      }
    } catch {
      const approvePayload = buildApproveTx(targetToken, BRIDGE_ADDRESS, parsedAmount * TX_CONFIG.approveMultiplier);
      txSteps.push({
        index: txSteps.length + 1,
        action: 'APPROVE',
        to: targetToken,
        description: `Approve ${isNative ? 'BTC' : 'token'} for Mezo Assets Bridge (${BRIDGE_ADDRESS})`,
        data: approvePayload.data,
        value: '0',
      });
    }
  } else {
    const approvePayload = buildApproveTx(targetToken, BRIDGE_ADDRESS, parsedAmount * TX_CONFIG.approveMultiplier);
    txSteps.push({
      index: txSteps.length + 1,
      action: 'APPROVE',
      to: targetToken,
      description: `Approve ${isNative ? 'BTC' : 'token'} for Mezo Assets Bridge (${BRIDGE_ADDRESS})`,
      data: approvePayload.data,
      value: '0',
    });
  }

  const bridgeCalldata = encodeFunctionData({
    abi: assetsBridgeAbi,
    functionName: 'bridgeOut',
    args: [targetToken, parsedAmount, destinationChain, recipientBytes],
  });

  const chainName = BRIDGE_CHAIN_NAMES[destinationChain] ?? `Chain ${destinationChain}`;

  // bridgeOut is non-payable; native BTC is pulled via btcToken precompile approval, never msg.value.
  txSteps.push({
    index: txSteps.length + 1,
    action: 'BRIDGE_OUT',
    to: BRIDGE_ADDRESS,
    description: `Bridge out ${amount} to ${chainName} (${recipient})`,
    data: bridgeCalldata,
    value: '0',
  });

  const txValue = '0';

  const serializedData = JSON.stringify({
    to: BRIDGE_ADDRESS,
    data: bridgeCalldata,
    value: txValue,
    chainId: MEZO_CHAIN_ID,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
  });

  // Honest dry-run of approve → bridgeOut against live state.
  // Quote-only (zero-address) builds skip simulation and report an estimate.
  const shouldSimulate = senderAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
  let simulation: ExecuteSwapResult['simulation'] = {
    success: true,
    gasUsed: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    simulated: false,
  };
  if (!shouldSimulate) {
    // keep estimate as-is
  } else try {
    const sim = await simulateCalls(
      senderAddress,
      txSteps
        .filter((s) => s.data)
        .map((s) => ({ to: s.to as Address, data: s.data as `0x${string}`, value: BigInt(s.value || '0') }))
    );
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

  return {
    to: BRIDGE_ADDRESS,
    data: bridgeCalldata,
    value: txValue,
    gasLimit: RISK_THRESHOLDS.router.gasEstimateUnits.toString(),
    txSteps,
    ptbSteps: txSteps,
    transactionData: serializedData,
    transactionBytes: Buffer.from(serializedData).toString('base64'),
    simulation,
    routeSummary: {
      inputAmount: amount,
      inputToken: isNative ? 'BTC' : 'TOKEN',
      expectedOutput: amount,
      outputToken: `${chainName} Asset`,
      priceImpact: null,
    },
  };
}
