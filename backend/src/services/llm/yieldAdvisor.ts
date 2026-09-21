/**
 * Soka Intent Engine — Yield & Borrow Advisor
 * Analyzes on-chain liquidity pools and synthesizes open DeFi capital allocation advice,
 * introducing both top AMM liquidity pools and Mezo Borrow options for the user's asset.
 */

import { generateLlmCompletion } from './llmClient.js';
import { logger } from '../../utils/logger.js';
import { LENDING_CONFIG } from '../../config/index.js';
import type { PoolInfo } from '../pools/poolService.js';

export interface YieldAdvisorResult {
  message: string;
  targetToken: string;
  bestPools: Array<{
    pair: string;
    address: string;
    tvlUsd: number | null;
    feePct: number | null;
    stable: boolean | null;
  }>;
  borrowOptions: Array<{
    collateralSymbol: string;
    debtSymbol: string;
    aprPct: number;
    maxLtv: number;
  }>;
}

/** Builds deterministic English fallback message when LLM is unreachable. */
function buildDeterministicYieldMessage(
  tokenSymbol: string,
  topPool: { pair: string; tvlUsd: number | null; feePct: number | null } | null,
  borrowAprMusd: number,
  borrowAprMusdc: number,
  maxLtvPct: number
): string {
  const poolInfo = topPool
    ? `The top-yielding pool for ${tokenSymbol} is ${topPool.pair}${topPool.tvlUsd ? ` with ~$${Math.round(topPool.tvlUsd).toLocaleString()} TVL` : ''} earning ${topPool.feePct ?? '0.04'}% swap fees.`
    : `You can supply liquidity to the BTC/MUSD pool to earn trading fees on Mezo Swap.`;

  const borrowInfo = tokenSymbol.toUpperCase() === 'BTC' || tokenSymbol.toUpperCase() === 'WBTC'
    ? ` Alternatively, you can use Mezo Borrow to pledge your BTC as collateral and borrow MUSD at ${borrowAprMusd}% APR or mUSDC at ${borrowAprMusdc}% APR (up to ${maxLtvPct}% LTV) without selling your Bitcoin or taking on impermanent loss.`
    : ` Alternatively, explore Mezo Borrow to unlock capital against your assets at competitive interest rates.`;

  return `${poolInfo}${borrowInfo} Choose an option below to proceed!`;
}

/**
 * Synthesizes open capital allocation advice comparing AMM pool yields and Mezo Borrow.
 */
export async function adviseYieldAndBorrow(params: {
  userPrompt: string;
  tokenSymbol?: string;
  pools: PoolInfo[];
  walletAddress?: string;
}): Promise<YieldAdvisorResult> {
  const { userPrompt, pools } = params;
  const tokenSymbol = (params.tokenSymbol || 'BTC').toUpperCase();

  // 1. Identify relevant pools containing the target token
  const matchingPools = pools.filter(
    (p) =>
      p.token0.symbol.toUpperCase() === tokenSymbol ||
      p.token1.symbol.toUpperCase() === tokenSymbol
  );

  const poolsToRank = matchingPools.length > 0 ? matchingPools : pools;
  const sortedPools = [...poolsToRank].sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
  const topPools = sortedPools.slice(0, 3);

  const bestPools = topPools.map((p) => ({
    pair: `${p.token0.symbol}/${p.token1.symbol}`,
    address: p.address,
    tvlUsd: p.tvlUsd,
    feePct: p.feePct,
    stable: p.stable,
  }));

  // 2. Assemble Mezo Borrow parameters
  const borrowAprMusd = LENDING_CONFIG.aprForSymbol('MUSD') ?? 4.5;
  const borrowAprMusdc = LENDING_CONFIG.aprForSymbol('MUSDC') ?? 3.8;
  const maxLtvPct = Math.round(LENDING_CONFIG.maxLtv * 100);

  const borrowOptions = [
    {
      collateralSymbol: tokenSymbol,
      debtSymbol: 'MUSD',
      aprPct: borrowAprMusd,
      maxLtv: LENDING_CONFIG.maxLtv,
    },
    {
      collateralSymbol: tokenSymbol,
      debtSymbol: 'mUSDC',
      aprPct: borrowAprMusdc,
      maxLtv: LENDING_CONFIG.maxLtv,
    },
  ];

  const topPoolSummary = bestPools.length > 0 ? bestPools[0] : null;
  const fallbackMessage = buildDeterministicYieldMessage(
    tokenSymbol,
    topPoolSummary,
    borrowAprMusd,
    borrowAprMusdc,
    maxLtvPct
  );

  // 3. Prompt LLM for open, intelligent DeFi advisory response
  const systemPrompt = `You are Soka AI, the premier DeFi yield and capital efficiency copilot on Mezo Network (Bitcoin Layer 2 EVM).
The user is asking about getting the best return, pool yields, or capital allocation for: "${tokenSymbol}".

Context:
- Live Mezo Swap pools: ${JSON.stringify(bestPools)}
- Mezo Borrow feature: Users can deposit ${tokenSymbol} as collateral and borrow stablecoins (MUSD @ ${borrowAprMusd}% APR, mUSDC @ ${borrowAprMusdc}% APR) with up to ${maxLtvPct}% Max LTV.

YOUR TASK:
Write a friendly, concise, and complete open advisory response (2 to 4 sentences, under 65 words).
1. Highlight the best liquidity pool for ${tokenSymbol} on Mezo Swap (pair name, TVL, and fee yield).
2. Introduce Mezo Borrow: explain that instead of risking impermanent loss in a pool, they can also use their ${tokenSymbol} as collateral to borrow stablecoins (MUSD at ${borrowAprMusd}% APR or mUSDC at ${borrowAprMusdc}% APR) while retaining full upside of their assets.
3. ALWAYS reply strictly in ENGLISH. Never use any other language.
4. Speak naturally like an expert DeFi advisor. Do NOT use markdown code blocks or json.`;

  try {
    const completion = await generateLlmCompletion({
      systemPrompt,
      userPrompt: `User query: "${userPrompt}". Provide actionable yield and borrow guidance for ${tokenSymbol} in English.`,
      temperature: 0.3,
      maxTokens: 1024,
    });

    const cleaned = completion.trim().replace(/^["']|["']$/g, '');
    if (cleaned.length > 20) {
      return {
        message: cleaned,
        targetToken: tokenSymbol,
        bestPools,
        borrowOptions,
      };
    }
  } catch (err) {
    logger.warn('Yield & Borrow advisor LLM call failed, using fallback', {
      error: (err as Error).message,
    });
  }

  return {
    message: fallbackMessage,
    targetToken: tokenSymbol,
    bestPools,
    borrowOptions,
  };
}
