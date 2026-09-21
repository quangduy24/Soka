/**
 * Soka Intent Engine — Intent Parser
 * Parses natural language commands into structured swap or bridge intents for Mezo Testnet.
 * Uses OpenRouter LLM API with deterministic fallback.
 */

import { generateLlmCompletion } from './llmClient.js';
import { resolveToken, resolveTokenAddress } from '../coin/tokenResolver.js';
import { logger, createTimer } from '../../utils/logger.js';
import { TOKEN_WHITELIST, BridgeDestinationChain } from '../../config/constant.js';
import { INTENT_CONFIG, LLM_DEFAULTS } from '../../config/index.js';
import { getCapabilities, buildFallbackAdvise, type FallbackAdvise } from '../../config/capabilities.js';
import type { ParsedIntent, IntentParseResult, PriorityMode, UserConstraint, ActionType } from '../../types/index.js';

/**
 * Thrown when no executable or answerable intent can be extracted.
 * Carries a structured fallback advise — callers must return it to the user
 * instead of fabricating a swap/bridge intent.
 */
export class UnclearIntentError extends Error {
  readonly advise: FallbackAdvise;
  constructor(advise: FallbackAdvise) {
    super(advise.message);
    this.name = 'UnclearIntentError';
    this.advise = advise;
  }
}

/**
 * Capability-aware system prompt, generated from the live token whitelist and
 * the capability registry so docs and parser can never drift apart.
 */
export function buildSystemPrompt(): string {
  const tokenLines = TOKEN_WHITELIST.map(
    (t) => `- ${t.symbol} (${t.name}, ${t.decimals} decimals)`
  ).join('\n');
  const capabilityLines = getCapabilities()
    .map((c) => `- ${c.action}: ${c.status} — ${c.summary}`)
    .join('\n');
  return `
You are the Soka Intent Engine on Mezo Testnet (Bitcoin Layer 2 EVM).
Your job is to parse user natural language requests into strict JSON.
You know exactly what the system can do:

${capabilityLines}
- LIQUIDITY: Add or remove liquidity to AMM pools.
- IMPORTANT: Soka DOES NOT support Borrow, Vaults, or Staking on Testnet.

Tokens available on Mezo Testnet (MUSD is auto-discovered from live pools):
${tokenLines}
- MUSD (Mezo USD stablecoin, core routing asset)

Output strictly valid JSON with no markdown and no backticks.
For executable intents:
{
  "action_type": "SWAP" | "BRIDGE_OUT" | "TRANSFER" | "LIQUIDITY",
  "trade_amount": "<numeric amount, 'ALL', 'MAX', or 'N%' e.g. '50%'>",
  "source_token_symbol": "<symbol, e.g. BTC, mUSDC>",
  "destination_token_symbol": "<symbol, e.g. mUSDC, BTC>",
  "recipient": "<for TRANSFER and BRIDGE_OUT: The recipient address. If the user does not provide one, omit this field or return null! Do not make one up.>",
  "destination_chain": "<required for BRIDGE_OUT: 0 for Ethereum, 1 for Bitcoin. Never set for TRANSFER>",
  "priority_mode": "SAFE" | "FAST" | "MAX_OUTPUT",
  "constraints": [
    { "type": "slippage" | "deadline" | "minOutput", "value": "<value>" }
  ]
}
For questions and help (never route these to a swap):
{
  "action_type": "ASK_PRICE" | "ASK_POOLS" | "ASK_RISK" | "ASK_BRIDGE_STATUS" | "ASK_GAS" | "ASK_HELP",
  "trade_amount": "0",
  "source_token_symbol": "<token for ASK_PRICE, else BTC>",
  "destination_token_symbol": "<token for ASK_PRICE, else BTC>",
  "priority_mode": "SAFE",
  "constraints": []
}
If the user intent is unclear or outside the capabilities above (like borrowing or vaults), return:
{ "error": "unclear_intent" }
Never invent token addresses, amounts, recipients, or chains.

EXAMPLES:
1) User: "Bridge 0.05 BTC to Ethereum to 0x1234567890abcdef1234567890abcdef12345678"
Output:
{
  "action_type": "BRIDGE_OUT",
  "trade_amount": "0.05",
  "source_token_symbol": "BTC",
  "destination_token_symbol": "BTC",
  "recipient": "0x1234567890abcdef1234567890abcdef12345678",
  "destination_chain": "0",
  "priority_mode": "SAFE",
  "constraints": []
}

2) User: "Bridge 1 MUSD to Bitcoin"
Output:
{
  "action_type": "BRIDGE_OUT",
  "trade_amount": "1",
  "source_token_symbol": "MUSD",
  "destination_token_symbol": "MUSD",
  "recipient": null,
  "destination_chain": "1",
  "priority_mode": "SAFE",
  "constraints": []
}
`;
}


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

