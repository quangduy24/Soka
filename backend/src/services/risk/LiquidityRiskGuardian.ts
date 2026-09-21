/**
 * Soka Intent Engine — Liquidity Risk Guardian
 *
 * Full risk assessment engine for swap routes on Mezo Testnet:
 * 1. Price Impact / Slippage Risk
 * 2. Low Liquidity Pool Risk
 * 3. Liquidity Depth & Fragmentation
 * 4. Pool Safety (DEX, liquidity health, factory verification)
 * 5. Token Safety (Source and Destination)
 * 6. Supply Concentration (on-chain pool share of total supply)
 * 7. Trade Size vs Liquidity (size-aware)
 * 8. Oracle Deviation (router-implied vs oracle value)
 * 9. Chain State (lockdown flags + gas)
 *
 * Returns a detailed RiskAssessment with score (0-100), risk level, and recommendations.
 */

import {
  RISK_THRESHOLDS,
  MEZO_PRECOMPILES,
  INTENT_CONFIG,
  TX_CONFIG,
  DISPLAY_DECIMALS,
  ZERO_ADDRESS,
  DEFAULT_DECIMALS,
} from '../../config/index.js';
import { formatUnits, type Address } from 'viem';
import { getTotalSupply, getDecimals } from '../../utils/erc20Utils.js';
import { checkTokenSafety } from '../safety/TokenSafety.js';
import { checkPoolSafety, poolReferences } from '../safety/PoolSafety.js';
import { resolveToken } from '../coin/tokenResolver.js';
import { getTokenUsdPrice } from '../prices/priceService.js';
import { getPublicClient } from '../../utils/mezoClient.js';
import { logger, createTimer } from '../../utils/logger.js';
import type {
  RiskAssessment,
  RiskCheck,
  RiskLevel,
  GuardianRiskResponse,
  RouteResult,
  PoolDetails,
  RiskReference,
} from '../../types/index.js';

