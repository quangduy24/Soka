/**
 * DIEPS Intent Engine — Intent Parser
 * Parses natural language swap commands into structured intents.
 * Uses OpenRouter LLM parsing exclusively.
 */

import { OPENROUTER_API_KEY, OPENROUTER_MODEL_CANDIDATES, OPENROUTER_BASE_URL } from '../../config/index.js';
import { resolveToken, resolveTokenAddress } from '../coin/tokenResolver.js';
import { logger, createTimer } from '../../utils/logger.js';
import type { ParsedIntent, IntentParseResult, PriorityMode, UserConstraint } from '../../types/index.js';



/**
 * Extract the first complete top-level JSON object from an LLM response.
 * Handles markdown code fences and surrounding prose, and — unlike a greedy
 * `/\{[\s\S]*\}/` match — stops at the matching closing brace so trailing text
 * containing braces cannot corrupt the parse. String literals (including
 * escaped quotes) are skipped so braces inside strings are ignored.
 */
function extractFirstJsonObject(raw: string): string | null {
  // Strip markdown code fences like ```json ... ```
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
  return null; // unbalanced braces
}

/**
 * Parse a natural language prompt into a structured swap intent.
 * Uses OpenRouter LLM exclusively for processing intents.
 */
export async function parseIntent(prompt: string): Promise<IntentParseResult> {
  const timer = createTimer('parseIntent');

  if (!OPENROUTER_API_KEY) {
    timer.end({ method: 'failed' });
    throw new Error('OPENROUTER_API_KEY is not configured. Cannot parse intent.');
  }

  try {
    const llmResult = await parseWithLLM(prompt);
    if (llmResult) {
      timer.end({ method: 'llm', confidence: llmResult.confidence_score });
      return llmResult;
    }
  } catch (err: any) {
    logger.error('LLM parsing failed', { error: err.message });
    timer.end({ method: 'failed' });
    throw new Error(`Failed to parse intent: ${err.message}`);
  }

  timer.end({ method: 'failed' });
  throw new Error('Could not parse intent from prompt');
}


const SYSTEM_PROMPT = `You are a DeFi intent parser for the Sui blockchain. Parse the user's trading intent into a structured JSON response.

You MUST respond with ONLY valid JSON, no other text. The JSON must have this exact structure:
{
  "action_type": "SWAP",
  "trade_amount": "1000",
  "source_token_symbol": "SUI",
  "destination_token_symbol": "USDC",
  "priority_mode": "SAFE",
  "constraints": []
}

Rules:
- action_type is always "SWAP" for trading intents
- trade_amount is a number string (no commas). If the user wants to swap their ENTIRE / ALL / MAX / whole balance of the source token, set trade_amount to "ALL". If they want a percentage (e.g. "half my USDC" → "50%", "a quarter" → "25%"), set trade_amount to that percentage string like "50%".
- IMPORTANT: If the user DOES NOT specify an amount (e.g. "Swap DEEP to SUI", "Trade USDC for ETH"), you MUST set trade_amount to "MISSING". Do not guess or assume a number like "1000" if it was not provided.
- Token symbols should be uppercase. The Sui ecosystem has many coins including meme coins (e.g. SUI, USDC, USDT, ETH, BTC, CETUS, TURBOS, BLUB, FUD, NAVX, SCA, etc). Accept ANY word as a valid token symbol.
- IMPORTANT: If the user provides a FULL CONTRACT ADDRESS (e.g. 0x...::pepe::PEPE), you MUST output the EXACT FULL ADDRESS as the symbol. DO NOT shorten it.
- IMPORTANT: If the user asks for a token by name/symbol that is a very new or rare meme coin (which might not be in standard registries), try your best to output its FULL Sui contract address (coinType) as the symbol if you know it.
- priority_mode: "SAFE" (default/low slippage), "FAST" (quick execution), "MAX_OUTPUT" (best rate)
- constraints: array of objects with {type, value} for slippage, deadline, etc.

If the intent is completely unrelated to trading, respond with:
{"error": "unclear_intent"}`;

