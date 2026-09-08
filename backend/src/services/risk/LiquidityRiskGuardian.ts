/**
 * DIEPS Intent Engine — Liquidity Risk Guardian
 * 
 * Full 6-check risk assessment engine for swap routes:
 * 1. Price Impact / Slippage Risk
 * 2. Low Liquidity Pool Risk
 * 3. Price Discrepancy / Oracle Deviation
 * 4. Liquidity Fragmentation & Depth Risk
 * 5. Pool Safety Check
 * 6. Token Safety
 * 
 * Each route returns a detailed RiskAssessment with score (0-100),
 * risk level, and actionable recommendation.
 */

import { RISK_THRESHOLDS } from '../../config/index.js';
import { checkTokenSafety } from '../safety/TokenSafety.js';
import { checkPoolSafety, poolReferences } from '../safety/PoolSafety.js';
import { isStablePair, resolveTokenAddress, getTokenDecimals, isWhitelistedToken } from '../coin/tokenResolver.js';
import { getUsdPriceOnChain } from '../router/cetusRouter.js';
import { suiRpcCall } from '../../utils/suiClient.js';
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

/**
 * LiquidityRiskGuardian — Main risk assessment class.
 * Evaluates a proposed swap route across 6 dimensions.
 */
export class LiquidityRiskGuardian {