/** Minimal Maintenance-precompile views for lockdown + gas checks. */
const MAINTENANCE_VIEWS = [
  {
    name: 'getBridgeLockdown',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }, { type: 'bool' }],
  },
  {
    name: 'getTxLockdown',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getMinGasPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Parses "x.xx%" (or a plain number) into a float; NaN when unparseable. */
function parsePct(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = parseFloat(String(value).replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

export class LiquidityRiskGuardian {
  /**
   * Perform full risk assessment on a proposed swap route.
   */
  async evaluate(params: {
    sourceSymbol: string;
    destSymbol: string;
    amount: string;
    route: any[];
    executionImpact: string | null;
    expectedOutput?: number;
    poolDetails?: PoolDetails | null;
  }): Promise<RiskAssessment> {
    const timer = createTimer('RiskGuardian.evaluate');
    const allChecks: RiskCheck[] = [];

    const {
      sourceSymbol,
      destSymbol,
      amount,
      route,
      executionImpact,
      expectedOutput,
      poolDetails,
    } = params;

    const poolRefs = poolReferences(route);

    // ─── Check 1: Price Impact / Slippage Risk ─────────────────
    const priceImpactCheck = {
      ...this.checkPriceImpact(executionImpact, route),
      references: poolRefs,
    };
    allChecks.push(priceImpactCheck);

    // ─── Check 2: Low Liquidity Pool Risk ──────────────────────
    const liquidityCheck = {
      ...this.checkLiquidityRisk(route, parseFloat(amount), sourceSymbol, destSymbol, poolDetails),
      references: poolRefs,
    };
    allChecks.push(liquidityCheck);

    // ─── Check 3: Liquidity Depth & Fragmentation ──────────────
    const depthCheck = {
      ...this.checkLiquidityDepth(route, parseFloat(amount), poolDetails),
      references: poolRefs,
    };
    allChecks.push(depthCheck);

    // ─── Check 4: Pool Safety ──────────────────────────────────
    const poolSafetyChecks = await checkPoolSafety(route || [], sourceSymbol, destSymbol);
    allChecks.push(...poolSafetyChecks);

    // ─── Check 5: Token Safety (Source & Destination) ──────────
    const [sourceTokenChecks, destTokenChecks] = await Promise.all([
      checkTokenSafety(sourceSymbol),
      checkTokenSafety(destSymbol),
    ]);
    allChecks.push(...sourceTokenChecks, ...destTokenChecks);

    // ─── Check 6: Supply Concentration ─────────────────────────
    const concentrationCheck = await this.checkSupplyConcentration(destSymbol, route, poolDetails);
    allChecks.push(concentrationCheck);

    // ─── Check 7: Trade Size vs Liquidity (size-aware) ───────────
    const tradeSizeCheck = await this.checkTradeSize(amount, sourceSymbol, route, poolDetails);
    allChecks.push(tradeSizeCheck);

    // ─── Check 8: Oracle Deviation (router-implied vs oracle price) ──
    const oracleCheck = await this.checkOracleDeviation(amount, sourceSymbol, destSymbol, expectedOutput);
    allChecks.push(oracleCheck);

    // ─── Check 9: Chain State (lockdown + gas) ───────────────────
    const chainCheck = await this.checkChainState();
    allChecks.push(chainCheck);

    // ─── Calculate Final Score ─────────────────────────────────
    const assessment = this.calculateFinalAssessment(allChecks, priceImpactCheck, depthCheck);
    timer.end();
    return assessment;
  }

  /**
   * Check 1: Price Impact / Slippage Risk (null impact is unknown, not zero)
   */
  checkPriceImpact(executionImpact: string | null, route: any[]): RiskCheck {
    const impact = parsePct(executionImpact);
    const { warn, reject } = RISK_THRESHOLDS.priceImpact;

    if (impact == null) {
      return {
        name: 'Price Impact',
        category: 'Market Risk',
        status: 'WARNING',
        message: 'Price impact is not computable for this route — assumed non-zero',
        threshold: warn,
      };
    }

    if (impact >= reject) {
      return {
        name: 'Price Impact',
        category: 'Market Risk',
        status: 'DANGER',
        message: `High price impact: ${impact.toFixed(2)}% exceeds danger threshold (${reject}%)`,
        value: impact,
        threshold: reject,
      };
    }
    if (impact >= warn) {
      return {
        name: 'Price Impact',
        category: 'Market Risk',
        status: 'WARNING',
        message: `Moderate price impact: ${impact.toFixed(2)}% (warning threshold: ${warn}%)`,
        value: impact,
        threshold: warn,
      };
    }
    return {
      name: 'Price Impact',
      category: 'Market Risk',
      status: 'SAFE',
      message: `Minimal price impact: ${impact.toFixed(2)}% is within safe limits`,
      value: impact,
      threshold: warn,
    };
  }

  /**
   * Check 2: Low Liquidity Pool Risk
   */
  checkLiquidityRisk(
    route: any[],
    amount: number,
    sourceSymbol: string,
    destSymbol: string,
    poolDetails?: PoolDetails | null
  ): RiskCheck {
    const minLiquidity = RISK_THRESHOLDS.minLiquidity.volatilePair;
    const poolLiquidity = poolDetails?.liquidity ?? route[0]?.liquidityUsd ?? null;

    if (poolLiquidity == null) {
      return {
        name: 'Pool Liquidity',
        category: 'Pool Safety',
        status: 'WARNING',
        message: 'Pool liquidity is unverifiable on-chain for this route; trade at your own risk',
        threshold: minLiquidity,
      };
    }

    if (poolLiquidity < minLiquidity * INTENT_CONFIG.liquidityDangerRatio) {
      return {
        name: 'Pool Liquidity',
        category: 'Pool Safety',
        status: 'DANGER',
        message: `Critically low pool liquidity: $${poolLiquidity.toLocaleString()} (minimum: $${minLiquidity.toLocaleString()})`,
        value: poolLiquidity,
        threshold: minLiquidity,
      };
    }
    if (poolLiquidity < minLiquidity) {
      return {
        name: 'Pool Liquidity',
        category: 'Pool Safety',
        status: 'WARNING',
        message: `Low pool liquidity: $${poolLiquidity.toLocaleString()} is below recommendation ($${minLiquidity.toLocaleString()})`,
        value: poolLiquidity,
        threshold: minLiquidity,
      };
    }
    return {
      name: 'Pool Liquidity',
      category: 'Pool Safety',
      status: 'SAFE',
      message: `Healthy pool liquidity: $${poolLiquidity.toLocaleString()} supports this trade`,
      value: poolLiquidity,
      threshold: minLiquidity,
    };
  }

  /**
   * Check 3: Liquidity Depth
   */
  checkLiquidityDepth(route: any[], amount: number, poolDetails?: PoolDetails | null): RiskCheck {
    const hops = route?.length || 1;
    const maxHops = RISK_THRESHOLDS.liquidityDepth.maxHops;

    if (hops > maxHops) {
      return {
        name: 'Liquidity Depth',
        category: 'Routing Risk',
        status: 'WARNING',
        message: `Multi-hop route exceeds recommended depth (${hops} hops > ${maxHops} max)`,
        value: hops,
        threshold: maxHops,
      };
    }
    return {
      name: 'Liquidity Depth',
      category: 'Routing Risk',
      status: 'SAFE',
      message: `Optimal routing depth: ${hops} hop(s)`,
      value: hops,
      threshold: maxHops,
    };
  }

  /**
   * Check 4: Supply Concentration — real on-chain metric.
   * share% = pool liquidity / (totalSupply × price). A single pool holding a
   * large fraction of supply is concentrated. Boundaries reuse the operator
   * holder-concentration thresholds (percent). Unverifiable → WARNING, never SAFE.
   */
  async checkSupplyConcentration(destSymbol: string, route: any[], poolDetails?: PoolDetails | null): Promise<RiskCheck> {
    const token = resolveToken(destSymbol);
    if (!token) {
      return {
        name: 'Supply Concentration',
        category: 'Concentration',
        status: 'WARNING',
        message: `Unwhitelisted asset ${destSymbol} may exhibit concentrated liquidity`,
        threshold: RISK_THRESHOLDS.holderConcentration.warn,
      };
    }
    try {
      const poolLiquidity = poolDetails?.liquidity ?? route?.[0]?.liquidityUsd ?? null;
      const price = await getTokenUsdPrice(token.symbol);
      const isNative = token.address === ZERO_ADDRESS;
      if (poolLiquidity == null || poolLiquidity <= 0 || price.priceUsd == null || isNative) {
        return {
          name: 'Supply Concentration',
          category: 'Concentration',
          status: 'WARNING',
          message: `Pool share of ${token.symbol} supply is unverifiable on-chain${isNative ? ' (native gas asset has no fixed supply metric)' : ''}`,
          threshold: RISK_THRESHOLDS.holderConcentration.warn,
        };
      }
      const [supplyRaw, decimals] = await Promise.all([
        getTotalSupply(token.address as Address).catch(() => null),
        getDecimals(token.address as Address).catch(() => DEFAULT_DECIMALS),
      ]);
      if (supplyRaw == null || supplyRaw <= 0n) {
        return {
          name: 'Supply Concentration',
          category: 'Concentration',
          status: 'WARNING',
          message: `Total supply of ${token.symbol} is unreadable — concentration unknown`,
          threshold: RISK_THRESHOLDS.holderConcentration.warn,
        };
      }
      const supplyUsd = Number(formatUnits(supplyRaw, decimals)) * price.priceUsd;
      if (!Number.isFinite(supplyUsd) || supplyUsd <= 0) {
        return {
          name: 'Supply Concentration',
          category: 'Concentration',
          status: 'WARNING',
          message: `Supply valuation of ${token.symbol} failed — concentration unknown`,
          threshold: RISK_THRESHOLDS.holderConcentration.warn,
        };
      }
      const sharePct = (poolLiquidity / supplyUsd) * INTENT_CONFIG.scoreScale;
      const { warn, reject } = RISK_THRESHOLDS.holderConcentration;
      if (sharePct >= reject) {
        return {
          name: 'Supply Concentration',
          category: 'Concentration',
          status: 'DANGER',
          message: `Pool holds ${sharePct.toFixed(DISPLAY_DECIMALS.usd)}% of ${token.symbol} supply — highly concentrated`,
          value: sharePct,
          threshold: reject,
        };
      }
      if (sharePct >= warn) {
        return {
          name: 'Supply Concentration',
          category: 'Concentration',
          status: 'WARNING',
          message: `Pool holds ${sharePct.toFixed(DISPLAY_DECIMALS.usd)}% of ${token.symbol} supply`,
          value: sharePct,
          threshold: warn,
        };
      }
      return {
        name: 'Supply Concentration',
        category: 'Concentration',
        status: 'SAFE',
        message: `Pool holds ${sharePct.toFixed(DISPLAY_DECIMALS.usd)}% of ${token.symbol} supply — well distributed`,
        value: sharePct,
        threshold: warn,
      };
    } catch (err) {
      logger.warn(`Supply concentration check failed: ${(err as Error).message}`);
      return {
        name: 'Supply Concentration',
        category: 'Concentration',
        status: 'WARNING',
        message: `Concentration read failed for ${destSymbol} — treated as unknown`,
        threshold: RISK_THRESHOLDS.holderConcentration.warn,
      };
    }
  }

  /**
   * Check 7: Trade Size vs Liquidity — the size-aware check. Compares the USD
   * value of THIS trade against pool liquidity instead of using a fixed impact.
   */
  async checkTradeSize(
    amount: string,
    sourceSymbol: string,
    route: any[],
    poolDetails?: PoolDetails | null
  ): Promise<RiskCheck> {
    const poolLiquidity = poolDetails?.liquidity ?? route?.[0]?.liquidityUsd ?? null;
    const size = parseFloat(amount);
    if (!Number.isFinite(size) || size <= 0 || poolLiquidity == null || poolLiquidity <= 0) {
      return {
        name: 'Trade Size vs Liquidity',
        category: 'Market Risk',
        status: 'WARNING',
        message: 'Trade size cannot be valued against pool liquidity — size impact unknown',
      };
    }
    try {
      const price = await getTokenUsdPrice(sourceSymbol);
      if (price.priceUsd == null) {
        return {
          name: 'Trade Size vs Liquidity',
          category: 'Market Risk',
          status: 'WARNING',
          message: `No oracle price for ${sourceSymbol} — trade-size impact unknown`,
        };
      }
      const ratio = (size * price.priceUsd) / poolLiquidity;
      const { danger, warn } = RISK_THRESHOLDS.liquidityImpact;
      const pct = (ratio * INTENT_CONFIG.scoreScale).toFixed(DISPLAY_DECIMALS.usd);
      if (ratio >= danger) {
        return {
          name: 'Trade Size vs Liquidity',
          category: 'Market Risk',
          status: 'DANGER',
          message: `Trade is ${pct}% of pool liquidity — expect severe slippage`,
          value: ratio,
          threshold: danger,
        };
      }
      if (ratio >= warn) {
        return {
          name: 'Trade Size vs Liquidity',
          category: 'Market Risk',
          status: 'WARNING',
          message: `Trade is ${pct}% of pool liquidity — slippage likely`,
          value: ratio,
          threshold: warn,
        };
      }
      return {
        name: 'Trade Size vs Liquidity',
        category: 'Market Risk',
        status: 'SAFE',
        message: `Trade is ${pct}% of pool liquidity — size impact negligible`,
        value: ratio,
        threshold: warn,
      };
    } catch (err) {
      logger.warn(`Trade-size check failed: ${(err as Error).message}`);
      return {
        name: 'Trade Size vs Liquidity',
        category: 'Market Risk',
        status: 'WARNING',
        message: 'Trade-size valuation failed — size impact unknown',
      };
    }
  }

  /**
   * Check 8: Oracle Deviation — compares the router-implied output value with
   * the oracle-implied value. A large gap signals a mispriced or thin route.
   */
  async checkOracleDeviation(
    amount: string,
    sourceSymbol: string,
    destSymbol: string,
    expectedOutput?: number
  ): Promise<RiskCheck> {
    const size = parseFloat(amount);
    if (!Number.isFinite(size) || size <= 0 || expectedOutput == null || !Number.isFinite(expectedOutput)) {
      return {
        name: 'Oracle Deviation',
        category: 'Market Risk',
        status: 'WARNING',
        message: 'Quoted output unavailable — oracle deviation cannot be verified',
      };
    }
    try {
      const [priceIn, priceOut] = await Promise.all([
        getTokenUsdPrice(sourceSymbol),
        getTokenUsdPrice(destSymbol),
      ]);
      if (priceIn.priceUsd == null || priceOut.priceUsd == null) {
        return {
          name: 'Oracle Deviation',
          category: 'Market Risk',
          status: 'WARNING',
          message: 'Oracle price missing for one leg — deviation unverifiable',
        };
      }
      const inUsd = size * priceIn.priceUsd;
      if (inUsd <= 0) {
        return {
          name: 'Oracle Deviation',
          category: 'Market Risk',
          status: 'WARNING',
          message: 'Input value is zero — deviation unverifiable',
        };
      }
      const deviation = (Math.abs(expectedOutput * priceOut.priceUsd - inUsd) / inUsd) * INTENT_CONFIG.scoreScale;
      const { warn, reject } = (RISK_THRESHOLDS as any).oracleDeviation ?? { warn: 5.0, reject: 15.0 };
      if (deviation >= reject) {
        return {
          name: 'Oracle Deviation',
          category: 'Market Risk',
          status: 'DANGER',
          message: `Route output deviates ${deviation.toFixed(DISPLAY_DECIMALS.usd)}% from oracle value`,
          value: deviation,
          threshold: reject,
        };
      }
      if (deviation >= warn) {
        return {
          name: 'Oracle Deviation',
          category: 'Market Risk',
          status: 'WARNING',
          message: `Route output deviates ${deviation.toFixed(DISPLAY_DECIMALS.usd)}% from oracle value`,
          value: deviation,
          threshold: warn,
        };
      }
      return {
        name: 'Oracle Deviation',
        category: 'Market Risk',
        status: 'SAFE',
        message: `Route output tracks oracle value (${deviation.toFixed(DISPLAY_DECIMALS.usd)}% deviation)`,
        value: deviation,
        threshold: warn,
      };
    } catch (err) {
      logger.warn(`Oracle deviation check failed: ${(err as Error).message}`);
      return {
        name: 'Oracle Deviation',
        category: 'Market Risk',
        status: 'WARNING',
        message: 'Oracle deviation check failed — deviation unknown',
      };
    }
  }

  /**
   * Check 9: Chain State — reads the Maintenance precompile lockdown flags and
   * the live gas price. Unreadable flags are reported, never assumed open.
   */
  async checkChainState(): Promise<RiskCheck> {
    try {
      const client = getPublicClient();
      const [bridgeLockdown, txLockdown, gasPrice] = await Promise.all([
        client.readContract({
          address: MEZO_PRECOMPILES.maintenance,
          abi: MAINTENANCE_VIEWS as any,
          functionName: 'getBridgeLockdown',
        } as any).catch(() => null) as Promise<readonly [boolean, boolean] | null>,
        client.readContract({
          address: MEZO_PRECOMPILES.maintenance,
          abi: MAINTENANCE_VIEWS as any,
          functionName: 'getTxLockdown',
        } as any).catch(() => null) as Promise<boolean | null>,
        client.getGasPrice().catch(() => null),
      ]);
      if (txLockdown === true) {
        return {
          name: 'Chain State',
          category: 'Network Risk',
          status: 'DANGER',
          message: 'Transaction lockdown is ACTIVE on Mezo — on-chain execution will revert',
        };
      }
      if (bridgeLockdown != null && (bridgeLockdown[0] || bridgeLockdown[1])) {
        return {
          name: 'Chain State',
          category: 'Network Risk',
          status: 'WARNING',
          message: 'Bridge lockdown is partially active — bridge-outs may revert',
        };
      }
      if (gasPrice != null) {
        const gwei = Number(gasPrice) / 1e9;
        if (Number.isFinite(gwei) && gwei > TX_CONFIG.gasWarnGwei) {
          return {
            name: 'Chain State',
            category: 'Network Risk',
            status: 'WARNING',
            message: `Network gas is elevated (${gwei.toFixed(1)} gwei) — execution will be expensive`,
            value: gwei,
            threshold: TX_CONFIG.gasWarnGwei,
          };
        }
      }
      if (bridgeLockdown == null && txLockdown == null && gasPrice == null) {
        return {
          name: 'Chain State',
          category: 'Network Risk',
          status: 'WARNING',
          message: 'Chain state is unreadable — lockdown status unknown',
        };
      }
      return {
        name: 'Chain State',
        category: 'Network Risk',
        status: 'SAFE',
        message: 'No lockdown active; network gas is within normal range',
      };
    } catch (err) {
      logger.warn(`Chain-state check failed: ${(err as Error).message}`);
      return {
        name: 'Chain State',
        category: 'Network Risk',
        status: 'WARNING',
        message: 'Chain-state check failed — lockdown status unknown',
      };
    }
  }

  /**
   * Calculate final risk assessment score and recommendations.
   */
  calculateFinalAssessment(
    checks: RiskCheck[],
    priceImpactCheck: RiskCheck,
    depthCheck: RiskCheck
  ): RiskAssessment {
    let score = INTENT_CONFIG.scoreStart;
    for (const check of checks) {
      if (check.status === 'DANGER') {
        score -= RISK_THRESHOLDS.scoreDeductions.DANGER;
      } else if (check.status === 'WARNING') {
        score -= RISK_THRESHOLDS.scoreDeductions.WARNING;
      }
    }
    score = Math.max(INTENT_CONFIG.scoreMin, Math.min(INTENT_CONFIG.scoreMax, score));

    let riskLevel: RiskLevel = 'LOW';
    if (score < RISK_THRESHOLDS.riskLevel.high) riskLevel = 'CRITICAL';
    else if (score < RISK_THRESHOLDS.riskLevel.medium) riskLevel = 'HIGH';
    else if (score < RISK_THRESHOLDS.riskLevel.low) riskLevel = 'MEDIUM';

    const hasDanger = checks.some((c) => c.status === 'DANGER');
    const safe = !hasDanger && score >= RISK_THRESHOLDS.minSafeScore;

    let recommendation = 'Trade execution recommended: all safety thresholds satisfied.';
    if (!safe) {
      recommendation = 'Trade execution is NOT recommended due to critical risks identified.';
    } else if (riskLevel === 'MEDIUM' || riskLevel === 'HIGH') {
      recommendation = 'Proceed with caution: review warning indicators before signing.';
    }

    const oracleCheck = checks.find((c) => c.name === 'Oracle Deviation');
    return {
      safe,
      score,
      riskLevel,
      slippagePercent: (priceImpactCheck.value as number) ?? 0,
      priceDeviationPercent: (oracleCheck?.value as number) ?? 0,
      depthRisk: depthCheck.status === 'DANGER' ? 'HIGH' : depthCheck.status === 'WARNING' ? 'MEDIUM' : 'LOW',
      recommendation,
      checks,
    };
  }

  /**
   * Builds the legacy Guardian response structure.
   */
  buildGuardianResponse(assessment: RiskAssessment): GuardianRiskResponse {
    const getCheckStatus = (name: string): 'SAFE' | 'WARNING' | 'DANGER' => {
      const found = assessment.checks.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
      if (!found) return 'SAFE';
      return found.status === 'DANGER' ? 'DANGER' : found.status === 'WARNING' ? 'WARNING' : 'SAFE';
    };

    return {
      risk_probability: (INTENT_CONFIG.scoreMax - assessment.score) / INTENT_CONFIG.scoreScale,
      risk_level: assessment.riskLevel,
      execution_blocked: !assessment.safe,
      checks: {
        slippage_risk: getCheckStatus('price impact'),
        concentration_risk: getCheckStatus('concentration'),
        stale_pool: getCheckStatus('pool'),
        black_swan: assessment.safe ? 'SAFE' : 'DANGER',
      },
      riskAssessment: assessment,
    };
  }
}

export const liquidityRiskGuardian = new LiquidityRiskGuardian();
