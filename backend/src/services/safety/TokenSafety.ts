/**
 * Soka Intent Engine — Token Safety Service
 * Evaluates token safety on Mezo Testnet: whitelist verification, contract bytecode
 * checks, and risk references for the Risk Guardian.
 */

import type { Address } from 'viem';
import { resolveToken, isWhitelistedToken, resolveTokenAddress } from '../coin/tokenResolver.js';
import { getPublicClient } from '../../utils/mezoClient.js';
import { ZERO_ADDRESS, MEZO_EXPLORER_URL } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { RiskCheck, RiskReference } from '../../types/index.js';

/**
 * Runs token safety checks for a given token symbol or address on Mezo Testnet.
 */
export async function checkTokenSafety(symbolOrAddress: string): Promise<RiskCheck[]> {
  const checks: RiskCheck[] = [];
  const token = resolveToken(symbolOrAddress);
  const address = resolveTokenAddress(symbolOrAddress);

  const isNativeBtc =
    symbolOrAddress.toUpperCase() === 'BTC' ||
    address.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  // Native BTC is the layer-1 gas token on Mezo and is intrinsically safe
  if (isNativeBtc) {
    checks.push({
      name: 'Token Whitelist',
      category: 'Token Safety',
      status: 'SAFE',
      message: 'Native Bitcoin (BTC) is the layer-1 gas token on Mezo',
      value: 100,
      references: [
        {
          label: 'Native BTC',
          type: 'token',
          value: 'Native Gas Currency',
        },
      ],
    });
    return checks;
  }

  const tokenRef: RiskReference[] = [
    {
      label: `${token?.symbol || symbolOrAddress} contract`,
      type: 'contract',
      value: address,
    },
  ];

  // Check 1: Whitelist Status
  const whitelisted = isWhitelistedToken(symbolOrAddress);
  checks.push({
    name: 'Token Whitelist',
    category: 'Token Safety',
    status: whitelisted ? 'SAFE' : 'WARNING',
    message: whitelisted
      ? `${token?.symbol || symbolOrAddress} is a verified whitelisted Mezo token`
      : `${symbolOrAddress} is not in the verified Mezo whitelist — exercise caution`,
    value: whitelisted ? 100 : 40,
    references: tokenRef,
  });

  if (whitelisted) {
    checks.push({
      name: 'Holder Distribution',
      category: 'Concentration',
      status: 'SAFE',
      message: `${token?.symbol} has verified bridge/precompile backing with low concentration risk`,
      value: 90,
      references: tokenRef,
    });
    return checks;
  }

  // Check 2: On-chain Bytecode Verification for non-whitelisted contracts
  try {
    const client = getPublicClient();
    const bytecode = await client.getBytecode({ address: address as Address });

    if (!bytecode || bytecode === '0x') {
      checks.push({
        name: 'Contract Verification',
        category: 'Token Safety',
        status: 'DANGER',
        message: `No contract bytecode found at address ${address} on Mezo Testnet`,
        value: 0,
        references: tokenRef,
      });
    } else {
      checks.push({
        name: 'Contract Verification',
        category: 'Token Safety',
        status: 'WARNING',
        message: `Smart contract deployed on Mezo Testnet (${bytecode.length / 2} bytes), but unverified`,
        value: 50,
        references: tokenRef,
      });
    }
  } catch (err) {
    logger.warn(`Could not fetch contract bytecode for ${address}: ${(err as Error).message}`);
    checks.push({
      name: 'Contract Verification',
      category: 'Token Safety',
      status: 'WARNING',
      message: 'Could not query contract bytecode from Mezo RPC',
      value: 40,
      references: tokenRef,
    });
  }

  return checks;
}
