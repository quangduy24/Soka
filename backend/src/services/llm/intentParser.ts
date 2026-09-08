/**
 * DIEPS Intent Engine — Intent Parser
 * Parses natural language swap commands into structured intents.
 * Supports Gemini API, OpenRouter LLM, and Deterministic Fallback.
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, OPENROUTER_API_KEY, OPENROUTER_MODEL_CANDIDATES, OPENROUTER_BASE_URL } from '../../config/index.js';
import { resolveToken, resolveTokenAddress } from '../coin/tokenResolver.js';
import { logger, createTimer } from '../../utils/logger.js';
import type { ParsedIntent, IntentParseResult, PriorityMode, UserConstraint } from '../../types/index.js';

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

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
 * Deterministic rule-based parser fallback.
 * Works offline and without API keys for standard trading prompts.
 */
function parseDeterministic(prompt: string): any | null {
  const p = prompt.trim();
  const isSwap = /(swap|trade|exchange|convert|buy|sell|đổi|hoán đổi|bán|mua)/i.test(p);
  if (!isSwap) return null;

  let priorityMode = 'SAFE';
  if (/(fast|quick|nhanh)/i.test(p)) priorityMode = 'FAST';
  else if (/(max|best rate|tối đa|tốt nhất)/i.test(p)) priorityMode = 'MAX_OUTPUT';

  let amount = 'MISSING';
  let source = '';
  let dest = '';

  // Pattern 1: [action] [amount] [source] (to|for|sang|thành|lấy) [dest]
  const m1 = p.match(/(?:swap|trade|exchange|convert|buy|sell|đổi|hoán đổi|bán|mua)\s+(all|max|\d+(?:\.\d+)?%?)\s+([a-zA-Z0-9_:.]+)\s+(?:to|for|into|sang|thành|lấy)\s+([a-zA-Z0-9_:.]+)/i);
  if (m1) {
    amount = m1[1].toUpperCase();
    source = m1[2].toUpperCase();
    dest = m1[3].toUpperCase();
  } else {
    // Pattern 2: [action] [source] (to|for|sang|thành) [dest] (missing amount)
    const m2 = p.match(/(?:swap|trade|exchange|convert|buy|sell|đổi|hoán đổi|bán|mua)\s+([a-zA-Z0-9_:.]+)\s+(?:to|for|into|sang|thành|lấy)\s+([a-zA-Z0-9_:.]+)/i);
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
    action_type: 'SWAP',
    trade_amount: amount,
    source_token_symbol: source,
    destination_token_symbol: dest,
    priority_mode: priorityMode,
    constraints,
  };
}

/**
 * Transform raw parsed object into a verified IntentParseResult.
 */
async function buildIntentResult(parsed: any): Promise<IntentParseResult | null> {
  if (!parsed || parsed.error) {
    logger.warn('Parsed response indicated unclear_intent or empty', { parsed });
    return null;
  }

  // Resolve tokens
  const sourceToken = resolveToken(parsed.source_token_symbol);
  const destToken = resolveToken(parsed.destination_token_symbol);
  const [sourceAddress, destAddress] = await Promise.all([
    resolveTokenAddress(parsed.source_token_symbol),
    resolveTokenAddress(parsed.destination_token_symbol),
  ]);

  let confidenceScore = 1.0;
  if (!sourceToken) confidenceScore -= 0.15;
  if (!destToken) confidenceScore -= 0.15;
  if (!sourceAddress) confidenceScore -= 0.25;
  if (!destAddress) confidenceScore -= 0.25;

  const parsedAmount = parseFloat(String(parsed.trade_amount).replace(/,/g, ''));
  if (!parsedAmount || parsedAmount <= 0) confidenceScore -= 0.2;
  if (!parsed.action_type) confidenceScore -= 0.05;

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
 * Parse a natural language prompt into a structured swap intent.
 * 1. Attempts Gemini API if GEMINI_API_KEY is configured.
 * 2. Attempts OpenRouter if OPENROUTER_API_KEY is configured.
 * 3. Falls back to deterministic rule-based parser.
 */
export async function parseIntent(prompt: string): Promise<IntentParseResult> {
  const timer = createTimer('parseIntent');

  // 1. Try Gemini API
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      logger.info('Attempting LLM parsing via Gemini');
      const response = await gemini.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (text) {
        const jsonStr = extractFirstJsonObject(text);
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          const result = await buildIntentResult(parsed);
          if (result) {
            timer.end({ method: 'gemini', confidence: result.confidence_score });
            return result;
          }
        }
      }
    } catch (err: any) {
      logger.warn('Gemini intent parsing failed, trying fallback', { error: err.message });
    }
  }

  // 2. Try OpenRouter if configured
  if (OPENROUTER_API_KEY) {
    try {
      const llmResult = await parseWithOpenRouter(prompt);
      if (llmResult) {
        timer.end({ method: 'openrouter', confidence: llmResult.confidence_score });
        return llmResult;
      }
    } catch (err: any) {
      logger.warn('OpenRouter parsing failed, trying deterministic fallback', { error: err.message });
    }
  }

  // 3. Fall back to Deterministic Parser
  try {
    logger.info('Using deterministic intent parser fallback');
    const deterministicParsed = parseDeterministic(prompt);
    if (deterministicParsed) {
      const result = await buildIntentResult(deterministicParsed);
      if (result) {
        timer.end({ method: 'deterministic', confidence: result.confidence_score });
        return result;
      }
    }
  } catch (err: any) {
    logger.error('Deterministic parsing failed', { error: err.message });
  }

  timer.end({ method: 'failed' });
  throw new Error('Could not parse swap intent from prompt. Please specify tokens and amount (e.g. "Swap 0.05 BTC to MUSD").');
}

const SYSTEM_PROMPT = `You are a DeFi intent parser for the blockchain. Parse the user's trading intent into a structured JSON response.

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
- Token symbols should be uppercase (e.g. SUI, USDC, USDT, ETH, BTC, CETUS, TURBOS, BLUB, MUSD, etc). Accept ANY word as a valid token symbol.
- IMPORTANT: If the user provides a FULL CONTRACT ADDRESS (e.g. 0x...::pepe::PEPE), you MUST output the EXACT FULL ADDRESS as the symbol. DO NOT shorten it.
- priority_mode: "SAFE" (default/low slippage), "FAST" (quick execution), "MAX_OUTPUT" (best rate)
- constraints: array of objects with {type, value} for slippage, deadline, etc.

If the intent is completely unrelated to trading, respond with:
{"error": "unclear_intent"}`;

/**
 * Parse intent by trying each candidate OpenRouter model in order.
 */
async function parseWithOpenRouter(prompt: string): Promise<IntentParseResult | null> {
  const errors: string[] = [];

  for (const model of OPENROUTER_MODEL_CANDIDATES) {
    try {
      logger.info('Attempting LLM parsing via OpenRouter', { model });
      const parsed = await callOpenRouterModel(model, prompt);
      if (parsed) {
        return await buildIntentResult(parsed);
      }
    } catch (err: any) {
      errors.push(`${model}: ${err.message}`);
      logger.warn('LLM model attempt failed, trying next candidate', {
        model,
        error: err.message,
      });
    }
  }

  throw new Error(`All OpenRouter models failed — ${errors.join(' | ')}`);
}

/**
 * Single-model attempt on OpenRouter.
 */
async function callOpenRouterModel(model: string, prompt: string): Promise<any | null> {
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
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');

  const jsonStr = extractFirstJsonObject(content);
  if (!jsonStr) throw new Error('No JSON found in LLM response');

  return JSON.parse(jsonStr);
}