/** Multi-word alias normalization (lowercase phrase -> canonical symbol). */
const MULTIWORD_ALIASES: [RegExp, string][] = [
  [/\busd\s+coin\b/gi, 'mUSDC'],
  [/\bwrapped\s+btc\b/gi, 'wBTC'],
  [/\bwrapped\s+bitcoin\b/gi, 'wBTC'],
  [/\bcoinbase\s+btc\b/gi, 'mcbBTC'],
  [/\bfirelight\s+btc\b/gi, 'mFBTC'],
  [/\bthreshold\s+token\b/gi, 'mT'],
];

/** Word amounts mapped to numeric strings (percentages resolve via balances). */
const WORD_AMOUNTS: Record<string, string> = {
  half: '50%',
  'nửa': '50%',
  one: '1',
  'một': '1',
  two: '2',
  hai: '2',
};

const SWAP_VERBS = 'swap|trade|exchange|convert|buy|sell|đổi|hoán đổi|bán|mua';
const TRANSFER_VERBS = 'transfer|send|gửi|pay';
const TOKEN_RE = '[a-zA-Z0-9_:.]+';
const JOINER_RE = 'to|for|into|sang|thành|lấy';

/**
 * Unicode-aware verb matcher: JS \b is ASCII-only and never matches
 * Vietnamese verbs (đổi, bán, mua, gửi), so boundaries use Unicode
 * letter/number classes instead.
 */