/**
 * Parse intent by trying each candidate model in order (primary + fallbacks).
 * A model is retried on transient failures (rate limit, unavailable, empty or
 * unparseable output); a definitive `unclear_intent` result stops the loop.
 * Only when EVERY candidate fails do we surface an error — this is what keeps
 * the "ask AI" step from failing during demos.
 */
async function parseWithLLM(prompt: string): Promise<IntentParseResult | null> {
  const errors: string[] = [];

  for (const model of OPENROUTER_MODEL_CANDIDATES) {
    try {
      logger.info('Attempting LLM parsing via OpenRouter', { model });
      // A resolved value (result OR null for unclear_intent) is definitive.
      return await callModel(model, prompt);
    } catch (err: any) {
      errors.push(`${model}: ${err.message}`);
      logger.warn('LLM model attempt failed, trying next candidate', {
        model,
        error: err.message,
      });
    }
  }

  throw new Error(`All LLM models failed — ${errors.join(' | ')}`);
}

/**
 * Single-model attempt. Returns a parsed intent, or null for a definitive
 * `unclear_intent`. Throws on any transient/parse failure so the caller can
 * fall back to the next candidate model.
 */
async function callModel(model: string, prompt: string): Promise<IntentParseResult | null> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://dieps-intent-engine.app',
      'X-Title': 'DIEPS Intent Engine',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 300,
      // Ask for strict JSON where the provider supports it (ignored otherwise).
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty LLM response');
  }

  // Extract JSON from the response (in case there's surrounding text)
  const jsonStr = extractFirstJsonObject(content);
  if (!jsonStr) throw new Error('No JSON found in LLM response');

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr: any) {
    throw new Error(`Invalid JSON from model: ${parseErr.message}`);
  }

  logger.info('LLM raw parsed response', { model, parsed });

  if (parsed.error) {
    logger.warn('LLM returned unclear_intent error', { error: parsed.error });
    return null;
  }

  // Resolve tokens.
  // resolveToken only covers the small curated whitelist, so it is used for a
  // canonical display symbol only. Addresses are resolved via
  // resolveTokenAddress, which also consults the 900+ token registry and (for
  // raw coin types) on-chain metadata — otherwise valid registry tokens
  // (e.g. TURBOS, FLOKI) would fall back to a raw symbol string as the
  // "address" and break the downstream router.
  const sourceToken = resolveToken(parsed.source_token_symbol);
  const destToken = resolveToken(parsed.destination_token_symbol);
  const [sourceAddress, destAddress] = await Promise.all([
    resolveTokenAddress(parsed.source_token_symbol),
    resolveTokenAddress(parsed.destination_token_symbol),
  ]);

  // Compute confidence score from parse quality — replaces fixed 0.90.
  // Start at 1.0 and deduct for each uncertainty factor.
  let confidenceScore = 1.0;

  // Token resolution: whitelist tokens are high-confidence; raw coin types (0x...::module::Struct)
  // are medium; unresolved symbols are low.
  if (!sourceToken) confidenceScore -= 0.15;   // source not in whitelist
  if (!destToken) confidenceScore -= 0.15;     // dest not in whitelist
  if (!sourceAddress) confidenceScore -= 0.25; // source address unresolved — critical
  if (!destAddress) confidenceScore -= 0.25;   // dest address unresolved — critical

  // Amount extraction: missing or zero amount reduces confidence
  const parsedAmount = parseFloat(String(parsed.trade_amount).replace(/,/g, ''));
  if (!parsedAmount || parsedAmount <= 0) confidenceScore -= 0.2;

  // Action type: defaulting to SWAP (LLM didn't specify) reduces confidence
  if (!parsed.action_type) confidenceScore -= 0.05;

  // Clamp to [0.1, 1.0]
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
