/**
 * Soka Intent Engine — API Routes
 * All REST endpoints for the Mezo Testnet Intent Engine backend.
 *
 * Endpoints:
 * - POST /api/parse-intent            — Parse natural language swap/bridge intent
 * - POST /api/calculate-optimal-route — Find best route via Mezo Swap (Solidly fork)
 * - POST /api/evaluate-guardian-risk  — Run Liquidity Risk Guardian assessment
 * - POST /api/balance                 — Get native BTC and ERC-20 token balances
 * - POST /api/execute-swap            — Build & return unsigned EVM transaction
 * - POST /api/process-intent          — Full automated pipeline (parse -> route -> guardian -> tx)
 * - POST /api/bridge-out              — Build bridgeOut transaction for Mezo Assets Bridge
 * - GET/POST /api/bridge-info         — Fetch Mezo Assets Bridge metadata & capacities
 * - POST /api/mezo-rpc                — Safe read-only JSON-RPC proxy for Mezo Testnet
 * - POST /api/transfer                — Build unsigned ERC-20 / native transfer transaction
 * - GET  /api/capabilities            — System capability registry (executable/advisory/unsupported)
 * - GET  /api/tokens                  — Supported token list (whitelist + on-chain discovered)
 * - GET  /api/gas-price               — Live network gas price with operator warning threshold
 *
 * Pipeline policy (no silent misdirection):
 * - Unknown/unclear intents → 422 with structured fallback advise, never a
 *   fabricated swap/bridge intent.
 * - Unknown tokens → 422 unknown_token with verified candidates.
 * - Unsafe guardian assessments → 403 unless the caller passes acknowledgeRisk.
 */

import { Router, type Request, type Response } from 'express';
import { isAddress, type Address } from 'viem';
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
  BridgeOutSchema,
  PricesQuerySchema,
  PoolsQuerySchema,
  PoolAddressParamSchema,
  BorrowQuoteSchema,
  BorrowReverseQuoteSchema,
  QuoteLiquiditySchema,
  QuotePairedSchema,
  AddLiquiditySchema,
  RemoveLiquiditySchema,
  BorrowMockExecuteSchema,
  TransferSchema,
} from '../types/index.js';
import {
  RISK_THRESHOLDS,
  ZERO_ADDRESS,
  BRIDGE_CONFIG,
  TX_CONFIG,
  DISPLAY_DECIMALS,
  NATIVE_SYMBOL,
} from '../config/index.js';
import { TOKEN_WHITELIST } from '../config/constant.js';
import { getCapabilities, buildFallbackAdvise, BRIDGE_CHAIN_NAMES } from '../config/capabilities.js';
import { getPricesForSymbols, getTokenUsdPrice } from '../services/prices/priceService.js';
import { listPools, getPoolDetail, quoteAddLiquidity, quotePairedAmount, quoteRemoveLiquidity, buildAddLiquidityTx, buildRemoveLiquidityTx, ensureMusdRegistered } from '../services/pools/poolService.js';
import { getBorrowQuote, getBorrowReverseQuote, BorrowReverseError, buildBorrowTx } from '../services/lending/borrowService.js';
import { parseIntent, UnclearIntentError } from '../services/llm/intentParser.js';
import { generateLlmCompletion } from '../services/llm/llmClient.js';
import { findOptimalRoute } from '../services/router/mezoRouter.js';
import { buildMezoSwapTx } from '../services/router/mezoTxBuilder.js';
import { buildTransferTx } from '../services/transfer/transferService.js';
import {
  resolveToken,
  searchTokenCandidates,
  isEvmAddress,
} from '../services/coin/tokenResolver.js';
import { summarizeTokenMatches } from '../services/llm/tokenAdvisor.js';
import { findAlternativeSources } from '../services/coin/alternativeSource.js';
import { getRiskSummary, summarizeRiskAdvice } from '../services/llm/riskAdvisor.js';
import { liquidityRiskGuardian } from '../services/risk/LiquidityRiskGuardian.js';
import { getFormattedBalance, getAllBalances } from '../services/coin/coinService.js';
import { buildBridgeOutTx, getBridgeInfo, getBridgeOutChains, getOutflowCapacity, getMinBridgeOutAmount, validateBridgeRecipient } from '../services/bridge/bridgeService.js';
import { mezoRpcProxy, getPublicClient } from '../utils/mezoClient.js';
import { logger } from '../utils/logger.js';

/** 422 responder for rejected intents — advise, never fabricated data. */
function rejectIntent(res: Response, status: 422 | 403, error: string, advise: unknown, extra?: Record<string, unknown>) {
  return res.status(status).json({ error, advise, ...extra });
}

/** Builds an unknown-token advise with verified on-chain candidates. */
async function unknownTokenAdvise(userPrompt: string, missingSymbol: string) {
  const candidates = searchTokenCandidates(missingSymbol);
  const summary = await summarizeTokenMatches(userPrompt, missingSymbol, candidates).catch(() => ({
    missingSymbol,
    candidates,
    message: '',
  }));
  return {
    advise: buildFallbackAdvise({
      error: 'unknown_token',
      detail:
        `"${missingSymbol}" is not a supported token on Mezo Testnet.` +
        (summary.message ? ` ${summary.message}` : ' Pick a verified token below or use a contract address.'),
    }),
    tokenSuggestion: { missingSymbol, candidates },
  };
}

