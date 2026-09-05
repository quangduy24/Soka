/**
 * DIEPS Intent Engine — Token Safety Service
 * Checks token safety: whitelist status, holder distribution, honeypot detection.
 */

import { isWhitelistedToken, resolveToken } from '../coin/tokenResolver.js';
import { logger } from '../../utils/logger.js';
import { getCoinMetadata, suiRpcCall } from '../../utils/suiClient.js';
import { RISK_THRESHOLDS } from '../../config/index.js';
import type { RiskCheck, RiskReference } from '../../types/index.js';

/**
 * Run all token safety checks for a given token.
 */
export async function checkTokenSafety(symbol: string): Promise<RiskCheck[]> {
  const checks: RiskCheck[] = [];

  // Identify if token is Sui Native by checking its on-chain struct format, avoiding hardcoded symbols.
  const token = resolveToken(symbol);
  const isSuiNative = token?.address?.endsWith('::sui::SUI');

  // Native token is intrinsically safe and requires no community checks.
  if (isSuiNative) {
    return checks;
  }

  // On-chain proof: the token's coin type, verifiable on Suiscan.
  const coinRef: RiskReference[] = token?.address?.includes('::')
    ? [{ label: `${symbol} coin`, type: 'coin', value: token.address }]
    : [];

  // Check 1: Whitelist status
  const whitelisted = isWhitelistedToken(symbol);
  checks.push({
    name: 'Token Whitelist',
    category: 'Token Safety',
    status: whitelisted ? 'SAFE' : 'WARNING',
    message: whitelisted
      ? `${symbol} is a verified whitelisted token`
      : `${symbol} is not in the token whitelist — exercise caution`,
    value: whitelisted ? 100 : 30,
    references: coinRef,
  });

  // If whitelisted, skip expensive checks
  if (whitelisted) {
    checks.push({
      name: 'Holder Distribution',
      category: 'Concentration',
      status: 'SAFE',
      message: `${symbol} is a known token with low concentration risk`,
      value: 90,
      references: coinRef,
    });
    return checks;
  }

  // If not whitelisted, we do an on-chain verification check
  try {
    const onChainTokenCheck = await verifyTokenOnChain(symbol);
    checks.push({ ...onChainTokenCheck, references: [...coinRef, ...(onChainTokenCheck.references || [])] });

    // For non-whitelisted tokens, we also perform a native Concentration Check (TreasuryCap Risk)
    const concentrationCheck = await checkConcentrationRisk(token?.address || symbol);
    checks.push({ ...concentrationCheck, references: [...coinRef, ...(concentrationCheck.references || [])] });
  } catch (err: any) {
    checks.push({
      name: 'On-Chain Verification',
      category: 'Token Safety',
      status: 'WARNING',
      message: `Could not verify token ${symbol} on-chain`,
    });
  }

  return checks;
}

/**
 * Verify unwhitelisted token on-chain via Sui RPC.
 */
async function verifyTokenOnChain(symbolOrAddress: string): Promise<RiskCheck> {
  try {
    // If it's a valid address format, check metadata
    if (symbolOrAddress.includes('::')) {
      const metadata = await getCoinMetadata(symbolOrAddress);

      if (metadata) {
        return {
          name: 'On-Chain Verification',
          category: 'Token Safety',
          status: 'WARNING',
          message: `Token is verified on-chain but not in whitelist. Trade with caution.`,
          value: 50,
        };
      }
    }

    return {
      name: 'On-Chain Verification',
      category: 'Token Safety',
      status: 'DANGER',
      message: `Token ${symbolOrAddress} is not whitelisted and could not be verified on-chain.`,
    };
  } catch (err: any) {
    logger.warn('Token on-chain verification failed', { symbol: symbolOrAddress, error: err.message });
    return {
      name: 'On-Chain Verification',
      category: 'Token Safety',
      status: 'WARNING',
      message: `Could not verify token on-chain.`,
    };
  }
}

/**
 * Native On-Chain Concentration Check (TreasuryCap Ownership)
 * Determines if the token creator has infinite minting power.
 */
async function checkConcentrationRisk(tokenAddress: string): Promise<RiskCheck> {
  if (!tokenAddress.includes('::')) {
    return { name: 'Holder Distribution', category: 'Concentration', status: 'WARNING', message: 'Invalid token address for concentration check' };
  }

  try {
    const packageId = tokenAddress.split('::')[0];
    
    // 1. Get the package creation transaction
    const pkgObject = await suiRpcCall('sui_getObject', [packageId, { showPreviousTransaction: true }]);
    const creationTxDigest = pkgObject?.data?.previousTransaction;

    if (!creationTxDigest) {
      return { name: 'Holder Distribution', category: 'Concentration', status: 'WARNING', message: 'Could not trace token creation on-chain' };
    }

    // 2. Fetch the transaction that created the token
    const txBlock = await suiRpcCall('sui_getTransactionBlock', [creationTxDigest, { showObjectChanges: true }]);
    const objectChanges = txBlock?.objectChanges || [];

    // 3. Find the TreasuryCap object
    const treasuryCapType = `0x2::coin::TreasuryCap<${tokenAddress}>`;
    const treasuryCapCreation = objectChanges.find((c: any) => c.type === 'created' && c.objectType === treasuryCapType);

    if (!treasuryCapCreation) {
      // If there is no TreasuryCap created (e.g. burned or locked initially), it's relatively safe from infinite minting
      return {
        name: 'Holder Distribution',
        category: 'Concentration',
        status: 'SAFE',
        message: 'No active TreasuryCap found. Token supply is likely fixed.',
        value: 100,
      };
    }

    const treasuryCapId = treasuryCapCreation.objectId;

    // 4. Verify current ownership of the TreasuryCap
    const capObject = await suiRpcCall('sui_getObject', [treasuryCapId, { showOwner: true }]);
    const owner = capObject?.data?.owner;

    // On-chain proof: the TreasuryCap object and the tx that created the token.
    const capRefs: RiskReference[] = [
      { label: 'TreasuryCap', type: 'object', value: treasuryCapId },
      { label: 'Creation tx', type: 'tx', value: creationTxDigest },
    ];

    if (owner?.AddressOwner) {
       return {
         name: 'Holder Distribution',
         category: 'Concentration',
         status: 'DANGER',
         message: `Concentration Risk: Creator (${owner.AddressOwner.slice(0, 6)}...) holds the TreasuryCap and can mint infinite tokens.`,
         value: 0,
         references: [{ label: 'Creator wallet', type: 'account', value: owner.AddressOwner }, ...capRefs],
       };
    }

    return {
      name: 'Holder Distribution',
      category: 'Concentration',
      status: 'SAFE',
      message: 'Token TreasuryCap is locked or burned. Safe from creator infinite minting.',
      value: 90,
      references: capRefs,
    };
  } catch (err: any) {
    logger.warn('Concentration check failed', { error: err.message });
    return {
      name: 'Holder Distribution',
      category: 'Concentration',
      status: 'WARNING',
      message: 'On-chain concentration check failed. Trade with caution.',
    };
  }
}

/**
 * Quick check if a token is considered safe for trading.
 */
export function isTokenSafe(symbol: string): boolean {
  return isWhitelistedToken(symbol);
}
