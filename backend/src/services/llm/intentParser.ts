/**
 * Soka Intent Engine — Intent Parser
 * Parses natural language commands into structured swap or bridge intents for Mezo Testnet.
 * Uses OpenRouter LLM API with deterministic fallback.
 */

import { generateLlmCompletion } from './llmClient.js';
import { resolveToken, resolveTokenAddress } from '../coin/tokenResolver.js';
import { logger, createTimer } from '../../utils/logger.js';
import type { ParsedIntent, IntentParseResult, PriorityMode, UserConstraint, ActionType } from '../../types/index.js';

const SYSTEM_PROMPT = `
You are the Soka Intent Engine on Mezo Testnet (Bitcoin Layer 2 EVM).
Your job is to parse user natural language trading and bridging requests into strict JSON.

Tokens available on Mezo Testnet:
- BTC (Native Gas Currency, Bitcoin)
- wBTC (Wrapped Bitcoin ERC-20 precompile)
- MEZO (Mezo Governance Token)
- MUSD (Mezo USD stablecoin, core routing asset)
- mUSDC (USD Coin)
- mUSDT (Tether USD)
- mDAI (Maker DAI)
- mUSDe (Ethena USDe)
- mcbBTC (Coinbase BTC)
- mFBTC (Firelight BTC)
- mSolvBTC (Solv BTC)
- mswBTC (Swell BTC)
- mT (Threshold Token)

Output strictly valid JSON with no markdown and no backticks:
{
  "action_type": "SWAP" | "BRIDGE_OUT" | "TRANSFER",
  "trade_amount": "<numeric amount or 'ALL' or 'MAX'>",
  "source_token_symbol": "<symbol, e.g. BTC, mUSDC>",
  "destination_token_symbol": "<symbol, e.g. mUSDC, BTC>",
  "priority_mode": "SAFE" | "FAST" | "MAX_OUTPUT",
  "constraints": [
    { "type": "slippage" | "deadline" | "minOutput", "value": "<value>" }
  ]
}
If the user intent is unclear, return:
{ "error": "unclear_intent" }
`;

/**
 * Extracts the first complete top-level JSON object from text.
 */
