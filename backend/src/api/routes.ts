/**
 * DIEPS Intent Engine — API Routes
 * All REST endpoints for the Intent Engine backend.
 * 
 * Endpoints:
 * - POST /api/parse-intent       — Parse natural language swap intent
 * - POST /api/calculate-optimal-route — Find best swap route via Cetus V3
 * - POST /api/evaluate-guardian-risk  — Run Risk Guardian assessment
 * - POST /api/balance            — Get token balance for address
 * - POST /api/sui-rpc            — Proxy JSON-RPC calls to Sui fullnode
 * - POST /api/execute-swap       — Build & return serializable PTB for wallet
 */

import { Router } from 'express';
import { validateBody } from './middleware.js';
import {
  ParseIntentSchema,
  CalculateRouteSchema,
  EvaluateGuardianSchema,
  BalanceSchema,
  ExecuteSwapSchema,
  ProcessIntentSchema,
  RiskAdviceSchema,
  RiskSummarySchema,
} from '../types/index.js';
import { RISK_THRESHOLDS } from '../config/index.js';
import { parseIntent } from '../services/llm/intentParser.js';
import { findOptimalRoute, calculateOptimalSlippage } from '../services/router/cetusRouter.js';
import { resolveToken, searchTokenCandidates, isWhitelistedToken, resolveTokenLogo, getTokenDecimalsAsync } from '../services/coin/tokenResolver.js';
import { summarizeTokenMatches } from '../services/llm/tokenAdvisor.js';
import { findAlternativeSources } from '../services/coin/alternativeSource.js';
import { getBalance } from '../utils/suiClient.js';
import { riskGuardian } from '../services/risk/LiquidityRiskGuardian.js';
import { checkTokenSafety } from '../services/safety/TokenSafety.js';
import { suiRpcCall } from '../utils/suiClient.js';
import { getFormattedBalance } from '../services/coin/coinService.js';
import { buildSwapPTB } from '../services/router/ptbBuilder.js';
import { suiRpcProxy, RpcMethodNotAllowedError } from '../utils/suiClient.js';
import { logger } from '../utils/logger.js';

export const apiRouter = Router();

/**
 * Replace a bare token symbol in the user's prompt with a full coin type so the
 * suggested retry prompt resolves unambiguously. Falls back to appending the
 * coin type if the symbol isn't found as a whole word.
 */
function substituteToken(prompt: string, symbol: string, coinType: string): string {
  if (!prompt) return `Swap using ${coinType}`;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return re.test(prompt) ? prompt.replace(re, coinType) : `${prompt} (${coinType})`;
}

/** Matches a full Sui coin type, e.g. 0xabc...::pepe::PEPE */
const COIN_TYPE_RE = /0x[0-9a-fA-F]+::[^\s()]+::[^\s()]+/;

/** Format a numeric amount to a clean string (no trailing zeros). */
function trimAmt(n: number): string {
  return String(Number(n.toFixed(9)));
}

/**
 * Resolve a dynamic trade amount ("ALL" / "MAX" / "N%") to a concrete number by
 * reading the wallet's balance of the source token. Returns null for a normal
 * numeric amount (caller uses it as-is) or when nothing is available.
 */
async function resolveDynamicAmount(
  rawAmount: string,
  walletAddress: string,
  sourceAddress: string,
  sourceSymbol: string
): Promise<number | null> {
  const raw = String(rawAmount || '').trim().toUpperCase();
  const isAll = raw === 'ALL' || raw === 'MAX';
  const pct = raw.match(/^(\d+(?:\.\d+)?)%$/);
  if (!isAll && !pct) return null;
  if (!sourceAddress?.startsWith('0x')) return null;

  const bal = await getBalance(walletAddress, sourceAddress);
  const decimals = await getTokenDecimalsAsync(sourceSymbol);
  const human = Number(bal.totalBalance) / Math.pow(10, decimals);
  const fraction = isAll ? 1 : parseFloat(pct![1]) / 100;
  let amount = human * fraction;

  // Reserve a little SUI for gas when spending SUI itself.
  const isSui = sourceSymbol.toUpperCase() === 'SUI' || (sourceAddress || '').includes('::sui::SUI');
  if (isSui) amount = Math.max(0, amount - RISK_THRESHOLDS.router.gasReserveSui);

  return amount > 0 ? amount : null;
}

/**
 * Whether a token needs an explicit user pick before swapping. Non-whitelisted
 * tokens are ambiguous (the registry can hold several coins under the same
 * symbol), so we surface a candidate list instead of silently auto-picking one.
 * Skips when the user already gave a full coin type (symbol contains "::" or the
 * prompt embeds a coin type) — this also makes the pick → retry loop terminate.
 */