  /**
   * Perform full risk assessment on a proposed swap route.
   */
  async evaluate(params: {
    sourceSymbol: string;
    destSymbol: string;
    amount: string;
    route: any[];
    executionImpact: string;
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

    // On-chain proof references for pool-scoped checks.
    const poolRefs = poolReferences(route);

    // ─── Check 1: Price Impact / Slippage Risk ───────────────
    const priceImpactCheck = { ...this.checkPriceImpact(executionImpact, route), references: poolRefs };
    allChecks.push(priceImpactCheck);

    // ─── Check 2: Low Liquidity Pool Risk ────────────────────
    const liquidityCheck = {
      ...(await this.checkLiquidityRisk(route, parseFloat(amount), sourceSymbol, destSymbol, poolDetails)),
      references: poolRefs,
    };
    allChecks.push(liquidityCheck);



    // ─── Check 4: Liquidity Depth / Fragmentation ────────────
    const depthCheck = { ...this.checkLiquidityDepth(route, parseFloat(amount), poolDetails), references: poolRefs };
    allChecks.push(depthCheck);

    // ─── Check 5: Pool Safety ────────────────────────────────
    const poolSafetyChecks = await checkPoolSafety(route || [], sourceSymbol, destSymbol);
    allChecks.push(...poolSafetyChecks);

    // ─── Check 6: Token Safety ───────────────────────────────
    const [sourceTokenChecks, destTokenChecks] = await Promise.all([
      checkTokenSafety(sourceSymbol),
      checkTokenSafety(destSymbol),
    ]);
    allChecks.push(...sourceTokenChecks, ...destTokenChecks);

    // ─── Check 7: Supply Concentration (On-chain native ratio) ─────
    const concentrationCheck = await this.checkSupplyConcentration(destSymbol, route);
    allChecks.push(concentrationCheck);

    // ─── Calculate Final Score ───────────────────────────────
    const assessment = this.calculateFinalAssessment(allChecks, priceImpactCheck, depthCheck);

    timer.end({
      score: assessment.score,
      riskLevel: assessment.riskLevel,
      safe: assessment.safe,
    });

    return assessment;
  }

  /**
   * Convert detailed RiskAssessment to frontend-compatible GuardianRiskResponse.
   */
  toFrontendResponse(assessment: RiskAssessment): GuardianRiskResponse {
    // Map risk level to posterior probability (Bayesian-style)
    let risk_probability: number;
    switch (assessment.riskLevel) {
      case 'LOW':      risk_probability = 0.05; break;
      case 'MEDIUM':   risk_probability = 0.25; break;
      case 'HIGH':     risk_probability = 0.55; break;
      case 'CRITICAL': risk_probability = 0.85; break;
      default:         risk_probability = 0.05;
    }

    // Map individual checks to frontend format
    const getCheckStatus = (names: string[]): 'SAFE' | 'WARNING' | 'DANGER' => {
      const relevant = assessment.checks.filter(c => names.some(n => c.name.includes(n)));
      if (relevant.some(c => c.status === 'DANGER')) return 'DANGER';
      if (relevant.some(c => c.status === 'WARNING')) return 'WARNING';
      return 'SAFE';
    };

    return {
      risk_probability,
      risk_level: assessment.riskLevel,
      execution_blocked: !assessment.safe,
      checks: {
        slippage_risk: getCheckStatus(['Price Impact', 'Slippage']),
        concentration_risk: getCheckStatus(['Holder', 'Token']),
        stale_pool: getCheckStatus(['Pool Age', 'Pool', 'DEX']),
        black_swan: getCheckStatus(['Oracle', 'Depth', 'Liquidity']),
      },
      riskAssessment: assessment,
    };
  }

  // ─── Individual Risk Checks ─────────────────────────────────

  /**
   * Check 1: Price Impact / Slippage Risk
   * Calculates the % price impact and warns if above thresholds.
   */
  private checkPriceImpact(executionImpact: string, route: any[]): RiskCheck {
    // Parse impact from string (e.g., "0.05%", "1.2%")
    const impactStr = String(executionImpact || '0').replace('%', '');
    const impactPercent = parseFloat(impactStr) || 0;

    // Also calculate from route fees
    const totalFee = route.reduce((sum, node) => sum + (node.fee || 0), 0);
    const effectiveImpact = Math.max(impactPercent, totalFee * 0.5);

    const { warn, recommendSplit, reject } = RISK_THRESHOLDS.priceImpact;

    if (effectiveImpact >= reject) {
      return {
        name: 'Price Impact',
        category: 'High Slippage',
        status: 'DANGER',
        message: `Price impact is ${effectiveImpact.toFixed(2)}% — exceeds ${reject}% threshold. Consider splitting your order or reducing trade size.`,
        value: effectiveImpact,
        threshold: reject,
      };
    }

    if (effectiveImpact >= recommendSplit) {
      return {
        name: 'Price Impact',
        category: 'High Slippage',
        status: 'WARNING',
        message: `Price impact is ${effectiveImpact.toFixed(2)}% — recommend splitting into multiple smaller orders.`,
        value: effectiveImpact,
        threshold: recommendSplit,
      };
    }

    if (effectiveImpact >= warn) {
      return {
        name: 'Price Impact',
        category: 'High Slippage',
        status: 'WARNING',
        message: `Price impact is ${effectiveImpact.toFixed(2)}% — moderate. Monitor execution carefully.`,
        value: effectiveImpact,
        threshold: warn,
      };
    }

    return {
      name: 'Price Impact',
      category: 'High Slippage',
      status: 'SAFE',
      message: `Price impact is ${effectiveImpact.toFixed(2)}% — within acceptable range.`,
      value: effectiveImpact,
      threshold: warn,
    };
  }

  /**
   * Check 2: Low Liquidity Pool Risk
   * Checks if pool liquidity is sufficient for the trade size.
   */
  private async checkLiquidityRisk(
    route: any[],
    amount: number,
    sourceSymbol: string,
    destSymbol: string,
    poolDetails?: PoolDetails | null
  ): Promise<RiskCheck> {
    const isStable = isStablePair(sourceSymbol, destSymbol);
    const minLiquidity = isStable
      ? RISK_THRESHOLDS.minLiquidity.stablePair
      : RISK_THRESHOLDS.minLiquidity.volatilePair;

    // Sum liquidity from route nodes or pool details
    const poolLiquidityUsd = route.length > 0 
      ? route.reduce((sum, node) => sum + (node.liquidityUsd || 0), 0)
      : 0;

    const poolLiquidity = poolDetails?.liquidity || poolLiquidityUsd;

    if (poolLiquidity === 0) {
      return {
        name: 'Liquidity Risk',
        category: 'High Slippage',
        status: 'WARNING',
        message: 'Pool liquidity data unavailable — cannot assess depth risk',
      };
    }

    // Convert trade amount to USD.
    // `amount` is already human-readable (e.g. 1000 SUI), so it must NOT be
    // divided by 10^decimals again — doing so collapsed tradeUsdValue to ~0
    // and made this liquidity check never fire.
    const sourceAddress = await resolveTokenAddress(sourceSymbol);
    const tokenPrice = await getUsdPriceOnChain(sourceAddress);

    // If the price oracle returns 0 (Cetus API down, no route to USDC, network
    // error), tradeUsdValue collapses to 0 and impactRatio becomes 0, which
    // silently passes as SAFE. Guard against this explicitly.
    if (tokenPrice <= 0) {
      return {
        name: 'Liquidity Risk',
        category: 'High Slippage',
        status: 'WARNING',
        message: 'Could not fetch on-chain token price — liquidity risk assessment unreliable. Proceed with caution.',
      };
    }

    const tradeUsdValue = amount * tokenPrice;

    // Token depth is roughly half of the TVL
    const tokenDepthUsd = poolLiquidity / 2;

    // Calculate Trade Impact Ratio
    const impactRatio = tradeUsdValue / tokenDepthUsd;

    const { danger: impactDanger, warn: impactWarn } = RISK_THRESHOLDS.liquidityImpact;

    if (impactRatio > impactDanger) {
      return {
        name: 'Liquidity Risk',
        category: 'High Slippage',
        status: 'DANGER',
        message: `Trade size ($${Math.round(tradeUsdValue).toLocaleString()}) exceeds ${Math.round(impactDanger * 100)}% of available token liquidity ($${Math.round(tokenDepthUsd).toLocaleString()}). Extreme risk of slippage.`,
        value: impactRatio,
        threshold: impactDanger,
      };
    }

    if (impactRatio > impactWarn) {
      return {
        name: 'Liquidity Risk',
        category: 'High Slippage',
        status: 'WARNING',
        message: `Trade size is ${Math.round(impactRatio * 100)}% of token liquidity. High slippage expected.`,
        value: impactRatio,
        threshold: impactWarn,
      };
    }

    return {
      name: 'Liquidity Risk',
      category: 'High Slippage',
      status: 'SAFE',
      message: `Trade size is safe relative to pool liquidity (${(impactRatio * 100).toFixed(2)}% impact).`,
      value: impactRatio,
    };
  }

  /**
   * Check 7: Supply Concentration Risk (Solution A)
   * Evaluates the token's total supply vs the amount currently in the liquidity pool.
   * A highly concentrated supply (e.g. < 1% in pool) indicates massive creator holding (Rug pull risk).
   */
  private async checkSupplyConcentration(tokenSymbol: string, route: any[]): Promise<RiskCheck> {
    // Curated/whitelisted tokens (SUI, USDC, USDT, DEEP, WAL, CETUS, ...) are
    // established assets whose supply is spread across many pools, lending
    // protocols and wallets. The pool/supply heuristic below compares ONE
    // pool's holdings against the token's ENTIRE supply, so for these tokens it
    // naturally returns a tiny percentage and produces false "high
    // concentration" warnings (e.g. USDT showing 0.19%). Rug-pull concentration
    // risk is only meaningful for unknown/uncurated tokens.
    if (isWhitelistedToken(tokenSymbol)) {
      return {
        name: 'Supply Concentration',
        category: 'Concentration',
        status: 'SAFE',
        message: `${tokenSymbol.toUpperCase()} is an established, widely-distributed token — supply concentration risk is not applicable.`,
      };
    }

    if (!route || route.length === 0) {
      return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'No route data to check pool reserves.' };
    }

    try {
      // 1. Get the exact token address
      const tokenAddress = await resolveTokenAddress(tokenSymbol);
      if (!tokenAddress.includes('::')) return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'Could not resolve token address' };

      // On-chain proof: the coin type (whose total supply is verifiable on
      // Suiscan) plus the liquidity pools it was measured against.
      const concRefs: RiskReference[] = [
        { label: `${tokenSymbol.toUpperCase()} coin`, type: 'coin', value: tokenAddress },
        ...poolReferences(route),
      ];

      // 2. Fetch the true total supply from chain
      const supplyData = await suiRpcCall('suix_getTotalSupply', [tokenAddress]);
      const totalSupply = parseInt(supplyData?.value || '0');

      if (totalSupply === 0 || Number.isNaN(totalSupply)) {
        return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'Could not fetch token total supply' };
      }

