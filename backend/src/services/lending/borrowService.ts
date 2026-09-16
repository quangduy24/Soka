/**
 * Soka Intent Engine — Borrow Quote Service
 * Real-data borrow preview on Mezo Testnet with no hardcoded prices.
 *
 * Real inputs (on-chain):
 * - Collateral balance and USD value: wallet balances + PriceOracle / router quotes
 * - Debt asset USD value: same price service
 *
 * Operator-configured risk parameters (env, see config LENDING_CONFIG):
 * - BORROW_MAX_LTV / BORROW_LIQ_LTV / BORROW_APR_<SYMBOL> / BORROW_APR_DEFAULT
 *
 * Execution is NOT offered: no lending pool contract exists in the Mezo chain
 * client (mezod). When LENDING_POOL_ADDRESS is configured AND a matching
 * contract ABI is bundled, this service can be extended to build unsigned
 * transactions; until then quotes are read-only advisories.
 */

import { isAddress } from 'viem';
import { LENDING_CONFIG } from '../../config/index.js';
import { getFormattedBalance } from '../coin/coinService.js';
import { getTokenUsdPrice } from '../prices/priceService.js';
import { resolveToken } from '../coin/tokenResolver.js';

export interface BorrowQuote {
  collateralSymbol: string;
  collateralAmount: string;
  collateralBalance: string;
  collateralPriceUsd: number | null;
  collateralValueUsd: number | null;
  debtSymbol: string;
  debtPriceUsd: number | null;
  maxBorrowAmount: string | null;
  maxLtv: number;
  liquidationLtv: number;
  /** Collateral price at which the position hits the liquidation threshold */
  liquidationPriceUsd: number | null;
  aprPct: number | null;
  executable: false;
  executionReason: string;
}

function toPositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Builds a read-only borrow quote from real balances and on-chain prices.
 */
export async function getBorrowQuote(params: {
  walletAddress?: string;
  collateralSymbol: string;
  collateralAmount: string;
  debtSymbol: string;
}): Promise<BorrowQuote> {
  const { walletAddress, collateralSymbol, debtSymbol } = params;
  const collateralAmount = toPositiveNumber(params.collateralAmount);
  if (!collateralAmount) throw new Error('collateralAmount must be a positive number');

  const collateralToken = resolveToken(collateralSymbol);
  const debtToken = resolveToken(debtSymbol);
  if (!collateralToken) throw new Error(`Unknown collateral token: ${collateralSymbol}`);
  if (!debtToken) throw new Error(`Unknown debt token: ${debtSymbol}`);

  const [collateralPrice, debtPrice, collateralBalance] = await Promise.all([
    getTokenUsdPrice(collateralToken.symbol),
    getTokenUsdPrice(debtToken.symbol),
    walletAddress && isAddress(walletAddress)
      ? getFormattedBalance(walletAddress, collateralToken.symbol)
      : Promise.resolve('0'),
  ]);

  const collateralValueUsd =
    collateralPrice.priceUsd != null ? collateralAmount * collateralPrice.priceUsd : null;

  const maxBorrowAmount =
    collateralValueUsd != null && debtPrice.priceUsd != null && debtPrice.priceUsd > 0
      ? (collateralValueUsd * LENDING_CONFIG.maxLtv) / debtPrice.priceUsd
      : null;

  const liquidationPriceUsd =
    collateralValueUsd != null && maxBorrowAmount != null && debtPrice.priceUsd != null
      ? (maxBorrowAmount * debtPrice.priceUsd) / (collateralAmount * LENDING_CONFIG.liquidationLtv)
      : null;

  return {
    collateralSymbol: collateralToken.symbol,
    collateralAmount: String(collateralAmount),
    collateralBalance,
    collateralPriceUsd: collateralPrice.priceUsd,
    collateralValueUsd,
    debtSymbol: debtToken.symbol,
    debtPriceUsd: debtPrice.priceUsd,
    maxBorrowAmount: maxBorrowAmount != null && Number.isFinite(maxBorrowAmount) ? maxBorrowAmount.toFixed(6) : null,
    maxLtv: LENDING_CONFIG.maxLtv,
    liquidationLtv: LENDING_CONFIG.liquidationLtv,
    liquidationPriceUsd:
      liquidationPriceUsd != null && Number.isFinite(liquidationPriceUsd) ? liquidationPriceUsd : null,
    aprPct: LENDING_CONFIG.aprForSymbol(debtToken.symbol),
    executable: false,
    executionReason:
      'Borrow execution is unavailable: no lending pool contract exists in the Mezo chain client. ' +
      'Configure LENDING_POOL_ADDRESS with a matching contract ABI to enable on-chain execution.',
  };
}
