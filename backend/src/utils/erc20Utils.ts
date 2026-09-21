/**
 * Soka Intent Engine — ERC-20 Utilities
 * Helper functions for ERC-20 token balance queries, allowances, metadata,
 * and approval transaction construction on Mezo Testnet.
 */

import { encodeFunctionData, parseAbi, type Address, type Abi } from 'viem';
import { readContract } from './mezoClient.js';
import rawErc20Abi from '../abi/erc20.json' with { type: 'json' };

const erc20Abi = rawErc20Abi as unknown as Abi;

// In-memory caches to avoid redundant RPC calls
const decimalsCache = new Map<string, number>();
const symbolCache = new Map<string, string>();
const nameCache = new Map<string, string>();

/**
 * Fetch ERC-20 token balance for a specific wallet address.
 */
export async function getBalanceOf(
  tokenAddress: Address,
  account: Address
): Promise<bigint> {
  return readContract<bigint>({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  });
}

/**
 * Fetch ERC-20 total supply (for concentration metrics).
 */
export async function getTotalSupply(tokenAddress: Address): Promise<bigint> {
  return readContract<bigint>({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'totalSupply',
  });
}

/**
 * Fetch ERC-20 token allowance.
 */
export async function getAllowance(
  tokenAddress: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  return readContract<bigint>({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });
}

/**
 * Fetch token decimals with in-memory caching.
 */
export async function getDecimals(tokenAddress: Address): Promise<number> {
  const normalized = tokenAddress.toLowerCase();
  if (decimalsCache.has(normalized)) {
    return decimalsCache.get(normalized)!;
  }

  const decimals = await readContract<number>({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const parsed = Number(decimals);
  decimalsCache.set(normalized, parsed);
  return parsed;
}

/**
 * Fetch token symbol with in-memory caching.
 */
export async function getSymbol(tokenAddress: Address): Promise<string> {
  const normalized = tokenAddress.toLowerCase();
  if (symbolCache.has(normalized)) {
    return symbolCache.get(normalized)!;
  }

  const symbol = await readContract<string>({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'symbol',
  });

  symbolCache.set(normalized, symbol);
  return symbol;
}

/**
 * Fetch token name with in-memory caching.
 */
export async function getName(tokenAddress: Address): Promise<string> {
  const normalized = tokenAddress.toLowerCase();
  if (nameCache.has(normalized)) {
    return nameCache.get(normalized)!;
  }

  const name = await readContract<string>({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'name',
  });

  nameCache.set(normalized, name);
  return name;
}

/**
 * Construct unsigned transaction calldata to approve a spender for an ERC-20 token.
 */
export function buildApproveTx(
  tokenAddress: Address,
  spender: Address,
  amount: bigint
): { to: Address; data: `0x${string}`; value: bigint } {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  });

  return {
    to: tokenAddress,
    data,
    value: 0n,
  };
}