function needsTokenSelection(symbol: string, prompt: string): boolean {
  if (!symbol) return false;
  if (symbol.includes('::')) return false;       // already an explicit coin type
  if (isWhitelistedToken(symbol)) return false;  // curated / verified token
  if (COIN_TYPE_RE.test(prompt)) return false;   // user already provided a contract
  return true;
}

// ─── POST /api/parse-intent ────────────────────────────────────

apiRouter.post('/parse-intent', validateBody(ParseIntentSchema), async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await parseIntent(prompt);
    return res.json(result);
  } catch (err: any) {
    logger.warn('Intent parsing failed', { error: err.message });
    return res.status(400).json({
      error: err.message || 'Invalid intent format',
      validation_status: 'INVALID_FORMAT',
    });
  }
});

// ─── POST /api/calculate-optimal-route ─────────────────────────

apiRouter.post('/calculate-optimal-route', validateBody(CalculateRouteSchema), async (req, res) => {
  try {
    const { sourceAddress, destAddress, sourceSymbol, destSymbol, amount } = req.body;

    const routeResult = await findOptimalRoute(
      sourceSymbol,
      destSymbol,
      sourceAddress,
      destAddress,
      amount
    );

    return res.json(routeResult);
  } catch (err: any) {
    logger.error('Route calculation failed', { error: err.message });
    return res.status(500).json({
      error: err.message || 'Failed to calculate route on-chain. No viable pool or liquidity found.',
    });
  }
});

// ─── POST /api/evaluate-guardian-risk ──────────────────────────

apiRouter.post('/evaluate-guardian-risk', validateBody(EvaluateGuardianSchema), async (req, res) => {
  try {
    const { sourceSymbol, destSymbol, route, execution_impact } = req.body;

    const assessment = await riskGuardian.evaluate({
      sourceSymbol,
      destSymbol,
      amount: '0', // Amount not always provided in the guardian call
      route: route || [],
      executionImpact: String(execution_impact || '0'),
      expectedOutput: 0,
      poolDetails: null,
    });

    // Return backward-compatible format
    const response = riskGuardian.toFrontendResponse(assessment);
    return res.json(response);
  } catch (err: any) {
    logger.error('Guardian evaluation failed', { error: err.message });
    return res.status(500).json({
      error: err.message || 'Failed to evaluate risk on-chain.',
    });
  }
});

// ─── POST /api/risk-advice ─────────────────────────────────────

apiRouter.post('/risk-advice', validateBody(RiskAdviceSchema), async (req, res) => {
  try {
    const { sourceToken, destToken, risks } = req.body;
    // Late-bind the import to avoid circular dependencies if any, or just import it at top.
    // For simplicity, we import it dynamically here since it's only used here.
    const { summarizeRiskAdvice } = await import('../services/llm/riskAdvisor.js');
    
    const advice = await summarizeRiskAdvice(sourceToken, destToken, risks);
    return res.json({ advice });
  } catch (err: any) {
    logger.error('Risk advice generation failed', { error: err.message });
    return res.status(500).json({
      error: err.message || 'Failed to generate risk advice.',
    });
  }
});

// ─── POST /api/risk-summary ────────────────────────────────────

apiRouter.post('/risk-summary', validateBody(RiskSummarySchema), async (req, res) => {
  try {
    const { sourceToken, destToken, amount, guardianChecks, routeNodes } = req.body;
    const { generateRiskSummary } = await import('../services/llm/riskAdvisor.js');

    const result = await generateRiskSummary(sourceToken, destToken, amount, guardianChecks, routeNodes);
    return res.json(result);
  } catch (err: any) {
    logger.error('Risk summary generation failed', { error: err.message });
    return res.status(500).json({
      error: err.message || 'Failed to generate risk summary.',
    });
  }
});

// ─── POST /api/balance ─────────────────────────────────────────