      // 3. Approximate token amount in the pool using mathematically derived TVL and token price
      const poolLiquidityUsd = route.length > 0 
        ? route.reduce((sum, node) => sum + (node.liquidityUsd || 0), 0)
        : 0;
      
      if (poolLiquidityUsd === 0) {
        return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'No TVL metric available to evaluate supply' };
      }

      // Cross-check: a concentration ratio is only meaningful when the pool
      // itself has meaningful liquidity. A tiny pool of a tiny-supply token
      // can show >1% of supply in-pool and falsely pass as "SAFE". If the
      // bottleneck pool is below the minimum liquidity threshold, the
      // concentration metric is unreliable and must not return SAFE.
      const minLiquidityThreshold = RISK_THRESHOLDS.minLiquidity.volatilePair;
      if (poolLiquidityUsd < minLiquidityThreshold) {
        return {
          name: 'Supply Concentration',
          category: 'Concentration',
          status: 'WARNING',
          message: `Pool liquidity ($${Math.round(poolLiquidityUsd).toLocaleString()}) is below safe threshold ($${minLiquidityThreshold.toLocaleString()}) — concentration metric unreliable for low-liquidity pools.`,
          value: poolLiquidityUsd,
          threshold: minLiquidityThreshold,
        };
      }

      let tokenDepthInPool = 0;
      try {
        const tokenPriceUsd = await getUsdPriceOnChain(tokenAddress);
        if (tokenPriceUsd > 0) {
          tokenDepthInPool = (poolLiquidityUsd / 2) / tokenPriceUsd;
        }
      } catch (err) {
        return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'Failed to fetch on-chain token price for supply analysis' };
      }

      if (tokenDepthInPool === 0) {
        return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'Could not calculate token depth in pool' };
      }

      // Convert total supply to standard units
      const decimals = getTokenDecimals(tokenSymbol);
      const standardTotalSupply = totalSupply / Math.pow(10, decimals);
      
      if (standardTotalSupply === 0 || Number.isNaN(standardTotalSupply)) {
        return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'Total supply is 0 or invalid' };
      }

      // 4. Calculate ratio (Liquidity in pool / Total Supply)
      const supplyInPoolPct = (tokenDepthInPool / standardTotalSupply) * 100;

      // Guard against NaN from division — return WARNING rather than falling
      // through to SAFE (NaN comparisons are always false).
      if (Number.isNaN(supplyInPoolPct) || supplyInPoolPct < 0) {
        return { name: 'Supply Concentration', category: 'Concentration', status: 'WARNING', message: 'Could not calculate supply concentration ratio — invalid on-chain data.' };
      }

      const { danger: concDanger, warn: concWarn } = RISK_THRESHOLDS.supplyConcentration;

      if (supplyInPoolPct < concDanger) {
        return {
           name: 'Supply Concentration',
           category: 'Concentration',
           status: 'DANGER',
           message: `Concentration Risk: Only ${supplyInPoolPct.toFixed(4)}% of Total Supply is in the liquidity pool. 99.9%+ is held in wallets. Extreme rug-pull risk.`,
           value: supplyInPoolPct,
           references: concRefs,
        };
      }

      if (supplyInPoolPct < concWarn) {
        return {
           name: 'Supply Concentration',
           category: 'Concentration',
           status: 'WARNING',
           message: `High Concentration: Only ${supplyInPoolPct.toFixed(2)}% of supply is in the pool. Trade carefully.`,
           value: supplyInPoolPct,
           references: concRefs,
        };
      }

      return {
        name: 'Supply Concentration',
        category: 'Concentration',
        status: 'SAFE',
        message: `Low concentration: ${supplyInPoolPct.toFixed(2)}% of supply is active in the liquidity pool.`,
        value: supplyInPoolPct,
        references: concRefs,
      };

    } catch (err: any) {
      logger.warn('Supply concentration check failed', { error: err.message });
      return {
        name: 'Supply Concentration',
        category: 'Concentration',
        status: 'WARNING',
        message: 'Could not verify token supply concentration on-chain',
      };
    }
  }

  /**
   * Check 3: Oracle Price Deviation
   * Compares simulated output with oracle-expected output.
   */


  /**
   * Check 4: Liquidity Depth & Fragmentation
   * Assesses active liquidity and fragmentation across pools.
   */
  private checkLiquidityDepth(
    route: any[],
    amount: number,
    poolDetails?: PoolDetails | null
  ): RiskCheck {
    // Check number of route hops (fragmentation)
    const hopCount = route.length;

    if (hopCount === 0) {
      return {
        name: 'Liquidity Depth',
        category: 'High Slippage',
        status: 'WARNING',
        message: 'No route data available for depth analysis',
      };
    }

    const { maxHops, poolUtilizationWarn } = RISK_THRESHOLDS.liquidityDepth;

    // High fragmentation (>maxHops hops) means liquidity is spread thin
    if (hopCount > maxHops) {
      return {
        name: 'Liquidity Depth',
        category: 'High Slippage',
        status: 'WARNING',
        message: `Route uses ${hopCount} hops — liquidity is fragmented. Consider smaller trade size.`,
        value: hopCount,
        threshold: maxHops,
      };
    }

    // Check if any single pool handles too much of the trade
    const maxRatio = Math.max(...route.map(n => n.ratio || 0));
    const poolLiquidity = poolDetails?.liquidity || 0;

    // For CLMM pools (Cetus), active liquidity matters
    if (poolLiquidity > 0 && amount > 0) {
      const utilizationRatio = amount / poolLiquidity;
      if (utilizationRatio > poolUtilizationWarn) {
        return {
          name: 'Liquidity Depth',
          category: 'High Slippage',
          status: 'WARNING',
          message: `Trade utilizes ${(utilizationRatio * 100).toFixed(0)}% of pool depth — significant price impact likely.`,
          value: utilizationRatio * 100,
          threshold: poolUtilizationWarn * 100,
        };
      }
    }

    return {
      name: 'Liquidity Depth',
      category: 'High Slippage',
      status: 'SAFE',
      message: `Route uses ${hopCount} hop(s) with concentrated liquidity — efficient routing.`,
      value: hopCount,
      threshold: maxHops,
    };
  }

  // ─── Final Score Calculation ────────────────────────────────

  /**
   * Calculate the overall risk score and assessment from individual checks.
   */
  private calculateFinalAssessment(
    allChecks: RiskCheck[],
    priceImpactCheck: RiskCheck,
    depthCheck: RiskCheck
  ): RiskAssessment {
    // Start with 100 and deduct based on check results
    let score = 100;

    // Weight deductions by severity
    const deductions: Record<string, number> = {
      'DANGER': RISK_THRESHOLDS.scoreDeductions.DANGER,
      'WARNING': RISK_THRESHOLDS.scoreDeductions.WARNING,
    };

    for (const check of allChecks) {
      if (check.status === 'DANGER') {
        score -= deductions.DANGER;
      } else if (check.status === 'WARNING') {
        score -= deductions.WARNING;
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Determine risk level
    const { low, medium, high } = RISK_THRESHOLDS.riskLevel;
    let riskLevel: RiskLevel;
    if (score >= low) riskLevel = 'LOW';
    else if (score >= medium) riskLevel = 'MEDIUM';
    else if (score >= high) riskLevel = 'HIGH';
    else riskLevel = 'CRITICAL';

    // Extract key metrics
    const slippagePercent = priceImpactCheck.value || 0;
    const priceDeviationPercent = 0; // Removed Pyth oracle dependency
    const depthRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 
      depthCheck.status === 'DANGER' ? 'HIGH' :
      depthCheck.status === 'WARNING' ? 'MEDIUM' : 'LOW';

    // Determine if execution should be blocked
    const hasCriticalDanger = allChecks.some(c =>
      c.status === 'DANGER' && (
        c.name === 'Price Impact'
      )
    );

    const safe = !hasCriticalDanger && score >= RISK_THRESHOLDS.minSafeScore;

    // Generate recommendation
    const recommendation = this.generateRecommendation(score, riskLevel, allChecks);

    return {
      safe,
      score,
      riskLevel,
      slippagePercent,
      priceDeviationPercent,
      depthRisk,
      recommendation,
      checks: allChecks,
    };
  }

  /**
   * Generate a human-readable recommendation based on the assessment.
   */
  private generateRecommendation(
    score: number,
    riskLevel: RiskLevel,
    checks: RiskCheck[]
  ): string {
    const dangers = checks.filter(c => c.status === 'DANGER');
    const warnings = checks.filter(c => c.status === 'WARNING');

    if (riskLevel === 'CRITICAL') {
      return `⛔ BLOCKED: ${dangers.map(d => d.name).join(', ')} — trade rejected for safety. ${dangers[0]?.message || ''}`;
    }

    if (riskLevel === 'HIGH') {
      return `⚠️ HIGH RISK: ${dangers.map(d => d.name).join(', ')}. Consider reducing trade size or using a different route.`;
    }

    if (riskLevel === 'MEDIUM') {
      return `⚡ MODERATE: ${warnings.map(w => w.name).join(', ')} flagged. Proceed with caution.`;
    }

    return `✅ Route looks safe. Score: ${score}/100.`;
  }
}

/** Singleton instance */
export const riskGuardian = new LiquidityRiskGuardian();
