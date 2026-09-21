/**
 * Soka Intent Engine — Token Safety Service
 * Evaluates token safety on Mezo Testnet: whitelist verification, contract bytecode
 * checks, and risk references for the Risk Guardian.
 */

import type { Address } from 'viem';
import { resolveToken, isWhitelistedToken, resolveTokenAddress } from '../coin/tokenResolver.js';
import { getPublicClient } from '../../utils/mezoClient.js';
import { ZERO_ADDRESS, HEX_BYTE_DIVISOR } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { RiskCheck, RiskReference } from '../../types/index.js';

/** Display scores for token-safety outcomes (operator-visible, not thresholds). */
const TOKEN_SAFETY_SCORES = {
  native: 100,
  whitelisted: 100,
  unverified: 40,
  holderVerified: 90,
  noBytecode: 0,
  hasBytecodeUnverified: 50,
  rpcFailure: 40,
} as const;

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
      value: TOKEN_SAFETY_SCORES.native,
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
    value: whitelisted ? TOKEN_SAFETY_SCORES.whitelisted : TOKEN_SAFETY_SCORES.unverified,
    references: tokenRef,
  });

  if (whitelisted) {
    checks.push({
      name: 'Holder Distribution',
      category: 'Concentration',
      status: 'SAFE',
      message: `${token?.symbol} has verified bridge/precompile backing with low concentration risk`,
      value: TOKEN_SAFETY_SCORES.holderVerified,
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
        value: TOKEN_SAFETY_SCORES.noBytecode,
        references: tokenRef,
      });
    } else {
      checks.push({
        name: 'Contract Verification',
        category: 'Token Safety',
        status: 'WARNING',
        message: `Smart contract deployed on Mezo Testnet (${bytecode.length / HEX_BYTE_DIVISOR} bytes), but unverified`,
        value: TOKEN_SAFETY_SCORES.hasBytecodeUnverified,
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
        value: TOKEN_SAFETY_SCORES.rpcFailure,
      references: tokenRef,
    });
  }

  return checks;
}