function extractFirstJsonObject(raw: string): string | null {
  const text = raw.replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Deterministic rule-based parser fallback for standard trading and bridging commands.
 */
function parseDeterministic(prompt: string): any | null {
  const p = prompt.trim();
  const isBridge = /(bridge|cầu|chuyển cầu|withdraw to|deposit to)/i.test(p);
  const isSwap = /(swap|trade|exchange|convert|buy|sell|đổi|hoán đổi|bán|mua)/i.test(p);

  if (!isBridge && !isSwap) return null;

  let priorityMode: PriorityMode = 'SAFE';
  if (/(fast|quick|nhanh)/i.test(p)) priorityMode = 'FAST';
  else if (/(max|best rate|tối đa|tốt nhất)/i.test(p)) priorityMode = 'MAX_OUTPUT';

  let amount = 'MISSING';
  let source = '';
  let dest = '';
  const actionType: ActionType = isBridge ? 'BRIDGE_OUT' : 'SWAP';

  // Pattern 1: [action] [amount] [source] to/for/into [dest]
  const m1 = p.match(
    /(?:swap|trade|exchange|convert|buy|sell|bridge|chuyển)\s+(all|max|\d+(?:\.\d+)?%?)\s+([a-zA-Z0-9_:.]+)\s+(?:to|for|into|sang|thành|lấy)\s+([a-zA-Z0-9_:.]+)/i
  );
  if (m1) {
    amount = m1[1].toUpperCase();
    source = m1[2].toUpperCase();
    dest = m1[3].toUpperCase();
  } else {
    // Pattern 2: [action] [source] to/for [dest]
    const m2 = p.match(
      /(?:swap|trade|exchange|convert|buy|sell|bridge|chuyển)\s+([a-zA-Z0-9_:.]+)\s+(?:to|for|into|sang|thành|lấy)\s+([a-zA-Z0-9_:.]+)/i
    );
    if (m2) {
      source = m2[1].toUpperCase();
      dest = m2[2].toUpperCase();
    }
  }

  if (!source || !dest) return null;

  // Extract optional slippage constraint
  const constraints: { type: string; value: string }[] = [];
  const slipMatch = p.match(/(?:slippage|trượt giá)\s*(?:of|is|:)?\s*(\d+(?:\.\d+)?%?)/i);
  if (slipMatch) {
    constraints.push({ type: 'slippage', value: slipMatch[1] });
  }

  return {
    action_type: actionType,
    trade_amount: amount,
    source_token_symbol: source,
    destination_token_symbol: dest,
    priority_mode: priorityMode,
    constraints,
  };
}

/**
 * Transforms raw parsed object into a verified IntentParseResult.
 */
async function buildIntentResult(parsed: any): Promise<IntentParseResult | null> {
  if (!parsed || parsed.error) {
    return null;
  }

  const sourceToken = resolveToken(parsed.source_token_symbol);
  const destToken = resolveToken(parsed.destination_token_symbol);
  const sourceAddress = resolveTokenAddress(parsed.source_token_symbol);
  const destAddress = resolveTokenAddress(parsed.destination_token_symbol);

  let confidenceScore = 1.0;
  if (!sourceToken) confidenceScore -= 0.15;
  if (!destToken) confidenceScore -= 0.15;
  if (!sourceAddress) confidenceScore -= 0.25;
  if (!destAddress) confidenceScore -= 0.25;

  const parsedAmount = parseFloat(String(parsed.trade_amount).replace(/,/g, ''));
  if (!parsedAmount || parsedAmount <= 0) confidenceScore -= 0.2;

  confidenceScore = Math.max(0.1, Math.min(1.0, confidenceScore));

  return {
    intent: {
      action_type: parsed.action_type || 'SWAP',
      trade_amount: String(parsed.trade_amount).replace(/,/g, ''),
      source_token_symbol: sourceToken?.symbol || parsed.source_token_symbol,
      source_token_address: sourceAddress,
      destination_token_symbol: destToken?.symbol || parsed.destination_token_symbol,
      destination_token_address: destAddress,
      priority_mode: parsed.priority_mode || 'SAFE',
      user_constraints: (parsed.constraints || []).map((c: any) => ({
        type: c.type,
        value: String(c.value),
        raw: `${c.type}: ${c.value}`,
      })),
    },
    confidence_score: confidenceScore,
    validation_status: confidenceScore >= 0.5 ? 'VALID' : 'AMBIGUOUS',
  };
}

/**
 * Parses natural language prompt into structured trading/bridging intent.
 */
export async function parseIntent(prompt: string): Promise<IntentParseResult> {
  const timer = createTimer('parseIntent');

  // 1. Try LLM parsing via OpenRouter client
  try {
    const rawOutput = await generateLlmCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.1,
    });

    const jsonStr = extractFirstJsonObject(rawOutput);
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const result = await buildIntentResult(parsed);
      if (result) {
        timer.end();
        return result;
      }
    }
  } catch (err) {
    logger.warn(`LLM parsing failed, falling back to deterministic parser: ${(err as Error).message}`);
  }

  // 2. Deterministic rule-based fallback
  const fallback = parseDeterministic(prompt);
  if (fallback) {
    const result = await buildIntentResult(fallback);
    if (result) {
      timer.end();
      return result;
    }
  }

  timer.end();
  return {
    intent: {
      action_type: 'SWAP',
      trade_amount: '0',
      source_token_symbol: 'BTC',
      source_token_address: resolveTokenAddress('BTC'),
      destination_token_symbol: 'mUSDC',
      destination_token_address: resolveTokenAddress('mUSDC'),
      priority_mode: 'SAFE',
      user_constraints: [],
    },
    confidence_score: 0.1,
    validation_status: 'INVALID_FORMAT',
  };
}