export const apiRouter = Router();

/** Percent divisor for N% dynamic amounts. */
const DYNAMIC_PCT_DIVISOR = 100;

/**
 * Resolve dynamic trade amounts ("ALL" / "MAX" / "N%") by reading wallet balance.
 * Throws an advise-ready error when no wallet is connected or funds are insufficient.
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

  if (!walletAddress || !isAddress(walletAddress)) {
    throw new Error('Connect a wallet to use ALL, MAX, or percentage amounts — no balance is readable without an address.');
  }
  const balString = await getFormattedBalance(walletAddress, sourceAddress || sourceSymbol);
  const human = parseFloat(balString);
  if (!Number.isFinite(human)) {
    throw new Error('Wallet balance is unreadable on-chain right now. Try again later.');
  }
  const fraction = isAll ? 1 : parseFloat(pct![1]) / DYNAMIC_PCT_DIVISOR;
  let amount = human * fraction;

  // Reserve a small amount of BTC for gas when swapping native Bitcoin
  const isBtc = sourceSymbol.toUpperCase() === NATIVE_SYMBOL || sourceAddress === ZERO_ADDRESS;
  if (isBtc) {
    amount = Math.max(0, amount - RISK_THRESHOLDS.router.gasReserveBtc);
  }

  if (!(amount > 0)) {
    throw new Error('Insufficient balance for this amount (after reserving gas for native BTC).');
  }
  return amount;
}

// ─── POST /api/parse-intent ────────────────────────────────────

apiRouter.post('/parse-intent', validateBody(ParseIntentSchema), async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (/\bmusd\b/i.test(prompt)) {
      await ensureMusdRegistered();
    }
    const result = await parseIntent(prompt);
    res.json(result);
  } catch (err) {
    if (err instanceof UnclearIntentError) {
      return rejectIntent(res, 422, 'Unclear intent', err.advise);
    }
    logger.error('Failed to parse intent', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to parse intent', details: (err as Error).message });
  }
});

// ─── POST /api/calculate-optimal-route ─────────────────────────

apiRouter.post(
  '/calculate-optimal-route',
  validateBody(CalculateRouteSchema),
  async (req: Request, res: Response) => {
    try {
      const { sourceAddress, destAddress, amount } = req.body;
      const route = await findOptimalRoute(sourceAddress, destAddress, amount);
      res.json(route);
    } catch (err) {
      logger.error('Failed to calculate route', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to calculate route', details: (err as Error).message });
    }
  }
);

// ─── POST /api/evaluate-guardian-risk ──────────────────────────

apiRouter.post(
  '/evaluate-guardian-risk',
  validateBody(EvaluateGuardianSchema),
  async (req: Request, res: Response) => {
    try {
      const { sourceSymbol, destSymbol, amount, route = [], execution_impact } = req.body;
      const assessment = await liquidityRiskGuardian.evaluate({
        sourceSymbol,
        destSymbol,
        amount: String(amount),
        route,
        executionImpact: execution_impact == null ? null : String(execution_impact),
      });
      res.json(liquidityRiskGuardian.buildGuardianResponse(assessment));
    } catch (err) {
      logger.error('Failed to evaluate guardian risk', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to evaluate risk', details: (err as Error).message });
    }
  }
);

// ─── POST /api/balance ─────────────────────────────────────────

apiRouter.post('/balance', validateBody(BalanceSchema), async (req: Request, res: Response) => {
  try {
    const { address, symbol } = req.body;
    if (symbol) {
      const formattedBalance = await getFormattedBalance(address, symbol);
      const price = await getTokenUsdPrice(symbol);
      const usd =
        price.priceUsd != null ? (parseFloat(formattedBalance) * price.priceUsd).toFixed(DISPLAY_DECIMALS.usd) : undefined;
      res.json({
        address,
        symbol,
        balance: formattedBalance,
        ...(usd !== undefined ? { usdValue: usd, priceSource: price.source } : {}),
      });
    } else {
      const all = await getAllBalances(address);
      const withUsd = await Promise.all(
        all.map(async (b) => {
          const price = await getTokenUsdPrice(b.symbol);
          if (price.priceUsd == null) return b;
          return {
            ...b,
            usdValue: (parseFloat(b.formattedBalance) * price.priceUsd).toFixed(DISPLAY_DECIMALS.usd),
            priceSource: price.source,
          };
        })
      );
      res.json({ address, balances: withUsd });
    }
  } catch (err) {
    logger.error('Failed to query balance', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch balance', details: (err as Error).message });
  }
});

// ─── POST /api/execute-swap ────────────────────────────────────

apiRouter.post(
  '/execute-swap',
  validateBody(ExecuteSwapSchema),
  async (req: Request, res: Response) => {
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
        acknowledgeRisk,
      } = req.body;

      // ── Guards: never build from invalid, unknown, or self-referential legs ──
      if (!isAddress(senderAddress) || senderAddress === ZERO_ADDRESS) {
        return rejectIntent(res, 422, 'A connected wallet address is required to execute a swap.', buildFallbackAdvise({
          error: 'missing_field',
          detail: 'Connect a wallet first — swaps cannot be built for an empty or zero address.',
          missing: ['senderAddress'],
        }));
      }
      const srcToken = resolveToken(sourceAddress || sourceSymbol);
      const dstToken = resolveToken(destAddress || destSymbol);
      if (!srcToken || !dstToken) {
        const missing = !srcToken ? (sourceAddress || sourceSymbol) : (destAddress || destSymbol);
        const { advise, tokenSuggestion } = await unknownTokenAdvise(`${sourceSymbol} to ${destSymbol}`, String(missing));
        return rejectIntent(res, 422, `Unknown token: ${missing}.`, advise, { tokenSuggestion });
      }
      if (srcToken.address.toLowerCase() === dstToken.address.toLowerCase()) {
        return rejectIntent(res, 422, 'Source and destination tokens must be different.', buildFallbackAdvise({
          error: 'missing_field',
          detail: `Swapping ${srcToken.symbol} to itself does nothing. Pick two different tokens.`,
          missing: ['destination token'],
        }));
      }
      const size = parseFloat(String(amount));
      if (!Number.isFinite(size) || size <= 0) {
        return rejectIntent(res, 422, 'Swap amount must be a positive number.', buildFallbackAdvise({
          error: 'missing_field',
          detail: 'Enter an amount greater than zero, or use ALL, MAX, or a percentage like 50%.',
          missing: ['amount'],
        }));
      }

      // ── Fresh on-chain quote (never trust a stale client-side route) ──
      let liveRouterData = routerData;
      let finalAmount = String(amount);
      try {
        const dynamicResolved = await resolveDynamicAmount(String(amount), senderAddress, srcToken.address, srcToken.symbol);
        if (dynamicResolved !== null) finalAmount = dynamicResolved.toFixed(DISPLAY_DECIMALS.amount);
        const liveRoute = await findOptimalRoute(srcToken.address, dstToken.address, finalAmount, slippage);
        liveRouterData = liveRoute.routerData;
      } catch (err) {
        const message = (err as Error).message;
        if (message.startsWith('NO_LIQUIDITY')) {
          return rejectIntent(res, 422, 'No live pool quote for this pair.', buildFallbackAdvise({
            error: 'unsupported_action',
            detail: 'No active pool quoted this pair on-chain. Try a hub pair like BTC/MUSD or reduce the amount.',
          }));
        }
        throw err;
      }

      const txResult = await buildMezoSwapTx({
        senderAddress: senderAddress as Address,
        sourceTokenAddress: srcToken.address,
        destTokenAddress: dstToken.address,
        sourceSymbol: srcToken.symbol,
        destSymbol: dstToken.symbol,
        amount: finalAmount,
        slippagePercent: slippage,
        routerData: liveRouterData,
      });

      // ── Guardian gate: unsafe quotes need an explicit user override ──
      const routeForGuardian = liveRouterData
        ? [{ dex: 'Mezo Swap', ratio: TX_CONFIG.singleRouteRatio, weight: 1 }]
        : [];
      const assessment = await liquidityRiskGuardian.evaluate({
        sourceSymbol: srcToken.symbol,
        destSymbol: dstToken.symbol,
        amount: finalAmount,
        route: routeForGuardian,
        executionImpact: null,
      });
      if (!assessment.safe && !acknowledgeRisk) {
        return rejectIntent(
          res,
          403,
          'Guardian blocked this swap: review the warnings and acknowledge the risk to proceed.',
          buildFallbackAdvise({
            error: 'unsupported_action',
            detail: `Guardian scored this swap ${assessment.score}/100 (${assessment.riskLevel}). Re-request with acknowledgeRisk=true after reviewing each WARNING/DANGER check.`,
          }),
          { guardian: assessment }
        );
      }

      res.json({ ...txResult, guardian: assessment });
    } catch (err) {
      logger.error('Failed to build swap transaction', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to build transaction', details: (err as Error).message });
    }
  }
);

// ─── POST /api/process-intent ──────────────────────────────────

apiRouter.post(
  '/process-intent',
  validateBody(ProcessIntentSchema),
  async (req: Request, res: Response) => {
    try {
      const { prompt, senderAddress = '', slippage } = req.body;
      const wallet = senderAddress && isAddress(senderAddress) ? (senderAddress as Address) : null;

      // MUSD is discovered on-chain (pool legs); ensure it resolves before parsing.
      if (/\bmusd\b/i.test(prompt)) {
        await ensureMusdRegistered();
      }

      // Step 1: Parse intent (unclear → 422 advise, never a fabricated intent)
      let parseResult;
      try {
        parseResult = await parseIntent(prompt);
      } catch (err) {
        if (err instanceof UnclearIntentError) {
          return rejectIntent(res, 422, 'Unclear intent', err.advise);
        }
        throw err;
      }
      const { intent } = parseResult;
      if (parseResult.validation_status !== 'VALID') {
        return rejectIntent(res, 422, 'Ambiguous intent — I need a clearer request.', buildFallbackAdvise({
          error: 'unclear_intent',
          detail: `I parsed "${prompt}" with low confidence (${parseResult.confidence_score.toFixed(2)}). Try one of the examples below.`,
        }));
      }

      // Step 1b: Conversational intents are answered from live chain data, never routed to a swap
      if (intent.action_type.startsWith('ASK_')) {
        if (intent.action_type === 'ASK_PRICE') {
          const price = await getTokenUsdPrice(intent.source_token_symbol);
          return res.json({
            intent,
            answer: price.priceUsd == null
              ? { kind: 'price', symbol: intent.source_token_symbol, priceUsd: null, note: 'Price is unavailable on-chain right now.' }
              : { kind: 'price', symbol: price.symbol, priceUsd: price.priceUsd, source: price.source, updatedAt: price.updatedAt },
            advise: null,
          });
        }
        if (intent.action_type === 'ASK_POOLS') {
          const pools = await listPools({ limit: 5, offset: 0 });
          
          let llmMessage = "I found some live pools on Mezo Testnet, but couldn't generate a detailed suggestion.";
          try {
            const prompt = `Here are the top liquidity pools on our DEX on Mezo Testnet: ${JSON.stringify(pools.pools.map(p => ({ pair: `${p.token0.symbol}/${p.token1.symbol}`, tvlUsd: p.tvlUsd, apr: p.feePct })))}\nAnalyze these pools and suggest 1-2 potential pools to the user based on TVL and APR. Write a friendly, concise chat response.`;
            llmMessage = await generateLlmCompletion({
               systemPrompt: "You are a helpful DeFi assistant. Provide actionable and clear advice on liquidity pools. Keep it very concise.",
               userPrompt: prompt
            });
          } catch (e) {
            logger.error('Failed to generate pool suggestion', { error: (e as Error).message });
          }

          return res.json({
            intent,
            answer: {
              kind: 'pools',
              pools: pools.pools.map((p) => ({
                address: p.address,
                pair: `${p.token0.symbol}/${p.token1.symbol}`,
                tvlUsd: p.tvlUsd,
                feePct: p.feePct,
                stable: p.stable,
              })),
              totalPairs: pools.totalPairs,
            },
            advise: buildFallbackAdvise({
              error: 'unsupported_action',
              detail: llmMessage
            }),
          });
        }
        if (intent.action_type === 'ASK_RISK') {
          const chainState = await liquidityRiskGuardian.checkChainState();
          return res.json({
            intent,
            answer: {
              kind: 'risk',
              chainState,
              note: 'Chain-state snapshot only. Run a swap quote for a full route assessment with price impact, liquidity, and oracle checks.',
            },
            advise: null,
          });
        }
        if (intent.action_type === 'ASK_BRIDGE_STATUS') {
          const info = await getBridgeInfo();
          return res.json({
            intent,
            answer: {
              kind: 'bridge',
              enabledChains: info.enabledChains.map((c) => ({ id: c, name: BRIDGE_CHAIN_NAMES[c] ?? `Chain ${c}` })),
              outflowCapacities: info.outflowCapacities,
              minBridgeOutAmounts: info.minBridgeOutAmounts,
            },
            advise: null,
          });
        }
        if (intent.action_type === 'ASK_GAS') {
          const client = getPublicClient();
          const gasPrice = await client.getGasPrice();
          const gwei = Number(gasPrice) / 1e9;
          return res.json({
            intent,
            answer: {
              kind: 'gas',
              gasPriceWei: gasPrice.toString(),
              gasPriceGwei: Number.isFinite(gwei) ? gwei : null,
              warnAboveGwei: TX_CONFIG.gasWarnGwei,
              elevated: Number.isFinite(gwei) ? gwei > TX_CONFIG.gasWarnGwei : null,
            },
            advise: null,
          });
        }
        return res.json({
          intent,
          answer: {
            kind: 'help',
            capabilities: getCapabilities(),
            note: 'Soka executes Swaps, Bridge-Outs, and Liquidity actions on Mezo Testnet. Borrows are quotes only (no lending pool configured).',
          },
          advise: null,
        });
      }

      // Step 1c: TRANSFER builds a real transfer tx (never a swap)
      if (intent.action_type === 'TRANSFER') {
        if (!intent.recipient || !isEvmAddress(intent.recipient)) {
          return rejectIntent(res, 422, 'TRANSFER needs a recipient address.', buildFallbackAdvise({
            error: 'missing_field',
            detail: 'Who should receive the tokens? Provide an EVM address (0x + 40 hex chars). Example: "Send 10 MUSD to 0x…".',
            missing: ['recipient'],
          }));
        }
        if (!wallet) {
          return rejectIntent(res, 422, 'Connect a wallet to build a transfer.', buildFallbackAdvise({
            error: 'missing_field',
            detail: 'Transfers move real funds — connect a wallet first so the transaction targets your address.',
            missing: ['senderAddress'],
          }));
        }
        try {
          const transferTx = await buildTransferTx({
            senderAddress: wallet,
            tokenSymbol: intent.source_token_symbol,
            tokenAddress: intent.source_token_address,
            amount: intent.trade_amount,
            recipient: intent.recipient,
          });
          return res.json({ intent, transfer: transferTx, advise: null });
        } catch (err) {
          return rejectIntent(res, 422, 'Cannot build transfer.', buildFallbackAdvise({
            error: 'missing_field',
            detail: (err as Error).message,
          }));
        }
      }

      // Step 1d: Unknown tokens → candidates, never the zero address
      const srcToken = resolveToken(intent.source_token_address || intent.source_token_symbol);
      const dstToken = resolveToken(intent.destination_token_address || intent.destination_token_symbol);
      if (!srcToken || !dstToken) {
        const missing = !srcToken ? intent.source_token_symbol : intent.destination_token_symbol;
        const { advise, tokenSuggestion } = await unknownTokenAdvise(prompt, missing);
        return rejectIntent(res, 422, `Unknown token: ${missing}.`, advise, { tokenSuggestion });
      }

      // Handle bridge intent with parsed chain/recipient + on-chain preflight
      if (intent.action_type === 'BRIDGE_OUT' || intent.action_type === 'BRIDGE') {
        const destinationChain = intent.destination_chain ?? BRIDGE_CONFIG.defaultChain;
        const recipient = intent.recipient || senderAddress;
        const recipientError = validateBridgeRecipient(recipient, destinationChain);
        if (recipientError) {
          return rejectIntent(res, 422, 'BRIDGE_OUT needs a valid recipient.', buildFallbackAdvise({
            error: 'missing_field',
            detail: `${recipientError} Example: "Bridge 0.1 wBTC to Ethereum 0x…". Supported chains: ${Object.entries(BRIDGE_CHAIN_NAMES).map(([id, name]) => `${name} (${id})`).join(', ')}.`,
            missing: ['recipient'],
          }));
        }
        const amountNum = parseFloat(intent.trade_amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return rejectIntent(res, 422, 'Bridge amount must be a positive number.', buildFallbackAdvise({
            error: 'missing_field',
            detail: 'Enter an amount greater than zero, or use ALL, MAX, or a percentage.',
            missing: ['amount'],
          }));
        }
        try {
          const bridgeTx = await buildBridgeOutTx({
            senderAddress: (wallet ?? ZERO_ADDRESS) as Address,
            tokenAddress: srcToken.address as Address,
            amount: intent.trade_amount,
            destinationChain,
            recipient,
          });
          const [chains, capacity, minAmount] = await Promise.all([
            getBridgeOutChains(),
            getOutflowCapacity(srcToken.address as Address),
            getMinBridgeOutAmount(srcToken.address as Address),
          ]);
          return res.json({
            intent: { ...intent, destination_chain: destinationChain, recipient },
            route: {
              route: [],
              dex_sequence: ['Mezo Assets Bridge'],
              expected_output: amountNum,
              minimum_output: amountNum,
              execution_impact: null,
              route_confidence: 1.0,
              dynamicPoolUsed: false,
              poolDetails: null,
            },
            // Bridge risk is expressed through live preflight data, not a swap guardian.
            guardian: null,
            bridge: {
              destinationChain,
              chainName: BRIDGE_CHAIN_NAMES[destinationChain] ?? `Chain ${destinationChain}`,
              enabledChains: chains,
              outflowCapacity: capacity != null ? capacity.toString() : 'unknown',
              minAmount: minAmount != null ? minAmount.toString() : 'unknown',
              quoteOnly: !wallet,
            },
            advise: wallet ? null : buildFallbackAdvise({
              error: 'missing_field',
              detail: 'Quote preview only — connect a wallet to sign the bridge transaction.',
              missing: ['senderAddress'],
            }),
            ptb: bridgeTx,
          });
        } catch (err) {
          return rejectIntent(res, 422, 'Cannot build bridge transaction.', buildFallbackAdvise({
            error: 'unsupported_action',
            detail: (err as Error).message,
          }));
        }
      }

      // Step 2: Same-token and amount guards
      if (srcToken.address.toLowerCase() === dstToken.address.toLowerCase()) {
        return rejectIntent(res, 422, 'Source and destination tokens must be different.', buildFallbackAdvise({
          error: 'missing_field',
          detail: `Swapping ${srcToken.symbol} to itself does nothing. Pick two different tokens.`,
          missing: ['destination token'],
        }));
      }
      let finalAmount = intent.trade_amount;
      try {
        const dynamicResolved = await resolveDynamicAmount(
          intent.trade_amount,
          wallet ?? '',
          srcToken.address,
          srcToken.symbol
        );
        if (dynamicResolved !== null) {
          finalAmount = dynamicResolved.toFixed(DISPLAY_DECIMALS.amount);
        } else {
          const size = parseFloat(intent.trade_amount);
          if (!Number.isFinite(size) || size <= 0) {
            return rejectIntent(res, 422, 'Swap amount must be a positive number.', buildFallbackAdvise({
              error: 'missing_field',
              detail: 'Enter an amount greater than zero, or use ALL, MAX, or a percentage like 50%.',
              missing: ['amount'],
            }));
          }
        }
      } catch (err) {
        return rejectIntent(res, 422, 'Cannot resolve trade amount.', buildFallbackAdvise({
          error: 'missing_field',
          detail: (err as Error).message,
        }));
      }

      // Step 2b: Balance gate — suggest funded alternatives instead of a doomed quote
      if (wallet) {
        try {
          const balString = await getFormattedBalance(wallet, srcToken.address);
          const have = parseFloat(balString);
          if (Number.isFinite(have) && have < parseFloat(finalAmount)) {
            const alternatives = await findAlternativeSources({
              walletAddress: wallet,
              destAddress: dstToken.address,
              intendedSourceAddress: srcToken.address,
              intendedAmount: finalAmount,
            });
            return rejectIntent(res, 422, `Insufficient ${srcToken.symbol} balance.`, buildFallbackAdvise({
              error: 'missing_field',
              detail: `Wallet holds ${balString} ${srcToken.symbol} but the swap needs ${finalAmount}.${alternatives.length > 0 ? ' Fund it with one of these held tokens instead:' : ' No other funded token can cover it.'}`,
              missing: [`${srcToken.symbol} balance`],
            }), { alternativeSource: alternatives });
          }
        } catch (err) {
          logger.warn(`Balance gate skipped: ${(err as Error).message}`);
        }
      }

      // Slippage: explicit body value wins; otherwise honor the LLM constraint.
      let effectiveSlippage = slippage as number;
      const slipConstraint = intent.user_constraints.find((c) => c.type === 'slippage');
      if (slipConstraint) {
        const parsed = parseFloat(slipConstraint.value);
        if (Number.isFinite(parsed) && parsed >= 0) effectiveSlippage = parsed;
      }

      // Step 3: Find route (NO_LIQUIDITY → advise, never a synthetic route)
      let routeResult;
      try {
        routeResult = await findOptimalRoute(srcToken.address, dstToken.address, finalAmount, effectiveSlippage);
      } catch (err) {
        const message = (err as Error).message;
        if (message.startsWith('NO_LIQUIDITY')) {
          return rejectIntent(res, 422, 'No live pool quote for this pair.', buildFallbackAdvise({
            error: 'unsupported_action',
            detail: 'No active pool quoted this pair on-chain. Try a hub pair like BTC/MUSD or reduce the amount.',
          }));
        }
        throw err;
      }

      // Step 4: Evaluate Guardian risk (unsafe → 403 without explicit override)
      const assessment = await liquidityRiskGuardian.evaluate({
        sourceSymbol: srcToken.symbol,
        destSymbol: dstToken.symbol,
        amount: finalAmount,
        route: routeResult.route,
        executionImpact: routeResult.execution_impact,
        expectedOutput: routeResult.expected_output,
        poolDetails: routeResult.poolDetails,
      });
      const acknowledgeRisk = (req.body as { acknowledgeRisk?: boolean }).acknowledgeRisk === true;
      if (!assessment.safe && !acknowledgeRisk) {
        return rejectIntent(
          res,
          403,
          'Guardian blocked this quote: review the warnings and acknowledge the risk to proceed.',
          buildFallbackAdvise({
            error: 'unsupported_action',
            detail: `Guardian scored this route ${assessment.score}/100 (${assessment.riskLevel}). Re-request with acknowledgeRisk=true after reviewing each WARNING/DANGER check.`,
          }),
          {
            intent: { ...intent, trade_amount: finalAmount },
            route: routeResult,
            guardian: {
              safe: assessment.safe,
              score: assessment.score,
              riskLevel: assessment.riskLevel,
              checks: assessment.checks,
            },
          }
        );
      }

      // Step 5: Build unsigned transaction (quote-only when wallet is disconnected)
      const txResult = await buildMezoSwapTx({
        senderAddress: (wallet ?? ZERO_ADDRESS) as Address,
        sourceTokenAddress: srcToken.address,
        destTokenAddress: dstToken.address,
        sourceSymbol: srcToken.symbol,
        destSymbol: dstToken.symbol,
        amount: finalAmount,
        slippagePercent: effectiveSlippage,
        routerData: routeResult.routerData,
      });

      res.json({
        intent: { ...intent, trade_amount: finalAmount },
        route: routeResult,
        guardian: {
          safe: assessment.safe,
          score: assessment.score,
          riskLevel: assessment.riskLevel,
          checks: assessment.checks,
        },
        advise: wallet ? null : buildFallbackAdvise({
          error: 'missing_field',
          detail: 'Quote preview only — connect a wallet to sign this swap.',
          missing: ['senderAddress'],
        }),
        ptb: txResult,
      });
    } catch (err) {
      logger.error('Failed to process intent pipeline', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to process intent', details: (err as Error).message });
    }
  }
);

// ─── POST /api/bridge-out ──────────────────────────────────────

apiRouter.post(
  '/bridge-out',
  validateBody(BridgeOutSchema),
  async (req: Request, res: Response) => {
    try {
      const { senderAddress, tokenAddress, amount, destinationChain, recipient } = req.body;
      const result = await buildBridgeOutTx({
        senderAddress: senderAddress as Address,
        tokenAddress: tokenAddress as Address,
        amount: String(amount),
        destinationChain,
        recipient,
      });
      res.json(result);
    } catch (err) {
      logger.error('Failed to build bridge-out transaction', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to build bridge transaction', details: (err as Error).message });
    }
  }
);

// ─── GET / POST /api/bridge-info ───────────────────────────────

const handleBridgeInfo = async (_req: Request, res: Response) => {
  try {
    const info = await getBridgeInfo();
    res.json(info);
  } catch (err) {
    logger.error('Failed to get bridge info', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch bridge info', details: (err as Error).message });
  }
};

apiRouter.get('/bridge-info', handleBridgeInfo);
apiRouter.post('/bridge-info', handleBridgeInfo);

// ─── POST /api/mezo-rpc (read-only proxy) ────────────────────────

const handleRpcProxy = async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;
    const result = await mezoRpcProxy(method, params);
    res.json({ jsonrpc: '2.0', id: req.body.id || 1, result });
  } catch (err) {
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || 1,
      error: { code: -32600, message: (err as Error).message },
    });
  }
};

apiRouter.post('/mezo-rpc', handleRpcProxy);

// ─── POST /api/transfer ─────────────────────────────────────────
// Builds an unsigned ERC-20 / native transfer (never a swap).

apiRouter.post('/transfer', validateBody(TransferSchema), async (req: Request, res: Response) => {
  try {
    const { senderAddress, tokenSymbol, tokenAddress, amount, recipient } = req.body;
    const tx = await buildTransferTx({ senderAddress, tokenSymbol, tokenAddress, amount, recipient });
    res.json(tx);
  } catch (err) {
    logger.error('Failed to build transfer transaction', { error: (err as Error).message });
    res.status(422).json({
      error: 'Cannot build transfer.',
      advise: buildFallbackAdvise({ error: 'missing_field', detail: (err as Error).message }),
    });
  }
});

// ─── GET /api/capabilities ──────────────────────────────────────
// Single source of truth for what the system can execute, quote, or refuse.

apiRouter.get('/capabilities', (_req: Request, res: Response) => {
  res.json({ capabilities: getCapabilities() });
});

// ─── GET /api/tokens ────────────────────────────────────────────
// Supported token list: static whitelist plus on-chain discovered tokens.

apiRouter.get('/tokens', async (_req: Request, res: Response) => {
  try {
    await ensureMusdRegistered().catch(() => undefined);
    const { resolveToken: resolve } = await import('../services/coin/tokenResolver.js');
    const musd = resolve('MUSD');
    const tokens = [
      ...TOKEN_WHITELIST.map((t) => ({
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        decimals: t.decimals,
        isStable: t.isStable,
        aliases: t.aliases,
        source: 'whitelist' as const,
      })),
      ...(musd && !TOKEN_WHITELIST.some((t) => t.symbol === 'MUSD')
        ? [{ symbol: musd.symbol, name: musd.name, address: musd.address, decimals: musd.decimals, isStable: true, aliases: musd.aliases, source: 'on-chain' as const }]
        : []),
    ];
    res.json({ tokens });
  } catch (err) {
    logger.error('Failed to list tokens', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to list tokens', details: (err as Error).message });
  }
});

// ─── GET /api/gas-price ─────────────────────────────────────────
// Live network gas price with the operator warning threshold.

apiRouter.get('/gas-price', async (_req: Request, res: Response) => {
  try {
    const client = getPublicClient();
    const gasPrice = await client.getGasPrice();
    const gwei = Number(gasPrice) / 1e9;
    res.json({
      gasPriceWei: gasPrice.toString(),
      gasPriceGwei: Number.isFinite(gwei) ? gwei : null,
      warnAboveGwei: TX_CONFIG.gasWarnGwei,
      elevated: Number.isFinite(gwei) ? gwei > TX_CONFIG.gasWarnGwei : null,
    });
  } catch (err) {
    logger.error('Failed to read gas price', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to read gas price', details: (err as Error).message });
  }
});

// ─── POST /api/risk-summary ───────────────────────────────────

apiRouter.post(
  '/risk-summary',
  validateBody(RiskSummarySchema),
  async (req: Request, res: Response) => {
    try {
      const { sourceToken, destToken, amount, guardianChecks, routeNodes } = req.body;
      const summary = await getRiskSummary(guardianChecks, sourceToken, destToken, amount, routeNodes);
      res.json(summary);
    } catch (err) {
      logger.error('Failed to generate risk summary', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to generate summary', details: (err as Error).message });
    }
  }
);

// ─── POST /api/risk-advice ────────────────────────────────────

apiRouter.post('/risk-advice', validateBody(RiskAdviceSchema), async (req: Request, res: Response) => {
  try {
    const { sourceToken, destToken, risks } = req.body;
    const advice = await summarizeRiskAdvice(sourceToken, destToken, risks);
    res.json({ advice });
  } catch (err) {
    logger.error('Failed to generate risk advice', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to generate advice', details: (err as Error).message });
  }
});

// ─── GET /api/prices ────────────────────────────────────────────
// Real USD prices from the PriceOracle precompile + router quotes.
// Unknown prices resolve to null (never estimated).

apiRouter.get('/prices', async (req: Request, res: Response) => {
  try {
    const parsed = PricesQuerySchema.safeParse(req.query);
    const symbols = parsed.success && parsed.data.symbols
      ? parsed.data.symbols.split(',').map((s) => s.trim()).filter(Boolean)
      : TOKEN_WHITELIST.map((t) => t.symbol);
    const prices = await getPricesForSymbols(symbols);
    res.json({ prices });
  } catch (err) {
    logger.error('Failed to fetch prices', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch prices', details: (err as Error).message });
  }
});

// ─── GET /api/pools ─────────────────────────────────────────────
// Real pools enumerated from the Mezo Swap factory.

apiRouter.get('/pools', async (req: Request, res: Response) => {
  try {
    const parsed = PoolsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    const result = await listPools({
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      walletAddress: parsed.data.wallet,
    });
    res.json(result);
  } catch (err) {
    logger.error('Failed to list pools', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to list pools', details: (err as Error).message });
  }
});

// ─── GET /api/pools/:address ─────────────────────────────────────

apiRouter.get('/pools/:address', async (req: Request, res: Response) => {
  try {
    const parsedAddr = PoolAddressParamSchema.safeParse(req.params);
    if (!parsedAddr.success) {
      return res.status(400).json({ error: 'Invalid pool address' });
    }
    const parsedQuery = PoolsQuerySchema.safeParse(req.query);
    const wallet = parsedQuery.success ? parsedQuery.data.wallet : undefined;
    const pool = await getPoolDetail(parsedAddr.data.address, wallet);
    res.json(pool);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.startsWith('Invalid pool address') || message.startsWith('Address is not')
      ? 404
      : 500;
    logger.error('Failed to fetch pool detail', { error: message });
    res.status(status).json({ error: 'Failed to fetch pool', details: message });
  }
});

// ─── POST /api/pools/quote-liquidity ────────────────────────────
// Read-only add-liquidity preview (execution unavailable, see response).

apiRouter.post('/pools/quote-liquidity', validateBody(QuoteLiquiditySchema), async (req: Request, res: Response) => {
  try {
    const quote = await quoteAddLiquidity(req.body);
    res.json(quote);
  } catch (err) {
    logger.error('Failed to quote liquidity', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to quote liquidity', details: (err as Error).message });
  }
});

// ─── POST /api/pools/quote-paired ─────────────────────────────────
// Reserve-proportional paired leg: input one side, get the matching other
// side at live reserves (replaces 1:1 guessing across decimals/prices).

apiRouter.post('/pools/quote-paired', validateBody(QuotePairedSchema), async (req: Request, res: Response) => {
  try {
    const paired = await quotePairedAmount(req.body);
    res.json(paired);
  } catch (err) {
    logger.error('Failed to quote paired amount', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to quote paired amount', details: (err as Error).message });
  }
});

// ─── POST /api/borrow-quote ─────────────────────────────────────
// Read-only borrow preview from real balances and on-chain prices.

apiRouter.post('/borrow-quote', validateBody(BorrowQuoteSchema), async (req: Request, res: Response) => {
  try {
    await ensureMusdRegistered().catch(() => undefined);
    const quote = await getBorrowQuote(req.body);
    res.json(quote);
  } catch (err) {
    logger.error('Failed to quote borrow', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to quote borrow', details: (err as Error).message });
  }
});

// ─── POST /api/borrow-reverse-quote ─────────────────────────────
// Calculates exact collateral needed for a desired borrow amount.

apiRouter.post('/borrow-reverse-quote', validateBody(BorrowReverseQuoteSchema), async (req: Request, res: Response) => {
  try {
    await ensureMusdRegistered().catch(() => undefined);
    const quote = await getBorrowReverseQuote(req.body);
    res.json(quote);
  } catch (err) {
    if (err instanceof BorrowReverseError) {
      return rejectIntent(res, 422, err.message, err.advise);
    }
    logger.error('Failed to reverse quote borrow', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to reverse quote borrow', details: (err as Error).message });
  }
});

// ─── POST /api/borrow-execute ───────────────────────────────────
// Builds a mock execution payload for UI demonstration since no pool exists.

apiRouter.post('/borrow-execute', validateBody(BorrowMockExecuteSchema), async (req: Request, res: Response) => {
  try {
    await ensureMusdRegistered().catch(() => undefined);
    const tx = await buildBorrowTx(req.body);
    res.json(tx);
  } catch (err) {
    logger.error('Failed to build borrow mock execution', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to build borrow mock execution', details: (err as Error).message });
  }
});

// ─── POST /api/pools/quote-remove ───────────────────────────────
// Read-only remove-liquidity preview.

apiRouter.post('/pools/quote-remove', validateBody(RemoveLiquiditySchema.omit({ senderAddress: true })), async (req: Request, res: Response) => {
  try {
    const quote = await quoteRemoveLiquidity(req.body);
    res.json(quote);
  } catch (err) {
    logger.error('Failed to quote remove liquidity', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to quote remove liquidity', details: (err as Error).message });
  }
});

// ─── POST /api/pools/add-liquidity ──────────────────────────────
// Builds unsigned addLiquidity calldata for real execution.

apiRouter.post('/pools/add-liquidity', validateBody(AddLiquiditySchema), async (req: Request, res: Response) => {
  try {
    const tx = await buildAddLiquidityTx(req.body);
    res.json(tx);
  } catch (err) {
    logger.error('Failed to build add liquidity transaction', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to build add liquidity transaction', details: (err as Error).message });
  }
});

// ─── POST /api/pools/remove-liquidity ───────────────────────────
// Builds unsigned removeLiquidity calldata for real execution.

apiRouter.post('/pools/remove-liquidity', validateBody(RemoveLiquiditySchema), async (req: Request, res: Response) => {
  try {
    const tx = await buildRemoveLiquidityTx(req.body);
    res.json(tx);
  } catch (err) {
    logger.error('Failed to build remove liquidity transaction', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to build remove liquidity transaction', details: (err as Error).message });
  }
});