function hasVerb(p: string, verbs: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}_])(${verbs})(?![\\p{L}\\p{N}_])`, 'iu').test(p);
}

function normalizePrompt(prompt: string): string {
  let p = prompt.trim();
  for (const [re, symbol] of MULTIWORD_ALIASES) {
    p = p.replace(re, symbol);
  }
  // Drop possessives so "swap my BTC to MUSD" parses as "swap BTC to MUSD".
  p = p.replace(/\bmy\s+(?=[a-zA-Z0-9])/gi, '');
  return p;
}

function expandSuffixAmount(raw: string): string | null {
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*([kKmM])$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  return String(num * (m[2].toLowerCase() === 'k' ? 1_000 : 1_000_000));
}

function parseAmountToken(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/,/g, '');
  if (/^(all|max)$/.test(t)) return t.toUpperCase();
  const word = WORD_AMOUNTS[t];
  if (word) return word;
  const suffixed = expandSuffixAmount(raw);
  if (suffixed) return suffixed;
  if (/^\d+(?:\.\d+)?%?$/.test(t)) return t.replace(/%$/, '') + (t.endsWith('%') ? '%' : '');
  return null;
}

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[.,?!;:]+$/g, '');
}

function parseChainHint(p: string): number | null {
  if (/\b(bitcoin|btc\s*chain|bc1[a-z0-9]{10,}|on\s+bitcoin)\b/i.test(p)) return BridgeDestinationChain.BITCOIN;
  if (/\b(ethereum|eth\b|evm|on\s+ethereum|mainnet)\b/i.test(p)) return BridgeDestinationChain.ETHEREUM;
  return null;
}

function parseRecipient(p: string): string | null {
  const m = p.match(/0x[0-9a-fA-F]{40}/);
  return m ? m[0] : null;
}

/**
 * Deterministic rule-based parser fallback for trading, bridging, transfer,
 * and question intents. Pure function (no network) — safe to unit test.
 */
export function parseDeterministic(prompt: string): any | null {
  const raw = prompt.trim();
  if (!raw) return null;
  const p = normalizePrompt(raw);

  // ── Conversational intents first (never route questions to a swap) ──
  if (/^(what\s+can\s+you\s+do|help|giúp|help\s+me|commands?)\b/i.test(p) || /\bwhat\s+can\s+you\s+do\b/i.test(p)) {
    return { action_type: 'ASK_HELP', trade_amount: '0', source_token_symbol: 'BTC', destination_token_symbol: 'BTC', priority_mode: 'SAFE', constraints: [] };
  }
  const priceQ = p.match(/(?:price\s+of|price\s+for|giá\s+(?:của)?|how\s+much\s+is|worth\s+of)\s+([a-zA-Z0-9_:.]+)/i)
    || (/\b(price|giá|worth)\b/i.test(p) && p.includes('?') ? p.match(new RegExp(`(${TOKEN_RE})`, 'i')) : null);
  if (priceQ) {
    const symbol = stripTrailingPunctuation(priceQ[1]).toUpperCase();
    if (resolveToken(symbol)) {
      return { action_type: 'ASK_PRICE', trade_amount: '0', source_token_symbol: symbol, destination_token_symbol: symbol, priority_mode: 'SAFE', constraints: [] };
    }
  }

  const isBridge = /(bridge|cầu|chuyển cầu|withdraw to|deposit to)/i.test(p);
  const isTransfer = hasVerb(p, TRANSFER_VERBS) && !isBridge;
  const isSwap = hasVerb(p, SWAP_VERBS);

  // Question intents (ASK_*). A verb-like word only counts as executable when
  // it actually binds token slots below ("trade" in "is it safe to trade?"
  // must not become a swap). Patterns are attempted first; unmatched verbs
  // fall through to the question mapping.
  const askOnly = [
    { re: /pool|liquidit|vault|venue/i, action: 'ASK_POOLS' },
    { re: /risk|safe|safety|an toàn|rủi ro|danger/i, action: 'ASK_RISK' },
    { re: /bridge.*(status|capacity|limit|chain)|^(bridge|capacity|limit)/i, action: 'ASK_BRIDGE_STATUS' },
    { re: /gas|phí|fee|cost to trade/i, action: 'ASK_GAS' },
  ] as const;
  const askMatch = askOnly.find(({ re }) => re.test(p)) ?? null;

  const hasExecutableVerb = isBridge || isSwap || isTransfer;
  const verbAlt = isTransfer ? TRANSFER_VERBS : `${SWAP_VERBS}|bridge|chuyển|rút|nạp`;
  const tryM1 = hasExecutableVerb
    ? p.match(
      new RegExp(`(?:${verbAlt})\\s+((?:all\\s+my|my\\s+entire|entire\\s+)?(?:all|max|half|nửa|one|two|một|hai|\\d[\\d,]*(?:\\.\\d+)?%?(?:\\s*[kKmM])?))\\s+(${TOKEN_RE})\\s+(?:${JOINER_RE})\\s+(${TOKEN_RE})`, 'i')
    )
    : null;
  const tryM2 = hasExecutableVerb && !tryM1
    ? p.match(
      new RegExp(`(?:${verbAlt})\\s+(${TOKEN_RE})\\s+(?:${JOINER_RE})\\s+(${TOKEN_RE})`, 'i')
    )
    : null;
  if (!hasExecutableVerb || (!tryM1 && !tryM2)) {
    if (askMatch) {
      return { action_type: askMatch.action, trade_amount: '0', source_token_symbol: 'BTC', destination_token_symbol: 'BTC', priority_mode: 'SAFE', constraints: [] };
    }
    if (!hasExecutableVerb) return null;
  }

  // Priority from explicit phrases only — an ALL/MAX amount must not flip priority.
  let priorityMode: PriorityMode = INTENT_CONFIG.defaultPriority;
  if (/(fast|quick|nhanh)/i.test(p)) priorityMode = 'FAST';
  else if (/(best rate|tối đa|tốt nhất|lowest slippage|trượt giá thấp nhất|max output)/i.test(p)) priorityMode = 'MAX_OUTPUT';

  let amount = INTENT_CONFIG.missingAmount;
  let source = '';
  let dest = '';
  let recipient: string | null = null;
  let destinationChain: number | null = null;
  const actionType: ActionType = isBridge ? 'BRIDGE_OUT' : isTransfer ? 'TRANSFER' : 'SWAP';

  // Patterns attempted above (tryM1/tryM2). At this point at least one matched.
  const m1 = tryM1;
  if (m1) {
    let amountRaw = m1[1].replace(/^(all\s+my|my\s+entire|entire)\s+/i, '');
    if (/^(all\s+my|my\s+entire|entire)\b/i.test(m1[1])) amountRaw = 'ALL';
    amount = parseAmountToken(amountRaw) ?? INTENT_CONFIG.missingAmount;
    source = stripTrailingPunctuation(m1[2]).toUpperCase();
    dest = stripTrailingPunctuation(m1[3]).toUpperCase();
  } else {
    // Pattern 2: [verb] [source] to/for [dest] (+ optional trailing ALL/MAX)
    const m2 = tryM2;
    if (m2) {
      source = stripTrailingPunctuation(m2[1]).toUpperCase();
      dest = stripTrailingPunctuation(m2[2]).toUpperCase();
      const trailing = p.slice((m2.index ?? 0) + m2[0].length);
      const tailAmount = trailing.match(/\b(all|max)\b/i);
      if (tailAmount) amount = tailAmount[1].toUpperCase();
    }
  }

  if (actionType === 'TRANSFER' || actionType === 'BRIDGE_OUT') {
    recipient = parseRecipient(p);
    destinationChain = parseChainHint(p);
    // For transfers the "dest" slot may hold the recipient, not a token.
    if (actionType === 'TRANSFER' && dest && !resolveToken(dest)) {
      if (!recipient && /^0x/i.test(m1?.[3] ?? m1?.[2] ?? '')) recipient = dest;
      dest = source; // TRANSFER has no destination token semantics
    }
  }

  if (!source) return null;
  if (actionType === 'SWAP' && !dest) return null;

  // Extract optional constraints: slippage, deadline, minOutput
  const constraints: { type: string; value: string }[] = [];
  const slipMatch = p.match(/(?:slippage|trượt giá)\s*(?:of|is|:)?\s*(\d+(?:\.\d+)?)\s*%?/i);
  if (slipMatch) {
    constraints.push({ type: 'slippage', value: slipMatch[1] });
  }
  const deadlineMatch = p.match(/deadline\s*(\d+)\s*(m|min|minutes?|h|hours?)\b/i);
  if (deadlineMatch) {
    const unit = /^h/i.test(deadlineMatch[2]) ? 'h' : 'm';
    constraints.push({ type: 'deadline', value: `${deadlineMatch[1]}${unit}` });
  }
  const minOutMatch = p.match(/min(?:imum)?\s*output\s*([\d.,]+)/i);
  if (minOutMatch) {
    constraints.push({ type: 'minOutput', value: minOutMatch[1].replace(/,/g, '') });
  }

  const result: any = {
    action_type: actionType,
    trade_amount: amount,
    source_token_symbol: source,
    destination_token_symbol: dest || source,
    priority_mode: priorityMode,
    constraints,
  };
  if (recipient) result.recipient = recipient;
  if (destinationChain !== null) result.destination_chain = destinationChain;
  return result;
}

/**
 * Transforms raw parsed object into a verified IntentParseResult.
 * Conversational ASK_* intents skip token verification (they are answered,
 * never routed). Throws UnclearIntentError on LLM-reported unclear intents.
 */
async function buildIntentResult(parsed: any): Promise<IntentParseResult | null> {
  if (!parsed) return null;
  if (parsed.error) {
    throw new UnclearIntentError(
      buildFallbackAdvise({
        error: 'unclear_intent',
        detail:
          'I could not understand that request. Soka executes Swaps, Bridge-Outs, and Liquidity actions on Mezo Testnet, answers price/help questions, and quotes (not executes) borrows.',
      })
    );
  }

  const action = (parsed.action_type || 'SWAP') as ActionType;
  if (action.startsWith('ASK_')) {
    const symbol = String(parsed.source_token_symbol || 'BTC').toUpperCase();
    return {
      intent: {
        action_type: action,
        trade_amount: '0',
        source_token_symbol: symbol,
        source_token_address: resolveTokenAddress(symbol),
        destination_token_symbol: symbol,
        destination_token_address: resolveTokenAddress(symbol),
        priority_mode: 'SAFE',
        user_constraints: [],
      },
      confidence_score: 1.0,
      validation_status: 'VALID',
    };
  }

  const sourceToken = resolveToken(parsed.source_token_symbol);
  const destToken = resolveToken(parsed.destination_token_symbol);
  const sourceAddress = resolveTokenAddress(parsed.source_token_symbol);
  const destAddress = resolveTokenAddress(parsed.destination_token_symbol);

  let confidenceScore = INTENT_CONFIG.weights.start;
  if (!sourceToken) confidenceScore -= INTENT_CONFIG.weights.missingToken;
  if (!destToken) confidenceScore -= INTENT_CONFIG.weights.missingToken;
  if (!sourceAddress) confidenceScore -= INTENT_CONFIG.weights.missingAddress;
  if (!destAddress) confidenceScore -= INTENT_CONFIG.weights.missingAddress;

  const amountRaw = String(parsed.trade_amount ?? INTENT_CONFIG.missingAmount).replace(/,/g, '');
  const parsedAmount = parseFloat(amountRaw);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) confidenceScore -= INTENT_CONFIG.weights.missingAmount;

  confidenceScore = Math.max(INTENT_CONFIG.minScore, Math.min(INTENT_CONFIG.maxScore, confidenceScore));

  const intent: ParsedIntent = {
    action_type: action,
    trade_amount: amountRaw,
    source_token_symbol: sourceToken?.symbol || parsed.source_token_symbol,
    source_token_address: sourceAddress,
    destination_token_symbol: destToken?.symbol || parsed.destination_token_symbol,
    destination_token_address: destAddress,
    priority_mode: parsed.priority_mode || INTENT_CONFIG.defaultPriority,
    user_constraints: (parsed.constraints || []).map((c: any) => ({
      type: c.type,
      value: String(c.value),
      raw: `${c.type}: ${c.value}`,
    })),
  };
  if (parsed.recipient) intent.recipient = String(parsed.recipient);
  if (parsed.destination_chain !== undefined && parsed.destination_chain !== null) {
    intent.destination_chain = Number(parsed.destination_chain);
  }

  return {
    intent,
    confidence_score: confidenceScore,
    validation_status: confidenceScore >= INTENT_CONFIG.validThreshold ? 'VALID' : 'AMBIGUOUS',
  };
}

const QUESTION_HINT = /(help|price|giá|what|how|can you|pool|risk|gas|faucet|do you|borrow|vault|stake|earn)/i;
const AMOUNT_HINT = /(all|max|\d|%|half|nửa|one|two|một|hai|\bk\b|\bm\b)/i;

/**
 * Rejects prompts with no actionable trading content before any LLM call, so
 * a hallucinating model can never turn chatter ("hello there") into a VALID
 * swap/bridge intent. Pure function — safe to unit test.
 */
export function hasActionableContent(prompt: string): boolean {
  const p = (prompt || '').trim();
  if (!p) return false;
  if (QUESTION_HINT.test(p)) return true;
  if (/0x[0-9a-fA-F]{40}/.test(p)) return true;
  if (AMOUNT_HINT.test(p)) return true;
  const words = p.toLowerCase().split(/[^a-z0-9à-ỹ]+/iu);
  if (words.some((w) => w && resolveToken(w))) return true;
  if (hasVerb(p, `${SWAP_VERBS}|${TRANSFER_VERBS}|bridge|cầu`)) return true;
  return false;
}

/**
 * Parses natural language prompt into a structured intent.
 * Never fabricates a fallback intent: when neither the LLM nor the
 * deterministic parser yields a usable intent, throws UnclearIntentError with
 * a structured fallback advise for the user.
 */
export async function parseIntent(prompt: string): Promise<IntentParseResult> {
  const timer = createTimer('parseIntent');

  if (!hasActionableContent(prompt)) {
    timer.end();
    throw new UnclearIntentError(
      buildFallbackAdvise({
        error: 'unclear_intent',
        detail:
          'That message has no trading content I can act on. Soka executes Swaps, Bridge-Outs, and Liquidity actions on Mezo Testnet — try one of the examples below.',
      })
    );
  }

  // 1. Try LLM parsing via OpenRouter client
  try {
    const rawOutput = await generateLlmCompletion({
      systemPrompt: buildSystemPrompt(),
      userPrompt: prompt,
      temperature: LLM_DEFAULTS.parserTemperature,
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
    if (err instanceof UnclearIntentError) {
      timer.end();
      throw err;
    }
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

  // 3. No fabricated intent — advise the user instead.
  timer.end();
  throw new UnclearIntentError(
    buildFallbackAdvise({
      error: 'unclear_intent',
      detail:
        'I could not understand that request. Soka executes Swaps, Bridge-Outs, and Liquidity actions on Mezo Testnet — try one of the examples below.',
    })
  );
}
