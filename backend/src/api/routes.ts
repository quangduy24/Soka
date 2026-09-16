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
 * - POST /api/mezo-rpc                — Safe JSON-RPC proxy for Mezo Testnet
 */

import { Router, type Request, type Response } from 'express';
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
  QuoteLiquiditySchema,
  AddLiquiditySchema,
  RemoveLiquiditySchema,
} from '../types/index.js';
import { RISK_THRESHOLDS, ZERO_ADDRESS } from '../config/index.js';
import { TOKEN_WHITELIST } from '../config/constant.js';
import { getPricesForSymbols, getTokenUsdPrice } from '../services/prices/priceService.js';
import { listPools, getPoolDetail, quoteAddLiquidity, quoteRemoveLiquidity, buildAddLiquidityTx, buildRemoveLiquidityTx, ensureMusdRegistered } from '../services/pools/poolService.js';
import { getBorrowQuote } from '../services/lending/borrowService.js';
import { parseIntent } from '../services/llm/intentParser.js';
import { findOptimalRoute } from '../services/router/mezoRouter.js';
import { buildMezoSwapTx } from '../services/router/mezoTxBuilder.js';
import {
  resolveToken,
  resolveTokenAddress,
  searchTokenCandidates,
  isWhitelistedToken,
  resolveTokenLogo,
  getTokenDecimalsAsync,
} from '../services/coin/tokenResolver.js';
import { summarizeTokenMatches } from '../services/llm/tokenAdvisor.js';
import { getRiskSummary, summarizeRiskAdvice } from '../services/llm/riskAdvisor.js';
import { findAlternativeSources } from '../services/coin/alternativeSource.js';
import { liquidityRiskGuardian } from '../services/risk/LiquidityRiskGuardian.js';
import { checkTokenSafety } from '../services/safety/TokenSafety.js';
import { getFormattedBalance, getAllBalances } from '../services/coin/coinService.js';
import { buildBridgeOutTx, getBridgeInfo } from '../services/bridge/bridgeService.js';
import { mezoRpcProxy } from '../utils/mezoClient.js';
import { logger } from '../utils/logger.js';
import type { Address } from 'viem';

export const apiRouter = Router();

/**
 * Resolve dynamic trade amounts ("ALL" / "MAX" / "N%") by reading wallet balance.
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

  const balString = await getFormattedBalance(walletAddress, sourceAddress || sourceSymbol);
  const human = parseFloat(balString) || 0;
  const fraction = isAll ? 1 : parseFloat(pct![1]) / 100;
  let amount = human * fraction;

  // Reserve a small amount of BTC for gas when swapping native Bitcoin
  const isBtc = sourceSymbol.toUpperCase() === 'BTC' || sourceAddress === ZERO_ADDRESS;
  if (isBtc) {
    amount = Math.max(0, amount - RISK_THRESHOLDS.router.gasReserveBtc);
  }

  return amount > 0 ? amount : null;
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
      const { sourceSymbol, destSymbol, route = [], execution_impact = '0.1%' } = req.body;
      const assessment = await liquidityRiskGuardian.evaluate({
        sourceSymbol,
        destSymbol,
        amount: '1',
        route,
        executionImpact: String(execution_impact),
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
        price.priceUsd != null ? (parseFloat(formattedBalance) * price.priceUsd).toFixed(2) : undefined;
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
            usdValue: (parseFloat(b.formattedBalance) * price.priceUsd).toFixed(2),
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
      } = req.body;

      const srcAddr = sourceAddress || resolveTokenAddress(sourceSymbol);
      const dstAddr = destAddress || resolveTokenAddress(destSymbol);

      const txResult = await buildMezoSwapTx({
        senderAddress: senderAddress as Address,
        sourceTokenAddress: srcAddr,
        destTokenAddress: dstAddr,
        sourceSymbol,
        destSymbol,
        amount,
        slippagePercent: slippage,
        routerData,
      });

      res.json(txResult);
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
      const { prompt, senderAddress, slippage = 0.5 } = req.body;

      // MUSD is discovered on-chain (pool legs); ensure it resolves before parsing.
      if (/\bmusd\b/i.test(prompt)) {
        await ensureMusdRegistered();
      }

      // Step 1: Parse intent
      const parseResult = await parseIntent(prompt);
      const { intent } = parseResult;

      // Handle bridge intent if requested
      if (intent.action_type === 'BRIDGE_OUT' || intent.action_type === 'BRIDGE') {
        const tokenAddr = (intent.source_token_address || resolveTokenAddress(intent.source_token_symbol)) as Address;
        const bridgeTx = await buildBridgeOutTx({
          senderAddress: senderAddress as Address,
          tokenAddress: tokenAddr,
          amount: intent.trade_amount,
          destinationChain: 0, // Ethereum default
          recipient: senderAddress,
        });

        return res.json({
          intent,
          route: {
            route: [],
            dex_sequence: ['Mezo Assets Bridge'],
            expected_output: parseFloat(intent.trade_amount) || 0,
            minimum_output: parseFloat(intent.trade_amount) || 0,
            execution_impact: '0.00%',
            route_confidence: 1.0,
            dynamicPoolUsed: false,
            poolDetails: null,
          },
          guardian: {
            safe: true,
            score: 100,
            riskLevel: 'LOW',
            checks: [],
          },
          ptb: bridgeTx,
        });
      }

      // Step 2: Handle dynamic amounts (ALL / MAX / N%)
      let finalAmount = intent.trade_amount;
      const dynamicResolved = await resolveDynamicAmount(
        intent.trade_amount,
        senderAddress,
        intent.source_token_address,
        intent.source_token_symbol
      );
      if (dynamicResolved !== null) {
        finalAmount = dynamicResolved.toFixed(6);
      }

      // Step 3: Find route
      const srcAddr = intent.source_token_address || resolveTokenAddress(intent.source_token_symbol);
      const dstAddr = intent.destination_token_address || resolveTokenAddress(intent.destination_token_symbol);

      const routeResult = await findOptimalRoute(srcAddr, dstAddr, finalAmount, slippage);

      // Step 4: Evaluate Guardian risk
      const assessment = await liquidityRiskGuardian.evaluate({
        sourceSymbol: intent.source_token_symbol,
        destSymbol: intent.destination_token_symbol,
        amount: finalAmount,
        route: routeResult.route,
        executionImpact: routeResult.execution_impact,
        expectedOutput: routeResult.expected_output,
        poolDetails: routeResult.poolDetails,
      });

      // Step 5: Build unsigned transaction
      const txResult = await buildMezoSwapTx({
        senderAddress: senderAddress as Address,
        sourceTokenAddress: srcAddr,
        destTokenAddress: dstAddr,
        sourceSymbol: intent.source_token_symbol,
        destSymbol: intent.destination_token_symbol,
        amount: finalAmount,
        slippagePercent: slippage,
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

// ─── POST /api/mezo-rpc (and legacy /api/sui-rpc) ───────────────

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
apiRouter.post('/sui-rpc', handleRpcProxy);

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

// ─── POST /api/borrow-quote ─────────────────────────────────────
// Read-only borrow preview from real balances and on-chain prices.

apiRouter.post('/borrow-quote', validateBody(BorrowQuoteSchema), async (req: Request, res: Response) => {
  try {
    const quote = await getBorrowQuote(req.body);
    res.json(quote);
  } catch (err) {
    logger.error('Failed to quote borrow', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to quote borrow', details: (err as Error).message });
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
