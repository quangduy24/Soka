/**
 * Soka Intent Engine — MUSD Discovery
 * Resolves the MUSD token address without hardcoding it.
 *
 * Sources (in order):
 * 1. MEZO_MUSD_ADDRESS env var (operator override, verified by symbol read).
 * 2. On-chain scan of known pools (MEZO_KNOWN_POOLS env, defaulting to the
 *    documented Mezo testnet pools): each candidate is verified with
 *    factory.isPool, then its legs are inspected for the MUSD symbol.
 * 3. Opportunistic registration when pool legs are read elsewhere.
 *
 * Only the MUSD symbol is ever registered here; arbitrary pool legs are
 * never promoted to verified tokens.
 */

import { isAddress, type Address, type Abi } from 'viem';
import { MEZO_SWAP_FACTORY } from '../../config/index.js';
import { readContract } from '../../utils/mezoClient.js';
import { getDecimals, getSymbol, getName } from '../../utils/erc20Utils.js';
import { resolveToken, registerDiscoveredToken } from '../coin/tokenResolver.js';
import { logger } from '../../utils/logger.js';
import rawFactoryAbi from '../../abi/mezoSwapFactory.json' with { type: 'json' };
import rawPairAbi from '../../abi/mezoSwapPair.json' with { type: 'json' };

const factoryAbi = rawFactoryAbi as unknown as Abi;
const pairAbi = rawPairAbi as unknown as Abi;

function knownPoolCandidates(): Address[] {
  const fromEnv = (process.env.MEZO_KNOWN_POOLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => isAddress(s)) as Address[];
  if (fromEnv.length > 0) return fromEnv;
  // Documented Mezo testnet basic pools (https://mezo.org/docs/developers/features/mezo-pools/).
  // Every entry is verified with factory.isPool before use.
  return [
    '0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9',
    '0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e',
    '0x27414B76CF00E24ed087adb56E26bAeEEe93494e',
  ] as Address[];
}

async function registerMusd(address: Address): Promise<boolean> {
  try {
    const [symbol, decimals] = await Promise.all([
      getSymbol(address),
      getDecimals(address),
    ]);
    if (symbol.toUpperCase() !== 'MUSD') return false;
    registerDiscoveredToken({
      symbol: 'MUSD',
      name: await getName(address).catch(() => 'Mezo USD'),
      address,
      decimals,
      isStable: true,
      aliases: ['musd'],
    });
    return true;
  } catch {
    return false;
  }
}

/** Registers a pool leg as MUSD when its on-chain symbol matches. Best-effort. */
export async function noteMusdLeg(address: Address, symbol: string, decimals: number): Promise<void> {
  if (symbol.toUpperCase() !== 'MUSD' || resolveToken('MUSD')) return;
  try {
    registerDiscoveredToken({
      symbol: 'MUSD',
      name: await getName(address).catch(() => 'Mezo USD'),
      address,
      decimals,
      isStable: true,
      aliases: ['musd'],
    });
  } catch {
    // Best-effort only.
  }
}

/**
 * Ensures MUSD is resolvable via env override or on-chain pool scan.
 * No-op when already known. Never throws.
 */
export async function ensureMusdRegistered(): Promise<void> {
  if (resolveToken('MUSD')) return;

  const envAddr = (process.env.MEZO_MUSD_ADDRESS || '').trim();
  if (envAddr && isAddress(envAddr)) {
    if (await registerMusd(envAddr as Address)) return;
    logger.warn('MEZO_MUSD_ADDRESS did not resolve to the MUSD token; falling back to pool scan');
  }

  for (const pool of knownPoolCandidates()) {
    try {
      const isPool = await readContract<boolean>({
        address: MEZO_SWAP_FACTORY,
        abi: factoryAbi,
        functionName: 'isPool',
        args: [pool],
      }).catch(() => false);
      if (!isPool) continue;
      const [token0, token1] = await Promise.all([
        readContract<Address>({ address: pool, abi: pairAbi, functionName: 'token0' }),
        readContract<Address>({ address: pool, abi: pairAbi, functionName: 'token1' }),
      ]);
      if ((await registerMusd(token0)) || (await registerMusd(token1))) return;
    } catch (err) {
      logger.warn(`MUSD scan failed for pool ${pool}: ${(err as Error).message}`);
    }
  }
}