apiRouter.post('/balance', validateBody(BalanceSchema), async (req, res) => {
  try {
    const { address, symbol } = req.body;
    const balance = await getFormattedBalance(address, symbol);
    return res.json({ balance });
  } catch (err: any) {
    logger.error('Balance fetch failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ─── POST /api/sui-rpc ────────────────────────────────────────

apiRouter.post('/sui-rpc', async (req, res) => {
  try {
    const data = await suiRpcProxy(req.body);
    return res.json(data);
  } catch (err: any) {
    if (err instanceof RpcMethodNotAllowedError) {
      logger.warn('Blocked disallowed RPC proxy method', { error: err.message });
      return res.status(403).json({ error: err.message });
    }
    logger.error('Sui RPC proxy error', { error: err.message });
    return res.status(500).json({ error: 'Failed to call RPC proxy' });
  }
});

// ─── POST /api/execute-swap ────────────────────────────────────

apiRouter.post('/execute-swap', validateBody(ExecuteSwapSchema), async (req, res) => {
  try {
    const {
      senderAddress,
      sourceSymbol,
      destSymbol,
      sourceAddress,
      destAddress,
      amount,
      slippage,
      routerData,
    } = req.body;

    // First, get the optimal route if not provided
    let routeResult = routerData;
    if (!routeResult || !routeResult.route) {
      // If addresses are missing, resolve them
      const resolvedSourceAddress = sourceAddress || await resolveToken(sourceSymbol)?.address || '';
      const resolvedDestAddress = destAddress || await resolveToken(destSymbol)?.address || '';
      routeResult = await findOptimalRoute(
        sourceSymbol,
        destSymbol,
        resolvedSourceAddress,
        resolvedDestAddress,
        amount
      );
    }

    // Build the PTB
    const ptbResult = await buildSwapPTB({
      senderAddress,
      sourceSymbol,
      destSymbol,
      sourceAddress,
      destAddress,
      amount,
      slippage: slippage || 0.5,
      routeData: routeResult,
    });

    return res.json(ptbResult);
  } catch (err: any) {
    logger.error('Execute swap failed', { error: err.message });
    return res.status(500).json({
      error: err.message || 'Failed to build swap transaction',
    });
  }
});

// ─── POST /api/process-intent ──────────────────────────────────

apiRouter.post('/process-intent', validateBody(ProcessIntentSchema), async (req, res) => {
  try {
    const { prompt, senderAddress, slippage } = req.body;

    // 1. Parse Intent
    const parseResult = await parseIntent(prompt);
    if (!parseResult) {
      throw new Error('I could not understand your swap intent. Please specify which tokens you want to swap and the amount.');
    }
    const intent = parseResult.intent;

    if (intent.action_type !== 'SWAP') {
      throw new Error(`Only SWAP actions are supported. Found: ${intent.action_type}`);
    }

    const isRealWallet = !!senderAddress && !/^0x0+$/.test(senderAddress);
    const rawAmt = String(intent.trade_amount || '').trim().toUpperCase();
    const isDynamicAmount = rawAmt === 'ALL' || rawAmt === 'MAX' || /^\d+(?:\.\d+)?%$/.test(rawAmt);

    // Concrete numeric amounts must be valid; dynamic amounts are resolved below.
    if (!isDynamicAmount) {
      if (rawAmt === 'MISSING' || rawAmt === '') {
        throw new Error('Please specify the amount you want to swap (e.g., "Swap 50% DEEP to SUI", "Swap ALL DEEP", or "Swap 1000 DEEP").');
      }
      const parsedAmount = parseFloat(intent.trade_amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please specify a valid amount to swap.');
      }
    }

    // 1b. Non-whitelisted token → let the user pick the exact contract instead of
    // silently auto-resolving to the first registry match (symbols can collide).
    for (const symbol of [intent.destination_token_symbol, intent.source_token_symbol]) {
      if (!needsTokenSelection(symbol, prompt || '')) continue;
      const candidates = await searchTokenCandidates(symbol, 8);
      if (candidates.length > 0) {
        const summary = await summarizeTokenMatches(prompt || '', symbol, candidates);
        const suggestions = await Promise.all(summary.candidates.map(async (c) => {
          let safetyChecks = await checkTokenSafety(c.coinType);
          
          try {
            const isSource = symbol === intent.source_token_symbol;
            const srcSym = isSource ? c.symbol : intent.source_token_symbol;
            const dstSym = !isSource ? c.symbol : intent.destination_token_symbol;
            const srcAddr = isSource ? c.coinType : intent.source_token_address || '';
            const dstAddr = !isSource ? c.coinType : intent.destination_token_address || '';
            
            const tradeAmt = intent.trade_amount && parseFloat(intent.trade_amount) > 0 ? intent.trade_amount : '1';

            const routeResult = await findOptimalRoute(
              srcSym,
              dstSym,
              srcAddr,
              dstAddr,
              tradeAmt
            );
            
            if (routeResult && routeResult.route && routeResult.route.length > 0) {
              const riskAssessment = await riskGuardian.evaluate({
                sourceSymbol: srcSym,
                destSymbol: dstSym,
                amount: tradeAmt,
                route: routeResult.route,
                executionImpact: routeResult.execution_impact || '0',
                expectedOutput: routeResult.expected_output,
                poolDetails: routeResult.poolDetails,
              });
              // use comprehensive checks from guardian
              safetyChecks = riskAssessment.checks;
            }
          } catch (e) {
            // Ignore route calculation errors for candidates; basic safetyChecks will be used
            logger.debug(`Could not compute route for candidate ${c.symbol}`, { error: (e as any).message });
          }

          const hasWarning = safetyChecks.some(chk => chk.status === 'WARNING' || chk.status === 'DANGER');
          return {
            ...c,
            safetyChecks,
            isSafe: !hasWarning,
            retryPrompt: substituteToken(prompt || '', symbol, c.coinType),
          };
        }));
        return res.json({
          tokenSuggestion: {
            missingSymbol: symbol,
            message: summary.message,
            candidates: suggestions,
          },
        });
      }
    }

    // 1c. Resolve "ALL" / "MAX" / "N%" to a concrete amount from the wallet.
    if (isDynamicAmount) {
      if (!isRealWallet) {
        return res.status(400).json({
          error: 'Please connect your wallet so I can read your balance and swap your entire (or percentage) balance.',
        });
      }
      const resolved = await resolveDynamicAmount(
        rawAmt,
        senderAddress,
        intent.source_token_address,
        intent.source_token_symbol
      );
      if (resolved === null) {
        const sym = (intent.source_token_symbol || '').split('::').pop();
        return res.status(400).json({ error: `You don't have any ${sym} available to swap.` });
      }
      intent.trade_amount = trimAmt(resolved);
    }

    // 2. Calculate Route
    const routeResult = await findOptimalRoute(
      intent.source_token_symbol,
      intent.destination_token_symbol,
      intent.source_token_address,
      intent.destination_token_address,
      intent.trade_amount
    );

    // 3. Guardian Risk Assessment
    const riskAssessment = await riskGuardian.evaluate({
      sourceSymbol: intent.source_token_symbol,
      destSymbol: intent.destination_token_symbol,
      amount: intent.trade_amount,
      route: routeResult.route,
      executionImpact: routeResult.execution_impact,
      expectedOutput: routeResult.expected_output,
      poolDetails: routeResult.poolDetails,
    });

    // 4. Try to Build PTB for Simulation/Display (Ignore errors if wallet is dummy or balance is insufficient)
    let ptbResult: any = null;
    try {
      const parsedImpact = parseFloat(routeResult.execution_impact || '0');

      // Compute optimal slippage from on-chain data — uses pool liquidity,
      // trade size, price impact, and route complexity instead of a fixed formula.
      const minLiquidityUsd = routeResult.route.length > 0
        ? routeResult.route.reduce((sum: number, n: any) => sum + (n.liquidityUsd || 0), 0)
        : 0;
      const optimalSlippage = calculateOptimalSlippage({
        observedPriceImpactPct: parsedImpact,
        totalLiquidityUsd: minLiquidityUsd,
        tradeUsdValue: parseFloat(intent.trade_amount || '0'),
        hopCount: routeResult.route.length,
        userSlippage: slippage,
      });

      ptbResult = await buildSwapPTB({
        senderAddress,
        sourceSymbol: intent.source_token_symbol,
        destSymbol: intent.destination_token_symbol,
        sourceAddress: intent.source_token_address,
        destAddress: intent.destination_token_address,
        amount: intent.trade_amount,
        slippage: optimalSlippage,
        routeData: routeResult,
      });

      // Calculate estimated gas dynamically
      try {
        const refGas = await suiRpcCall('suix_getReferenceGasPrice');
        if (ptbResult.simulation) {
          // Add network reference gas info to the simulation response
          ptbResult.simulation.referenceGasPrice = refGas;
          // Typically swap consumes ~5M MIST
          ptbResult.simulation.estGas = String(BigInt(refGas) * BigInt(RISK_THRESHOLDS.router.gasEstimateMist));
        }
      } catch (err) {
         // ignore gas estimate error
      }
    } catch (ptbErr: any) {
      logger.warn('Skipped full PTB build during intent parsing (likely insufficient balance or dummy wallet). Will build at execution phase.', { error: ptbErr.message });
      // Generate mock ptbResult to ensure UI can still render steps
      ptbResult = {
        transactionBytes: null,
        ptbSteps: [
          { index: 1, command: 'Verify Balance', description: 'Checking wallet balance at execution' },
          { index: 2, command: 'Build PTB', description: 'Generating transaction dynamically' }
        ],
        simulation: { success: false, gasUsed: '0', balanceChanges: [], error: ptbErr.message },
        routeSummary: {
          inputAmount: intent.trade_amount,
          inputToken: intent.source_token_symbol,
          expectedOutput: routeResult.expected_output?.toString() || '0',
          outputToken: intent.destination_token_symbol,
          priceImpact: routeResult.execution_impact || '0%',
        }
      };
    }

    // Resolve source/dest logos (registry → on-chain iconUrl) for accurate icons.
    const [sourceLogo, destLogo, destDecimals] = await Promise.all([
      resolveTokenLogo(intent.source_token_address || intent.source_token_symbol),
      resolveTokenLogo(intent.destination_token_address || intent.destination_token_symbol),
      getTokenDecimalsAsync(intent.destination_token_symbol),
    ]);

    // If a real wallet lacks enough of the source token, look for another token
    // it holds that is worth enough to buy the destination, and suggest it.
    let alternativeSource: any = null;
    if (isRealWallet && intent.source_token_address?.startsWith('0x')) {
      try {
        const bal = await getBalance(senderAddress, intent.source_token_address);
        const decimals = await getTokenDecimalsAsync(intent.source_token_symbol);
        const humanBal = Number(bal.totalBalance) / Math.pow(10, decimals);
        if (humanBal < parseFloat(intent.trade_amount)) {
          const alts = await findAlternativeSources({
            walletAddress: senderAddress,
            destAddress: intent.destination_token_address,
            intendedSourceAddress: intent.source_token_address,
            intendedAmount: intent.trade_amount,
          });
          if (alts.length > 0) {
            const destSym = (intent.destination_token_symbol || '').split('::').pop();
            const top = alts[0];
            alternativeSource = {
              intendedSourceSymbol: intent.source_token_symbol.split('::').pop(),
              destSymbol: destSym,
              message:
                `You don't have enough ${intent.source_token_symbol.split('::').pop()} in your wallet. ` +
                `You do hold ${top.balance} ${top.symbol} (~$${top.usdValue.toFixed(2)}), which is enough to swap into ${destSym}. ` +
                `Pick a token below to swap it to ${destSym} instead.`,
              candidates: alts.map((a) => ({
                ...a,
                retryPrompt: `Swap ${a.suggestedAmount} ${a.coinType} to ${intent.destination_token_address}`,
              })),
            };
          }
        }
      } catch (balErr: any) {
        logger.warn('Alternative source check failed', { error: balErr.message });
      }
    }

    // 5. Unified Response
    return res.json({
      intent,
      route: routeResult,
      guardian: {
        safe: riskAssessment.safe,
        score: riskAssessment.score,
        riskLevel: riskAssessment.riskLevel,
        checks: riskAssessment.checks, // Plain language checks
      },
      ptb: ptbResult,
      tokenLogos: { source: sourceLogo || null, dest: destLogo || null },
      destDecimals,
      alternativeSource,
    });

  } catch (err: any) {
    logger.error('Process Intent failed', { error: err.message });

    if (err.message && err.message.startsWith('UNKNOWN_TOKEN:')) {
      const missingSymbol = err.message.split(':')[1] || 'Token';

      // Instead of erroring, query the registry/on-chain for candidates and let
      // the AI recommend a contract the user can one-click retry with.
      try {
        const candidates = await searchTokenCandidates(missingSymbol, 8);
        if (candidates.length > 0) {
          const originalPrompt: string = req.body?.prompt || '';
          const summary = await summarizeTokenMatches(originalPrompt, missingSymbol, candidates);
          const suggestions = await Promise.all(summary.candidates.map(async (c) => {
            const safetyChecks = await checkTokenSafety(c.coinType);
            const hasWarning = safetyChecks.some(chk => chk.status === 'WARNING' || chk.status === 'DANGER');
            return {
              ...c,
              safetyChecks,
              isSafe: !hasWarning,
              // Ready-to-run prompt that swaps the ambiguous symbol for its full
              // coin type (the user still picks which token; nothing is auto-chosen).
              retryPrompt: substituteToken(originalPrompt, missingSymbol, c.coinType),
            };
          }));

          return res.json({
            tokenSuggestion: {
              missingSymbol,
              message: summary.message,
              candidates: suggestions,
            },
          });
        }
      } catch (suggestErr: any) {
        logger.warn('Token suggestion lookup failed', { error: suggestErr.message });
      }

      // Nothing found — fall back to asking the user for the contract address.
      return res.status(400).json({
        error: `The system could not find the token '${missingSymbol}'. Please provide the correct Contract address (for example: Swap 10 SUI to 0x...::${missingSymbol.toLowerCase()}::${missingSymbol.toUpperCase()})`,
      });
    }

    return res.status(500).json({
      error: err.message || 'Failed to process intent pipeline',
    });
  }
});
